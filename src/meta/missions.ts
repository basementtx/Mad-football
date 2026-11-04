/**
 * Daily and weekly missions. Three of each are rolled per period (local day / week
 * starting Monday) and progress from match summaries. Finished missions are claimed
 * for coins in the Missions screen.
 */
import { addCoins } from './profile';

export type MissionType =
  | 'play' | 'win' | 'goals' | 'knockdowns' | 'passes' | 'crosses' | 'chips' | 'headers'
  | 'powers' | 'cleanSheet' | 'hardWin' | 'weatherWin' | 'league' | 'steals';

export interface Mission {
  type: MissionType;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

interface Store {
  dayKey: string;
  weekKey: string;
  daily: Mission[];
  weekly: Mission[];
}

/** [daily targets, weekly targets, coins per unit of target] */
const DEFS: Record<MissionType, { d: number[]; w: number[]; coin: number }> = {
  play: { d: [2, 3], w: [8, 12], coin: 30 },
  win: { d: [1, 2], w: [5, 7], coin: 60 },
  goals: { d: [3, 5], w: [15, 20], coin: 18 },
  knockdowns: { d: [8, 12], w: [40, 60], coin: 6 },
  passes: { d: [15, 25], w: [80, 120], coin: 4 },
  crosses: { d: [3, 5], w: [12, 20], coin: 18 },
  chips: { d: [2, 3], w: [8, 12], coin: 28 },
  headers: { d: [3, 5], w: [15, 25], coin: 15 },
  powers: { d: [1, 2], w: [6, 10], coin: 40 },
  cleanSheet: { d: [1], w: [3, 4], coin: 90 },
  hardWin: { d: [1], w: [3], coin: 110 },
  weatherWin: { d: [], w: [2, 3], coin: 120 },
  league: { d: [], w: [4, 6], coin: 50 },
  steals: { d: [4, 6], w: [20, 30], coin: 9 },
};

const KEY = 'mf.missions';
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function mondayOf(now: Date) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function roll(kind: 'd' | 'w'): Mission[] {
  const types = (Object.keys(DEFS) as MissionType[]).filter((t) => DEFS[t][kind].length);
  const out: Mission[] = [];
  while (out.length < 3) {
    const type = pick(types);
    if (out.some((m) => m.type === type)) continue;
    const target = pick(DEFS[type][kind]);
    const base = target * DEFS[type].coin * (kind === 'w' ? 1.25 : 1);
    out.push({ type, target, progress: 0, reward: Math.round(base / 10) * 10, claimed: false });
  }
  return out;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* ignore */
  }
  return { dayKey: '', weekKey: '', daily: [], weekly: [] };
}

const store: Store = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/** Roll new missions when the day / week changed. */
export function refreshMissions() {
  const now = new Date();
  const dk = dateKey(now), wk = dateKey(mondayOf(now));
  let changed = false;
  if (store.dayKey !== dk) {
    store.dayKey = dk;
    store.daily = roll('d');
    changed = true;
  }
  if (store.weekKey !== wk) {
    store.weekKey = wk;
    store.weekly = roll('w');
    changed = true;
  }
  if (changed) save();
  return store;
}

/** Milliseconds until the daily / weekly reset. */
export function resetsIn() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextMon = mondayOf(now);
  nextMon.setDate(nextMon.getDate() + 7);
  return { daily: tomorrow.getTime() - now.getTime(), weekly: nextMon.getTime() - now.getTime() };
}

export interface MatchSummary {
  res: 'w' | 'd' | 'l';
  goalsFor: number;
  goalsAgainst: number;
  knockdowns: number;
  passes: number;
  crosses: number;
  chips: number;
  headers: number;
  powers: number;
  steals: number;
  hard: boolean;
  badWeather: boolean;
  league: boolean;
}

function gain(type: MissionType, s: MatchSummary): number {
  switch (type) {
    case 'play': return 1;
    case 'win': return s.res === 'w' ? 1 : 0;
    case 'goals': return s.goalsFor;
    case 'knockdowns': return s.knockdowns;
    case 'passes': return s.passes;
    case 'crosses': return s.crosses;
    case 'chips': return s.chips;
    case 'headers': return s.headers;
    case 'powers': return s.powers;
    case 'steals': return s.steals;
    case 'cleanSheet': return s.goalsAgainst === 0 ? 1 : 0;
    case 'hardWin': return s.res === 'w' && s.hard ? 1 : 0;
    case 'weatherWin': return s.res === 'w' && s.badWeather ? 1 : 0;
    case 'league': return s.league ? 1 : 0;
  }
}

/** Apply a finished match; returns the missions completed by it. */
export function missionsAfterMatch(s: MatchSummary): Mission[] {
  refreshMissions();
  const done: Mission[] = [];
  for (const m of [...store.daily, ...store.weekly]) {
    if (m.progress >= m.target) continue;
    m.progress = Math.min(m.target, m.progress + gain(m.type, s));
    if (m.progress >= m.target) done.push(m);
  }
  save();
  return done;
}

export function claimMission(m: Mission) {
  if (m.claimed || m.progress < m.target) return 0;
  m.claimed = true;
  addCoins(m.reward);
  save();
  return m.reward;
}

export const claimableCount = () => {
  refreshMissions();
  return [...store.daily, ...store.weekly].filter((m) => !m.claimed && m.progress >= m.target).length;
};
