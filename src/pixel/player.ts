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
  /** eye style and iris colour */
  eyes?: number;
  eyeColor?: string;
  /** equipped football boots (default: dark boots with a random stripe colour) */
  boot?: { main: string; accent: string };
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
// finishers: bicycle kick (wind-up, strike), diving header, volley
add('bike0', { rot: -1.35, tF: 0.35, kF: 1.3, tB: 1.35, kB: 0.35, aF: 1.7, eF: 0.3, aB: -1.3, eB: 0.4, face: 'angry' });
add('bike1', { rot: -2.25, tF: 1.45, kF: 0.08, tB: 0.15, kB: 1.4, aF: 2.3, eF: 0.2, aB: -1.6, eB: 0.3, face: 'shout' });
add('dhead', { rot: PI / 2 + 0.08, tF: 0.12, kF: 0.45, tB: -0.18, kB: 0.7, aF: -0.55, eF: 0.25, aB: -0.8, eB: 0.2, face: 'angry' });
add('volley', { lean: -0.38, tF: 1.8, kF: 0.12, tB: -0.12, kB: 0.4, aF: -1.45, eF: 0.3, aB: 1.35, eB: 0.4, face: 'shout' });
// skill moves: stepover (two frames, the foot circles the ball), rainbow flick, drag back
add('step0', { lean: 0.14, tF: 0.6, kF: 1.35, tB: -0.25, kB: 0.45, aF: -1.0, eF: 0.7, aB: 1.0, eB: 0.7, face: 'happy' });
add('step1', { lean: 0.1, tF: -0.3, kF: 1.05, tB: 0.55, kB: 0.7, aF: 1.0, eF: 0.6, aB: -1.0, eB: 0.6, face: 'happy' });
add('flick', { lean: 0.08, tF: 0.15, kF: 0.25, tB: -0.95, kB: 2.35, aF: -0.8, eF: 0.8, aB: 0.8, eB: 0.8, face: 'happy' });
add('drag', { lean: -0.14, tF: 0.6, kF: 0.12, tB: -0.25, kB: 0.55, aF: -1.25, eF: 0.3, aB: 1.25, eB: 0.3 });

export const FRAMES: Record<string, number> = Object.fromEntries(POSES.map(([n], i) => [n, i]));
export const FRAME_COUNT = POSES.length;

type V = [number, number];

interface Joints {
  hip: V; neck: V; head: V; headAng: number;
  /** hip joints of the near (front) and far (back) leg: apart in front / back views */
  hipF: V; hipB: V;
  fk: V; ff: V; bk: V; bf: V;
  fs: V; fe: V; fh: V; bs: V; be: V; bh: V;
  face: NonNullable<PoseP['face']>;
  /** view: cos / sin of the facing angle (0 = side, facing right; +90 deg = facing the camera) */
  vc: number;
  vs: number;
  view: number;
  /** depth toward the camera per joint (draw order of the limbs) */
  depth: Record<string, number>;
}

/** human proportions (head about a fifth of the height), athletic build */
const THIGH = 6.0, SHIN = 5.9, TORSO = 9.2, NECK = 5.1, UARM = 4.5, FARM = 4.1;
export const HEAD_R = 4.3;
const HEAD_K = HEAD_R / 4.45;

/**
 * The views every pose is drawn from (facing angle, screen y pointing down at the camera):
 * side, front-diagonal, front, back-diagonal, back. Mirroring makes the other three of
 * the 8 directions.
 */
export const VIEWS = [0, PI / 4, PI / 2, -PI / 4, -PI / 2];
export const VIEW_COUNT = VIEWS.length;
/** how much a step toward / away from the camera moves a joint down / up on screen */
const PERSP = 0.32;
/** sideways offsets of the joints (player's right = +): shoulders, hips, limbs */
const LAT: Record<string, number> = { hip: 0, neck: 0, head: 0, hipF: 1.45, hipB: -1.45, fk: 1.5, ff: 1.55, bk: -1.5, bf: -1.55, fs: 3.55, fe: 3.85, fh: 4.0, bs: -3.55, be: -3.85, bh: -4.0 };
const JOINT_KEYS = ['hip', 'hipF', 'hipB', 'neck', 'head', 'fk', 'ff', 'bk', 'bf', 'fs', 'fe', 'fh', 'bs', 'be', 'bh'] as const;

function buildPose(p: PoseP, isGK: boolean, view = 0): Joints {
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
  // lying / flying poses are only ever drawn from the side
  const rot = p.rot ?? 0;
  const phi = rot ? 0 : VIEWS[view] ?? 0;
  const vc = Math.cos(phi), vs = Math.sin(phi);
  const J: Joints = { hip, hipF: [0, 0], hipB: [0, 0], neck, head, headAng, fk, ff, bk, bf, fs, fe, fh, bs, be, bh, face: p.face ?? 'normal', vc, vs, view: rot ? 0 : view, depth: {} };

  // whole-body rotation around the hip (in the side plane)
  if (rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const k of JOINT_KEYS) {
      const [x, y] = J[k];
      J[k] = [x * c - y * s, x * s + y * c];
    }
    J.headAng += rot;
  }
  // into the view: forward f and sideways lat -> screen x, depth toward the camera
  for (const k of JOINT_KEYS) {
    const [f, y] = J[k];
    const lat = LAT[k] ?? 0;
    const d = f * vs + lat * vc;
    J.depth[k] = d;
    J[k] = [f * vc - lat * vs, y + d * PERSP * Math.abs(vs)];
  }
  // ground align: lowest point touches the ground line, centre horizontally for lying poses
  const lows = [J.ff[1] + 1.2, J.bf[1] + 1.2, J.head[1] + HEAD_R - 0.2, J.hip[1] + 3.3, J.neck[1] + 3.2, J.fh[1] + 1.2, J.bh[1] + 1.2];
  const low = Math.max(...lows);
  let dx = ANCHOR_X;
  if (rot) {
    const xs = [J.ff[0], J.bf[0], J.head[0], J.fh[0], J.bh[0], J.hip[0]];
    dx = ANCHOR_X - (Math.min(...xs) + Math.max(...xs)) / 2;
  }
  const dy = ANCHOR_Y - low;
  for (const k of JOINT_KEYS) {
    J[k] = [J[k][0] + dx, J[k][1] + dy];
  }
  return J;
}

