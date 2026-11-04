/** Persistent player profile: club, cards, lineup, unlocked items. */
import type { KitPattern, TeamDef, CrestCfg } from '../game/teams';
import { CardData, randomCard, overall, CardRarity, uid, shortName } from './cards';
import { ITEMS } from './items';
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
  equipped: { goalfx: string; trail: string; power: string; boots: string };
  freeCrateAt: number;
  starterCrate: boolean;
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
    equipped: { goalfx: 'gx_classic', trail: 'tr_basic', power: 'pw_fireball', boots: 'bt_classic' },
    freeCrateAt: 0,
    starterCrate: true,
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const base = fresh();
      const p: Profile = { ...base, ...JSON.parse(raw) };
      // saves from older versions: fill in new loadout slots and starter items
      p.equipped = { ...base.equipped, ...p.equipped };
      for (const id of base.owned) if (!p.owned.includes(id)) p.owned.push(id);
      return p;
    }
  } catch {
    /* ignore */
  }
  return fresh();
}

export const profile: Profile = load();

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

/** Buy an item straight from the market. */
export function buyItem(id: string, price: number) {
  if (profile.owned.includes(id) || !spendCoins(price)) return false;
  profile.owned.push(id);
  saveProfile();
  return true;
}

export const FREE_CRATE_EVERY = 4 * 60 * 60 * 1000;
export const freeCrateReady = () => Date.now() >= profile.freeCrateAt;
