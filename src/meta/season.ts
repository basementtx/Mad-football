/**
 * Season pass: 28-day seasons, 30 levels of 100 XP. Every match, free-kick round,
 * duel, online game and daily reward gives XP; each level has a reward to claim
 * (coins, crates, and on the big levels a goal explosion / ball trail / boots).
 */
import { addCoins, profile } from './profile';
import { ITEMS, Item } from './items';

export const SEASON_DAYS = 28;
export const SEASON_LEVELS = 30;
export const XP_PER_LEVEL = 100;
/** season 1 starts Monday 9 Nov 2026 (local midnight) */
const EPOCH = new Date(2026, 10, 9).getTime();
const DAY = 24 * 3600 * 1000;

export type SeasonReward =
  | { kind: 'coins'; n: number }
  | { kind: 'crate'; id: 'basic' | 'premium' | 'legend' }
  | { kind: 'item'; item: Item };

export function seasonIndex(now = Date.now()) {
  return Math.max(0, Math.floor((now - EPOCH) / (SEASON_DAYS * DAY)));
}
export function seasonEndsIn(now = Date.now()) {
  return EPOCH + (seasonIndex(now) + 1) * SEASON_DAYS * DAY - now;
}

/** the season's showcase cosmetics: picked from the item pool by season number */
function seasonItems(idx: number): Item[] {
  const pick = (type: string, rar: string[], k: number) => {
    const pool = ITEMS.filter((i) => i.type === type && rar.includes(i.rarity) && !i.starter);
    return pool.length ? pool[(idx * 7 + k * 3) % pool.length] : null;
  };
  return [pick('trail', ['epic', 'legendary'], 1), pick('boots', ['epic', 'legendary'], 2), pick('goalfx', ['legendary', 'epic'], 3)].filter((x): x is Item => !!x);
}

/** reward for reaching level `lv` (1..30) in season `idx` */
export function seasonReward(idx: number, lv: number): SeasonReward {
  const items = seasonItems(idx);
  if (lv === 30 && items[2]) return { kind: 'item', item: items[2] };
  if (lv === 20 && items[1]) return { kind: 'item', item: items[1] };
  if (lv === 10 && items[0]) return { kind: 'item', item: items[0] };
  if (lv === 25) return { kind: 'crate', id: 'legend' };
  if (lv % 5 === 0) return { kind: 'crate', id: 'premium' };
  if (lv % 3 === 0) return { kind: 'crate', id: 'basic' };
  return { kind: 'coins', n: 100 + lv * 15 };
}

interface Store {
  season: number;
  xp: number;
  /** levels whose reward was claimed */
  claimed: number[];
}

const KEY = 'mf.season';
function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* ignore */
  }
  return { season: seasonIndex(), xp: 0, claimed: [] };
}
const store = load();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
};

/** a new season: progress starts over */
function roll() {
  const idx = seasonIndex();
  if (store.season !== idx) {
    store.season = idx;
    store.xp = 0;
    store.claimed = [];
    save();
  }
}

export function seasonState() {
  roll();
  const level = Math.min(SEASON_LEVELS, Math.floor(store.xp / XP_PER_LEVEL));
  const into = level >= SEASON_LEVELS ? XP_PER_LEVEL : store.xp % XP_PER_LEVEL;
  const claimable: number[] = [];
  for (let lv = 1; lv <= level; lv++) if (!store.claimed.includes(lv)) claimable.push(lv);
  return { season: store.season, number: store.season + 1, xp: store.xp, level, into, claimable, claimed: store.claimed, endsIn: seasonEndsIn() };
}

/** Add XP; returns the levels just reached. */
export function addSeasonXp(n: number): number[] {
  roll();
  if (n <= 0) return [];
  const before = Math.min(SEASON_LEVELS, Math.floor(store.xp / XP_PER_LEVEL));
  store.xp = Math.min(SEASON_LEVELS * XP_PER_LEVEL, store.xp + Math.round(n));
  const after = Math.min(SEASON_LEVELS, Math.floor(store.xp / XP_PER_LEVEL));
  save();
  const out: number[] = [];
  for (let lv = before + 1; lv <= after; lv++) out.push(lv);
  return out;
}

/** Claim a reached level: coins are paid here, a crate / item is handed back to show. */
export function claimSeasonLevel(lv: number): SeasonReward | null {
  const st = seasonState();
  if (lv < 1 || lv > st.level || store.claimed.includes(lv)) return null;
  store.claimed.push(lv);
  save();
  const r = seasonReward(store.season, lv);
  if (r.kind === 'coins') addCoins(r.n);
  return r;
}

/** XP for a finished match (any mode) */
export function matchXp(o: { win: boolean; draw?: boolean; goals: number; online?: boolean }) {
  return Math.round((o.online ? 30 : 20) + (o.win ? (o.online ? 25 : 15) : o.draw ? 6 : 0) + Math.min(o.goals, 6) * 4);
}

export const ownsItem = (id: string) => profile.owned.includes(id);
