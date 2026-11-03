/**
 * Procedural footballer generator.
 * Each frame is a skeleton pose that is rasterized (supersampled) with capsule shapes,
 * per-pixel lighting (normals vs. a top-left light), hue-shifted ramps,
 * kit patterns in torso-local space, inner contour lines and a selective outline.
 */
import type { TeamDef } from '../game/teams';
import { ramp, RGB, OUTLINE, mix } from './palette';
import { spriteRes, HiCanvas } from '../engine/gfx';

export const CELL_W = 40;
export const CELL_H = 38;
export const ANCHOR_X = 20;
export const ANCHOR_Y = 35;

export interface PlayerLook {
  kit: TeamDef;
  isGK: boolean;
  skin: string;
  hair: string;
  hairStyle: number;
  beard: boolean;
}

// ------------------------------------------------------------------ poses

interface PoseP {
  lean?: number;
  tF?: number; kF?: number; tB?: number; kB?: number;
  aF?: number; eF?: number; aB?: number; eB?: number;
  rot?: number;
  tilt?: number;
  face?: 'normal' | 'angry' | 'shout' | 'ko' | 'sad' | 'happy';
}

const PI = Math.PI;
const POSES: [string, PoseP][] = [];
const add = (n: string, p: PoseP) => POSES.push([n, p]);

add('idle0', { lean: 0.04, tF: 0.12, kF: 0.12, tB: -0.1, kB: 0.15, aF: -0.12, eF: 0.45, aB: 0.18, eB: 0.35 });
add('idle1', { lean: 0.07, tF: 0.16, kF: 0.32, tB: -0.12, kB: 0.36, aF: -0.08, eF: 0.55, aB: 0.22, eB: 0.45 });
for (let i = 0; i < 6; i++) {
  const ph = (i * PI) / 3;
  const s = Math.sin(ph), c = Math.cos(ph);
  add('run' + i, {
    lean: 0.24,
    tF: 0.85 * s, kF: 0.12 + 1.55 * Math.max(0, c),
    tB: -0.85 * s, kB: 0.12 + 1.55 * Math.max(0, -c),
    aF: -0.85 * s, eF: 1.45, aB: 0.85 * s, eB: 1.45,
  });
}
add('kick0', { lean: -0.02, tF: -0.75, kF: 1.7, tB: 0.08, kB: 0.25, aF: -0.9, eF: 0.4, aB: 1.15, eB: 0.4, face: 'angry' });
add('kick1', { lean: -0.2, tF: 1.3, kF: 0.12, tB: -0.06, kB: 0.1, aF: -1.25, eF: 0.3, aB: 1.0, eB: 0.4, face: 'shout' });
add('kick2', { lean: -0.28, tF: 1.65, kF: 0.5, tB: -0.15, kB: 0.25, aF: -1.0, eF: 0.4, aB: 0.6, eB: 0.6, face: 'angry' });
add('slide', { rot: -1.15, tF: 1.5, kF: 0.05, tB: 1.0, kB: 1.3, aF: -0.5, eF: 0.6, aB: -1.7, eB: 0.4, face: 'shout' });
add('down0', { rot: -PI / 2, tF: 0.25, kF: 0.35, tB: -0.1, kB: 0.7, aF: 2.5, eF: 0.2, aB: -0.6, eB: 0.6, face: 'ko' });
add('down1', { rot: -PI / 2, tF: 0.35, kF: 0.7, tB: -0.05, kB: 0.5, aF: 2.3, eF: 0.5, aB: -0.4, eB: 0.4, face: 'ko' });
add('getup', { lean: 0.65, tF: 1.5, kF: 2.6, tB: -0.25, kB: 1.9, aF: 0.7, eF: 0.3, aB: 0.85, eB: 0.2, face: 'sad' });
add('dive', { rot: PI / 2 - 0.12, tF: 0.15, kF: 0.25, tB: -0.12, kB: 0.5, aF: PI - 0.05, eF: 0, aB: PI - 0.3, eB: 0.1, face: 'angry' });
add('cel0', { lean: -0.06, tF: 0.3, kF: 0.6, tB: -0.25, kB: 0.6, aF: PI - 0.35, eF: 0.1, aB: PI - 0.65, eB: 0.1, face: 'happy' });
add('cel1', { lean: -0.1, tF: 0.08, kF: 0.15, tB: -0.08, kB: 0.15, aF: PI - 0.12, eF: -0.1, aB: PI - 0.3, eB: 0, face: 'happy' });
add('shove', { lean: 0.38, tF: 0.5, kF: 0.25, tB: -0.65, kB: 0.4, aF: 1.62, eF: -0.05, aB: 1.42, eB: 0, face: 'shout' });
add('sad0', { lean: 0.32, tilt: 0.45, tF: 0.22, kF: 0.25, tB: -0.15, kB: 0.3, aF: 0.06, eF: 0.1, aB: -0.06, eB: 0.1, face: 'sad' });
add('sad1', { lean: 0.32, tilt: 0.45, tF: -0.12, kF: 0.3, tB: 0.2, kB: 0.25, aF: -0.04, eF: 0.1, aB: 0.05, eB: 0.1, face: 'sad' });
add('hold', { lean: 0.05, tF: 0.12, kF: 0.15, tB: -0.1, kB: 0.2, aF: 1.15, eF: 0.95, aB: 1.0, eB: 1.0 });
add('header', { lean: -0.12, tilt: -0.25, tF: 0.45, kF: 1.5, tB: -0.25, kB: 1.5, aF: -0.6, eF: 0.4, aB: 0.7, eB: 0.6, face: 'angry' });
add('charge', { lean: -0.08, tF: -0.55, kF: 1.35, tB: 0.08, kB: 0.25, aF: -0.7, eF: 0.4, aB: 0.9, eB: 0.5, face: 'angry' });

