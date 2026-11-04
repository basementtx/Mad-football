/**
 * The career world: clubs, squads, competitions, fixtures and the match simulator
 * used for every game the user does not play on the pitch.
 */
import type { Career, Club, Competition, Fixture, NPC, NPos, Row } from './types';
import { NATIONS, LEAGUE_NATIONS, nationBy, MANAGER_FIRST, MANAGER_LAST } from './data';
import { CLUB_SEEDS, STADIUM_WORDS } from './clubs';
import { clamp, gauss, pick, rand, randInt } from '../engine/math';
import type { TeamDef } from '../game/teams';
import { poisson, shuffle, weighted, LP, npcStats, lookOf } from './util';
import { overall } from '../meta/cards';
import type { CardData } from '../meta/cards';

export const SEASON_PLAN = ['P', 'L', 'L', 'E', 'L', 'C', 'L', 'E', 'L', 'I', 'L', 'E', 'L', 'C', 'L', 'L', 'L', 'E', 'L', 'C', 'L', 'I', 'L', 'L', 'L', 'C', 'L', 'L', 'E', 'L'];
/** last week of the club season */
export const LAST_WEEK = SEASON_PLAN.length - 1;
/** summer tournament weeks (even seasons) */
export const TOURNEY_WEEKS = [30, 31, 32, 33, 34];
/** the winter transfer window */
export const WINTER_WINDOW = [14, 15, 16];

const NAT_COLORS: Record<string, [string, string]> = {
  en: ['#ffffff', '#13215e'], es: ['#c60b1e', '#ffc400'], it: ['#2f7bff', '#ffffff'], tr: ['#e30a17', '#ffffff'], de: ['#ffffff', '#1a1a1a'],
  fr: ['#13215e', '#ffffff'], br: ['#ffdf00', '#009c3b'], ar: ['#74acdf', '#ffffff'], nl: ['#ff7a1a', '#ffffff'], pt: ['#8a1538', '#0e5c3a'],
  ng: ['#008751', '#ffffff'], jp: ['#13215e', '#ffffff'],
};

let idc = 0;
const usedNames = new Set<string>();
const nid = (p: string) => p + (++idc).toString(36) + Math.floor(Math.random() * 1296).toString(36);

// ------------------------------------------------------------------ players

export function makeNPC(nat: string, pos: NPos, ovr: number, age: number, club: string | null): NPC {
  const n = nationBy(nat);
  let name = `${pick(n.first)} ${pick(n.last)}`;
  for (let i = 0; i < 12 && usedNames.has(name); i++) name = `${pick(n.first)} ${pick(n.last)}`;
  usedNames.add(name);
  const pot = clamp(Math.round(ovr + Math.max(0, (24 - age)) * rand(1.2, 2.6) + rand(-1, 3)), ovr, 94);
  return {
    id: nid('p'),
    name,
    nat, pos, age, ovr: Math.round(clamp(ovr, 40, 93)), pot, club,
    num: pos === 'GK' ? pick([1, 13, 25]) : randInt(2, 33),
    s: { apps: 0, starts: 0, goals: 0, assists: 0, rsum: 0, motm: 0 },
    cg: 0, ca: 0,
  };
}

const SQUAD_POS: NPos[] = ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'GK'];

function clubLevel(rep: number) {
  return 49 + rep * 0.37;
}

function foreignNat(home: string) {
  if (Math.random() < 0.72) return home;
  const n = weighted(NATIONS.filter((x) => x.code !== home), (x) => (x.league ? 1 : 1.7));
  return n.code;
}

// ------------------------------------------------------------------ world generation

