import type { Match } from './match';
import type { Camera } from './camera';
import { PPM, YS } from './camera';
import type { Pitch, Player, MysteryBox, Bomb, Bullet } from './entities';
import { tierColors, itemById } from '../meta/items';
import type { TeamDef } from './teams';
import { playerSheet, FRAMES, CELL_W, CELL_H, ANCHOR_X, ANCHOR_Y, SS, PlayerLook } from '../pixel/player';
import { ballFrame, shadow, ring, arrow, BALL_SIZE } from '../pixel/props';
import { ramp, css, RGB } from '../pixel/palette';
import { drawText, measure, textCanvas } from '../pixel/font';
import { clamp, hexToRgb, TAU, pick } from '../engine/math';
import { settings } from '../engine/storage';

const SPONSORS = ['MADFOOT', 'BONK COLA', 'NO RULES', 'TURBO BOOTS', 'GG ENERGY', 'KICK HARD', 'RAGE FM', 'SLIDE CO.'];
const GRASS: RGB[] = ['#174a24', '#1f5e2c', '#277035', '#2f803c', '#389045', '#45a050', '#57b05c'].map((h) => hexToRgb(h) as RGB);
const DIRT: RGB[] = ['#4f5a2c', '#5d6532', '#6c703c', '#7a7a46'].map((h) => hexToRgb(h) as RGB);
const LINE: RGB = [236, 242, 230];
const LINE_W: RGB = [205, 220, 200];
const RAINBOW = ['#ff3b30', '#ff9a1f', '#ffe14d', '#5ff0a4', '#3bd9ff', '#b04cff', '#ff3fa4'];
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
  /** waving flags in the stands: stadium-pixel x / y (pole base), colours, phase */
  private flags: { x: number; y: number; c1: string; c2: string; ph: number; big: boolean }[] = [];
  private looks = new Map<Player, PlayerLook>();

  constructor(private m: Match) {
    this.P = m.pitch;
    for (const p of m.all) {
      const look: PlayerLook = { kit: p.team.def, isGK: p.isGK, skin: p.skin, hair: p.hair, hairStyle: p.hairStyle, beard: p.beard, face: p.faceShape, eyes: p.eyes, eyeColor: p.eyeColor, boot: itemById(p.team.boots)?.boot };
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
    // tall objects at the ends lean outward a little, so the goal frames read clearly
    return [this.WX(x) + Math.round(z * PPM * 0.3 * Math.sign(x)), this.WY(y, z)];
  }

  // ---------------------------------------------------------------- turf wear
  private wear: HTMLCanvasElement | null = null;
  private wearG: CanvasRenderingContext2D | null = null;
  private wearLvl: Uint8Array = new Uint8Array(0);
  private wearX = 0;
  private wearY = 0;
  private wearW = 0;
  private wearH = 0;

  private initWear() {
    const P = this.P;
    // only the grass inside the boards wears
    const x0 = this.WX(-P.hw - P.margin), x1 = this.WX(P.hw + P.margin);
    const y0 = this.WY(-P.hh - P.margin), y1 = this.WY(P.hh + P.margin);
    this.wearX = x0;
    this.wearY = y0;
    this.wearW = x1 - x0;
    this.wearH = y1 - y0;
    const c = document.createElement('canvas');
    c.width = this.wearW;
    c.height = this.wearH;
    this.wear = c;
    this.wearG = c.getContext('2d')!;
    this.wearLvl = new Uint8Array(this.wearW * this.wearH);
  }

  /** Apply queued wear events from the match to the persistent wear layer. */
  private paintWear() {
    const q = this.m.wearQ;
    if (!q.length) return;
    if (!this.wear) this.initWear();
    const g = this.wearG!;
    const W = this.wearW, H = this.wearH;
    for (const [wx, wy, r, amt, kind] of q) {
      const cx = this.WX(wx) - this.wearX, cy = this.WY(wy) - this.wearY;
      const rx = Math.max(1, r * PPM), ry = Math.max(1, r * PPM * YS);
      const minX = Math.max(0, Math.floor(cx - rx)), maxX = Math.min(W - 1, Math.ceil(cx + rx));
      const minY = Math.max(0, Math.floor(cy - ry)), maxY = Math.min(H - 1, Math.ceil(cy + ry));
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
          if (d > 1) continue;
          // ragged, dithered edges
          if (Math.random() > (1 - d * d) * 0.9 + 0.1) continue;
          const i = y * W + x;
          const before = this.wearLvl[i];
          const add = amt * (1 - d * 0.6) * (0.6 + Math.random() * 0.8);
          const lvl = kind === 2 ? 255 : Math.min(250, before + add);
          this.wearLvl[i] = lvl;
          const band = (v: number) => (v < 28 ? 0 : v < 80 ? 1 : v < 140 ? 2 : v < 205 ? 3 : 4);
          if (band(lvl) === band(before) && kind !== 2) continue;
          g.clearRect(x, y, 1, 1);
          if (kind === 2) g.fillStyle = Math.random() < 0.5 ? '#1e1a14' : '#2c241a'; // scorch
          else {
            const b = band(lvl);
            if (b === 0) continue;
            const c = DIRT[[3, 3, 2, 1, 0][b]];
            const alpha = [0, 0.45, 0.8, 1, 1][b];
            g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
          }
          g.fillRect(x, y, 1, 1);
        }
    }
    q.length = 0;
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

    // ---- waving flags in the crowd (drawn live)
    this.flags = [];
    const hdef = this.m.teams[0].def, adef = this.m.teams[1].def;
    let fk = 7;
    const addFlag = (x: number, y: number) => {
      fk++;
      const home = x < W / 2 ? hash(fk, 5) < 0.8 : hash(fk, 5) < 0.25;
      const t = home ? hdef : adef;
      this.flags.push({ x, y, c1: t.primary, c2: t.secondary, ph: hash(fk, 9) * 6.28, big: hash(fk, 4) < 0.25 });
    };
    for (let x = 18; x < W - 18; x += 26 + Math.floor(hash(x, 3) * 22)) addFlag(x, topY1 - 6 - Math.floor(hash(x, 8) * 3) * 7);
    for (let x = 24; x < W - 24; x += 34 + Math.floor(hash(x, 6) * 26)) addFlag(x, botY0 + 10 + Math.floor(hash(x, 2) * 2) * 7);

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
    // turf wear: slides, falls, sprints and bombs leave marks that stay for the match
    this.paintWear();
    if (this.wear) ctx.drawImage(this.wear, bx + this.wearX, by + this.wearY);

    this.drawFlags(ctx, bx, by, time);

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
    ents.push({ y: ballY, draw: () => this.drawBall(ctx, cam, time) });
    for (const bx of m.boxes) ents.push({ y: bx.y, draw: () => this.drawBox(ctx, cam, bx, time) });
    for (const bm of m.bombs) ents.push({ y: bm.y, draw: () => this.drawBomb(ctx, cam, bm, time) });
    for (const bl of m.bullets) ents.push({ y: bl.y + 0.3, draw: () => this.drawBullet(ctx, cam, bl, time) });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) ents.push({ y: sy * this.P.hh, draw: () => this.drawFlag(ctx, cam, sx * this.P.hw, sy * this.P.hh, time) });
    ents.sort((a, c) => a.y - c.y);
    for (const e of ents) e.draw();

    // goal fronts (with a little net shake after a goal)
    this.goalFront.forEach((gf, i) => {
      const s = i === 0 ? -1 : 1;
      let shake = m.ball.inGoal === s && m.goalFlash > 0.3 ? Math.round(Math.sin(time * 60) * 1) : 0;
      // the woodwork rattles after the ball hits it
      const ph = m.postHit[i];
      let vy = 0;
      if (ph > 0) {
        const amp = Math.ceil(ph * 4);
        shake += Math.round(Math.sin(time * 70) * amp);
        vy = Math.round(Math.cos(time * 55) * Math.min(1, amp / 2));
      }
      ctx.drawImage(gf.c, bx + gf.x + shake, by + gf.y + vy);
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
    if (p.isGK && b.owner === p) {
      // a back pass is played with the feet: little taps from foot to foot
      if (p.feetBall) return Math.floor(time * 5) % 2 ? 'run1' : 'run4';
      return 'hold';
    }
    if (p.z > 0.25) return 'header';
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 0.7) {
      if (p.isGK && p.yawnT > 0) return p.yawnT > 0.5 && p.yawnT < 1.4 ? 'yawn1' : 'yawn0';
      if (!p.isGK && (p.exhausted || p.stamina < 0.22) && p.state === 'run') return Math.floor(time * 2.6 + p.idx) % 2 ? 'tired0' : 'tired1';
      return Math.floor(time * 1.8 + p.idx * 0.7) % 2 ? 'idle0' : 'idle1';
    }
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
    ctx.drawImage(sheet, fi * CELL_W * SS, row * CELL_H * SS, CELL_W * SS, CELL_H * SS, x - ANCHOR_X, y - ANCHOR_Y, CELL_W, CELL_H);
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
    if (p.isGK && p.yawnT > 0 && p.state === 'run') {
      // a sleepy "z z" drifting up
      const k = 1 - p.yawnT / 1.7;
      for (let i = 0; i < 2; i++) {
        const kk = (k * 1.3 - i * 0.35);
        if (kk <= 0 || kk >= 1) continue;
        drawText(ctx, i ? 'Z' : 'z', x + 6 + i * 4 + Math.round(Math.sin(kk * 6) * 2), y - 38 - Math.round(kk * 10), { color: '#ffffff', outline: '#120c1c', align: 'center' });
      }
    }
    if (p.shield > 0 && (p.shield > 1.2 || Math.floor(time * 10) % 2 === 0)) {
      // force-field bubble
      const r = 13 + Math.round(Math.sin(time * 8));
      const cy = y - 14;
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#3bd9ff';
      ctx.beginPath();
      ctx.ellipse(x, cy, r, r + 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#bff4ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x + 0.5, cy + 0.5, r, r + 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - r + 4, cy - r + 3, 2, 1);
      ctx.fillRect(x - r + 3, cy - r + 4, 1, 2);
      ctx.globalAlpha = 1;
    }
    if (p.drink > 0 && Math.floor(time * 8) % 2 === 0) {
      ctx.fillStyle = '#5ff0a4';
      ctx.fillRect(x - 1, y - 33, 3, 1);
    }
    if (p.magnet > 0 && Math.floor(time * 6) % 2 === 0) {
      ctx.fillStyle = '#ff3b5a';
      ctx.fillRect(x - 3, y - 2, 2, 1);
      ctx.fillStyle = '#3bd9ff';
      ctx.fillRect(x + 2, y - 2, 2, 1);
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

  /** Fans' flags: they wave harder (and more of them go up) as the excitement rises. */
  private drawFlags(ctx: CanvasRenderingContext2D, bx: number, by: number, time: number) {
    const exc = this.m.excitement;
    const speed = 5 + exc * 9;
    for (let i = 0; i < this.flags.length; i++) {
      const f = this.flags[i];
      // only some flags are up when the stadium is calm
      if (exc < 0.5 && i % 3 !== 0) continue;
      if (exc < 0.75 && i % 3 === 2) continue;
      const lift = Math.round(Math.max(0, Math.sin(time * 2.2 + f.ph)) * 2 * exc);
      const sway = Math.round(Math.sin(time * 1.6 + f.ph) * (1 + exc));
      const x0 = bx + f.x, y0 = by + f.y - lift;
      const fw = f.big ? 11 : 8, fh = f.big ? 7 : 5, pole = f.big ? 12 : 9;
      const topX = x0 + sway;
      // pole
      ctx.fillStyle = '#d8d0c0';
      for (let j = 0; j < pole; j++) ctx.fillRect(Math.round(x0 + (sway * j) / pole), y0 - j, 1, 1);
      // cloth: each column ripples on its own
      for (let c = 0; c < fw; c++) {
        const wv = Math.round(Math.sin(time * speed + f.ph - c * 0.9) * (0.6 + exc * 0.9));
        const yTop = y0 - pole + wv;
        for (let r = 0; r < fh; r++) {
          const band = (r / fh) < 0.5 ? f.c1 : f.c2;
          ctx.fillStyle = band;
          ctx.fillRect(topX + 1 + c, yTop + r, 1, 1);
        }
        // light / shade on the folds
        if (wv < 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fillRect(topX + 1 + c, yTop, 1, fh);
        } else if (wv > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(topX + 1 + c, yTop, 1, fh);
        }
      }
    }
  }

  // ---------------------------------------------------------------- special items

  /**
   * Mystery box: a hovering, spinning cube whose faces flow through the rainbow,
   * with a moving shine, glowing edges, a halo, a light beam, ripples and twinkles.
   */
  private drawBox(ctx: CanvasRenderingContext2D, cam: Camera, bx: MysteryBox, time: number) {
    const t = time + bx.seed;
    const grow = Math.min(1, bx.age / 0.45);
    const pop = grow < 1 ? 1 + Math.sin(grow * Math.PI) * 0.45 : 1 + Math.sin(t * 5) * 0.04;
    const hover = 0.55 + Math.sin(t * 3) * 0.14;
    const X = cam.sx(bx.x), Yg = cam.sy(bx.y);
    if (X < -40 || X > cam.W + 40 || Yg < -50 || Yg > cam.H + 30) return;
    const baseHue = (t * 110) % 360;
    const hi = settings.quality === 'high';

    // ---- ground: shadow, pulsing rainbow ring and expanding ripples
    const sh = shadow(6, 2);
    ctx.drawImage(sh, X - (sh.width >> 1), Yg - (sh.height >> 1));
    const ringCol = RAINBOW[Math.floor(t * 8) % 7];
    const gl = ring(10 + (Math.floor(t * 4) % 2), 3, ringCol);
    ctx.drawImage(gl, X - (gl.width >> 1), Yg - (gl.height >> 1) + 1);
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.8 + i * 0.5) % 1;
      const rr = ring(6 + k * 14, 2 + k * 5, RAINBOW[(Math.floor(t * 3) + i * 3) % 7]);
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.drawImage(rr, X - (rr.width >> 1), Yg - (rr.height >> 1) + 1);
    }
    ctx.globalAlpha = 1;

    const s = Math.max(1, Math.round(8 * grow * pop));
    const h = s * 2;
    const Y = cam.sy(bx.y, hover);
    const cy = Y - s;

    // ---- halo + light beam (additive)
    ctx.globalCompositeOperation = 'lighter';
    const halo = this.haloSprite(Math.floor(baseHue / 30) % 12);
    ctx.globalAlpha = 0.85 + Math.sin(t * 6) * 0.15;
    ctx.drawImage(halo, X - (halo.width >> 1), cy - (halo.height >> 1));
    if (hi) {
      // light beam rising from the top of the cube, fading out
      const top = Y - h - 2, len = 38;
      const flick = 0.85 + Math.sin(t * 11) * 0.15;
      for (let i = 0; i < len; i += 2) {
        const f = (1 - i / len) * flick;
        ctx.globalAlpha = 0.32 * f;
        ctx.fillStyle = `hsl(${(baseHue + i * 6) % 360},100%,68%)`;
        ctx.fillRect(X - 3, top - i - 2, 7, 2);
        ctx.globalAlpha = 0.4 * f;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(X - 1, top - i - 2, 3, 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // ---- cube geometry
    const ang = t * 2.2;
    const R = s * Math.SQRT2;
    const cs = [0, 1, 2, 3].map((k) => {
      const a = ang + (k * Math.PI) / 2;
      return { x: X + Math.cos(a) * R, dy: Math.sin(a) * R * 0.45 };
    });
    // shine band sweeping across the cube every ~2 s
    const sweep = ((t * 0.55) % 1) * (s * 7) - s * 2.5;
    const px = (x: number, y: number, hue: number, light: number) => {
      const d = x - X + (y - cy) * 0.8 - sweep;
      if (d > 0 && d < 3) light = Math.min(97, light + 32);
      ctx.fillStyle = `hsl(${hue % 360},100%,${light}%)`;
      ctx.fillRect(x, y, 1, 1);
    };
    const edges: number[] = [];
    for (let k = 0; k < 4; k++) {
      const c0 = cs[k], c1 = cs[(k + 1) % 4];
      const facing = Math.sin(ang + (k * Math.PI) / 2 + Math.PI / 4);
      if (facing <= 0.02) continue;
      const x0 = Math.round(Math.min(c0.x, c1.x)), x1 = Math.round(Math.max(c0.x, c1.x));
      if (x1 - x0 < 1) continue;
      for (let x = x0; x < x1; x++) {
        const u = clamp((x + 0.5 - c0.x) / (c1.x - c0.x), 0, 1);
        const yb = Math.round(Y + c0.dy + (c1.dy - c0.dy) * u), yt = yb - h;
        for (let y = yt; y < yb; y++) {
          const v = (y - yt) / h;
          // rainbow flows diagonally over the faces; lighter at the top
          const hue = baseHue + (x - X) * 9 + (y - cy) * 7 + k * 30 + 720;
          px(x, y, hue, 38 + facing * 20 + (1 - v) * 14);
        }
        ctx.fillStyle = '#120c1c';
        ctx.fillRect(x, yb, 1, 1);
      }
      edges.push(x0, x1 - 1);
      // "?" on the face, squeezed with the rotation, pulsing white
      const fw = x1 - x0;
      if (fw >= 4) {
        const q = this.qGlyph();
        const mid = (c0.dy + c1.dy) / 2;
        const gw = Math.max(2, Math.round(fw * 0.6)), gh = Math.round(h * 0.72);
        const gx = Math.round((x0 + x1) / 2 - gw / 2), gy = Math.round(Y + mid - h + (h - gh) / 2);
        ctx.globalAlpha = 0.5;
        ctx.drawImage(this.qShadow(), gx + 1, gy + 1, gw, gh);
        ctx.globalAlpha = 0.85 + Math.sin(t * 8) * 0.15;
        ctx.drawImage(q, gx, gy, gw, gh);
        ctx.globalAlpha = 1;
      }
    }
    // glowing vertical edges
    for (const ex of edges) {
      const c = cs.reduce((a, b) => (Math.abs(b.x - ex) < Math.abs(a.x - ex) ? b : a));
      const yb = Math.round(Y + c.dy);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(ex, yb - h, 1, h);
    }
    // top face
    const tops = cs.map((c) => [c.x, Y + c.dy - h] as [number, number]);
    const minX = Math.round(Math.min(...tops.map((p) => p[0]))), maxX = Math.round(Math.max(...tops.map((p) => p[0])));
    for (let x = minX; x <= maxX; x++) {
      let lo = Infinity, hi2 = -Infinity;
      for (let k = 0; k < 4; k++) {
        const [ax, ay] = tops[k], [bx2, by2] = tops[(k + 1) % 4];
        if ((x + 0.5 - ax) * (x + 0.5 - bx2) > 0 || ax === bx2) continue;
        const y = ay + ((x + 0.5 - ax) / (bx2 - ax)) * (by2 - ay);
        lo = Math.min(lo, y);
        hi2 = Math.max(hi2, y);
      }
      if (lo > hi2) continue;
      const y0 = Math.round(lo), y1 = Math.max(y0 + 1, Math.round(hi2));
      for (let y = y0; y < y1; y++) px(x, y, baseHue + 180 + (x - X) * 9 - (y - cy) * 9 + 720, 72);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y0, 1, 1);
      ctx.fillStyle = '#120c1c';
      ctx.fillRect(x, y0 - 1, 1, 1);
    }
    // silhouette sides
    ctx.fillStyle = '#120c1c';
    const left = Math.round(Math.min(...cs.map((c) => c.x))), right = Math.round(Math.max(...cs.map((c) => c.x)));
    const lc = cs.reduce((a, b) => (b.x < a.x ? b : a)), rc = cs.reduce((a, b) => (b.x > a.x ? b : a));
    ctx.fillRect(left - 1, Math.round(Y + lc.dy) - h, 1, h + 1);
    ctx.fillRect(right, Math.round(Y + rc.dy) - h, 1, h + 1);

    // ---- twinkles: 4-point stars popping around the box
    const n = hi ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const ph = (t * 1.3 + i * 0.37) % 1;
      const seed = Math.floor(t * 1.3 + i * 0.37) * 7 + i * 13;
      const a = hash(seed, i) * Math.PI * 2;
      const r = s + 4 + hash(i, seed) * 9;
      const sx = Math.round(X + Math.cos(a) * r), sy = Math.round(cy + Math.sin(a) * r * 0.8 - ph * 4);
      const size = ph < 0.5 ? Math.round(ph * 6) : Math.round((1 - ph) * 6);
      ctx.fillStyle = RAINBOW[(i * 2 + Math.floor(t * 5)) % 7];
      ctx.fillRect(sx - size, sy, size * 2 + 1, 1);
      ctx.fillRect(sx, sy - size, 1, size * 2 + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, 1, 1);
    }
    // orbiting sparkle trail
    for (let i = 0; i < 6; i++) {
      const a = t * 3 - i * 0.18;
      const sx = Math.round(X + Math.cos(a) * (s + 8)), sy = Math.round(cy + Math.sin(a) * (s * 0.5 + 4));
      ctx.globalAlpha = 1 - i / 6;
      ctx.fillStyle = i === 0 ? '#ffffff' : RAINBOW[(i + Math.floor(t * 6)) % 7];
      ctx.fillRect(sx, sy, i === 0 ? 2 : 1, i === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }

  private halos = new Map<number, HTMLCanvasElement>();
  /** Soft, dithered glow disc tinted with one of 12 hues (cached). */
  private haloSprite(i: number) {
    let c = this.halos.get(i);
    if (c) return c;
    const R = 20;
    c = document.createElement('canvas');
    c.width = c.height = R * 2 + 1;
    const g = c.getContext('2d')!;
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    g.fillStyle = `hsl(${i * 30},100%,62%)`;
    for (let y = 0; y <= R * 2; y++)
      for (let x = 0; x <= R * 2; x++) {
        const d = Math.hypot(x - R, (y - R) * 1.15) / R;
        if (d >= 1) continue;
        const v = (1 - d) * (1 - d);
        if (v * 16 > BAYER[(y & 3) * 4 + (x & 3)]) g.fillRect(x, y, 1, 1);
      }
    this.halos.set(i, c);
    return c;
  }

  private qCanvas: HTMLCanvasElement | null = null;
  private qShadowC: HTMLCanvasElement | null = null;
  private qGlyph() {
    return (this.qCanvas ??= textCanvas('?', { color: '#ffffff', outline: null }));
  }
  private qShadow() {
    return (this.qShadowC ??= textCanvas('?', { color: '#120c1c', outline: null }));
  }

  private drawBomb(ctx: CanvasRenderingContext2D, cam: Camera, bm: Bomb, time: number) {
    const X = cam.sx(bm.x), Y = cam.sy(bm.y, bm.z) - 3;
    const sh = shadow(3, 1);
    ctx.drawImage(sh, cam.sx(bm.x) - (sh.width >> 1), cam.sy(bm.y) - (sh.height >> 1));
    const hot = bm.fuse < 0.45 && Math.floor(time * 16) % 2 === 0;
    ctx.fillStyle = '#120c1c';
    ctx.fillRect(X - 3, Y - 2, 7, 5);
    ctx.fillRect(X - 2, Y - 3, 5, 7);
    ctx.fillStyle = hot ? '#ff3b30' : '#3a3a4e';
    ctx.fillRect(X - 2, Y - 2, 5, 5);
    ctx.fillStyle = hot ? '#ffb0a0' : '#7a7a96';
    ctx.fillRect(X - 1, Y - 1, 1, 1);
    const tc = tierColors(bm.tier, time);
    if (tc) {
      ctx.fillStyle = tc[0];
      ctx.fillRect(X - 2, Y + 1, 5, 1);
    }
    // fuse + spark
    ctx.fillStyle = '#c8a070';
    ctx.fillRect(X + 1, Y - 4, 1, 1);
    ctx.fillStyle = Math.floor(time * 20) % 2 ? '#ffe14d' : '#ffffff';
    ctx.fillRect(X + 2, Y - 5, 1, 1);
  }

  private drawBullet(ctx: CanvasRenderingContext2D, cam: Camera, bl: Bullet, time: number) {
    if (bl.delay > 0) return;
    const X = cam.sx(bl.x), Y = cam.sy(bl.y, 0.9);
    const [ux, uy] = [bl.vx / 34, (bl.vy / 34) * 0.75];
    const tc = tierColors(bl.tier, time);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i === 0 ? '#ffffff' : i < 2 ? '#fff3a0' : tc ? tc[i % tc.length] : '#ffb02e';
      ctx.fillRect(Math.round(X - ux * i), Math.round(Y - uy * i), 1, 1);
    }
  }

  private drawBall(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const b = this.m.ball;
    const x = cam.sx(b.x), y = cam.sy(b.y, b.z) - 4;
    const tc = b.fire > 0 ? tierColors(b.tier, time) : null;
    // motion trail
    if (b.trail.length > 1) {
      for (let i = 0; i < b.trail.length - 1; i++) {
        const t = b.trail[i];
        const k = i / b.trail.length;
        ctx.fillStyle = tc ? tc[i % tc.length] : b.fire > 0 ? (k > 0.5 ? '#ffd25a' : '#ff6a1a') : `rgba(255,255,255,${0.15 + k * 0.35})`;
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
    // team rings under every player: your side cyan, the opponents red (always readable, whatever the kits)
    if (m.teams[0].human && !m.replaying) {
      for (const p of m.all) {
        if (p === h || p.state === 'down' || p.state === 'dive') continue;
        const mine = p.team === m.teams[0];
        const r = ring(7, 2, mine ? '#4fd8ff' : '#ff4a4a');
        ctx.globalAlpha = 0.9;
        ctx.drawImage(r, cam.sx(p.x) - (r.width >> 1), cam.sy(p.y) - (r.height >> 1) + 1);
      }
      ctx.globalAlpha = 1;
    }
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
      // faint, elegant aim line toward where the ball would go
      if (settings.aimLine && m.aim && m.ball.owner === h) this.drawAimLine(ctx, cam, h, time);
    }
  }

  private drawAimLine(ctx: CanvasRenderingContext2D, cam: Camera, h: Player, time: number) {
    const a = this.m.aim!;
    if (this.m.aimPath && this.m.aimPath.length > 2) return this.drawAimPath(ctx, cam, h, time);
    const dx = a.x - h.x, dy = a.y - h.y;
    const len = Math.hypot(dx, dy);
    if (len < 1.2) return;
    const ux = dx / len, uy = dy / len;
    const start = 0.9;
    const end = a.kind === 'free' ? Math.min(len, 6) : len;
    const charging = h.chargeKind !== 'none';
    const lob = h.chargeKind === 'pass' && h.charge > 0.28;
    const arcH = lob ? 1.2 + h.charge * 1.6 : 0;
    const base = a.kind === 'free' ? 0.28 : 0.42;
    const boost = charging ? Math.min(1, h.charge) * 0.35 : 0;
    const col = a.kind === 'shot' ? (charging ? '255,226,120' : '255,246,210') : '255,255,255';
    // sample in screen space so dots are evenly spaced
    const x0 = cam.sx(h.x + ux * start), y0 = cam.sy(h.y + uy * start);
    const x1 = cam.sx(h.x + ux * end), y1 = cam.sy(h.y + uy * end);
    const steps = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 3));
    const march = (time * 10) % 1;
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(1, (i + march) / steps);
      const wx = h.x + ux * (start + (end - start) * t), wy = h.y + uy * (start + (end - start) * t);
      const z = arcH ? 4 * arcH * t * (1 - t) : 0;
      const alpha = (base + boost) * (1 - t * 0.8);
      ctx.fillStyle = `rgba(${col},${alpha.toFixed(3)})`;
      ctx.fillRect(cam.sx(wx), cam.sy(wy, z), 1, 1);
    }
    // end marker
    const ex = cam.sx(h.x + ux * end), ey = cam.sy(h.y + uy * end);
    const ma = (base + boost) * 0.9;
    ctx.fillStyle = `rgba(${col},${ma.toFixed(3)})`;
    if (a.kind === 'pass') {
      ctx.fillRect(ex - 2, ey, 1, 1);
      ctx.fillRect(ex + 2, ey, 1, 1);
      ctx.fillRect(ex, ey - 1, 1, 1);
      ctx.fillRect(ex, ey + 1, 1, 1);
    } else if (a.kind === 'shot') {
      ctx.fillRect(ex - 1, ey, 3, 1);
      ctx.fillRect(ex, ey - 1, 1, 3);
    }
  }

  /** Dotted preview of a (curled) shot while charging. */
  private drawAimPath(ctx: CanvasRenderingContext2D, cam: Camera, h: Player, time: number) {
    const path = this.m.aimPath!;
    const a = this.m.aim!;
    const curled = Math.abs(this.m.curl) > 0.05;
    const col = a.kind === 'pass' ? '160,220,255' : curled ? '255,226,120' : '255,246,210';
    const boost = Math.min(1, h.charge) * 0.3;
    let acc = (time * 30) % 3;
    let px = cam.sx(path[0][0]), py = cam.sy(path[0][1]);
    const total = path.length;
    for (let i = 1; i < total; i++) {
      const nx = cam.sx(path[i][0]), ny = cam.sy(path[i][1]);
      acc += Math.hypot(nx - px, ny - py);
      px = nx;
      py = ny;
      if (i < 3 || acc < 3) continue;
      acc = 0;
      const alpha = (0.45 + boost) * (1 - (i / total) * 0.6);
      ctx.fillStyle = `rgba(${col},${alpha.toFixed(3)})`;
      ctx.fillRect(nx, ny, 1, 1);
    }
    const [ex, ey] = path[total - 1];
    ctx.fillStyle = `rgba(${col},${(0.6 + boost).toFixed(3)})`;
    const X = cam.sx(ex), Y = cam.sy(ey);
    ctx.fillRect(X - 1, Y, 3, 1);
    ctx.fillRect(X, Y - 1, 1, 3);
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
    // stamina, charge, keeper timer and item effects are drawn above the head by the DOM HUD (domhud.ts)
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