export const FRAMES: Record<string, number> = Object.fromEntries(POSES.map(([n], i) => [n, i]));
export const FRAME_COUNT = POSES.length;

type V = [number, number];

interface Joints {
  hip: V; neck: V; head: V; headAng: number;
  fk: V; ff: V; bk: V; bf: V;
  fs: V; fe: V; fh: V; bs: V; be: V; bh: V;
  face: NonNullable<PoseP['face']>;
}

const THIGH = 5.6, SHIN = 5.6, TORSO = 8.6, NECK = 4.6, UARM = 4.3, FARM = 3.9;

function buildPose(p: PoseP, isGK: boolean): Joints {
  const lean = p.lean ?? 0;
  const dir = (a: number): V => [Math.sin(a), Math.cos(a)]; // angle from straight down, + = forward
  const hip: V = [0, 0];
  const up: V = [Math.sin(lean), -Math.cos(lean)];
  const neck: V = [hip[0] + up[0] * TORSO, hip[1] + up[1] * TORSO];
  const headAng = lean * 0.6 + (p.tilt ?? 0);
  const hu: V = [Math.sin(headAng), -Math.cos(headAng)];
  const head: V = [neck[0] + hu[0] * NECK + 0.4, neck[1] + hu[1] * NECK];
  const leg = (t: number, k: number, ox: number): [V, V] => {
    const a = dir(t);
    const knee: V = [hip[0] + ox + a[0] * THIGH, hip[1] + a[1] * THIGH];
    const b = dir(t - k);
    return [knee, [knee[0] + b[0] * SHIN, knee[1] + b[1] * SHIN]];
  };
  const [fk, ff] = leg(p.tF ?? 0, p.kF ?? 0, 0.4);
  const [bk, bf] = leg(p.tB ?? 0, p.kB ?? 0, -0.6);
  const sh: V = [neck[0] - up[0] * 1.6, neck[1] - up[1] * 1.6];
  const arm = (a0: number, e: number, ox: number): [V, V, V] => {
    const s: V = [sh[0] + ox, sh[1]];
    const a = dir(a0 + lean);
    const el: V = [s[0] + a[0] * UARM, s[1] + a[1] * UARM];
    const b = dir(a0 + lean + e);
    const len = isGK ? FARM + 0.3 : FARM;
    return [s, el, [el[0] + b[0] * len, el[1] + b[1] * len]];
  };
  const [fs, fe, fh] = arm(p.aF ?? 0, p.eF ?? 0, 0.3);
  const [bs, be, bh] = arm(p.aB ?? 0, p.eB ?? 0, -0.6);
  const J: Joints = { hip, neck, head, headAng, fk, ff, bk, bf, fs, fe, fh, bs, be, bh, face: p.face ?? 'normal' };

  // whole-body rotation around the hip
  const rot = p.rot ?? 0;
  if (rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const k of ['hip', 'neck', 'head', 'fk', 'ff', 'bk', 'bf', 'fs', 'fe', 'fh', 'bs', 'be', 'bh'] as const) {
      const [x, y] = J[k];
      J[k] = [x * c - y * s, x * s + y * c];
    }
    J.headAng += rot;
  }
  // ground align: lowest point touches the ground line, centre horizontally for lying poses
  const lows = [J.ff[1] + 1.2, J.bf[1] + 1.2, J.head[1] + 4.2, J.hip[1] + 3.3, J.neck[1] + 3.2, J.fh[1] + 1.2, J.bh[1] + 1.2];
  const low = Math.max(...lows);
  let dx = ANCHOR_X;
  if (rot) {
    const xs = [J.ff[0], J.bf[0], J.head[0], J.fh[0], J.bh[0], J.hip[0]];
    dx = ANCHOR_X - (Math.min(...xs) + Math.max(...xs)) / 2;
  }
  const dy = ANCHOR_Y - low;
  for (const k of ['hip', 'neck', 'head', 'fk', 'ff', 'bk', 'bf', 'fs', 'fe', 'fh', 'bs', 'be', 'bh'] as const) {
    J[k] = [J[k][0] + dx, J[k][1] + dy];
  }
  return J;
}

