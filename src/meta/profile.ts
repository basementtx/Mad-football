/** Persistent player profile: club, cards, lineup, unlocked items. */
import type { KitPattern, TeamDef, CrestCfg } from '../game/teams';
import { CardData, randomCard, overall, CardRarity, uid, shortName } from './cards';
import { ITEMS, itemById, LOADOUT_MIN, LOADOUT_MAX, MAX_TIER, TIER_NEED } from './items';
import { record, saveRecord } from '../engine/storage';
import { clamp } from '../engine/math';

export interface Club {
  name: string;
  short: string;
  primary: string;
  secondary: string;
  shorts: string;
  socks: string;
  gk: string;
  pattern: KitPattern;
  crest: CrestCfg;
}

export interface Profile {
  v: number;
  club: Club | null;
  cards: CardData[];
  /** card ids; slot 0 = goalkeeper. Matches use the first N slots. */
  lineup: string[];
  myPlayer: string | null;
  owned: string[];
  equipped: { goalfx: string; trail: string; boots: string };
  /** special items that can drop from the mystery boxes in a match (3-5) */
  loadout: string[];
  /** item tier / skin progress: t = tier (1..5), s = copies collected toward the next tier */
  tiers: Record<string, { t: number; s: number }>;
  freeCrateAt: number;
  starterCrate: boolean;
  /** unlocked looks (meta/cosmetics ids) */
  unlocked: string[];
  /** club matches each card has started (team chemistry) */
  fam: Record<string, number>;
}

const KEY = 'mf.profile';

function fresh(): Profile {
  return {
    v: 1,
    club: null,
    cards: [],
    lineup: [],
    myPlayer: null,
    owned: ITEMS.filter((i) => i.starter).map((i) => i.id),
    equipped: { goalfx: 'gx_classic', trail: 'tr_basic', boots: 'bt_classic' },
    loadout: ITEMS.filter((i) => i.starter && i.type === 'power').map((i) => i.id),
    tiers: {},
    freeCrateAt: 0,
    starterCrate: true,
    unlocked: [],
    fam: {},
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return fresh();
}

export const profile: Profile = load();
migrate();

/** Older saves: grant the new starter items and build a loadout. */
function migrate() {
  for (const it of ITEMS) if (it.starter && !profile.owned.includes(it.id)) profile.owned.push(it.id);
  if (!Array.isArray(profile.loadout)) profile.loadout = [];
  profile.loadout = profile.loadout.filter((id) => profile.owned.includes(id) && itemById(id)?.type === 'power');
  const old = (profile.equipped as { power?: string }).power;
  if (old && profile.owned.includes(old) && !profile.loadout.includes(old) && profile.loadout.length < LOADOUT_MAX) profile.loadout.unshift(old);
  for (const it of ITEMS) {
    if (profile.loadout.length >= LOADOUT_MIN) break;
    if (it.type === 'power' && profile.owned.includes(it.id) && !profile.loadout.includes(it.id)) profile.loadout.push(it.id);
  }
  if (!profile.tiers || typeof profile.tiers !== 'object') profile.tiers = {};
  if (!Array.isArray(profile.unlocked)) profile.unlocked = [];
  if (!profile.equipped.boots || !profile.owned.includes(profile.equipped.boots)) profile.equipped.boots = 'bt_classic';
}

/** Buy a pair of boots from the boot shop and put them on. */
export function buyBoots(id: string, price: number) {
  if (profile.owned.includes(id) || !spendCoins(price)) return false;
  profile.owned.push(id);
  profile.equipped.boots = id;
  saveProfile();
  return true;
}

export const tierOf = (id: string) => profile.tiers[id]?.t ?? 1;

/** Copies needed for the next tier of an item (0 when maxed). */
export function tierNeed(id: string) {
  const it = itemById(id);
  const t = tierOf(id);
  if (!it || t >= MAX_TIER) return 0;
  return TIER_NEED[it.rarity][t - 1];
}

/** Add one duplicate copy; returns the new tier if it went up. */
export function addCopy(id: string): number | null {
  const cur = profile.tiers[id] ?? { t: 1, s: 0 };
  cur.s++;
  const it = itemById(id)!;
  let up: number | null = null;
  const need = TIER_NEED[it.rarity][cur.t - 1];
  if (cur.t < MAX_TIER && cur.s >= need) {
    cur.t++;
    cur.s = 0;
    up = cur.t;
  }
  profile.tiers[id] = cur;
  return up;
}

/** tier per power id for a match (fireball -> 3 ...) */
export function loadoutTiers(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const id of profile.loadout) o[id.replace('pw_', '')] = tierOf(id);
  return o;
}

