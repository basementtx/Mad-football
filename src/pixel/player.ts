/**
 * Procedural pixel-art footballer generator.
 * Each frame is a skeleton pose that is rasterized per-pixel with capsule shapes,
 * per-pixel lighting (normals vs. a top-left light), hue-shifted ramps,
 * kit patterns in torso-local space, inner contour lines and a selective outline.
 */
import type { TeamDef } from '../game/teams';
import { ramp, RGB, OUTLINE, mix } from './palette';

export const CELL_W = 40;
export const CELL_H = 38;
/** sprites are rasterized at this density (HD pixels); CELL_* stay in game pixels */
export const SS = 2;
const PW = CELL_W * SS, PH = CELL_H * SS;
export const ANCHOR_X = 20;
export const ANCHOR_Y = 35;

export interface PlayerLook {
  kit: TeamDef;
  isGK: boolean;
  skin: string;
  hair: string;
  hairStyle: number;
  beard: boolean;
  /** face / head shape (0 = classic) */
  face?: number;
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
// out of breath: hands on the knees, chest heaving
add('tired0', { lean: 0.8, tilt: -0.4, tF: 0.45, kF: 0.75, tB: 0.05, kB: 0.7, aF: -0.3, eF: 0.05, aB: -0.45, eB: 0.1, face: 'sad' });
add('tired1', { lean: 0.72, tilt: -0.5, tF: 0.45, kF: 0.78, tB: 0.05, kB: 0.72, aF: -0.22, eF: 0.05, aB: -0.38, eB: 0.1, face: 'shout' });
// bored keeper: a big yawn and a stretch
add('yawn0', { lean: -0.12, tilt: -0.4, tF: 0.08, kF: 0.12, tB: -0.08, kB: 0.12, aF: PI - 0.5, eF: 0.9, aB: PI - 0.7, eB: 0.9, face: 'shout' });
add('yawn1', { lean: -0.18, tilt: -0.55, tF: 0.08, kF: 0.1, tB: -0.08, kB: 0.1, aF: PI - 0.25, eF: 0.4, aB: PI - 0.45, eB: 0.4, face: 'shout' });
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

const R_JER = 0, R_JER2 = 1, R_SHORTS = 2, R_SOCK = 3, R_SKIN = 4, R_HAIR = 5, R_BOOT = 6, R_WHITE = 7, R_EYE = 8, R_MOUTH = 9, R_ACC = 10;
const BOOT_ACCENTS = ['#ff4d3d', '#ffd23f', '#3bd9ff', '#5ff0a4', '#ff3fa4', '#ff8a1f', '#f4f4f4'];

class Buf {
  ramp = new Int8Array(PW * PH).fill(-1);
  tone = new Uint8Array(PW * PH);
  layer = new Uint8Array(PW * PH);
  set(x: number, y: number, r: number, tone: number, layer: number) {
    if (x < 0 || y < 0 || x >= PW || y >= PH) return;
    const i = y * PW + x;
    this.ramp[i] = r;
    this.tone[i] = tone;
    this.layer[i] = layer;
  }
  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= PW || y >= PH) return -1;
    return this.ramp[y * PW + x];
  }
}

const LX = 0.55, LY = -0.83; // key light from above, in front of the player (lights the face)
const RIM: RGB = [196, 226, 255];

function toneFor(nx: number, ny: number, depth: number) {
  if (depth < 0.32) return 2;
  const d = nx * LX + ny * LY;
  if (d > 0.42) return 3;
  if (d < -0.62 && depth > 0.6) return 1;
  if (d < -0.25) return 1;
  return 2;
}