export function generateWorld(c: Career) {
  usedNames.clear();
  const clubs: Record<string, Club> = {};
  const npcs: Record<string, NPC> = {};
  for (const code of LEAGUE_NATIONS) {
    const seeds = CLUB_SEEDS[code] ?? [];
    const byShort = new Map<string, string>();
    seeds.forEach((sd, i) => {
      const id = nid('c');
      byShort.set(sd.short, id);
      const rep = Math.round(clamp(sd.rep + rand(-2, 2), 20, 97));
      clubs[id] = {
        id, name: sd.name, short: sd.short, nat: code, div: i < 10 ? 1 : 2, rep,
        primary: sd.p, secondary: sd.s, shorts: sd.shorts, pattern: sd.kit, crest: { ...sd.crest },
        stadium: `${sd.city} ${STADIUM_WORDS[(sd.short.charCodeAt(0) + sd.short.charCodeAt(2)) % STADIUM_WORDS.length]}`,
        nick: sd.nick, rival: null,
        manager: `${pick(MANAGER_FIRST)} ${pick(MANAGER_LAST)}`,
        squad: [],
        budget: Math.round(rep * rep * rep * 40),
        handle: sd.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/[^A-Za-z0-9]/g, '').slice(0, 15),
      };
      const lvl = clubLevel(rep);
      for (const pos of SQUAD_POS) {
        const age = randInt(18, 34);
        const ageMod = age < 21 ? -4 : age > 31 ? -2 : 0;
        const p = makeNPC(foreignNat(code), pos, lvl + gauss() * 4.5 + ageMod, age, id);
        npcs[p.id] = p;
        clubs[id].squad.push(p.id);
      }
    });
    // one shirt number per player in every squad
    for (const id of byShort.values()) {
      const used = new Set<number>();
      for (const pid of clubs[id].squad) {
        const p = npcs[pid];
        while (used.has(p.num)) p.num = p.pos === 'GK' ? p.num + 12 : (p.num % 40) + 1;
        used.add(p.num);
      }
    }
    // real derbies
    seeds.forEach((sd) => {
      if (sd.rival && byShort.has(sd.rival)) clubs[byShort.get(sd.short)!].rival = byShort.get(sd.rival)!;
    });
  }
  // every nation needs a national pool: players abroad (outside the simulated leagues)
  for (const n of NATIONS) {
    const have = Object.values(npcs).filter((p) => p.nat === n.code).length;
    const need = Math.max(0, 22 - have);
    for (let i = 0; i < need; i++) {
      const pos: NPos = i % 9 === 0 ? 'GK' : i % 3 === 0 ? 'DEF' : i % 3 === 1 ? 'MID' : 'FWD';
      const p = makeNPC(n.code, pos, 58 + n.str * 4 + gauss() * 6, randInt(19, 33), null);
      npcs[p.id] = p;
    }
  }
  c.clubs = clubs;
  c.npcs = npcs;
}

// ------------------------------------------------------------------ team helpers

export const isNat = (id: string) => id.startsWith('n:');
export const natCode = (id: string) => id.slice(2);

export function clubName(c: Career, id: string): string {
  if (id === 'trialA') return LP(['Trial XI', 'Deneme Karması']);
  if (id === 'trialB') return LP(['Scouts XI', 'Gözlemci Karması']);
  if (isNat(id)) {
    const n = nationBy(natCode(id));
    return LP([n.en, n.tr]);
  }
  return c.clubs[id]?.name ?? '?';
}

export function clubShort(c: Career, id: string): string {
  if (isNat(id)) return natCode(id).toUpperCase();
  if (id.startsWith('trial')) return id === 'trialA' ? 'TRI' : 'SCO';
  return c.clubs[id]?.short ?? '?';
}

