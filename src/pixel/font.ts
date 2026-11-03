/**
 * Hand-made 5x7 bitmap font with Turkish glyphs. Text is rasterized into cached
 * canvases (with optional outline / two-tone fill) and blitted at integer coords,
 * so it stays perfectly crisp on the low-res pixel framebuffer.
 */
import { settings } from '../engine/storage';

const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  ';': ['..', '..', '.#', '..', '..', '.#', '#.'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '.....'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  '•': ['..', '..', '..', '##', '##', '..', '..'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '▶': ['#...', '##..', '###.', '####', '###.', '##..', '#...'],
  '◀': ['...#', '..##', '.###', '####', '.###', '..##', '...#'],
  '★': ['..#..', '..#..', '#####', '.###.', '.###.', '##.##', '#...#'],
  '♥': ['.....', '##.##', '#####', '#####', '.###.', '..#..', '.....'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '=': ['....', '....', '####', '....', '####', '....', '....'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};

// Accented letters: base glyph + extra pixels (x, y) where y<0 is above, y>6 below.
const ACC: Record<string, [string, [number, number][]]> = {
  Ç: ['C', [[2, 7], [1, 8]]],
  Ş: ['S', [[2, 7], [1, 8]]],
  Ğ: ['G', [[1, -2], [2, -2], [3, -2]]],
  İ: ['I', [[1, -2]]],
  Ö: ['O', [[1, -2], [3, -2]]],
  Ü: ['U', [[1, -2], [3, -2]]],
  Â: ['A', [[1, -2], [2, -3], [3, -2]]],
};

export const FONT_H = 7;
/** total box height including accents */
export const LINE_H = 11;
const TOP = 3; // pixels reserved above cap height

interface Glyph {
  w: number;
  px: [number, number][];
}

const cache = new Map<string, Glyph>();

function glyph(ch: string): Glyph {
  let g = cache.get(ch);
  if (g) return g;
  const acc = ACC[ch];
  const base = G[acc ? acc[0] : ch] ?? G['?'];
  const px: [number, number][] = [];
  base.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') px.push([x, y]);
  });
  if (acc) for (const p of acc[1]) px.push(p);
  g = { w: base[0].length, px };
  cache.set(ch, g);
  return g;
}

export function upper(s: string) {
  return s.toLocaleUpperCase(settings.lang === 'tr' ? 'tr-TR' : 'en-US');
}

export function measure(text: string, scale = 1) {
  const s = upper(text);
  let w = 0;
  for (const ch of s) w += glyph(ch).w + 1;
  return Math.max(0, w - 1) * scale;
}

export interface TextOpts {
  color?: string;
  /** colour for the lower half of the glyphs (two-tone arcade style) */
  color2?: string;
  scale?: number;
  outline?: string | null;
  /** outline thickness in output pixels */
  thick?: number;
  shadow?: string | null;
  align?: 'left' | 'center' | 'right';
}

const textCache = new Map<string, HTMLCanvasElement>();

export function textCanvas(text: string, o: TextOpts = {}): HTMLCanvasElement {
  const scale = o.scale ?? 1;
  const color = o.color ?? '#fff';
  const outline = o.outline === undefined ? '#120c1c' : o.outline;
  const thick = outline ? o.thick ?? Math.max(1, Math.round(scale / 2)) : 0;
  const shadow = o.shadow ?? null;
  const key = `${text}|${color}|${o.color2}|${scale}|${outline}|${thick}|${shadow}|${settings.lang}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const s = upper(text);
  const w = measure(text, scale);
  const sh = shadow ? Math.max(1, Math.round(scale / 2)) : 0;
  const c = document.createElement('canvas');
  c.width = w + thick * 2 + sh;
  c.height = LINE_H * scale + thick * 2 + sh;
  const g = c.getContext('2d')!;
  const stamp = (ox: number, oy: number, col: string, col2?: string) => {
    let x = 0;
    for (const ch of s) {
      const gl = glyph(ch);
      for (const [px, py] of gl.px) {
        g.fillStyle = col2 && py >= 4 ? col2 : col;
        g.fillRect(ox + (x + px) * scale, oy + (py + TOP) * scale, scale, scale);
      }
      x += gl.w + 1;
    }
  };
  if (shadow) {
    for (let dy = -thick; dy <= thick; dy++) for (let dx = -thick; dx <= thick; dx++) stamp(thick + dx + sh, thick + dy + sh, shadow);
  }
  if (outline) {
    for (let dy = -thick; dy <= thick; dy++) for (let dx = -thick; dx <= thick; dx++) if (dx || dy) stamp(thick + dx, thick + dy, outline);
  }
  stamp(thick, thick, color, o.color2);
  if (textCache.size > 400) textCache.clear();
  textCache.set(key, c);
  return c;
}

/** Draw text with its cap-top at y. Returns drawn width. */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOpts = {}) {
  const c = textCanvas(text, o);
  const scale = o.scale ?? 1;
  const thick = o.outline === null ? 0 : o.thick ?? Math.max(1, Math.round(scale / 2));
  let dx = Math.round(x) - thick;
  if (o.align === 'center') dx = Math.round(x - (c.width - thick * 2) / 2) - thick;
  else if (o.align === 'right') dx = Math.round(x - (c.width - thick * 2)) - thick;
  ctx.drawImage(c, dx, Math.round(y) - TOP * scale - thick);
  return c.width;
}
