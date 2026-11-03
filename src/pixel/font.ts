/**
 * Game text rendering. Text is rendered with the "Pixelify Sans" pixel face at
 * framebuffer resolution (2 px per virtual px), then alpha-thresholded so every
 * edge stays a hard pixel edge. Outline, two-tone fill and drop shadow supported.
 *
 * The API keeps the old bitmap-font metrics: `scale` 1 ≈ 7 virtual px cap height,
 * `y` is the cap-top of the text.
 */
import { settings } from '../engine/storage';
import { hiCanvas, HiCanvas, spriteRes, crisp, snap } from '../engine/gfx';

const FAMILY = '"Pixelify Sans", monospace';
/** cap height per scale unit (virtual px) */
const CAP = 7;
const TOP = 3;

export function upper(s: string) {
  return s.toLocaleUpperCase(settings.lang === 'tr' ? 'tr-TR' : 'en-US');
}

let mctx: CanvasRenderingContext2D | null = null;
/**
 * Pixelify Sans is drawn on a pixel grid that matches the framebuffer exactly at
 * 16 framebuffer px (= 8 virtual px); we only use integer multiples of that size
 * so every glyph pixel lands on a framebuffer pixel.
 */
function mult(scale: number) {
  return scale < 1.75 ? 1 : Math.round(scale);
}
function fontFor(scale: number) {
  const k = mult(scale);
  return `${k >= 2 ? 700 : 400} ${8 * k}px ${FAMILY}`;
}
/** real cap height (virtual px) */
const capOf = (scale: number) => 5.5 * mult(scale);

export function measure(text: string, scale = 1) {
  if (typeof document === 'undefined') return text.length * 6 * scale;
  if (!mctx) mctx = document.createElement('canvas').getContext('2d')!;
  mctx.font = fontFor(scale);
  const s = upper(text);
  return mctx.measureText(s).width + s.length * 0.5 * mult(scale);
}

export interface TextOpts {
  color?: string;
  /** colour for the lower half of the glyphs (two-tone arcade style) */
  color2?: string;
  scale?: number;
  outline?: string | null;
  /** outline thickness in virtual pixels */
  thick?: number;
  shadow?: string | null;
  align?: 'left' | 'center' | 'right';
}

const textCache = new Map<string, HiCanvas>();

export function clearTextCache() {
  textCache.clear();
}

/** Returns a supersampled canvas; padding = thick + shadow on every side. */
export function textCanvas(text: string, o: TextOpts = {}): HiCanvas {
  const scale = o.scale ?? 1;
  const color = o.color ?? '#fff';
  const outline = o.outline === undefined ? '#120c1c' : o.outline;
  const thick = outline ? o.thick ?? Math.max(0.5, Math.round(scale / 2 * 2) / 2) : 0;
  const shadow = o.shadow ?? null;
  const key = `${text}|${color}|${o.color2}|${scale}|${outline}|${thick}|${shadow}|${settings.lang}|${settings.quality}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const s = upper(text);
  const w = measure(text, scale);
  const sh = shadow ? Math.max(1, scale * 0.6) : 0;
  const pad = thick + 1;
  const capH = CAP * scale;
  const H = (CAP + TOP + 1) * scale + pad * 2 + sh + 2;
  const res = spriteRes();
  const [c, g] = hiCanvas(w + pad * 2 + sh + 2, H, res);
  g.font = fontFor(scale);
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  g.miterLimit = 2;
  if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = `${0.5 * mult(scale)}px`;
  // keep the old cap-box: centre the (slightly smaller) pixel glyphs in it, on the pixel grid
  const realCap = capOf(scale);
  const bx = pad, by = Math.round((pad + TOP * scale + realCap + (capH - realCap) / 2) * res) / res;
  // outline / shadow: stamp the glyphs at pixel offsets (square, pixel-art style)
  const stampAt = (col: string, ox: number, oy: number, r: number) => {
    g.fillStyle = col;
    const st = 1 / res;
    for (let dy = -r; dy <= r + 1e-6; dy += st) for (let dx = -r; dx <= r + 1e-6; dx += st) g.fillText(s, bx + ox + dx, by + oy + dy);
  };
  if (shadow) stampAt(shadow, sh, sh, thick);
  if (outline) stampAt(outline, 0, 0, thick);
  if (o.color2) {
    const gr = g.createLinearGradient(0, by - realCap, 0, by);
    gr.addColorStop(0, color);
    gr.addColorStop(0.55, color);
    gr.addColorStop(0.55, o.color2);
    gr.addColorStop(1, o.color2);
    g.fillStyle = gr;
  } else g.fillStyle = color;
  g.fillText(s, bx, by);
  crisp(c, 0.5);
  if (scale >= 2) {
    // hard pixel highlight band on big text
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(0, by - realCap - 1, w + pad * 2, Math.round(realCap * 0.22 * res) / res + 1);
    g.restore();
  }
  if (textCache.size > 500) textCache.clear();
  textCache.set(key, c);
  return c;
}

/** Draw text with its cap-top at y. Returns drawn width. */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOpts = {}) {
  const c = textCanvas(text, o);
  const scale = o.scale ?? 1;
  const outline = o.outline === undefined ? '#120c1c' : o.outline;
  const thick = outline ? o.thick ?? Math.max(0.5, Math.round(scale / 2 * 2) / 2) : 0;
  const pad = thick + 1;
  const w = measure(text, scale);
  let dx = x - pad;
  if (o.align === 'center') dx = x - w / 2 - pad;
  else if (o.align === 'right') dx = x - w - pad;
  ctx.drawImage(c, snap(dx), snap(y - TOP * scale - pad));
  return w;
}