export function teamDefOf(c: Career, id: string): TeamDef {
  if (isNat(id) || id.startsWith('trial')) {
    const code = isNat(id) ? natCode(id) : '';
    const [p, s] = NAT_COLORS[code] ?? (id === 'trialA' ? ['#3a4766', '#ffd23f'] : ['#c8d0e0', '#1b1b1f']);
    const st = 1 + (teamStrength(c, id) - 45) / 11;
    return {
      id, name: clubName(c, id), short: clubShort(c, id), primary: p, secondary: s, shorts: s, socks: p,
      gk: '#ffcc2a', pattern: isNat(id) ? 'solid' : 'hoops', pace: clamp(st, 1, 5), power: clamp(st, 1, 5), tackle: clamp(st, 1, 5), skill: clamp(st, 1, 5),
      crest: { shape: 1, icon: isNat(id) ? 'star' : 'ball' }, names: ['Kid', 'Rook', 'Ace'],
    };
  }
  const k = c.clubs[id];
  const st = clamp(1 + (teamStrength(c, id) - 45) / 11, 1, 5);
  return {
    id: k.id, name: k.name, short: k.short, primary: k.primary, secondary: k.secondary, shorts: k.shorts, socks: k.primary,
    gk: ['#ffd23f', '#ffcc2a', '#b6ff3b'].includes(k.primary) ? '#3fe0a0' : '#ffcc2a',
    pattern: k.pattern, pace: st, power: st, tackle: st, skill: st, crest: k.crest,
    names: k.squad.map((pid) => c.npcs[pid]?.name.split(' ').pop() ?? 'Player'),
  };
}

export interface SquadEntry {
  id: string;
  name: string;
  pos: NPos;
  ovr: number;
  age: number;
}

/** Players available to a team, including the user where they belong. */
export function squadOf(c: Career, id: string): SquadEntry[] {
  const out: SquadEntry[] = [];
  if (isNat(id)) {
    for (const pid of c.natSquad.length && natCode(id) === c.me.nat ? c.natSquad : natPool(c, natCode(id))) {
      const p = c.npcs[pid];
      if (p) out.push({ id: p.id, name: p.name, pos: p.pos, ovr: p.ovr, age: p.age });
    }
    if (natCode(id) === c.me.nat && c.me.capped && !c.me.injury) out.push(meEntry(c));
    return out;
  }
  if (id.startsWith('trial')) return out;
  const k = c.clubs[id];
  if (!k) return out;
  for (const pid of k.squad) {
    const p = c.npcs[pid];
    if (p) out.push({ id: p.id, name: p.name, pos: p.pos, ovr: p.ovr, age: p.age });
  }
  if (c.contract?.club === id && !c.me.injury) out.push(meEntry(c));
  return out;
}

export const myOvr = (c: Career) => overall({ pos: c.me.pos, stats: c.me.stats });

function meEntry(c: Career): SquadEntry {
  return { id: 'me', name: c.me.name, pos: c.me.pos, ovr: myOvr(c), age: c.me.age };
}

/** Best five: GK, DEF, DEF, MID, FWD (by overall). */
export function bestFive(sq: SquadEntry[], exclude?: Set<string>): (SquadEntry | null)[] {
  const used = new Set<string>(exclude ?? []);
  const slots: NPos[] = ['GK', 'DEF', 'DEF', 'MID', 'FWD'];
  const pickFor = (pos: NPos) => {
    const pool = sq.filter((p) => !used.has(p.id)).sort((a, b) => (b.pos === pos ? 100 : 0) + b.ovr - ((a.pos === pos ? 100 : 0) + a.ovr));
    const best = pool[0] ?? null;
    if (best) used.add(best.id);
    return best;
  };
  return slots.map(pickFor);
}

export function teamStrength(c: Career, id: string): number {
  if (id === 'trialA' || id === 'trialB') return 55;
  const sq = squadOf(c, id);
  if (!sq.length) return 60;
  const five = bestFive(sq).filter((p): p is SquadEntry => !!p);
  const avg = five.reduce((a, p) => a + p.ovr, 0) / Math.max(1, five.length);
  const depth = sq.length > 5 ? [...sq].sort((a, b) => b.ovr - a.ovr).slice(5, 8).reduce((a, p) => a + p.ovr, 0) / 3 : avg - 8;
  return avg * 0.88 + depth * 0.12;
}

export function natPool(c: Career, code: string): string[] {
  const all = Object.values(c.npcs).filter((p) => p.nat === code && p.age >= 18);
  const by = (pos: NPos, n: number) => all.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, n).map((p) => p.id);
  return [...by('GK', 1), ...by('DEF', 3), ...by('MID', 3), ...by('FWD', 2)];
}

