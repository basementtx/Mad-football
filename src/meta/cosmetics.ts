/**
 * Unlockable looks (kit patterns, hair styles / dyes, face shapes, crest shapes
 * and icons) and the rotating Store: timed offers on locked looks and on items
 * (goal explosions, ball trails, special items) the player doesn't own yet.
 */
import { ITEMS, Item, ItemRarity, itemById } from './items';
import { profile, saveProfile, spendCoins, addCopy } from './profile';
import { HAIRS, HAIRS_EXTRA, HAIR_STYLES, FACES } from './cards';
import { CREST_SHAPES, ICON_IDS } from '../pixel/crest';
import { settings } from '../engine/storage';
import { pick } from '../engine/math';

export type CosKind = 'pattern' | 'hair' | 'dye' | 'face' | 'shape' | 'icon';
export interface Cosmetic {
  id: string; // kind:value
  kind: CosKind;
  value: string;
  rarity: ItemRarity;
  price: number;
}

const FREE_PATTERNS = ['solid', 'stripes', 'hoops', 'half', 'sash', 'chevron'];
const ALL_PATTERNS = [...FREE_PATTERNS, 'pinstripe', 'checker', 'band', 'yoke', 'diagonal', 'zigzag'];
const FREE_ICONS = ['bolt', 'flame', 'crown', 'star', 'skull', 'ball', 'horns', 'wing', 'heart', 'anchor'];
const PRICE: Record<ItemRarity, number> = { common: 300, rare: 650, epic: 1200, legendary: 2400 };
const RAR = (i: number, list: ItemRarity[]) => list[i % list.length];

export const COSMETICS: Cosmetic[] = [];
const add = (kind: CosKind, value: string | number, rarity: ItemRarity) =>
  COSMETICS.push({ id: `${kind}:${value}`, kind, value: String(value), rarity, price: PRICE[rarity] });

ALL_PATTERNS.slice(FREE_PATTERNS.length).forEach((p, i) => add('pattern', p, RAR(i, ['common', 'rare', 'common', 'rare', 'epic', 'epic'])));
for (let h = 7; h < HAIR_STYLES; h++) add('hair', h, RAR(h, ['rare', 'common', 'epic', 'rare', 'legendary']));
HAIRS_EXTRA.forEach((c, i) => add('dye', c, RAR(i, ['common', 'rare', 'rare', 'epic', 'epic', 'rare'])));
for (let f = 1; f < FACES; f++) add('face', f, RAR(f, ['common', 'common', 'rare', 'rare']));
for (let s = 5; s < CREST_SHAPES; s++) add('shape', s, RAR(s, ['rare', 'common', 'epic', 'rare', 'legendary']));
ICON_IDS.filter((i) => !FREE_ICONS.includes(i)).forEach((ic, i) => add('icon', ic, RAR(i, ['common', 'rare', 'common', 'epic', 'rare', 'epic', 'legendary', 'rare'])));

export const PATTERNS = ALL_PATTERNS;
export const DYES = [...HAIRS, ...HAIRS_EXTRA];
export const cosById = (id: string) => COSMETICS.find((c) => c.id === id);
export const cosFor = (kind: CosKind, value: string | number) => cosById(`${kind}:${value}`);

/** free looks are always unlocked */
export function unlocked(kind: CosKind, value: string | number) {
  const c = cosFor(kind, value);
  return !c || profile.unlocked.includes(c.id);
}

