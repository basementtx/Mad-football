/** Pixel-art club crests: outline shape + icon, in club colours. */
import type { CrestCfg } from '../game/teams';
import { ramp, css, OUTLINE } from './palette';

export const CREST_SHAPES = 10;
export const CREST_ICONS: Record<string, string[]> = {
  bolt: ['....###..', '...###...', '..###....', '.#######.', '....###..', '...###...', '..###....', '.##......', '#........'],
  flame: ['....#....', '...##....', '..###.#..', '..#####..', '.#######.', '.###.###.', '.##...##.', '..#...#..', '...###...'],
  crown: ['.........', '#...#...#', '##.###.##', '#########', '#########', '.#######.', '.#.#.#.#.', '.#######.', '.........'],
  star: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '#.......#'],
  skull: ['..#####..', '.#######.', '#########', '##..#..##', '##..#..##', '.###.###.', '..#####..', '..#.#.#..', '.........'],
  ball: ['..#####..', '.#.....#.', '#...#...#', '#..###..#', '#.#####.#', '#..###..#', '#.......#', '.#.....#.', '..#####..'],
  horns: ['#.......#', '##.....##', '.#######.', '..#####..', '..#.#.#..', '..#####..', '...###...', '...#.#...', '.........'],
  wing: ['#........', '##.......', '###......', '####.....', '######...', '########.', '.#######.', '...#####.', '......##.'],
  heart: ['.........', '.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  anchor: ['....#....', '...#.#...', '....#....', '..#####..', '....#....', '#...#...#', '##..#..##', '.#######.', '...###...'],
  rocket: ['....#....', '...###...', '...#.#...', '...###...', '...###...', '..#####..', '.##.#.##.', '.#..#..#.', '...#.#...'],
  tree: ['....#....', '...###...', '..#####..', '...###...', '..#####..', '.#######.', '#########', '....#....', '...###...'],
  sun: ['#...#...#', '.#..#..#.', '...###...', '..#####..', '#########', '..#####..', '...###...', '.#..#..#.', '#...#...#'],
  trident: ['#...#...#', '#...#...#', '#..###..#', '##.###.##', '.#######.', '....#....', '....#....', '....#....', '...###...'],
  shark: ['.....#...', '....##...', '...###...', '..####...', '.######..', '#########', '..#######', '.#.......', '.........'],
  castle: ['#.#...#.#', '###...###', '###.#.###', '#########', '#########', '###...###', '##.....##', '##.....##', '#########'],
  gem: ['.........', '..#####..', '.#.#.#.#.', '#########', '.#.....#.', '..#...#..', '...#.#...', '....#....', '.........'],
  moon: ['...####..', '..##.....', '.##......', '.##......', '.##......', '.##......', '..##.....', '...####..', '.........'],
  eagle: ['....#....', '...###...', '#..###..#', '##.###.##', '#########', '.#######.', '...###...', '..#.#.#..', '.#..#..#.'],
  lion: ['.#.###.#.', '#########', '##.###.##', '#.#####.#', '#########', '##.#.#.##', '.#######.', '..#.#.#..', '...###...'],
  canary: ['....##...', '...####..', '...#.###.', '...######', '..#####..', '.######..', '########.', '.#####...', '..#..#...'],
  wolf: ['#.......#', '##.....##', '###...###', '#########', '##.###.##', '#########', '.#######.', '..##.##..', '...###...'],
  horse: ['...##....', '..####...', '.######..', '.##.###..', '######...', '....###..', '....####.', '....####.', '...#####.'],
  ship: ['....#....', '...##....', '..###....', '.####.#..', '#####.##.', '....#....', '#########', '.#######.', '..#####..'],
  fox: ['#.......#', '##.....##', '.##...##.', '.#######.', '##.#.#.##', '.#######.', '..#####..', '...###...', '....#....'],
  ram: ['.##...##.', '#..#.#..#', '#.##.##.#', '.#######.', '..#####..', '..#.#.#..', '..#####..', '...###...', '....#....'],
  bee: ['.#.....#.', '..#...#..', '...###...', '.#######.', '##.###.##', '.#######.', '..##.##..', '...###...', '....#....'],
  cross: ['...###...', '...###...', '...###...', '#########', '#########', '#########', '...###...', '...###...', '...###...'],
  tower: ['.#.#.#.#.', '.#######.', '..#####..', '..##.##..', '..#####..', '..#####..', '..##.##..', '.#######.', '#########'],
  griffin: ['..##.....', '.####..#.', '##.##.##.', '.########', '..#######', '..######.', '.#####...', '.#..#....', '##.##....'],
};

