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
};
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

export function crestCanvas(cfg: CrestCfg, c1: string, c2: string): HTMLCanvasElement {
  const key = `${cfg.shape}|${cfg.icon}|${c1}|${c2}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = W + 2;
  c.height = H + 2;
  const g = c.getContext('2d')!;
  const r1 = ramp(c1), r2 = ramp(c2);
  const fill = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x + 1, y + 1, 1, 1);
  };
  const ins = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && inside(cfg.shape, x, y);
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
      let col = css(r1[x < W / 2 ? 2 : 1]);
      if (edge) col = css(r2[2]);
      else if (edge2) col = css(r1[0]);
      if (!edge && y <= 3 && ins(x, y - 2) === false) col = css(r1[3]);
      fill(x, y, col);
    }
  // icon
  const ic = CREST_ICONS[cfg.icon] ?? CREST_ICONS.star;
  const ox = Math.floor((W - 9) / 2), oy = Math.floor((H - 9) / 2) + (cfg.shape === 0 ? -1 : 0);
  ic.forEach((row, y) => {
    for (let x = 0; x < 9; x++) if (row[x] === '#') {
      fill(ox + x + 1, oy + y + 1, css(OUTLINE));
    }
  });
  ic.forEach((row, y) => {
    for (let x = 0; x < 9; x++) if (row[x] === '#') fill(ox + x, oy + y, css(y < 3 ? r2[3] : r2[2]));
  });
  cache.set(key, c);
  return c;
}
