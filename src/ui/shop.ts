/** Crate shop and the crate-opening sequence. */
import { t } from '../engine/i18n';
import { audio, vibrate } from '../engine/audio';
import { CRATES, CrateDef, openCrate, Reward } from '../meta/crates';
import { profile, saveProfile, spendCoins, freeCrateReady, FREE_CRATE_EVERY, clubTeamDef, tierOf } from '../meta/profile';
import { ROMAN } from '../meta/items';
import { rarityOf } from '../meta/cards';
import { crate3D } from './crate3d';
import { setScreen, bind, paintTag, paintAll, coinsPill, coinTag, toast, ui, MenuHandlers } from './common';
import { cardHTML, itemHTML } from './cards';
import { showHub } from './hub';
import { showCollection } from './collection';
import { store, tickStore, refreshStore, buyOffer, StoreOffer, offerItem, offerCos, offerRarity, markStoreSeen, cosName, cosKindName, STORE_REFRESH_COST, Cosmetic } from '../meta/cosmetics';
import { itemName, RARITY_COLOR } from '../meta/items';
import { itemIcon } from '../pixel/icons';
import { crestTag, portraitSource, lookFor, esc, toast as toastMsg } from './common';
import { cardById } from '../meta/profile';
import type { KitPattern } from '../game/teams';

function fmtTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

let shopTab: 'crates' | 'store' = 'crates';
let storeTimer = 0;

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}

/** Preview art for a store offer. */
function offerArt(o: StoreOffer) {
  const it = offerItem(o);
  if (it) return paintTag(() => itemIcon(it.id, it.type, it.color), 'so-icon');
  const c = offerCos(o)!;
  const club = clubTeamDef();
  const me = cardById(profile.myPlayer);
  const base = me?.look ?? { skin: '#e5b48f', hair: '#3b2416', hairStyle: 0, beard: false, face: 0 };
  if (!club) return '';
  switch (c.kind) {
    case 'pattern': {
      const kit = { ...club, pattern: c.value as KitPattern };
      return `<span class="so-kits">${paintTag(portraitSource(lookFor(kit, base)), 'so-face')}</span>`;
    }
    case 'hair': return paintTag(portraitSource(lookFor(club, { ...base, hairStyle: Number(c.value) })), 'so-face');
    case 'face': return paintTag(portraitSource(lookFor(club, { ...base, face: Number(c.value) })), 'so-face');
    case 'dye': return paintTag(portraitSource(lookFor(club, { ...base, hair: c.value })), 'so-face');
    case 'shape': return crestTag({ ...club, crest: { ...club.crest, shape: Number(c.value) } }, 'so-crest');
    case 'icon': return crestTag({ ...club, crest: { ...club.crest, icon: c.value } }, 'so-crest');
  }
}

function offerTile(o: StoreOffer, i: number) {
  const L = t();
  const it = offerItem(o);
  const c = offerCos(o) as Cosmetic | undefined;
  const rar = offerRarity(o);
  const name = it ? itemName(it) : cosName(c!);
  const kind = it ? (it.type === 'goalfx' ? L.goalFx : it.type === 'trail' ? L.trails : L.items) : cosKindName(c!);
  const copy = !!it && it.type === 'power' && profile.owned.includes(it.id);
  const gone = o.bought || (!!o.until && Date.now() > o.until);
  const flag = o.featured ? `<span class="so-flag feat">${L.featured}</span>` : o.until ? `<span class="so-flag flash">${L.flashDeal} <b data-until="${o.until}">${fmtClock(o.until - Date.now())}</b></span>` : '';
  return `<div class="so-tile r-${rar} ${o.featured ? 'featured' : ''} ${gone ? 'gone' : ''}" style="--rc:${RARITY_COLOR[rar]};--i:${i}">
    ${flag}
    ${o.off ? `<span class="so-off">-${o.off}%</span>` : ''}
    <div class="so-art"><div class="so-glow"></div>${offerArt(o)}</div>
    <div class="so-kick">${esc(kind)} · ${L.itemRarity[rar]}${copy ? ` · ${L.upgradeCopy}` : ''}</div>
    <div class="so-name">${esc(name)}</div>
    <button class="btn ${gone ? 'btn-ghost' : 'btn-primary'} so-buy" data-buy="${i}" ${gone ? 'disabled' : ''}>
      ${gone ? (o.bought ? L.bought : L.soldOut) : `${o.off ? `<s>${o.base}</s>` : ''}${coinTag()} ${o.price}`}
    </button>
    ${o.bought ? `<div class="stamp green so-stamp">${L.bought}</div>` : ''}
  </div>`;
}