// ------------------------------------------------------------------ raster

const R_JER = 0, R_JER2 = 1, R_SHORTS = 2, R_SOCK = 3, R_SKIN = 4, R_HAIR = 5, R_BOOT = 6, R_WHITE = 7, R_EYE = 8, R_MOUTH = 9, R_ACC = 10, R_IRIS = 11;
const BOOT_ACCENTS = ['#ff4d3d', '#ffd23f', '#3bd9ff', '#5ff0a4', '#ff3fa4', '#ff8a1f', '#f4f4f4'];

class Buf {
  /** layers of the shirt and the shorts: no inner contour between those two */
  torsoL = 3;
  shortsL = 4;
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

/** near-eye bitmaps (facing right) per eye style */
const EYE_BITMAPS: string[][] = [
  ['.ll', 'wip', '.w.'], // round
  ['.ll', 'wip'], // almond
  ['lll', 'wip', 'wip'], // big
  ['...', 'lll', 'wip'], // sleepy
  ['l..', '.ll', 'wip'], // sharp
  ['...', '.p', '.p'], // dot
  ['l.l', 'lll', 'wip'], // lashes
];

function toneFor(nx: number, ny: number, depth: number) {
  if (depth < 0.32) return 2;
  const d = nx * LX + ny * LY;
  if (d > 0.42) return 3;
  if (d < -0.62 && depth > 0.6) return 1;
  if (d < -0.25) return 1;
  return 2;
}

/** Rasterize a capsule; colour(u, v) returns ramp index or -1 to skip. */
function capsule(b: Buf, a0: V, c0: V, r0: number, layer: number, colour: (u: number, v: number) => number, toneShift = 0, r1: number | ((t: number) => number) = r0) {
  // r1 may be a profile function (muscles): radius in game pixels along t = 0..1
  const prof = typeof r1 === 'function' ? r1 : null;
  if (prof) {
    let mx = 0;
    for (let k = 0; k <= 10; k++) mx = Math.max(mx, prof(k / 10));
    r0 = mx;
    r1 = mx;
  }
  // geometry comes in game pixels, rasterized at SS density
  const a: V = [a0[0] * SS, a0[1] * SS], c: V = [c0[0] * SS, c0[1] * SS];
  r0 *= SS;
  r1 = (r1 as number) * SS;
  const rEnd = r1;
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
      const r = prof ? prof(t) * SS : r0 + (rEnd - r0) * t;
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

/**
 * A player's sprites: one strip per view (side, front-diagonal, front, back-diagonal,
 * back), every pose in a row. Cells are rasterized only when first drawn, strips are
 * only allocated when a view is first needed, mirrored directions are drawn flipped
 * and the white "hit" flash strips exist only for the cells that flashed.
 */
export interface BuiltSheet {
  look: PlayerLook;
  ramps: RGB[][];
  strips: (HTMLCanvasElement | null)[];
  flash: (HTMLCanvasElement | null)[];
  built: Uint8Array;
  flashBuilt: Uint8Array;
}

const sheetCache = new Map<string, BuiltSheet>();

export function lookKey(l: PlayerLook) {
  return `${l.kit.id}|${l.kit.primary}|${l.kit.secondary}|${l.kit.shorts}|${l.kit.socks}|${l.kit.pattern}|${l.isGK}|${l.skin}|${l.hair}|${l.hairStyle}|${l.beard}|${l.face ?? 0}|${l.eyes ?? 0}|${l.eyeColor ?? ''}|${l.boot ? l.boot.main + l.boot.accent : ''}`;
}

/**
 * Sheets are capped (least recently used go first): menus used to keep a full sheet for
 * every kit / colour / face they previewed, which could run a phone's WebView out of
 * memory and crash the app. Menus draw single frames instead (playerFrame).
 */
const SHEET_MAX = 36;

export function playerSheet(look: PlayerLook): BuiltSheet {
  const key = lookKey(look);
  const hit = sheetCache.get(key);
  if (hit) {
    sheetCache.delete(key);
    sheetCache.set(key, hit);
    return hit;
  }
  while (sheetCache.size >= SHEET_MAX) {
    const old = sheetCache.keys().next().value as string;
    const sh = sheetCache.get(old);
    sheetCache.delete(old);
    // release the pixels right away instead of waiting for the GC
    if (sh) for (const c of [...sh.strips, ...sh.flash]) if (c) c.width = c.height = 0;
  }
  const n = VIEW_COUNT * FRAME_COUNT;
  const sh: BuiltSheet = { look, ramps: rampsFor(look), strips: VIEWS.map(() => null), flash: VIEWS.map(() => null), built: new Uint8Array(n), flashBuilt: new Uint8Array(n) };
  sheetCache.set(key, sh);
  return sh;
}

let cellImg: ImageData | null = null;
/** The strip of a view with that pose in it (rasterized on first use). */
function stripWith(sh: BuiltSheet, view: number, fi: number): HTMLCanvasElement {
  let c = sh.strips[view];
  if (!c) {
    c = sh.strips[view] = document.createElement('canvas');
    c.width = PW * FRAME_COUNT;
    c.height = PH;
  }
  const k = view * FRAME_COUNT + fi;
  if (!sh.built[k]) {
    sh.built[k] = 1;
    const g = c.getContext('2d')!;
    cellImg ??= g.createImageData(PW, PH);
    const b = new Buf();
    drawBody(b, buildPose(POSES[fi][1], sh.look.isGK, view), sh.look);
    finalize(b, sh.ramps, cellImg);
    g.putImageData(cellImg, fi * PW, 0);
  }
  return c;
}

function flashWith(sh: BuiltSheet, view: number, fi: number): HTMLCanvasElement {
  const src = stripWith(sh, view, fi);
  let c = sh.flash[view];
  if (!c) {
    c = sh.flash[view] = document.createElement('canvas');
    c.width = PW * FRAME_COUNT;
    c.height = PH;
  }
  const k = view * FRAME_COUNT + fi;
  if (!sh.flashBuilt[k]) {
    sh.flashBuilt[k] = 1;
    const g = c.getContext('2d')!;
    g.drawImage(src, fi * PW, 0, PW, PH, fi * PW, 0, PW, PH);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#ffffff';
    g.fillRect(fi * PW, 0, PW, PH);
    g.globalCompositeOperation = 'source-over';
  }
  return c;
}

/** poses that are only ever seen from the side (lying, sliding, flying) */
const SIDE_ONLY = new Set(POSES.filter(([, p]) => p.rot).map(([n]) => n));
/** 8 directions -> [view, mirrored]: E, SE, S, SW, W, NW, N, NE (screen y down) */
const DIR8: [number, boolean][] = [[0, false], [1, false], [2, false], [1, true], [0, true], [3, true], [4, false], [3, false]];

/** 0..7 direction sector of a facing angle (0 = right, 2 = toward the camera) */
export function dirOf(face: number) {
  return ((Math.round(face / (PI / 4)) % 8) + 8) % 8;
}

/**
 * Draw a player: pose `frame`, looking toward direction sector `dir` (dirOf), feet at (x, y).
 * `flash` draws the white hit silhouette.
 */
export function drawPlayer(ctx: CanvasRenderingContext2D, look: PlayerLook, frame: string, dir: number, x: number, y: number, flash = false, left = dir >= 3 && dir <= 5) {
  const fi = FRAMES[frame] ?? 0;
  let [view, mirror] = DIR8[((dir % 8) + 8) % 8];
  if (SIDE_ONLY.has(frame)) {
    // lying / flying poses: side on, to the left or the right
    view = 0;
    mirror = left;
  }
  const sh = playerSheet(look);
  const strip = flash ? flashWith(sh, view, fi) : stripWith(sh, view, fi);
  const dx = Math.round(x - ANCHOR_X), dy = Math.round(y - ANCHOR_Y);
  if (mirror) {
    ctx.save();
    ctx.translate(dx + CELL_W, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(strip, fi * PW, 0, PW, PH, 0, 0, CELL_W, CELL_H);
    ctx.restore();
  } else ctx.drawImage(strip, fi * PW, 0, PW, PH, dx, dy, CELL_W, CELL_H);
}

/** Rasterize some cells ahead of time (all views), within a time budget per call. */
const warmQ: [BuiltSheet, number, number][] = [];
export function warmPlayer(look: PlayerLook, frames: string[]) {
  const sh = playerSheet(look);
  for (let v = 0; v < VIEW_COUNT; v++) for (const f of frames) if (FRAMES[f] !== undefined) warmQ.push([sh, v, FRAMES[f]]);
}
export function pumpWarm(ms: number) {
  const t0 = performance.now();
  while (warmQ.length && performance.now() - t0 < ms) {
    const [sh, v, fi] = warmQ.shift()!;
    if (sheetCache.get(lookKey(sh.look)) === sh) stripWith(sh, v, fi);
  }
}

/** Dev tool: every pose of every view on one canvas (tools/sheet.html). */
export function sheetPreview(look: PlayerLook): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = PW * FRAME_COUNT;
  c.height = PH * VIEW_COUNT;
  const g = c.getContext('2d')!;
  const sh = playerSheet(look);
  for (let v = 0; v < VIEW_COUNT; v++) for (let fi = 0; fi < FRAME_COUNT; fi++) g.drawImage(stripWith(sh, v, fi), fi * PW, 0, PW, PH, fi * PW, v * PH, PW, PH);
  return c;
}

const frameCache = new Map<string, HTMLCanvasElement>();
/** One pose of a player (menus, cards, previews): a small canvas, no full sheet. */
export function playerFrame(look: PlayerLook, frame: string, view = 0): HTMLCanvasElement {
  const key = lookKey(look) + '#' + frame + '#' + view;
  const hit = frameCache.get(key);
  if (hit) return hit;
  if (frameCache.size > 160) frameCache.delete(frameCache.keys().next().value as string);
  const c = document.createElement('canvas');
  c.width = PW;
  c.height = PH;
  const g = c.getContext('2d')!;
  const img = g.createImageData(PW, PH);
  const pose = (POSES.find(([n]) => n === frame) ?? POSES[0])[1];
  const b = new Buf();
  drawBody(b, buildPose(pose, look.isGK, view), look);
  finalize(b, rampsFor(look), img);
  g.putImageData(img, 0, 0);
  frameCache.set(key, c);
  return c;
}

function rampsFor(look: PlayerLook): RGB[][] {
  const kit = look.kit;
  const ramps: RGB[][] = [];
  ramps[R_JER] = ramp(look.isGK ? kit.gk : kit.primary);
  ramps[R_JER2] = ramp(look.isGK ? darken(kit.gk) : kit.secondary);
  ramps[R_SHORTS] = ramp(look.isGK ? darken(kit.gk) : kit.shorts);
  ramps[R_SOCK] = ramp(look.isGK ? kit.gk : kit.socks);
  ramps[R_SKIN] = ramp(look.skin);
  ramps[R_HAIR] = ramp(look.hair);
  ramps[R_BOOT] = ramp(look.boot?.main ?? '#2a2a36');
  ramps[R_WHITE] = ramp('#eef0f5');
  ramps[R_EYE] = ramp('#16121e');
  ramps[R_MOUTH] = ramp('#8a2030');
  ramps[R_IRIS] = ramp(look.eyeColor ?? '#5a3e2e');
  // boot colour: each player picks his own (stable per look)
  let hsh = 0;
  for (const ch of look.skin + look.hair + look.hairStyle + (look.face ?? 0)) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
  ramps[R_ACC] = ramp(look.boot?.accent ?? (look.isGK ? '#5ff0a4' : BOOT_ACCENTS[Math.abs(hsh) % BOOT_ACCENTS.length]));
  return ramps;
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
    // deltoid -> biceps -> elbow, forearm bulge -> wrist, then the hand
    capsule(b, s, e, 1.9, layer, (u) => (!gk && u > 0.68 ? R_JER2 : R_JER), shift, (t) => (t < 0.2 ? 1.95 : t < 0.55 ? 1.55 : 1.55 - (t - 0.55) * 0.6));
    capsule(b, e, h, 1.3, layer, () => (gk ? R_JER : R_SKIN), shift, (t) => (t < 0.35 ? 1.3 + t * 0.4 : 1.44 - (t - 0.35) * 0.65));
    capsule(b, h, h, gk ? 1.75 : 1.2, layer, (_u, v) => (gk ? (v > 0.4 ? R_ACC : R_WHITE) : R_SKIN), shift);
  };
  const leg = (hp: V, k: V, f: V, layer: number, back: boolean) => {
    const shift = back ? -1 : 0;
    // thigh: shorts with a side stripe, then the knee
    capsule(b, hp, k, 2.3, layer, (u, v) => (u < 0.45 ? (Math.abs(v) < 0.2 && !gk ? R_JER2 : R_SHORTS) : R_SKIN), shift, (t) => 2.3 - t * 0.75);
    // shin: a strong calf, sock with two hoops at the top
    capsule(b, k, f, 1.6, layer, (u) => (u < 0.14 ? R_SKIN : u < 0.24 ? R_JER2 : u < 0.31 ? R_SOCK : u < 0.39 ? R_JER2 : R_SOCK), shift, (t) => (t < 0.32 ? 1.5 + t * 0.9 : 1.79 - (t - 0.32) * 0.95));
    // boot points forward, perpendicular to the shin: dark upper, coloured stripe and sole, studs
    const sx = f[0] - k[0], sy = f[1] - k[1];
    const sl = Math.hypot(sx, sy) || 1;
    const fx = sy / sl, fy = -sx / sl;
    capsule(b, [f[0] - fx * 0.6, f[1] - fy * 0.6], [f[0] + fx * 2.7, f[1] + fy * 2.7], 1.35, layer, (u, v) => (v > 0.55 ? R_ACC : u > 0.3 && u < 0.62 && Math.abs(v + 0.05) < 0.22 ? R_ACC : R_BOOT), shift, 1.15);
  };

  // front / back views: the body is wider than it is deep
  const wide = 1 + 0.17 * Math.abs(J.vs);
  const facingUs = J.vs > -0.3;
  const torso = (layer: number) =>
    capsule(b, J.hip, J.neck, 3.4, layer, (u, v) => {
      if (u > 0.9 && Math.abs(v) < 0.6) return R_JER2; // collar
      // collar tip at the front (side: the right edge, front: the middle, back: none)
      if (facingUs && u > 0.84 && Math.abs(v - J.vc * 0.75) < 0.28) return R_JER2;
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
    }, 0, (t) => (t < 0.7 ? 3.3 + t * 1.15 : 4.1 - (t - 0.7) * 1.3) * wide);
  const shorts = (layer: number) => {
    const ax = J.neck[0] - J.hip[0], ay = J.neck[1] - J.hip[1];
    const al = Math.hypot(ax, ay) || 1;
    const ux = ax / al, uy = ay / al;
    capsule(b, [J.hip[0] + ux * 0.9, J.hip[1] + uy * 0.9], [J.hip[0] - ux * 0.7, J.hip[1] - uy * 0.7], 3.6 * (1 + 0.1 * Math.abs(J.vs)), layer, (u, v) => (u > 0.9 ? R_JER2 : Math.abs(v) < 0.14 && u < 0.6 && !gk && Math.abs(J.vs) < 0.5 ? R_JER2 : R_SHORTS));
  };
  const headPart = (layer: number) => {
    // the neck: seen from the front or the back it is a short column under the chin
    const nk = J.view === 0 ? 0.62 : 0.5;
    const n0: V = J.view === 0 ? J.neck : [J.neck[0] + (J.head[0] - J.neck[0]) * 0.12, J.neck[1] + (J.head[1] - J.neck[1]) * 0.12];
    capsule(b, n0, [J.neck[0] + (J.head[0] - J.neck[0]) * nk, J.neck[1] + (J.head[1] - J.neck[1]) * nk], J.view === 0 ? 1.65 : 1.35, layer, () => R_SKIN, -1);
    if (J.view === 0) drawHead(b, J, look, layer);
    else drawHead3D(b, J, look, layer);
  };
  const D = J.depth;
  const avg = (...k: string[]) => k.reduce((a, x) => a + D[x], 0) / k.length;
  // everything is painted back to front for this view
  const parts: [number, (layer: number, back: boolean) => void][] = [
    [avg('bs', 'be', 'bh'), (l, bk) => arm(J.bs, J.be, J.bh, l, bk)],
    [avg('fs', 'fe', 'fh'), (l, bk) => arm(J.fs, J.fe, J.fh, l, bk)],
    [avg('bk', 'bf') - 0.2, (l, bk) => leg(J.hipB, J.bk, J.bf, l, bk)],
    [avg('fk', 'ff') - 0.2, (l, bk) => leg(J.hipF, J.fk, J.ff, l, bk)],
    [0, (l) => { b.torsoL = l; torso(l); }],
    [0.05, (l) => { b.shortsL = l; shorts(l); }],
    [Math.max(D.head, 0.1), (l) => headPart(l)],
  ];
  parts.sort((x, y) => x[0] - y[0]);
  parts.forEach(([d, fn], i) => fn(i + 1, d < -1));
}

/** Hair of each style in head-local coordinates (lx forward, ly down; side profile). */
function hairAtFor(st: number, lx: number, ly: number, inHead: boolean): boolean {
const R = 4.45;
  switch (st) {
    case 0: return inHead && (ly < -1.6 || (lx < -1.6 && ly < 1.4));
    case 1: return inHead && (ly < -2.5 || (lx < -2.7 && ly < 0.2));
    case 2: return Math.hypot(lx + 0.7, ly + 1.0) < 5.0 && (!inHead || ly < -1.6 || lx < -1.8);
    case 3: return (Math.abs(lx + 0.3) < 1.4 && ly < -2.2 && ly > -6.6) || (inHead && lx < -2.8 && ly < 0);
    case 4: return false;
    case 5: return (inHead && (ly < -1.5 || (lx < -1.4 && ly < 2))) || (!inHead && lx < -1.5 && ly > -2.5 && ly < 4.2 && Math.hypot(lx + 2.2, (ly - 0.6) * 0.8) < 3.6);
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
}

/** hair styles whose outside part is a thin crest rather than all round the head */
const EXTRUDE: Record<number, number> = { 3: 0.9, 7: 1.6, 9: 3.4, 11: 3.7 };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

const FACE_JAW: [number, number, number, number][] = [
  [1.35, 1.8, 3.0, 2.75], // classic
  [1.0, 1.6, 3.4, 2.8], // round
  [1.3, 1.9, 3.1, 2.85], // square
  [1.35, 2.2, 2.85, 3.1], // long
  [1.6, 2.0, 2.8, 2.7], // sharp chin
];

/** front-on eyes per eye style (the player's right eye; the left one is mirrored) */
const FRONT_EYES: string[][] = [
  ['ll', 'ip', 'w.'], // round
  ['ll', 'ip'], // almond
  ['ll', 'ip', 'ip'], // big
  ['..', 'll', 'ip'], // sleepy
  ['l.', 'll', 'ip'], // sharp
  ['.p', '.p'], // dot
  ['ll', 'll', 'ip'], // lashes
];

/**
 * The head from any view but the pure side: a cranium and a jaw as ellipsoids, traced
 * per pixel from the camera, with the same hair styles as the profile head and a
 * two-eyed face whenever the face is turned toward us.
 */
function drawHead3D(b: Buf, J: Joints, look: PlayerLook, layer: number) {
  const [hx, hy] = J.head;
  const c = J.vc, s = J.vs;
  const st = look.hairStyle;
  const fsh = look.face ?? 0;
  const [jx, jy, jrx, jry0] = FACE_JAW[fsh] ?? FACE_JAW[0];
  const jry = jry0 * 0.88;
  const jawW = fsh === 2 ? 3.0 : fsh === 1 ? 3.1 : 2.75;
  const CR = 3.85; // half width of the cranium
  const inHead = (f: number, ly: number, lat: number) => {
    if (((f + 0.4) / 4.2) ** 2 + ((ly + 0.75) / (fsh === 3 ? 3.95 : 3.8)) ** 2 + (lat / CR) ** 2 < 1) return true;
    if (ly < 0) return false;
    // the jaw narrows toward the chin
    const w = jawW * (1 - 0.38 * Math.max(0, (ly - jy) / jry));
    return ((f - jx) / jrx) ** 2 + ((ly - jy) / jry) ** 2 + (lat / w) ** 2 < 1;
  };
  // seen from behind, short hair still covers the back of the head down to the nape
  const backHair = st !== 3 && st !== 4;
  const nose = (f: number, ly: number, lat: number) => Math.abs(lat) < 0.5 && f > 3.2 && f < 4.2 && ly > -0.5 && ly < 1.0 - Math.max(0, f - 3.8) * 1.2;
  const ear = (f: number, ly: number, lat: number) => Math.abs(f + 1.2) < 0.6 && Math.abs(ly - 0.4) < 0.9 && Math.abs(lat) > 2.9 && Math.abs(lat) < 3.85;
  const hairW = 6;
  const R = 4.45;
  const E = 8 * HEAD_K;
  const minX = Math.floor((hx - E) * SS), maxX = Math.ceil((hx + E) * SS), minY = Math.floor((hy - E) * SS), maxY = Math.ceil((hy + E) * SS);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = ((x + 0.5) / SS - hx) / HEAD_K, ly = ((y + 0.5) / SS - hy) / HEAD_K;
      const dd = Math.hypot(dx, ly);
      if (dd > 7.6) continue;
      // march from the camera into the head; the first thing we meet is what we see
      for (let d = 6.5; d > -6.5; d -= 0.22) {
        const f = dx * c + d * s, lat = -dx * s + d * c;
        const hin = inHead(f, ly, lat);
        // hair outside the skull: the profile shape turned round the head's vertical axis
        // (sideways distance counts like distance toward the back of the head)
        let hairVol = false;
        if (!hin && Math.abs(lat) < hairW) {
          if (st === 6) {
            // spikes all round the crown
            const hr = Math.hypot(f + 0.4, lat);
            const el = Math.atan2(-ly - 0.75, hr);
            const az = Math.atan2(lat, f + 0.4);
            const r3 = Math.hypot(hr, ly + 0.75);
            hairVol = ly < -1.6 && el > 0.3 && r3 < 4.2 + Math.abs(Math.sin(el * 3.5)) * (0.6 + 0.4 * Math.abs(Math.cos(az * 3))) * 2.4 * clamp((el - 0.3) / 0.8, 0, 1);
          } else if (EXTRUDE[st] !== undefined) {
            // a crest / knot / flat top: the profile shape, only so wide
            hairVol = Math.abs(lat) < EXTRUDE[st] && hairAtFor(st, f, ly, false);
          } else {
            const rf = f + 0.4;
            const fr = -0.4 + (rf > 0.6 ? 1 : -1) * Math.sqrt(rf * rf + lat * lat);
            hairVol = hairAtFor(st, fr, ly, false);
          }
        }
        const isNose = !hin && nose(f, ly, lat);
        const isEar = !hin && ear(f, ly, lat);
        if (!hin && !hairVol && !isNose && !isEar) continue;
        let col: number, tone: number;
        const nd = Math.min(1, dd / 5);
        if (hairVol || (hin && (hairAtFor(st, f, ly, true) || (backHair && f < -1.0 && ly < 2.1)))) {
          col = R_HAIR;
          tone = toneFor(dd > 0 ? dx / dd : 0, dd > 0 ? ly / dd : 0, nd);
          if (tone === 2 && ly < -0.8 && ((x - (y >> 1)) & 3) === 0) tone = 3;
        } else {
          col = R_SKIN;
          tone = toneFor(dd > 0 ? dx / dd : 0, dd > 0 ? ly / dd : 0, dd / R);
          if (isEar) tone = 1;
          else if (isNose) tone = ly > 0.6 ? 1 : 3;
          else if (look.beard && ly > 1.3 && f > -1.6) {
            col = R_HAIR;
            tone = 1;
          } else if (st === 6 && ly > -1.9 && ly < -0.8) {
            col = R_JER2;
            tone = 2;
          }
        }
        b.set(x, y, col, tone, layer);
        break;
      }
    }
  }
  // ---- face: only when it is turned toward us
  if (s < -0.05) return;
  /** a point on the face surface (lat sideways, ly down) -> HD pixel, and how much it faces us */
  const at = (lat: number, ly: number): [number, number, number] => {
    let f = -0.4 + 4.2 * Math.sqrt(Math.max(0, 1 - ((ly + 0.75) / 3.8) ** 2 - (lat / CR) ** 2));
    if (ly > 0) f = Math.max(f, jx + jrx * Math.sqrt(Math.max(0, 1 - ((ly - jy) / jry) ** 2 - (lat / (jawW * (1 - 0.38 * Math.max(0, (ly - jy) / jry)))) ** 2)));
    const nf = (f + 0.4) / 17.6, nl = lat / (CR * CR);
    const nn = Math.hypot(nf, nl) || 1;
    const vis = (nf * s + nl * c) / nn;
    const sx = f * c - lat * s;
    return [Math.floor((hx + sx * HEAD_K) * SS), Math.floor((hy + ly * HEAD_K) * SS), vis];
  };
  const px = (lat: number, ly: number, r: number, tone: number, size = 1) => {
    const [x, y, vis] = at(lat, ly);
    if (vis < 0.15) return;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) b.set(x + i, y + j, r, tone, layer);
  };
  const EYE = FRONT_EYES[look.eyes ?? 0] ?? FRONT_EYES[0];
  const eyes = (oy = 0, closed = false) => {
    for (const side of [1, -1]) {
      const lat0 = side * 1.35;
      if (closed) {
        px(lat0 - 0.25, -0.35 + oy, R_EYE, 2);
        px(lat0 + 0.25, -0.35 + oy, R_EYE, 2);
        continue;
      }
      const [ex, ey, vis] = at(lat0, -0.95 + oy);
      if (vis < 0.15) continue;
      EYE.forEach((row, j) => {
        const r2 = side > 0 ? row : [...row].reverse().join('');
        for (let i = 0; i < r2.length; i++) {
          const ch = r2[i];
          if (ch === '.') continue;
          const [r, t] = ch === 'l' || ch === 'p' ? [R_EYE, ch === 'p' ? 1 : 2] : ch === 'i' ? [R_IRIS, 1] : [R_WHITE, 3];
          // the eye bitmap sits centred on the eye point, squeezed when seen from an angle
          b.set(ex + Math.round((i - (r2.length - 1) / 2) * Math.max(0.55, vis)) , ey + j, r, t, layer);
        }
      });
    }
  };
  const brows = (tilt: number) => {
    for (const side of [1, -1]) {
      px(side * 0.85, -1.85 + tilt * 0.35, R_HAIR, 0);
      px(side * 1.35, -2.0, R_HAIR, 0);
      px(side * 1.85, -1.9 - tilt * 0.2, R_HAIR, 0);
    }
  };
  switch (J.face) {
    case 'ko':
      for (const side of [1, -1]) {
        const l = side * 1.35;
        px(l - 0.35, -1.0, R_EYE, 2); px(l + 0.35, -1.0, R_EYE, 2); px(l, -0.6, R_EYE, 2); px(l - 0.35, -0.2, R_EYE, 2); px(l + 0.35, -0.2, R_EYE, 2);
      }
      px(-0.2, 2.3, R_MOUTH, 1, 2);
      break;
    case 'happy':
      eyes(0.1, true); brows(-0.3);
      px(-0.65, 2.1, R_MOUTH, 1); px(-0.3, 2.45, R_MOUTH, 0); px(0, 2.5, R_MOUTH, 0); px(0.3, 2.45, R_MOUTH, 0); px(0.65, 2.1, R_MOUTH, 1);
      px(0, 2.15, R_WHITE, 3); px(-0.3, 2.15, R_WHITE, 3);
      break;
    case 'shout':
      eyes(); brows(1);
      px(-0.3, 2.1, R_MOUTH, 0, 2); px(-0.3, 2.55, R_MOUTH, 0, 2); px(0, 2.1, R_WHITE, 3);
      break;
    case 'angry':
      eyes(); brows(1.3);
      px(-0.3, 2.4, R_MOUTH, 1); px(0.3, 2.4, R_MOUTH, 1);
      break;
    case 'sad':
      eyes(0.3); brows(-1);
      px(-0.5, 2.6, R_MOUTH, 1); px(0, 2.45, R_MOUTH, 1); px(0.5, 2.6, R_MOUTH, 1);
      break;
    default:
      eyes(); brows(0);
      px(-0.4, 2.35, R_MOUTH, 1); px(0, 2.4, R_MOUTH, 1); px(0.4, 2.35, R_MOUTH, 1);
  }
  if (J.face !== 'ko') {
    px(1.9, 0.9, R_SKIN, 3);
    px(-1.9, 0.9, R_SKIN, 3);
  }
  void R;
}

