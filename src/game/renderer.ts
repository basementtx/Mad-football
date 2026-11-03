import type { Match } from './match';
import type { Camera } from './camera';
import { PPM, YS } from './camera';
import type { Pitch, Player } from './entities';
import type { TeamDef } from './teams';
import type { GroundMark, CornerFlag } from './pitchfx';
import { FLAG_LEN } from './pitchfx';
import { playerSheet, drawPlayerFrame, FRAMES, ANCHOR_X, ANCHOR_Y, PlayerLook } from '../pixel/player';
import { ballFrame, shadow, ring, arrow, BALL_SIZE } from '../pixel/props';
import { ramp, css } from '../pixel/palette';
import { drawText, measure } from '../pixel/font';
import { clamp, pick } from '../engine/math';
import { settings } from '../engine/storage';
import { hiCanvas, HiCanvas, bgRes, pitchRes, vw, vh, hash2 as hash, roundRect } from '../engine/gfx';

const SPONSORS = ['MADFOOT', 'BONK COLA', 'NO RULES', 'TURBO BOOTS', 'GG ENERGY', 'KICK HARD', 'RAGE FM', 'SLIDE CO.'];
const SKINS = ['#f1cfb0', '#d9a882', '#b47b55', '#7c5135', '#5a3722'];
const HAIRS = ['#1a1310', '#3b2416', '#6b3e1f', '#c98a3a', '#2a2a2a', '#7a1a10'];
const TAU = Math.PI * 2;

