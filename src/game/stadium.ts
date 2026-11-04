import type { Stadium, PitchStyle, Weather } from './env';
import type { RGB } from '../pixel/palette';
import { hexToRgb } from '../engine/math';
import { drawText } from '../pixel/font';

/** Colours of one stadium design. */
export interface StadiumTheme {
  bg: string;
  seat: string;
  seatDark: string;
  step: string;
  stepDark: string;
  stepLo: string;
  aisle: string;
  aisleLo: string;
  roof: string;
  roofEdge: string;
  board: string;
  boardEdge: string;
  boardSide: string;
  front: string;
  frontRib: string;
  gap: string;
  /** share of seats with a fan in them */
  crowd: number;
}

export const THEMES: Record<Stadium, StadiumTheme> = {
  arena: {
    bg: '#0a101c', seat: '#1c2337', seatDark: '#151b2b', step: '#2b3550', stepDark: '#222a3e', stepLo: '#10141f', aisle: '#323c56', aisleLo: '#242c42',
    roof: '#060a12', roofEdge: '#1a2133', board: '#05070d', boardEdge: '#3a4766', boardSide: '#121a2c', front: '#141b2c', frontRib: '#26304a', gap: '#0d121e', crowd: 0.93,
  },
  retro: {
    bg: '#140c08', seat: '#4a2a1e', seatDark: '#3a2016', step: '#6a3c2a', stepDark: '#56301f', stepLo: '#1e100a', aisle: '#7a5a40', aisleLo: '#5a3e2a',
    roof: '#2a1a10', roofEdge: '#6b4a2a', board: '#0e0a06', boardEdge: '#7a5a3a', boardSide: '#2a1c12', front: '#2a1c12', frontRib: '#4a3424', gap: '#120a06', crowd: 0.9,
  },
  street: {
    bg: '#101214', seat: '#3a3f46', seatDark: '#30343a', step: '#5a6068', stepDark: '#4a5058', stepLo: '#1c1f23', aisle: '#6a7078', aisleLo: '#50565e',
    roof: '#14161a', roofEdge: '#2a2e34', board: '#1a1d22', boardEdge: '#7a8088', boardSide: '#24282e', front: '#2a2e34', frontRib: '#4a5058', gap: '#121417', crowd: 0.34,
  },
  coliseum: {
    bg: '#1a120a', seat: '#8a6a44', seatDark: '#76583a', step: '#b08a5a', stepDark: '#9a784e', stepLo: '#4a3420', aisle: '#c49c68', aisleLo: '#8a6a44',
    roof: '#2a1c10', roofEdge: '#c49c68', board: '#2a1c10', boardEdge: '#d8b07a', boardSide: '#4a3420', front: '#5a4028', frontRib: '#8a6a44', gap: '#24180c', crowd: 0.86,
  },
  neon: {
    bg: '#07040f', seat: '#160c2a', seatDark: '#100820', step: '#3a1a5a', stepDark: '#2a1046', stepLo: '#05020c', aisle: '#2a1648', aisleLo: '#1a0c30',
    roof: '#05020c', roofEdge: '#3bd9ff', board: '#05020c', boardEdge: '#3bd9ff', boardSide: '#120a24', front: '#0c0618', frontRib: '#ff2fa0', gap: '#07040f', crowd: 0.93,
  },
};

const hx = (h: string) => hexToRgb(h) as RGB;

/** Grass ramps (dark → light, 7 shades) for each pitch style. */
export const GRASS: Record<PitchStyle, RGB[]> = {
  stripes: ['#174a24', '#1f5e2c', '#277035', '#2f803c', '#389045', '#45a050', '#57b05c'].map(hx),
  checker: ['#17482a', '#1d5c32', '#246e3a', '#2c7f42', '#358f4a', '#41a056', '#53b066'].map(hx),
  diagonal: ['#1a4a22', '#22602a', '#2a7232', '#33843a', '#3c9442', '#4aa44c', '#5cb45a'].map(hx),
  rings: ['#184826', '#205c2e', '#286e36', '#307e3e', '#3a8e46', '#479e52', '#59ae60'].map(hx),
  dry: ['#4a4a1e', '#5b5a24', '#6d6a2c', '#7f7a36', '#918a42', '#a39a50', '#b5aa60'].map(hx),
  astro: ['#0e5636', '#126a44', '#167e50', '#1a8e5a', '#209e64', '#28ae70', '#34be7c'].map(hx),
};
export const DIRT: RGB[] = ['#4f5a2c', '#5d6532', '#6c703c', '#7a7a46'].map(hx);
export const SAND: RGB[] = ['#7a6438', '#8a7242', '#9a804c', '#aa8e58'].map(hx);
export const MUD: RGB[] = ['#33261a', '#3f2f1f', '#4b3824', '#57422b'].map(hx);
export const SNOW: RGB[] = ['#c8d4e2', '#dbe4ef', '#e8eef6', '#f4f8fc'].map(hx);