/** 3x5 pixel letters for crest initials */
const MINI: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
  H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101',
  O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', '1': '010110010010111', '2': '110001010100111',
  '3': '110001010001110', '4': '101101111001001', '5': '111100110001110', '6': '011100110101010', '7': '111001010010010', '8': '010101010101010', '9': '010101011001110', '0': '010101101101010',
};
const plainLetter = (ch: string) => ch.toUpperCase().replace('Ç', 'C').replace('Ğ', 'G').replace('İ', 'I').replace('Ö', 'O').replace('Ş', 'S').replace('Ü', 'U').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const ICON_IDS = Object.keys(CREST_ICONS);

const W = 22, H = 25;

function inside(shape: number, x: number, y: number) {
  const cx = x + 0.5 - W / 2, cy = y + 0.5;
  switch (shape) {
    case 0: { // heater shield
      if (cy < 1 || cy > H - 0.5) return false;
      if (cy < 14) return Math.abs(cx) < W / 2 - 0.5;
      const t = (cy - 14) / (H - 14);
      return Math.abs(cx) < (W / 2 - 0.5) * (1 - t * t * 0.95);
    }
    case 1: // round
      return Math.hypot(cx, cy - H / 2) < W / 2 - 0.3;
    case 2: // diamond
      return Math.abs(cx) / (W / 2) + Math.abs(cy - H / 2) / (H / 2) < 1;
    case 3: { // hexagon / badge
      const dy = Math.abs(cy - H / 2);
      return dy < H / 2 - 0.5 && Math.abs(cx) < W / 2 - 0.5 - Math.max(0, dy - H / 4) * 0.9;
    }
    case 5: { // octagon
      const ay = Math.abs(cy - H / 2), ax = Math.abs(cx);
      return ax < W / 2 - 0.5 && ay < H / 2 - 0.5 && ax + ay < (W / 2 + H / 2) * 0.7;
    }
    case 6: { // castle: crenellated top, pointed base
      if (cy < 1 || cy > H - 0.5) return false;
      if (cy < 4.5 && Math.floor((cx + W / 2) / 3.7) % 2 === 1) return false;
      if (cy < 15) return Math.abs(cx) < W / 2 - 0.5;
      const t = (cy - 15) / (H - 15);
      return Math.abs(cx) < (W / 2 - 0.5) * (1 - t * 0.92);
    }
    case 7: { // U shield (round base)
      const r = W / 2 - 0.5;
      if (cy < 1) return false;
      if (cy < H - r - 0.5) return Math.abs(cx) < r;
      return Math.hypot(cx, cy - (H - r - 0.5)) < r;
    }
    case 8: { // sun badge
      const dy = cy - H / 2, a = Math.atan2(dy, cx);
      return Math.hypot(cx, dy) < (W / 2 - 0.4) * (0.84 + 0.16 * Math.cos(a * 10));
    }
    case 9: // inverted triangle
      return cy > 1 && cy < H - 0.5 && Math.abs(cx) < (W / 2 - 0.5) * (1 - ((cy - 1) / (H - 1.5)) * 0.92);
    default: { // pennant-ish shield with notch
      if (cy < 1 || cy > H - 0.5) return false;
      if (cy < 4 && Math.abs(cx) < 3) return false;
      const t = Math.max(0, (cy - 8) / (H - 8));
      return Math.abs(cx) < (W / 2 - 0.5) * (1 - t * 0.85);
    }
  }
}

const cache = new Map<string, HTMLCanvasElement>();