// ------------------------------------------------------------------ raster
// Rasterized at S× supersampling (S = spriteRes()). Joint coordinates stay in
// virtual pixels; the buffer is S times larger.

const R_JER = 0, R_JER2 = 1, R_SHORTS = 2, R_SOCK = 3, R_SKIN = 4, R_HAIR = 5, R_BOOT = 6, R_WHITE = 7, R_EYE = 8, R_MOUTH = 9;

let S = 4;
let BW = CELL_W * S, BH = CELL_H * S;

class Buf {
  ramp = new Int8Array(BW * BH).fill(-1);
  tone = new Float32Array(BW * BH);
  layer = new Uint8Array(BW * BH);
  set(x: number, y: number, r: number, tone: number, layer: number) {
    if (x < 0 || y < 0 || x >= BW || y >= BH) return;
    const i = y * BW + x;
    this.ramp[i] = r;
    this.tone[i] = tone;
    this.layer[i] = layer;
  }
  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= BW || y >= BH) return -1;
    return this.ramp[y * BW + x];
  }
}

const LX = -0.6, LY = -0.8; // light from the top-left

/** Smooth shading: 0 = deep … 3 = highlight (fractional). */
function toneFor(nx: number, ny: number, depth: number) {
  const d = nx * LX + ny * LY;
  const rim = Math.min(1, Math.max(0, (depth - 0.15) / 0.85));
  const k = rim * rim * (3 - 2 * rim);
  let t = 2.05 + (d > 0 ? d * 1.15 : d * 1.25) * k;
  if (depth > 0.88 && d < 0) t -= 0.25;
  return t;
}

/** Rasterize a capsule; colour(u, v) returns ramp index or -1 to skip. */
function capsule(b: Buf, a: V, c: V, r: number, layer: number, colour: (u: number, v: number) => number, toneShift = 0) {
  const minX = Math.floor((Math.min(a[0], c[0]) - r - 1) * S), maxX = Math.ceil((Math.max(a[0], c[0]) + r + 1) * S);
  const minY = Math.floor((Math.min(a[1], c[1]) - r - 1) * S), maxY = Math.ceil((Math.max(a[1], c[1]) + r + 1) * S);
  const dx = c[0] - a[0], dy = c[1] - a[1];
  const l2 = dx * dx + dy * dy || 1e-6;
  const len = Math.sqrt(l2);
  const px_ = -dy / len, py_ = dx / len; // perpendicular
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cx = (x + 0.5) / S, cy = (y + 0.5) / S;
      let t = ((cx - a[0]) * dx + (cy - a[1]) * dy) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = a[0] + dx * t, qy = a[1] + dy * t;
      const ex = cx - qx, ey = cy - qy;
      const d = Math.sqrt(ex * ex + ey * ey);
      if (d > r) continue;
      const v = (ex * px_ + ey * py_) / r;
      const col = colour(t, v);
      if (col < 0) continue;
      const nx = d > 0.01 ? ex / d : 0, ny = d > 0.01 ? ey / d : 0;
      const tone = Math.max(0, Math.min(3, toneFor(nx, ny, d / r) + toneShift * 0.7));
      b.set(x, y, col, tone, layer);
    }
  }
}

