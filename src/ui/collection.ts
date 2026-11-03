/** Collection: equip goal explosions, ball trails and powers. */
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { ITEMS, ItemType, itemById, itemName } from '../meta/items';
import { profile, saveProfile } from '../meta/profile';
import { setScreen, bind, toast, MenuHandlers } from './common';
import { itemHTML } from './cards';
import { showHub } from './hub';

let tab: ItemType = 'goalfx';
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
        ${(['goalfx', 'trail', 'power'] as ItemType[]).map((tp) => `<button class="tab ${tp === key ? 'on' : ''}" data-tab="${tp}">${tp === 'goalfx' ? L.goalFx : tp === 'trail' ? L.trails : L.powers} <small>${count(tp)}</small></button>`).join('')}
      </div>
      <div class="items-grid">
        ${items.map((it) => `<div class="iwrap">${itemHTML(it, { owned: owned(it.id), equipped: it.id === eqId, desc: true, attrs: `data-item="${it.id}"` })}
          <div class="it-act">${owned(it.id) ? (it.id === eqId ? `<span class="eq-tag">✓ ${L.equipped}</span>` : `<button class="btn btn-sm btn-ghost" data-equip="${it.id}">${L.equip}</button>`) : `<span class="lock-tag">🔒 ${L.locked}</span>`}</div>
        </div>`).join('')}
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showHub(h); });
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
