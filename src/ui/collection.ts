/** Collection: the special-item inventory (loadout + tiers), boots, goal explosions and ball trails. */
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { ITEMS, ItemType, itemById, itemName, LOADOUT_MIN, LOADOUT_MAX } from '../meta/items';
import { profile, saveProfile, tierOf, tierNeed } from '../meta/profile';
import { setScreen, bind, toast, MenuHandlers } from './common';
import { itemHTML, itemTypeLabel } from './cards';
import { showShop } from './shop';
import { showHub } from './hub';

let tab: ItemType = 'power';
const ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };

export function showCollection(h: MenuHandlers) {
  const L = t();
  const key = tab;
  const items = ITEMS.filter((i) => i.type === key).sort((a, b) => ORDER[a.rarity] - ORDER[b.rarity]);
  const owned = (id: string) => profile.owned.includes(id);
  const count = (tp: ItemType) => `${ITEMS.filter((i) => i.type === tp && owned(i.id)).length}/${ITEMS.filter((i) => i.type === tp).length}`;
  const tabName = (tp: ItemType) => (tp === 'power' ? L.inventory : itemTypeLabel(tp));
  const isPower = key === 'power';
  const eqId = isPower ? '' : profile.equipped[key as 'goalfx' | 'trail' | 'boots'];

  const tile = (it: (typeof ITEMS)[number]) => {
    if (!isPower) {
      return `<div class="iwrap">${itemHTML(it, { owned: owned(it.id), equipped: it.id === eqId, desc: true })}
        <div class="it-act">${owned(it.id) ? (it.id === eqId ? `<span class="eq-tag">✓ ${L.equipped}</span>` : `<button class="btn btn-sm btn-ghost" data-equip="${it.id}">${L.equip}</button>`) : it.boot ? `<button class="btn btn-sm btn-ghost" data-bootshop="1">${L.buy} ›</button>` : `<span class="lock-tag">🔒 ${L.locked}</span>`}</div>
      </div>`;
    }
    const has = owned(it.id);
    const sel = profile.loadout.includes(it.id);
    const tier = tierOf(it.id);
    const need = tierNeed(it.id);
    const prog = profile.tiers[it.id]?.s ?? 0;
    return `<div class="iwrap">${itemHTML(it, { owned: has, equipped: sel, desc: true, tier: has ? tier : undefined, progress: has ? [prog, need] : undefined })}
      <div class="it-act">${has ? (sel ? `<button class="btn btn-sm btn-primary" data-pick="${it.id}">✓ ${L.selected}</button>` : `<button class="btn btn-sm btn-ghost" data-pick="${it.id}">${L.select}</button>`) : `<span class="lock-tag">🔒 ${L.locked}</span>`}</div>
    </div>`;
  };

  setScreen(
    'screen-collection',
    `<div class="collection">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="panel-title">${L.collection}</div>
        <div style="width:80px"></div>
      </div>
      <div class="tabs">
        ${(['power', 'boots', 'goalfx', 'trail'] as ItemType[]).map((tp) => `<button class="tab ${tp === key ? 'on' : ''}" data-tab="${tp}">${tabName(tp)} <small>${count(tp)}</small></button>`).join('')}
      </div>
      ${isPower ? `<div class="loadout-bar"><span>${L.loadoutHint}</span><b class="${profile.loadout.length >= LOADOUT_MIN ? '' : 'bad'}">${profile.loadout.length}/${LOADOUT_MAX}</b></div>` : ''}
      <div class="items-grid">${items.map(tile).join('')}</div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showHub(h); });
  bind('[data-bootshop]', () => { audio.click(); showShop(h, 'boots'); });
  bind('[data-tab]', (b) => { tab = b.dataset.tab as ItemType; audio.click(); showCollection(h); });
  bind('[data-equip]', (b) => {
    const it = itemById(b.dataset.equip!)!;
    if (it.type === 'power') return;
    profile.equipped[it.type] = it.id;
    saveProfile();
    audio.select();
    toast(`${L.equipped}: ${itemName(it)}`);
    showCollection(h);
  });
  bind('[data-pick]', (b) => {
    const id = b.dataset.pick!;
    const i = profile.loadout.indexOf(id);
    if (i >= 0) {
      if (profile.loadout.length <= LOADOUT_MIN) {
        toast(L.minItems);
        audio.groan();
        return;
      }
      profile.loadout.splice(i, 1);
      audio.click();
    } else {
      if (profile.loadout.length >= LOADOUT_MAX) {
        toast(L.maxItems);
        audio.groan();
        return;
      }
      profile.loadout.push(id);
      audio.select();
    }
    saveProfile();
    showCollection(h);
  });
}