/** Rasterize a capsule; colour(u, v) returns ramp index or -1 to skip. */
function capsule(b: Buf, a0: V, c0: V, r0: number, layer: number, colour: (u: number, v: number) => number, toneShift = 0, r1 = r0) {
  // geometry comes in game pixels, rasterized at SS density
  const a: V = [a0[0] * SS, a0[1] * SS], c: V = [c0[0] * SS, c0[1] * SS];
  r0 *= SS;
  r1 *= SS;
  const rm = Math.max(r0, r1);
  const minX = Math.floor(Math.min(a[0], c[0]) - rm - 1), maxX = Math.ceil(Math.max(a[0], c[0]) + rm + 1);
  const minY = Math.floor(Math.min(a[1], c[1]) - rm - 1), maxY = Math.ceil(Math.max(a[1], c[1]) + rm + 1);
  const dx = c[0] - a[0], dy = c[1] - a[1];
  const l2 = dx * dx + dy * dy || 1e-6;
  const len = Math.sqrt(l2);
  const px_ = -dy / len, py_ = dx / len; // perpendicular
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      let t = ((cx - a[0]) * dx + (cy - a[1]) * dy) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = a[0] + dx * t, qy = a[1] + dy * t;
      const ex = cx - qx, ey = cy - qy;
      const d = Math.sqrt(ex * ex + ey * ey);
      const r = r0 + (r1 - r0) * t;
      if (d > r) continue;
      const v = (ex * px_ + ey * py_) / r;
      const col = colour(t, v);
      if (col < 0) continue;
      const nx = d > 0.01 ? ex / d : 0, ny = d > 0.01 ? ey / d : 0;
      const tone = Math.max(0, Math.min(3, toneFor(nx, ny, d / r) + toneShift));
      b.set(x, y, col, tone, layer);
    }
  }
}

export interface BuiltSheet {
  canvas: HTMLCanvasElement; // rows: 0 right, 1 left, 2 flash right, 3 flash left
}

const sheetCache = new Map<string, BuiltSheet>();

export function lookKey(l: PlayerLook) {
  return `${l.kit.id}|${l.kit.primary}|${l.kit.secondary}|${l.kit.shorts}|${l.kit.socks}|${l.kit.pattern}|${l.isGK}|${l.skin}|${l.hair}|${l.hairStyle}|${l.beard}|${l.face ?? 0}`;
}

