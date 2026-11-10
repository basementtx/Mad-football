/**
 * Achievements: lifetime counters with three tiers each (I / II / III). A tier pays
 * coins the moment it is reached; the Missions screen lists them all.
 */
import { addCoins } from './profile';

export type AchStat =
  | 'matches' | 'wins' | 'goals' | 'knockdowns' | 'powers' | 'headers' | 'cleanSheets'
  | 'hardWins' | 'insaneWins' | 'comebacks' | 'routs'
  | 'fkGoals' | 'fkTopBins' | 'fkBest'
  | 'duelWins' | 'duelShutouts'
  | 'online' | 'onlineWins';

export interface AchDef {
  id: AchStat;
  icon: string;
  name: [string, string];
  /** {n} = the tier's target */
  desc: [string, string];
  tiers: [number, number, number];
  /** the stat is a best score (kept as a maximum), not a running total */
  max?: boolean;
}

export const ACH_REWARD = [100, 300, 800];

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'matches', icon: '⚽', name: ['Regular', 'Müdavim'], desc: ['Play {n} matches', '{n} maç oyna'], tiers: [10, 50, 200] },
  { id: 'wins', icon: '🏆', name: ['Winner', 'Kazanan'], desc: ['Win {n} matches', '{n} maç kazan'], tiers: [5, 25, 100] },
  { id: 'goals', icon: '🥅', name: ['Goal Machine', 'Gol Makinesi'], desc: ['Score {n} goals', '{n} gol at'], tiers: [25, 100, 500] },
  { id: 'knockdowns', icon: '💥', name: ['Wrecking Ball', 'Yıkım Topu'], desc: ['Knock down {n} opponents', '{n} rakibi yere ser'], tiers: [50, 250, 1000] },
  { id: 'powers', icon: '🔥', name: ['Power Up', 'Güç Bende'], desc: ['Use {n} special items', '{n} özel eşya kullan'], tiers: [10, 50, 200] },
  { id: 'headers', icon: '🎯', name: ['Head Master', 'Kafa Ustası'], desc: ['Win {n} headers', '{n} kafa topu kazan'], tiers: [10, 50, 200] },
  { id: 'cleanSheets', icon: '🧱', name: ['Brick Wall', 'Beton Duvar'], desc: ['Keep {n} clean sheets', '{n} maçta gol yeme'], tiers: [3, 15, 50] },
  { id: 'hardWins', icon: '💪', name: ['Giant Killer', 'Dev Avcısı'], desc: ['Win {n} matches on Hard or above', 'Zor ya da üstünde {n} maç kazan'], tiers: [1, 10, 40] },
  { id: 'insaneWins', icon: '😈', name: ['Madman', 'Deli Fişek'], desc: ['Win {n} matches on Insane or Legend', 'Çılgın ya da Efsane\'de {n} maç kazan'], tiers: [1, 5, 20] },
  { id: 'comebacks', icon: '↩️', name: ['Comeback Kings', 'Geri Dönüş'], desc: ['Win {n} matches after going behind', 'Geriye düştüğün {n} maçı kazan'], tiers: [1, 5, 20] },
  { id: 'routs', icon: '🌪️', name: ['Demolition', 'Fark Atan'], desc: ['Win {n} matches by 5 goals or more', '{n} maçı 5 farkla kazan'], tiers: [1, 5, 15] },
  { id: 'fkGoals', icon: '🦶', name: ['Dead-Ball Expert', 'Duran Top Ustası'], desc: ['Score {n} free kicks', '{n} serbest vuruş golü at'], tiers: [10, 50, 200] },
  { id: 'fkTopBins', icon: '📐', name: ['Top Bins', 'Doksan Avcısı'], desc: ['Score {n} free kicks in the top corner', 'Doksana {n} serbest vuruş golü at'], tiers: [1, 10, 50] },
  { id: 'fkBest', icon: '⭐', name: ['Free-Kick Star', 'Frikik Yıldızı'], desc: ['Score {n} points in one free-kick round', 'Bir serbest vuruş turunda {n} puan yap'], tiers: [800, 1500, 2500], max: true },
  { id: 'duelWins', icon: '⚔️', name: ['Duellist', 'Düellocu'], desc: ['Win {n} wall duels', '{n} duvar düellosu kazan'], tiers: [1, 10, 50] },
  { id: 'duelShutouts', icon: '🧤', name: ['Untouchable', 'Dokunulmaz'], desc: ['Win {n} wall duels without conceding', 'Gol yemeden {n} düello kazan'], tiers: [1, 5, 20] },
  { id: 'online', icon: '🌐', name: ['Online', 'Online'], desc: ['Play {n} online matches', '{n} online maç oyna'], tiers: [1, 10, 50] },
  { id: 'onlineWins', icon: '👑', name: ['Bragging Rights', 'Hava Atma Hakkı'], desc: ['Win {n} online matches', '{n} online maç kazan'], tiers: [1, 10, 30] },
];

interface Store {
  stats: Partial<Record<AchStat, number>>;
  /** tiers reached per achievement (0..3) */
  got: Partial<Record<AchStat, number>>;
}

const KEY = 'mf.ach';

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      return { stats: s.stats ?? {}, got: s.got ?? {} };
    }
  } catch {
    /* ignore */
  }
  return { stats: {}, got: {} };
}

const store: Store = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export interface Unlock {
  def: AchDef;
  tier: number; // 1..3
  reward: number;
}

export const achStat = (id: AchStat) => store.stats[id] ?? 0;
export const achTier = (id: AchStat) => store.got[id] ?? 0;

/** Add to the counters (or raise best scores) and pay any tier just reached. */
export function achRecord(add: Partial<Record<AchStat, number>>): Unlock[] {
  const out: Unlock[] = [];
  for (const def of ACHIEVEMENTS) {
    const v = add[def.id];
    if (!v) continue;
    const cur = store.stats[def.id] ?? 0;
    store.stats[def.id] = def.max ? Math.max(cur, v) : cur + v;
    let got = store.got[def.id] ?? 0;
    while (got < 3 && (store.stats[def.id] ?? 0) >= def.tiers[got]) {
      const reward = ACH_REWARD[got];
      got++;
      addCoins(reward);
      out.push({ def, tier: got, reward });
    }
    store.got[def.id] = got;
  }
  save();
  return out;
}

export function achDone() {
  return ACHIEVEMENTS.reduce((n, d) => n + (store.got[d.id] ?? 0), 0);
}
export const ACH_TOTAL = ACHIEVEMENTS.length * 3;