export function showShop(h: MenuHandlers, tab: 'crates' | 'store' = shopTab) {
  const L = t();
  shopTab = tab;
  tickStore();
  if (tab === 'store') markStoreSeen();
  const freeBasic = freeCrateReady();
  const starter = profile.starterCrate;
  const newDeals = !store.seen;
  setScreen(
    'screen-shop',
    `<div class="shop">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="panel-title">${L.shop}</div>
        ${coinsPill()}
      </div>
      <div class="tabs shop-tabs">
        <button class="tab ${tab === 'crates' ? 'on' : ''}" data-tab="crates">${L.cratesTab}${freeBasic || starter ? ` <small class="tab-dot">${L.free}!</small>` : ''}</button>
        <button class="tab ${tab === 'store' ? 'on' : ''}" data-tab="store">${L.storeTab}${newDeals ? ' <small class="tab-dot">NEW</small>' : ''}</button>
      </div>
      ${tab === 'store' ? `
      <div class="store">
        <div class="store-bar"><span>${L.newOffersIn} <b id="store-clock">${fmtClock(store.at - Date.now())}</b></span>
          <button class="btn btn-ghost btn-sm" data-act="refresh">${L.refreshStore} · ${coinTag()} ${STORE_REFRESH_COST}</button></div>
        <div class="store-grid">${store.offers.map(offerTile).join('')}</div>
      </div>` : `
      <div class="crates">
        ${CRATES.map((c) => {
          const isFree = (c.id === 'basic' && freeBasic) || (c.id === 'premium' && starter);
          return `<div class="crate-card cr-${c.id}">
            <div class="crate-name">${L.crateNames[c.id]}</div>
            ${crate3D(c.id, 'clamp(96px, 26vh, 150px)')}
            <div class="crate-desc">${L.crateDesc[c.id]}</div>
            <button class="btn ${isFree ? 'btn-primary' : 'btn-ghost'} buy" data-crate="${c.id}">${isFree ? L.free + '!' : `${coinTag()} ${c.price}`}</button>
            ${c.id === 'basic' && !freeBasic ? `<div class="crate-timer">${L.freeIn} ${fmtTime(profile.freeCrateAt - Date.now())}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`}
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showHub(h); });
  bind('[data-tab]', (el) => { audio.click(); showShop(h, el.dataset.tab as 'crates' | 'store'); });
  bind('[data-act=refresh]', () => {
    if (!refreshStore()) { toastMsg(L.notEnough); audio.groan(); return; }
    audio.select();
    showShop(h, 'store');
  });
  bind('[data-buy]', (el) => {
    const o = store.offers[Number(el.dataset.buy)];
    if (!o) return;
    const r = buyOffer(o);
    if (r.res === 'coins') { toastMsg(L.notEnough); audio.groan(); return; }
    if (r.res !== 'ok') return;
    audio.cheer(0.5);
    audio.horn();
    vibrate([40, 30, 80]);
    const tile = el.closest<HTMLElement>('.so-tile')!;
    sparks(tile, [RARITY_COLOR[offerRarity(o)], '#ffffff', '#ffe14d'], 26, 140);
    tile.classList.add('buying');
    toastMsg(r.tierUp ? `${L.tierUp} ${ROMAN[r.tierUp - 1]}` : offerCos(o) ? L.unlockedToast : L.boughtToast);
    setTimeout(() => { if (tile.isConnected) showShop(h, 'store'); }, 700);
  });
  clearInterval(storeTimer);
  storeTimer = window.setInterval(() => {
    const clock = document.getElementById('store-clock');
    if (!clock && !document.querySelector('.crates')) return clearInterval(storeTimer);
    if (clock) {
      if (Date.now() >= store.at) return showShop(h, 'store');
      clock.textContent = fmtClock(store.at - Date.now());
      document.querySelectorAll<HTMLElement>('[data-until]').forEach((b) => {
        const left = Number(b.dataset.until) - Date.now();
        b.textContent = fmtClock(left);
        if (left <= 0) b.closest('.so-tile')?.classList.add('gone');
      });
    }
  }, 1000);
  bind('[data-crate]', (el) => {
    const def = CRATES.find((c) => c.id === el.dataset.crate)!;
    if (def.id === 'premium' && profile.starterCrate) {
      profile.starterCrate = false;
    } else if (def.id === 'basic' && freeCrateReady()) {
      profile.freeCrateAt = Date.now() + FREE_CRATE_EVERY;
    } else if (!spendCoins(def.price)) {
      toast(L.notEnough);
      audio.groan();
      return;
    }
    saveProfile();
    audio.select();
    showOpening(h, def);
  });
}

const LV_COLOR = ['#c8d0e0', '#3f8cff', '#b04cff', '#ff9a1f'];
/** 0..3 value level of a reward (drives glow colours and the reveal drama). */
function levelOf(r: Reward) {
  if (r.kind === 'card') return ({ bronze: 0, silver: 0, gold: 1, hero: 2, legend: 3 } as Record<string, number>)[rarityOf(r.card)] ?? 0;
  return ({ common: 0, rare: 1, epic: 2, legendary: 3 } as Record<string, number>)[r.item.rarity] ?? 0;
}

/** Burst of pixel sparks (DOM) around an element. */
function sparks(host: HTMLElement, colors: string[], n = 22, spread = 160) {
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('i');
    sp.className = 'spark';
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.4 + Math.random() * 0.8);
    sp.style.setProperty('--dx', `${Math.round(Math.cos(a) * d)}px`);
    sp.style.setProperty('--dy', `${Math.round(Math.sin(a) * d - spread * 0.25)}px`);
    sp.style.setProperty('--c', colors[i % colors.length]);
    sp.style.setProperty('--s', `${3 + Math.floor(Math.random() * 3) * 3}px`);
    sp.style.animationDelay = `${Math.random() * 0.12}s`;
    host.appendChild(sp);
    setTimeout(() => sp.remove(), 1200);
  }
}

function showOpening(h: MenuHandlers, def: CrateDef) {
  const L = t();
  const rewards = openCrate(def);
  const best = Math.max(...rewards.map(levelOf));
  setScreen(
    'screen-open',
    `<div class="opening cr-${def.id}" style="--glow:${LV_COLOR[0]};--og:${LV_COLOR[0]}">
      <div class="open-flash"></div>
      <div class="open-stage" data-act="open">
        <div class="rays"></div>
        <div class="glow-orb"></div>
        <div class="open-ring"></div>
        <div class="open-beam"></div>
        <div class="open-crate">${crate3D(def.id, 'min(46vh, 300px)')}</div>
        <div class="spark-host" id="spark-host"></div>
        <div class="tap-start">${L.tapToOpen}</div>
      </div>
      <div class="rewards" id="rewards"></div>
      <div class="open-actions" id="open-actions"></div>
    </div>`,
  );
  const root = document.querySelector<HTMLElement>('.opening')!;
  const host = document.getElementById('spark-host')!;
  // landing: dust puff + thud
  setTimeout(() => {
    if (!host.isConnected) return;
    sparks(host, ['#d8c9a0', '#b7a57c', '#ffffff'], 18, 150);
    audio.hit(0.6);
    vibrate(30);
  }, 560);
  let opened = false;
  // the glow climbs the rarity ladder with every hit, up to the best reward (walk-out style tease)
  const setGlow = (lv: number) => {
    root.style.setProperty('--glow', LV_COLOR[lv]);
    root.style.setProperty('--og', LV_COLOR[lv]);
  };
  bind('[data-act=open]', (stage) => {
    if (opened) return;
    opened = true;
    const hits = [0, 420, 800];
    hits.forEach((ms, i) => setTimeout(() => {
      stage.classList.remove('hit');
      void stage.offsetWidth;
      stage.classList.add('hit', 'charge' + (i + 1));
      setGlow(Math.min(best, i + (best >= 3 && i === 2 ? 1 : 0)));
      audio.countdown(false);
      audio.hit(0.4 + i * 0.2);
      vibrate(20 + i * 20);
      sparks(host, [root.style.getPropertyValue('--og') || '#ffffff', '#ffffff'], 8 + i * 6, 90 + i * 30);
    }, ms));
    setTimeout(() => {
      setGlow(best);
      stage.classList.add('burst');
      root.classList.add('flash', 'shake');
      audio.countdown(true);
      audio.power();
      audio.hit(0.9);
      if (best >= 2) audio.horn();
      audio.cheer(0.4 + best * 0.2);
      vibrate(best >= 2 ? [60, 30, 140] : 90);
      sparks(host, [LV_COLOR[best], '#ffffff', '#ffe14d'], 34 + best * 12, 230 + best * 40);
      setTimeout(() => sparks(host, [LV_COLOR[best], '#ffffff'], 20 + best * 8, 320), 160);
      setTimeout(() => { root.classList.add('revealed'); revealAll(h, rewards); }, 620);
      setTimeout(() => root.classList.add('crate-gone'), 1700);
    }, 1200);
  });
}

function revealAll(h: MenuHandlers, rewards: Reward[]) {
  const L = t();
  const club = clubTeamDef();
  const wrap = document.getElementById('rewards')!;
  const badgeOf = (r: Reward) => {
    if (r.kind === 'card') return L.newTag;
    if (!r.dupe) return L.newTag;
    if (r.tierUp) return `${L.tierUp} ${ROMAN[r.tierUp - 1]}`;
    if (r.copies) return `+1 ${L.copies} ${r.copies[0]}/${r.copies[1]}`;
    return `+${r.refund} ${L.coins}`;
  };
  wrap.innerHTML = rewards
    .map((r, i) => {
      const lv = levelOf(r);
      const inner =
        r.kind === 'card'
          ? cardHTML(r.card, { club, size: 'md', badge: badgeOf(r) })
          : itemHTML(r.item, { badge: badgeOf(r), desc: true, tier: r.item.type === 'power' ? tierOf(r.item.id) : undefined });
      return `<div class="rcard lv${lv} ${r.kind === 'item' && r.tierUp ? 'tierup' : ''}" data-rc="${i}" style="--i:${i};--lc:${LV_COLOR[lv]}">
        <div class="rc-inner">
          <div class="rc-back"><span>?</span></div>
          <div class="rc-front">${inner}</div>
        </div>
      </div>`;
    })
    .join('');
  paintAll(wrap);
  const cards = [...wrap.querySelectorAll<HTMLElement>('.rcard')];
  const crate = document.querySelector<HTMLElement>('.open-crate .c3d');
  if (crate) {
    const cr = crate.getBoundingClientRect();
    const cx = cr.left + cr.width / 2, cy = cr.top + cr.height * 0.3;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--fx', `${Math.round(cx - (r.left + r.width / 2))}px`);
      c.style.setProperty('--fy', `${Math.round(cy - (r.top + r.height / 2))}px`);
    }
  }
  let next = 0;
  const flip = (i: number) => {
    const el = cards[i];
    if (!el || el.classList.contains('flipped')) return;
    el.classList.add('flipped');
    const r = rewards[i];
    const lv = levelOf(r);
    if (lv >= 2 || (r.kind === 'item' && r.tierUp)) {
      audio.horn();
      vibrate(60);
      sparks(el, [LV_COLOR[lv], '#ffffff', '#ffe14d'], 18 + lv * 6, 110);
    } else {
      audio.select();
      if (lv === 1) sparks(el, [LV_COLOR[lv], '#ffffff'], 10, 80);
    }
    if (cards.every((c) => c.classList.contains('flipped'))) finish();
  };
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    setTimeout(() => {
      const act = document.getElementById('open-actions');
      if (!act) return;
      act.innerHTML = `<button class="btn btn-ghost" data-act="col">${L.inventory}</button><button class="btn btn-primary" data-act="done">${L.collect} ▶</button>`;
      bind('[data-act=done]', () => { audio.click(); showShop(h); });
      bind('[data-act=col]', () => { audio.click(); showCollection(h); });
    }, 350);
  };
  // cards fly out face down, then flip one by one (tap one to flip it now)
  const startAt = 300 + cards.length * 110;
  let timer = 0;
  setTimeout(() => {
    timer = window.setInterval(() => {
      if (done) return clearInterval(timer);
      while (next < cards.length && cards[next].classList.contains('flipped')) next++;
      if (next >= cards.length) return finish();
      flip(next++);
    }, 520);
  }, startAt);
  cards.forEach((c, i) => c.addEventListener('click', (e) => { e.stopPropagation(); flip(i); }));
  const act = document.getElementById('open-actions')!;
  act.innerHTML = `<button class="btn btn-ghost btn-sm" data-act="all">${L.revealAll}</button>`;
  bind('[data-act=all]', () => { audio.click(); cards.forEach((_, i) => setTimeout(() => flip(i), i * 90)); }, act);
  void ui;
}