const NAMES: Record<CosKind, { en: string; tr: string }> = {
  pattern: { en: 'Kit', tr: 'Forma' },
  hair: { en: 'Hair', tr: 'Saç' },
  dye: { en: 'Hair dye', tr: 'Saç boyası' },
  face: { en: 'Face', tr: 'Yüz' },
  shape: { en: 'Crest shape', tr: 'Arma şekli' },
  icon: { en: 'Crest icon', tr: 'Arma simgesi' },
};
const VALUE_NAMES: Record<string, { en: string; tr: string }> = {
  'pattern:pinstripe': { en: 'Pinstripe', tr: 'İnce Çizgi' }, 'pattern:checker': { en: 'Checkerboard', tr: 'Dama' },
  'pattern:band': { en: 'Centre Band', tr: 'Orta Bant' }, 'pattern:yoke': { en: 'Yoke', tr: 'Omuz' },
  'pattern:diagonal': { en: 'Diagonal Split', tr: 'Çapraz' }, 'pattern:zigzag': { en: 'Zigzag', tr: 'Zikzak' },
  'hair:7': { en: 'Top Knot', tr: 'Topuz' }, 'hair:8': { en: 'Curls', tr: 'Kıvırcık' }, 'hair:9': { en: 'Swept Fringe', tr: 'Yan Perçem' },
  'hair:10': { en: 'Dreadlocks', tr: 'Rasta' }, 'hair:11': { en: 'Flat Top', tr: 'Düz Tepe' },
  'face:1': { en: 'Round Face', tr: 'Yuvarlak Yüz' }, 'face:2': { en: 'Square Jaw', tr: 'Köşeli Çene' },
  'face:3': { en: 'Long Face', tr: 'Uzun Yüz' }, 'face:4': { en: 'Sharp Chin', tr: 'Sivri Çene' },
  'shape:5': { en: 'Octagon', tr: 'Sekizgen' }, 'shape:6': { en: 'Castle', tr: 'Kale' }, 'shape:7': { en: 'Round Shield', tr: 'Yuvarlak Kalkan' },
  'shape:8': { en: 'Sunburst', tr: 'Güneş' }, 'shape:9': { en: 'Pennant', tr: 'Flama' },
  'dye:#f4f1e8': { en: 'Platinum', tr: 'Platin' }, 'dye:#ff7a1a': { en: 'Orange', tr: 'Turuncu' }, 'dye:#ff3fa4': { en: 'Pink', tr: 'Pembe' },
  'dye:#8a5cff': { en: 'Violet', tr: 'Mor' }, 'dye:#3f8cff': { en: 'Electric Blue', tr: 'Elektrik Mavisi' }, 'dye:#21c48a': { en: 'Mint', tr: 'Nane' },
};
export function cosName(c: Cosmetic) {
  const lang = settings.lang === 'tr' ? 'tr' : 'en';
  const v = VALUE_NAMES[c.id]?.[lang] ?? c.value.charAt(0).toUpperCase() + c.value.slice(1);
  return v;
}
export const cosKindName = (c: Cosmetic) => NAMES[c.kind][settings.lang === 'tr' ? 'tr' : 'en'];

export function unlock(id: string) {
  if (!profile.unlocked.includes(id)) profile.unlocked.push(id);
  saveProfile();
}

/** Buy a locked look at full price (from an editor). */
export function buyCosmetic(id: string): boolean {
  const c = cosById(id);
  if (!c || profile.unlocked.includes(id)) return true;
  if (!spendCoins(c.price)) return false;
  unlock(id);
  return true;
}

// ------------------------------------------------------------------ the Store (timed offers)

export const STORE_EVERY = 4 * 60 * 60 * 1000;
export const STORE_REFRESH_COST = 100;
export const ITEM_PRICE: Record<ItemRarity, number> = { common: 450, rare: 1000, epic: 2000, legendary: 3800 };

export interface StoreOffer {
  id: string; // cosmetic id or item id
  base: number;
  price: number;
  off: number; // discount in %
  featured?: boolean;
  /** flash deals expire before the rotation does */
  until?: number;
  bought?: boolean;
}

export interface Store {
  v: number;
  at: number; // next rotation
  offers: StoreOffer[];
  seen: boolean;
}

