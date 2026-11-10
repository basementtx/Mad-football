/** Online 1v1 lobby: create a room (show its code) or join one by code. */
import { setScreen, bind, esc, toast } from './common';
import { settings } from '../engine/storage';
import { audio } from '../engine/audio';
import { t } from '../engine/i18n';
import { NetLink, newRoomCode, cleanCode, Matchmaker } from '../net/link';
import { rank, tierOf } from '../meta/rank';
import { NET_VERSION } from '../net/sync';
import type { Match } from '../game/match';
import type { TeamDef } from '../game/teams';
import type { CardData } from '../meta/cards';
import type { MatchConfig } from '../game/match';

const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);

/** What a guest tells the host about its side. */
export interface Hello {
  t: 'hello';
  v: number;
  club: TeamDef;
  cards: CardData[];
  loadout: MatchConfig['loadout'];
  /** a ranked match (random opponent) and this player's rating */
  ranked?: boolean;
  rating?: number;
}
export interface StartMsg {
  t: 'start';
  v: number;
  cfg: MatchConfig;
  ranked?: boolean;
  /** the host's rating */
  rating?: number;
}

export interface OnlineHooks {
  /** my side: club, squad and equipped items */
  mySide(): { club: TeamDef; cards: CardData[]; loadout: MatchConfig['loadout'] };
  /** host: both sides are known - start the match */
  hostStart(link: NetLink, hello: Hello): void;
  /** guest: the host started the match */
  guestStart(link: NetLink, start: StartMsg): void;
  back(): void;
}

let active: NetLink | null = null;
let mm: Matchmaker | null = null;
function drop() {
  active?.close();
  active = null;
  mm?.cancel();
  mm = null;
}

/** "Gold · 1268" with the tier colour */
export function rankTag(elo: number) {
  const tr = tierOf(elo);
  return `<span class="rk-tag" style="--rc:${tr.color}">${esc(tr.name[settings.lang === 'tr' ? 1 : 0])} · ${elo}</span>`;
}

