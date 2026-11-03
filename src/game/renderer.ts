import type { Match } from './match';
import type { Camera } from './camera';
import { PPM, YS } from './camera';
import type { Pitch, Player } from './entities';
import type { TeamDef } from './teams';
import { playerSheet, FRAMES, CELL_W, CELL_H, ANCHOR_X, ANCHOR_Y, PlayerLook } from '../pixel/player';
import { ballFrame, shadow, ring, arrow, BALL_SIZE } from '../pixel/props';
import { ramp, css, RGB } from '../pixel/palette';
import { drawText, measure } from '../pixel/font';
import { clamp, hexToRgb, TAU, pick } from '../engine/math';
import { settings } from '../engine/storage';

const SPONSORS = ['MADFOOT', 'BONK COLA', 'NO RULES', 'TURBO BOOTS', 'GG ENERGY', 'KICK HARD', 'RAGE FM', 'SLIDE CO.'];
const GRASS: RGB[] = ['#174a24', '#1f5e2c', '#277035', '#2f803c', '#389045', '#45a050', '#57b05c'].map((h) => hexToRgb(h) as RGB);
const DIRT: RGB[] = ['#4f5a2c', '#5d6532', '#6c703c', '#7a7a46'].map((h) => hexToRgb(h) as RGB);
const LINE: RGB = [236, 242, 230];
const LINE_W: RGB = [205, 220, 200];
const SKINS = ['#f1cfb0', '#d9a882', '#b47b55', '#7c5135', '#5a3722'];
const HAIRS = ['#1a1310', '#3b2416', '#6b3e1f', '#c98a3a', '#2a2a2a', '#7a1a10'];

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

interface Sprite {
  c: HTMLCanvasElement;
  x: number; // position in stadium pixel space
  y: number;
}

export class Renderer {
  private P: Pitch;
  private OX = 0;
  private OY = 0;
  private variants: HTMLCanvasElement[] = [];
  private goalFront: Sprite[] = [];
  private frontBoard!: Sprite;
  private led!: HTMLCanvasElement;
  private ledRect = { x0: 0, x1: 0, y: 0, h: 12 };
  private vignette: HTMLCanvasElement | null = null;
  private vigKey = '';
  private standRects: [number, number, number, number][] = [];
  private looks = new Map<Player, PlayerLook>();

  constructor(private m: Match) {
    this.P = m.pitch;
    for (const p of m.all) {
      const look: PlayerLook = { kit: p.team.def, isGK: p.isGK, skin: p.skin, hair: p.hair, hairStyle: p.hairStyle, beard: p.beard };
      this.looks.set(p, look);
      playerSheet(look);
    }
    this.build();
  }

  // ---------------------------------------------------------------- mapping (stadium px)
  private WX(x: number) {
    return Math.round(x * PPM) + this.OX;
  }
  private WY(y: number, z = 0) {
    return Math.round(y * PPM * YS - z * PPM) + this.OY;
  }
  private P3(x: number, y: number, z: number): [number, number] {
    return [this.WX(x) + Math.round(z * PPM * 0.3 * Math.sign(x)), this.WY(y, z)];
  }