/** Card data for an NPC (used to put real players on the pitch). */
export function npcCard(p: NPC): CardData {
  return { id: p.id, name: p.name, number: p.num, pos: p.pos, stats: npcStats(p.id, p.pos, p.ovr), look: lookOf(p.id, p.nat) };
}

// ------------------------------------------------------------------ competitions & fixtures

function roundRobin(ids: string[]): [string, string][][] {
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

const newRow = (id: string): Row => ({ id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] });

export function weeksOf(kind: string) {
  const out: number[] = [];
  SEASON_PLAN.forEach((k, i) => { if (k === kind) out.push(i); });
  return out;
}

/** Build every competition and the fixtures known at the start of a season. */
export function buildSeason(c: Career, prevTables?: Record<string, string[]>) {
  const comps: Competition[] = [];
  const fixtures: Fixture[] = [];
  const lw = weeksOf('L');
  for (const code of LEAGUE_NATIONS) {
    const n = nationBy(code);
    for (const div of [1, 2] as const) {
      const ids = Object.values(c.clubs).filter((k) => k.nat === code && k.div === div).map((k) => k.id);
      const comp: Competition = {
        id: `L${div}_${code}`, kind: 'league', nat: code, div,
        name: [n.leagueName![div - 1], n.leagueName![div - 1]], teams: ids, table: ids.map(newRow),
      };
      comps.push(comp);
      const first = roundRobin(shuffle([...ids]));
      const rounds = [...first, ...first.map((r) => r.map(([a, b]) => [b, a] as [string, string]))];
      rounds.forEach((pairs, ri) => {
        for (const [h, a] of pairs) fixtures.push({ id: `${comp.id}_${ri}_${h}`, comp: comp.id, week: lw[ri], round: 'MD' + (ri + 1), home: h, away: a });
      });
    }
    // domestic cup: the top division and six from the second
    const top = Object.values(c.clubs).filter((k) => k.nat === code && k.div === 1).map((k) => k.id);
    const second = shuffle(Object.values(c.clubs).filter((k) => k.nat === code && k.div === 2).map((k) => k.id)).slice(0, 6);
    const cupTeams = shuffle([...top, ...second]);
    const cup: Competition = { id: `C_${code}`, kind: 'cup', nat: code, name: [n.cupName!, n.cupName!], teams: cupTeams, alive: [...cupTeams], knockout: true };
    comps.push(cup);
    drawKnockout(c, cup, fixtures, 'R16', weeksOf('C')[0]);
  }
  // continental cup: the top two of every league
  const cont: string[] = [];
  for (const code of LEAGUE_NATIONS) {
    const prev = prevTables?.[`L1_${code}`];
    const top = prev ? prev.slice(0, 2) : Object.values(c.clubs).filter((k) => k.nat === code && k.div === 1).sort((a, b) => b.rep - a.rep).slice(0, 2).map((k) => k.id);
    cont.push(...top.filter((id) => c.clubs[id]?.div === 1));
  }
  while (cont.length < 8) {
    const extra = Object.values(c.clubs).filter((k) => k.div === 1 && !cont.includes(k.id)).sort((a, b) => b.rep - a.rep)[0];
    cont.push(extra.id);
  }
  const ew = weeksOf('E');
  const sh = shuffle([...cont]);
  const groups = [sh.slice(0, 4), sh.slice(4, 8)];
  const contComp: Competition = {
    id: 'E', kind: 'cont', name: ['Mad Champions Cup', 'Mad Şampiyonlar Kupası'], teams: cont, groups,
    groupTables: groups.map((g) => g.map(newRow)), alive: [...cont], knockout: false,
  };
  comps.push(contComp);
  groups.forEach((g, gi) => {
    roundRobin(g).forEach((pairs, ri) => {
      for (const [h, a] of pairs) fixtures.push({ id: `E_G${gi}_${ri}_${h}`, comp: 'E', week: ew[ri], round: 'G' + (gi + 1), home: h, away: a });
    });
  });
  // international friendlies
  const iw = weeksOf('I');
  const natIds = shuffle(NATIONS.map((n) => 'n:' + n.code));
  const intl: Competition = { id: 'I', kind: 'intl', name: ['International Friendlies', 'Hazırlık Maçları'], teams: natIds };
  comps.push(intl);
  iw.forEach((w, wi) => {
    const ids = shuffle([...natIds]);
    for (let i = 0; i + 1 < ids.length; i += 2) fixtures.push({ id: `I_${wi}_${ids[i]}`, comp: 'I', week: w, round: 'FR', home: ids[i], away: ids[i + 1] });
  });
  c.comps = comps;
  c.fixtures = fixtures;
}

