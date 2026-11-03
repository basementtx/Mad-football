/** Collectible player card (pixel-art trading-card style). */
import { CardData, overall, rarityOf, shortName, STAT_KEYS } from '../meta/cards';
import { t } from '../engine/i18n';
import type { TeamDef } from '../game/teams';
import { TEAMS } from '../game/teams';
import { esc, paintTag, portraitSource, crestTag, lookFor } from './common';

export interface CardOpts {
  club?: TeamDef | null;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  attrs?: string;
  badge?: string;
}

/** Neutral kit used for portraits when there is no club yet. */
const NEUTRAL: TeamDef = { ...TEAMS[0], id: 'neutral', primary: '#3a4766', secondary: '#c8d0e0', shorts: '#1b2236', socks: '#3a4766' };

export function cardHTML(c: CardData, o: CardOpts = {}) {
  const L = t();
  const r = rarityOf(c);
  const kit = o.club ?? NEUTRAL;
  const ovr = overall(c);
  return `
  <div class="pcard r-${r} ${o.size ?? 'md'} ${o.selected ? 'sel' : ''} ${c.custom ? 'custom' : ''}" ${o.attrs ?? ''}>
    <div class="pc-shine"></div>
    <div class="pc-head">
      <div class="pc-ovr">${ovr}</div>
      <div class="pc-pos">${L.pos[c.pos]}</div>
      ${o.club ? crestTag(o.club, 'pc-crest') : ''}
    </div>
    ${paintTag(portraitSource(lookFor(kit, c.look, c.pos === 'GK')), 'pc-portrait')}
    <div class="pc-name">${esc(shortName(c))}</div>
    <div class="pc-stats">
      ${STAT_KEYS.map((k) => `<span><b>${c.stats[k]}</b>${L.stat[k]}</span>`).join('')}
    </div>
    <div class="pc-tier">${c.custom ? '★ ' + L.you : L.cardRarity[r]}</div>
    ${o.badge ? `<div class="pc-badge">${o.badge}</div>` : ''}
  </div>`;
}

import type { Item } from '../meta/items';
import { itemName, itemDesc, RARITY_COLOR } from '../meta/items';
import { itemIcon } from '../pixel/icons';

/** Tile for an unlockable item (goal explosion, trail, power). */
export function itemHTML(it: Item, o: { owned?: boolean; equipped?: boolean; badge?: string; attrs?: string; desc?: boolean } = {}) {
  const L = t();
  return `
  <div class="itile ri-${it.rarity} ${o.owned === false ? 'locked' : ''} ${o.equipped ? 'eq' : ''}" style="--rc:${RARITY_COLOR[it.rarity]};--ic:${it.color}" ${o.attrs ?? ''}>
    ${paintTag(() => itemIcon(it.id, it.type, it.color), 'it-icon')}
    <div class="it-name">${esc(itemName(it))}</div>
    <div class="it-rar">${L.itemRarity[it.rarity]} • ${it.type === 'goalfx' ? L.goalFx : it.type === 'trail' ? L.trails : L.powers}</div>
    ${o.desc ? `<div class="it-desc">${esc(itemDesc(it))}</div>` : ''}
    ${o.badge ? `<div class="pc-badge">${o.badge}</div>` : ''}
  </div>`;
}