  // ---------------------------------------------------------------- build
  private build() {
    const P = this.P;
    const ex = P.hw + P.margin, ey = P.hh + P.margin;
    const extX = ex + 10, extTop = ey + 11, extBot = ey + 9;
    this.OX = Math.round(extX * PPM);
    this.OY = Math.round(extTop * PPM * YS);
    const W = this.OX * 2;
    const H = this.OY + Math.round(extBot * PPM * YS);
    const base = document.createElement('canvas');
    base.width = W;
    base.height = H;
    const g = base.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0a101c';
    g.fillRect(0, 0, W, H);

    const [h, a] = [this.m.teams[0].def, this.m.teams[1].def];
    const px0 = this.WX(-ex), px1 = this.WX(ex), py0 = this.WY(-ey), py1 = this.WY(ey);
    const boardH = 13;

    // ---- stands structure
    const tier = (x0: number, y0: number, x1: number, y1: number, vertical: boolean, dark = 0) => {
      g.fillStyle = dark ? '#151b2b' : '#1c2337';
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (!vertical) {
        for (let y = y1 - 1; y >= y0; y -= 7) {
          g.fillStyle = dark ? '#222a3e' : '#2b3550';
          g.fillRect(x0, y - 6, x1 - x0, 1);
          g.fillStyle = '#10141f';
          g.fillRect(x0, y, x1 - x0, 1);
        }
      } else {
        for (let x = x0; x < x1; x += 7) {
          g.fillStyle = '#2b3550';
          g.fillRect(x, y0, 1, y1 - y0);
          g.fillStyle = '#10141f';
          g.fillRect(x + 6, y0, 1, y1 - y0);
        }
      }
    };
    const topY1 = py0 - boardH - 2;
    tier(0, 18, W, topY1, false);
    // aisles
    for (let x = 60; x < W; x += 170) {
      g.fillStyle = '#323c56';
      g.fillRect(x, 18, 5, topY1 - 18);
      g.fillStyle = '#242c42';
      for (let y = 20; y < topY1; y += 4) g.fillRect(x, y, 5, 1);
    }
    // roof + floodlights
    g.fillStyle = '#060a12';
    g.fillRect(0, 0, W, 18);
    g.fillStyle = '#1a2133';
    g.fillRect(0, 16, W, 2);
    for (let x = 16; x < W; x += 36) {
      g.fillStyle = 'rgba(255,240,180,0.10)';
      g.fillRect(x - 6, 6, 15, 10);
      g.fillStyle = '#fff4c4';
      g.fillRect(x, 9, 3, 3);
      g.fillStyle = '#fffbe8';
      g.fillRect(x + 1, 10, 1, 1);
    }
    // sides
    tier(0, py0 - boardH, px0 - 6, py1 + 2, true);
    tier(px1 + 6, py0 - boardH, W, py1 + 2, true);
    // bottom stand
    const botY0 = py1 + 12;
    tier(0, botY0, W, H, false, 1);
    g.fillStyle = '#0d121e';
    g.fillRect(0, py1 + 1, W, 11);
    this.standRects = [
      [0, 18, W, topY1],
      [0, py0 - boardH, px0 - 6, py1],
      [px1 + 6, py0 - boardH, W, py1],
      [0, botY0, W, H],
    ];

    // ---- pitch pixels
    const pw = px1 - px0, ph = py1 - py0;
    const img = g.createImageData(pw, ph);
    const d = img.data;
    const set = (x: number, y: number, c: RGB) => {
      const lx = x - px0, ly = y - py0;
      if (lx < 0 || ly < 0 || lx >= pw || ly >= ph) return;
      const o = (ly * pw + lx) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    };
    const tuftNext = new Uint8Array(pw);
    for (let y = py0; y < py1; y++) {
      for (let x = px0; x < px1; x++) {
        const wx = (x - this.OX) / PPM, wy = (y - this.OY) / (PPM * YS);
        const inField = Math.abs(wx) <= P.hw && Math.abs(wy) <= P.hh;
        const stripe = Math.floor((wx + 400) / 4) % 2;
        const band = Math.floor((wy + 400) / 4) % 2;
        let t = 3 + stripe;
        if (!inField) t -= 1;
        const r = hash(x, y);
        if (r < 0.1) t -= 1;
        else if (r > 0.93) t += 1;
        if (band && ((x + y) & 1) === 0 && r < 0.4) t += 1;
        if (tuftNext[x - px0]) {
          t -= 1;
          tuftNext[x - px0] = 0;
        }
        if (r > 0.988) {
          t += 2;
          tuftNext[x - px0] = 1;
        }
        let c = GRASS[clamp(t, 0, GRASS.length - 1)];
        // wear patches (goal mouths and centre)
        for (const [cx, cy, rad, pr] of [[-P.hw + 1.4, 0, 3.4, 0.9], [P.hw - 1.4, 0, 3.4, 0.9], [0, 0, 1.8, 0.5]] as const) {
          const dd = Math.hypot(wx - cx, (wy - cy) * 1.3) / rad;
          // clumpy wear: low-frequency mask (2x2 cells) so it reads as patches, not noise
          if (dd < 1 && hash(x >> 1, y >> 1) < (1 - dd) * (1 - dd) * pr) c = DIRT[clamp(Math.floor((1 - dd) * 3 + hash(x, y * 5)), 0, DIRT.length - 1)];
        }
        set(x, y, c);
      }
    }
    // ---- lines
    const lcol = (x: number, y: number) => (hash(x * 3, y * 11) < 0.12 ? LINE_W : LINE);
    const hline = (x0: number, x1: number, y: number) => {
      const Y = this.WY(y);
      for (let x = this.WX(x0) - 1; x <= this.WX(x1); x++) for (const yy of [Y - 1, Y]) set(x, yy, lcol(x, yy));
    };
    const vline = (x: number, y0: number, y1: number) => {
      const X = this.WX(x);
      for (let y = this.WY(y0) - 1; y <= this.WY(y1); y++) for (const xx of [X - 1, X]) set(xx, y, lcol(xx, y));
    };
    const rect = (x0: number, y0: number, x1: number, y1: number) => {
      hline(x0, x1, y0);
      hline(x0, x1, y1);
      vline(x0, y0, y1);
      vline(x1, y0, y1);
    };
    const ellipse = (cx: number, cy: number, r: number, keep: (wx: number, wy: number) => boolean) => {
      const rx = r * PPM, ry = r * PPM * YS;
      const X = this.WX(cx), Y = this.WY(cy);
      for (let y = Math.floor(Y - ry - 2); y <= Y + ry + 2; y++)
        for (let x = Math.floor(X - rx - 2); x <= X + rx + 2; x++) {
          const dx = x + 0.5 - X, dy = y + 0.5 - Y;
          const f = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) - 1;
          const gr = 2 * Math.sqrt((dx / (rx * rx)) ** 2 + (dy / (ry * ry)) ** 2) || 1;
          const sd = f / gr;
          if (sd > -1.25 && sd < 0.45 && keep((x - this.OX) / PPM, (y - this.OY) / (PPM * YS))) set(x, y, lcol(x, y));
        }
    };
    const spot = (x: number, y: number) => {
      const X = this.WX(x), Y = this.WY(y);
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) set(X + dx, Y + dy, LINE);
    };
    rect(-P.hw, -P.hh, P.hw, P.hh);
    vline(0, -P.hh, P.hh);
    ellipse(0, 0, P.centerR, () => true);
    spot(0, 0);
    for (const s of [-1, 1]) {
      const gx = s * P.hw;
      rect(Math.min(gx, gx - s * P.boxDepth), -P.boxHalf, Math.max(gx, gx - s * P.boxDepth), P.boxHalf);
      rect(Math.min(gx, gx - s * P.smallDepth), -P.smallHalf, Math.max(gx, gx - s * P.smallDepth), P.smallHalf);
      const sp = gx - s * P.boxDepth * 0.72;
      spot(sp, 0);
      const edge = gx - s * P.boxDepth;
      ellipse(sp, 0, P.centerR * 0.85, (wx) => (s > 0 ? wx < edge - 0.05 : wx > edge + 0.05));
      for (const sy of [-1, 1]) ellipse(gx, sy * P.hh, 1, (wx, wy) => Math.abs(wx) <= P.hw + 0.05 && Math.abs(wy) <= P.hh + 0.05);
    }
    g.putImageData(img, px0, py0);

    // subtle floodlight pools on the grass (dithered)
    g.fillStyle = 'rgba(255,250,210,0.035)';
    for (let y = py0; y < py1; y += 2) {
      const wy = (y - this.OY) / (PPM * YS) / P.hh;
      const w = Math.round(pw * (0.5 - Math.abs(wy) * 0.2));
      g.fillRect(px0 + (pw - w) / 2, y, w, 1);
    }

    // ---- boards
    g.fillStyle = '#05070d';
    g.fillRect(px0 - 2, py0 - boardH - 1, pw + 4, boardH + 1);
    g.fillStyle = '#3a4766';
    g.fillRect(px0 - 2, py0 - boardH - 2, pw + 4, 1);
    this.ledRect = { x0: px0, x1: px1, y: py0 - boardH, h: boardH - 2 };
    for (const s of [-1, 1]) {
      const bx = s > 0 ? px1 + 1 : px0 - 6;
      g.fillStyle = '#121a2c';
      g.fillRect(bx, py0 - boardH, 5, py1 - py0 + boardH);
      g.fillStyle = '#3a4766';
      g.fillRect(bx, py0 - boardH, 5, 1);
      g.fillStyle = s < 0 ? h.primary : a.primary;
      g.fillRect(bx + 2, py0 - boardH + 2, 1, py1 - py0 + boardH - 4);
    }

    // ---- goals (back parts) + front sprites
    for (const s of [-1, 1]) this.drawGoalBack(g, s);
    this.goalFront = [-1, 1].map((s) => this.buildGoalFront(s));

    // ---- near (bottom) board, drawn over players
    const fb = document.createElement('canvas');
    fb.width = pw + 4;
    fb.height = 12;
    const fg = fb.getContext('2d')!;
    fg.fillStyle = '#141b2c';
    fg.fillRect(0, 0, fb.width, 12);
    fg.fillStyle = '#3a4766';
    fg.fillRect(0, 0, fb.width, 1);
    fg.fillStyle = '#0a0e18';
    fg.fillRect(0, 11, fb.width, 1);
    for (let x = 6; x < fb.width; x += 48) {
      fg.fillStyle = '#26304a';
      fg.fillRect(x, 3, 1, 7);
    }
    this.frontBoard = { c: fb, x: px0 - 2, y: py1 - 10 };

    this.led = this.buildLed(h, a);

    // ---- crowd variants
    const nVar = settings.quality === 'high' ? 3 : 1;
    for (let v = 0; v < nVar; v++) {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const cg = c.getContext('2d')!;
      cg.drawImage(base, 0, 0);
      this.drawCrowd(cg, v, h, a, { px0, px1, py0, py1, topY1, botY0, W, H, boardH });
      this.variants.push(c);
    }
  }

  private drawCrowd(g: CanvasRenderingContext2D, v: number, h: TeamDef, a: TeamDef, L: { px0: number; px1: number; py0: number; py1: number; topY1: number; botY0: number; W: number; H: number; boardH: number }) {
    const shirt = (x: number, k: number) => {
      const homeSide = x < L.W / 2;
      const r = hash(k, 99);
      if (r < 0.12) return pick(['#d8d8d8', '#2a2f3a', '#3a3f4f', '#7a6a5a']);
      const t = r < (homeSide ? 0.82 : 0.3) ? h : a;
      return hash(k, 7) < 0.7 ? t.primary : t.secondary;
    };
    const fan = (x: number, y: number, k: number, back: boolean) => {
      const jumping = v > 0 && Math.floor(hash(k, 3) * 3) === v - 1;
      const up = jumping ? 2 : 0;
      const col = shirt(x, k);
      const rp = ramp(col);
      const skin = SKINS[Math.floor(hash(k, 11) * SKINS.length)];
      const hair = HAIRS[Math.floor(hash(k, 13) * HAIRS.length)];
      const yy = y - up;
      g.fillStyle = css(rp[2]);
      g.fillRect(x - 1, yy - 3, 3, 3);
      g.fillStyle = css(rp[1]);
      g.fillRect(x + 1, yy - 3, 1, 3);
      g.fillStyle = back ? hair : skin;
      g.fillRect(x - 1, yy - 5, 2, 2);
      if (!back) {
        g.fillStyle = hair;
        g.fillRect(x - 1, yy - 5, 2, 1);
      }
      if (jumping) {
        g.fillStyle = skin;
        g.fillRect(x - 2, yy - 6, 1, 3);
        g.fillRect(x + 2, yy - 6, 1, 3);
        if (hash(k, 17) < 0.15) {
          // scarf above the head
          const tdef = col === h.primary || col === h.secondary ? h : a;
          for (let i = 0; i < 7; i++) {
            g.fillStyle = i % 2 ? tdef.secondary : tdef.primary;
            g.fillRect(x - 3 + i, yy - 8, 1, 2);
          }
        }
      }
    };
    let k = 0;
    // top stand rows
    for (let y = L.topY1 - 2; y > 24; y -= 7) {
      for (let x = 3; x < L.W - 3; x += 5) {
        k++;
        if (hash(k, 1) < 0.07) continue;
        if (((x - 60) % 170 + 170) % 170 < 7) continue; // aisles
        fan(x + (hash(k, 2) < 0.5 ? 0 : 1), y, k, false);
      }
    }
    // side stands
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 4 : L.px1 + 10, x1 = side < 0 ? L.px0 - 9 : L.W - 4;
      for (let x = x0; x < x1; x += 7) {
        for (let y = L.py0 - L.boardH + 6; y < L.py1; y += 6) {
          k++;
          if (hash(k, 1) < 0.08) continue;
          fan(x + 3, y, k, false);
        }
      }
    }
    // bottom stand (backs of heads)
    for (let y = L.botY0 + 6; y < L.H + 6; y += 7) {
      for (let x = 3; x < L.W - 3; x += 5) {
        k++;
        if (hash(k, 1) < 0.07) continue;
        fan(x, y, k, true);
      }
    }
    // tifo banners hanging on the top stand
    const banner = (cx: number, t: TeamDef) => {
      const w = 34, hh = 13, y = L.topY1 - hh - 4;
      const wave = v === 2 ? 1 : 0;
      for (let i = 0; i < w; i++) {
        const off = Math.round(Math.sin(i * 0.35 + v) * 0.8) + wave * (i % 2);
        for (let j = 0; j < hh; j++) {
          const band = Math.floor((j / hh) * 3);
          g.fillStyle = band === 1 ? t.secondary : t.primary;
          g.fillRect(cx + i, y + j + off, 1, 1);
        }
      }
      g.fillStyle = '#120c1c';
      g.fillRect(cx - 1, y - 1, w + 2, 1);
      g.fillRect(cx - 1, y + hh + 1, w + 2, 1);
      drawText(g, t.short, cx + w / 2, y + 3, { color: '#fff', align: 'center', outline: '#120c1c' });
    };
    banner(L.W * 0.22, h);
    banner(L.W * 0.36, h);
    banner(L.W * 0.62, a);
    banner(L.W * 0.76, a);
  }

  private buildLed(h: TeamDef, a: TeamDef) {
    const items = [...SPONSORS, h.name, a.name];
    const H = this.ledRect.h;
    const widths = items.map((t) => measure(t) + 22);
    const W = widths.reduce((x, y) => x + y, 0);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    const bgs = ['#101629', '#c8261f', '#0d0d12', '#e8b400', '#1d4ed8', '#14a050', '#8a1aa0', '#e06010'];
    let x = 0;
    items.forEach((t, i) => {
      const bg = i === SPONSORS.length ? h.primary : i === SPONSORS.length + 1 ? a.primary : bgs[i % bgs.length];
      const rp = ramp(bg);
      g.fillStyle = css(rp[2]);
      g.fillRect(x, 0, widths[i], H);
      g.fillStyle = css(rp[3]);
      g.fillRect(x, 0, widths[i], 1);
      g.fillStyle = css(rp[1]);
      g.fillRect(x, H - 1, widths[i], 1);
      const [r, gg, b] = hexToRgb(bg);
      const light = r * 0.3 + gg * 0.59 + b * 0.11 > 150;
      drawText(g, t, x + widths[i] / 2, Math.floor((H - 7) / 2), { color: light ? '#111' : '#fff', align: 'center', outline: null });
      g.fillStyle = '#05070d';
      g.fillRect(x + widths[i] - 1, 0, 1, H);
      x += widths[i];
    });
    // LED rows
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 1; y < H; y += 2) g.fillRect(0, y, W, 1);
    return c;
  }

  // ---------------------------------------------------------------- goals
  private bline(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, size: number, color: string, ox = 0, oy = 0) {
    g.fillStyle = color;
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0, y = y0;
    const off = Math.floor(size / 2);
    for (let i = 0; i < 2000; i++) {
      g.fillRect(x - off - ox, y - off - oy, size, size);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  private net(g: CanvasRenderingContext2D, q: [number, number, number][], nu: number, nv: number, ox = 0, oy = 0) {
    const L = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const col = 'rgba(214,224,236,0.55)';
    for (let i = 0; i <= nu; i++) {
      const t = i / nu;
      const A = this.P3(...L(q[0], q[1], t)), B = this.P3(...L(q[3], q[2], t));
      this.bline(g, A[0], A[1], B[0], B[1], 1, col, ox, oy);
    }
    for (let j = 0; j <= nv; j++) {
      const t = j / nv;
      const A = this.P3(...L(q[0], q[3], t)), B = this.P3(...L(q[1], q[2], t));
      this.bline(g, A[0], A[1], B[0], B[1], 1, col, ox, oy);
    }
  }

  private post(g: CanvasRenderingContext2D, a: [number, number], b: [number, number], ox = 0, oy = 0) {
    this.bline(g, a[0], a[1], b[0], b[1], 4, '#120c1c', ox, oy);
    this.bline(g, a[0], a[1], b[0], b[1], 2, '#f4f6fa', ox, oy);
  }

  private goalGeom(s: number) {
    const P = this.P;
    return { gx: s * P.hw, bx: s * (P.hw + P.goalDepth), gh: P.goalHalf, h: P.goalHeight, hb: P.goalHeight * 0.75 };
  }

  private drawGoalBack(g: CanvasRenderingContext2D, s: number) {
    const { gx, bx, gh, h, hb } = this.goalGeom(s);
    const x0 = Math.min(this.WX(gx), this.WX(bx)), x1 = Math.max(this.WX(gx), this.WX(bx));
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(x0, this.WY(-gh), x1 - x0, this.WY(gh) - this.WY(-gh));
    this.net(g, [[bx, -gh, 0], [bx, gh, 0], [bx, gh, hb], [bx, -gh, hb]], 14, 5);
    this.net(g, [[gx, -gh, 0], [bx, -gh, 0], [bx, -gh, hb], [gx, -gh, h]], 5, 5);
    this.post(g, this.P3(gx, -gh, 0), this.P3(gx, -gh, h));
  }

  private buildGoalFront(s: number): Sprite {
    const { gx, bx, gh, h, hb } = this.goalGeom(s);
    const pts = [this.P3(gx, -gh, h), this.P3(bx, -gh, hb), this.P3(bx, gh, hb), this.P3(gx, gh, h), this.P3(gx, gh, 0), this.P3(bx, gh, 0)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const ox = Math.min(...xs) - 4, oy = Math.min(...ys) - 4;
    const c = document.createElement('canvas');
    c.width = Math.max(...xs) - ox + 8;
    c.height = Math.max(...ys) - oy + 8;
    const g = c.getContext('2d')!;
    this.net(g, [[gx, -gh, h], [bx, -gh, hb], [bx, gh, hb], [gx, gh, h]], 5, 14, ox, oy);
    this.net(g, [[gx, gh, 0], [bx, gh, 0], [bx, gh, hb], [gx, gh, h]], 5, 5, ox, oy);
    const a = this.P3(gx, -gh, h), b = this.P3(gx, gh, h);
    this.post(g, a, b, ox, oy);
    this.post(g, this.P3(gx, gh, 0), this.P3(gx, gh, h), ox, oy);
    return { c, x: ox, y: oy };
  }

  // ---------------------------------------------------------------- frame
  draw(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    ctx.imageSmoothingEnabled = false;
    const bx = cam.originX - this.OX, by = cam.originY - this.OY;
    ctx.fillStyle = '#0a101c';
    ctx.fillRect(0, 0, cam.W, cam.H);

    // crowd animation frame
    let vi = 0;
    if (this.variants.length > 1) {
      const exc = m.excitement;
      const rate = exc > 0.75 ? 7 : exc > 0.45 ? 3 : 0.8;
      const step = Math.floor(time * rate);
      vi = exc > 0.45 ? 1 + (step % 2) : step % 6 === 0 ? 1 : 0;
    }
    ctx.drawImage(this.variants[vi], bx, by);

    // LED boards (scrolling)
    const L = this.ledRect;
    const off = Math.floor(time * 18) % this.led.width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx + L.x0, by + L.y, L.x1 - L.x0, L.h);
    ctx.clip();
    for (let x = L.x0 - off; x < L.x1; x += this.led.width) ctx.drawImage(this.led, bx + x, by + L.y);
    ctx.restore();

    // camera flashes in the crowd
    if (m.excitement > 0.6 && settings.quality === 'high') {
      const n = Math.floor((m.excitement - 0.5) * 10);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < n; i++) {
        if (Math.random() > 0.4) continue;
        const r = this.standRects[Math.floor(Math.random() * this.standRects.length)];
        const x = bx + r[0] + Math.floor(Math.random() * (r[2] - r[0]));
        const y = by + r[1] + Math.floor(Math.random() * (r[3] - r[1]));
        ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
        ctx.fillStyle = '#ffffff';
      }
    }

    // shadows
    for (const p of m.all) {
      const lying = p.state === 'down' || p.state === 'slide' || p.state === 'dive' || p.state === 'recover';
      const sh = lying ? shadow(11, 2) : shadow(6, 2);
      ctx.drawImage(sh, cam.sx(p.x) - (sh.width >> 1) + 1, cam.sy(p.y) - (sh.height >> 1));
    }
    const b = m.ball;
    {
      const k = clamp(1 - b.z / 5, 0.4, 1);
      const sh = shadow(3 * k + 0.5, 1);
      ctx.drawImage(sh, cam.sx(b.x) - (sh.width >> 1) + Math.round(b.z * 2), cam.sy(b.y) - (sh.height >> 1));
    }

    this.drawGroundMarkers(ctx, cam, time);

    type Ent = { y: number; draw: () => void };
    const ents: Ent[] = [];
    for (const p of m.all) ents.push({ y: p.y, draw: () => this.drawPlayer(ctx, cam, p, time) });
    const ballY = b.owner ? b.owner.y + (b.owner.faceY > 0 ? 0.05 : -0.05) : b.y;
    ents.push({ y: ballY, draw: () => this.drawBall(ctx, cam) });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) ents.push({ y: sy * this.P.hh, draw: () => this.drawFlag(ctx, cam, sx * this.P.hw, sy * this.P.hh, time) });
    ents.sort((a, c) => a.y - c.y);
    for (const e of ents) e.draw();

    // goal fronts (with a little net shake after a goal)
    this.goalFront.forEach((gf, i) => {
      const s = i === 0 ? -1 : 1;
      const shake = m.ball.inGoal === s && m.goalFlash > 0.3 ? Math.round(Math.sin(time * 60) * 1) : 0;
      ctx.drawImage(gf.c, bx + gf.x + shake, by + gf.y);
    });
    ctx.drawImage(this.frontBoard.c, bx + this.frontBoard.x, by + this.frontBoard.y);

    this.drawOverheads(ctx, cam, time);
    m.fx.draw(ctx, cam);
    this.drawPost(ctx, cam);
  }

  private drawFlag(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, time: number) {
    const X = cam.sx(x), Y = cam.sy(y);
    ctx.fillStyle = '#120c1c';
    ctx.fillRect(X - 1, Y - 21, 3, 22);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(X, Y - 20, 1, 21);
    const t = x > 0 ? this.m.teams[1].def : this.m.teams[0].def;
    const rp = ramp(t.primary);
    const wave = Math.floor(time * 6 + x) % 3;
    for (let i = 0; i < 7; i++) {
      const off = Math.round(Math.sin(i * 0.9 + wave * 2.1));
      ctx.fillStyle = css(rp[i < 2 ? 3 : 2]);
      ctx.fillRect(X + 1 + i, Y - 20 + off, 1, 5 - Math.floor(i / 3));
    }
  }

  private frameFor(p: Player, time: number): string {
    const b = this.m.ball;
    switch (p.state) {
      case 'slide': return 'slide';
      case 'down': return p.stateT < 0.25 ? 'down1' : 'down0';
      case 'recover': return 'getup';
      case 'dive': return 'dive';
      case 'celebrate': return Math.floor(p.stateT * 7) % 2 ? 'cel0' : 'cel1';
      case 'shove': return 'shove';
      case 'sad': return Math.hypot(p.vx, p.vy) > 0.5 ? (Math.floor(p.runPhase / Math.PI) % 2 ? 'sad0' : 'sad1') : 'sad0';
    }
    if (p.kickAnim > 0) {
      const k = 1 - p.kickAnim / 0.3;
      return k < 0.25 ? 'kick0' : k < 0.6 ? 'kick1' : 'kick2';
    }
    if (p.chargeKind === 'shot') return 'charge';
    if (p.isGK && b.owner === p) return 'hold';
    if (p.z > 0.25) return 'header';
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 0.7) return Math.floor(time * 1.8 + p.idx * 0.7) % 2 ? 'idle0' : 'idle1';
    const f = Math.floor(((p.runPhase / (Math.PI * 2)) * 6) % 6);
    return 'run' + ((f + 6) % 6);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, cam: Camera, p: Player, time: number) {
    const x = cam.sx(p.x), y = cam.sy(p.y, p.z);
    if (x < -30 || x > cam.W + 30 || y < -10 || y > cam.H + 40) return;
    const look = this.looks.get(p)!;
    const sheet = playerSheet(look).canvas;
    const fi = FRAMES[this.frameFor(p, time)] ?? 0;
    let left = Math.cos(p.face) < 0;
    if (p.state === 'spin') left = Math.floor(p.stateT / 0.06) % 2 === 0 ? !left : left;
    const flash = p.state === 'down' && p.stateT < 0.1;
    const row = (left ? 1 : 0) + (flash ? 2 : 0);
    ctx.drawImage(sheet, fi * CELL_W, row * CELL_H, CELL_W, CELL_H, x - ANCHOR_X, y - ANCHOR_Y, CELL_W, CELL_H);
    if (p.frozen > 0) {
      // ice block around the frozen player
      const lying = p.state === 'down' || p.state === 'recover';
      const w = lying ? 30 : 16, h = lying ? 12 : 30;
      const bx = x - (w >> 1), by = y - h + 1;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#8ad8ff';
      ctx.fillRect(bx, by, w, h);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#e8f8ff';
      ctx.fillRect(bx, by, w, 1);
      ctx.fillRect(bx, by, 1, h);
      ctx.fillRect(bx + 2, by + 2, 1, 4);
      ctx.fillRect(bx + 3, by + 2, 2, 1);
      ctx.fillStyle = '#2a78b8';
      ctx.fillRect(bx + w - 1, by, 1, h);
      ctx.fillRect(bx, by + h - 1, w, 1);
      ctx.globalAlpha = 1;
    }
    if (p.star && p !== this.m.human && p.state !== 'down' && !this.m.replaying) {
      // small star over the user's created player
      ctx.fillStyle = '#120c1c';
      ctx.fillRect(x - 2, y - 37, 5, 5);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(x - 1, y - 36, 3, 3);
      ctx.fillRect(x, y - 37, 1, 5);
      ctx.fillRect(x - 2, y - 35, 5, 1);
    }
  }

  private drawBall(ctx: CanvasRenderingContext2D, cam: Camera) {
    const b = this.m.ball;
    const x = cam.sx(b.x), y = cam.sy(b.y, b.z) - 4;
    // motion trail
    if (b.trail.length > 1) {
      for (let i = 0; i < b.trail.length - 1; i++) {
        const t = b.trail[i];
        const k = i / b.trail.length;
        ctx.fillStyle = b.fire > 0 ? (k > 0.5 ? '#ffd25a' : '#ff6a1a') : `rgba(255,255,255,${0.15 + k * 0.35})`;
        const sz = b.fire > 0 ? 2 + Math.floor(k * 3) : 1 + Math.floor(k * 2);
        ctx.fillRect(cam.sx(t.x) - (sz >> 1), cam.sy(t.y, t.z) - 4 - (sz >> 1), sz, sz);
      }
    }
    const f = ballFrame(Math.floor(b.rot * 1.2), b.fire > 0);
    ctx.drawImage(f, x - (BALL_SIZE >> 1), y - (BALL_SIZE >> 1));
  }

  private drawGroundMarkers(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    const h = m.human;
    if (m.passHint && h && m.ball.owner === h && Math.floor(time * 4) % 2 === 0) {
      const r = ring(8, 3, '#ffffff');
      ctx.drawImage(r, cam.sx(m.passHint.x) - (r.width >> 1), cam.sy(m.passHint.y) - (r.height >> 1) + 1);
    }
    if (h && m.phase !== 'goal' && !m.replaying) {
      const pulse = Math.floor(time * 4) % 2;
      const r = ring(9 + pulse, 3 + pulse, '#ffe14d');
      ctx.drawImage(r, cam.sx(h.x) - (r.width >> 1), cam.sy(h.y) - (r.height >> 1) + 1);
      // facing tick
      const fx = cam.sx(h.x + Math.cos(h.face) * 0.85), fy = cam.sy(h.y + Math.sin(h.face) * 0.85);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(fx - 1, fy - 1, 2, 2);
      // aim dots while charging
      if (h.chargeKind === 'shot' && m.ball.owner === h) {
        const tgt = m.aimAtGoal(h, m.aimX, m.aimY);
        let ax = m.aimX, ay = m.aimY, len = 5;
        if (tgt) {
          const dx = tgt[0] - h.x, dy = tgt[1] - h.y;
          const d = Math.hypot(dx, dy);
          ax = dx / d;
          ay = dy / d;
          len = Math.min(d, 9);
        }
        const march = (time * 6) % 0.6;
        for (let t = 1 + march; t < len; t += 0.6) {
          const X = cam.sx(h.x + ax * t), Y = cam.sy(h.y + ay * t);
          ctx.fillStyle = '#120c1c';
          ctx.fillRect(X - 1, Y, 3, 2);
          ctx.fillStyle = t > len - 0.7 ? '#ff5a3a' : '#ffe14d';
          ctx.fillRect(X - 1, Y - 1, 2, 2);
        }
      }
    }
  }

  private drawOverheads(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    const h = m.human;
    if (!h || m.phase === 'goal' || m.phase === 'over' || m.replaying) return;
    const x = cam.sx(h.x);
    const top = cam.sy(h.y, h.z) - 40 - (Math.floor(time * 3) % 2);
    if (x < 0 || x > cam.W || top < -10 || cam.sy(h.y) > cam.H + 10) {
      // offscreen marker
      const cx = clamp(x, 10, cam.W - 10), cy = clamp(cam.sy(h.y, 1), 26, cam.H - 10);
      ctx.fillStyle = '#120c1c';
      ctx.fillRect(cx - 7, cy - 6, 14, 12);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(cx - 6, cy - 5, 12, 10);
      drawText(ctx, String(h.number), cx, cy - 3, { color: '#120c1c', align: 'center', outline: null });
      return;
    }
    const ar = arrow('#ffe14d');
    ctx.drawImage(ar, x - (ar.width >> 1), top);
    // stamina
    let yb = top - 5;
    if (h.stamina < 0.999) {
      ctx.fillStyle = '#120c1c';
      ctx.fillRect(x - 9, yb - 1, 18, 4);
      ctx.fillStyle = '#2a3046';
      ctx.fillRect(x - 8, yb, 16, 2);
      ctx.fillStyle = h.exhausted ? (Math.floor(time * 8) % 2 ? '#ff5a4a' : '#a02a20') : '#5ff0a4';
      ctx.fillRect(x - 8, yb, Math.round(16 * h.stamina), 2);
      yb -= 5;
    }
    if (h.chargeKind !== 'none') {
      const w = 26, hh = 4;
      ctx.fillStyle = '#120c1c';
      ctx.fillRect(x - w / 2 - 1, yb - hh, w + 2, hh + 2);
      ctx.fillStyle = '#2a3046';
      ctx.fillRect(x - w / 2, yb - hh + 1, w, hh);
      const max = h.chargeKind === 'shot' ? 1.3 : 1;
      const k = clamp(h.charge / max, 0, 1);
      const n = Math.round(w * k);
      for (let i = 0; i < n; i++) {
        const t = i / w;
        let c = '#7fd3ff';
        if (h.chargeKind === 'shot') c = t < 0.45 ? '#5ff0a4' : t < 0.65 ? '#ffe14d' : t < 1 / 1.3 ? '#ff9a2e' : '#ff3b30';
        ctx.fillStyle = c;
        ctx.fillRect(x - w / 2 + i, yb - hh + 1, 1, hh);
      }
      ctx.fillStyle = '#ffffff';
      const mark = h.chargeKind === 'shot' ? Math.round(w / 1.3) : Math.round(w * 0.28);
      ctx.fillRect(x - w / 2 + mark, yb - hh, 1, hh + 2);
    }
  }

  private drawPost(ctx: CanvasRenderingContext2D, cam: Camera) {
    const W = cam.W, H = cam.H;
    const key = `${W}x${H}`;
    if (this.vigKey !== key) {
      // dithered pixel vignette
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d')!;
      const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      g.fillStyle = 'rgba(4,6,14,0.45)';
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
          const v = Math.max(0, Math.hypot(dx * 0.8, dy * 0.9) - 0.88) * 1.6;
          if (v <= 0) continue;
          if (v * 16 > BAYER[(y & 3) * 4 + (x & 3)]) g.fillRect(x, y, 1, 1);
        }
      this.vignette = c;
      this.vigKey = key;
    }
    ctx.drawImage(this.vignette!, 0, 0);
    const fx = this.m.fx;
    if (fx.flash > 0) {
      ctx.globalAlpha = Math.min(0.7, fx.flash * 0.6);
      ctx.fillStyle = fx.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    void TAU;
  }
}