/** Mowing pattern: 0/1 stripe for a world position. */
export function mowing(style: PitchStyle, wx: number, wy: number): number {
  switch (style) {
    case 'checker': return (Math.floor((wx + 400) / 4) + Math.floor((wy + 400) / 4)) % 2;
    case 'diagonal': return Math.floor((wx + wy * 1.15 + 800) / 3.5) % 2;
    case 'rings': return Math.floor(Math.hypot(wx, wy) / 3) % 2;
    case 'astro': return Math.floor((wx + 400) / 2) % 2;
    case 'dry': return Math.floor((wx + 400) / 6) % 2;
    default: return Math.floor((wx + 400) / 4) % 2;
  }
}

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0,1). */
export function vnoise(x: number, y: number, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi + seed, yi), b = hash(xi + 1 + seed, yi), c = hash(xi + seed, yi + 1), d = hash(xi + 1 + seed, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Whether stadium lights are on for this weather. */
export const isLit = (w: Weather) => w !== 'clear' && w !== 'wind';

/** Roof band (y 0..18) with the stadium's own look and lights. */
export function drawRoof(g: CanvasRenderingContext2D, s: Stadium, W: number, lit: boolean, torches: [number, number][]) {
  const T = THEMES[s];
  g.fillStyle = T.roof;
  g.fillRect(0, 0, W, 18);
  g.fillStyle = T.roofEdge;
  g.fillRect(0, 16, W, 2);
  const bulb = (x: number, y: number) => {
    if (lit) {
      g.fillStyle = 'rgba(255,240,180,0.10)';
      g.fillRect(x - 6, y - 3, 15, 10);
      g.fillStyle = '#fff4c4';
      g.fillRect(x, y, 3, 3);
      g.fillStyle = '#fffbe8';
      g.fillRect(x + 1, y + 1, 1, 1);
    } else {
      g.fillStyle = '#5a6070';
      g.fillRect(x, y, 3, 3);
      g.fillStyle = '#8a92a4';
      g.fillRect(x, y, 3, 1);
    }
  };
  switch (s) {
    case 'arena':
      for (let x = 16; x < W; x += 36) bulb(x, 9);
      break;
    case 'retro': {
      // corrugated timber roof with a fascia
      for (let x = 0; x < W; x += 3) {
        g.fillStyle = '#3a2416';
        g.fillRect(x, 0, 1, 14);
      }
      g.fillStyle = '#8a6438';
      g.fillRect(0, 14, W, 2);
      for (let x = 10; x < W; x += 24) {
        g.fillStyle = '#5a3e22';
        g.fillRect(x, 14, 2, 2);
      }
      // floodlight towers in the corners
      for (const tx of [6, W - 20]) {
        g.fillStyle = '#1a120c';
        g.fillRect(tx, 0, 14, 12);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) bulb(tx + 1 + i * 3, 1 + j * 3);
      }
      break;
    }
    case 'street': {
      // city skyline behind the cage
      g.fillStyle = lit ? '#0c1020' : '#6a8ab0';
      g.fillRect(0, 0, W, 16);
      let x = 0, k = 0;
      while (x < W) {
        const bw = 16 + Math.floor(hash(k, 5) * 28), bh = 6 + Math.floor(hash(k, 6) * 10);
        g.fillStyle = lit ? '#161a26' : '#3a4250';
        g.fillRect(x, 16 - bh, bw - 2, bh);
        for (let wy = 16 - bh + 2; wy < 15; wy += 3)
          for (let wx = x + 2; wx < x + bw - 4; wx += 3) {
            const on = hash(wx, wy) < (lit ? 0.45 : 0.15);
            g.fillStyle = on ? (lit ? '#ffd86a' : '#a8c4e0') : lit ? '#222838' : '#2e3440';
            g.fillRect(wx, wy, 1, 1);
          }
        x += bw;
        k++;
      }
      g.fillStyle = '#2a2e34';
      g.fillRect(0, 16, W, 2);
      for (let x2 = 30; x2 < W; x2 += 90) bulb(x2, 12);
      break;
    }
    case 'coliseum': {
      // sandstone arcade with torches
      g.fillStyle = '#b08a5a';
      g.fillRect(0, 0, W, 16);
      g.fillStyle = '#c8a26e';
      g.fillRect(0, 0, W, 1);
      for (let x = 2; x < W; x += 14) {
        g.fillStyle = '#2a1c10';
        g.fillRect(x + 2, 5, 8, 10);
        g.fillRect(x + 3, 4, 6, 1);
        g.fillRect(x + 4, 3, 4, 1);
        g.fillStyle = '#8a6a44';
        g.fillRect(x + 1, 5, 1, 10);
        g.fillRect(x + 10, 5, 1, 10);
      }
      for (let x = 37; x < W; x += 84) {
        g.fillStyle = '#3a2814';
        g.fillRect(x, 9, 3, 6);
        torches.push([x + 1, 8]);
      }
      break;
    }
    case 'neon': {
      g.fillStyle = '#ff2fa0';
      g.fillRect(0, 13, W, 1);
      g.fillStyle = '#3bd9ff';
      g.fillRect(0, 16, W, 1);
      g.fillStyle = 'rgba(59,217,255,0.25)';
      g.fillRect(0, 15, W, 1);
      g.fillRect(0, 17, W, 1);
      for (let x = 12; x < W; x += 30) {
        g.fillStyle = 'rgba(255,47,160,0.18)';
        g.fillRect(x - 3, 3, 14, 8);
        g.fillStyle = x % 60 < 30 ? '#ff2fa0' : '#b6ff3b';
        g.fillRect(x, 6, 8, 2);
      }
      break;
    }
  }
}

