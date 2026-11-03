import type { Match } from './match';
import type { Camera } from './camera';
import { PPM, YS } from './camera';
import type { Pitch, Player } from './entities';
import type { TeamDef } from './teams';
import type { GroundMark, CornerFlag } from './pitchfx';
import { FLAG_LEN } from './pitchfx';
import { playerSheet, drawPlayerFrame, FRAMES, ANCHOR_X, ANCHOR_Y, PlayerLook } from '../pixel/player';
import { ballFrame, shadow, ring, arrow, star, BALL_SIZE } from '../pixel/props';
import { ramp, css } from '../pixel/palette';
import { drawText, measure } from '../pixel/font';
import { clamp, pick } from '../engine/math';
import { settings } from '../engine/storage';
import { hiCanvas, HiCanvas, bgRes, pitchRes, vw, vh, hash2 as hash, bayer, pxLine, pxDisc, pxFill, snap, U, PXD } from '../engine/gfx';

const SPONSORS = ['MADFOOT', 'BONK COLA', 'NO RULES', 'TURBO BOOTS', 'GG ENERGY', 'KICK HARD', 'RAGE FM', 'SLIDE CO.'];
const SKINS = ['#f1cfb0', '#d9a882', '#b47b55', '#7c5135', '#5a3722'];
const HAIRS = ['#1a1310', '#3b2416', '#6b3e1f', '#c98a3a', '#2a2a2a', '#7a1a10'];

/** turf + soil palette (hue-shifted pixel-art ramps) */
const GRASS = ['#1d5a2a', '#24692f', '#2b7a36', '#33883d', '#3c9646', '#4aa552', '#5cb460'];
const SOIL = ['#4a3a22', '#5b4728', '#6b5530', '#7c663c'];
const DRY = ['#6f7a38', '#808a42'];

