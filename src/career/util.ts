/** Small helpers shared by the career modules. */
import { settings } from '../engine/storage';
import type { CardLook, Stats, StatKey } from '../meta/cards';
import { SKINS, HAIRS, HAIR_STYLES, FACES, EYE_STYLES, EYE_COLORS, STAT_KEYS, overall } from '../meta/cards';
import { clamp } from '../engine/math';
import type { NPos } from './types';

/** Bilingual text inline: L2('Goal', 'Gol'). */
export const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);
export const isTR = () => settings.lang === 'tr';
/** pick the right half of a [en, tr] pair */
export const LP = (p: [string, string] | readonly [string, string]) => (settings.lang === 'tr' ? p[1] : p[0]);

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 seeded random */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pickR = <T>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length)];

/** Deterministic look for an NPC from its id. */
export function lookOf(id: string, nat: string): CardLook {
  const r = rng(hash(id));
  // a light nation bias on skin tones keeps squads plausible but mixed
  const bias: Record<string, number> = { ng: 4, br: 2.6, jp: 0.6, ar: 1.2, pt: 1.6, fr: 2.2, en: 1.6, nl: 1.5, es: 1.4, it: 1.3, tr: 1.4, de: 1.1 };
  const b = bias[nat] ?? 1.5;
  const si = clamp(Math.floor(r() * 2.2 + (r() * b)), 0, SKINS.length - 1);
  return {
    skin: SKINS[si],
    hair: pickR(r, HAIRS.slice(0, si > 3 ? 3 : HAIRS.length)),
    hairStyle: Math.floor(r() * HAIR_STYLES),
    beard: r() < 0.3,
    face: Math.floor(r() * FACES),
    eyes: Math.floor(r() * EYE_STYLES),
    eyeColor: pickR(r, si > 2 ? EYE_COLORS.slice(0, 3) : EYE_COLORS),
  };
}

const W: Record<NPos, Stats> = {
  GK: { pac: -14, sho: -30, pas: -8, dri: -12, def: 10, phy: 6 },
  DEF: { pac: -2, sho: -16, pas: -5, dri: -10, def: 8, phy: 6 },
  MID: { pac: -2, sho: -2, pas: 6, dri: 5, def: -10, phy: -4 },
  FWD: { pac: 5, sho: 7, pas: -6, dri: 3, def: -26, phy: -2 },
};

/** Six card stats for an NPC that land on its overall. */
export function npcStats(id: string, pos: NPos, ovr: number): Stats {
  const r = rng(hash(id + 's'));
  const st = {} as Stats;
  for (const k of STAT_KEYS) st[k] = Math.round(clamp(ovr + W[pos][k] + (r() - 0.5) * 10, 20, 99));
  for (let i = 0; i < 25; i++) {
    const o = overall({ pos, stats: st });
    if (o === ovr) break;
    const d = Math.sign(ovr - o);
    for (const k of STAT_KEYS) st[k] = clamp(st[k] + d, 20, 99);
  }
  return st;
}

export function money(v: number) {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e6) return `${s}€${(a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2).replace(/\.0+$/, '')}M`;
  if (a >= 1e3) return `${s}€${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `${s}€${Math.round(a)}`;
}

export function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

export const statKeys: readonly StatKey[] = STAT_KEYS;

export function poisson(l: number) {
  const L = Math.exp(-l);
  let k = 0, p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L && k < 12);
  return k - 1;
}

export function weighted<T>(items: T[], w: (t: T) => number): T {
  let tot = 0;
  for (const it of items) tot += Math.max(0, w(it));
  let r = Math.random() * tot;
  for (const it of items) {
    r -= Math.max(0, w(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? String(v[k]) : `{${k}}`));
