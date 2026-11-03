/**
 * Transfer market screen, in the Dossier "mail-order catalog" style:
 * one paper sheet, folder tabs, a scout file on the left, catalog tiles on the right,
 * haggling with the seller, offers for your own players and a transfer ledger.
 */
import { settings } from '../engine/storage';
import { audio, vibrate } from '../engine/audio';
import { t } from '../engine/i18n';
import { CardData, overall, rarityOf, STAT_KEYS, Pos } from '../meta/cards';
import { profile, cardById, clubTeamDef, coins } from '../meta/profile';
import { league } from '../meta/league';
import {
  market, tickMarket, refreshMarket, buyNow, makeOffer, quickSell, acceptOffer, rejectOffer, sellBlock,
  quickSaleOf, valueOf, ageOf, bestAt, Listing, Tag, REFRESH_COST, SQUAD_MAX, MAX_ROUNDS,
} from '../meta/market';
import { TEAMS, TeamDef } from '../game/teams';
import { setScreen, bind, esc, paintTag, portraitSource, lookFor, crestTag, coinTag, toast, ui, MenuHandlers } from './common';
import { cardHTML } from './cards';
import { showHub } from './hub';

const DICT = {
  en: {
    title: 'TRANSFER MARKET', kicker: 'TRANSFER WINDOW', list: 'TRANSFER LIST', sell: 'SELL PLAYERS', ledger: 'LEDGER',
    all: 'ALL', sortOvr: 'BEST', sortPrice: 'PRICE', sortAge: 'YOUNG', refreshIn: 'NEW LIST IN', refresh: 'NEW LIST',
    asking: 'ASKING', value: 'Market value', age: 'age', from: 'from', buyNow: 'SIGN NOW', offer: 'MAKE OFFER', send: 'SEND OFFER',
    yourBid: 'YOUR BID', vsBest: 'vs your best', none: 'none', scout: 'SCOUT REPORT', strengths: 'Strengths',
    squad: 'SQUAD', full: 'Squad is full (20). Sell someone first.', poor: 'Not enough coins', need: 'NEED', more: 'MORE',
    signed: 'SIGNED!', sold: 'SOLD', off: 'OFF THE TABLE', rounds: 'talks',
    reply: {
      accept: ['Deal. Pleasure doing business.', 'Done! He packs his boots tonight.', 'You drive a hard bargain. Deal.'],
      counter: ['Make it {n} and he is yours.', 'Can not go below {n}.', '{n}. Final offer... almost.'],
      insult: ['Is that a joke?', 'Come back with a real offer.', 'My grandma bids more than that.'],
      walk: ['Talks are off. Goodbye.', 'We are done here.'],
    },
    tags: { deadline: 'DEADLINE DEAL', bargain: 'BARGAIN', wonderkid: 'WONDERKID', veteran: 'VETERAN', hot: 'HOT' } as Record<Tag, string>,
    quick: 'SELL NOW', quickNote: 'Quick sale to the club pool: half his value, instantly.', offers: 'OFFERS ON THE TABLE', noOffers: 'No offers for him yet. New offers arrive with every new list.',
    accept: 'ACCEPT', reject: 'REJECT', offersFor: 'offers', cantCustom: 'Your own player is not for sale.', cantMin: 'You need at least 5 players.',
    lIn: 'IN', lOut: 'OUT', emptyLedger: 'No transfers yet. The first signing is the hardest.', pickOne: 'Pick a player from the list.',
    spent: 'SPENT', earned: 'EARNED', expired: 'EXPIRED',
  },
  tr: {
    title: 'TRANSFER PAZARI', kicker: 'TRANSFER DÖNEMİ', list: 'TRANSFER LİSTESİ', sell: 'OYUNCU SAT', ledger: 'DEFTER',
    all: 'HEPSİ', sortOvr: 'EN İYİ', sortPrice: 'FİYAT', sortAge: 'GENÇ', refreshIn: 'YENİ LİSTE', refresh: 'YENİ LİSTE',
    asking: 'İSTENEN', value: 'Piyasa değeri', age: 'yaş', from: 'kulübü', buyNow: 'HEMEN AL', offer: 'TEKLİF VER', send: 'TEKLİFİ GÖNDER',
    yourBid: 'TEKLİFİN', vsBest: 'kadrondaki en iyi', none: 'yok', scout: 'GÖZLEMCİ RAPORU', strengths: 'Güçlü yanları',
    squad: 'KADRO', full: 'Kadro dolu (20). Önce birini sat.', poor: 'Yeterli altın yok', need: 'GEREKEN', more: 'DAHA',
    signed: 'İMZALANDI!', sold: 'SATILDI', off: 'MASADAN KALKTI', rounds: 'görüşme',
    reply: {
      accept: ['Anlaştık. İyi çalışmalar.', 'Tamam! Bu akşam kramponlarını topluyor.', 'Sıkı pazarlıkçısın. Anlaştık.'],
      counter: ['{n} yap, oyuncu senin.', '{n} altının altına inemem.', '{n}. Son teklif... sayılır.'],
      insult: ['Şaka mı bu?', 'Ciddi bir teklifle gel.', 'Babaannem daha fazlasını verir.'],
      walk: ['Görüşmeler bitti. Hoşça kal.', 'Burada işimiz bitti.'],
    },
    tags: { deadline: 'SON GÜN FIRSATI', bargain: 'KELEPİR', wonderkid: 'GENÇ YETENEK', veteran: 'TECRÜBELİ', hot: 'YILDIZ' } as Record<Tag, string>,
    quick: 'HEMEN SAT', quickNote: 'Kulüp havuzuna hızlı satış: değerinin yarısı, anında.', offers: 'MASADAKİ TEKLİFLER', noOffers: 'Bu oyuncu için henüz teklif yok. Her yeni listeyle yeni teklifler gelir.',
    accept: 'KABUL', reject: 'REDDET', offersFor: 'teklif', cantCustom: 'Kendi oyuncun satılık değil.', cantMin: 'En az 5 oyuncun olmalı.',
    lIn: 'GELEN', lOut: 'GİDEN', emptyLedger: 'Henüz transfer yok. İlk imza her zaman en zorudur.', pickOne: 'Listeden bir oyuncu seç.',
    spent: 'HARCANAN', earned: 'KAZANILAN', expired: 'SÜRESİ DOLDU',
  },
};
const M = () => DICT[settings.lang] ?? DICT.en;
const RAR_COL: Record<string, string> = { bronze: '#B07438', silver: '#9AA6B6', gold: '#E8B60C', hero: '#7A2AD8', legend: '#C82D20' };
const STAT_FULL: Record<string, [string, string]> = { pac: ['Pace', 'Hız'], sho: ['Shooting', 'Şut'], pas: ['Passing', 'Pas'], dri: ['Dribbling', 'Top sürme'], def: ['Defending', 'Savunma'], phy: ['Physical', 'Fizik'] };