function field(bg: CrestCfg['bg'], x: number, y: number): 0 | 1 {
  switch (bg) {
    case 'stripes': return (Math.floor((x + 1) / 3) % 2) as 0 | 1;
    case 'halves': return x < W / 2 ? 0 : 1;
    case 'hoops': return (Math.floor(y / 3) % 2) as 0 | 1;
    case 'sash': return Math.abs(x - y * 0.85 - 1) < 3 ? 1 : 0;
    case 'quarters': return (x < W / 2) !== (y < H / 2 - 1) ? 1 : 0;
    case 'cross': return Math.abs(x + 0.5 - W / 2) < 2.5 || Math.abs(y + 0.5 - (H / 2 - 1)) < 2.5 ? 1 : 0;
    case 'band': return y >= 10 && y <= 14 ? 1 : 0;
    case 'chevron': return Math.abs(y - (6 + Math.abs(x + 0.5 - W / 2) * 0.8)) < 2 ? 1 : 0;
  }
  return 0;
}

export function crestCanvas(cfg: CrestCfg, c1: string, c2: string): HTMLCanvasElement {
  const key = `${cfg.shape}|${cfg.icon}|${c1}|${c2}|${cfg.bg ?? ''}|${cfg.accent ?? ''}|${cfg.ring ? 1 : 0}|${cfg.text ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = W + 2;
  c.height = H + 2;
  const g = c.getContext('2d')!;
  const r1 = ramp(c1), r2 = ramp(c2);
  const ra = cfg.accent ? ramp(cfg.accent) : null;
  const fill = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x + 1, y + 1, 1, 1);
  };
  const ins = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && inside(cfg.shape, x, y);
  const patterned = !!cfg.bg && cfg.bg !== 'plain';
  // outline
  for (let y = -1; y <= H; y++)
    for (let x = -1; x <= W; x++) {
      if (ins(x, y)) continue;
      if (ins(x + 1, y) || ins(x - 1, y) || ins(x, y + 1) || ins(x, y - 1)) fill(x, y, css(OUTLINE));
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!ins(x, y)) continue;
      const edge = !ins(x + 1, y) || !ins(x - 1, y) || !ins(x, y + 1) || !ins(x, y - 1);
      const edge2 = !ins(x + 2, y) || !ins(x - 2, y) || !ins(x, y + 2) || !ins(x, y - 2);
      const rf = patterned && field(cfg.bg, x, y) ? r2 : r1;
      let col = css(rf[x < W / 2 ? 2 : 1]);
      if (edge) col = css((ra ?? r2)[2]);
      else if (edge2) col = cfg.ring && ra ? css(ra[3]) : css(rf[0]);
      if (!edge && y <= 3 && ins(x, y - 2) === false) col = css(rf[3]);
      fill(x, y, col);
    }
  // initials on a band
  const text = (cfg.text ?? '').slice(0, 3);
  let iconY = Math.floor((H - 9) / 2) + (cfg.shape === 0 ? -1 : 0);
  if (text) {
    const by0 = 3, by1 = 9;
    for (let y = by0; y <= by1; y++) for (let x = 0; x < W; x++) if (ins(x, y) && ins(x - 2, y) && ins(x + 2, y)) fill(x, y, css(OUTLINE));
    const letters = [...text].map(plainLetter);
    const tw = letters.length * 4 - 1;
    let lx = Math.floor((W - tw) / 2);
    for (const ch of letters) {
      const m = MINI[ch];
      if (m) for (let i = 0; i < 15; i++) if (m[i] === '1') fill(lx + (i % 3), by0 + 1 + Math.floor(i / 3), (ra ? css(ra[3]) : '#ffffff'));
      lx += 4;
    }
    iconY = 11;
  }
  // icon
  const ic = CREST_ICONS[cfg.icon] ?? CREST_ICONS.star;
  const ox = Math.floor((W - 9) / 2), oy = iconY;
  const icR = ra ?? (patterned ? ramp('#ffffff') : r2);
  ic.forEach((row, y) => {
    for (let x = 0; x < 9; x++) if (row[x] === '#') fill(ox + x + 1, oy + y + 1, css(OUTLINE));
  });
  ic.forEach((row, y) => {
    for (let x = 0; x < 9; x++) if (row[x] === '#') fill(ox + x, oy + y, css(y < 3 ? icR[3] : icR[2]));
  });
  cache.set(key, c);
  return c;
}