export function playerSheet(look: PlayerLook): BuiltSheet {
  const key = lookKey(look);
  const hit = sheetCache.get(key);
  if (hit) return hit;
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
  // boot colour: each player picks his own (stable per look)
  let hsh = 0;
  for (const ch of look.skin + look.hair + look.hairStyle + (look.face ?? 0)) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
  ramps[R_ACC] = ramp(look.isGK ? '#5ff0a4' : BOOT_ACCENTS[Math.abs(hsh) % BOOT_ACCENTS.length]);

  const c = document.createElement('canvas');
  c.width = PW * FRAME_COUNT;
  c.height = PH * 4;
  const g = c.getContext('2d')!;
  const img = g.createImageData(PW, PH);

  POSES.forEach(([, pose], fi) => {
    const J = buildPose(pose, look.isGK);
    const b = new Buf();
    drawBody(b, J, look);
    finalize(b, ramps, img);
    g.putImageData(img, fi * PW, 0);
  });
  // mirrored row
  g.save();
  g.translate(c.width, 0);
  g.scale(-1, 1);
  for (let fi = 0; fi < FRAME_COUNT; fi++) {
    g.drawImage(c, fi * PW, 0, PW, PH, c.width - (fi + 1) * PW, PH, PW, PH);
  }
  g.restore();
  // white flash rows
  g.drawImage(c, 0, 0, c.width, PH * 2, 0, PH * 2, c.width, PH * 2);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#ffffff';
  g.fillRect(0, PH * 2, c.width, PH * 2);
  g.globalCompositeOperation = 'source-over';
  const built = { canvas: c };
  sheetCache.set(key, built);
  return built;
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
    // short sleeve with a cuff in the second colour (keepers: long sleeves)
    capsule(b, s, e, 1.8, layer, (u) => (!gk && u > 0.72 ? R_JER2 : R_JER), shift, 1.5);
    capsule(b, e, h, 1.4, layer, () => (gk ? R_JER : R_SKIN), shift, 1.15);
    capsule(b, h, h, gk ? 2.0 : 1.4, layer, (_u, v) => (gk ? (v > 0.4 ? R_ACC : R_WHITE) : R_SKIN), shift);
  };
  const leg = (k: V, f: V, layer: number, back: boolean) => {
    const shift = back ? -1 : 0;
    // thigh: shorts with a side stripe, then the knee
    capsule(b, J.hip, k, 2.15, layer, (u, v) => (u < 0.45 ? (Math.abs(v) < 0.2 && !gk ? R_JER2 : R_SHORTS) : R_SKIN), shift, 1.65);
    // shin: a strong calf, sock with two hoops at the top
    capsule(b, k, f, 1.8, layer, (u) => (u < 0.16 ? R_SKIN : u < 0.23 ? R_JER2 : u < 0.28 ? R_SOCK : u < 0.33 ? R_JER2 : R_SOCK), shift, 1.3);
    // boot points forward, perpendicular to the shin: dark upper, coloured stripe and sole, studs
    const sx = f[0] - k[0], sy = f[1] - k[1];
    const sl = Math.hypot(sx, sy) || 1;
    const fx = sy / sl, fy = -sx / sl;
    capsule(b, [f[0] - fx * 0.4, f[1] - fy * 0.4], [f[0] + fx * 2.3, f[1] + fy * 2.3], 1.4, layer, (u, v) => (v > 0.55 ? R_ACC : u > 0.3 && u < 0.62 && Math.abs(v + 0.05) < 0.22 ? R_ACC : R_BOOT), shift, 1.15);
  };

  arm(J.bs, J.be, J.bh, 1, true);
  leg(J.bk, J.bf, 2, true);

  // torso with kit pattern in local (u along body, v across: +front)
  capsule(b, J.hip, J.neck, 3.5, 3, (u, v) => {
    if (u > 0.9 && Math.abs(v) < 0.6) return R_JER2; // collar
    if (u > 0.86 && v > 0.55) return R_JER2; // collar tip at the front
    switch (pattern) {
      case 'stripes': return Math.floor((v + 1) * 3.2) % 2 ? R_JER2 : R_JER;
      case 'hoops': return Math.floor(u * 6) % 2 ? R_JER2 : R_JER;
      case 'half': return v < 0 ? R_JER2 : R_JER;
      case 'sash': return Math.abs(u - 0.5 + v * 0.45) < 0.16 ? R_JER2 : R_JER;
      case 'chevron': return Math.abs(u - 0.62 + Math.abs(v) * 0.3) < 0.1 ? R_JER2 : R_JER;
      case 'pinstripe': return Math.floor((v + 1) * 6) % 3 === 0 ? R_JER2 : R_JER;
      case 'checker': return (Math.floor(u * 5) + Math.floor((v + 1) * 2.5)) % 2 ? R_JER2 : R_JER;
      case 'band': return Math.abs(v) < 0.3 ? R_JER2 : R_JER;
      case 'yoke': return u > 0.66 ? R_JER2 : R_JER;
      case 'diagonal': return u - 0.5 + v * 0.5 > 0 ? R_JER2 : R_JER;
      case 'zigzag': return Math.abs(u - 0.5 - (Math.abs(((v + 1) * 3) % 2 - 1) - 0.5) * 0.2) < 0.08 ? R_JER2 : R_JER;
      case 'gk': return Math.abs(u - 0.55) < 0.08 ? R_JER2 : R_JER;
      default: return u < 0.12 ? R_JER2 : R_JER;
    }
  }, 0, 4.05);
  // shorts
  const ax = J.neck[0] - J.hip[0], ay = J.neck[1] - J.hip[1];
  const al = Math.hypot(ax, ay) || 1;
  const ux = ax / al, uy = ay / al;
  capsule(b, [J.hip[0] + ux * 0.9, J.hip[1] + uy * 0.9], [J.hip[0] - ux * 0.7, J.hip[1] - uy * 0.7], 3.6, 4, (u, v) => (u > 0.9 ? R_JER2 : Math.abs(v) < 0.14 && u < 0.6 && !gk ? R_JER2 : R_SHORTS));

  leg(J.fk, J.ff, 5, false);

  // neck
  capsule(b, J.neck, [J.neck[0] + (J.head[0] - J.neck[0]) * 0.5, J.neck[1] + (J.head[1] - J.neck[1]) * 0.5], 1.85, 6, () => R_SKIN, -1);
  drawHead(b, J, look);

  arm(J.fs, J.fe, J.fh, 7, false);
}