function drawHead(b: Buf, J: Joints, look: PlayerLook, layer = 6) {
  const [hx, hy] = J.head;
  const ca = Math.cos(-J.headAng), sa = Math.sin(-J.headAng);
  const R = 4.45;
  const st = look.hairStyle;
  const hairAt = (lx: number, ly: number, inHead: boolean) => hairAtFor(st, lx, ly, inHead);
  const fs = look.face ?? 0;
  // a human head: a rounded cranium plus a jaw that comes forward and down to the chin
  const JAW: [number, number, number, number][] = [
    [1.35, 1.8, 3.0, 2.75], // classic
    [1.0, 1.6, 3.4, 2.8], // round
    [1.3, 1.9, 3.1, 2.85], // square (drawn boxier below)
    [1.35, 2.2, 2.85, 3.1], // long
    [1.6, 2.0, 2.8, 2.7], // sharp chin
  ];
  const [jx, jy, jrx, jry] = JAW[fs] ?? JAW[0];
  const headIn = (lx: number, ly: number, d: number) => {
    void d;
    const cranium = ((lx + 0.4) / 4.2) ** 2 + ((ly + 0.75) / (fs === 3 ? 3.95 : 3.8)) ** 2 < 1;
    if (cranium) return true;
    if (ly < 0) return false;
    if (fs === 2) return Math.abs(lx - jx) < jrx * 0.92 && ly - jy < jry * 0.78 && Math.abs(lx - jx) + Math.max(0, ly - jy) * 0.6 < jrx * 1.05;
    if (fs === 4) return ((lx - jx) / jrx) ** 2 + ((ly - jy) / jry) ** 2 < 1 && lx > -0.5 + (ly - 1.2) * 0.9;
    return ((lx - jx) / jrx) ** 2 + ((ly - jy) / jry) ** 2 < 1;
  };
  // the head is designed at radius 4.45 and drawn scaled up to HEAD_R
  const E = 8 * HEAD_K;
  const minX = Math.floor((hx - E) * SS), maxX = Math.ceil((hx + E) * SS), minY = Math.floor((hy - E) * SS), maxY = Math.ceil((hy + E) * SS);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = ((x + 0.5) / SS - hx) / HEAD_K, dy = ((y + 0.5) / SS - hy) / HEAD_K;
      const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
      const d = Math.hypot(dx, dy);
      const inHead = headIn(lx, ly, d);
      // a small button nose (chibi), not a long profile nose
      // nose: bridge from the brow down to a small tip just in front of the face
      const nose = lx > 3.4 && lx < 4.55 - Math.max(0, 0.2 - ly) * 0.5 && ly > -0.6 && ly < 1.1 - Math.max(0, lx - 4.1) * 1.2;
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
        if (Math.abs(lx + 1.3) < 0.7 && Math.abs(ly - 0.5) < 0.9 && col === R_SKIN) tone = 1;
      }
      if (col < 0) continue;
      b.set(x, y, col, tone, layer);
    }
  }
  // face features (in local coords -> pixel)
  const P = (lx: number, ly: number): [number, number] => {
    const c2 = Math.cos(J.headAng), s2 = Math.sin(J.headAng);
    lx *= HEAD_K;
    ly *= HEAD_K;
    return [Math.floor((hx + lx * c2 - ly * s2) * SS), Math.floor((hy + lx * s2 + ly * c2) * SS)];
  };
  /** a face feature: one game pixel (SS x SS HD pixels), or a finer `size` */
  const dot = (lx: number, ly: number, r: number, tone = 2, size = SS) => {
    const [x, y] = P(lx, ly);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) b.set(x + i, y + j, r, tone, layer);
  };
  // face, drawn with HD detail: eye white + pupil, brows, mouth
  // side-profile face: one eye. Eye styles are tiny
  // bitmaps on the HD grid: l lid, w white, i iris, p pupil, s sparkle
  const U = 1 / (SS * HEAD_K); // one HD pixel in head-local units
  const STYLE = EYE_BITMAPS[look.eyes ?? 0] ?? EYE_BITMAPS[0];
  const paint = (rows: string[], ox: number, oy: number) => {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        const [r, t] = ch === 'l' || ch === 'p' ? [R_EYE, ch === 'p' ? 1 : 2] : ch === 'i' ? [R_IRIS, j >= 2 ? 1 : 2] : [R_WHITE, 3];
        dot(ox + i * U, oy + j * U, r, t, 1);
      }
    });
  };
  const eye = (oy = 0, closed = false) => {
    if (closed) {
      for (const [ex, w] of [[2.6, 3]] as const) for (let i = 0; i < w; i++) dot(ex - 0.35 + i * 0.4, -0.1 + oy, R_EYE, 2, 1);
      return;
    }
    // side profile: only the near eye shows, a little behind the nose
    paint(STYLE, 2.15, -0.95 + oy);
  };
  const brow = (tilt: number) => {
    dot(2.05, -1.85 - tilt * 0.3, R_HAIR, 0, 1);
    dot(2.6, -2.0, R_HAIR, 0, 1);
    dot(3.15, -1.9 + tilt * 0.35, R_HAIR, 0, 1);
  };
  switch (J.face) {
    case 'ko':
      dot(1.5, -0.9, R_EYE, 2, 1); dot(2.5, 0.1, R_EYE, 2, 1); dot(2.5, -0.9, R_EYE, 2, 1); dot(1.5, 0.1, R_EYE, 2, 1); dot(2.0, -0.4, R_EYE, 2, 1);
      dot(2.95, 2.35, R_MOUTH, 1, 2);
      break;
    case 'happy':
      eye(0.1, true); brow(-0.3);
      dot(2.5, 2.15, R_MOUTH, 1, 1); dot(2.9, 2.5, R_MOUTH, 0, 1); dot(3.3, 2.55, R_MOUTH, 0, 1); dot(3.65, 2.25, R_MOUTH, 1, 1);
      dot(3.1, 2.15, R_WHITE, 3, 1);
      break;
    case 'shout':
      eye(); brow(1);
      dot(2.85, 2.1, R_MOUTH, 0, 2); dot(3.2, 2.5, R_MOUTH, 0, 2); dot(3.05, 2.1, R_WHITE, 3, 1);
      break;
    case 'angry':
      eye(); brow(1.3);
      dot(2.9, 2.4, R_MOUTH, 1, 1); dot(3.3, 2.4, R_MOUTH, 1, 1);
      break;
    case 'sad':
      eye(0.3); brow(-1);
      dot(2.85, 2.6, R_MOUTH, 1, 1); dot(3.25, 2.45, R_MOUTH, 1, 1);
      break;
    default:
      eye(); brow(0);
      dot(2.75, 2.35, R_MOUTH, 1, 1); dot(3.15, 2.4, R_MOUTH, 1, 1); dot(3.5, 2.3, R_MOUTH, 1, 1);
  }
  // cheek catching the light, and the ear's inner shadow
  // cheekbone light and the shadow under the jaw line
  if (J.face !== 'ko') dot(2.1, 0.9, R_SKIN, 3, 1);
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
        if (L2 < L && !(L === b.shortsL && L2 === b.torsoL)) {
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
