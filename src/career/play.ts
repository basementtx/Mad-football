/** Bridge between the career and the match engine. */
import type { MatchConfig, Match } from '../game/match';
import type { CardData } from '../meta/cards';
import type { Career } from './types';
import { squadOf, bestFive, teamDefOf, npcCard, clubName, compName, roundName, lambdaFor, teamStrength, isNat } from './world';
import { myCard, has, Line } from './me';
import { matchInfo, oppDifficulty } from './season';
import { npcStats, lookOf, poisson, L2 } from './util';
import { profile, loadoutTiers } from '../meta/profile';
import { pick } from '../engine/math';
import { NATIONS } from './data';

function kidCard(id: string, pos: CardData['pos'], ovr: number): CardData {
  const nat = pick(NATIONS).code;
  const n = NATIONS.find((x) => x.code === nat)!;
  return { id, name: `${pick(n.first)} ${pick(n.last)}`, number: pos === 'GK' ? 1 : 2 + Math.floor(Math.random() * 28), pos, stats: npcStats(id, pos, ovr), look: lookOf(id, nat) };
}

/** Five cards for a side, with the user forced into their slot. */
function lineup(c: Career, team: string, withMe: boolean): CardData[] {
  if (team === 'trialA' || team === 'trialB') {
    const base = team === 'trialA' ? 56 : 58;
    const cards = (['GK', 'DEF', 'DEF', 'MID', 'FWD'] as const).map((p, i) => kidCard(team + i + Math.random(), p, base + Math.floor(Math.random() * 6)));
    if (withMe) cards[c.me.pos === 'DEF' ? 1 : c.me.pos === 'MID' ? 3 : 4] = myCard(c);
    return cards;
  }
  const sq = squadOf(c, team).filter((p) => p.id !== 'me');
  const five = bestFive(sq);
  const cards = five.map((e, i) => (e && c.npcs[e.id] ? npcCard(c.npcs[e.id]) : kidCard(team + i, (['GK', 'DEF', 'DEF', 'MID', 'FWD'] as const)[i], 60)));
  if (withMe) {
    // the user takes the slot of their position (the weaker defender for DEF)
    let slot = c.me.pos === 'MID' ? 3 : c.me.pos === 'FWD' ? 4 : 2;
    if (c.me.pos === 'DEF' && five[1] && five[2] && five[1].ovr < five[2].ovr) slot = 1;
    cards[slot] = myCard(c);
  }
  return cards;
}

export interface CareerMatchSetup {
  cfg: MatchConfig;
  sub: boolean;
  startScore: [number, number] | null;
}

/** Match config for this week's fixture (or the trial). */
export function careerMatchConfig(c: Career, trial = false): CareerMatchSetup {
  const loadout = { goalfx: profile.equipped.goalfx, trail: profile.equipped.trail, powers: profile.loadout, tiers: loadoutTiers(), boots: profile.equipped.boots };
  if (trial) {
    return {
      cfg: {
        home: teamDefOf(c, 'trialA'), away: teamDefOf(c, 'trialB'), size: 5, duration: c.duration, difficulty: 'normal', demo: false,
        homeCards: lineup(c, 'trialA', true), awayCards: lineup(c, 'trialB', false), starId: 'me', lockStar: true, starTrust: 0.35,
        starPerks: c.me.perks, title: L2('ACADEMY TRIAL', 'ALTYAPI DENEMESİ'), homeDifficulty: 'normal', loadout,
      },
      sub: false, startScore: null,
    };
  }
  const info = matchInfo(c)!;
  const sub = c.ws.sel === 'sub';
  let startScore: [number, number] | null = null;
  if (sub) {
    const sa = teamStrength(c, info.team), sb = teamStrength(c, info.opp);
    startScore = [poisson(lambdaFor(sa, sb, info.home && !isNat(info.team)) * 0.6), poisson(lambdaFor(sb, sa, false) * 0.6)];
  }
  const trust = Math.min(0.9, (c.me.rel.mates / 100) * 0.6 + (c.me.rep / 100) * 0.3 + (has(c, 'leader') ? 0.15 : 0));
  const comp = compName(c, info.f.comp);
  return {
    cfg: {
      home: teamDefOf(c, info.team), away: teamDefOf(c, info.opp), size: 5, duration: Math.round(c.duration * (sub ? 0.4 : 1)),
      difficulty: oppDifficulty(c, info.team, info.opp), homeDifficulty: c.difficulty, demo: false,
      homeCards: lineup(c, info.team, true), awayCards: lineup(c, info.opp, false), starId: 'me', lockStar: true, starTrust: trust,
      starPerks: c.me.perks, startScore: startScore ?? undefined,
      title: sub ? `${L2("SUB ON AT 60'", "60' OYUNA GİRİŞ")} · ${roundName(info.f.round).toUpperCase()}` : `${comp.toUpperCase()} · ${roundName(info.f.round).toUpperCase()}`, loadout,
    },
    sub, startScore,
  };
}

/** Training drill: you against a keeper for the length of the clock. */
export function drillConfig(c: Career, seconds = 45): MatchConfig {
  const loadout = { goalfx: profile.equipped.goalfx, trail: profile.equipped.trail, powers: profile.loadout, tiers: loadoutTiers(), boots: profile.equipped.boots };
  const team = c.contract?.club ?? 'trialA';
  const opp = Object.values(c.clubs).find((k) => k.id !== team)!.id;
  return {
    home: teamDefOf(c, team), away: teamDefOf(c, opp), size: 4, duration: seconds, difficulty: c.difficulty, demo: false,
    homeCards: [kidCard('dgk', 'GK', 60), myCard(c), kidCard('d2', 'MID', 60), kidCard('d3', 'FWD', 60)], starId: 'me', lockStar: true,
    starPerks: c.me.perks, training: 'keeper', drill: true, loadout,
  };
}

export function drillGrade(goals: number): { mult: number; grade: string } {
  if (goals >= 8) return { mult: 1.6, grade: 'S' };
  if (goals >= 6) return { mult: 1.35, grade: 'A' };
  if (goals >= 4) return { mult: 1.1, grade: 'B' };
  if (goals >= 2) return { mult: 0.9, grade: 'C' };
  return { mult: 0.7, grade: 'D' };
}

/** Read the star's numbers off a finished match. */
export function lineFromMatch(_c: Career, m: Match, sub: boolean, startScore: [number, number] | null, big: boolean): Line {
  const s = m.star!;
  const [a, b] = m.teams;
  void startScore;
  return {
    goals: s.goals, assists: s.assists, shots: s.shots, onTarget: s.onTarget, passOk: s.passOk, steals: s.steals, knockdowns: s.knockdowns, lost: s.lost, downs: s.downs,
    gf: a.score, ga: b.score, sub, big,
  };
}

/** Live rating shown during a career match. */
export function liveRating(_c: Career, m: Match, sub: boolean, big: boolean) {
  const s = m.star;
  if (!s) return 6;
  const [a, b] = m.teams;
  const line: Line = { goals: s.goals, assists: s.assists, shots: s.shots, onTarget: s.onTarget, passOk: s.passOk, steals: s.steals, knockdowns: s.knockdowns, lost: s.lost, downs: s.downs, gf: a.score, ga: b.score, sub, big };
  return line;
}

export { clubName };