function drawHead(b: Buf, J: Joints, look: PlayerLook) {
  const [hx, hy] = J.head;
  const ca = Math.cos(-J.headAng), sa = Math.sin(-J.headAng);
  const R = 4.45;
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
      case 7: return (inHead && (ly < -1.6 || (lx < -1.6 && ly < 1.4))) || Math.hypot(lx + 1.4, ly + 5.1) < 1.9;
      case 8: return (inHead && (ly < -1.3 || (lx < -2 && ly < 0.8))) || (ly < -0.6 && lx < 2.6 && Math.hypot(lx + 0.3, ly) < R + 1 + 0.7 * Math.sin(Math.atan2(ly, lx) * 7));
      case 9: return (inHead && (ly < -1.6 || (lx < -1.6 && ly < 1.4) || (lx > 0 && lx < 3.4 && ly < -0.7))) || (!inHead && lx < -1 && lx > -5.5 && ly > -2.5 && ly < 3 && Math.hypot(lx + 2.6, ly - 0.4) < 3.3);
      case 10: return (inHead && (ly < -1.6 || (lx < -1.4 && ly < 1.6))) || (!inHead && lx < 0.6 && ly > -3.5 && ly < 6.5 && Math.hypot(lx + 2, ly) < 6.3 && Math.floor(lx + 9) % 2 === 0);
      case 11: return (ly < -1.6 && ly > -7.2 && lx > -3.7 && lx < 3.3 && (inHead || ly < -2.4)) || (inHead && lx < -2.4 && ly < 0.4);
      default: return false;
    }
  };
  const fs = look.face ?? 0;
  const headIn = (lx: number, ly: number, d: number) => {
    switch (fs) {
      case 1: return d <= R + 0.35;
      case 2: return Math.pow(Math.pow(Math.abs(lx), 4) + Math.pow(Math.abs(ly), 4), 0.25) <= R - 0.15;
      case 3: return Math.hypot(lx * 1.06, ly * 0.88) <= R;
      case 4: return d <= R - Math.max(0, ly - 1) * 0.45;
      default: return d <= R;
    }
  };
  const minX = Math.floor((hx - 8) * SS), maxX = Math.ceil((hx + 8) * SS), minY = Math.floor((hy - 8) * SS), maxY = Math.ceil((hy + 8) * SS);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x + 0.5) / SS - hx, dy = (y + 0.5) / SS - hy;
      const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
      const d = Math.hypot(dx, dy);
      const inHead = headIn(lx, ly, d);
      const nose = lx > 3.4 && lx < 4.9 && ly > -0.2 && ly < 1.4;
      let col = -1, tone = 2;
      if (hairAt(lx, ly, inHead)) {
        col = R_HAIR;
        tone = toneFor(d > 0 ? dx / d : 0, d > 0 ? dy / d : 0, Math.min(1, d / 5));
        // glossy strands catching the light
        if (tone === 2 && ly < -0.8 && ((x - (y >> 1)) & 3) === 0) tone = 3;
      } else if (inHead || nose) {
        col = R_SKIN;
        tone = toneFor(d > 0 ? dx / d : 0, d > 0 ? dy / d : 0, d / R);
        if (look.beard && ly > 1.3 && lx > -1.6 && inHead) {
          col = R_HAIR;
          tone = 1;
        }
        if (st === 6 && ly > -1.9 && ly < -0.8 && inHead) {
          col = R_JER2;
          tone = 2;
        }
        // ear
        if (Math.abs(lx + 0.7) < 0.75 && Math.abs(ly - 0.4) < 0.9 && col === R_SKIN) tone = 1;
      }
      if (col < 0) continue;
      b.set(x, y, col, tone, 6);
    }
  }
  // face features (in local coords -> pixel)
  const P = (lx: number, ly: number): [number, number] => {
    const c2 = Math.cos(J.headAng), s2 = Math.sin(J.headAng);
    return [Math.floor((hx + lx * c2 - ly * s2) * SS), Math.floor((hy + lx * s2 + ly * c2) * SS)];
  };
  /** a face feature: one game pixel (SS x SS HD pixels), or a finer `size` */
  const dot = (lx: number, ly: number, r: number, tone = 2, size = SS) => {
    const [x, y] = P(lx, ly);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) b.set(x + i, y + j, r, tone, 6);
  };
  // face, drawn with HD detail: eye white + pupil, brows, mouth
  const eye = (oy = 0, closed = false) => {
    if (closed) {
      dot(1.5, -0.2 + oy, R_EYE, 2, 1); dot(2.0, -0.2 + oy, R_EYE, 2, 1); dot(2.5, -0.2 + oy, R_EYE, 2, 1);
      return;
    }
    dot(1.4, -0.6 + oy, R_WHITE, 3, 2);
    dot(2.4, -0.6 + oy, R_WHITE, 3, 1);
    dot(2.4, -0.1 + oy, R_WHITE, 2, 1);
    dot(2.0, -0.6 + oy, R_EYE, 2, 1);
    dot(2.0, -0.1 + oy, R_EYE, 2, 1);
  };
  const brow = (tilt: number) => {
    dot(1.2, -1.6 - tilt * 0.4, R_HAIR, 0, 1);
    dot(1.7, -1.7, R_HAIR, 0, 1);
    dot(2.2, -1.7 + tilt * 0.4, R_HAIR, 0, 1);
    dot(2.7, -1.6 + tilt * 0.6, R_HAIR, 0, 1);
  };
  switch (J.face) {
    case 'ko':
      dot(1.5, -0.9, R_EYE, 2, 1); dot(2.5, 0.1, R_EYE, 2, 1); dot(2.5, -0.9, R_EYE, 2, 1); dot(1.5, 0.1, R_EYE, 2, 1); dot(2.0, -0.4, R_EYE, 2, 1);
      dot(2.3, 2.2, R_MOUTH, 1, 2);
      break;
    case 'happy':
      eye(0.1, true); brow(-0.3);
      dot(1.8, 1.8, R_MOUTH, 1, 1); dot(2.3, 2.2, R_MOUTH, 0, 1); dot(2.8, 2.3, R_MOUTH, 0, 1); dot(3.3, 2.0, R_MOUTH, 1, 1);
      dot(2.5, 2.7, R_WHITE, 3, 1);
      break;
    case 'shout':
      eye(); brow(1);
      dot(2.3, 1.7, R_MOUTH, 0, 2); dot(2.8, 2.2, R_MOUTH, 0, 2); dot(2.6, 1.7, R_WHITE, 3, 1);
      break;
    case 'angry':
      eye(); brow(1.3);
      dot(2.4, 2.1, R_MOUTH, 1, 1); dot(2.9, 2.1, R_MOUTH, 1, 1);
      break;
    case 'sad':
      eye(0.3); brow(-1);
      dot(2.3, 2.4, R_MOUTH, 1, 1); dot(2.8, 2.2, R_MOUTH, 1, 1);
      break;
    default:
      eye(); brow(0);
      dot(2.5, 2.1, R_MOUTH, 1, 1); dot(3.0, 2.0, R_MOUTH, 1, 1);
  }
  // cheek catching the light, and the ear's inner shadow
  if (J.face !== 'ko') dot(1.0, 1.0, R_SKIN, 3, 1);
  dot(-0.8, 0.3, R_SKIN, 0, 1);
}