export function saveProfile() {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export const LINEUP_SLOTS = 5;
export const SLOT_ROLES = ['GK', 'DEF', 'DEF', 'MID', 'FWD'] as const;

export const cardById = (id: string | null | undefined) => profile.cards.find((c) => c.id === id) ?? null;

export function lineupCards(): (CardData | null)[] {
  const out: (CardData | null)[] = [];
  for (let i = 0; i < LINEUP_SLOTS; i++) out.push(cardById(profile.lineup[i]));
  return out;
}

export function clubOverall() {
  const cs = lineupCards().filter((c): c is CardData => !!c);
  if (!cs.length) return 0;
  return Math.round(cs.reduce((a, c) => a + overall(c), 0) / cs.length);
}

/** Give a brand-new club a starting squad of bronze/silver players. */
export function ensureStarterSquad() {
  if (profile.cards.length >= LINEUP_SLOTS) return;
  const plan: [CardRarity, CardData['pos']][] = [
    ['silver', 'GK'], ['bronze', 'DEF'], ['silver', 'DEF'], ['bronze', 'MID'], ['silver', 'FWD'], ['bronze', 'MID'], ['bronze', 'FWD'],
  ];
  for (const [r, p] of plan) profile.cards.push(randomCard(r, p));
  autoLineup();
  saveProfile();
}

/** Fill empty lineup slots with the best available cards. */
export function autoLineup() {
  const used = new Set(profile.lineup.filter((id) => cardById(id)));
  const lineup = [...profile.lineup];
  for (let i = 0; i < LINEUP_SLOTS; i++) {
    if (cardById(lineup[i])) continue;
    const want = SLOT_ROLES[i];
    const pool = profile.cards.filter((c) => !used.has(c.id));
    pool.sort((a, b) => (b.pos === want ? 100 : 0) + overall(b) - ((a.pos === want ? 100 : 0) + overall(a)));
    if (pool[0]) {
      lineup[i] = pool[0].id;
      used.add(pool[0].id);
    }
  }
  profile.lineup = lineup.slice(0, LINEUP_SLOTS);
}

export function addCard(c: CardData) {
  profile.cards.push(c);
}

export function saveMyPlayer(c: CardData) {
  const existing = cardById(profile.myPlayer);
  if (existing) Object.assign(existing, c, { id: existing.id });
  else {
    c.id = c.id || uid();
    profile.cards.push(c);
    profile.myPlayer = c.id;
    // put the star player straight into the lineup, replacing the weakest outfield slot
    let worst = 1;
    for (let i = 1; i < LINEUP_SLOTS; i++) {
      const a = cardById(profile.lineup[i]), b = cardById(profile.lineup[worst]);
      if (!a) { worst = i; break; }
      if (b && overall(a) < overall(b)) worst = i;
    }
    profile.lineup[worst] = c.id;
  }
  saveProfile();
}

export function clubTeamDef(): TeamDef | null {
  const c = profile.club;
  if (!c) return null;
  const cards = lineupCards().filter((x): x is CardData => !!x);
  const avg = (k: keyof CardData['stats']) => (cards.length ? cards.reduce((a, x) => a + x.stats[k], 0) / cards.length : 55);
  // 1..5 scale like the built-in teams
  const sc = (v: number) => clamp(1 + ((v - 40) / 55) * 4, 1, 5);
  return {
    id: 'club',
    name: c.name,
    short: c.short,
    primary: c.primary,
    secondary: c.secondary,
    shorts: c.shorts,
    socks: c.socks,
    gk: c.gk,
    pattern: c.pattern,
    pace: sc(avg('pac')),
    power: sc((avg('sho') + avg('phy')) / 2),
    tackle: sc(avg('def')),
    skill: sc((avg('dri') + avg('pas')) / 2),
    crest: c.crest,
    names: cards.map(shortName),
  };
}

export const coins = () => record.coins;
export function spendCoins(n: number) {
  if (record.coins < n) return false;
  record.coins -= n;
  saveRecord();
  return true;
}
export function addCoins(n: number) {
  record.coins += n;
  saveRecord();
}

export const FREE_CRATE_EVERY = 4 * 60 * 60 * 1000;
export const freeCrateReady = () => Date.now() >= profile.freeCrateAt;