export interface BuiltSheet {
  /** one row of frames facing right (mirror for left); supersampled (`__s`) */
  canvas: HiCanvas;
}

const sheetCache = new Map<string, BuiltSheet>();

export function lookKey(l: PlayerLook) {
  return `${l.kit.id}|${l.isGK}|${l.skin}|${l.hair}|${l.hairStyle}|${l.beard}|${spriteRes()}`;
}

export function playerSheet(look: PlayerLook): BuiltSheet {
  const key = lookKey(look);
  const hit = sheetCache.get(key);
  if (hit) return hit;
  S = spriteRes();
  BW = CELL_W * S;
  BH = CELL_H * S;
  const kit = look.kit;
  const ramps: RGB[][] = [];
  ramps[R_JER] = ramp(look.isGK ? kit.gk : kit.primary);
  ramps[R_JER2] = ramp(look.isGK ? darken(kit.gk) : kit.secondary);
  ramps[R_SHORTS] = ramp(look.isGK ? darken(kit.gk) : kit.shorts);
  ramps[R_SOCK] = ramp(look.isGK ? kit.gk : kit.socks);
  ramps[R_SKIN] = ramp(look.skin);
  ramps[R_HAIR] = ramp(look.hair);
  ramps[R_BOOT] = ramp('#2a2a36');
  ramps[R_WHITE] = ramp('#eef0f5');
  ramps[R_EYE] = ramp('#16121e');
  ramps[R_MOUTH] = ramp('#8a2030');

  const c = document.createElement('canvas') as HiCanvas;
  c.width = BW * FRAME_COUNT;
  c.height = BH;
  c.__s = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(BW, BH);

  POSES.forEach(([, pose], fi) => {
    const J = buildPose(pose, look.isGK);
    const b = new Buf();
    drawBody(b, J, look);
    finalize(b, ramps, img);
    g.putImageData(img, fi * BW, 0);
  });
  const built = { canvas: c };
  if (sheetCache.size > 40) sheetCache.clear();
  sheetCache.set(key, built);
  return built;
}

let flashC: HiCanvas | null = null;
/**
 * Draw one frame of a player sheet at virtual position (x, y) = top-left of the cell.
 * Handles mirroring and the white hit-flash.
 */
export function drawPlayerFrame(ctx: CanvasRenderingContext2D, sheet: HiCanvas, frame: number, x: number, y: number, left: boolean, flash = false, scale = 1) {
  let src: HiCanvas = sheet;
  let sx = frame * CELL_W;
  if (flash) {
    const s = sheet.__s ?? 1;
    if (!flashC || flashC.__s !== s) {
      flashC = document.createElement('canvas') as HiCanvas;
      flashC.width = CELL_W * s;
      flashC.height = CELL_H * s;
      flashC.__s = s;
    }
    const fg = flashC.getContext('2d')!;
    fg.globalCompositeOperation = 'source-over';
    fg.clearRect(0, 0, flashC.width, flashC.height);
    fg.drawImage(sheet, sx, 0, CELL_W, CELL_H, 0, 0, flashC.width, flashC.height);
    fg.globalCompositeOperation = 'source-atop';
    fg.fillStyle = '#ffffff';
    fg.fillRect(0, 0, flashC.width, flashC.height);
    src = flashC;
    sx = 0;
  }
  const w = CELL_W * scale, h = CELL_H * scale;
  if (left) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(src, sx, 0, CELL_W, CELL_H, 0, 0, w, h);
    ctx.restore();
  } else ctx.drawImage(src, sx, 0, CELL_W, CELL_H, x, y, w, h);
}