const KEY = 'mf.store';
function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* ignore */
  }
  return { v: 1, at: 0, offers: [], seen: true };
}
export const store: Store = load();
export function saveStore() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export const isItemId = (id: string) => !id.includes(':');
export const offerItem = (o: StoreOffer): Item | undefined => (isItemId(o.id) ? itemById(o.id) : undefined);
export const offerCos = (o: StoreOffer): Cosmetic | undefined => (isItemId(o.id) ? undefined : cosById(o.id));
export function offerRarity(o: StoreOffer): ItemRarity {
  return offerItem(o)?.rarity ?? offerCos(o)?.rarity ?? 'common';
}

function owned(id: string) {
  return isItemId(id) ? profile.owned.includes(id) : profile.unlocked.includes(id);
}

function rollStore() {
  const items = ITEMS.filter((i) => !i.starter && !profile.owned.includes(i.id)).map((i) => i.id);
  const looks = COSMETICS.filter((c) => !profile.unlocked.includes(c.id)).map((c) => c.id);
  // owned special items can still be bought: a copy upgrades their tier
  const powers = ITEMS.filter((i) => i.type === 'power' && profile.owned.includes(i.id)).map((i) => i.id);
  const taken = new Set<string>();
  const take = (pool: string[]) => {
    const p = pool.filter((x) => !taken.has(x));
    if (!p.length) return null;
    const id = pick(p);
    taken.add(id);
    return id;
  };
  const offers: StoreOffer[] = [];
  const mk = (id: string | null, off: number, extra: Partial<StoreOffer> = {}) => {
    if (!id) return;
    const it = isItemId(id) ? itemById(id) : undefined;
    const base = it ? ITEM_PRICE[it.rarity] : cosById(id)?.price ?? 300;
    offers.push({ id, base, off, price: Math.round((base * (100 - off)) / 100 / 10) * 10, ...extra });
  };
  // featured: the rarest thing we can find, 30% off
  const rare = [...items, ...looks].filter((id) => ['epic', 'legendary'].includes(isItemId(id) ? itemById(id)!.rarity : cosById(id)!.rarity));
  mk(take(rare.length ? rare : [...items, ...looks]), 30, { featured: true });
  // flash deal: 45% off for one hour
  mk(take([...items, ...looks]), 45, { until: Date.now() + 60 * 60 * 1000 });
  for (let i = 0; i < 2; i++) mk(take(items.length ? items : looks), pick([0, 10, 15, 20]));
  for (let i = 0; i < 3; i++) mk(take(looks.length ? looks : items), pick([0, 0, 10, 20, 25]));
  if (powers.length) mk(take(powers), 20);
  store.offers = offers;
  store.seen = false;
}

/** Rotate the store when its time is up. */
export function tickStore() {
  if (Date.now() >= store.at || !store.offers.length) {
    rollStore();
    store.at = Date.now() + STORE_EVERY;
    saveStore();
  }
}

export function refreshStore(): boolean {
  if (!spendCoins(STORE_REFRESH_COST)) return false;
  rollStore();
  store.seen = true;
  store.at = Date.now() + STORE_EVERY;
  saveStore();
  return true;
}

export type BuyResult = 'ok' | 'coins' | 'gone' | 'owned';
export function buyOffer(o: StoreOffer): { res: BuyResult; tierUp?: number | null } {
  if (o.bought || (o.until && Date.now() > o.until)) return { res: 'gone' };
  const it = offerItem(o);
  const isCopy = !!it && it.type === 'power' && profile.owned.includes(it.id);
  if (!isCopy && owned(o.id)) return { res: 'owned' };
  if (!spendCoins(o.price)) return { res: 'coins' };
  o.bought = true;
  let tierUp: number | null = null;
  if (it) {
    if (isCopy) tierUp = addCopy(it.id);
    else profile.owned.push(it.id);
  } else profile.unlocked.push(o.id);
  saveProfile();
  saveStore();
  return { res: 'ok', tierUp };
}

export const newStoreOffers = () => !store.seen;
export function markStoreSeen() {
  if (!store.seen) {
    store.seen = true;
    saveStore();
  }
}
