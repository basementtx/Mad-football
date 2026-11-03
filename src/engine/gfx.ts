/**
 * High-resolution rendering helpers.
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
import { settings } from './storage';

export type HiCanvas = HTMLCanvasElement & { __s?: number };

/** Supersampling factor for sprites (players, ball, props, text). */
export function spriteRes() {
  return settings.quality === 'high' ? 4 : 3;
}
/** Supersampling factor for big static layers (stands, pitch). */
export function bgRes() {
  return settings.quality === 'high' ? 2 : 1.25;
}
export function pitchRes() {
  return settings.quality === 'high' ? 3 : 2;
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
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
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
