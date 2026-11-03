/** Crate shop and the crate-opening sequence. */
import { t } from '../engine/i18n';
import { audio, vibrate } from '../engine/audio';
import { CRATES, CrateDef, openCrate, Reward } from '../meta/crates';
import { profile, saveProfile, spendCoins, freeCrateReady, FREE_CRATE_EVERY, clubTeamDef } from '../meta/profile';
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

function showOpening(h: MenuHandlers, def: CrateDef) {
  const L = t();
  const rewards = openCrate(def);
  const { body, lid } = crateCanvases(def.id);
  setScreen(
    'screen-open',
    `<div class="opening cr-${def.id}">
      <div class="open-stage" data-act="open">
        <div class="rays"></div>
        <div class="crate-big">
          ${paintTag(() => lid, 'crate-lid')}
          ${paintTag(() => body, 'crate-body')}
        </div>
        <div class="tap-start">${L.tapToOpen}</div>
      </div>
      <div class="rewards" id="rewards"></div>
      <div class="open-actions" id="open-actions"></div>
    </div>`,
  );
  let opened = false;
  bind('[data-act=open]', (stage) => {
    if (opened) return;
    opened = true;
    stage.classList.add('shaking');
    audio.whoosh();
    vibrate([20, 40, 20, 40, 60]);
    setTimeout(() => audio.hit(0.6), 300);
    setTimeout(() => {
      stage.classList.add('burst');
      audio.power();
      audio.cheer(0.6);
      vibrate(80);
      revealAll(h, rewards);
    }, 900);
  });
}

function revealAll(h: MenuHandlers, rewards: Reward[]) {
  const L = t();
  const club = clubTeamDef();
  const wrap = document.getElementById('rewards')!;
  wrap.innerHTML = rewards
    .map((r, i) => {
      const inner =
        r.kind === 'card'
          ? cardHTML(r.card, { club, size: 'md', badge: L.newTag })
          : itemHTML(r.item, { badge: r.dupe ? `${L.dupe} +${r.refund}` : L.newTag, desc: true });
      const rar = r.kind === 'card' ? rarityOf(r.card) : r.item.rarity;
      return `<div class="reveal rv-${rar}" style="animation-delay:${0.15 + i * 0.35}s">${inner}</div>`;
    })
    .join('');
  paintAll(wrap);
  rewards.forEach((r, i) => {
    setTimeout(() => {
      const big = r.kind === 'card' ? ['gold', 'hero', 'legend'].includes(rarityOf(r.card)) : ['epic', 'legendary'].includes(r.item.rarity);
      if (big) {
        audio.horn();
        vibrate(60);
      } else audio.select();
    }, 150 + i * 350);
  });
  setTimeout(() => {
    const act = document.getElementById('open-actions');
    if (!act) return;
    act.innerHTML = `<button class="btn btn-ghost" data-act="col">${L.collection}</button><button class="btn btn-primary" data-act="done">${L.collect} ▶</button>`;
    bind('[data-act=done]', () => { audio.click(); showShop(h); });
    bind('[data-act=col]', () => { audio.click(); showCollection(h); });
  }, 300 + rewards.length * 350);
  void ui;
}