function darken(hex: string) {
  const r = ramp(hex)[1];
  return '#' + r.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function drawBody(b: Buf, J: Joints, look: PlayerLook) {
  const gk = look.isGK;
  const pattern = gk ? 'gk' : look.kit.pattern;
  // layers: 1 back arm, 2 back leg, 3 torso, 4 shorts, 5 front leg, 6 neck/head, 7 front arm
  const arm = (s: V, e: V, h: V, layer: number, back: boolean) => {
    const shift = back ? -1 : 0;
    capsule(b, s, e, 1.45, layer, () => R_JER, shift);
    capsule(b, e, h, 1.3, layer, () => (gk ? R_JER : R_SKIN), shift);
    capsule(b, h, h, gk ? 1.75 : 1.25, layer, () => (gk ? R_WHITE : R_SKIN), shift);
  };
  const leg = (k: V, f: V, layer: number, back: boolean) => {
    const shift = back ? -1 : 0;
    capsule(b, J.hip, k, 1.75, layer, (u) => (u < 0.42 ? R_SHORTS : R_SKIN), shift);
    capsule(b, k, f, 1.6, layer, (u) => (u < 0.18 ? R_SKIN : u < 0.32 ? R_JER2 : R_SOCK), shift);
    // boot points forward, perpendicular to the shin
    const sx = f[0] - k[0], sy = f[1] - k[1];
    const sl = Math.hypot(sx, sy) || 1;
    const fx = sy / sl, fy = -sx / sl;
    capsule(b, [f[0] - fx * 0.3, f[1] - fy * 0.3], [f[0] + fx * 2.1, f[1] + fy * 2.1], 1.25, layer, (u) => (u > 0.7 ? R_WHITE : R_BOOT), shift);
  };

  arm(J.bs, J.be, J.bh, 1, true);
  leg(J.bk, J.bf, 2, true);

  // torso with kit pattern in local (u along body, v across: +front)
  capsule(b, J.hip, J.neck, 3.35, 3, (u, v) => {
    if (u > 0.9 && Math.abs(v) < 0.6) return R_JER2; // collar
    switch (pattern) {
      case 'stripes': return Math.floor((v + 1) * 3.2) % 2 ? R_JER2 : R_JER;
      case 'hoops': return Math.floor(u * 6) % 2 ? R_JER2 : R_JER;
      case 'half': return v < 0 ? R_JER2 : R_JER;
      case 'sash': return Math.abs(u - 0.5 + v * 0.45) < 0.16 ? R_JER2 : R_JER;
      case 'chevron': return Math.abs(u - 0.62 + Math.abs(v) * 0.3) < 0.1 ? R_JER2 : R_JER;
      case 'gk': return Math.abs(u - 0.55) < 0.08 ? R_JER2 : R_JER;
      default: return u < 0.12 ? R_JER2 : R_JER;
    }
  });
  // shorts
  const ax = J.neck[0] - J.hip[0], ay = J.neck[1] - J.hip[1];
  const al = Math.hypot(ax, ay) || 1;
  const ux = ax / al, uy = ay / al;
  capsule(b, [J.hip[0] + ux * 0.9, J.hip[1] + uy * 0.9], [J.hip[0] - ux * 0.6, J.hip[1] - uy * 0.6], 3.45, 4, (u) => (u > 0.92 ? R_JER2 : R_SHORTS));

  leg(J.fk, J.ff, 5, false);

  // neck
  capsule(b, J.neck, [J.neck[0] + (J.head[0] - J.neck[0]) * 0.5, J.neck[1] + (J.head[1] - J.neck[1]) * 0.5], 1.5, 6, () => R_SKIN, -1);
  drawHead(b, J, look);

  arm(J.fs, J.fe, J.fh, 7, false);
}

function drawHead(b: Buf, J: Joints, look: PlayerLook) {
  const [hx, hy] = J.head;
  const ca = Math.cos(-J.headAng), sa = Math.sin(-J.headAng);
  const R = 4.15;
  const st = look.hairStyle;
  const hairAt = (lx: number, ly: number, inHead: boolean): boolean => {
    switch (st) {
      case 0: return inHead && (ly < -1.6 || (lx < -1.6 && ly < 1.4));
      case 1: return inHead && (ly < -2.5 || (lx < -2.7 && ly < 0.2));
      case 2: return Math.hypot(lx + 0.9, ly + 1.2) < 5.4 && (!inHead || ly < -1.6 || lx < -1.8);
      case 3: return (Math.abs(lx + 0.3) < 1.4 && ly < -2.2 && ly > -6.6) || (inHead && lx < -2.8 && ly < 0);
      case 4: return false;
      case 5: return (inHead && (ly < -1.5 || (lx < -1.4 && ly < 2))) || (!inHead && lx < -2 && lx > -6 && ly > -3 && ly < 5.5 && Math.hypot(lx + 3, ly - 1) < 4.4);
      case 6: {
        if (inHead) return ly < -1.9 || (lx < -2.4 && ly < 0.5);
        const ang = Math.atan2(ly, lx);
        if (ly > -2 || Math.hypot(lx, ly) > 6.6) return false;
        const spike = Math.abs(Math.sin(ang * 3.5)) ;
        return Math.hypot(lx, ly) < R + spike * 2.6;
      }
      default: return false;
    }
  };
  const minX = Math.floor((hx - 8) * S), maxX = Math.ceil((hx + 8) * S), minY = Math.floor((hy - 8) * S), maxY = Math.ceil((hy + 8) * S);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x + 0.5) / S - hx, dy = (y + 0.5) / S - hy;
      const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
      const d = Math.hypot(dx, dy);
      const inHead = d <= R;
      const nose = lx > 3.4 && lx < 4.9 && ly > -0.2 && ly < 1.4;
      let col = -1, tone = 2;
      if (hairAt(lx, ly, inHead)) {
        col = R_HAIR;
        tone = toneFor(d > 0 ? dx / d : 0, d > 0 ? dy / d : 0, Math.min(1, d / 5));
      } else if (inHead || nose) {
        col = R_SKIN;
        tone = toneFor(d > 0 ? dx / d : 0, d > 0 ? dy / d : 0, d / R);
        if (look.beard && ly > 1.3 && lx > -1.6 && inHead) {
          col = R_HAIR;
          tone = 1.3;
        }
        if (st === 6 && ly > -1.9 && ly < -0.8 && inHead) {
          col = R_JER2;
          tone = 2;
        }
        // ear
        if (Math.abs(lx + 0.7) < 0.75 && Math.abs(ly - 0.4) < 0.9 && col === R_SKIN) tone = Math.min(tone, 1.4);
      }
      if (col < 0) continue;
      b.set(x, y, col, tone, 6);
    }
  }
  // face features (in local coords -> pixel)
  const P = (lx: number, ly: number): [number, number] => {
    const c2 = Math.cos(J.headAng), s2 = Math.sin(J.headAng);
    return [hx + lx * c2 - ly * s2, hy + lx * s2 + ly * c2];
  };
  // a facial feature = a small soft-cornered blob (~1 virtual px) at hi-res
  const dot = (lx: number, ly: number, r: number, tone = 2) => {
    const [x, y] = P(lx, ly);
    const cx = (Math.floor(x) + 0.5) * S, cy = (Math.floor(y) + 0.5) * S;
    const rad = S * 0.62;
    for (let yy = Math.floor(cy - rad); yy <= Math.ceil(cy + rad); yy++)
      for (let xx = Math.floor(cx - rad); xx <= Math.ceil(cx + rad); xx++)
        if (Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) <= rad) b.set(xx, yy, r, tone, 6);
  };
  // eye white for readability (not when knocked out)
  if (J.face !== 'ko') dot(1.4, -0.3, R_WHITE, 3);
  switch (J.face) {
    case 'ko':
      dot(1.6, -0.8, R_EYE); dot(2.6, 0.2, R_EYE); dot(2.6, -0.8, R_EYE); dot(1.6, 0.2, R_EYE);
      dot(2.2, 2.4, R_MOUTH);
      break;
    case 'happy':
      dot(2.1, -0.3, R_EYE); dot(1.8, 2.0, R_MOUTH); dot(2.8, 2.0, R_MOUTH); dot(2.8, 2.9, R_MOUTH, 1);
      break;
    case 'shout':
      dot(2.1, -0.4, R_EYE); dot(1.5, -1.5, R_HAIR, 0); dot(2.6, -1.2, R_HAIR, 0);
      dot(2.6, 1.8, R_MOUTH, 0); dot(2.6, 2.7, R_MOUTH, 0); dot(3.3, 2.2, R_MOUTH, 0);
      break;
    case 'angry':
      dot(2.1, -0.3, R_EYE); dot(1.5, -1.4, R_HAIR, 0); dot(2.6, -1.1, R_HAIR, 0);
      break;
    case 'sad':
      dot(2.1, 0, R_EYE); dot(1.5, -0.9, R_HAIR, 0); dot(2.6, -1.3, R_HAIR, 0); dot(2.4, 2.4, R_MOUTH, 1);
      break;
    default:
      dot(2.1, -0.3, R_EYE); dot(2.1, -1.4, R_HAIR, 0);
  }
}

