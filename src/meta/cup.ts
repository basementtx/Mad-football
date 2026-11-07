/**
 * Cup: an 8-club knockout (quarter-finals, semis, final) against clubs from
 * your division and the one above. Drawn ties go to penalties. Every edition
 * pays out per round; the winner lifts the trophy and gets a special card.
 */
import type { TeamDef } from '../game/teams';
import type { Difficulty } from '../game/entities';
import { clamp } from '../engine/math';
import { league, makeClub, DIV_DIFF, ratingOf as leagueRating } from './league';
import { clubTeamDef, clubOverall, addCoins, addCard, saveProfile } from './profile';
import { seriesCard, randomSeries, CardData } from './cards';
import { addTrophy } from './honours';

export interface CupTie { a: string; b: string; ag?: number; bg?: number; pens?: [number, number]; w?: string }
export interface Cup {
  v: 1;
  edition: number;
  div: number;
  teams: (TeamDef & { div: number })[];
  rounds: CupTie[][];
  round: number;
  status: 'running' | 'won' | 'out';
}

export const CUP_ROUNDS = 3;
/** coins for winning each round (QF, SF, final), times the division multiplier */
const ROUND_PAY = [400, 800, 2000];
const DIV_MULT: Record<number, number> = { 5: 1, 4: 1.3, 3: 1.7, 2: 2.2, 1: 3 };

const KEY = 'mf.cup';
function load(): Cup | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Cup;
  } catch {
    /* ignore */
  }
  return null;
}
export let cup: Cup | null = load();
export function saveCup() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cup));
  } catch {
    /* ignore */
  }
}

export function newCup(): Cup {
  const div = league.div;
  const used = new Set<string>();
  const teams = Array.from({ length: 7 }, (_, i) => {
    const d = i < 3 && div > 1 ? div - 1 : div;
    return { ...makeClub(d, used), div: d };
  });
  const ids = ['club', ...teams.map((t) => t.id)].sort(() => Math.random() - 0.5);
  const qf: CupTie[] = [];
  for (let i = 0; i < 8; i += 2) qf.push({ a: ids[i], b: ids[i + 1] });
  cup = { v: 1, edition: (cup?.edition ?? 0) + 1, div, teams, rounds: [qf], round: 0, status: 'running' };
  saveCup();
  return cup;
}

export function cupTeam(id: string): TeamDef {
  if (id === 'club') return clubTeamDef()!;
  return cup?.teams.find((t) => t.id === id) ?? league.teams[0];
}

export function cupRating(id: string) {
  if (id === 'club') return clamp((clubOverall() - 40) / 11, 1, 5);
  const t = cup?.teams.find((x) => x.id === id);
  if (!t) return leagueRating(id);
  return (t.pace + t.power + t.tackle + t.skill) / 4;
}

export const userTie = () => cup?.rounds[cup.round]?.find((t) => t.a === 'club' || t.b === 'club') ?? null;
export const userOpp = () => {
  const t = userTie();
  return t ? (t.a === 'club' ? t.b : t.a) : null;
};

export function cupDifficulty(): Difficulty {
  const opp = userOpp();
  const d = cup?.teams.find((t) => t.id === opp)?.div ?? league.div;
  // later rounds get harder: the semi-final a step up, the final two
  const base = clamp(d - (cup ? Math.min(2, cup.round) : 0), 1, 5);
  return DIV_DIFF[base];
}

export const roundPay = (r: number) => Math.round(ROUND_PAY[r] * (DIV_MULT[cup?.div ?? 5] ?? 1));

function poisson(l: number) {
  const L = Math.exp(-l);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L && k < 12);
  return k - 1;
}

/** Penalty shootout: five each, then sudden death; better sides convert a bit more. */
export function shootout(ra: number, rb: number): [number, number] {
  const pa = clamp(0.72 + (ra - rb) * 0.04, 0.55, 0.9), pb = clamp(0.72 + (rb - ra) * 0.04, 0.55, 0.9);
  let a = 0, b = 0;
  for (let i = 0; i < 5; i++) {
    if (Math.random() < pa) a++;
    if (a > b + (5 - i)) break;
    if (Math.random() < pb) b++;
    if (b > a + (4 - i)) break;
  }
  let guard = 0;
  while (a === b && guard++ < 20) {
    const x = Math.random() < pa, y = Math.random() < pb;
    if (x) a++;
    if (y) b++;
  }
  if (a === b) a++;
  return [a, b];
}

function settle(t: CupTie, ag: number, bg: number) {
  t.ag = ag;
  t.bg = bg;
  if (ag === bg) t.pens = shootout(cupRating(t.a), cupRating(t.b));
  const aw = ag > bg || (ag === bg && t.pens![0] > t.pens![1]);
  t.w = aw ? t.a : t.b;
}

export interface CupOutcome {
  won: boolean;
  pens?: [number, number];
  coins: number;
  /** final won: the trophy and a special card */
  champion: boolean;
  card?: CardData;
}

/** Record your cup tie, play the others of the round, move the cup on. */
export function recordCupResult(my: number, opp: number): CupOutcome | null {
  if (!cup || cup.status !== 'running') return null;
  const tie = userTie();
  if (!tie) return null;
  const mineA = tie.a === 'club';
  settle(tie, mineA ? my : opp, mineA ? opp : my);
  for (const t of cup.rounds[cup.round]) {
    if (t === tie) continue;
    const ra = cupRating(t.a), rb = cupRating(t.b);
    settle(t, poisson(clamp(1.4 + (ra - rb) * 0.45, 0.3, 4)), poisson(clamp(1.4 + (rb - ra) * 0.45, 0.3, 4)));
  }
  const won = tie.w === 'club';
  const pens = tie.pens ? ((mineA ? tie.pens : [tie.pens[1], tie.pens[0]]) as [number, number]) : undefined;
  const out: CupOutcome = { won, pens, coins: 0, champion: false };
  if (!won) {
    cup.status = 'out';
  } else {
    out.coins = roundPay(cup.round);
    addCoins(out.coins);
    if (cup.round >= CUP_ROUNDS - 1) {
      cup.status = 'won';
      out.champion = true;
      const card = seriesCard(cup.div <= 2 ? 'icon' : randomSeries());
      addCard(card);
      saveProfile();
      out.card = card;
      const oppDef = cupTeam(mineA ? tie.b : tie.a);
      addTrophy({ kind: 'cup', div: cup.div, n: cup.edition, note: `${my}-${opp}${pens ? ` (${pens[0]}-${pens[1]} p)` : ''} · ${oppDef.name}` });
    } else {
      const ws = cup.rounds[cup.round].map((t) => t.w!);
      const next: CupTie[] = [];
      for (let i = 0; i < ws.length; i += 2) next.push({ a: ws[i], b: ws[i + 1] });
      cup.rounds.push(next);
      cup.round++;
    }
  }
  saveCup();
  return out;
}
