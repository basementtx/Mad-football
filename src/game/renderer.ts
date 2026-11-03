import type { Match } from './match';
import type { Camera } from './camera';
import type { Pitch, Player } from './entities';
import { PHYS } from './entities';
import type { TeamDef } from './teams';
import { drawFootballer, drawBallSprite, Pose, Look, roundRect } from './sprites';
import { clamp, rand, pick, TAU, shade, rgba, lerp } from '../engine/math';
import { settings } from '../engine/storage';

interface Fan { x: number; y: number; c: number; skin: number; ph: number; side: number }

const SKINS = ['#f1cfb0', '#d9a882', '#b47b55', '#7c5135'];
const SPONSORS = ['MADFOOT', 'BONK COLA', 'NO RULES', 'TURBO BOOTS', 'GG ENERGY', 'KICK HARD', 'RAGE FM', 'SLIDE CO.'];

export class Renderer {
  private pitchCanvas: HTMLCanvasElement;
  ppm = 24;
  private fans: Fan[] = [];
  private fanColors: string[];
  private adStrip: HTMLCanvasElement;
  private vignette: HTMLCanvasElement | null = null;
  private vigW = 0;
  private vigH = 0;
  private P: Pitch;

  constructor(private m: Match) {
    this.P = m.pitch;
    const h = m.teams[0].def, a = m.teams[1].def;
    this.fanColors = [h.primary, h.primary, h.secondary, a.primary, a.primary, a.secondary, '#ffffff', '#2a2f3a', '#3a3f4f'];
    this.pitchCanvas = this.buildPitch();
    this.adStrip = this.buildAds(h, a);
    this.buildCrowd();
  }

  // ------------------------------------------------------------ prerender