const offCache = new Map<number, Int32Array>();
/** (dx, dy, dist*1000) offsets within radius r, sorted by distance */
function offsets(r: number) {
  let o = offCache.get(r);
  if (o) return o;
  const list: [number, number, number][] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if ((dx || dy) && Math.hypot(dx, dy) <= r + 0.5) list.push([dx, dy, Math.hypot(dx, dy)]);
  list.sort((p, q) => p[2] - q[2]);
  o = new Int32Array(list.length * 3);
  list.forEach(([dx, dy, d], i) => {
    o![i * 3] = dx;
    o![i * 3 + 1] = dy;
    o![i * 3 + 2] = Math.round(d * 1000);
  });
  offCache.set(r, o);
  return o;
}

function finalize(b: Buf, ramps: RGB[][], img: ImageData) {
  const W = BW, H = BH;
  const R = b.ramp;
  // bounding box of the body
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (R[y * W + x] >= 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const d = img.data;
  d.fill(0);
  if (x1 < 0) return;
  // inner contours: front parts darken the edge of what is behind them
  const tone = b.tone.slice();
  const cw = Math.max(1, Math.round(S * 0.45));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (R[i] < 0) continue;
      const L = b.layer[i];
      for (let k = 1; k <= cw; k++) {
        const t = 0.35 + (k - 1) * 0.5;
        for (let q = 0; q < 4; q++) {
          const nx = x + (q === 0 ? k : q === 1 ? -k : 0), ny = y + (q === 2 ? k : q === 3 ? -k : 0);
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (R[j] < 0) continue;
          const L2 = b.layer[j];
          if (L2 < L && !(L === 4 && L2 === 3) && tone[j] > t) tone[j] = t;
        }
      }
    }
  }
  const ow = Math.max(1, Math.round(S * 0.7));
  const off = offsets(ow);
  const n = off.length / 3;
  const ya = Math.max(0, y0 - ow), yb = Math.min(H - 1, y1 + ow), xa = Math.max(0, x0 - ow), xb = Math.min(W - 1, x1 + ow);
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const i = y * W + x;
      const o = i * 4;
      const r = R[i];
      if (r >= 0) {
        const t = Math.max(0, Math.min(3, tone[i]));
        const lo = Math.floor(t), hi = Math.min(3, lo + 1), f = t - lo;
        const A = ramps[r][lo], B = ramps[r][hi];
        d[o] = A[0] + (B[0] - A[0]) * f;
        d[o + 1] = A[1] + (B[1] - A[1]) * f;
        d[o + 2] = A[2] + (B[2] - A[2]) * f;
        d[o + 3] = 255;
        continue;
      }
      // outline: nearest filled pixel within ow (offsets sorted by distance)
      for (let k = 0; k < n; k++) {
        const nx = x + off[k * 3], ny = y + off[k * 3 + 1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const v = R[ny * W + nx];
        if (v < 0) continue;
        const dist = off[k * 3 + 2] / 1000;
        const c = mix(ramps[v][0], OUTLINE, 0.65);
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
        d[o + 3] = Math.round(255 * Math.min(1, Math.max(0, ow + 0.5 - dist)));
        break;
      }
    }
}
