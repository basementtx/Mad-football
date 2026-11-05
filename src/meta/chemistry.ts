/**
 * Team chemistry: each lineup player earns 0..3 chemistry points.
 *  +1 playing in their own position (a GK out of goal, or an outfielder in goal, gets 0 in total)
 *  +1 after 3 matches for the club, +2 after 10 (familiarity)
 * Team chemistry is the share of the maximum (0..100). In matches a player's
 * attributes are scaled by chemMul(points): low chemistry hurts, full chemistry helps a bit.
 */
import type { CardData } from './cards';
import { profile, saveProfile, lineupCards, SLOT_ROLES, LINEUP_SLOTS, slotRoles } from './profile';

export const FAM_STEPS = [3, 10];

export const familiarity = (id: string) => profile.fam[id] ?? 0;

export interface ChemInfo {
  points: number;
  posOk: boolean;
  /** familiarity points (0..2) */
  fam: number;
  wrongGK: boolean;
}

export function playerChem(c: CardData, slot: number, size = LINEUP_SLOTS): ChemInfo {
  const role = slotRoles(size)[slot] ?? SLOT_ROLES[slot] ?? 'MID';
  const wrongGK = (role === 'GK') !== (c.pos === 'GK');
  const posOk = c.pos === role;
  const games = familiarity(c.id);
  const fam = games >= FAM_STEPS[1] ? 2 : games >= FAM_STEPS[0] ? 1 : 0;
  const points = wrongGK ? 0 : (posOk ? 1 : 0) + fam;
  return { points, posOk, fam, wrongGK };
}

/** Attribute multiplier for a player's chemistry points. */
export const chemMul = (points: number) => [0.93, 0.965, 1, 1.04][Math.max(0, Math.min(3, points))];

/** 0..100 for the first `n` lineup slots. */
export function teamChem(n = LINEUP_SLOTS): number {
  const cards = lineupCards().slice(0, n);
  let sum = 0, cnt = 0;
  cards.forEach((c, i) => {
    if (!c) return;
    sum += playerChem(c, i).points;
    cnt++;
  });
  return cnt ? Math.round((sum / (cnt * 3)) * 100) : 0;
}

/** Multipliers per lineup slot (used to build the home team in a match). */
export function lineupChemMuls(size = LINEUP_SLOTS): number[] {
  return lineupCards().map((c, i) => (c ? chemMul(playerChem(c, i, size).points) : 1));
}

/** After a club match: the players who started get more used to each other. */
export function addFamiliarity(size: number) {
  for (const c of lineupCards().slice(0, size)) if (c) profile.fam[c.id] = familiarity(c.id) + 1;
  saveProfile();
}

export const chemColor = (v: number) => (v >= 80 ? '#5ff0a4' : v >= 50 ? '#ffe14d' : v >= 25 ? '#ff9a2e' : '#ff5a4a');
