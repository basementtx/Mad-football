/** Crate shop and the crate-opening sequence. */
import { t } from '../engine/i18n';
import { audio, vibrate } from '../engine/audio';
import { CRATES, CrateDef, openCrate, Reward } from '../meta/crates';
import { profile, saveProfile, spendCoins, freeCrateReady, FREE_CRATE_EVERY, clubTeamDef, tierOf } from '../meta/profile';
import { ROMAN } from '../meta/items';
import { rarityOf } from '../meta/cards';
import { crateCanvases } from '../pixel/crate';
import { setScreen, bind, paintTag, paintAll, coinsPill, coinTag, crateTag, toast, ui, MenuHandlers } from './common';
import { cardHTML, itemHTML } from './cards';
import { showHub } from './hub';
import { showCollection } from './collection';

function fmtTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

export function showShop(h: MenuHandlers) {
  const L = t();
  const freeBasic = freeCrateReady();
  const starter = profile.starterCrate;
  setScreen(
    'screen-shop',
    `<div class="shop">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="panel-title">${L.crates}</div>
        ${coinsPill()}
      </div>
      <div class="crates">
        ${CRATES.map((c) => {
          const isFree = (c.id === 'basic' && freeBasic) || (c.id === 'premium' && starter);
          return `<div class="crate-card cr-${c.id}">
            <div class="crate-name">${L.crateNames[c.id]}</div>
            ${crateTag(c.id, 'crate-lg')}
            <div class="crate-desc">${L.crateDesc[c.id]}</div>
            <button class="btn ${isFree ? 'btn-primary' : 'btn-ghost'} buy" data-crate="${c.id}">${isFree ? L.free + '!' : `${coinTag()} ${c.price}`}</button>
            ${c.id === 'basic' && !freeBasic ? `<div class="crate-timer">${L.freeIn} ${fmtTime(profile.freeCrateAt - Date.now())}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showHub(h); });
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
  const { body, lid } = crateCanvases(def.id);
  setScreen(
    'screen-open',
    `<div class="opening cr-${def.id}" style="--glow:${LV_COLOR[best]}">
      <div class="open-flash"></div>
      <div class="open-stage" data-act="open">
        <div class="rays"></div>
        <div class="glow-orb"></div>
        <div class="crate-big">
          ${paintTag(() => lid, 'crate-lid')}
          <div class="crate-seam"></div>
          ${paintTag(() => body, 'crate-body')}
        </div>
        <div class="spark-host" id="spark-host"></div>
        <div class="tap-start">${L.tapToOpen}</div>
      </div>
      <div class="rewards" id="rewards"></div>
      <div class="open-actions" id="open-actions"></div>
    </div>`,
  );
  const root = document.querySelector<HTMLElement>('.opening')!;
  let opened = false;
  bind('[data-act=open]', (stage) => {
    if (opened) return;
    opened = true;
    const host = document.getElementById('spark-host')!;
    // build-up: shaking grows, the seam starts to glow in the colour of the best reward
    stage.classList.add('charge1');
    audio.whoosh();
    vibrate(20);
    const ticks = [0, 260, 480, 660, 800, 920];
    ticks.forEach((ms, i) => setTimeout(() => {
      audio.countdown(i === ticks.length - 1);
      if (i === 2) { stage.classList.add('charge2'); vibrate(30); }
      if (i === 4) { stage.classList.add('charge3'); vibrate(40); sparks(host, [LV_COLOR[best], '#ffffff'], 8, 90); }
    }, ms));
    setTimeout(() => {
      stage.classList.add('burst');
      root.classList.add('flash');
      audio.power();
      audio.hit(0.8);
      if (best >= 2) audio.horn();
      audio.cheer(0.4 + best * 0.2);
      vibrate(best >= 2 ? [60, 30, 120] : 80);
      sparks(host, [LV_COLOR[best], '#ffffff', '#ffe14d'], 26 + best * 10, 200 + best * 30);
      setTimeout(() => revealAll(h, rewards), 380);
    }, 1150);
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