/** Summer tournament (even seasons): eight nations, two groups, semis, final. */
export function buildTourney(c: Career) {
  const all = NATIONS.map((n) => n.code);
  const mine = c.me.nat;
  const ranked = all.map((code) => ({ code, s: nationBy(code).str + rand(-0.5, 0.5) })).sort((a, b) => b.s - a.s).map((x) => x.code);
  let teams = ranked.slice(0, 8);
  if (!teams.includes(mine) && Math.random() < 0.55) teams = [...teams.slice(0, 7), mine];
  const ids = shuffle(teams.map((x) => 'n:' + x));
  const groups = [ids.slice(0, 4), ids.slice(4, 8)];
  const comp: Competition = {
    id: 'T', kind: 'intl', name: ['Mad Nations Cup', 'Mad Uluslar Kupası'], teams: ids, groups,
    groupTables: groups.map((g) => g.map(newRow)), alive: [...ids], knockout: false,
  };
  c.comps = c.comps.filter((k) => k.id !== 'T');
  c.comps.push(comp);
  c.fixtures = c.fixtures.filter((f) => f.comp !== 'T');
  groups.forEach((g, gi) => {
    roundRobin(g).forEach((pairs, ri) => {
      for (const [h, a] of pairs) c.fixtures.push({ id: `T_G${gi}_${ri}_${h}`, comp: 'T', week: TOURNEY_WEEKS[ri], round: 'G' + (gi + 1), home: h, away: a });
    });
  });
}

export function drawKnockout(c: Career, comp: Competition, fixtures: Fixture[], round: string, week: number) {
  const alive = shuffle([...(comp.alive ?? [])]);
  for (let i = 0; i + 1 < alive.length; i += 2) {
    // the lower-division side hosts the tie
    let [h, a] = [alive[i], alive[i + 1]];
    const dh = c.clubs[h]?.div ?? 1, da = c.clubs[a]?.div ?? 1;
    if (da > dh) [h, a] = [a, h];
    fixtures.push({ id: `${comp.id}_${round}_${h}`, comp: comp.id, week, round, home: h, away: a });
  }
}

export function compById(c: Career, id: string) {
  return c.comps.find((k) => k.id === id);
}

export function compName(c: Career, id: string): string {
  const k = compById(c, id);
  if (k) return LP(k.name);
  if (id === 'trial') return LP(['Academy Trial', 'Altyapı Denemesi']);
  return id;
}

/** Short competition label for tight lists. */
export function compShort(c: Career, id: string): string {
  const k = compById(c, id);
  if (!k) return id;
  if (k.kind === 'league') return LP(['League', 'Lig']);
  if (k.kind === 'cup') return LP(['Cup', 'Kupa']);
  if (k.kind === 'cont') return 'MCC';
  if (k.id === 'T') return LP(['Nations', 'Uluslar']);
  return LP(['Friendly', 'Hazırlık']);
}