type Tab = 'list' | 'sell' | 'ledger';
const S = {
  tab: 'list' as Tab,
  sel: '' as string,
  pos: 'ALL' as 'ALL' | Pos,
  sort: 'ovr' as 'ovr' | 'price' | 'age',
  offering: false,
  bid: 0.85,
  reply: null as null | { kind: string; text: string },
  stampFor: '' as string,
  resetScroll: false,
};

const fmt = (n: number) => n.toLocaleString(settings.lang === 'tr' ? 'tr-TR' : 'en-US');
function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}

function kitFor(name: string): TeamDef {
  return league?.teams?.find((tm) => tm.name === name) ?? TEAMS[Math.abs([...name].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % TEAMS.length];
}

function priceTag(n: number, extra = '') {
  return `<span class="mk-price ${extra}"><i></i>${coinTag()}${fmt(n)}</span>`;
}

function statBars(c: CardData) {
  const lang = settings.lang === 'tr' ? 1 : 0;
  return STAT_KEYS.map((k) => {
    const v = c.stats[k];
    return `<div class="mk-stat"><span>${STAT_FULL[k][lang]}</span><div class="mk-bar"><i style="width:${v}%" class="${v >= 80 ? 'hi' : v < 50 ? 'lo' : ''}"></i></div><b>${v}</b></div>`;
  }).join('');
}

function strengths(c: CardData) {
  const lang = settings.lang === 'tr' ? 1 : 0;
  return [...STAT_KEYS].sort((a, b) => c.stats[b] - c.stats[a]).slice(0, 2).map((k) => STAT_FULL[k][lang]).join(' · ');
}

function compareChip(c: CardData) {
  const L = M();
  const best = bestAt(c.pos);
  const o = overall(c);
  if (!best) return `<span class="mk-cmp up">${L.vsBest} ${t().pos[c.pos]}: ${L.none}</span>`;
  const d = o - best;
  return `<span class="mk-cmp ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${L.vsBest} ${t().pos[c.pos]} ${best}: <b>${d > 0 ? '+' : ''}${d}</b></span>`;
}

// ------------------------------------------------------------------ screen

export function showMarket(h: MenuHandlers) {
  tickMarket();
  const L = M();
  const scroll = S.resetScroll ? 0 : ui().querySelector<HTMLElement>('.mk-grid')?.scrollTop ?? 0;
  S.resetScroll = false;
  const club = clubTeamDef();
  const tabs = (['list', 'sell', 'ledger'] as Tab[])
    .map((tb) => `<button class="tab ${S.tab === tb ? 'on' : ''}" data-tab="${tb}">${tb === 'list' ? L.list : tb === 'sell' ? L.sell : L.ledger}${tb === 'sell' && market.offers.length ? ` <small>${market.offers.length}</small>` : ''}</button>`)
    .join('');
  setScreen(
    'screen-market',
    `<div class="market">
      <div class="mk-head">
        <div class="mk-title"><div class="kick">${L.kicker} · ${esc(t().divNames[league?.div ?? 5] ?? '')}</div><b>${L.title}</b></div>
        <div class="tabs">${tabs}</div>
        <div class="mk-head-r">
          <div class="mk-wallet"><span>${t().coins.toUpperCase()}</span><b id="mk-coins">${coinTag()}${fmt(coins())}</b></div>
          <button class="mk-x" data-act="back" aria-label="${t().back}">×</button>
        </div>
      </div>
      <div class="mk-body">${S.tab === 'list' ? listView(club) : S.tab === 'sell' ? sellView(club) : ledgerView()}</div>
    </div>`,
  );
  const grid = ui().querySelector<HTMLElement>('.mk-grid');
  if (grid) grid.scrollTop = scroll;
  wire(h);
  startClock(h);
}

function listView(_club: TeamDef | null) {
  const L = M();
  let items = market.listings.filter((l) => S.pos === 'ALL' || l.card.pos === S.pos);
  items = [...items].sort((a, b) =>
    S.sort === 'price' ? (a.counter ?? a.price) - (b.counter ?? b.price) : S.sort === 'age' ? a.age - b.age : overall(b.card) - overall(a.card),
  );
  if (!S.sel || !market.listings.find((l) => l.id === S.sel)) S.sel = items.find((l) => !l.sold && !l.closed)?.id ?? items[0]?.id ?? '';
  const sel = market.listings.find((l) => l.id === S.sel) ?? null;
  const filters = `<div class="mk-filters">
      <div class="seg small">${(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map((p) => `<button class="${S.pos === p ? 'on' : ''}" data-pos="${p}">${p === 'ALL' ? L.all : t().pos[p]}</button>`).join('')}</div>
      <div class="seg small">${(['ovr', 'price', 'age'] as const).map((s) => `<button class="${S.sort === s ? 'on' : ''}" data-sort="${s}">${s === 'ovr' ? L.sortOvr : s === 'price' ? L.sortPrice : L.sortAge}</button>`).join('')}</div>
      <div class="mk-refresh"><span class="kick">${L.refreshIn}</span><b id="mk-timer">${mmss(market.refreshAt - Date.now())}</b><button class="btn btn-ghost btn-sm" data-act="refresh">${L.refresh} · ${coinTag()}${REFRESH_COST}</button></div>
    </div>`;
  const tiles = items.map((l) => listingTile(l)).join('');
  return `<div class="mk-detail">${sel ? listingDetail(sel) : `<p class="mk-empty">${L.pickOne}</p>`}</div>
    <div class="mk-right">${filters}<div class="mk-grid">${tiles}</div></div>`;
}

function listingTile(l: Listing) {
  const L = M();
  const c = l.card;
  const r = rarityOf(c);
  const price = l.counter ?? l.price;
  const state = l.sold ? `<span class="stamp green mk-tstamp">${L.signed}</span>` : l.closed ? `<span class="stamp mk-tstamp">${l.until && Date.now() > l.until ? L.expired : L.off}</span>` : '';
  const tag = l.tags.includes('deadline') ? `<span class="mk-ribbon red">${L.tags.deadline}</span>` : l.tags.includes('bargain') ? `<span class="mk-ribbon green">${L.tags.bargain}</span>` : l.tags.includes('wonderkid') ? `<span class="mk-ribbon">${L.tags.wonderkid}</span>` : '';
  return `<button class="mk-tile ${S.sel === l.id ? 'sel' : ''} ${l.sold || l.closed ? 'gone' : ''}" data-sel="${l.id}" style="--rc:${RAR_COL[r]}">
    <span class="mk-strip"></span>
    <span class="mk-photo">${paintTag(portraitSource(lookFor(kitFor(l.from), c.look, c.pos === 'GK')), 'mk-face')}
      <span class="mk-ovr">${overall(c)}<small>${t().pos[c.pos]}</small></span>${tag}</span>
    <span class="mk-name">${esc(c.name)}</span>
    <span class="mk-meta">${esc(l.from)} · ${l.age}</span>
    <span class="mk-foot">${priceTag(price, l.counter ? 'cnt' : '')}</span>
    ${state}
  </button>`;
}

function listingDetail(l: Listing) {
  const L = M();
  const c = l.card;
  const r = rarityOf(c);
  const ask = l.counter ?? l.price;
  const can = !l.sold && !l.closed;
  const short = ask - coins();
  const tags = l.tags.map((tg) => `<span class="mk-chip ${tg}">${L.tags[tg]}${tg === 'deadline' && l.until ? ` <b data-until="${l.until}">${mmss(l.until - Date.now())}</b>` : ''}</span>`).join('');
  const bid = Math.round((ask * S.bid) / 10) * 10;
  const dots = Array.from({ length: MAX_ROUNDS }, (_, i) => `<i class="${i < l.rounds ? 'used' : ''}"></i>`).join('');
  return `
    <div class="mk-file" style="--rc:${RAR_COL[r]}">
      <div class="mk-big">
        <span class="mk-rar">${t().cardRarity[r]}</span>
        ${paintTag(portraitSource(lookFor(kitFor(l.from), c.look, c.pos === 'GK')), 'mk-bigface')}
        <span class="mk-bigovr">${overall(c)}<small>${t().pos[c.pos]}</small></span>
        ${crestTag(kitFor(l.from), 'mk-crest')}
        ${S.stampFor === l.id ? `<span class="stamp green mk-signed">${L.signed}</span>` : l.sold ? `<span class="stamp green mk-signed still">${L.signed}</span>` : l.closed ? `<span class="stamp mk-signed still">${L.off}</span>` : ''}
      </div>
      <div class="mk-id">
        <b>${esc(c.name)}</b>
        <span>${t().pos[c.pos]} · ${l.age} ${L.age} · ${L.from} ${esc(l.from)}</span>
        <div class="mk-chips">${tags}</div>
      </div>
      <div class="mk-deal">
        <div class="mk-ask"><span class="kick">${L.asking}</span>${l.counter ? `<s>${fmt(l.price)}</s>` : ''}${priceTag(ask, 'big')}</div>
        <div class="mk-val">${L.value} <b>${fmt(l.value)}</b>${can && short > 0 ? ` · <em>${L.need} ${fmt(short)} ${L.more}</em>` : ''}</div>
        ${S.reply ? `<div class="mk-reply hand ${S.reply.kind}">“${esc(S.reply.text)}”</div>` : ''}
        ${can && S.offering ? `
          <div class="mk-haggle">
            <div class="mk-bidrow"><span class="kick">${L.yourBid}</span>${priceTag(bid, 'bid')}<span class="mk-dots" title="${L.rounds}">${dots}</span></div>
            <input type="range" min="0.5" max="1" step="0.01" value="${S.bid}" id="mk-bid" aria-label="${L.yourBid}">
            <button class="btn btn-primary" data-act="send">${L.send}</button>
          </div>` : ''}
        ${can ? `<div class="mk-actions">
          <button class="btn btn-primary ${short > 0 ? 'off' : ''}" data-act="buy">${L.buyNow}</button>
          <button class="btn btn-ghost" data-act="haggle">${L.offer}</button>
        </div>` : ''}
      </div>
      <div class="mk-scout">
        <div class="mk-scout-h"><span class="kick">${L.scout}</span>${compareChip(c)}</div>
        ${statBars(c)}
        <div class="mk-note hand">${L.strengths}: ${strengths(c)}</div>
      </div>
    </div>`;
}

function sellView(club: TeamDef | null) {
  const L = M();
  const mine = [...profile.cards].sort((a, b) => overall(b) - overall(a));
  if (!S.sel || !cardById(S.sel)) S.sel = mine.find((c) => !sellBlock(c))?.id ?? mine[0]?.id ?? '';
  const sel = cardById(S.sel);
  const kit = club ?? TEAMS[0];
  const tiles = mine
    .map((c) => {
      const n = market.offers.filter((o) => o.cardId === c.id).length;
      const inXI = profile.lineup.includes(c.id);
      return `<button class="mk-tile ${S.sel === c.id ? 'sel' : ''}" data-sel="${c.id}" style="--rc:${RAR_COL[rarityOf(c)]}">
        <span class="mk-strip"></span>
        <span class="mk-photo">${paintTag(portraitSource(lookFor(kit, c.look, c.pos === 'GK')), 'mk-face')}
          <span class="mk-ovr">${overall(c)}<small>${t().pos[c.pos]}</small></span>
          ${n ? `<span class="mk-ribbon green">${n} ${L.offersFor}</span>` : inXI ? `<span class="mk-ribbon">XI</span>` : ''}</span>
        <span class="mk-name">${esc(c.name)}</span>
        <span class="mk-meta">${ageOf(c)} ${L.age}</span>
        <span class="mk-foot">${priceTag(valueOf(c, ageOf(c)))}</span>
      </button>`;
    })
    .join('');
  return `<div class="mk-detail">${sel ? sellDetail(sel, kit) : ''}</div>
    <div class="mk-right"><div class="mk-filters"><span class="kick">${L.squad} ${profile.cards.length}/${SQUAD_MAX}</span></div><div class="mk-grid">${tiles}</div></div>`;
}

function sellDetail(c: CardData, kit: TeamDef) {
  const L = M();
  const block = sellBlock(c);
  const offers = market.offers.filter((o) => o.cardId === c.id);
  return `<div class="mk-file sell" style="--rc:${RAR_COL[rarityOf(c)]}">
    <div class="mk-sellcard">${cardHTML(c, { club: kit, size: 'md' })}
      <div class="mk-id"><b>${esc(c.name)}</b><span>${t().pos[c.pos]} · ${ageOf(c)} ${L.age}</span>
      <div class="mk-val">${L.value} <b>${fmt(valueOf(c, ageOf(c)))}</b></div>
      ${block ? `<div class="mk-block">${block === 'custom' ? L.cantCustom : L.cantMin}</div>` : `<button class="btn btn-ghost" data-act="quick">${L.quick} · ${coinTag()}${fmt(quickSaleOf(c))}</button><div class="mk-small">${L.quickNote}</div>`}
      </div>
    </div>
    <div class="mk-offers">
      <div class="kick">${L.offers}</div>
      ${offers.length ? offers.map((o) => `<div class="mk-offer"><span class="mk-oclub">${crestTag(kitFor(o.club), 'mk-ocrest')}${esc(o.club)}</span>${priceTag(o.amount)}<button class="btn btn-primary btn-sm ${block ? 'off' : ''}" data-accept="${o.id}">${L.accept}</button><button class="btn btn-ghost btn-sm" data-reject="${o.id}">${L.reject}</button></div>`).join('') : `<p class="mk-small">${L.noOffers}</p>`}
    </div>
  </div>`;
}

function ledgerView() {
  const L = M();
  const spent = market.ledger.filter((e) => e.kind === 'in').reduce((a, e) => a + e.price, 0);
  const earned = market.ledger.filter((e) => e.kind === 'out').reduce((a, e) => a + e.price, 0);
  const rows = market.ledger
    .map((e, i) => `<div class="mk-lrow"><span class="mk-lno">${String(market.ledger.length - i).padStart(3, '0')}</span><span class="mk-lk ${e.kind}">${e.kind === 'in' ? L.lIn : L.lOut}</span><b>${esc(e.name)}</b><span>${t().pos[e.pos]} · ${e.ovr}</span><span class="mk-lclub">${esc(e.club)}</span><span class="mk-lp ${e.kind}">${e.kind === 'in' ? '−' : '+'}${fmt(e.price)}</span></div>`)
    .join('');
  return `<div class="mk-ledger">
    <div class="mk-lhead"><div><span class="kick">${L.spent}</span><b>${fmt(spent)}</b></div><div><span class="kick">${L.earned}</span><b>${fmt(earned)}</b></div><div><span class="kick">${L.squad}</span><b>${profile.cards.length}/${SQUAD_MAX}</b></div></div>
    ${rows || `<p class="mk-empty hand">${L.emptyLedger}</p>`}
  </div>`;
}

// ------------------------------------------------------------------ events

function wire(h: MenuHandlers) {
  const L = M();
  const again = () => showMarket(h);
  bind('[data-act=back]', () => { audio.click(); stopClock(); S.reply = null; showHub(h); });
  bind('[data-tab]', (b) => { S.tab = b.dataset.tab as Tab; S.sel = ''; S.resetScroll = true; S.offering = false; S.reply = null; audio.click(); again(); });
  bind('[data-pos]', (b) => { S.pos = b.dataset.pos as typeof S.pos; S.resetScroll = true; audio.click(); again(); });
  bind('[data-sort]', (b) => { S.sort = b.dataset.sort as typeof S.sort; audio.click(); again(); });
  bind('[data-sel]', (b) => {
    if (S.sel !== b.dataset.sel) { S.offering = false; S.reply = null; S.bid = 0.85; }
    S.sel = b.dataset.sel!;
    S.stampFor = '';
    audio.select();
    again();
  });
  bind('[data-act=refresh]', () => {
    if (!refreshMarket(true)) { toast(L.poor); audio.groan(); return; }
    S.sel = ''; S.reply = null; S.offering = false;
    audio.whoosh();
    again();
  });
  const cur = () => market.listings.find((l) => l.id === S.sel);
  const signedFx = (l: Listing) => {
    S.stampFor = l.id; S.offering = false;
    setTimeout(() => { S.stampFor = ''; }, 800);
    audio.horn(); audio.cheer(0.5); vibrate([30, 30, 60]);
    toast(`${L.signed} ${l.card.name}`);
  };
  const failMsg = (r: string) => {
    toast(r === 'full' ? L.full : L.poor);
    audio.groan();
  };
  bind('[data-act=buy]', () => {
    const l = cur(); if (!l) return;
    const r = buyNow(l);
    if (r === 'ok') { S.reply = { kind: 'accept', text: pick(L.reply.accept) }; signedFx(l); }
    else failMsg(r);
    again();
  });
  bind('[data-act=haggle]', () => { S.offering = !S.offering; audio.click(); again(); });
  ui().querySelector<HTMLInputElement>('#mk-bid')?.addEventListener('input', (e) => {
    S.bid = Number((e.target as HTMLInputElement).value);
    const l = cur(); if (!l) return;
    const bid = Math.round(((l.counter ?? l.price) * S.bid) / 10) * 10;
    const tag = ui().querySelector('.mk-price.bid');
    if (tag) tag.innerHTML = `<i></i>${tag.querySelector('canvas')?.outerHTML ?? ''}${fmt(bid)}`;
  });
  bind('[data-act=send]', () => {
    const l = cur(); if (!l) return;
    const amount = Math.round(((l.counter ?? l.price) * S.bid) / 10) * 10;
    if (amount > coins()) { failMsg('coins'); return; }
    const rep = makeOffer(l, amount);
    const line = (arr: string[]) => pick(arr).replace('{n}', fmt(rep.amount));
    if (rep.kind === 'accept') {
      if (rep.result === 'ok') { S.reply = { kind: 'accept', text: line(L.reply.accept) }; signedFx(l); }
      else { failMsg(rep.result ?? 'coins'); }
    } else if (rep.kind === 'counter') { S.reply = { kind: 'counter', text: line(L.reply.counter) }; S.bid = 1; audio.select(); }
    else if (rep.kind === 'insult') { S.reply = { kind: 'insult', text: line(L.reply.insult) }; audio.groan(); }
    else { S.reply = { kind: 'walk', text: line(L.reply.walk) }; S.offering = false; audio.groan(); }
    again();
  });
  bind('[data-act=quick]', () => {
    const c = cardById(S.sel); if (!c) return;
    if (quickSell(c)) { audio.select(); toast(`${L.sold}: ${c.name}`); S.sel = ''; }
    again();
  });
  bind('[data-accept]', (b) => {
    const o = market.offers.find((x) => x.id === b.dataset.accept); if (!o) return;
    const c = cardById(o.cardId);
    if (acceptOffer(o)) { audio.horn(); toast(`${L.sold}: ${c?.name ?? ''} → ${o.club}`); S.sel = ''; }
    else { toast(c && sellBlock(c) === 'custom' ? L.cantCustom : L.cantMin); audio.groan(); }
    again();
  });
  bind('[data-reject]', (b) => {
    const o = market.offers.find((x) => x.id === b.dataset.reject); if (!o) return;
    rejectOffer(o); audio.click(); again();
  });
}

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

// ------------------------------------------------------------------ live timers
let clock = 0;
function startClock(h: MenuHandlers) {
  stopClock();
  clock = window.setInterval(() => {
    if (!document.querySelector('.market')) return stopClock();
    const tm = document.getElementById('mk-timer');
    if (tm) tm.textContent = mmss(market.refreshAt - Date.now());
    let expired = false;
    document.querySelectorAll<HTMLElement>('[data-until]').forEach((el) => {
      const left = Number(el.dataset.until) - Date.now();
      el.textContent = mmss(left);
      if (left <= 0) expired = true;
    });
    if (Date.now() >= market.refreshAt || expired) showMarket(h);
  }, 1000);
}
function stopClock() {
  if (clock) clearInterval(clock);
  clock = 0;
}
