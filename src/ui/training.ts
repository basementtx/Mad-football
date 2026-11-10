/** Training: pick free practice with the whole team or one player against the keeper. */
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { profile, clubTeamDef, lineupCards, cardById } from '../meta/profile';
import { TEAMS } from '../game/teams';
import { setScreen, bind, paintTag, spriteSource, lookFor, MenuHandlers } from './common';
import { showHub } from './hub';
import { settings } from '../engine/storage';

export type PlayMode = 'team' | 'keeper' | 'freekick' | 'duel';
let pick: PlayMode = 'freekick';
let duelDiff = 'normal';
const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);

/** best free-kick score hunt */
export function fkBest(): number {
  try {
    return Number(localStorage.getItem('mf.fkBest')) || 0;
  } catch {
    return 0;
  }
}
export function saveFkBest(v: number) {
  try {
    localStorage.setItem('mf.fkBest', String(v));
  } catch {
    /* ignore */
  }
}

export function showTraining(h: MenuHandlers) {
  const L = t();
  const club = clubTeamDef()!;
  const me = cardById(profile.myPlayer) ?? lineupCards().find((c) => c && c.pos !== 'GK') ?? null;
  const myLook = me?.look ?? { skin: '#e5b48f', hair: '#3b2416', hairStyle: 0, beard: false };
  const squad = lineupCards().filter((c) => c && c.pos !== 'GK').slice(0, 3);
  const keeperKit = TEAMS[(club.name.length + 2) % TEAMS.length];
  const render = () => {
    setScreen(
      'screen-training',
      `<div class="training">
        <div class="panel-head">
          <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
          <div class="panel-title">${L2('GAME MODES', 'OYUN MODLARI')}</div>
          <div style="width:80px"></div>
        </div>
        <div class="tr-modes">
          <button class="tr-card ${pick === 'team' ? 'on' : ''}" data-mode="team">
            <div class="tr-art">${squad.map((c, i) => paintTag(spriteSource(lookFor(club, c!.look), i % 2 ? 'run1' : 'idle0', i === 2), 'tr-spr')).join('')}</div>
            <b>${L.trainTeam}</b>
            <p>${L.trainTeamDesc}</p>
          </button>
          <button class="tr-card ${pick === 'keeper' ? 'on' : ''}" data-mode="keeper">
            <div class="tr-art">${paintTag(spriteSource(lookFor(club, myLook), 'kick1'), 'tr-spr')}<span class="tr-vs">VS</span>${paintTag(spriteSource(lookFor(keeperKit, { skin: '#c98d63', hair: '#1a1310', hairStyle: 1, beard: true }, true), 'dive', true), 'tr-spr')}</div>
            <b>${L.trainKeeper}</b>
            <p>${L.trainKeeperDesc}</p>
          </button>
          <button class="tr-card tr-new ${pick === 'freekick' ? 'on' : ''}" data-mode="freekick">
            <div class="tr-art">${paintTag(spriteSource(lookFor(club, myLook), 'kick1'), 'tr-spr')}${[0, 1, 2].map((i) => paintTag(spriteSource(lookFor(keeperKit, { skin: ['#c98d63', '#e5b48f', '#7a4d30'][i], hair: '#1a1310', hairStyle: i, beard: false }), 'idle0', true), 'tr-spr tr-wallman')).join('')}</div>
            <b>${L2('FREE KICKS', 'SERBEST VURUŞ')}</b>
            <p>${L2('10 kicks over the wall. Corners, top bins and curlers score more.', 'Barajın üstünden 10 atış. Köşe, doksan ve falsolu goller daha çok puan.')}</p>
            ${fkBest() ? `<small class="tr-best">${L2('BEST', 'REKOR')} ${fkBest()}</small>` : ''}
          </button>
          <button class="tr-card tr-new ${pick === 'duel' ? 'on' : ''}" data-mode="duel">
            <div class="tr-art">${paintTag(spriteSource(lookFor(club, myLook), 'run1'), 'tr-spr')}<span class="tr-wall"></span>${paintTag(spriteSource(lookFor(keeperKit, { skin: '#c98d63', hair: '#1a1310', hairStyle: 2, beard: true }), 'run1', true), 'tr-spr')}</div>
            <b>${L2('WALL DUEL', 'DUVAR DÜELLOSU')}</b>
            <p>${L2('1v1 on a small court. You are striker and keeper; nobody crosses the middle, the ball does.', 'Küçük sahada 1v1. Hem forvet hem kalecisin; ortayı kimse geçemez, sadece top geçer.')}</p>
          </button>
        </div>
        <div class="tr-foot">
          ${pick === 'duel' ? `<div class="seg small tr-diff">${[['easy', L.easy], ['normal', L.normal], ['hard', L.hard], ['insane', L.insane]].map(([v, l]) => `<button class="${duelDiff === v ? 'on' : ''}" data-diff="${v}">${l}</button>`).join('')}</div>` : ''}
          <button class="btn btn-primary btn-start" data-act="go">${L.start} ▶</button>
        </div>
      </div>`,
    );
    bind('[data-act=back]', () => { audio.click(); showHub(h); });
    bind('[data-mode]', (el) => { pick = el.dataset.mode as PlayMode; audio.click(); render(); });
    bind('[data-diff]', (el) => { duelDiff = el.dataset.diff!; audio.click(); render(); });
    bind('[data-act=go]', () => { audio.select(); h.startTraining(pick, duelDiff); });
  };
  render();
}

/** End of a free-kick round or a wall duel. */
export function showModeResults(o: {
  title: string;
  big: string;
  sub?: string;
  rows?: [string, string | number, string | number][];
  chips?: string;
  coins: number;
  again: () => void;
  menu: () => void;
  win?: boolean | null;
}) {
  setScreen(
    'screen-online',
    `<div class="panel online on-results ${o.win === true ? 'res-win' : o.win === false ? 'res-loss' : ''}">
      <div class="panel-head"><div class="panel-title">${o.title}</div></div>
      <div class="on-body">
        <div class="on-score"><b>${o.big}</b></div>
        ${o.sub ? `<p class="on-lead">${o.sub}</p>` : ''}
        ${o.chips ? `<div class="fk-chips">${o.chips}</div>` : ''}
        ${o.rows?.length ? `<table class="on-stats">${o.rows.map(([k, a, b]) => `<tr><td>${a}</td><th>${k}</th><td>${b}</td></tr>`).join('')}</table>` : ''}
        ${o.coins ? `<p class="on-coins">+${o.coins} ${t().coins}</p>` : ''}
        <div class="on-choices">
          <button class="btn btn-xl" data-act="again">${L2('PLAY AGAIN', 'TEKRAR OYNA')}</button>
          <button class="btn btn-ghost" data-act="menu">${L2('MAIN MENU', 'ANA MENÜ')}</button>
        </div>
      </div>
    </div>`,
  );
  bind('[data-act=again]', () => { audio.select(); o.again(); });
  bind('[data-act=menu]', () => { audio.click(); o.menu(); });
}