export function roundName(r: string): string {
  const m: Record<string, [string, string]> = {
    R16: ['Round of 16', 'Son 16'], QF: ['Quarter-final', 'Çeyrek Final'], SF: ['Semi-final', 'Yarı Final'], F: ['Final', 'Final'],
    G1: ['Group A', 'A Grubu'], G2: ['Group B', 'B Grubu'], FR: ['Friendly', 'Hazırlık'], TR: ['Trial', 'Deneme'],
  };
  if (m[r]) return LP(m[r]);
  if (r.startsWith('MD')) return LP(['Matchday ', 'Hafta ']) + r.slice(2);
  return r;
}

// ------------------------------------------------------------------ simulation

/** Expected goals for a side. */
export function lambdaFor(sa: number, sb: number, home: boolean) {
  return clamp(1.3 + (sa - sb) * 0.075 + (home ? 0.18 : 0), 0.18, 4.2);
}

export function simScore(c: Career, h: string, a: string): [number, number] {
  const sh = teamStrength(c, h), sa = teamStrength(c, a);
  const neutral = isNat(h);
  return [poisson(lambdaFor(sh, sa, !neutral)), poisson(lambdaFor(sa, sh, false))];
}

const GOAL_W: Record<NPos, number> = { GK: 0.01, DEF: 0.7, MID: 2.2, FWD: 5 };
const AST_W: Record<NPos, number> = { GK: 0.15, DEF: 1, MID: 3.6, FWD: 2 };

/**
 * Credit goals, assists and ratings of a simulated match to the NPCs on the pitch.
 * `skipMe`: the user's numbers are handled by the caller.
 */
export function creditNPCs(c: Career, team: string, gf: number, ga: number, out?: string[]) {
  const sq = squadOf(c, team).filter((p) => p.id !== 'me');
  const five = bestFive(sq).filter((p): p is SquadEntry => !!p);
  const sub = sq.filter((p) => !five.includes(p))[Math.floor(Math.random() * Math.max(1, sq.length - 5))];
  const onPitch = sub ? [...five, sub] : five;
  const res = gf > ga ? 0.35 : gf < ga ? -0.35 : 0;
  const goals = new Map<string, number>();
  const asts = new Map<string, number>();
  for (let g = 0; g < gf; g++) {
    if (!onPitch.length) break;
    const s = weighted(onPitch, (p) => GOAL_W[p.pos] * Math.pow(p.ovr / 70, 4));
    goals.set(s.id, (goals.get(s.id) ?? 0) + 1);
    out?.push(s.id);
    if (Math.random() < 0.72) {
      const pool = onPitch.filter((p) => p !== s);
      if (pool.length) {
        const a = weighted(pool, (p) => AST_W[p.pos] * Math.pow(p.ovr / 70, 3));
        asts.set(a.id, (asts.get(a.id) ?? 0) + 1);
      }
    }
  }
  let best: NPC | null = null, br = 0;
  for (const e of onPitch) {
    const p = c.npcs[e.id];
    if (!p) continue;
    const g = goals.get(e.id) ?? 0, as = asts.get(e.id) ?? 0;
    const r = clamp(6.4 + (p.ovr - 70) * 0.03 + res + g * 0.9 + as * 0.5 + gauss() * 0.55 - (e === sub ? 0.2 : 0) - (p.pos !== 'FWD' ? ga * 0.12 : 0), 4, 10);
    p.s.apps++;
    if (e !== sub) p.s.starts++;
    p.s.goals += g;
    p.s.assists += as;
    p.cg += g;
    p.ca += as;
    p.s.rsum += r;
    if (r > br) { br = r; best = p; }
  }
  if (best) best.s.motm++;
  return { goals, asts };
}

export function applyRow(table: Row[], id: string, gf: number, ga: number) {
  const r = table.find((x) => x.id === id);
  if (!r) return;
  r.p++;
  r.gf += gf;
  r.ga += ga;
  const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  if (res === 'W') { r.w++; r.pts += 3; }
  else if (res === 'D') { r.d++; r.pts += 1; }
  else r.l++;
  r.form = [...r.form, res].slice(-5);
}

export function sortTable(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.id.localeCompare(b.id));
}

