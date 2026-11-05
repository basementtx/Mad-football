/** Player cards: ratings, rarity tiers, random generation. */
import { pick, rand, randInt, clamp } from '../engine/math';

export type Pos = 'GK' | 'DEF' | 'MID' | 'FWD';
export type CardRarity = 'bronze' | 'silver' | 'gold' | 'hero' | 'legend';
export const STAT_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export interface CardLook {
  skin: string;
  hair: string;
  hairStyle: number;
  beard: boolean;
  /** face shape (0 = classic) */
  face?: number;
  /** eye style (0 = round) and iris colour */
  eyes?: number;
  eyeColor?: string;
}

export interface CardData {
  id: string;
  name: string;
  number: number;
  pos: Pos;
  stats: Stats;
  look: CardLook;
  /** created by the player in the player creator */
  custom?: boolean;
  /** special card series (own design, boosted ratings) */
  series?: SeriesId;
}

// ------------------------------------------------------------------ special series

export type SeriesId = 'totw' | 'fire' | 'future' | 'icon';
export interface SeriesDef {
  id: SeriesId;
  /** overall range of the series */
  range: [number, number];
  name: { tr: string; en: string };
  short: string;
  desc: { tr: string; en: string };
}
export const SERIES: SeriesDef[] = [
  { id: 'future', range: [78, 86], short: 'FS', name: { tr: 'Geleceğin Yıldızları', en: 'Future Stars' }, desc: { tr: 'Genç ve parlak yetenekler.', en: 'Young, dazzling talents.' } },
  { id: 'totw', range: [82, 89], short: 'TOTW', name: { tr: 'Haftanın Takımı', en: 'Team of the Week' }, desc: { tr: 'Haftanın en iyileri, güçlendirilmiş.', en: 'The best of the week, boosted.' } },
  { id: 'fire', range: [84, 91], short: '🔥', name: { tr: 'Formda', en: 'On Fire' }, desc: { tr: 'Alev alev formda oyuncular.', en: 'Players in red-hot form.' } },
  { id: 'icon', range: [90, 96], short: 'ICON', name: { tr: 'İkonlar', en: 'Icons' }, desc: { tr: 'Oyunun efsaneleri.', en: 'Legends of the game.' } },
];
export const seriesDef = (id?: SeriesId) => SERIES.find((s) => s.id === id);

/** fictional legends for the Icon series */
const ICON_NAMES = ['Ronaldão Pixel', 'Zico Thunder', 'Kaiser Brandt', 'El Mago Ruiz', 'Hakan Fırtına', 'Paolo Muro', 'Johan Kruis', 'Lev Yashkin', 'Didi Sombra', 'Gerd Bomber', 'Bobby Charm', 'Ferenc Puskar', 'Eusébio Raio', 'Metin Usta', 'Garrincha Voa', 'Lothar Stahl'];

/** A card of a special series: a normal card lifted into the series' rating band. */
export function seriesCard(id: SeriesId, pos?: Pos): CardData {
  const def = seriesDef(id)!;
  const c = randomCard('gold', pos);
  const target = randInt(def.range[0], def.range[1]);
  for (let i = 0; i < 60; i++) {
    const o = overall(c);
    if (o >= target) break;
    for (const k of STAT_KEYS) c.stats[k] = clamp(c.stats[k] + 1, 20, 99);
  }
  c.series = id;
  if (id === 'icon') c.name = pick(ICON_NAMES);
  return c;
}

/** A random series, rarer the stronger it is. */
export function randomSeries(): SeriesId {
  const r = Math.random();
  return r < 0.4 ? 'future' : r < 0.72 ? 'totw' : r < 0.92 ? 'fire' : 'icon';
}

export const SKINS = ['#f3d2b5', '#e5b48f', '#c98d63', '#a8714a', '#7a4d30', '#5a3722'];
export const HAIRS = ['#1a1310', '#3b2416', '#6b3e1f', '#c98a3a', '#e8d27a', '#d8d8d8', '#b02a1a', '#20263a'];
/** unlockable dyes (shop) */
export const HAIRS_EXTRA = ['#f4f1e8', '#ff7a1a', '#ff3fa4', '#8a5cff', '#3f8cff', '#21c48a'];
export const HAIR_STYLES = 12;
export const FACES = 5;
export const EYE_STYLES = 7;
export const EYE_COLORS = ['#5a3e2e', '#2a1e18', '#8a6a2a', '#3f8a4a', '#3f7ad8', '#7a8aa0', '#c88a1a'];
/** unlockable (shop) */
export const EYE_COLORS_EXTRA = ['#8a4ad8', '#d83a3a', '#ffd23f', '#5fe8ff'];