/** soil colours for wear stamps */
const SOIL = ['86,74,46', '98,84,54', '72,62,40', '110,96,64'];

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
    return x * PPM + this.OX;
  }
  private WY(y: number, z = 0) {
    return y * PPM * YS - z * PPM + this.OY;
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
    g.fillStyle = '#080c16';
    g.fillRect(0, 0, W, H);

    const [h, a] = [this.m.teams[0].def, this.m.teams[1].def];
    const px0 = this.WX(-ex), px1 = this.WX(ex), py0 = this.WY(-ey), py1 = this.WY(ey);
    this.pr = { x0: px0, y0: py0, x1: px1, y1: py1 };
    const boardH = 13;
    const topY1 = py0 - boardH - 2;
    const botY0 = py1 + 12;

    // ---- stands: concrete tiers with seat rows
    const tier = (x0: number, y0: number, x1: number, y1: number, vertical: boolean, near = false) => {
      const gr = vertical ? g.createLinearGradient(x0 < W / 2 ? x0 : x1, 0, x0 < W / 2 ? x1 : x0, 0) : g.createLinearGradient(0, near ? y1 : y0, 0, near ? y0 : y1);
      gr.addColorStop(0, '#0e1322');
      gr.addColorStop(1, '#25304a');
      g.fillStyle = gr;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (!vertical) {
        for (let y = y1 - 1; y >= y0; y -= 7) {
          g.fillStyle = 'rgba(120,140,190,0.16)';
          g.fillRect(x0, y - 6, x1 - x0, 0.8);
          g.fillStyle = 'rgba(0,0,0,0.45)';
          g.fillRect(x0, y - 0.6, x1 - x0, 1.2);
        }
      } else {
        for (let x = x0; x < x1; x += 7) {
          g.fillStyle = 'rgba(120,140,190,0.16)';
          g.fillRect(x, y0, 0.8, y1 - y0);
          g.fillStyle = 'rgba(0,0,0,0.45)';
          g.fillRect(x + 6, y0, 1.2, y1 - y0);
        }
      }
    };
    tier(0, 18, W, topY1, false);
    for (let x = 60; x < W; x += 170) {
      g.fillStyle = '#2c3650';
      g.fillRect(x, 18, 5, topY1 - 18);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let y = 20; y < topY1; y += 3.5) g.fillRect(x, y, 5, 0.8);
    }
    tier(0, py0 - boardH, px0 - 6, py1 + 2, true);
    tier(px1 + 6, py0 - boardH, W, py1 + 2, true);
    tier(0, botY0, W, H, false, true);
    g.fillStyle = '#0b101b';
    g.fillRect(0, py1 + 1, W, 11);
    this.standRects = [
      [0, 18, W, topY1],
      [0, py0 - boardH, px0 - 6, py1],
      [px1 + 6, py0 - boardH, W, py1],
      [0, botY0, W, H],
    ];

    // ---- boards around the pitch
    const bg = g.createLinearGradient(0, py0 - boardH - 2, 0, py0);
    bg.addColorStop(0, '#3a4766');
    bg.addColorStop(0.1, '#06080f');
    g.fillStyle = bg;
    g.fillRect(px0 - 2, py0 - boardH - 2, px1 - px0 + 4, boardH + 2);
    this.ledRect = { x0: px0, x1: px1, y: py0 - boardH, h: boardH - 2 };
    for (const s of [-1, 1]) {
      const bx = s > 0 ? px1 + 1 : px0 - 6;
      const sg = g.createLinearGradient(bx, 0, bx + 5, 0);
      sg.addColorStop(0, s > 0 ? '#1d2840' : '#0c1220');
      sg.addColorStop(1, s > 0 ? '#0c1220' : '#1d2840');
      g.fillStyle = sg;
      g.fillRect(bx, py0 - boardH, 5, py1 - py0 + boardH);
      g.fillStyle = s < 0 ? h.primary : a.primary;
      g.globalAlpha = 0.85;
      g.fillRect(bx + 2, py0 - boardH + 2, 1.2, py1 - py0 + boardH - 4);
      g.globalAlpha = 1;
    }

    // ---- pitch (separate high-res canvas, receives dynamic wear)
    this.buildPitch();

    // ---- near (bottom) board, drawn over players
    const fw = px1 - px0 + 4;
    const [fb, fg] = hiCanvas(fw, 12, 3);
    const fgr = fg.createLinearGradient(0, 0, 0, 12);
    fgr.addColorStop(0, '#3a4766');
    fgr.addColorStop(0.08, '#1a2236');
    fgr.addColorStop(1, '#090d17');
    fg.fillStyle = fgr;
    fg.fillRect(0, 0, fw, 12);
    let fx = 10;
    let i = 0;
    while (fx < fw - 20) {
      const t = SPONSORS[i % SPONSORS.length];
      const w = measure(t, 0.8);
      fg.globalAlpha = 0.5;
      drawText(fg, t, fx, 3, { color: i % 2 ? '#8fa2c8' : '#c8d4ee', scale: 0.8, outline: null });
      fg.globalAlpha = 1;
      fx += w + 34;
      i++;
    }
    this.frontBoard = { c: fb, x: px0 - 2, y: py1 - 10 };

    this.led = this.buildLed(h, a);

    // roof + floodlight gantry (drawn after the crowd so glows sit on top)
    const roof = (cg: CanvasRenderingContext2D) => {
      const rg = cg.createLinearGradient(0, 0, 0, 20);
      rg.addColorStop(0, '#03050a');
      rg.addColorStop(1, '#141b2c');
      cg.fillStyle = rg;
      cg.fillRect(0, 0, W, 18);
      cg.fillStyle = '#2a3550';
      cg.fillRect(0, 17, W, 1);
      for (let x = 16; x < W; x += 36) {
        const glow = cg.createRadialGradient(x + 1.5, 10, 0, x + 1.5, 10, 14);
        glow.addColorStop(0, 'rgba(255,246,210,0.55)');
        glow.addColorStop(0.3, 'rgba(255,240,190,0.16)');
        glow.addColorStop(1, 'rgba(255,240,190,0)');
        cg.fillStyle = glow;
        cg.fillRect(x - 13, 0, 30, 26);
        cg.fillStyle = '#fffbe8';
        roundRect(cg, x - 1, 8, 5, 4, 1);
        cg.fill();
      }
    };

    // ---- crowd variants
    const nVar = settings.quality === 'high' ? 3 : 1;
    for (let v = 0; v < nVar; v++) {
      const [c, cg] = hiCanvas(W, H, bgRes());
      cg.drawImage(base, 0, 0);
      this.drawCrowd(cg, v, h, a, { px0, px1, py0, py1, topY1, botY0, W, H, boardH });
      roof(cg);
      // atmosphere: darken far stands slightly
      const at = cg.createLinearGradient(0, 0, 0, topY1);
      at.addColorStop(0, 'rgba(4,6,14,0.45)');
      at.addColorStop(1, 'rgba(4,6,14,0)');
      cg.fillStyle = at;
      cg.fillRect(0, 18, W, topY1 - 18);
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

    // mowing stripes (along x) + checker banding (along y)
    const field = (wx: number) => Math.abs(wx) <= P.hw;
    for (let i = -20; i < 20; i++) {
      const wxa = i * 4, wxb = wxa + 4;
      const xa = Math.max(x0, this.WX(wxa)), xb = Math.min(x1, this.WX(wxb));
      if (xb <= xa) continue;
      const light = ((i % 2) + 2) % 2 === 0;
      g.fillStyle = light ? '#3b9a47' : '#2f873b';
      g.fillRect(xa, y0, xb - xa, ph);
    }
    g.fillStyle = 'rgba(255,255,255,0.035)';
    for (let j = -20; j < 20; j += 2) {
      const ya = this.WY(j * 4), yb = this.WY(j * 4 + 4);
      g.fillRect(x0, ya, pw, yb - ya);
    }
    // run-off area is a bit darker
    g.fillStyle = 'rgba(10,30,15,0.22)';
    g.fillRect(x0, y0, pw, this.WY(-P.hh) - y0);
    g.fillRect(x0, this.WY(P.hh), pw, y1 - this.WY(P.hh));
    g.fillRect(x0, this.WY(-P.hh), this.WX(-P.hw) - x0, this.WY(P.hh) - this.WY(-P.hh));
    g.fillRect(this.WX(P.hw), this.WY(-P.hh), x1 - this.WX(P.hw), this.WY(P.hh) - this.WY(-P.hh));
    void field;

    // fine grass grain: per-device-pixel noise pattern
    const T = 128;
    const tile = document.createElement('canvas');
    tile.width = tile.height = T;
    const tg = tile.getContext('2d')!;
    const img = tg.createImageData(T, T);
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const r = hash(x, y * 3 + 7);
        const r2 = hash(x >> 2, (y >> 1) + 99);
        const o = (y * T + x) * 4;
        const lightPix = r > 0.55;
        const v = lightPix ? 255 : 0;
        img.data[o] = v * 0.85;
        img.data[o + 1] = v;
        img.data[o + 2] = v * 0.7;
        img.data[o + 3] = Math.round((lightPix ? (r - 0.55) * 70 : (0.55 - r) * 60) + r2 * 10);
      }
    tg.putImageData(img, 0, 0);
    const pat = g.createPattern(tile, 'repeat')!;
    pat.setTransform(new DOMMatrix().scale(1 / res, 1 / res));
    g.fillStyle = pat;
    g.fillRect(x0, y0, pw, ph);
    // blades
    const n = Math.round(pw * ph * (settings.quality === 'high' ? 0.11 : 0.04));
    for (let i = 0; i < n; i++) {
      const x = x0 + hash(i, 1) * pw, y = y0 + hash(i, 2) * ph;
      const r = hash(i, 3);
      g.fillStyle = r < 0.5 ? 'rgba(14,52,22,0.32)' : r < 0.85 ? 'rgba(120,200,110,0.22)' : 'rgba(190,235,160,0.25)';
      g.fillRect(x, y, 0.35, 0.9 + r * 0.8);
    }
    // large-scale colour variation (patchy turf)
    for (let i = 0; i < 70; i++) {
      const x = x0 + hash(i, 11) * pw, y = y0 + hash(i, 12) * ph, r = 20 + hash(i, 13) * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = hash(i, 14) < 0.5;
      gr.addColorStop(0, dark ? 'rgba(20,60,20,0.12)' : 'rgba(170,210,90,0.08)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.save();
      g.translate(x, y);
      g.scale(1, YS);
      g.translate(-x, -y);
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.restore();
    }

    // pre-existing wear in the goal mouths and centre spot
    for (const [cx, cy, rad, pr] of [[-P.hw + 1.3, 0, 3.0, 1], [P.hw - 1.3, 0, 3.0, 1], [0, 0, 1.6, 0.5]] as const) {
      const cnt = Math.round(110 * pr * rad);
      for (let i = 0; i < cnt; i++) {
        const a = hash(i, cx * 10 + 3) * TAU, d = Math.pow(hash(i, cy + 17 + cx), 0.8) * rad;
        const wx = cx + Math.cos(a) * d, wy = cy + Math.sin(a) * d * 1.2;
        const k = 1 - d / rad;
        const dry = hash(i, 9) < 0.45;
        this.blob(wx, wy, 0.06 + hash(i, 5) * 0.16, dry ? `rgba(150,160,80,${((0.05 + k * 0.12) * pr).toFixed(3)})` : `rgba(${SOIL[i % 4]},${((0.06 + k * 0.3) * pr).toFixed(3)})`, 1.3, hash(i, 6) * 3);
      }
    }

    // ---- lines
    g.strokeStyle = 'rgba(243,248,238,0.92)';
    g.lineWidth = 1.9;
    g.lineCap = 'butt';
    const L = (pts: [number, number][]) => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(this.WX(x), this.WY(y)) : g.moveTo(this.WX(x), this.WY(y))));
      g.stroke();
    };
    const rect = (ax: number, ay: number, bx: number, by: number) => {
      g.strokeRect(this.WX(ax), this.WY(ay), this.WX(bx) - this.WX(ax), this.WY(by) - this.WY(ay));
    };
    const ell = (cx: number, cy: number, r: number, a0 = 0, a1 = TAU) => {
      g.beginPath();
      g.ellipse(this.WX(cx), this.WY(cy), r * PPM, r * PPM * YS, 0, a0, a1);
      g.stroke();
    };
    const spot = (x: number, y: number) => {
      g.fillStyle = 'rgba(243,248,238,0.95)';
      g.beginPath();
      g.ellipse(this.WX(x), this.WY(y), 1.4, 1.05, 0, 0, TAU);
      g.fill();
    };
    rect(-P.hw, -P.hh, P.hw, P.hh);
    L([[0, -P.hh], [0, P.hh]]);
    ell(0, 0, P.centerR);
    spot(0, 0);
    for (const s of [-1, 1]) {
      const gx = s * P.hw;
      rect(Math.min(gx, gx - s * P.boxDepth), -P.boxHalf, Math.max(gx, gx - s * P.boxDepth), P.boxHalf);
      rect(Math.min(gx, gx - s * P.smallDepth), -P.smallHalf, Math.max(gx, gx - s * P.smallDepth), P.smallHalf);
      const sp = gx - s * P.boxDepth * 0.72;
      spot(sp, 0);
      // penalty arc (outside the box only)
      const edge = this.WX(gx - s * P.boxDepth);
      g.save();
      g.beginPath();
      if (s > 0) g.rect(x0, y0, edge - x0 - 0.9, y1 - y0);
      else g.rect(edge + 0.9, y0, x1 - edge, y1 - y0);
      g.clip();
      ell(sp, 0, P.centerR * 0.85);
      g.restore();
      // corner arcs
      for (const sy of [-1, 1]) {
        const a0 = s > 0 ? (sy > 0 ? Math.PI : Math.PI / 2) : sy > 0 ? Math.PI * 1.5 : 0;
        ell(gx, sy * P.hh, 1, a0, a0 + Math.PI / 2);
      }
    }
    // paint texture on the lines: re-apply some grain
    g.globalAlpha = 0.35;
    g.fillStyle = pat;
    g.fillRect(x0, y0, pw, ph);
    g.globalAlpha = 1;

    // floodlight pools + stand shadow along the top
    for (const [fx, fy] of [[-P.hw * 0.6, -P.hh * 0.2], [P.hw * 0.6, -P.hh * 0.2], [0, P.hh * 0.5]]) {
      const X = this.WX(fx), Y = this.WY(fy), r = P.hw * PPM * 0.75;
      const gr = g.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, 'rgba(255,250,215,0.07)');
      gr.addColorStop(1, 'rgba(255,250,215,0)');
      g.fillStyle = gr;
      g.fillRect(x0, y0, pw, ph);
    }
    const sh = g.createLinearGradient(0, y0, 0, y0 + 26);
    sh.addColorStop(0, 'rgba(0,10,5,0.4)');
    sh.addColorStop(1, 'rgba(0,10,5,0)');
    g.fillStyle = sh;
    g.fillRect(x0, y0, pw, 26);
    const eg = g.createLinearGradient(0, y1 - 14, 0, y1);
    eg.addColorStop(0, 'rgba(0,10,5,0)');
    eg.addColorStop(1, 'rgba(0,10,5,0.3)');
    g.fillStyle = eg;
    g.fillRect(x0, y1 - 14, pw, 14);

    // goal shadows on the grass
    for (const s of [-1, 1]) {
      const gx = this.WX(s * P.hw), bx = this.WX(s * (P.hw + P.goalDepth));
      g.fillStyle = 'rgba(0,15,5,0.22)';
      g.fillRect(Math.min(gx, bx), this.WY(-P.goalHalf), Math.abs(bx - gx) + 2, this.WY(P.goalHalf) - this.WY(-P.goalHalf) + 3);
    }
  }

  /** soft soil blob on the pitch canvas (world coords) */
  private blob(wx: number, wy: number, r: number, color: string, stretch = 1, ang = 0) {
    const g = this.pg;
    const X = this.WX(wx), Y = this.WY(wy);
    g.save();
    g.translate(X, Y);
    g.rotate(ang);
    g.scale(stretch, 1);
    const R = r * PPM;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, color);
    gr.addColorStop(0.65, color);
    gr.addColorStop(1, color.replace(/,[\d.]+\)$/, ',0)'));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(0, 0, R, R * YS, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  /** Permanently stamp a wear event into the turf. */
  private stamp(mk: GroundMark) {
    const g = this.pg;
    const l = Math.hypot(mk.dx, mk.dy) || 1;
    const ux = mk.dx / l, uy = mk.dy / l;
    const ang = Math.atan2(uy * YS, ux);
    const s = mk.s;
    const rnd = Math.random;
    switch (mk.kind) {
      case 'skid': {
        // two churned grooves (legs) + torn grass at the edges
        const px = -uy, py = ux;
        for (const side of [-1, 1]) {
          const wx = mk.x + px * side * 0.13, wy = mk.y + py * side * 0.13;
          this.blob(wx + (rnd() - 0.5) * 0.06, wy + (rnd() - 0.5) * 0.06, 0.15, `rgba(${pick(SOIL)},${(0.13 * s).toFixed(3)})`, 2.6, ang);
        }
        this.blob(mk.x - ux * 0.1, mk.y - uy * 0.1, 0.3, `rgba(70,95,40,${(0.05 * s).toFixed(3)})`, 1.8, ang);
        // churned soil specks
        for (let i = 0; i < 3; i++) {
          if (rnd() > 0.7 * s) continue;
          this.blob(mk.x + (rnd() - 0.5) * 0.5, mk.y + (rnd() - 0.5) * 0.4, 0.03 + rnd() * 0.05, `rgba(${pick(SOIL)},0.6)`, 1.2, ang);
        }
        if (rnd() < 0.35 * s) {
          const side = rnd() < 0.5 ? -1 : 1;
          this.blob(mk.x + px * side * 0.35, mk.y + py * side * 0.35, 0.07, 'rgba(160,215,120,0.35)', 1.5, ang + rnd() - 0.5);
        }
        break;
      }
      case 'divot': {
        const back = 0.15;
        const cx = mk.x - ux * back, cy = mk.y - uy * back;
        const n = 5 + Math.round(s * 5);
        for (let i = 0; i < n; i++) {
          const ox = (rnd() - 0.5) * 0.45 + ux * (rnd() - 0.3) * 0.5, oy = (rnd() - 0.5) * 0.35 + uy * (rnd() - 0.3) * 0.5;
          this.blob(cx + ox, cy + oy, 0.08 + rnd() * 0.14 * s, `rgba(${pick(SOIL)},${(0.35 + rnd() * 0.3).toFixed(2)})`, 1.4, ang);
        }
        // dark hole + lifted turf flap ahead
        this.blob(cx, cy, 0.14 * s + 0.06, 'rgba(48,34,20,0.55)', 1.6, ang);
        this.blob(mk.x + ux * 0.35, mk.y + uy * 0.35, 0.12, 'rgba(70,140,60,0.6)', 1.5, ang + 0.4);
        g.globalAlpha = 1;
        break;
      }
      case 'fall':
        this.blob(mk.x, mk.y, 0.42, `rgba(${pick(SOIL)},${(0.045 * s).toFixed(3)})`, 2, ang);
        this.blob(mk.x, mk.y, 0.3, `rgba(150,190,110,${(0.035 * s).toFixed(3)})`, 2.2, ang);
        break;
      case 'step': {
        const px = -uy * 0.1, py = ux * 0.1;
        this.blob(mk.x + px, mk.y + py, 0.06, `rgba(${pick(SOIL)},${(0.22 * s).toFixed(3)})`, 1.4, ang);
        this.blob(mk.x - px + ux * 0.3, mk.y - py + uy * 0.3, 0.06, `rgba(${pick(SOIL)},${(0.22 * s).toFixed(3)})`, 1.4, ang);
        break;
      }
      case 'scorch':
        this.blob(mk.x, mk.y, 0.6 * s, 'rgba(30,22,16,0.35)', 1.3, ang);
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
    const fan = (x: number, y: number, k: number, back: boolean, depth: number) => {
      const jumping = v > 0 && Math.floor(hash(k, 3) * 3) === v - 1;
      const up = jumping ? 1.6 : 0;
      const col = shirt(x, k);
      const rp = ramp(col);
      const skin = SKINS[Math.floor(hash(k, 11) * SKINS.length)];
      const hair = HAIRS[Math.floor(hash(k, 13) * HAIRS.length)];
      const yy = y - up;
      // body
      const bgr = g.createLinearGradient(x - 1.6, 0, x + 1.6, 0);
      bgr.addColorStop(0, css(rp[3]));
      bgr.addColorStop(0.5, css(rp[2]));
      bgr.addColorStop(1, css(rp[1]));
      g.fillStyle = bgr;
      roundRect(g, x - 1.6, yy - 3.3, 3.2, 3.6, 1.2);
      g.fill();
      if (jumping) {
        g.strokeStyle = skin;
        g.lineWidth = 0.8;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x - 1.4, yy - 2.8);
        g.lineTo(x - 2.2, yy - 6);
        g.moveTo(x + 1.4, yy - 2.8);
        g.lineTo(x + 2.2, yy - 6);
        g.stroke();
        if (hash(k, 17) < 0.15) {
          const tdef = col === h.primary || col === h.secondary ? h : a;
          for (let i = 0; i < 6; i++) {
            g.fillStyle = i % 2 ? tdef.secondary : tdef.primary;
            g.fillRect(x - 3 + i, yy - 7.6 + Math.sin(i + v) * 0.3, 1, 1.6);
          }
        }
      }
      // head
      g.fillStyle = back ? hair : skin;
      g.beginPath();
      g.arc(x, yy - 4.5, 1.25, 0, TAU);
      g.fill();
      if (!back) {
        g.fillStyle = hair;
        g.beginPath();
        g.arc(x, yy - 4.9, 1.2, Math.PI, TAU);
        g.fill();
      }
      if (depth > 0) {
        g.fillStyle = `rgba(6,8,18,${depth.toFixed(2)})`;
        g.fillRect(x - 2.4, yy - 8, 4.8, 8.4);
      }
    };
    let k = 0;
    const rows = Math.floor((L.topY1 - 26) / 7);
    let row = 0;
    for (let y = L.topY1 - 2; y > 24; y -= 7) {
      const depth = (row / Math.max(1, rows)) * 0.35;
      row++;
      for (let x = 3; x < L.W - 3; x += 5) {
        k++;
        if (hash(k, 1) < 0.07) continue;
        if (((x - 60) % 170 + 170) % 170 < 7) continue;
        fan(x + (hash(k, 2) < 0.5 ? 0 : 1), y, k, false, depth);
      }
    }
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 4 : L.px1 + 10, x1 = side < 0 ? L.px0 - 9 : L.W - 4;
      for (let x = x0; x < x1; x += 7) {
        const dist = side < 0 ? (x1 - x) / (x1 - x0) : (x - x0) / (x1 - x0);
        for (let y = L.py0 - L.boardH + 6; y < L.py1; y += 6) {
          k++;
          if (hash(k, 1) < 0.08) continue;
          fan(x + 3, y, k, false, dist * 0.3);
        }
      }
    }
    for (let y = L.botY0 + 6; y < L.H + 6; y += 7) {
      for (let x = 3; x < L.W - 3; x += 5) {
        k++;
        if (hash(k, 1) < 0.07) continue;
        fan(x, y, k, true, 0.15);
      }
    }
    // tifo banners hanging on the top stand
    const banner = (cx: number, t: TeamDef) => {
      const w = 36, hh = 13, y = L.topY1 - hh - 4;
      const ph = v * 1.3;
      g.save();
      g.beginPath();
      for (let i = 0; i <= w; i++) g.lineTo(cx + i, y + Math.sin(i * 0.3 + ph) * 0.9);
      for (let i = w; i >= 0; i--) g.lineTo(cx + i, y + hh + Math.sin(i * 0.3 + ph) * 0.9);
      g.closePath();
      g.fillStyle = t.primary;
      g.fill();
      g.clip();
      g.fillStyle = t.secondary;
      g.fillRect(cx, y + hh / 3, w, hh / 3);
      const sh = g.createLinearGradient(cx, 0, cx + w, 0);
      for (let i = 0; i <= 6; i++) sh.addColorStop(i / 6, `rgba(0,0,0,${(0.12 + Math.sin(i * 1.7 + ph) * 0.1).toFixed(2)})`);
      g.fillStyle = sh;
      g.fillRect(cx, y - 2, w, hh + 4);
      g.restore();
      drawText(g, t.short, cx + w / 2, y + 3.2, { color: '#fff', align: 'center', outline: 'rgba(18,12,28,0.8)', thick: 0.8 });
    };
    banner(L.W * 0.22, h);
    banner(L.W * 0.36, h);
    banner(L.W * 0.62, a);
    banner(L.W * 0.76, a);
  }

  private buildLed(h: TeamDef, a: TeamDef) {
    const items = [...SPONSORS, h.name, a.name];
    const H = this.ledRect.h;
    const widths = items.map((t) => measure(t) + 24);
    const W = widths.reduce((x, y) => x + y, 0);
    const [c, g] = hiCanvas(W, H, 3);
    const bgs = ['#101629', '#c8261f', '#0d0d12', '#e8b400', '#1d4ed8', '#14a050', '#8a1aa0', '#e06010'];
    let x = 0;
    items.forEach((t, i) => {
      const bg = i === SPONSORS.length ? h.primary : i === SPONSORS.length + 1 ? a.primary : bgs[i % bgs.length];
      const rp = ramp(bg);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, css(rp[3]));
      gr.addColorStop(0.3, css(rp[2]));
      gr.addColorStop(1, css(rp[1]));
      g.fillStyle = gr;
      g.fillRect(x, 0, widths[i], H);
      const [r, gg, b] = rp[2];
      const light = r * 0.3 + gg * 0.59 + b * 0.11 > 150;
      drawText(g, t, x + widths[i] / 2, (H - 7) / 2, { color: light ? '#111' : '#fff', align: 'center', outline: null });
      g.fillStyle = '#05070d';
      g.fillRect(x + widths[i] - 0.6, 0, 0.6, H);
      x += widths[i];
    });
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0.5; y < H; y += 1) g.fillRect(0, y, W, 0.35);
    return c;
  }

  // ---------------------------------------------------------------- goals (dynamic)
  private goalProj(cam: Camera, s: number, x: number, y: number, z: number, t: number): [number, number] {
    const P = this.P;
    const i = s < 0 ? 0 : 1;
    const A = this.m.props.goalShake[i];
    const ph = this.m.props.goalT[i];
    // frame vibrates around its base: offset grows with height
    const k = clamp(z / P.goalHeight, 0, 1.1);
    let ox = A * 2.6 * Math.sin(ph * 44) * k;
    let oy = A * 1.4 * Math.sin(ph * 44 + 1.3) * k;
    // net bulge on the back net
    const net = this.m.props.net[i];
    const depth = (x * s - P.hw) / P.goalDepth; // 0 at goal line, 1 at back
    if (net.amp > 0.01 && depth > 0.05) {
      const f = Math.exp(-((y - net.y) ** 2) / 1.1 - ((z - net.z) ** 2) / 0.7) * depth * depth;
      const b = net.amp * f * (0.85 + 0.15 * Math.sin(t * 30));
      x += s * b * 0.75;
      z += b * 0.1;
    }
    // the net hangs slightly and sways with the frame
    if (depth > 0.05) {
      ox *= 0.6;
      oy *= 0.6;
    }
    return [cam.sx(x) + z * PPM * 0.3 * Math.sign(s) + ox, cam.sy(y, z) + oy];
  }

  private netMesh(ctx: CanvasRenderingContext2D, cam: Camera, s: number, q: [number, number, number][], nu: number, nv: number, t: number) {
    const L = (a: [number, number, number], b: [number, number, number], u: number): [number, number, number] => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    const at = (u: number, v: number) => {
      const p = L(L(q[0], q[1], u), L(q[3], q[2], u), v);
      return this.goalProj(cam, s, p[0], p[1], p[2], t);
    };
    ctx.beginPath();
    const SEG = 6;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      for (let j = 0; j <= SEG; j++) {
        const [x, y] = at(u, j / SEG);
        if (j) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    }
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      for (let i = 0; i <= SEG; i++) {
        const [x, y] = at(i / SEG, v);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }

  private postLine(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number]) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#151020';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.strokeStyle = '#e9edf4';
    ctx.lineWidth = 2.1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(a[0] - 0.45, a[1] - 0.3);
    ctx.lineTo(b[0] - 0.45, b[1] - 0.3);
    ctx.stroke();
  }

  private drawGoal(ctx: CanvasRenderingContext2D, cam: Camera, s: number, part: 'back' | 'front', t: number) {
    const P = this.P;
    const gx = s * P.hw, bx = s * (P.hw + P.goalDepth), gh = P.goalHalf, h = P.goalHeight, hb = h * 0.75;
    const G = (x: number, y: number, z: number) => this.goalProj(cam, s, x, y, z, t);
    ctx.lineWidth = 0.5;
    ctx.lineCap = 'butt';
    if (part === 'back') {
      // inside of the goal is a little darker
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      for (const p of [G(gx, -gh, 0), G(bx, -gh, 0), G(bx, gh, 0), G(gx, gh, 0)]) ctx.lineTo(p[0], p[1]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(222,230,242,0.5)';
      this.netMesh(ctx, cam, s, [[bx, -gh, 0], [bx, gh, 0], [bx, gh, hb], [bx, -gh, hb]], 16, 6, t);
      this.netMesh(ctx, cam, s, [[gx, -gh, 0], [bx, -gh, 0], [bx, -gh, hb], [gx, -gh, h]], 6, 6, t);
      this.postLine(ctx, G(gx, -gh, 0), G(gx, -gh, h));
    } else {
      ctx.strokeStyle = 'rgba(232,238,248,0.55)';
      this.netMesh(ctx, cam, s, [[gx, -gh, h], [bx, -gh, hb], [bx, gh, hb], [gx, gh, h]], 6, 16, t);
      this.netMesh(ctx, cam, s, [[gx, gh, 0], [bx, gh, 0], [bx, gh, hb], [gx, gh, h]], 6, 6, t);
      // support bars
      ctx.strokeStyle = 'rgba(200,206,220,0.8)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (const yy of [-gh, gh]) {
        const a = G(gx, yy, h), b = G(bx, yy, hb), c = G(bx, yy, 0);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(c[0], c[1]);
      }
      ctx.stroke();
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
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#151020';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = '#f2f2f2';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      // painted bands
      ctx.strokeStyle = css(rp[2]);
      ctx.lineCap = 'butt';
      ctx.beginPath();
      for (let i = 1; i < 6; i += 2) {
        const a = i / 6, b = (i + 1) / 6;
        ctx.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a);
        ctx.lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
      }
      ctx.stroke();
    };
    const cloth = (tx: number, ty: number, dirX: number, dirY: number, wave: number, droop: number) => {
      // dir = pole direction (base -> tip), flag hangs off the tip on the side
      const nx = -dirY, ny = dirX; // perpendicular
      const side = f.hx > 0 ? -1 : 1;
      const w = 7.5, hgt = 5;
      const pts: [number, number][] = [];
      const N = 6;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const wv = Math.sin(time * 9 + u * 3.2 + f.hy) * wave * u;
        pts.push([tx + nx * side * w * u * (1 - droop * 0.4) + dirX * (-wv - droop * u * 3), ty + ny * side * w * u + dirY * (-wv - droop * u * 3) + droop * u * 2]);
      }
      const bottom = pts.map(([x, y]) => [x - dirX * hgt, y - dirY * hgt] as [number, number]).reverse();
      ctx.beginPath();
      [...pts, ...bottom].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      const gr = ctx.createLinearGradient(tx, ty, tx + nx * side * w, ty + ny * side * w);
      gr.addColorStop(0, css(rp[3]));
      gr.addColorStop(1, css(rp[1]));
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.strokeStyle = 'rgba(18,12,28,0.7)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    };
    if (!f.broken) {
      const X = cam.sx(f.hx), Y = cam.sy(f.hy);
      const sh = shadow(5, 1.4);
      ctx.drawImage(sh, X - vw(sh) / 2 + 3, Y - vh(sh) / 2);
      const dx = Math.sin(f.wob), dy = -Math.cos(f.wob);
      const tx = X + dx * Lpx, ty = Y + dy * Lpx;
      pole(X, Y, tx, ty);
      cloth(tx, ty, -dx, -dy, 1.4 + Math.abs(f.wobV) * 0.15, 0);
      return;
    }
    // stump left in the ground
    {
      const X = cam.sx(f.hx), Y = cam.sy(f.hy);
      ctx.strokeStyle = '#151020';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(X, Y);
      ctx.lineTo(X, Y - 3.5);
      ctx.stroke();
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.moveTo(X - 0.8, Y - 3.4);
      ctx.lineTo(X - 0.2, Y - 5.2);
      ctx.lineTo(X + 0.3, Y - 3.8);
      ctx.lineTo(X + 0.8, Y - 4.6);
      ctx.lineTo(X + 0.8, Y - 3.2);
      ctx.fill();
    }
    // flying / lying pole
    const cx = cam.sx(f.x), cy = cam.sy(f.y, f.z);
    const gx = cam.sx(f.x), gy = cam.sy(f.y);
    const dx = Math.sin(f.rot), dy = -Math.cos(f.rot);
    // shadow on the ground
    ctx.strokeStyle = 'rgba(5,20,10,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx - dx * Lpx * 0.5, gy);
    ctx.lineTo(gx + dx * Lpx * 0.5, gy);
    ctx.stroke();
    const bx0 = cx - dx * Lpx * 0.5, by0 = cy - dy * Lpx * 0.5;
    const tx = cx + dx * Lpx * 0.5, ty = cy + dy * Lpx * 0.5;
    pole(bx0, by0, tx, ty);
    cloth(tx, ty, -dx, -dy, f.z > 0.8 ? 2.2 : 0.6, f.z < 0.8 ? 1 : 0.3);
  }

  // ---------------------------------------------------------------- frame
  draw(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    this.consumeMarks();
    ctx.imageSmoothingEnabled = true;
    const bx = cam.originX - this.OX, by = cam.originY - this.OY;
    ctx.fillStyle = '#080c16';
    ctx.fillRect(0, 0, cam.W, cam.H);

    // crowd animation frame
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
    const off = (time * 18) % lw;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx + L.x0, by + L.y, L.x1 - L.x0, L.h);
    ctx.clip();
    for (let x = L.x0 - off; x < L.x1; x += lw) ctx.drawImage(this.led, bx + x, by + L.y);
    // LED glow sheen
    const sg = ctx.createLinearGradient(0, by + L.y, 0, by + L.y + L.h);
    sg.addColorStop(0, 'rgba(255,255,255,0.18)');
    sg.addColorStop(0.4, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(bx + L.x0, by + L.y, L.x1 - L.x0, L.h);
    ctx.restore();

    // camera flashes in the crowd
    if (m.excitement > 0.6 && settings.quality === 'high') {
      const n = Math.floor((m.excitement - 0.5) * 10);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        if (Math.random() > 0.4) continue;
        const r = this.standRects[Math.floor(Math.random() * this.standRects.length)];
        const x = bx + r[0] + Math.random() * (r[2] - r[0]);
        const y = by + r[1] + Math.random() * (r[3] - r[1]);
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 4);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x - 4, y - 4, 8, 8);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // goal backs
    for (const s of [-1, 1]) this.drawGoal(ctx, cam, s, 'back', time);

    // shadows
    for (const p of m.all) {
      const lying = p.state === 'down' || p.state === 'slide' || p.state === 'dive' || p.state === 'recover';
      const k = clamp(1 - p.z * 0.4, 0.5, 1);
      const sh = lying ? shadow(12 * k, 2.6 * k) : shadow(7 * k, 2.2 * k);
      ctx.drawImage(sh, cam.sx(p.x) - vw(sh) / 2 + 1.5, cam.sy(p.y) - vh(sh) / 2);
    }
    const b = m.ball;
    {
      const k = clamp(1 - b.z / 5, 0.4, 1);
      const sh = shadow(3.4 * k + 0.5, 1.4 * k + 0.2);
      ctx.drawImage(sh, cam.sx(b.x) - vw(sh) / 2 + b.z * 2, cam.sy(b.y) - vh(sh) / 2);
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

  /** Draw only the on-screen part of a big layer (stadium coords → screen). */
  private blitVisible(ctx: CanvasRenderingContext2D, c: HiCanvas, sx: number, sy: number, w: number, h: number, bx: number, by: number, cam: Camera) {
    const x0 = Math.max(sx, -bx), y0 = Math.max(sy, -by);
    const x1 = Math.min(sx + w, cam.W - bx), y1 = Math.min(sy + h, cam.H - by);
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
      const gr = ctx.createLinearGradient(bx, by, bx + w, by + h);
      gr.addColorStop(0, 'rgba(220,245,255,0.7)');
      gr.addColorStop(1, 'rgba(90,180,240,0.55)');
      ctx.fillStyle = gr;
      roundRect(ctx, bx, by, w, h, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(240,252,255,0.9)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + 2, by + 6);
      ctx.lineTo(bx + 5, by + 2);
      ctx.stroke();
    }
    if (p.star && p !== this.m.human && p.state !== 'down' && !this.m.replaying) {
      const st = ringStar();
      ctx.drawImage(st, x - vw(st) / 2, y - 39);
    }
  }

  private drawBall(ctx: CanvasRenderingContext2D, cam: Camera) {
    const b = this.m.ball;
    const x = cam.sx(b.x), y = cam.sy(b.y, b.z) - 4;
    const fire = b.fire > 0;
    // motion trail: tapered ribbon
    if (b.trail.length > 1) {
      ctx.lineCap = 'round';
      if (fire) ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i < b.trail.length; i++) {
        const a = b.trail[i - 1], c = b.trail[i];
        const k = i / b.trail.length;
        ctx.strokeStyle = fire ? (k > 0.5 ? `rgba(255,210,90,${k})` : `rgba(255,106,26,${k})`) : `rgba(255,255,255,${(0.08 + k * 0.32).toFixed(3)})`;
        ctx.lineWidth = fire ? 1.5 + k * 4 : 0.8 + k * 3;
        ctx.beginPath();
        ctx.moveTo(cam.sx(a.x), cam.sy(a.y, a.z) - 4);
        ctx.lineTo(cam.sx(c.x), cam.sy(c.y, c.z) - 4);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (fire) {
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 14);
      gr.addColorStop(0, 'rgba(255,190,80,0.6)');
      gr.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - 14, y - 14, 28, 28);
      ctx.globalCompositeOperation = 'source-over';
    }
    const f = ballFrame(Math.floor(b.rot * 2.4), fire);
    ctx.drawImage(f, x - BALL_SIZE / 2, y - BALL_SIZE / 2);
  }

  private drawGroundMarkers(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    const h = m.human;
    if (m.passHint && h && m.ball.owner === h) {
      const a = 0.55 + Math.sin(time * 10) * 0.35;
      ctx.globalAlpha = a;
      const r = ring(8, 3, '#ffffff');
      ctx.drawImage(r, cam.sx(m.passHint.x) - vw(r) / 2, cam.sy(m.passHint.y) - vh(r) / 2 + 1);
      ctx.globalAlpha = 1;
    }
    if (h && m.phase !== 'goal' && !m.replaying) {
      const pulse = (Math.sin(time * 7) + 1) / 2;
      const X = cam.sx(h.x), Y = cam.sy(h.y) + 0.5;
      ctx.save();
      ctx.translate(X, Y);
      ctx.scale(1, 0.36);
      const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, 11 + pulse);
      gr.addColorStop(0, 'rgba(255,225,77,0)');
      gr.addColorStop(0.75, 'rgba(255,225,77,0.25)');
      gr.addColorStop(1, 'rgba(255,225,77,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(0, 0, 12 + pulse, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 9 + pulse * 0.8, 0, TAU);
      ctx.stroke();
      // facing wedge
      const a = Math.atan2(Math.sin(h.face), Math.cos(h.face));
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
      ctx.lineTo(Math.cos(a + 0.35) * 10.5, Math.sin(a + 0.35) * 10.5);
      ctx.lineTo(Math.cos(a - 0.35) * 10.5, Math.sin(a - 0.35) * 10.5);
      ctx.fill();
      ctx.restore();
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
    const base = a.kind === 'free' ? 0.28 : 0.45;
    const boost = charging ? Math.min(1, h.charge) * 0.35 : 0;
    const col = a.kind === 'shot' ? (charging ? '255,226,120' : '255,246,210') : '255,255,255';
    const x0 = cam.sx(h.x + ux * start), y0 = cam.sy(h.y + uy * start);
    const x1 = cam.sx(h.x + ux * end), y1 = cam.sy(h.y + uy * end);
    const steps = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 3.2));
    const march = (time * 10) % 1;
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(1, (i + march) / steps);
      const wx = h.x + ux * (start + (end - start) * t), wy = h.y + uy * (start + (end - start) * t);
      const z = arcH ? 4 * arcH * t * (1 - t) : 0;
      const alpha = (base + boost) * (1 - t * 0.8);
      ctx.fillStyle = `rgba(${col},${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cam.sx(wx), cam.sy(wy, z), 0.65, 0, TAU);
      ctx.fill();
    }
    const ex = cam.sx(h.x + ux * end), ey = cam.sy(h.y + uy * end);
    const ma = (base + boost) * 0.9;
    ctx.strokeStyle = `rgba(${col},${ma.toFixed(3)})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    if (a.kind === 'pass') ctx.ellipse(ex, ey, 2.4, 1.2, 0, 0, TAU);
    else if (a.kind === 'shot') {
      ctx.moveTo(ex - 2, ey);
      ctx.lineTo(ex + 2, ey);
      ctx.moveTo(ex, ey - 1.6);
      ctx.lineTo(ex, ey + 1.6);
    }
    ctx.stroke();
  }

  private drawOverheads(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    const h = m.human;
    if (!h || m.phase === 'goal' || m.phase === 'over' || m.replaying) return;
    const x = cam.sx(h.x);
    const top = cam.sy(h.y, h.z) - 41 - Math.abs(Math.sin(time * 5)) * 1.5;
    if (x < 0 || x > cam.W || top < -10 || cam.sy(h.y) > cam.H + 10) {
      const cx = clamp(x, 10, cam.W - 10), cy = clamp(cam.sy(h.y, 1), 26, cam.H - 10);
      ctx.fillStyle = '#120c1c';
      roundRect(ctx, cx - 7.5, cy - 6.5, 15, 13, 3);
      ctx.fill();
      ctx.fillStyle = '#ffe14d';
      roundRect(ctx, cx - 6.5, cy - 5.5, 13, 11, 2.5);
      ctx.fill();
      drawText(ctx, String(h.number), cx, cy - 3.5, { color: '#120c1c', align: 'center', outline: null });
      return;
    }
    const ar = arrow('#ffe14d');
    ctx.drawImage(ar, x - vw(ar) / 2, top);
    let yb = top - 4;
    const bar = (w: number, hh: number, k: number, fill: string | CanvasGradient) => {
      ctx.fillStyle = 'rgba(18,12,28,0.85)';
      roundRect(ctx, x - w / 2 - 1, yb - hh - 1, w + 2, hh + 2, (hh + 2) / 2);
      ctx.fill();
      if (k > 0) {
        ctx.fillStyle = fill;
        roundRect(ctx, x - w / 2, yb - hh, Math.max(hh, w * k), hh, hh / 2);
        ctx.fill();
      }
    };
    if (h.stamina < 0.999) {
      bar(16, 2, h.stamina, h.exhausted ? (Math.floor(time * 8) % 2 ? '#ff5a4a' : '#a02a20') : '#5ff0a4');
      yb -= 5;
    }
    if (h.chargeKind !== 'none') {
      const w = 26;
      const max = h.chargeKind === 'shot' ? 1.3 : 1;
      const k = clamp(h.charge / max, 0, 1);
      let fill: string | CanvasGradient = '#7fd3ff';
      if (h.chargeKind === 'shot') {
        const gr = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        gr.addColorStop(0, '#5ff0a4');
        gr.addColorStop(0.45, '#5ff0a4');
        gr.addColorStop(0.55, '#ffe14d');
        gr.addColorStop(0.7, '#ff9a2e');
        gr.addColorStop(1 / 1.3, '#ff9a2e');
        gr.addColorStop(1 / 1.3 + 0.01, '#ff3b30');
        gr.addColorStop(1, '#ff3b30');
        fill = gr;
      }
      bar(w, 3.5, k, fill);
      ctx.fillStyle = '#ffffff';
      const mark = h.chargeKind === 'shot' ? w / 1.3 : w * 0.28;
      ctx.fillRect(x - w / 2 + mark - 0.4, yb - 5, 0.8, 6);
    }
  }

  private drawPost(ctx: CanvasRenderingContext2D, cam: Camera) {
    const W = cam.W, H = cam.H;
    const vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.45, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(4,6,14,0)');
    vg.addColorStop(1, 'rgba(4,6,14,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    // gentle top haze from the floodlights
    const hz = ctx.createLinearGradient(0, 0, 0, H * 0.35);
    hz.addColorStop(0, 'rgba(255,244,214,0.06)');
    hz.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, W, H * 0.35);
    const fx = this.m.fx;
    if (fx.flash > 0) {
      ctx.globalAlpha = Math.min(0.7, fx.flash * 0.6);
      ctx.fillStyle = fx.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }
}

let starC: HiCanvas | null = null;
function ringStar() {
  if (starC) return starC;
  const [c, g] = hiCanvas(7, 7);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 1.4 : 3.2;
    g.lineTo(3.5 + Math.cos(a) * r, 3.7 + Math.sin(a) * r);
  }
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 0.9;
  g.strokeStyle = '#120c1c';
  g.stroke();
  g.fillStyle = '#ffe14d';
  g.fill();
  starC = c;
  return c;
}