function finalize(b: Buf, ramps: RGB[][], img: ImageData) {
  const W = PW, H = PH;
  // inner contours: front parts darken the edge of what is behind them
  const tone = b.tone.slice();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (b.ramp[i] < 0) continue;
      const L = b.layer[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (b.ramp[j] < 0) continue;
        const L2 = b.layer[j];
        if (L2 < L && !(L === 4 && L2 === 3)) {
          tone[j] = 0;
        }
      }
    }
  }
  const d = img.data;
  for (let i = 0; i < W * H; i++) {
    const r = b.ramp[i];
    const o = i * 4;
    if (r >= 0) {
      let c = ramps[r][tone[i]];
      // cool rim light on the shadow-side silhouette: gives the body volume
      const x = i % W, y = (i / W) | 0;
      if (b.get(x - 1, y) < 0 && b.get(x + 1, y) >= 0 && tone[i] < 3) c = mix(c, RIM, 0.3);
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    } else {
      // outline if any 4-neighbour is filled
      const x = i % W, y = (i / W) | 0;
      let nb = -1;
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const v = b.get(x + dx, y + dy);
        if (v >= 0) {
          nb = v;
          break;
        }
      }
      if (nb >= 0) {
        const c = mix(ramps[nb][0], OUTLINE, 0.6);
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      } else {
        d[o + 3] = 0;
      }
    }
  }
}