const FIRST = ['Leo', 'Kai', 'Emre', 'Bruno', 'Mateo', 'Yusuf', 'Niko', 'Arda', 'Luca', 'Omar', 'Theo', 'Ivan', 'Kenji', 'Diego', 'Malik', 'Sami', 'Hugo', 'Rafa', 'Can', 'Felix', 'Jonas', 'Tariq', 'Enzo', 'Bora'];
const LAST = ['Storm', 'Kaya', 'Silva', 'Novak', 'Okafor', 'Duran', 'Varga', 'Yilmaz', 'Costa', 'Moreau', 'Petrov', 'Tanaka', 'Reyes', 'Bakker', 'Rossi', 'Demir', 'Mensah', 'Kowal', 'Lund', 'Aziz', 'Blitz', 'Crash', 'Hammer', 'Vortex'];

const WEIGHTS: Record<Pos, Stats> = {
  GK: { pac: 0.08, sho: 0.02, pas: 0.12, dri: 0.08, def: 0.4, phy: 0.3 },
  DEF: { pac: 0.15, sho: 0.05, pas: 0.1, dri: 0.05, def: 0.4, phy: 0.25 },
  MID: { pac: 0.12, sho: 0.15, pas: 0.3, dri: 0.25, def: 0.08, phy: 0.1 },
  FWD: { pac: 0.25, sho: 0.35, pas: 0.08, dri: 0.2, def: 0.02, phy: 0.1 },
};

export function overall(c: { pos: Pos; stats: Stats }) {
  const w = WEIGHTS[c.pos];
  let s = 0;
  for (const k of STAT_KEYS) s += c.stats[k] * w[k];
  return Math.round(clamp(s, 1, 99));
}

export function rarityOf(c: CardData): CardRarity {
  const o = overall(c);
  if (o >= 91) return 'legend';
  if (o >= 85) return 'hero';
  if (o >= 75) return 'gold';
  if (o >= 65) return 'silver';
  return 'bronze';
}

export const RARITY_RANGE: Record<CardRarity, [number, number]> = {
  bronze: [52, 64],
  silver: [65, 74],
  gold: [75, 84],
  hero: [85, 90],
  legend: [91, 95],
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function randomLook(): CardLook {
  return { skin: pick(SKINS), hair: pick(HAIRS), hairStyle: randInt(0, HAIR_STYLES - 1), beard: Math.random() < 0.25, face: randInt(0, FACES - 1), eyes: randInt(0, EYE_STYLES - 1), eyeColor: pick(EYE_COLORS) };
}

/** Generate a card whose overall lands in the rarity band. */
export function randomCard(rarity: CardRarity, pos?: Pos): CardData {
  const p = pos ?? pick<Pos>(['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD']);
  const [lo, hi] = RARITY_RANGE[rarity];
  const target = randInt(lo, hi);
  const w = WEIGHTS[p];
  const stats = {} as Stats;
  for (const k of STAT_KEYS) {
    // important stats go above target, others below
    const bias = (w[k] - 1 / 6) * 90;
    stats[k] = Math.round(clamp(target + bias + rand(-6, 6), 25, 99));
  }
  // nudge to the target overall
  for (let i = 0; i < 20; i++) {
    const o = overall({ pos: p, stats });
    if (o === target) break;
    const d = Math.sign(target - o);
    for (const k of STAT_KEYS) stats[k] = clamp(stats[k] + d, 20, 99);
  }
  return {
    id: uid(),
    name: `${pick(FIRST)} ${pick(LAST)}`,
    number: p === 'GK' ? pick([1, 12, 23]) : randInt(2, 30),
    pos: p,
    stats,
    look: randomLook(),
  };
}

/** Short display name (surname) */
export const shortName = (c: CardData) => {
  const parts = c.name.trim().split(/\s+/);
  return parts[parts.length - 1].slice(0, 12);
};

/** Card stats -> in-game attributes 0..1 */
export function attrsOf(c: CardData) {
  const s = c.stats;
  return {
    pace: s.pac / 100,
    power: (s.sho * 0.7 + s.phy * 0.3) / 100,
    tackle: (s.def * 0.7 + s.phy * 0.3) / 100,
    skill: (s.dri * 0.6 + s.pas * 0.4) / 100,
  };
}
