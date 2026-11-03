/**
 * HD pixel-art rendering helpers.
 *
 * The game still lays everything out in "virtual pixels" (the old ~232 px tall
 * framebuffer units), but the main canvas now renders at the device resolution
 * with a scale transform, and every generated sprite is supersampled.
 *
 * A supersampled canvas carries its scale in `__s`. drawImage() is patched so
 * such canvases are drawn at their *virtual* size and source rectangles are
 * given in virtual pixels, which keeps all existing layout code unchanged.
 * Contexts that must copy pixels 1:1 (DOM previews) set `__raw = true`.
 */

export type HiCanvas = HTMLCanvasElement & { __s?: number };

/**
 * Pixel density: framebuffer pixels per virtual pixel. The old game drew one
 * pixel per virtual pixel (~232 px tall); "HD pixel art" draws twice as many,
 * still crisp and nearest-neighbour scaled.
 */
export const PXD = 2;
/** Snap a virtual coordinate to the framebuffer pixel grid. */
export const snap = (v: number) => Math.round(v * PXD) / PXD;
/** one framebuffer pixel in virtual units */
export const U = 1 / PXD;

export function spriteRes() {
  return PXD;
}
export function bgRes() {
  return PXD;
}
export function pitchRes() {
  return PXD;
}

/** Virtual width/height of a (possibly supersampled) canvas. */
export const vw = (c: HiCanvas) => c.width / (c.__s ?? 1);
export const vh = (c: HiCanvas) => c.height / (c.__s ?? 1);

/** Create a supersampled canvas of virtual size w×h; its context is pre-scaled. */
export function hiCanvas(w: number, h: number, res = spriteRes()): [HiCanvas, CanvasRenderingContext2D] {
  const c = document.createElement('canvas') as HiCanvas;
  c.width = Math.max(1, Math.ceil(w * res));
  c.height = Math.max(1, Math.ceil(h * res));
  c.__s = res;
  const g = c.getContext('2d')!;
  g.scale(res, res);
  g.imageSmoothingEnabled = false;
  return [c, g];
}

type Ctx = CanvasRenderingContext2D & { __raw?: boolean };

if (typeof CanvasRenderingContext2D !== 'undefined') {
  const proto = CanvasRenderingContext2D.prototype as Ctx;
  const orig = proto.drawImage as (...a: unknown[]) => void;
  (proto as unknown as { drawImage: (...a: unknown[]) => void }).drawImage = function (this: Ctx, ...args: unknown[]) {
    const img = args[0] as HiCanvas;
    const a = args.slice(1) as number[];
    const s = img && img.__s;
    if (s && s !== 1 && !this.__raw) {
      if (a.length === 2) return orig.call(this, img, a[0], a[1], img.width / s, img.height / s);
      if (a.length === 8) return orig.call(this, img, a[0] * s, a[1] * s, a[2] * s, a[3] * s, a[4], a[5], a[6], a[7]);
    }
    return orig.call(this, img, ...a);
  };
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Deterministic hash noise 0..1 */
export function hash2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4×4 ordered-dither threshold (0..1) for framebuffer pixel (x, y). */
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/**
 * Make a canvas pixel-crisp: alpha below `cut` becomes 0, above becomes 255
 * (or `keep` alpha for translucent sprites like shadows).
 */
export function crisp(c: HTMLCanvasElement, cut = 0.45, keep = 255) {
  const g = c.getContext('2d')!;
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const k = cut * 255;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] === 0) continue;
    if (d[i] < k) d[i] = 0;
    else {
      // un-premultiply the anti-aliased edge colour
      d[i] = keep;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------- pixel primitives
// All add axis-aligned rects (one framebuffer pixel each) to the current path,
// in virtual coordinates; the caller does beginPath() / fill().

/** Bresenham line on the framebuffer grid, `w` framebuffer pixels thick. */
export function pxLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w = 1) {
  let X0 = Math.round(x0 * PXD), Y0 = Math.round(y0 * PXD);
  const X1 = Math.round(x1 * PXD), Y1 = Math.round(y1 * PXD);
  const dx = Math.abs(X1 - X0), dy = -Math.abs(Y1 - Y0);
  const sx = X0 < X1 ? 1 : -1, sy = Y0 < Y1 ? 1 : -1;
  let err = dx + dy;
  const off = Math.floor(w / 2);
  for (let i = 0; i < 4000; i++) {
    g.rect((X0 - off) / PXD, (Y0 - off) / PXD, w / PXD, w / PXD);
    if (X0 === X1 && Y0 === Y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      X0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      Y0 += sy;
    }
  }
}

/** Filled ellipse made of framebuffer-pixel rows. */
export function pxDisc(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry = rx) {
  const CX = cx * PXD, CY = cy * PXD, RX = rx * PXD, RY = ry * PXD;
  if (RX < 0.5 || RY < 0.5) {
    g.rect(Math.round(CX - 0.5) / PXD, Math.round(CY - 0.5) / PXD, U, U);
    return;
  }
  for (let y = Math.ceil(CY - RY - 0.5); y <= Math.floor(CY + RY - 0.5); y++) {
    const dy = (y + 0.5 - CY) / RY;
    if (Math.abs(dy) > 1) continue;
    const hw = RX * Math.sqrt(1 - dy * dy);
    const a = Math.round(CX - hw), b = Math.round(CX + hw);
    if (b > a) g.rect(a / PXD, y / PXD, (b - a) / PXD, U);
  }
}

/** Ellipse outline, `w` framebuffer pixels thick. */
export function pxRing(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, w = 1) {
  const CX = cx * PXD, CY = cy * PXD, RX = rx * PXD, RY = ry * PXD;
  for (let y = Math.ceil(CY - RY - 0.5); y <= Math.floor(CY + RY - 0.5); y++) {
    const dy = (y + 0.5 - CY) / RY;
    if (Math.abs(dy) > 1) continue;
    const ho = RX * Math.sqrt(1 - dy * dy);
    const iy = (y + 0.5 - CY) / Math.max(0.5, RY - w);
    const hi = Math.abs(iy) < 1 ? Math.max(0, RX - w) * Math.sqrt(1 - iy * iy) : 0;
    const a = Math.round(CX - ho), b = Math.round(CX - hi), c = Math.round(CX + hi), d = Math.round(CX + ho);
    if (b <= a && d <= c) continue;
    if (c <= b) {
      g.rect(a / PXD, y / PXD, (d - a) / PXD, U);
      continue;
    }
    g.rect(a / PXD, y / PXD, Math.max(1, b - a) / PXD, U);
    g.rect((d - Math.max(1, d - c)) / PXD, y / PXD, Math.max(1, d - c) / PXD, U);
  }
}

/** Pixel rect snapped to the framebuffer grid (fills immediately). */
export function pxFill(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const X = snap(x), Y = snap(y);
  g.fillRect(X, Y, Math.max(U, snap(x + w) - X), Math.max(U, snap(y + h) - Y));
}

/** Pixel panel with cut corners (filled immediately). */
export function pxRoundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 1) {
  x = snap(x);
  y = snap(y);
  w = snap(w);
  h = snap(h);
  const steps = Math.round(r * PXD);
  g.beginPath();
  for (let i = 0; i < steps; i++) {
    const inset = Math.round(steps - Math.sqrt(steps * steps - (steps - i - 0.5) ** 2));
    g.rect(x + inset * U, y + i * U, w - inset * 2 * U, U);
    g.rect(x + inset * U, y + h - (i + 1) * U, w - inset * 2 * U, U);
  }
  g.rect(x, y + steps * U, w, h - steps * 2 * U);
  g.fill();
}
