/**
 * Daily login reward: a 7-day calendar. One claim per local day; each day pays a bit
 * more, day 7 pays big. Missing a day starts the week over.
 */
import { addCoins } from './profile';

export interface DailyReward {
  coins?: number;
  crate?: 'basic' | 'premium' | 'legend';
  /** season pass XP */
  xp?: number;
}

export const DAILY: DailyReward[] = [
  { coins: 100, xp: 20 },
  { coins: 150, xp: 20 },
  { crate: 'basic', xp: 25 },
  { coins: 250, xp: 25 },
  { crate: 'premium', xp: 30 },
  { coins: 400, xp: 30 },
  { crate: 'legend', coins: 500, xp: 60 },
];

interface Store {
  /** days claimed in the current week (0..7) */
  streak: number;
  /** local date of the last claim, YYYY-MM-DD */
  last: string;
}

const KEY = 'mf.daily';
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* ignore */
  }
  return { streak: 0, last: '' };
}
const store = load();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
};

export interface DailyStatus {
  /** can claim today */
  ready: boolean;
  /** index (0..6) of today's / the next reward */
  day: number;
  /** days already claimed this week, as shown on the calendar */
  claimed: number;
  /** ms until the next claim opens (0 when ready) */
  nextIn: number;
  /** the streak was broken (a day was missed): the week starts over */
  reset: boolean;
}

export function dailyStatus(now = new Date()): DailyStatus {
  const today = dayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  if (store.last === today) {
    // claimed today: day 7 done -> a new week tomorrow
    const claimed = store.streak;
    return { ready: false, day: claimed % 7, claimed, nextIn: midnight - now.getTime(), reset: false };
  }
  const kept = store.last === yesterday && store.streak < 7;
  const claimed = kept ? store.streak : 0;
  return { ready: true, day: claimed, claimed, nextIn: 0, reset: !!store.last && !kept && store.streak < 7 };
}

/** Claim today's reward (coins are paid here; crates and XP are handed back to open/apply). */
export function claimDaily(): DailyReward | null {
  const st = dailyStatus();
  if (!st.ready) return null;
  const r = DAILY[st.day];
  store.streak = st.day + 1;
  store.last = dayKey(new Date());
  save();
  if (r.coins) addCoins(r.coins);
  return r;
}
