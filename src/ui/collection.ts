/** Collection: equip boots, goal explosions, ball trails and powers. */
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { ITEMS, ITEM_TYPES, ItemType, itemById, itemName } from '../meta/items';
import { profile, saveProfile } from '../meta/profile';
import { setScreen, bind, toast, MenuHandlers } from './common';
import { itemHTML, itemTypeLabel } from './cards';
import { showHub } from './hub';
import { showShop } from './shop';

let tab: ItemType = 'boots';
const ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };

export function showCollection(h: MenuHandlers) {
  const L = t();
  const key = tab;
  const eqId = profile.equipped[key];
  const items = ITEMS.filter((i) => i.type === key).sort((a, b) => ORDER[a.rarity] - ORDER[b.rarity]);
  const owned = (id: string) => profile.owned.includes(id);
  const count = (tp: ItemType) => `${ITEMS.filter((i) => i.type === tp && owned(i.id)).length}/${ITEMS.filter((i) => i.type === tp).length}`;
  setScreen(
    'screen-collection',
    `<div class="collection">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="panel-title">${L.collection}</div>
        <div style="width:80px"></div>
      </div>
      <div class="tabs">
        ${ITEM_TYPES.map((tp) => `<button class="tab ${tp === key ? 'on' : ''}" data-tab="${tp}">${itemTypeLabel(tp)} <small>${count(tp)}</small></button>`).join('')}
      </div>
      <div class="items-grid">
        ${items.map((it) => `<div class="iwrap">${itemHTML(it, { owned: owned(it.id), equipped: it.id === eqId, desc: true, attrs: `data-item="${it.id}"` })}
          <div class="it-act">${owned(it.id) ? (it.id === eqId ? `<span class="eq-tag">✓ ${L.equipped}</span>` : `<button class="btn btn-sm btn-ghost" data-equip="${it.id}">${L.equip}</button>`) : (it.boot ? `<button class="btn btn-sm btn-ghost" data-market="1">🛒 ${L.market}</button>` : `<span class="lock-tag">🔒 ${L.locked}</span>`)}</div>
        </div>`).join('')}
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showHub(h); });
  bind('[data-market]', () => { audio.click(); showShop(h, 'boots'); });
  bind('[data-tab]', (b) => { tab = b.dataset.tab as ItemType; audio.click(); showCollection(h); });
  bind('[data-equip]', (b) => {
    const it = itemById(b.dataset.equip!)!;
    profile.equipped[it.type] = it.id;
    saveProfile();
    audio.select();
    toast(`${L.equipped}: ${itemName(it)}`);
    showCollection(h);
  });
}
