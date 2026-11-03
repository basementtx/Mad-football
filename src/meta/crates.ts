/** Crates: buy with coins, roll cards and items. */
import { CardData, CardRarity, randomCard } from './cards';
import { ITEMS, Item, ItemRarity } from './items';
import { profile, saveProfile, addCard, addCoins, autoLineup } from './profile';

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
}

export const CRATES: CrateDef[] = [
  { id: 'basic', price: 250, rolls: 3, color: '#b8763a', itemOdds: { common: 70, rare: 25, epic: 5, legendary: 0 }, cardOdds: { bronze: 60, silver: 35, gold: 5 }, cardChance: 0.6 },
  { id: 'premium', price: 700, rolls: 4, color: '#6c8cff', itemOdds: { common: 35, rare: 42, epic: 19, legendary: 4 }, cardOdds: { bronze: 15, silver: 50, gold: 31, hero: 4 }, cardChance: 0.5, guarantee: 'rare' },
  { id: 'legend', price: 1800, rolls: 5, color: '#ffb21f', itemOdds: { common: 5, rare: 40, epic: 38, legendary: 17 }, cardOdds: { silver: 15, gold: 55, hero: 24, legend: 6 }, cardChance: 0.5, guarantee: 'epic' },
];

export type Reward =
  | { kind: 'card'; card: CardData }
  | { kind: 'item'; item: Item; dupe: boolean; refund: number };

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
  let pool = ITEMS.filter((i) => i.rarity === rarity && !i.starter);
  // prefer things the player doesn't have yet
  const fresh = pool.filter((i) => !profile.owned.includes(i.id));
  if (fresh.length && Math.random() < 0.75) pool = fresh;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function openCrate(def: CrateDef): Reward[] {
  const out: Reward[] = [];
  let best = -1;
  for (let i = 0; i < def.rolls; i++) {
    if (Math.random() < def.cardChance) {
      const r = weighted(def.cardOdds);
      const card = randomCard(r);
      addCard(card);
      out.push({ kind: 'card', card });
      best = Math.max(best, ITEM_ORDER.indexOf(CARD_TO_ITEM[r]));
    } else {
      const r = weighted(def.itemOdds);
      out.push(itemReward(pickItem(r)));
      best = Math.max(best, ITEM_ORDER.indexOf(r));
    }
  }
  if (def.guarantee && best < ITEM_ORDER.indexOf(def.guarantee)) {
    const last = out[out.length - 1];
    // undo the reward being replaced so what is shown is exactly what is granted
    if (last.kind === 'card') profile.cards = profile.cards.filter((c) => c.id !== last.card.id);
    else if (last.dupe) addCoins(-last.refund);
    else profile.owned = profile.owned.filter((id) => id !== last.item.id);
    out[out.length - 1] = itemReward(pickItem(def.guarantee));
  }
  autoLineup();
  saveProfile();
  return out;
}

/** Build an item reward and apply it immediately (so duplicates inside one crate are detected). */
function itemReward(item: Item): Reward {
  const dupe = profile.owned.includes(item.id);
  const refund = dupe ? DUPE_REFUND[item.rarity] : 0;
  if (dupe) addCoins(refund);
  else profile.owned.push(item.id);
  return { kind: 'item', item, dupe, refund };
}
