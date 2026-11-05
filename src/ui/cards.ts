/** Collectible player card (pixel-art trading-card style). */
import { CardData, overall, rarityOf, shortName, STAT_KEYS, seriesDef } from '../meta/cards';
import { settings } from '../engine/storage';
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
  const sd = c.custom ? undefined : seriesDef(c.series);
  return `
  <div class="pcard r-${r} ${o.size ?? 'md'} ${o.selected ? 'sel' : ''} ${c.custom ? 'custom' : ''} ${sd ? 'series s-' + sd.id : ''}" ${o.attrs ?? ''}>
    ${sd ? `<div class="pc-art"></div><div class="pc-sbadge">${sd.short}</div>` : ''}
    <div class="pc-shine"></div>
    <div class="pc-top">
      <div class="pc-head">
        <div class="pc-ovr">${ovr}</div>
        <div class="pc-pos">${L.pos[c.pos]}</div>
        ${o.club ? crestTag(o.club, 'pc-crest') : ''}
      </div>
      ${paintTag(portraitSource(lookFor(kit, c.look, c.pos === 'GK')), 'pc-portrait')}
    </div>
    <div class="pc-name">${esc(shortName(c))}</div>
    <div class="pc-stats">
      ${STAT_KEYS.map((k) => `<span><b>${c.stats[k]}</b><i>${L.stat[k]}</i></span>`).join('')}
    </div>
    <div class="pc-tier">${c.custom ? L.you : sd ? (settings.lang === 'tr' ? sd.name.tr : sd.name.en).toUpperCase() : L.cardRarity[r]}</div>
    ${o.badge ? `<div class="pc-badge">${o.badge}</div>` : ''}
  </div>`;
}

import type { Item, ItemType } from '../meta/items';
import { itemName, itemDesc, RARITY_COLOR, TIER_COLOR, ROMAN, tierName, BOOT_STATS } from '../meta/items';
import { itemIcon, bootIcon } from '../pixel/icons';

export function itemTypeLabel(tp: ItemType) {
  const L = t();
  return tp === 'goalfx' ? L.goalFx : tp === 'trail' ? L.trails : tp === 'boots' ? L.boots : L.items;
}

/** Icon canvas for any item (boots draw in their own colours). */
export const itemIconSource = (it: Item) => (it.boot ? () => bootIcon(it.id, it.boot!) : () => itemIcon(it.id, it.type, it.color));

/** Bonus bars for a pair of boots. */
export function bootStatsHTML(it: Item) {
  const L = t();
  if (!it.boot) return '';
  const b = it.boot.bonus;
  const rows = BOOT_STATS.filter((k) => b[k] > 0);
  if (!rows.length) return `<div class="bt-stats"><span class="bt-none">${L.bootNoBonus}</span></div>`;
  return `<div class="bt-stats">${rows
    .map((k) => `<div class="bt-row"><span>${L.bootStat[k]}</span><i><em style="width:${Math.min(100, (b[k] / 12) * 100)}%"></em></i><b>+${b[k]}</b></div>`)
    .join('')}</div>`;
}

/** Tile for an unlockable item (goal explosion, trail, special item). */
export function itemHTML(it: Item, o: { owned?: boolean; equipped?: boolean; badge?: string; attrs?: string; desc?: boolean; tier?: number; progress?: [number, number] } = {}) {
  const L = t();
  const tier = o.tier ?? 0;
  return `
  <div class="itile ri-${it.rarity} ${it.boot ? 'boot' : ''} ${o.owned === false ? 'locked' : ''} ${o.equipped ? 'eq' : ''} ${tier > 1 ? 'tier-' + tier : ''}" style="--rc:${RARITY_COLOR[it.rarity]};--ic:${it.color};--tc:${TIER_COLOR[Math.max(0, tier - 1)]}" ${o.attrs ?? ''}>
    ${paintTag(itemIconSource(it), 'it-icon')}
    <div class="it-name">${esc(itemName(it))}</div>
    <div class="it-rar">${L.itemRarity[it.rarity]} • ${itemTypeLabel(it.type)}</div>
    ${tier ? `<div class="it-tier">${ROMAN[tier - 1]} · ${esc(tierName(tier))}</div>` : ''}
    ${o.progress ? (o.progress[1] > 0 ? `<div class="it-prog" title="${L.nextSkin}"><i style="width:${Math.round((o.progress[0] / o.progress[1]) * 100)}%"></i><span>${L.copies} ${o.progress[0]}/${o.progress[1]}</span></div>` : `<div class="it-prog max"><i style="width:100%"></i><span>${L.maxTier}</span></div>`) : ''}
    ${o.desc ? `<div class="it-desc">${esc(itemDesc(it))}</div>` : ''}
    ${o.desc && it.boot ? bootStatsHTML(it) : ''}
    ${o.badge ? `<div class="pc-badge">${o.badge}</div>` : ''}
  </div>`;
}