export class Renderer {
  private P: Pitch;
  private OX = 0;
  private OY = 0;
  private SW = 0;
  private SH = 0;
  private variants: HiCanvas[] = [];
  private pitchC!: HiCanvas;
  private pg!: CanvasRenderingContext2D;
  private pr = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private frontBoard!: { c: HiCanvas; x: number; y: number };
  private led!: HiCanvas;
  private ledRect = { x0: 0, x1: 0, y: 0, h: 12 };
  private vignette: HiCanvas | null = null;
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
    return snap(x * PPM) + this.OX;
  }
  private WY(y: number, z = 0) {
    return snap(y * PPM * YS - z * PPM) + this.OY;
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
    this.SW = W;
    this.SH = H;
    const [base, g] = hiCanvas(W, H, bgRes());
    g.fillStyle = '#0a101c';
    g.fillRect(0, 0, W, H);

    const [h, a] = [this.m.teams[0].def, this.m.teams[1].def];
    const px0 = Math.round(this.WX(-ex)), px1 = Math.round(this.WX(ex)), py0 = Math.round(this.WY(-ey)), py1 = Math.round(this.WY(ey));
    this.pr = { x0: px0, y0: py0, x1: px1, y1: py1 };
    const boardH = 13;
    const topY1 = py0 - boardH - 2;
    const botY0 = py1 + 12;

    // ---- stands: banded concrete tiers with seat rows
    const tier = (x0: number, y0: number, x1: number, y1: number, vertical: boolean, near = false) => {
      g.fillStyle = near ? '#161c2c' : '#1c2337';
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (!vertical) {
        for (let y = y1 - 1; y >= y0; y -= 7) {
          g.fillStyle = near ? '#20283c' : '#2b3550';
          g.fillRect(x0, y - 6, x1 - x0, 3);
          g.fillStyle = '#323d5a';
          g.fillRect(x0, y - 6, x1 - x0, U);
          g.fillStyle = '#10141f';
          g.fillRect(x0, y, x1 - x0, 1);
        }
      } else {
        for (let x = x0; x < x1; x += 7) {
          g.fillStyle = '#26304a';
          g.fillRect(x, y0, 3, y1 - y0);
          g.fillStyle = '#323d5a';
          g.fillRect(x, y0, U, y1 - y0);
          g.fillStyle = '#10141f';
          g.fillRect(x + 6, y0, 1, y1 - y0);
        }
      }
    };
    tier(0, 18, W, topY1, false);
    for (let x = 60; x < W; x += 170) {
      g.fillStyle = '#323c56';
      g.fillRect(x, 18, 5, topY1 - 18);
      g.fillStyle = '#242c42';
      for (let y = 20; y < topY1; y += 2) g.fillRect(x, y, 5, U);
    }
    tier(0, py0 - boardH, px0 - 6, py1 + 2, true);
    tier(px1 + 6, py0 - boardH, W, py1 + 2, true);
    tier(0, botY0, W, H, false, true);
    g.fillStyle = '#0d121e';
    g.fillRect(0, py1 + 1, W, 11);
    this.standRects = [
      [0, 18, W, topY1],
      [0, py0 - boardH, px0 - 6, py1],
      [px1 + 6, py0 - boardH, W, py1],
      [0, botY0, W, H],
    ];

    // ---- boards
    g.fillStyle = '#05070d';
    g.fillRect(px0 - 2, py0 - boardH - 1, px1 - px0 + 4, boardH + 1);
    g.fillStyle = '#3a4766';
    g.fillRect(px0 - 2, py0 - boardH - 2, px1 - px0 + 4, 1);
    g.fillStyle = '#5a6a90';
    g.fillRect(px0 - 2, py0 - boardH - 2, px1 - px0 + 4, U);
    this.ledRect = { x0: px0, x1: px1, y: py0 - boardH, h: boardH - 2 };
    for (const s of [-1, 1]) {
      const bx = s > 0 ? px1 + 1 : px0 - 6;
      g.fillStyle = '#121a2c';
      g.fillRect(bx, py0 - boardH, 5, py1 - py0 + boardH);
      g.fillStyle = '#26304a';
      g.fillRect(s > 0 ? bx : bx + 4, py0 - boardH, 1, py1 - py0 + boardH);
      g.fillStyle = '#3a4766';
      g.fillRect(bx, py0 - boardH, 5, U * 2);
      g.fillStyle = s < 0 ? h.primary : a.primary;
      g.fillRect(bx + 2, py0 - boardH + 2, 1, py1 - py0 + boardH - 4);
    }

    // ---- pitch (separate canvas; receives dynamic wear)
    this.buildPitch();

    // ---- near (bottom) board, drawn over players
    const fw = px1 - px0 + 4;
    const [fb, fg] = hiCanvas(fw, 12);
    fg.fillStyle = '#141b2c';
    fg.fillRect(0, 0, fw, 12);
    fg.fillStyle = '#3a4766';
    fg.fillRect(0, 0, fw, 1);
    fg.fillStyle = '#5a6a90';
    fg.fillRect(0, 0, fw, U);
    fg.fillStyle = '#0a0e18';
    fg.fillRect(0, 11, fw, 1);
    let fx = 10, i = 0;
    while (fx < fw - 30) {
      const t = SPONSORS[i % SPONSORS.length];
      drawText(fg, t, fx, 3, { color: i % 2 ? '#56648a' : '#6c7aa0', scale: 0.85, outline: null });
      fx += measure(t, 0.85) + 34;
      i++;
    }
    this.frontBoard = { c: fb, x: px0 - 2, y: py1 - 10 };

    this.led = this.buildLed(h, a);

    // roof + floodlights (over the crowd)
    const roof = (cg: CanvasRenderingContext2D) => {
      cg.fillStyle = '#060a12';
      cg.fillRect(0, 0, W, 18);
      cg.fillStyle = '#121a2a';
      cg.fillRect(0, 14, W, 2);
      cg.fillStyle = '#2a3550';
      cg.fillRect(0, 16, W, 2);
      cg.fillStyle = '#3a4766';
      cg.fillRect(0, 16, W, U);
      for (let x = 16; x < W; x += 36) {
        // dithered glow halo
        cg.beginPath();
        const inner: number[] = [];
        for (let yy = 0; yy < 28 * PXD; yy++)
          for (let xx = -14 * PXD; xx < 16 * PXD; xx++) {
            const d = Math.hypot(xx / PXD - 1.5, (yy / PXD - 10) * 1.2) / 14;
            if (d >= 1) continue;
            const gx = Math.round((x + xx / PXD) * PXD), gy = yy;
            if ((1 - d) * (1 - d) * 0.75 > bayer(gx, gy)) {
              if (d < 0.35) inner.push(gx, gy);
              else cg.rect(gx / PXD, gy / PXD, U, U);
            }
          }
        cg.fillStyle = 'rgba(255,240,190,0.14)';
        cg.fill();
        cg.beginPath();
        for (let k = 0; k < inner.length; k += 2) cg.rect(inner[k] / PXD, inner[k + 1] / PXD, U, U);
        cg.fillStyle = 'rgba(255,240,190,0.35)';
        cg.fill();
        cg.fillStyle = '#5a5430';
        cg.fillRect(x - 1.5, 7.5, 6, 5);
        cg.fillStyle = '#fff4c4';
        cg.fillRect(x - 1, 8, 5, 4);
        cg.fillStyle = '#fffdf0';
        cg.fillRect(x, 9, 3, 2);
      }
    };

    // ---- crowd variants
    const nVar = settings.quality === 'high' ? 3 : 1;
    for (let v = 0; v < nVar; v++) {
      const [c, cg] = hiCanvas(W, H, bgRes());
      cg.drawImage(base, 0, 0);
      this.drawCrowd(cg, v, h, a, { px0, px1, py0, py1, topY1, botY0, W, H, boardH });
      roof(cg);
      this.variants.push(c);
    }
  }

  private buildPitch() {
    const P = this.P;
    const { x0, y0, x1, y1 } = this.pr;
    const pw = x1 - x0, ph = y1 - y0;
    const res = pitchRes();
    const [c, g] = hiCanvas(pw, ph, res);
    g.translate(-x0, -y0);
    this.pitchC = c;
    this.pg = g;

    // ---- grass: mowing stripes + checker, per framebuffer pixel with tufts
    const BW = c.width, BH = c.height;
    const img = g.getImageData(0, 0, BW, BH);
    const d = img.data;
    const G = GRASS.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const tuft = new Uint8Array(BW);
    for (let y = 0; y < BH; y++) {
      const wy = (y0 + (y + 0.5) / res - this.OY) / (PPM * YS);
      const band = Math.floor((wy + 400) / 4) % 2;
      for (let x = 0; x < BW; x++) {
        const wx = (x0 + (x + 0.5) / res - this.OX) / PPM;
        const inField = Math.abs(wx) <= P.hw && Math.abs(wy) <= P.hh;
        const stripe = Math.floor((wx + 400) / 4) % 2;
        let t = 3 + stripe;
        if (!inField) t -= 1;
        const r = hash(x, y);
        if (r < 0.1) t -= 1;
        else if (r > 0.94) t += 1;
        if (band && ((x + y) & 1) === 0 && r < 0.35) t += 1;
        if (tuft[x]) {
          t -= 1;
          tuft[x] = 0;
        }
        if (r > 0.985) {
          t += 2;
          tuft[x] = 1;
        }
        // large patches via ordered dithering
        if (hash(x >> 5, y >> 4) < 0.18 && bayer(x, y) < 0.3) t -= 1;
        const col = G[clamp(t, 0, G.length - 1)];
        const o = (y * BW + x) * 4;
        d[o] = col[0];
        d[o + 1] = col[1];
        d[o + 2] = col[2];
        d[o + 3] = 255;
      }
    }
    // ---- lines (hard pixels)
    const lw = 0.75; // half width in virtual px
    const setLine = (bx: number, by: number) => {
      if (bx < 0 || by < 0 || bx >= BW || by >= BH) return;
      const o = (by * BW + bx) * 4;
      const worn = hash(bx * 3, by * 7) < 0.1;
      d[o] = worn ? 205 : 238;
      d[o + 1] = worn ? 222 : 243;
      d[o + 2] = worn ? 200 : 232;
    };
    const hline = (ax: number, bx: number, wy: number) => {
      const Y = (this.WY(wy) - y0) * res;
      const A = Math.round((this.WX(ax) - x0 - lw) * res), B = Math.round((this.WX(bx) - x0 + lw) * res);
      for (let yy = Math.round(Y - lw * res); yy < Math.round(Y + lw * res); yy++) for (let xx = A; xx < B; xx++) setLine(xx, yy);
    };
    const vline = (wx: number, ay: number, by: number) => {
      const X = (this.WX(wx) - x0) * res;
      const A = Math.round((this.WY(ay) - y0 - lw) * res), B = Math.round((this.WY(by) - y0 + lw) * res);
      for (let xx = Math.round(X - lw * res); xx < Math.round(X + lw * res); xx++) for (let yy = A; yy < B; yy++) setLine(xx, yy);
    };
    const rect = (ax: number, ay: number, bx: number, by: number) => {
      hline(ax, bx, ay);
      hline(ax, bx, by);
      vline(ax, ay, by);
      vline(bx, ay, by);
    };
    const ellipse = (cx: number, cy: number, r: number, keep: (wx: number, wy: number) => boolean) => {
      const rx = r * PPM, ry = r * PPM * YS;
      const X = this.WX(cx) - x0, Y = this.WY(cy) - y0;
      for (let by = Math.floor((Y - ry - 2) * res); by <= (Y + ry + 2) * res; by++)
        for (let bx = Math.floor((X - rx - 2) * res); bx <= (X + rx + 2) * res; bx++) {
          const dx = (bx + 0.5) / res - X, dy = (by + 0.5) / res - Y;
          const f = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) - 1;
          const gr = 2 * Math.sqrt((dx / (rx * rx)) ** 2 + (dy / (ry * ry)) ** 2) || 1;
          const sd = f / gr;
          if (Math.abs(sd) < lw && keep((x0 + (bx + 0.5) / res - this.OX) / PPM, (y0 + (by + 0.5) / res - this.OY) / (PPM * YS))) setLine(bx, by);
        }
    };
    const spot = (wx: number, wy: number) => {
      const X = (this.WX(wx) - x0) * res, Y = (this.WY(wy) - y0) * res;
      for (let yy = -2; yy < 2; yy++) for (let xx = -3; xx < 3; xx++) if (!((xx === -3 || xx === 2) && (yy === -2 || yy === 1))) setLine(Math.round(X) + xx, Math.round(Y) + yy);
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
      ellipse(sp, 0, P.centerR * 0.85, (wx) => (s > 0 ? wx < edge - 0.08 : wx > edge + 0.08));
      for (const sy of [-1, 1]) ellipse(gx, sy * P.hh, 1, (wx, wy) => Math.abs(wx) <= P.hw + 0.05 && Math.abs(wy) <= P.hh + 0.05);
    }
    // stand shadow along the top + darker near edge (ordered dither)
    for (let y = 0; y < BH; y++) {
      const vy = y / res;
      const k = vy < 26 ? (1 - vy / 26) * 0.9 : ph - vy < 12 ? (1 - (ph - vy) / 12) * 0.6 : 0;
      if (k <= 0) continue;
      for (let x = 0; x < BW; x++) {
        if (k <= bayer(x, y)) continue;
        const o = (y * BW + x) * 4;
        d[o] = d[o] * 0.78;
        d[o + 1] = d[o + 1] * 0.8;
        d[o + 2] = d[o + 2] * 0.86;
      }
    }
    g.putImageData(img, 0, 0);

    // pre-existing wear in the goal mouths and centre spot
    for (const [cx, cy, rad, pr] of [[-P.hw + 1.3, 0, 3.0, 1], [P.hw - 1.3, 0, 3.0, 1], [0, 0, 1.4, 0.45]] as const) {
      const cnt = Math.round(60 * pr * rad);
      for (let i = 0; i < cnt; i++) {
        const a = hash(i, cx * 10 + 3) * Math.PI * 2, dd = Math.pow(hash(i, cy + 17 + cx), 0.8) * rad;
        const k = 1 - dd / rad;
        const dry = hash(i, 9) < 0.4;
        this.blob(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd * 1.2, 0.1 + hash(i, 5) * 0.2, dry ? DRY[i % 2] : SOIL[i % 4], (0.25 + k * 0.5) * pr, 1.3, hash(i, 6) * 3, hash);
      }
    }

    // goal shadows on the grass
    for (const s of [-1, 1]) {
      const gx = this.WX(s * P.hw), bx = this.WX(s * (P.hw + P.goalDepth));
      g.fillStyle = 'rgba(0,20,8,0.25)';
      pxFill(g, Math.min(gx, bx), this.WY(-P.goalHalf), Math.abs(bx - gx) + 2, this.WY(P.goalHalf) - this.WY(-P.goalHalf) + 3);
    }
  }

  /**
   * Dithered soil blob stamped into the turf (world coords). Coverage is random,
   * so repeated stamps keep wearing the grass down.
   */
  private blob(wx: number, wy: number, r: number, color: string, density: number, stretch = 1, ang = 0, rng: (a: number, b: number) => number = () => Math.random()) {
    const g = this.pg;
    const X = this.WX(wx), Y = this.WY(wy);
    const R = r * PPM;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const ext = R * Math.max(stretch, 1) + 1;
    g.fillStyle = color;
    g.beginPath();
    let n = 0;
    for (let by = Math.floor((Y - ext) * PXD); by <= (Y + ext) * PXD; by++)
      for (let bx = Math.floor((X - ext) * PXD); bx <= (X + ext) * PXD; bx++) {
        const dx = (bx + 0.5) / PXD - X, dy = (by + 0.5) / PXD - Y;
        const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
        const q = (lx / (R * stretch)) ** 2 + (ly / (R * YS)) ** 2;
        if (q >= 1) continue;
        if (rng(bx * 7 + n++, by * 13) < density * Math.pow(1 - q, 0.6)) g.rect(bx / PXD, by / PXD, U, U);
      }
    g.fill();
  }

  /** Permanently stamp a wear event into the turf. */
  private stamp(mk: GroundMark) {
    const l = Math.hypot(mk.dx, mk.dy) || 1;
    const ux = mk.dx / l, uy = mk.dy / l;
    const ang = Math.atan2(uy * YS, ux);
    const s = mk.s;
    const rnd = Math.random;
    switch (mk.kind) {
      case 'skid': {
        // two churned grooves (legs) + flattened, paler grass + torn tufts
        const px = -uy, py = ux;
        for (const side of [-1, 1]) this.blob(mk.x + px * side * 0.13, mk.y + py * side * 0.13, 0.13, pick(SOIL), 0.22 * s, 2.4, ang);
        this.blob(mk.x, mk.y, 0.28, DRY[0], 0.06 * s, 1.8, ang);
        if (rnd() < 0.3 * s) {
          const side = rnd() < 0.5 ? -1 : 1;
          this.blob(mk.x + px * side * 0.38, mk.y + py * side * 0.38, 0.06, GRASS[6], 0.9, 1.4, ang);
        }
        break;
      }
      case 'divot': {
        const cx = mk.x - ux * 0.15, cy = mk.y - uy * 0.15;
        const n = 4 + Math.round(s * 4);
        for (let i = 0; i < n; i++) {
          const ox = (rnd() - 0.5) * 0.45 + ux * (rnd() - 0.3) * 0.5, oy = (rnd() - 0.5) * 0.35 + uy * (rnd() - 0.3) * 0.5;
          this.blob(cx + ox, cy + oy, 0.07 + rnd() * 0.12 * s, pick(SOIL), 0.7, 1.4, ang);
        }
        this.blob(cx, cy, 0.12 * s + 0.05, SOIL[0], 0.95, 1.5, ang);
        this.blob(mk.x + ux * 0.35, mk.y + uy * 0.35, 0.1, GRASS[1], 0.9, 1.5, ang + 0.4);
        break;
      }
      case 'fall':
        this.blob(mk.x, mk.y, 0.4, pick(SOIL), 0.05 * s, 2, ang);
        this.blob(mk.x, mk.y, 0.3, DRY[1], 0.06 * s, 2.2, ang);
        break;
      case 'step': {
        const px = -uy * 0.1, py = ux * 0.1;
        this.blob(mk.x + px, mk.y + py, 0.05, pick(SOIL), 0.5 * s, 1.4, ang);
        this.blob(mk.x - px + ux * 0.3, mk.y - py + uy * 0.3, 0.05, pick(SOIL), 0.5 * s, 1.4, ang);
        break;
      }
      case 'scorch':
        this.blob(mk.x, mk.y, 0.6 * s, '#2a2018', 0.6, 1.3, ang);
        break;
    }
  }

  private consumeMarks() {
    const ms = this.m.props.marks;
    if (ms.length) {
      for (const mk of ms) this.stamp(mk);
      ms.length = 0;
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
    // pixel fan: 6×7 body, 4×4 head (framebuffer pixels)
    const fan = (x: number, y: number, k: number, back: boolean, shade: number) => {
      const jumping = v > 0 && Math.floor(hash(k, 3) * 3) === v - 1;
      const yy = y - (jumping ? 1.5 : 0);
      const col = shirt(x, k);
      const rp = ramp(col);
      const skin = SKINS[Math.floor(hash(k, 11) * SKINS.length)];
      const hair = HAIRS[Math.floor(hash(k, 13) * HAIRS.length)];
      const t = (i: number) => css(rp[clamp(i - shade, 0, 3)]);
      g.fillStyle = t(2);
      g.fillRect(x - 1.5, yy - 3, 3, 3);
      g.fillRect(x - 1, yy - 3.5, 2, U);
      g.fillStyle = t(3);
      g.fillRect(x - 1.5, yy - 3, U, 2.5);
      g.fillStyle = t(1);
      g.fillRect(x + 1, yy - 3, U, 3);
      g.fillStyle = back ? hair : skin;
      g.fillRect(x - 1, yy - 5.5, 2, 2);
      g.fillRect(x - 0.5, yy - 6, 1, U);
      if (!back) {
        g.fillStyle = hair;
        g.fillRect(x - 1, yy - 6, 2, 1);
        g.fillStyle = '#16121e';
        g.fillRect(x + (hash(k, 21) < 0.5 ? -0.5 : 0), yy - 4.5, U, U);
      }
      if (jumping) {
        g.fillStyle = skin;
        g.fillRect(x - 2, yy - 6, U, 2.5);
        g.fillRect(x + 1.5, yy - 6, U, 2.5);
        if (hash(k, 17) < 0.15) {
          const tdef = col === h.primary || col === h.secondary ? h : a;
          for (let i = 0; i < 12; i++) {
            g.fillStyle = Math.floor(i / 2) % 2 ? tdef.secondary : tdef.primary;
            g.fillRect(x - 3 + i * U, yy - 7.5 + (i % 3 === 0 ? U : 0), U, 1.5);
          }
        }
      }
    };
    let k = 0;
    const rows = Math.floor((L.topY1 - 26) / 7);
    let row = 0;
    for (let y = L.topY1 - 2; y > 24; y -= 7) {
      const shade = row > rows * 0.6 ? 1 : 0;
      row++;
      for (let x = 3; x < L.W - 3; x += 5) {
        k++;
        if (hash(k, 1) < 0.07) continue;
        if (((x - 60) % 170 + 170) % 170 < 7) continue;
        fan(x + (hash(k, 2) < 0.5 ? 0 : 1), y, k, false, shade);
      }
    }
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 4 : L.px1 + 10, x1 = side < 0 ? L.px0 - 9 : L.W - 4;
      for (let x = x0; x < x1; x += 7) {
        const far = side < 0 ? (x1 - x) / (x1 - x0) : (x - x0) / (x1 - x0);
        for (let y = L.py0 - L.boardH + 6; y < L.py1; y += 6) {
          k++;
          if (hash(k, 1) < 0.08) continue;
          fan(x + 3, y, k, false, far > 0.6 ? 1 : 0);
        }
      }
    }
    for (let y = L.botY0 + 6; y < L.H + 6; y += 7) {
      for (let x = 3; x < L.W - 3; x += 5) {
        k++;
        if (hash(k, 1) < 0.07) continue;
        fan(x, y, k, true, 0);
      }
    }
    // tifo banners hanging on the top stand
    const banner = (cx: number, t: TeamDef) => {
      const w = 36, hh = 13, y = L.topY1 - hh - 4;
      for (let i = 0; i < w * PXD; i++) {
        const off = snap(Math.sin(i * 0.15 + v * 1.3) * 0.9);
        const shade = Math.sin(i * 0.15 + v * 1.3) > 0.5;
        for (let j = 0; j < 3; j++) {
          g.fillStyle = j === 1 ? t.secondary : t.primary;
          g.fillRect(cx + i * U, y + off + (j * hh) / 3, U, hh / 3 + U);
        }
        if (shade) {
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(cx + i * U, y + off, U, hh + U);
        }
      }
      g.fillStyle = '#120c1c';
      g.fillRect(cx - 1, y - 1.5, w + 2, 1);
      drawText(g, t.short, cx + w / 2, y + 3, { color: '#fff', align: 'center', outline: '#120c1c', thick: 0.5 });
    };
    banner(Math.round(L.W * 0.22), h);
    banner(Math.round(L.W * 0.36), h);
    banner(Math.round(L.W * 0.62), a);
    banner(Math.round(L.W * 0.76), a);
  }

  private buildLed(h: TeamDef, a: TeamDef) {
    const items = [...SPONSORS, h.name, a.name];
    const H = this.ledRect.h;
    const widths = items.map((t) => Math.round(measure(t) + 24));
    const W = widths.reduce((x, y) => x + y, 0);
    const [c, g] = hiCanvas(W, H);
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
      g.fillRect(x, H - 1.5, widths[i], 1.5);
      const [r, gg, b] = rp[2];
      const light = r * 0.3 + gg * 0.59 + b * 0.11 > 150;
      drawText(g, t, x + widths[i] / 2, Math.floor((H - 7) / 2), { color: light ? '#111' : '#fff', align: 'center', outline: null });
      g.fillStyle = '#05070d';
      g.fillRect(x + widths[i] - U, 0, U, H);
      x += widths[i];
    });
    // LED pixel grid
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = U; y < H; y += 1) g.fillRect(0, y, W, U);
    return c;
  }

  // ---------------------------------------------------------------- goals (dynamic)
  private goalProj(cam: Camera, s: number, x: number, y: number, z: number, t: number): [number, number] {
    const P = this.P;
    const i = s < 0 ? 0 : 1;
    const A = this.m.props.goalShake[i];
    const ph = this.m.props.goalT[i];
    const k = clamp(z / P.goalHeight, 0, 1.1);
    let ox = A * 2.6 * Math.sin(ph * 44) * k;
    let oy = A * 1.4 * Math.sin(ph * 44 + 1.3) * k;
    const net = this.m.props.net[i];
    const depth = (x * s - P.hw) / P.goalDepth;
    if (net.amp > 0.01 && depth > 0.05) {
      const f = Math.exp(-((y - net.y) ** 2) / 1.1 - ((z - net.z) ** 2) / 0.7) * depth * depth;
      const b = net.amp * f * (0.85 + 0.15 * Math.sin(t * 30));
      x += s * b * 0.75;
      z += b * 0.1;
    }
    if (depth > 0.05) {
      ox *= 0.6;
      oy *= 0.6;
    }
    return [cam.sx(x) + snap(z * PPM * 0.3 * Math.sign(s) + ox), cam.sy(y, z) + snap(oy)];
  }

  private netMesh(ctx: CanvasRenderingContext2D, cam: Camera, s: number, q: [number, number, number][], nu: number, nv: number, t: number) {
    const L = (a: [number, number, number], b: [number, number, number], u: number): [number, number, number] => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    const at = (u: number, v: number) => {
      const p = L(L(q[0], q[1], u), L(q[3], q[2], u), v);
      return this.goalProj(cam, s, p[0], p[1], p[2], t);
    };
    const SEG = 4;
    ctx.beginPath();
    for (let i = 0; i <= nu; i++) {
      let prev = at(i / nu, 0);
      for (let j = 1; j <= SEG; j++) {
        const cur = at(i / nu, j / SEG);
        pxLine(ctx, prev[0], prev[1], cur[0], cur[1]);
        prev = cur;
      }
    }
    for (let j = 0; j <= nv; j++) {
      let prev = at(0, j / nv);
      for (let i = 1; i <= SEG; i++) {
        const cur = at(i / SEG, j / nv);
        pxLine(ctx, prev[0], prev[1], cur[0], cur[1]);
        prev = cur;
      }
    }
    ctx.fill();
  }

  private postLine(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number]) {
    ctx.fillStyle = '#151020';
    ctx.beginPath();
    pxLine(ctx, a[0], a[1], b[0], b[1], 6);
    ctx.fill();
    ctx.fillStyle = '#c9d0de';
    ctx.beginPath();
    pxLine(ctx, a[0], a[1], b[0], b[1], 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    pxLine(ctx, a[0] - U, a[1] - U, b[0] - U, b[1] - U, 2);
    ctx.fill();
  }

  private drawGoal(ctx: CanvasRenderingContext2D, cam: Camera, s: number, part: 'back' | 'front', t: number) {
    const P = this.P;
    const gx = s * P.hw, bx = s * (P.hw + P.goalDepth), gh = P.goalHalf, h = P.goalHeight, hb = h * 0.75;
    const G = (x: number, y: number, z: number) => this.goalProj(cam, s, x, y, z, t);
    if (part === 'back') {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      const a = G(gx, -gh, 0), b = G(bx, gh, 0);
      pxFill(ctx, Math.min(a[0], b[0]), a[1], Math.abs(b[0] - a[0]), b[1] - a[1]);
      ctx.fillStyle = 'rgba(222,230,242,0.5)';
      this.netMesh(ctx, cam, s, [[bx, -gh, 0], [bx, gh, 0], [bx, gh, hb], [bx, -gh, hb]], 16, 6, t);
      this.netMesh(ctx, cam, s, [[gx, -gh, 0], [bx, -gh, 0], [bx, -gh, hb], [gx, -gh, h]], 6, 6, t);
      this.postLine(ctx, G(gx, -gh, 0), G(gx, -gh, h));
    } else {
      ctx.fillStyle = 'rgba(232,238,248,0.58)';
      this.netMesh(ctx, cam, s, [[gx, -gh, h], [bx, -gh, hb], [bx, gh, hb], [gx, gh, h]], 6, 16, t);
      this.netMesh(ctx, cam, s, [[gx, gh, 0], [bx, gh, 0], [bx, gh, hb], [gx, gh, h]], 6, 6, t);
      ctx.fillStyle = '#9aa2b4';
      ctx.beginPath();
      for (const yy of [-gh, gh]) {
        const a = G(gx, yy, h), b = G(bx, yy, hb), c = G(bx, yy, 0);
        pxLine(ctx, a[0], a[1], b[0], b[1], 2);
        pxLine(ctx, b[0], b[1], c[0], c[1], 2);
      }
      ctx.fill();
      this.postLine(ctx, G(gx, -gh, h), G(gx, gh, h));
      this.postLine(ctx, G(gx, gh, 0), G(gx, gh, h));
    }
  }

  // ---------------------------------------------------------------- corner flags
  private drawFlag(ctx: CanvasRenderingContext2D, cam: Camera, f: CornerFlag, time: number) {
    const team = f.hx > 0 ? this.m.teams[1].def : this.m.teams[0].def;
    const rp = ramp(team.primary);
    const Lpx = FLAG_LEN * PPM;
    const pole = (x0: number, y0: number, x1: number, y1: number) => {
      ctx.fillStyle = '#151020';
      ctx.beginPath();
      pxLine(ctx, x0, y0, x1, y1, 4);
      ctx.fill();
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath();
      pxLine(ctx, x0, y0, x1, y1, 2);
      ctx.fill();
      ctx.fillStyle = css(rp[2]);
      ctx.beginPath();
      for (let i = 1; i < 6; i += 2) pxLine(ctx, x0 + (x1 - x0) * (i / 6), y0 + (y1 - y0) * (i / 6), x0 + (x1 - x0) * ((i + 0.6) / 6), y0 + (y1 - y0) * ((i + 0.6) / 6), 2);
      ctx.fill();
    };
    /** flag cloth as pixel columns hanging off the pole tip */
    const cloth = (tx: number, ty: number, dirX: number, dirY: number, wave: number, droop: number) => {
      const nx = -dirY, ny = dirX;
      const side = f.hx > 0 ? -1 : 1;
      const w = 7.5, hgt = 5;
      const N = Math.round(w * PXD);
      for (let i = 0; i < N; i++) {
        const u = i / N;
        const ph = Math.sin(time * 9 + u * 3.2 + f.hy);
        const wv = ph * wave * u;
        const px = tx + nx * side * w * u + dirX * (-wv - droop * u * 3);
        const py = ty + ny * side * w * u + dirY * (-wv - droop * u * 3) + droop * u * 2;
        const ex = px - dirX * hgt * (1 - u * 0.15), ey = py - dirY * hgt * (1 - u * 0.15);
        ctx.fillStyle = css(rp[u < 0.15 ? 3 : ph > 0.4 ? 1 : 2]);
        ctx.beginPath();
        pxLine(ctx, px, py, ex, ey, 2);
        ctx.fill();
      }
    };
    if (!f.broken) {
      const X = cam.sx(f.hx), Y = cam.sy(f.hy);
      const sh = shadow(5, 1.5);
      ctx.drawImage(sh, snap(X - vw(sh) / 2 + 3), snap(Y - vh(sh) / 2));
      const dx = Math.sin(f.wob), dy = -Math.cos(f.wob);
      const tx = X + dx * Lpx, ty = Y + dy * Lpx;
      pole(X, Y, tx, ty);
      cloth(tx, ty, -dx, -dy, 1.4 + Math.abs(f.wobV) * 0.15, 0);
      return;
    }
    {
      // jagged stump left in the ground
      const X = cam.sx(f.hx), Y = cam.sy(f.hy);
      ctx.fillStyle = '#151020';
      ctx.fillRect(X - 1, Y - 4.5, 2, 5);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(X - U, Y - 4, 1, 4);
      ctx.fillRect(X - U, Y - 5, U, 1);
      ctx.fillRect(X, Y - 4.5, U, U);
    }
    const cx = cam.sx(f.x), cy = cam.sy(f.y, f.z);
    const gx = cam.sx(f.x), gy = cam.sy(f.y);
    const dx = Math.sin(f.rot), dy = -Math.cos(f.rot);
    ctx.fillStyle = 'rgba(8,26,14,0.32)';
    ctx.beginPath();
    pxLine(ctx, gx - dx * Lpx * 0.5, gy, gx + dx * Lpx * 0.5, gy, 3);
    ctx.fill();
    const bx0 = cx - dx * Lpx * 0.5, by0 = cy - dy * Lpx * 0.5;
    const tx = cx + dx * Lpx * 0.5, ty = cy + dy * Lpx * 0.5;
    pole(bx0, by0, tx, ty);
    cloth(tx, ty, -dx, -dy, f.z > 0.8 ? 2.2 : 0.6, f.z < 0.8 ? 1 : 0.3);
  }

  // ---------------------------------------------------------------- frame
  draw(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    this.consumeMarks();
    ctx.imageSmoothingEnabled = false;
    const bx = cam.originX - this.OX, by = cam.originY - this.OY;
    ctx.fillStyle = '#0a101c';
    ctx.fillRect(0, 0, cam.W, cam.H);

    let vi = 0;
    if (this.variants.length > 1) {
      const exc = m.excitement;
      const rate = exc > 0.75 ? 7 : exc > 0.45 ? 3 : 0.8;
      const step = Math.floor(time * rate);
      vi = exc > 0.45 ? 1 + (step % 2) : step % 6 === 0 ? 1 : 0;
    }
    this.blitVisible(ctx, this.variants[vi], 0, 0, this.SW, this.SH, bx, by, cam);
    const pr = this.pr;
    this.blitVisible(ctx, this.pitchC, pr.x0, pr.y0, pr.x1 - pr.x0, pr.y1 - pr.y0, bx, by, cam);

    // LED boards (scrolling)
    const L = this.ledRect;
    const lw = vw(this.led);
    const off = snap((time * 18) % lw);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx + L.x0, by + L.y, L.x1 - L.x0, L.h);
    ctx.clip();
    for (let x = L.x0 - off; x < L.x1; x += lw) ctx.drawImage(this.led, bx + x, by + L.y);
    ctx.restore();

    // camera flashes in the crowd
    if (m.excitement > 0.6 && settings.quality === 'high') {
      const n = Math.floor((m.excitement - 0.5) * 10);
      for (let i = 0; i < n; i++) {
        if (Math.random() > 0.4) continue;
        const r = this.standRects[Math.floor(Math.random() * this.standRects.length)];
        const x = snap(bx + r[0] + Math.random() * (r[2] - r[0]));
        const y = snap(by + r[1] + Math.random() * (r[3] - r[1]));
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(x - 1.5, y - U, 3.5, 1.5);
        ctx.fillRect(x - U, y - 1.5, 1.5, 3.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - U, y - U, 1.5, 1.5);
      }
    }

    for (const s of [-1, 1]) this.drawGoal(ctx, cam, s, 'back', time);

    // shadows
    for (const p of m.all) {
      const lying = p.state === 'down' || p.state === 'slide' || p.state === 'dive' || p.state === 'recover';
      const k = clamp(1 - p.z * 0.4, 0.5, 1);
      const sh = lying ? shadow(11 * k, 2.5 * k) : shadow(6.5 * k, 2 * k);
      ctx.drawImage(sh, snap(cam.sx(p.x) - vw(sh) / 2 + 1), snap(cam.sy(p.y) - vh(sh) / 2));
    }
    const b = m.ball;
    {
      const k = clamp(1 - b.z / 5, 0.4, 1);
      const sh = shadow(3 * k + 0.5, 1.2 * k + 0.3);
      ctx.drawImage(sh, snap(cam.sx(b.x) - vw(sh) / 2 + b.z * 2), snap(cam.sy(b.y) - vh(sh) / 2));
    }

    this.drawGroundMarkers(ctx, cam, time);

    type Ent = { y: number; draw: () => void };
    const ents: Ent[] = [];
    for (const p of m.all) ents.push({ y: p.y, draw: () => this.drawPlayer(ctx, cam, p, time) });
    const ballY = b.owner ? b.owner.y + (b.owner.faceY > 0 ? 0.05 : -0.05) : b.y;
    ents.push({ y: ballY, draw: () => this.drawBall(ctx, cam) });
    for (const f of m.props.flags) ents.push({ y: f.broken ? f.y : f.hy, draw: () => this.drawFlag(ctx, cam, f, time) });
    ents.sort((a, c) => a.y - c.y);
    for (const e of ents) e.draw();

    for (const s of [-1, 1]) this.drawGoal(ctx, cam, s, 'front', time);
    ctx.drawImage(this.frontBoard.c, bx + this.frontBoard.x, by + this.frontBoard.y);

    this.drawOverheads(ctx, cam, time);
    m.fx.draw(ctx, cam);
    this.drawPost(ctx, cam);
  }

  /** Draw only the on-screen part of a big layer (stadium coords → screen), on the pixel grid. */
  private blitVisible(ctx: CanvasRenderingContext2D, c: HiCanvas, sx: number, sy: number, w: number, h: number, bx: number, by: number, cam: Camera) {
    const x0 = Math.max(sx, snap(-bx) - U), y0 = Math.max(sy, snap(-by) - U);
    const x1 = Math.min(sx + w, snap(cam.W - bx) + U), y1 = Math.min(sy + h, snap(cam.H - by) + U);
    if (x1 <= x0 || y1 <= y0) return;
    ctx.drawImage(c, x0 - sx, y0 - sy, x1 - x0, y1 - y0, bx + x0, by + y0, x1 - x0, y1 - y0);
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
    drawPlayerFrame(ctx, sheet, fi, x - ANCHOR_X, y - ANCHOR_Y, left, flash);
    if (p.frozen > 0) {
      const lying = p.state === 'down' || p.state === 'recover';
      const w = lying ? 30 : 16, h = lying ? 12 : 30;
      const bx = x - w / 2, by = y - h + 1;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#8ad8ff';
      ctx.fillRect(bx, by, w, h);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#e8f8ff';
      ctx.fillRect(bx, by, w, U * 2);
      ctx.fillRect(bx, by, U * 2, h);
      ctx.fillRect(bx + 2, by + 2, U * 2, 4);
      ctx.fillRect(bx + 3, by + 2, 2, U * 2);
      ctx.fillStyle = '#2a78b8';
      ctx.fillRect(bx + w - 1, by, 1, h);
      ctx.fillRect(bx, by + h - 1, w, 1);
      ctx.globalAlpha = 1;
    }
    if (p.star && p !== this.m.human && p.state !== 'down' && !this.m.replaying) {
      const st = star();
      ctx.drawImage(st, snap(x - vw(st) / 2), y - 39);
    }
  }

  private drawBall(ctx: CanvasRenderingContext2D, cam: Camera) {
    const b = this.m.ball;
    const x = cam.sx(b.x), y = cam.sy(b.y, b.z) - 4;
    const fire = b.fire > 0;
    if (b.trail.length > 1) {
      for (let i = 1; i < b.trail.length; i++) {
        const a = b.trail[i - 1], c = b.trail[i];
        const k = i / b.trail.length;
        ctx.fillStyle = fire ? (k > 0.5 ? '#ffd25a' : '#ff6a1a') : `rgba(255,255,255,${(0.12 + k * 0.4).toFixed(2)})`;
        ctx.beginPath();
        pxLine(ctx, cam.sx(a.x), cam.sy(a.y, a.z) - 4, cam.sx(c.x), cam.sy(c.y, c.z) - 4, fire ? 2 + Math.round(k * 5) : 1 + Math.round(k * 3));
        ctx.fill();
      }
    }
    if (fire) {
      ctx.fillStyle = 'rgba(255,160,40,0.28)';
      ctx.beginPath();
      pxDisc(ctx, x, y, 9);
      ctx.fill();
      ctx.beginPath();
      pxDisc(ctx, x, y, 6);
      ctx.fill();
    }
    const f = ballFrame(Math.floor(b.rot * 1.8), fire);
    ctx.drawImage(f, x - BALL_SIZE / 2 + U, y - BALL_SIZE / 2 + U);
  }

  private drawGroundMarkers(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    const h = m.human;
    if (m.passHint && h && m.ball.owner === h && Math.floor(time * 4) % 2 === 0) {
      const r = ring(8, 3, '#ffffff');
      ctx.drawImage(r, snap(cam.sx(m.passHint.x) - vw(r) / 2), snap(cam.sy(m.passHint.y) - vh(r) / 2 + 1));
    }
    if (h && m.phase !== 'goal' && !m.replaying) {
      const pulse = Math.floor(time * 4) % 2 ? 0.5 : 0;
      const r = ring(9 + pulse, 3 + pulse, '#ffe14d');
      ctx.drawImage(r, snap(cam.sx(h.x) - vw(r) / 2), snap(cam.sy(h.y) - vh(r) / 2 + 1));
      const fx = cam.sx(h.x + Math.cos(h.face) * 0.85), fy = cam.sy(h.y + Math.sin(h.face) * 0.85);
      ctx.fillStyle = '#120c1c';
      ctx.fillRect(fx - 1.5, fy - 1, 3, 2.5);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(fx - 1, fy - U, 2, 1.5);
      if (settings.aimLine && m.aim && m.ball.owner === h) this.drawAimLine(ctx, cam, h, time);
    }
  }

  private drawAimLine(ctx: CanvasRenderingContext2D, cam: Camera, h: Player, time: number) {
    const a = this.m.aim!;
    const dx = a.x - h.x, dy = a.y - h.y;
    const len = Math.hypot(dx, dy);
    if (len < 1.2) return;
    const ux = dx / len, uy = dy / len;
    const start = 0.9;
    const end = a.kind === 'free' ? Math.min(len, 6) : len;
    const charging = h.chargeKind !== 'none';
    const lob = h.chargeKind === 'pass' && h.charge > 0.28;
    const arcH = lob ? 1.2 + h.charge * 1.6 : 0;
    const base = a.kind === 'free' ? 0.3 : 0.45;
    const boost = charging ? Math.min(1, h.charge) * 0.35 : 0;
    const col = a.kind === 'shot' ? (charging ? '255,226,120' : '255,246,210') : '255,255,255';
    const x0 = cam.sx(h.x + ux * start), y0 = cam.sy(h.y + uy * start);
    const x1 = cam.sx(h.x + ux * end), y1 = cam.sy(h.y + uy * end);
    const steps = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 3));
    const march = (time * 10) % 1;
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(1, (i + march) / steps);
      const wx = h.x + ux * (start + (end - start) * t), wy = h.y + uy * (start + (end - start) * t);
      const z = arcH ? 4 * arcH * t * (1 - t) : 0;
      ctx.fillStyle = `rgba(${col},${((base + boost) * (1 - t * 0.8)).toFixed(3)})`;
      ctx.fillRect(cam.sx(wx), cam.sy(wy, z), 1, 1);
    }
    const ex = cam.sx(h.x + ux * end), ey = cam.sy(h.y + uy * end);
    ctx.fillStyle = `rgba(${col},${((base + boost) * 0.9).toFixed(3)})`;
    if (a.kind === 'pass') {
      ctx.fillRect(ex - 2, ey, 1, 1);
      ctx.fillRect(ex + 2, ey, 1, 1);
      ctx.fillRect(ex, ey - 1, 1, 1);
      ctx.fillRect(ex, ey + 1, 1, 1);
    } else if (a.kind === 'shot') {
      ctx.fillRect(ex - 1.5, ey, 4, 1);
      ctx.fillRect(ex, ey - 1.5, 1, 4);
    }
  }

  private drawOverheads(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    const h = m.human;
    if (!h || m.phase === 'goal' || m.phase === 'over' || m.replaying) return;
    const x = cam.sx(h.x);
    const top = cam.sy(h.y, h.z) - 41 - (Math.floor(time * 3) % 2);
    if (x < 0 || x > cam.W || top < -10 || cam.sy(h.y) > cam.H + 10) {
      const cx = snap(clamp(x, 10, cam.W - 10)), cy = snap(clamp(cam.sy(h.y, 1), 26, cam.H - 10));
      ctx.fillStyle = '#120c1c';
      ctx.fillRect(cx - 7, cy - 6, 14, 12);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(cx - 6, cy - 5, 12, 10);
      ctx.fillStyle = '#fff3a0';
      ctx.fillRect(cx - 6, cy - 5, 12, U);
      drawText(ctx, String(h.number), cx, cy - 3, { color: '#120c1c', align: 'center', outline: null });
      return;
    }
    const ar = arrow('#ffe14d');
    ctx.drawImage(ar, snap(x - vw(ar) / 2), top);
    let yb = top - 4;
    const bar = (w: number, hh: number) => {
      ctx.fillStyle = '#120c1c';
      ctx.fillRect(x - w / 2 - 1, yb - hh - 1, w + 2, hh + 2);
      ctx.fillStyle = '#2a3046';
      ctx.fillRect(x - w / 2, yb - hh, w, hh);
    };
    if (h.stamina < 0.999) {
      bar(16, 2);
      ctx.fillStyle = h.exhausted ? (Math.floor(time * 8) % 2 ? '#ff5a4a' : '#a02a20') : '#5ff0a4';
      ctx.fillRect(x - 8, yb - 2, snap(16 * h.stamina), 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - 8, yb - 2, snap(16 * h.stamina), U);
      yb -= 5;
    }
    if (h.chargeKind !== 'none') {
      const w = 26, hh = 4;
      bar(w, hh);
      const max = h.chargeKind === 'shot' ? 1.3 : 1;
      const k = clamp(h.charge / max, 0, 1);
      const n = Math.round(w * PXD * k);
      for (let i = 0; i < n; i++) {
        const t = i / (w * PXD);
        let c = '#7fd3ff';
        if (h.chargeKind === 'shot') c = t < 0.45 ? '#5ff0a4' : t < 0.65 ? '#ffe14d' : t < 1 / 1.3 ? '#ff9a2e' : '#ff3b30';
        ctx.fillStyle = c;
        ctx.fillRect(x - w / 2 + i * U, yb - hh, U, hh);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - w / 2, yb - hh, n * U, U);
      ctx.fillStyle = '#ffffff';
      const mark = h.chargeKind === 'shot' ? snap(w / 1.3) : snap(w * 0.28);
      ctx.fillRect(x - w / 2 + mark, yb - hh - 1, 1, hh + 2);
    }
  }

  private drawPost(ctx: CanvasRenderingContext2D, cam: Camera) {
    const W = cam.W, H = cam.H;
    const key = `${W}x${H}`;
    if (this.vigKey !== key) {
      // ordered-dither vignette at framebuffer resolution
      const [c, g] = hiCanvas(W, H);
      const BWp = c.width, BHp = c.height;
      const img = g.getImageData(0, 0, BWp, BHp);
      for (let y = 0; y < BHp; y++)
        for (let x = 0; x < BWp; x++) {
          const dx = (x - BWp / 2) / (BWp / 2), dy = (y - BHp / 2) / (BHp / 2);
          const v = Math.max(0, Math.hypot(dx * 0.8, dy * 0.9) - 0.82) * 1.5;
          if (v <= 0 || v <= bayer(x, y)) continue;
          const o = (y * BWp + x) * 4;
          img.data[o] = 4;
          img.data[o + 1] = 6;
          img.data[o + 2] = 14;
          img.data[o + 3] = 105;
        }
      g.putImageData(img, 0, 0);
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
  }
}