export function showOnline(h: OnlineHooks) {
  drop();
  setScreen(
    'screen-online',
    `<div class="panel online">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${t().back}</button>
        <div class="panel-title">${L2('ONLINE 1v1', 'ONLINE 1v1')}</div>
        <div style="width:80px"></div>
      </div>
      <div class="on-body">
        <div class="on-ranked">
          <div class="rk-card">
            <small>${L2('RANKED', 'DERECELİ')}</small>
            ${rankTag(rank().elo)}
            <span class="rk-rec">${rank().wins}${t().w} ${rank().draws}${t().d} ${rank().losses}${t().l} · ${L2('best', 'en iyi')} ${rank().peak}</span>
          </div>
          <button class="btn btn-xl btn-primary" data-act="find">${L2('FIND OPPONENT', 'RAKİP BUL')} ▶</button>
        </div>
        <p class="on-lead">${L2('Or play a friend: one of you creates a room, the other types its code (not ranked).', 'Ya da arkadaşınla oyna: biriniz oda kurar, diğeri kodu girer (derecesiz).')}</p>
        <div class="on-choices">
          <button class="btn btn-xl" data-act="create">${L2('CREATE ROOM', 'ODA KUR')}</button>
          <div class="on-join">
            <input class="on-code" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${L2('CODE', 'KOD')}" />
            <button class="btn btn-xl" data-act="join">${L2('JOIN', 'KATIL')}</button>
          </div>
        </div>
        <p class="on-note">${L2('Each of you plays with your own club. Needs internet on both phones.', 'Herkes kendi kulübüyle oynar. İki telefonda da internet gerekir.')}</p>
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); drop(); h.back(); });
  bind('[data-act=create]', () => { audio.select(); createRoom(h); });
  bind('[data-act=find]', () => { audio.select(); findOpponent(h); });
  const field = document.querySelector<HTMLInputElement>('.on-code');
  field?.addEventListener('input', () => { field.value = cleanCode(field.value); });
  const join = () => {
    const code = cleanCode(field?.value ?? '');
    if (code.length < 4) {
      toast(L2('Type the room code first', 'Önce oda kodunu yaz'));
      return;
    }
    audio.select();
    joinRoom(h, code);
  };
  bind('[data-act=join]', join);
  field?.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
}

function waitScreen(title: string, code: string | null, status: string, h: OnlineHooks) {
  setScreen(
    'screen-online',
    `<div class="panel online">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="cancel">‹ ${L2('Cancel', 'Vazgeç')}</button>
        <div class="panel-title">${esc(title)}</div>
        <div style="width:80px"></div>
      </div>
      <div class="on-body">
        ${code ? `<div class="on-codebox"><small>${L2('ROOM CODE', 'ODA KODU')}</small><b>${esc(code)}</b></div>` : ''}
        <p class="on-status"><span class="on-spin"></span><span class="on-st">${esc(status)}</span></p>
      </div>
    </div>`,
  );
  bind('[data-act=cancel]', () => { audio.click(); drop(); showOnline(h); });
}

function setStatus(s: string) {
  const el = document.querySelector('.on-st');
  if (el) el.textContent = s;
}

function failMsg(why?: string) {
  if (why === 'unavailable-id') return L2('That room code is taken - try again', 'Bu oda kodu kullanımda, tekrar dene');
  if (why === 'peer-unavailable') return L2('No room with that code', 'Bu kodla bir oda yok');
  if (why === 'network' || why === 'server-error' || why === 'socket-error' || why === 'socket-closed') return L2('No connection - check the internet', 'Bağlantı yok, interneti kontrol et');
  if (why === 'browser-incompatible') return L2('This device cannot play online', 'Bu cihaz online oynayamıyor');
  if (why === 'full') return L2('That room is already full', 'Bu oda dolu');
  if (why === 'version') return L2('Update the game on both phones', 'İki telefonda da oyunu güncelleyin');
  return L2('Connection lost', 'Bağlantı koptu');
}

/** Host side: wait for the guest's hello, then start the match. */
function hostHandshake(h: OnlineHooks, link: NetLink, ranked: boolean) {
  link.onMessage = (msg) => {
    const m = msg as Hello;
    if (m?.t !== 'hello') return;
    if (m.v !== NET_VERSION) {
      link.send({ t: 'err', why: 'version' });
      toast(failMsg('version'));
      return;
    }
    active = null; // the match owns the link now
    h.hostStart(link, { ...m, ranked });
  };
}

/** Guest side: say hello (club, squad, rating), then wait for the kick-off. */
function guestHandshake(h: OnlineHooks, link: NetLink, ranked: boolean) {
  const hello = () => {
    setStatus(L2('Connected - waiting for kick-off...', 'Bağlandı, başlama vuruşu bekleniyor...'));
    const side = h.mySide();
    const msg: Hello = { t: 'hello', v: NET_VERSION, club: side.club, cards: side.cards, loadout: side.loadout, ranked, rating: rank().elo };
    link.send(msg);
  };
  link.onMessage = (msg) => {
    const m = msg as { t?: string; why?: string };
    if (m?.t === 'full' || m?.t === 'err') {
      active = null;
      link.close();
      toast(failMsg(m.t === 'full' ? 'full' : m.why));
      showOnline(h);
      return;
    }
    if (m?.t !== 'start') return;
    active = null;
    h.guestStart(link, m as unknown as StartMsg);
  };
  if (link.ready) hello();
  return hello;
}

function createRoom(h: OnlineHooks) {
  drop();
  const code = newRoomCode();
  const link = (active = new NetLink());
  waitScreen(L2('ONLINE 1v1', 'ONLINE 1v1'), code, L2('Connecting...', 'Bağlanıyor...'), h);
  link.onState = (s, why) => {
    if (s === 'waiting') setStatus(L2('Waiting for your friend - tell them the code', 'Arkadaşın bekleniyor, kodu ona söyle'));
    else if (s === 'open') setStatus(L2('Friend connected...', 'Arkadaşın bağlandı...'));
    else if (s === 'closed' && active === link) {
      active = null;
      toast(failMsg(why));
      showOnline(h);
    }
  };
  hostHandshake(h, link, false);
  link.host(code);
}

function joinRoom(h: OnlineHooks, code: string) {
  drop();
  const link = (active = new NetLink());
  waitScreen(L2('ONLINE 1v1', 'ONLINE 1v1'), code, L2('Looking for the room...', 'Oda aranıyor...'), h);
  const hello = guestHandshake(h, link, false);
  link.onState = (s, why) => {
    if (s === 'open') hello();
    else if (s === 'closed' && active === link) {
      active = null;
      toast(failMsg(why));
      showOnline(h);
    }
  };
  link.join(code);
}

/** Ranked: a random opponent who is searching right now. */
function findOpponent(h: OnlineHooks) {
  drop();
  const t0 = Date.now();
  waitScreen(L2('FINDING AN OPPONENT', 'RAKİP ARANIYOR'), null, L2('Looking for players...', 'Oyuncu aranıyor...'), h);
  const el = document.querySelector('.on-body');
  el?.insertAdjacentHTML('afterbegin', `<div class="rk-card">${rankTag(rank().elo)}</div><b class="on-elapsed">0:00</b>`);
  const timer = window.setInterval(() => {
    const e = document.querySelector('.on-elapsed');
    if (!e) return clearInterval(timer);
    const s2 = Math.floor((Date.now() - t0) / 1000);
    e.textContent = `${Math.floor(s2 / 60)}:${String(s2 % 60).padStart(2, '0')}`;
  }, 1000);
  const m = (mm = new Matchmaker());
  m.onStatus = (s, why) => {
    if (s === 'error') {
      clearInterval(timer);
      mm = null;
      toast(failMsg(why));
      showOnline(h);
    } else setStatus(s === 'searching' ? L2('Looking for players...', 'Oyuncu aranıyor...') : L2('Waiting for someone to join...', 'Birinin katılması bekleniyor...'));
  };
  m.onFound = (link, role) => {
    clearInterval(timer);
    mm = null;
    active = link;
    setStatus(L2('Opponent found!', 'Rakip bulundu!'));
    audio.select();
    link.onState = (s, why) => {
      if (s === 'closed' && active === link) {
        active = null;
        toast(failMsg(why));
        showOnline(h);
      }
    };
    if (role === 'host') hostHandshake(h, link, true);
    else guestHandshake(h, link, true);
  };
  m.start();
}

/** Final whistle of an online match, from this phone's side. */
export function showOnlineResults(m: Match, coins: number, again: () => void, menu: () => void, left = false, rated: { before: number; after: number; change: number } | null = null) {
  const me = m.me, opp = me.opp;
  const res = left ? 'win' : me.score > opp.score ? 'win' : me.score < opp.score ? 'loss' : 'draw';
  const title = left ? L2('YOUR FRIEND LEFT', 'ARKADAŞIN AYRILDI') : res === 'win' ? L2('YOU WIN!', 'KAZANDIN!') : res === 'loss' ? L2('YOU LOSE', 'KAYBETTİN') : L2('DRAW', 'BERABERE');
  const total = me.stats.possession + opp.stats.possession || 1;
  const pm = Math.round((me.stats.possession / total) * 100);
  const rows: [string, string | number, string | number][] = [
    [t().possession, pm + '%', 100 - pm + '%'],
    [t().shots, me.stats.shots, opp.stats.shots],
    [t().knockdowns, me.stats.knockdowns, opp.stats.knockdowns],
    [L2('Passes', 'Paslar'), me.stats.passes, opp.stats.passes],
  ];
  setScreen(
    'screen-online',
    `<div class="panel online on-results res-${res}">
      <div class="panel-head"><div class="panel-title">${esc(title)}</div></div>
      <div class="on-body">
        <div class="on-score"><span>${esc(me.def.short)}</span><b>${me.score} - ${opp.score}</b><span>${esc(opp.def.short)}</span></div>
        <table class="on-stats">${rows.map(([k, a, b]) => `<tr><td>${a}</td><th>${esc(k)}</th><td>${b}</td></tr>`).join('')}</table>
        ${rated ? `<p class="rk-change ${rated.change >= 0 ? 'up' : 'down'}">${rankTag(rated.after)} <b>${rated.change >= 0 ? '+' : ''}${rated.change}</b>${tierOf(rated.after).id !== tierOf(rated.before).id ? ` <em>${rated.change > 0 ? L2('PROMOTED!', 'LİG ATLADIN!') : L2('relegated', 'lig düştün')}</em>` : ''}</p>` : ''}
        ${coins ? `<p class="on-coins">+${coins} ${t().coins}</p>` : ''}
        <div class="on-choices">
          <button class="btn btn-xl" data-act="again">${L2('PLAY ONLINE AGAIN', 'TEKRAR ONLINE')}</button>
          <button class="btn btn-ghost" data-act="menu">${L2('MAIN MENU', 'ANA MENÜ')}</button>
        </div>
      </div>
    </div>`,
  );
  bind('[data-act=again]', () => { audio.select(); again(); });
  bind('[data-act=menu]', () => { audio.click(); menu(); });
}
