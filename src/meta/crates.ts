/** Crates: buy with coins, roll cards and items. */
import { CardData, CardRarity, randomCard, seriesCard, randomSeries, SeriesId } from './cards';
import { ITEMS, Item, ItemRarity, LOADOUT_MAX } from './items';
import { profile, saveProfile, addCard, addCoins, autoLineup, addCopy, tierNeed } from './profile';

export interface CrateDef {
  id: 'basic' | 'premium' | 'legend';
  price: number;
  rolls: number;
  color: string;
  itemOdds: Record<ItemRarity, number>;
  cardOdds: Partial<Record<CardRarity, number>>;
  cardChance: number;
  /** at least one item/card of this tier or better */
  guarantee?: ItemRarity;
  /** chance that a card roll is a special-series card */
  seriesChance?: number;
}

export const CRATES: CrateDef[] = [
  { id: 'basic', price: 250, rolls: 3, color: '#b8763a', itemOdds: { common: 70, rare: 25, epic: 5, legendary: 0 }, cardOdds: { bronze: 60, silver: 35, gold: 5 }, cardChance: 0.6 },
  { id: 'premium', price: 700, rolls: 4, color: '#6c8cff', itemOdds: { common: 35, rare: 42, epic: 19, legendary: 4 }, cardOdds: { bronze: 15, silver: 50, gold: 31, hero: 4 }, cardChance: 0.5, guarantee: 'rare', seriesChance: 0.05 },
  { id: 'legend', price: 1800, rolls: 5, color: '#ffb21f', itemOdds: { common: 5, rare: 40, epic: 38, legendary: 17 }, cardOdds: { silver: 15, gold: 55, hero: 24, legend: 6 }, cardChance: 0.5, guarantee: 'epic', seriesChance: 0.18 },
];

export type Reward =
  | { kind: 'card'; card: CardData }
  | {
      kind: 'item';
      item: Item;
      dupe: boolean;
      refund: number;
      /** special items: a duplicate is a copy toward the next tier (skin) */
      tierUp?: number | null;
      /** copies after this one / copies needed for the next tier */
      copies?: [number, number];
    };

export const DUPE_REFUND: Record<ItemRarity, number> = { common: 40, rare: 110, epic: 260, legendary: 650 };
const ITEM_ORDER: ItemRarity[] = ['common', 'rare', 'epic', 'legendary'];
const CARD_TO_ITEM: Record<CardRarity, ItemRarity> = { bronze: 'common', silver: 'common', gold: 'rare', hero: 'epic', legend: 'legendary' };

function weighted<K extends string>(odds: Partial<Record<K, number>>): K {
  const entries = Object.entries(odds) as [K, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

function pickItem(rarity: ItemRarity): Item {
  let pool = ITEMS.filter((i) => i.rarity === rarity && (!i.starter || i.type === 'power'));
  // prefer things the player doesn't have yet (owned special items still roll often: they upgrade)
  const fresh = pool.filter((i) => !profile.owned.includes(i.id));
  if (fresh.length && Math.random() < 0.6) pool = fresh;
  return pool[Math.floor(Math.random() * pool.length)];
}

type Roll = { kind: 'card'; rarity: CardRarity; series?: SeriesId } | { kind: 'item'; item: Item };
const rank = (r: Roll) => ITEM_ORDER.indexOf(r.kind === 'card' ? CARD_TO_ITEM[r.rarity] : r.item.rarity);

export function openCrate(def: CrateDef): Reward[] {
  // decide everything first, then apply in order (so duplicates inside one crate are detected)
  const rolls: Roll[] = [];
  for (let i = 0; i < def.rolls; i++) {
    if (Math.random() < def.cardChance) {
      if (def.seriesChance && Math.random() < def.seriesChance) rolls.push({ kind: 'card', rarity: 'legend', series: randomSeries() });
      else rolls.push({ kind: 'card', rarity: weighted(def.cardOdds) });
    }
    else rolls.push({ kind: 'item', item: pickItem(weighted(def.itemOdds)) });
  }
  if (def.guarantee && Math.max(...rolls.map(rank)) < ITEM_ORDER.indexOf(def.guarantee)) {
    rolls[rolls.length - 1] = { kind: 'item', item: pickItem(def.guarantee) };
  }
  // best reward last: the reveal builds up
  rolls.sort((a, b) => rank(a) - rank(b));
  const out: Reward[] = rolls.map((r) => {
    if (r.kind === 'card') {
      const card = r.series ? seriesCard(r.series) : randomCard(r.rarity);
      addCard(card);
      return { kind: 'card', card };
    }
    return itemReward(r.item);
  });
  autoLineup();
  saveProfile();
  return out;
}

/** Apply an item reward: new item, tier copy, or coin refund. */
function itemReward(item: Item): Reward {
  if (!profile.owned.includes(item.id)) {
    profile.owned.push(item.id);
    // new special items join the loadout while there is room
    if (item.type === 'power' && profile.loadout.length < LOADOUT_MAX) profile.loadout.push(item.id);
    return { kind: 'item', item, dupe: false, refund: 0 };
  }
  if (item.type === 'power' && tierNeed(item.id) > 0) {
    const tierUp = addCopy(item.id);
    const need = tierNeed(item.id);
    return { kind: 'item', item, dupe: true, refund: 0, tierUp, copies: [profile.tiers[item.id]?.s ?? 0, need] };
  }
  const refund = DUPE_REFUND[item.rarity];
  addCoins(refund);
  return { kind: 'item', item, dupe: true, refund };
}