/** Penalty shoot-out simulation; returns the winner. */
export function simPens(c: Career, h: string, a: string): [string, number, number] {
  const sh = teamStrength(c, h), sa = teamStrength(c, a);
  let ph = 0, pa = 0;
  for (let i = 0; i < 5; i++) {
    if (Math.random() < 0.74 + (sh - sa) * 0.004) ph++;
    if (Math.random() < 0.74 + (sa - sh) * 0.004) pa++;
  }
  while (ph === pa) {
    if (Math.random() < 0.72) ph++;
    if (Math.random() < 0.72) pa++;
  }
  return [ph > pa ? h : a, ph, pa];
}

/** Record a finished fixture in tables (league / groups) and knockout state. */
export function recordFixture(c: Career, f: Fixture) {
  const comp = compById(c, f.comp);
  if (!comp || f.hg === undefined || f.ag === undefined) return;
  f.played = true;
  if (comp.kind === 'league' && comp.table) {
    applyRow(comp.table, f.home, f.hg, f.ag);
    applyRow(comp.table, f.away, f.ag, f.hg);
  } else if (f.round.startsWith('G') && comp.groupTables) {
    const gi = Number(f.round.slice(1)) - 1;
    applyRow(comp.groupTables[gi], f.home, f.hg, f.ag);
    applyRow(comp.groupTables[gi], f.away, f.ag, f.hg);
  } else if (['R16', 'QF', 'SF', 'F'].includes(f.round)) {
    if (f.hg === f.ag && !f.pw) f.pw = simPens(c, f.home, f.away)[0];
    const winner = f.hg > f.ag ? f.home : f.ag > f.hg ? f.away : f.pw!;
    const loser = winner === f.home ? f.away : f.home;
    comp.alive = (comp.alive ?? []).filter((x) => x !== loser);
    if (f.round === 'F') comp.winner = winner;
  }
}

/** After a cup / group week: make the next round's fixtures. */
export function progressKnockouts(c: Career, week: number) {
  for (const comp of c.comps) {
    const fx = c.fixtures.filter((f) => f.comp === comp.id);
    if (!fx.length || fx.some((f) => f.week <= week && !f.played)) continue;
    if (fx.some((f) => f.week > week && !f.played)) continue;
    if (comp.winner) continue;
    if (comp.kind === 'cup') {
      const order = ['R16', 'QF', 'SF', 'F'];
      const last = order.filter((r) => fx.some((f) => f.round === r)).pop()!;
      const next = order[order.indexOf(last) + 1];
      if (!next) continue;
      const cw = weeksOf('C');
      drawKnockout(c, comp, c.fixtures, next, cw[order.indexOf(next)]);
    } else if (comp.groups && comp.groupTables) {
      const groupDone = fx.filter((f) => f.round.startsWith('G')).every((f) => f.played);
      const hasSF = fx.some((f) => f.round === 'SF');
      const hasF = fx.some((f) => f.round === 'F');
      const weeks = comp.id === 'T' ? TOURNEY_WEEKS : weeksOf('E');
      if (groupDone && !hasSF) {
        const [ga, gb] = comp.groupTables.map(sortTable);
        comp.alive = [ga[0].id, ga[1].id, gb[0].id, gb[1].id];
        c.fixtures.push({ id: `${comp.id}_SF_a`, comp: comp.id, week: weeks[3], round: 'SF', home: ga[0].id, away: gb[1].id });
        c.fixtures.push({ id: `${comp.id}_SF_b`, comp: comp.id, week: weeks[3], round: 'SF', home: gb[0].id, away: ga[1].id });
      } else if (hasSF && !hasF) {
        const al = comp.alive ?? [];
        if (al.length === 2) c.fixtures.push({ id: `${comp.id}_F`, comp: comp.id, week: weeks[4], round: 'F', home: al[0], away: al[1] });
      }
    }
  }
}

export function fixtureFor(c: Career, team: string, week: number) {
  return c.fixtures.find((f) => f.week === week && (f.home === team || f.away === team));
}

export const overallOf = overall;
