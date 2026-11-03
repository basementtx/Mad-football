/**
 * League mode: 5 divisions of 8 clubs. A season is a round robin of 7 match days.
 * After the last match day the top 2 go up and the bottom 2 go down.
 */
import type { TeamDef, KitPattern } from '../game/teams';
import { TEAMS } from '../game/teams';
import type { Difficulty } from '../game/entities';
import { ICON_IDS, CREST_SHAPES } from '../pixel/crest';
import { clamp, pick, rand } from '../engine/math';
import { clubTeamDef, clubOverall, addCoins } from './profile';

export const DIVISIONS = 5; // 5 = lowest, 1 = top
export const TEAMS_PER_LEAGUE = 8;
export const ROUNDS = TEAMS_PER_LEAGUE - 1;
export const PROMOTE = 2;
export const RELEGATE = 2;
export const DIV_DIFF: Record<number, Difficulty> = { 5: 'easy', 4: 'normal', 3: 'hard', 2: 'insane', 1: 'legend' };
const DIV_RATING: Record<number, [number, number]> = { 5: [1.4, 2.6], 4: [2.1, 3.3], 3: [2.8, 4.0], 2: [3.5, 4.6], 1: [4.1, 5.0] };
/** season-end coin rewards by finishing position (1st..8th), scaled by division */
const POS_REWARD = [700, 500, 380, 300, 240, 200, 160, 120];
const DIV_MULT: Record<number, number> = { 5: 1, 4: 1.3, 3: 1.7, 2: 2.2, 1: 3 };

export interface Row {
  id: string;
  p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number;
  form: string[];
}

export interface Result { home: string; away: string; hg: number; ag: number }

export interface League {
  v: number;
  div: number;
  season: number;
  round: number;
  teams: TeamDef[]; // AI clubs (the user's club has id 'club' and is built live)
  table: Row[];
  fixtures: [string, string][][];
  results: Result[][];
  history: { season: number; div: number; pos: number; outcome: Outcome }[];
  pending: SeasonEnd | null;
}

export type Outcome = 'promoted' | 'relegated' | 'stayed' | 'champions';
export interface SeasonEnd { season: number; div: number; pos: number; outcome: Outcome; coins: number }

const KEY = 'mf.league';
const COLORS = ['#e23a2e', '#ff7a1a', '#ffd23f', '#b6ff3b', '#21a85a', '#14b8a6', '#7fd3ff', '#2f7bff', '#13215e', '#6b3fd6', '#ff2fa0', '#ffffff', '#c8d0e0', '#6c7480', '#1b1b1f', '#7a3b12'];
const PREFIX = ['Rocket', 'Iron', 'Neon', 'Shadow', 'Pixel', 'Storm', 'Blaze', 'Frost', 'Wild', 'Golden', 'Rebel', 'Steel', 'Cosmic', 'Savage', 'Turbo', 'Venom', 'Atomic', 'Crimson', 'Phantom', 'Lunar', 'Granite', 'Viking', 'Dragon', 'Cobalt'];
const SUFFIX = ['FC', 'United', 'Rovers', 'City', 'Athletic', 'Wanderers', 'Dynamo', 'Sporting', 'Rangers', 'Albion'];
const SURN = ['Storm', 'Kaya', 'Silva', 'Novak', 'Okafor', 'Duran', 'Varga', 'Yilmaz', 'Costa', 'Moreau', 'Petrov', 'Tanaka', 'Reyes', 'Bakker', 'Rossi', 'Demir', 'Mensah', 'Kowal', 'Lund', 'Aziz'];
const PATTERNS: KitPattern[] = ['solid', 'stripes', 'hoops', 'half', 'sash', 'chevron'];

function makeClub(div: number, used: Set<string>): TeamDef {
  let prefix = pick(PREFIX);
  while (used.has(prefix)) prefix = pick(PREFIX);
  used.add(prefix);
  const primary = pick(COLORS);
  let secondary = pick(COLORS);
  while (secondary === primary) secondary = pick(COLORS);
  const [lo, hi] = DIV_RATING[div];
  const r = rand(lo, hi);
  const st = () => clamp(r + rand(-0.6, 0.6), 1, 5);
  return {
    id: 'ai_' + prefix.toLowerCase() + '_' + Math.floor(Math.random() * 1e4),
    name: `${prefix} ${pick(SUFFIX)}`,
    short: prefix.slice(0, 3).toUpperCase(),
    primary, secondary,
    shorts: Math.random() < 0.5 ? secondary : primary,
    socks: primary,
    gk: ['#ffd23f', '#ffcc2a', '#b6ff3b'].includes(primary) ? '#3fe0a0' : '#ffcc2a',
    pattern: pick(PATTERNS),
    pace: st(), power: st(), tackle: st(), skill: st(),
    crest: { shape: Math.floor(Math.random() * CREST_SHAPES), icon: pick(ICON_IDS) },
    names: [...SURN].sort(() => Math.random() - 0.5).slice(0, 9),
  };
}