  private buildPitch() {
    const P = this.P;
    const ex = P.hw + P.margin, ey = P.hh + P.margin;
    const k = (this.ppm = settings.quality === 'high' ? 26 : 16);
    const c = document.createElement('canvas');
    c.width = Math.ceil(ex * 2 * k);
    c.height = Math.ceil(ey * 2 * k);
    const g = c.getContext('2d')!;
    const X = (x: number) => (x + ex) * k;
    const Y = (y: number) => (y + ey) * k;

    // base
    g.fillStyle = '#2b7d36';
    g.fillRect(0, 0, c.width, c.height);
    // mowing stripes
    const stripe = 4;
    for (let x = -ex, i = 0; x < ex; x += stripe, i++) {
      g.fillStyle = i % 2 ? '#2f8a3b' : '#348f40';
      g.fillRect(X(x), 0, stripe * k + 1, c.height);
    }
    // cross stripes (subtle checker)
    for (let y = -ey, i = 0; y < ey; y += stripe, i++) {
      if (i % 2) {
        g.fillStyle = 'rgba(255,255,255,0.035)';
        g.fillRect(0, Y(y), c.width, stripe * k);
      }
    }
    // grass noise
    const n = Math.floor((c.width * c.height) / 90);
    for (let i = 0; i < n; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.045)';
      g.fillRect(Math.random() * c.width, Math.random() * c.height, rand(1, 2.5), rand(2, 4));
    }
    // worn areas
    const wear = (x: number, y: number, r: number, a: number) => {
      const gr = g.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), r * k);
      gr.addColorStop(0, `rgba(120,100,60,${a})`);
      gr.addColorStop(1, 'rgba(120,100,60,0)');
      g.fillStyle = gr;
      g.fillRect(X(x) - r * k, Y(y) - r * k, r * 2 * k, r * 2 * k);
    };
    wear(-P.hw + 1.5, 0, 4, 0.28);
    wear(P.hw - 1.5, 0, 4, 0.28);
    wear(0, 0, 3, 0.15);
    // run-off darker
    g.fillStyle = 'rgba(0,0,0,0.14)';
    g.fillRect(0, 0, c.width, Y(-P.hh));
    g.fillRect(0, Y(P.hh), c.width, c.height - Y(P.hh));
    g.fillRect(0, Y(-P.hh), X(-P.hw), Y(P.hh) - Y(-P.hh));
    g.fillRect(X(P.hw), Y(-P.hh), c.width - X(P.hw), Y(P.hh) - Y(-P.hh));
    // lighting
    const lg = g.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, c.width * 0.6);
    lg.addColorStop(0, 'rgba(255,255,230,0.08)');
    lg.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = lg;
    g.fillRect(0, 0, c.width, c.height);

    // lines
    g.strokeStyle = 'rgba(255,255,255,0.88)';
    g.lineWidth = 0.13 * k;
    g.lineJoin = 'round';
    const rect = (x0: number, y0: number, x1: number, y1: number) => g.strokeRect(X(x0), Y(y0), (x1 - x0) * k, (y1 - y0) * k);
    rect(-P.hw, -P.hh, P.hw, P.hh);
    g.beginPath();
    g.moveTo(X(0), Y(-P.hh));
    g.lineTo(X(0), Y(P.hh));
    g.stroke();
    g.beginPath();
    g.arc(X(0), Y(0), P.centerR * k, 0, TAU);
    g.stroke();
    const dot = (x: number, y: number, r: number) => {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.arc(X(x), Y(y), r * k, 0, TAU);
      g.fill();
    };
    dot(0, 0, 0.22);
    for (const s of [-1, 1]) {
      const gx = s * P.hw;
      rect(Math.min(gx, gx - s * P.boxDepth), -P.boxHalf, Math.max(gx, gx - s * P.boxDepth), P.boxHalf);
      rect(Math.min(gx, gx - s * P.smallDepth), -P.smallHalf, Math.max(gx, gx - s * P.smallDepth), P.smallHalf);
      const spot = gx - s * P.boxDepth * 0.72;
      dot(spot, 0, 0.18);
      // D arc
      g.beginPath();
      const r = P.centerR * 0.85;
      const dx = Math.abs(gx - s * P.boxDepth - spot);
      const a = Math.acos(clamp(dx / r, -1, 1));
      if (s > 0) g.arc(X(spot), Y(0), r * k, Math.PI - a, Math.PI + a);
      else g.arc(X(spot), Y(0), r * k, -a, a);
      g.stroke();
      // corner arcs
      for (const sy of [-1, 1]) {
        g.beginPath();
        const cx = X(gx), cy = Y(sy * P.hh);
        const start = s > 0 ? (sy > 0 ? Math.PI : Math.PI / 2) : sy > 0 ? -Math.PI / 2 : 0;
        g.arc(cx, cy, 0.9 * k, start, start + Math.PI / 2);
        g.stroke();
      }
      // goal line paint shadow inside goal area
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(s > 0 ? X(gx) : X(gx - P.goalDepth), Y(-P.goalHalf), P.goalDepth * k, P.goalHalf * 2 * k);
    }
    // centre logo
    g.save();
    g.globalAlpha = 0.1;
    g.font = `${3.2 * k}px "Russo One", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.translate(X(0), Y(0));
    g.fillText('MAD', 0, -0.9 * k);
    g.fillText('FOOTBALL', 0, 2.2 * k);
    g.restore();
    return c;
  }

  private buildAds(h: TeamDef, a: TeamDef) {
    const panelW = 360, H = 48;
    const panels = [...SPONSORS, h.name.toUpperCase(), a.name.toUpperCase()];
    const c = document.createElement('canvas');
    c.width = panelW * panels.length;
    c.height = H;
    const g = c.getContext('2d')!;
    const bgs = ['#101629', '#e8322b', '#0d0d12', '#ffd23f', '#1d4ed8', '#14b85a', '#a21caf', '#f97316'];
    panels.forEach((txt, i) => {
      const bg = i >= SPONSORS.length ? (i === SPONSORS.length ? h.primary : a.primary) : bgs[i % bgs.length];
      g.fillStyle = bg;
      g.fillRect(i * panelW, 0, panelW, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(255,255,255,0.25)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.fillStyle = gr;
      g.fillRect(i * panelW, 0, panelW, H);
      const light = ['#ffd23f', '#ffffff', '#f97316'].includes(bg) || bg === h.primary && isLight(h.primary) || bg === a.primary && isLight(a.primary);
      g.fillStyle = light ? '#111' : '#fff';
      g.font = `30px "Russo One", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(txt, i * panelW + panelW / 2, H / 2 + 2, panelW - 30);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(i * panelW + panelW - 2, 0, 2, H);
    });
    // LED scanlines
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, c.width, 1);
    return c;
  }

  private buildCrowd() {
    const P = this.P;
    const ex = P.hw + P.margin, ey = P.hh + P.margin;
    const dense = settings.quality === 'high' ? 0.62 : 0.95;
    const nc = this.fanColors.length;
    const add = (x: number, y: number, side: number) => {
      if (Math.random() < 0.1) return;
      this.fans.push({ x: x + rand(-0.12, 0.12), y, c: Math.floor(Math.random() * nc), skin: Math.floor(Math.random() * SKINS.length), ph: rand(0, TAU), side });
    };
    for (let r = 0; r < 9; r++) {
      for (let x = -ex - 8; x <= ex + 8; x += dense) add(x, -ey - 1.6 - r * 1.05, 0);
      for (let x = -ex - 8; x <= ex + 8; x += dense) add(x, ey + 2.2 + r * 1.05, 2);
    }
    for (let r = 0; r < 7; r++) {
      for (let y = -ey - 1; y <= ey + 1.5; y += dense * 1.15) {
        add(-ex - 1.6 - r * 0.85, y, 1);
        add(ex + 1.6 + r * 0.85, y, 3);
      }
    }
    // sort for painter order (back rows first)
    this.fans.sort((a, b) => a.y - b.y);
  }

  // ------------------------------------------------------------ frame

  draw(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    const P = this.P;
    const ex = P.hw + P.margin, ey = P.hh + P.margin;
    const W = cam.W, H = cam.H;

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1424');
    bg.addColorStop(1, '#05080f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.drawStands(ctx, cam, time, ex, ey);

    // pitch
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.pitchCanvas, cam.sx(-ex), cam.sy(-ey), ex * 2 * cam.s, ey * 2 * cam.s * cam.ys);

    this.drawBoardsBack(ctx, cam, time, ex, ey);
    for (const s of [-1, 1]) this.drawGoalBack(ctx, cam, s);

    // shadows
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (const p of m.all) {
      const lying = p.state === 'down' || p.state === 'slide' || p.state === 'dive';
      const rx = (lying ? 1.0 : 0.48) * cam.s;
      const dirx = lying ? (Math.cos(p.face) < 0 ? 1 : -1) * 0.6 * cam.s : 0;
      ctx.beginPath();
      ctx.ellipse(cam.sx(p.x) + dirx * (p.state === 'slide' ? -1 : 1) + cam.s * 0.15, cam.sy(p.y) + cam.s * 0.05, rx, 0.3 * cam.s, 0, 0, TAU);
      ctx.fill();
    }
    // ball shadow
    const b = m.ball;
    {
      const sh = clamp(1 - b.z / 6, 0.35, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.32 * sh})`;
      ctx.beginPath();
      ctx.ellipse(cam.sx(b.x) + b.z * cam.s * 0.25, cam.sy(b.y) + cam.s * 0.04, PHYS.ballR * 1.3 * cam.s * (1 + b.z * 0.05), PHYS.ballR * 0.7 * cam.s, 0, 0, TAU);
      ctx.fill();
    }

    this.drawGroundMarkers(ctx, cam, time);

    // depth-sorted entities
    type Ent = { y: number; draw: () => void };
    const ents: Ent[] = [];
    for (const p of m.all) ents.push({ y: p.y, draw: () => this.drawPlayer(ctx, cam, p) });
    const by = b.owner ? b.owner.y + (b.owner.faceY > 0 ? 0.05 : -0.05) : b.y;
    ents.push({ y: by, draw: () => this.drawBall(ctx, cam) });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) ents.push({ y: sy * P.hh, draw: () => this.drawFlag(ctx, cam, sx * P.hw, sy * P.hh, time) });
    ents.sort((a, c) => a.y - c.y);
    for (const e of ents) e.draw();

    for (const s of [-1, 1]) this.drawGoalFront(ctx, cam, s);
    this.drawBoardsFront(ctx, cam, ex, ey);

    this.drawOverheads(ctx, cam, time);
    m.fx.draw(ctx, cam);
    this.drawPost(ctx, cam);
  }

  private drawStands(ctx: CanvasRenderingContext2D, cam: Camera, time: number, ex: number, ey: number) {
    const s = cam.s;
    // top stand structure
    const topY0 = cam.sy(-ey), topY1 = cam.sy(-ey - 11);
    const g1 = ctx.createLinearGradient(0, topY1, 0, topY0);
    g1.addColorStop(0, '#111a2c');
    g1.addColorStop(1, '#1f2a40');
    ctx.fillStyle = g1;
    ctx.fillRect(cam.sx(-ex - 12), topY1, (ex + 12) * 2 * s, topY0 - topY1);
    // bottom stand
    const botY0 = cam.sy(ey), botY1 = cam.sy(ey + 12);
    const g2 = ctx.createLinearGradient(0, botY0, 0, botY1);
    g2.addColorStop(0, '#1f2a40');
    g2.addColorStop(1, '#0c1220');
    ctx.fillStyle = g2;
    ctx.fillRect(cam.sx(-ex - 12), botY0, (ex + 12) * 2 * s, botY1 - botY0);
    // side stands
    ctx.fillStyle = '#18223a';
    ctx.fillRect(cam.sx(-ex - 9), cam.sy(-ey), 9 * s, (ey * 2) * s * cam.ys);
    ctx.fillRect(cam.sx(ex), cam.sy(-ey), 9 * s, (ey * 2) * s * cam.ys);
    // row lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let r = 0; r < 11; r++) {
      const y1 = cam.sy(-ey - 1.1 - r * 1.05) + 2;
      ctx.moveTo(cam.sx(-ex - 12), y1);
      ctx.lineTo(cam.sx(ex + 12), y1);
      const y2 = cam.sy(ey + 1.7 + r * 1.05) + 2;
      ctx.moveTo(cam.sx(-ex - 12), y2);
      ctx.lineTo(cam.sx(ex + 12), y2);
    }
    ctx.stroke();

    // fans
    const exc = this.m.excitement;
    const minX = cam.x - cam.W / 2 / s - 1, maxX = cam.x + cam.W / 2 / s + 1;
    const minY = cam.y - cam.H / 2 / (s * cam.ys) - 3, maxY = cam.y + cam.H / 2 / (s * cam.ys) + 3;
    const hi = settings.quality === 'high';
    const bw = 0.44 * s, bh = 0.5 * s, hs = 0.26 * s;
    const goalSide = this.m.phase === 'goal' && this.m.lastGoal ? this.m.lastGoal.team.index : -1;
    const nC = this.fanColors.length;
    const bodies: Path2D[] = Array.from({ length: nC }, () => new Path2D());
    const heads: Path2D[] = SKINS.map(() => new Path2D());
    const arms = new Path2D();
    for (const f of this.fans) {
      if (f.x < minX || f.x > maxX || f.y < minY || f.y > maxY) continue;
      const fanTeam = f.c < 3 ? 0 : f.c < 6 ? 1 : -1;
      let jump = 0;
      if (hi) {
        const e = goalSide >= 0 ? (fanTeam === goalSide ? 1 : 0.05) : exc;
        jump = Math.max(0, Math.sin(time * (6 + (f.ph % 3)) + f.ph)) * e * 0.35;
      }
      const x = cam.sx(f.x), y = cam.sy(f.y, 0.6 + jump);
      bodies[f.c].rect(x - bw / 2, y - bh * 0.2, bw, bh);
      heads[f.skin].rect(x - hs / 2, y - bh * 0.2 - hs, hs, hs);
      if (jump > 0.18) {
        arms.rect(x - bw / 2 - 0.08 * s, y - bh * 0.2 - hs * 1.6, 0.1 * s, hs * 1.4);
        arms.rect(x + bw / 2 - 0.02 * s, y - bh * 0.2 - hs * 1.6, 0.1 * s, hs * 1.4);
      }
    }
    for (let i = 0; i < nC; i++) {
      ctx.fillStyle = shade(this.fanColors[i].startsWith('#') ? this.fanColors[i] : '#888888', -0.25);
      ctx.fill(bodies[i]);
    }
    ctx.fillStyle = '#c99a75';
    ctx.fill(arms);
    for (let i = 0; i < SKINS.length; i++) {
      ctx.fillStyle = shade(SKINS[i], -0.2);
      ctx.fill(heads[i]);
    }
    // camera flashes when excited
    if (hi && exc > 0.6) {
      const n = Math.floor((exc - 0.6) * 12);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < n; i++) {
        if (Math.random() > 0.35) continue;
        const f = pick(this.fans);
        if (f.x < minX || f.x > maxX || f.y < minY || f.y > maxY) continue;
        const x = cam.sx(f.x), y = cam.sy(f.y, 1.2);
        ctx.beginPath();
        ctx.arc(x, y, 0.18 * s, 0, TAU);
        ctx.fill();
      }
    }
  }

  private drawBoardsBack(ctx: CanvasRenderingContext2D, cam: Camera, time: number, ex: number, ey: number) {
    const s = cam.s;
    const bh = 0.95;
    // top LED boards (face visible)
    const x0 = cam.sx(-ex), x1 = cam.sx(ex);
    const yb = cam.sy(-ey), yt = cam.sy(-ey, bh);
    const h = yb - yt;
    ctx.fillStyle = '#05070c';
    ctx.fillRect(x0 - 2, yt - 3, x1 - x0 + 4, h + 4);
    const strip = this.adStrip;
    const scale = h / strip.height;
    const tileW = strip.width * scale;
    const off = ((time * 2.2 * s) % tileW + tileW) % tileW;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, yt, x1 - x0, h);
    ctx.clip();
    for (let x = x0 - off; x < x1; x += tileW) ctx.drawImage(strip, x, yt, tileW, h);
    ctx.restore();
    // top edge
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x0, yt - 2, x1 - x0, 2);

    // side boards (perspective)
    for (const sx of [-1, 1]) {
      const X = sx * ex;
      ctx.fillStyle = '#0d1424';
      ctx.beginPath();
      ctx.moveTo(cam.sxz(X, 0), cam.sy(-ey, 0));
      ctx.lineTo(cam.sxz(X, bh), cam.sy(-ey, bh));
      ctx.lineTo(cam.sxz(X, bh), cam.sy(ey, bh));
      ctx.lineTo(cam.sxz(X, 0), cam.sy(ey, 0));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cam.sxz(X, bh), cam.sy(-ey, bh));
      ctx.lineTo(cam.sxz(X, bh), cam.sy(ey, bh));
      ctx.stroke();
      // LED stripe
      ctx.strokeStyle = this.m.teams[sx > 0 ? 1 : 0].def.primary;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = Math.max(2, s * 0.12);
      ctx.beginPath();
      ctx.moveTo(cam.sxz(X, bh * 0.55), cam.sy(-ey, bh * 0.55));
      ctx.lineTo(cam.sxz(X, bh * 0.55), cam.sy(ey, bh * 0.55));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawBoardsFront(ctx: CanvasRenderingContext2D, cam: Camera, ex: number, ey: number) {
    const bh = 0.8;
    const x0 = cam.sx(-ex), x1 = cam.sx(ex);
    const yb = cam.sy(ey), yt = cam.sy(ey, bh);
    const g = ctx.createLinearGradient(0, yt, 0, yb);
    g.addColorStop(0, '#1b2438');
    g.addColorStop(1, '#0a0f1a');
    ctx.fillStyle = g;
    ctx.fillRect(x0, yt, x1 - x0, yb - yt + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x0, yt, x1 - x0, 2);
  }

  private quad(ctx: CanvasRenderingContext2D, cam: Camera, pts: [number, number, number][], fill: string | null, gridU = 0, gridV = 0, stroke = 'rgba(255,255,255,0.35)') {
    const P = pts.map(([x, y, z]) => [cam.sxz(x, z), cam.sy(y, z)] as [number, number]);
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (gridU || gridV) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.6, cam.s * 0.025);
      ctx.beginPath();
      const L = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
      for (let i = 0; i <= gridU; i++) {
        const t = i / gridU;
        const a = L(P[0], P[1], t), b = L(P[3], P[2], t);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      for (let i = 0; i <= gridV; i++) {
        const t = i / gridV;
        const a = L(P[0], P[3], t), b = L(P[1], P[2], t);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
  }

  private goalGeom(s: number) {
    const P = this.P;
    const bulge = this.m.ball.inGoal === s ? this.m.goalFlash * 0.5 : 0;
    return {
      gx: s * P.hw,
      bx: s * (P.hw + P.goalDepth + bulge),
      gh: P.goalHalf,
      h: P.goalHeight,
      hb: P.goalHeight * 0.75,
    };
  }

  private drawGoalBack(ctx: CanvasRenderingContext2D, cam: Camera, s: number) {
    const { gx, bx, gh, h, hb } = this.goalGeom(s);
    // floor shadow
    this.quad(ctx, cam, [[gx, -gh, 0], [bx, -gh, 0], [bx, gh, 0], [gx, gh, 0]], 'rgba(0,0,0,0.22)');
    // far side net
    this.quad(ctx, cam, [[gx, -gh, 0], [bx, -gh, 0], [bx, -gh, hb], [gx, -gh, h]], 'rgba(255,255,255,0.08)', 6, 6);
    // back net
    this.quad(ctx, cam, [[bx, -gh, 0], [bx, gh, 0], [bx, gh, hb], [bx, -gh, hb]], 'rgba(255,255,255,0.1)', 18, 6);
    // far post
    this.post(ctx, cam, gx, -gh, h);
  }

  private drawGoalFront(ctx: CanvasRenderingContext2D, cam: Camera, s: number) {
    const { gx, bx, gh, h, hb } = this.goalGeom(s);
    // roof
    this.quad(ctx, cam, [[gx, -gh, h], [bx, -gh, hb], [bx, gh, hb], [gx, gh, h]], 'rgba(255,255,255,0.07)', 6, 18);
    // near side net
    this.quad(ctx, cam, [[gx, gh, 0], [bx, gh, 0], [bx, gh, hb], [gx, gh, h]], 'rgba(255,255,255,0.06)', 6, 6);
    // crossbar + near post
    const lw = Math.max(3, cam.s * 0.16);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = lw + 3;
    ctx.beginPath();
    ctx.moveTo(cam.sxz(gx, h), cam.sy(-gh, h));
    ctx.lineTo(cam.sxz(gx, h), cam.sy(gh, h));
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lw;
    ctx.stroke();
    this.post(ctx, cam, gx, gh, h);
  }

  private post(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, h: number) {
    const lw = Math.max(3, cam.s * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cam.sxz(x, 0), cam.sy(y, 0));
    ctx.lineTo(cam.sxz(x, h), cam.sy(y, h));
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = lw + 3;
    ctx.stroke();
    ctx.strokeStyle = '#f4f6fa';
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  private drawFlag(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, time: number) {
    const h = 1.5;
    const bx = cam.sx(x), by = cam.sy(y);
    const tx = cam.sxz(x, h), ty = cam.sy(y, h);
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = Math.max(1.5, cam.s * 0.06);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    const w = Math.sin(time * 6 + x) * 0.1;
    ctx.fillStyle = x > 0 ? this.m.teams[1].def.primary : this.m.teams[0].def.primary;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + cam.s * 0.3, ty + cam.s * (0.1 + w), tx + cam.s * 0.6, ty + cam.s * (0.2 + w * 2));
    ctx.lineTo(tx, ty + cam.s * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  private drawGroundMarkers(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    const h = m.human;
    const s = cam.s;
    if (m.passHint && m.ball.owner === h) {
      const p = m.passHint;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.setLineDash([s * 0.2, s * 0.15]);
      ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.beginPath();
      ctx.ellipse(cam.sx(p.x), cam.sy(p.y), 0.65 * s, 0.65 * s * cam.ys, time * 2, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (h && m.phase !== 'goal') {
      const col = '#ffe14d';
      const pulse = 1 + Math.sin(time * 6) * 0.06;
      const x = cam.sx(h.x), y = cam.sy(h.y);
      ctx.lineWidth = Math.max(2, s * 0.1);
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.ellipse(x, y, 0.72 * s * pulse, 0.72 * s * cam.ys * pulse, 0, 0, TAU);
      ctx.stroke();
      // facing notch
      const fx = Math.cos(h.face), fy = Math.sin(h.face);
      ctx.fillStyle = col;
      ctx.beginPath();
      const r = 0.95 * s;
      const tip = [x + fx * r, y + fy * r * cam.ys];
      const l = [x + Math.cos(h.face + 0.35) * 0.72 * s, y + Math.sin(h.face + 0.35) * 0.72 * s * cam.ys];
      const rr = [x + Math.cos(h.face - 0.35) * 0.72 * s, y + Math.sin(h.face - 0.35) * 0.72 * s * cam.ys];
      ctx.moveTo(tip[0], tip[1]);
      ctx.lineTo(l[0], l[1]);
      ctx.lineTo(rr[0], rr[1]);
      ctx.fill();
      // aim arrow while charging
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
        const g = ctx.createLinearGradient(x, y, x + ax * len * s, y + ay * len * s * cam.ys);
        g.addColorStop(0, 'rgba(255,225,77,0.0)');
        g.addColorStop(1, 'rgba(255,225,77,0.8)');
        ctx.strokeStyle = g;
        ctx.lineWidth = s * 0.25;
        ctx.beginPath();
        ctx.moveTo(x + ax * s, y + ay * s * cam.ys);
        ctx.lineTo(x + ax * len * s, y + ay * len * s * cam.ys);
        ctx.stroke();
      }
    }
  }

  private pose(p: Player): Pose {
    return {
      runPhase: p.runPhase,
      speed: Math.hypot(p.vx, p.vy) / 8,
      facingLeft: Math.cos(p.face) < 0,
      state: p.state,
      stateT: p.stateT,
      stateDur: p.stateDur,
      kickAnim: p.kickAnim,
      charge: p.chargeKind === 'shot' ? p.charge : 0,
      hasBallGK: p.isGK && this.m.ball.owner === p,
      diveUp: 0,
      spinT: p.state === 'spin' ? p.stateT : 0,
    };
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, cam: Camera, p: Player) {
    const x = cam.sx(p.x), y = cam.sy(p.y, p.z);
    if (x < -cam.s * 3 || x > cam.W + cam.s * 3 || y < -cam.s * 4 || y > cam.H + cam.s * 3) return;
    const look: Look = {
      kit: p.team.def, isGK: p.isGK, skin: p.skin, hair: p.hair, hairStyle: p.hairStyle, beard: p.beard, number: p.number, build: p.build,
    };
    ctx.save();
    ctx.translate(x, y);
    if (p.invuln > 0 && p.state === 'spin') {
      ctx.globalAlpha = 0.85;
    }
    drawFootballer(ctx, look, this.pose(p), cam.s);
    ctx.restore();
  }

  private drawBall(ctx: CanvasRenderingContext2D, cam: Camera) {
    const b = this.m.ball;
    const r = PHYS.ballR * 1.25 * cam.s;
    // trail
    if (b.trail.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < b.trail.length; i++) {
        const a = b.trail[i - 1], c = b.trail[i];
        const k = i / b.trail.length;
        ctx.strokeStyle = b.fire > 0 ? `rgba(255,${Math.floor(120 + 100 * k)},40,${k * 0.7})` : `rgba(255,255,255,${k * 0.35})`;
        ctx.lineWidth = r * 1.6 * k;
        ctx.beginPath();
        ctx.moveTo(cam.sx(a.x), cam.sy(a.y, a.z) - r);
        ctx.lineTo(cam.sx(c.x), cam.sy(c.y, c.z) - r);
        ctx.stroke();
      }
    }
    drawBallSprite(ctx, cam.sx(b.x), cam.sy(b.y, b.z) - r, r, b.rot, b.fire > 0);
  }

  private drawOverheads(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    const m = this.m;
    const h = m.human;
    const s = cam.s;
    if (!h || m.phase === 'goal' || m.phase === 'over') return;
    const x = cam.sx(h.x);
    const headY = cam.sy(h.y, h.z + 2.75) + Math.sin(time * 5) * 2;
    // offscreen indicator
    if (x < 0 || x > cam.W || headY < 0 || cam.sy(h.y) > cam.H) {
      const cx = clamp(x, 30, cam.W - 30), cy = clamp(cam.sy(h.y, 1), 60, cam.H - 30);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = '14px "Russo One", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(h.number), cx, cy + 1);
      return;
    }
    // arrow
    ctx.fillStyle = '#ffe14d';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    const aw = Math.max(7, s * 0.28);
    ctx.beginPath();
    ctx.moveTo(x, headY + aw);
    ctx.lineTo(x - aw, headY - aw * 0.4);
    ctx.lineTo(x + aw, headY - aw * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // stamina bar
    const bw = Math.max(34, s * 1.4), bh = Math.max(4, s * 0.13);
    const by = headY - aw - bh - 4;
    if (h.stamina < 0.999 || h.chargeKind !== 'none') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, x - bw / 2 - 2, by - 2, bw + 4, bh + 4, 3);
      ctx.fill();
      ctx.fillStyle = h.exhausted ? '#ff5a4a' : '#5ff0a4';
      ctx.fillRect(x - bw / 2, by, bw * h.stamina, bh);
    }
    // charge meter
    if (h.chargeKind !== 'none') {
      const cy = by - bh * 2.2 - 4;
      const ch = bh * 1.8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, x - bw / 2 - 2, cy - 2, bw + 4, ch + 4, 4);
      ctx.fill();
      const max = h.chargeKind === 'shot' ? 1.3 : 1;
      const k = clamp(h.charge / max, 0, 1);
      const g = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
      if (h.chargeKind === 'shot') {
        g.addColorStop(0, '#5ff0a4');
        g.addColorStop(0.55, '#ffe14d');
        g.addColorStop(0.76, '#ff9a2e');
        g.addColorStop(0.77, '#ff3b30');
        g.addColorStop(1, '#ff3b30');
      } else {
        g.addColorStop(0, '#7fd3ff');
        g.addColorStop(1, '#ffffff');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x - bw / 2, cy, bw * k, ch);
      if (h.chargeKind === 'shot') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x - bw / 2 + bw * (1 / 1.3) - 1, cy - 2, 2, ch + 4);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x - bw / 2 + bw * 0.28 - 1, cy - 2, 2, ch + 4);
      }
    }
  }

  private drawPost(ctx: CanvasRenderingContext2D, cam: Camera) {
    const W = cam.W, H = cam.H;
    if (!this.vignette || this.vigW !== W || this.vigH !== H) {
      const c = document.createElement('canvas');
      const scale = 0.5;
      c.width = Math.max(1, Math.floor(W * scale));
      c.height = Math.max(1, Math.floor(H * scale));
      const g = c.getContext('2d')!;
      const w = c.width, h = c.height;
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      this.vignette = c;
      this.vigW = W;
      this.vigH = H;
    }
    ctx.drawImage(this.vignette, 0, 0, W, H);
    if (settings.quality === 'high') {
      // floodlight bloom
      ctx.globalCompositeOperation = 'lighter';
      for (const fx of [0.08, 0.92]) {
        const g = ctx.createRadialGradient(W * fx, -H * 0.05, 0, W * fx, -H * 0.05, H * 0.55);
        g.addColorStop(0, 'rgba(255,250,220,0.16)');
        g.addColorStop(1, 'rgba(255,250,220,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H * 0.6);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    const fx = this.m.fx;
    if (fx.flash > 0) {
      ctx.globalAlpha = fx.flash * 0.6;
      ctx.fillStyle = fx.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }
}

function isLight(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}

export { rgba };
