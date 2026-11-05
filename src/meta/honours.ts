/**
 * Club honours: the trophy cabinet, all-time player stats for club matches
 * (for the legends wall) and club records.
 */
export type TrophyKind = 'league' | 'promotion' | 'cup';

export interface Trophy {
  kind: TrophyKind;
  /** league division (1 top .. 5) */
  div: number;
  /** league season or cup edition */
  n: number;
  at: number;
  /** final / last opponent and score line, for the plaque */
  note?: string;
}

export interface CardRecord {
  name: string;
  pos: string;
  apps: number;
  goals: number;
  assists: number;
  motm: number;
  /** look + series, so a legend that has left the club can still be drawn */
  look?: unknown;
  series?: string;
  ovr: number;
}

export interface Honours {
  v: 1;
  trophies: Trophy[];
  cards: Record<string, CardRecord>;
  records: {
    biggestWin: { gf: number; ga: number; opp: string; at: number } | null;
    mostGoalsMatch: { goals: number; name: string; opp: string; at: number } | null;
    unbeaten: number;
    bestUnbeaten: number;
    matches: number;
  };
}

const KEY = 'mf.honours';

function load(): Honours {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) } as Honours;
  } catch {
    /* ignore */
  }
  return fresh();
}
function fresh(): Honours {
  return { v: 1, trophies: [], cards: {}, records: { biggestWin: null, mostGoalsMatch: null, unbeaten: 0, bestUnbeaten: 0, matches: 0 } };
}

export const honours: Honours = load();

export function saveHonours() {
  try {
    localStorage.setItem(KEY, JSON.stringify(honours));
  } catch {
    /* ignore */
  }
}

export function addTrophy(t: Omit<Trophy, 'at'>) {
  honours.trophies.push({ ...t, at: Date.now() });
  saveHonours();
}

export interface MatchLine {
  cardId: string;
  name: string;
  pos: string;
  ovr: number;
  look?: unknown;
  series?: string;
  goals: number;
  assists: number;
  motm: boolean;
}

/** After a club match: add every starter's line to his all-time record and update club records. */
export function recordClubMatch(lines: MatchLine[], gf: number, ga: number, opp: string) {
  for (const l of lines) {
    const r = (honours.cards[l.cardId] ??= { name: l.name, pos: l.pos, apps: 0, goals: 0, assists: 0, motm: 0, ovr: l.ovr });
    r.name = l.name;
    r.pos = l.pos;
    r.ovr = l.ovr;
    r.look = l.look;
    r.series = l.series;
    r.apps++;
    r.goals += l.goals;
    r.assists += l.assists;
    if (l.motm) r.motm++;
    const R = honours.records;
    if (!R.mostGoalsMatch || l.goals > R.mostGoalsMatch.goals) if (l.goals >= 2) R.mostGoalsMatch = { goals: l.goals, name: l.name, opp, at: Date.now() };
  }
  const R = honours.records;
  R.matches++;
  if (gf > ga && (!R.biggestWin || gf - ga > R.biggestWin.gf - R.biggestWin.ga || (gf - ga === R.biggestWin.gf - R.biggestWin.ga && gf > R.biggestWin.gf))) {
    R.biggestWin = { gf, ga, opp, at: Date.now() };
  }
  R.unbeaten = gf >= ga ? R.unbeaten + 1 : 0;
  R.bestUnbeaten = Math.max(R.bestUnbeaten, R.unbeaten);
  saveHonours();
}

/** Legend score: what makes a club legend (goals, assists, games, awards). */
export const legendScore = (r: CardRecord) => r.goals * 3 + r.assists * 2 + r.apps + r.motm * 4;
