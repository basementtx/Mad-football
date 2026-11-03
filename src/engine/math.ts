export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;
export const sign = (v: number) => (v < 0 ? -1 : 1);

/** Frame-rate independent exponential smoothing. */
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
};

export function norm(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y);
  return l > 1e-6 ? [x / l, y / l] : [0, 0];
}

export function wrapAngle(a: number) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

export const angleDiff = (a: number, b: number) => wrapAngle(b - a);

export function rotateToward(cur: number, target: number, maxStep: number) {
  const d = angleDiff(cur, target);
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}

/** Distance from point to segment. */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Approximate gaussian in [-1,1]-ish. */
export const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => clamp(Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