/** Things drawn in front of the crowd (fences, pillars, neon strips, graffiti). */
export function drawStadiumFront(g: CanvasRenderingContext2D, s: Stadium, L: { W: number; H: number; topY1: number; botY0: number; px0: number; px1: number; py0: number; py1: number; boardH: number }) {
  switch (s) {
    case 'retro':
      // roof support pillars obstructing the view (classic old ground)
      for (let x = 95; x < L.W; x += 190) {
        g.fillStyle = '#120a06';
        g.fillRect(x, 18, 3, L.topY1 - 18);
        g.fillStyle = '#3a2416';
        g.fillRect(x, 18, 1, L.topY1 - 18);
      }
      break;
    case 'street': {
      // chain-link fence in front of the top bleachers
      const y0 = 20, y1 = L.topY1;
      g.fillStyle = 'rgba(170,180,190,0.38)';
      for (let y = y0; y < y1; y++)
        for (let x = (y - y0) % 4; x < L.W; x += 4) {
          g.fillRect(x, y, 1, 1);
          g.fillRect(L.W - x, y, 1, 1);
        }
      for (let x = 20; x < L.W; x += 44) {
        g.fillStyle = '#7a8088';
        g.fillRect(x, y0 - 2, 2, y1 - y0 + 2);
      }
      g.fillStyle = '#9aa0a8';
      g.fillRect(0, y0 - 2, L.W, 1);
      // graffiti on the side walls
      const tags = ['MAD', 'GOAL', 'NO REF', 'KICK'];
      const cols = ['#ff2fa0', '#b6ff3b', '#3bd9ff', '#ffd23f'];
      for (let i = 0; i < 4; i++) {
        const left = i % 2 === 0;
        const x = left ? Math.round((L.px0 - 6) / 2) : Math.round((L.px1 + 6 + L.W) / 2);
        const y = L.py0 + 10 + Math.floor(i / 2) * Math.round((L.py1 - L.py0) / 2);
        drawText(g, tags[i], x, y, { color: cols[i], align: 'center', outline: '#120c1c' });
      }
      break;
    }
    case 'neon': {
      // neon strips every few rows
      let i = 0;
      for (let y = L.topY1 - 1; y > 22; y -= 7, i++) {
        if (i % 3) continue;
        g.fillStyle = i % 6 ? '#3bd9ff' : '#ff2fa0';
        g.fillRect(0, y, L.W, 1);
        g.fillStyle = 'rgba(255,47,160,0.12)';
        g.fillRect(0, y - 1, L.W, 3);
      }
      for (let y = L.botY0 + 7; y < L.H; y += 21) {
        g.fillStyle = '#ff2fa0';
        g.fillRect(0, y, L.W, 1);
      }
      break;
    }
    case 'coliseum':
      // stone balustrade in front of the lowest row
      g.fillStyle = '#c8a26e';
      g.fillRect(0, L.topY1 - 3, L.W, 2);
      for (let x = 2; x < L.W; x += 5) {
        g.fillStyle = '#8a6a44';
        g.fillRect(x, L.topY1 - 1, 2, 1);
      }
      break;
  }
}