/** Circle-method round robin. */
function schedule(ids: string[]): [string, string][][] {
  const n = ids.length;
  const arr = [...ids];
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}

function newSeason(div: number, season: number, history: League['history']): League {
  const used = new Set<string>();
  const teams = Array.from({ length: TEAMS_PER_LEAGUE - 1 }, () => makeClub(div, used));
  const ids = ['club', ...teams.map((t) => t.id)].sort(() => Math.random() - 0.5);
  return {
    v: 1,
    div,
    season,
    round: 0,
    teams,
    table: ids.map((id) => ({ id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] })),
    fixtures: schedule(ids),
    results: [],
    history,
    pending: null,
  };
}

function load(): League {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as League;
  } catch {
    /* ignore */
  }
  return newSeason(DIVISIONS, 1, []);
}

export let league: League = load();

export function saveLeague() {
  try {
    localStorage.setItem(KEY, JSON.stringify(league));
  } catch {
    /* ignore */
  }
}

export function teamById(id: string): TeamDef {
  if (id === 'club') return clubTeamDef() ?? TEAMS[0];
  return league.teams.find((t) => t.id === id) ?? TEAMS[0];
}

export function ratingOf(id: string) {
  if (id === 'club') return clamp((clubOverall() - 40) / 11, 1, 5);
  const t = teamById(id);
  return (t.pace + t.power + t.tackle + t.skill) / 4;
}

export function sortedTable(): Row[] {
  return [...league.table].sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.id.localeCompare(b.id));
}

export function positionOf(id = 'club') {
  return sortedTable().findIndex((r) => r.id === id) + 1;
}

export function nextFixture(): { opp: string; home: boolean } | null {
  if (league.round >= ROUNDS) return null;
  const pair = league.fixtures[league.round].find((p) => p.includes('club'))!;
  return { opp: pair[0] === 'club' ? pair[1] : pair[0], home: pair[0] === 'club' };
}

export const leagueDifficulty = (): Difficulty => DIV_DIFF[league.div];

function poisson(l: number) {
  const L = Math.exp(-l);
  let k = 0, p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L && k < 12);
  return k - 1;
}

function simulate(a: string, b: string): [number, number] {
  const ra = ratingOf(a), rb = ratingOf(b);
  const la = clamp(1.5 + (ra - rb) * 0.5, 0.3, 4);
  const lb = clamp(1.5 + (rb - ra) * 0.5, 0.3, 4);
  return [poisson(la), poisson(lb)];
}

function apply(id: string, gf: number, ga: number) {
  const r = league.table.find((x) => x.id === id)!;
  r.p++;
  r.gf += gf;
  r.ga += ga;
  const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  if (res === 'W') { r.w++; r.pts += 3; }
  else if (res === 'D') { r.d++; r.pts += 1; }
  else r.l++;
  r.form = [...r.form, res].slice(-5);
}

/** Record the user's result for the current match day and simulate the rest. */
export function recordUserResult(myGoals: number, oppGoals: number): void {
  const fx = league.fixtures[league.round];
  const results: Result[] = [];
  for (const [h, a] of fx) {
    let hg: number, ag: number;
    if (h === 'club') [hg, ag] = [myGoals, oppGoals];
    else if (a === 'club') [hg, ag] = [oppGoals, myGoals];
    else [hg, ag] = simulate(h, a);
    apply(h, hg, ag);
    apply(a, ag, hg);
    results.push({ home: h, away: a, hg, ag });
  }
  league.results[league.round] = results;
  league.round++;
  if (league.round >= ROUNDS) finishSeason();
  saveLeague();
}

function finishSeason() {
  const pos = positionOf('club');
  const div = league.div;
  let outcome: Outcome = 'stayed';
  if (pos === 1 && div === 1) outcome = 'champions';
  else if (pos <= PROMOTE && div > 1) outcome = 'promoted';
  else if (pos > TEAMS_PER_LEAGUE - RELEGATE && div < DIVISIONS) outcome = 'relegated';
  const coins = Math.round(POS_REWARD[pos - 1] * DIV_MULT[div]);
  addCoins(coins);
  league.history.push({ season: league.season, div, pos, outcome });
  league.pending = { season: league.season, div, pos, outcome, coins };
}

/** Start the next season after the season-end screen. */
export function startNextSeason() {
  const p = league.pending;
  if (!p) return;
  const div = p.outcome === 'promoted' ? p.div - 1 : p.outcome === 'relegated' ? p.div + 1 : p.div;
  league = newSeason(div, p.season + 1, league.history);
  saveLeague();
}

/** Zone of a table position: promotion / relegation / safe */
export function zoneOf(pos: number): 'up' | 'down' | '' {
  if (pos <= PROMOTE && league.div > 1) return 'up';
  if (pos > TEAMS_PER_LEAGUE - RELEGATE && league.div < DIVISIONS) return 'down';
  return '';
}
