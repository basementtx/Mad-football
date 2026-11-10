/**
 * Ranked online rating (Elo). Kept on this phone; the opponent's rating comes over
 * the link at kick-off. A ranked match counts as a loss from the moment it starts,
 * so quitting or closing the app mid-match cannot dodge a defeat; the real result
 * replaces it at the final whistle.
 */
export interface RankTier {
  id: string;
  name: [string, string];
  min: number;
  color: string;
}

export const TIERS: RankTier[] = [
  { id: 'bronze', name: ['Bronze', 'Bronz'], min: 0, color: '#b8763a' },
  { id: 'silver', name: ['Silver', 'Gümüş'], min: 1100, color: '#c0c8d6' },
  { id: 'gold', name: ['Gold', 'Altın'], min: 1250, color: '#ffcc2a' },
  { id: 'platinum', name: ['Platinum', 'Platin'], min: 1400, color: '#5ff0d4' },
  { id: 'diamond', name: ['Diamond', 'Elmas'], min: 1550, color: '#6cb8ff' },
  { id: 'legend', name: ['Legend', 'Efsane'], min: 1700, color: '#ff3fa4' },
];

interface Store {
  elo: number;
  peak: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** a ranked match in progress: opponent's rating (counted as a loss until it ends) */
  pending: number | null;
}

const KEY = 'mf.rank';
function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Store;
      return { ...v, pending: v.pending ?? null };
    }
  } catch {
    /* ignore */
  }
  return { elo: 1000, peak: 1000, played: 0, wins: 0, draws: 0, losses: 0, pending: null };
}
const store = load();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
};

export const rank = () => store;
export function tierOf(elo: number): RankTier {
  let t = TIERS[0];
  for (const x of TIERS) if (elo >= x.min) t = x;
  return t;
}

function delta(me: number, opp: number, score: number) {
  const k = store.played < 10 ? 40 : 28;
  const expected = 1 / (1 + Math.pow(10, (opp - me) / 400));
  return Math.round(k * (score - expected));
}

/** a ranked match kicks off */
export function rankStart(oppElo: number) {
  // a previous match that never finished (app closed) counts as lost
  settlePending();
  store.pending = Number.isFinite(oppElo) ? oppElo : 1000;
  save();
}

/** an unfinished ranked match from a previous session is a loss */
export function settlePending() {
  if (store.pending == null) return;
  const opp = store.pending;
  store.pending = null;
  apply(opp, 0);
}

/** the final whistle: returns the rating change */
export function rankResult(score: 0 | 0.5 | 1): { before: number; after: number; change: number } | null {
  if (store.pending == null) return null;
  const opp = store.pending;
  store.pending = null;
  const before = store.elo;
  apply(opp, score);
  return { before, after: store.elo, change: store.elo - before };
}

function apply(opp: number, score: number) {
  const d = delta(store.elo, opp, score);
  store.elo = Math.max(0, store.elo + d);
  store.peak = Math.max(store.peak, store.elo);
  store.played++;
  if (score === 1) store.wins++;
  else if (score === 0) store.losses++;
  else store.draws++;
  save();
}
