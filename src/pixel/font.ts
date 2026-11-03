/**
 * Game text rendering (vector). Text is rendered with the "Lilita One" display
 * face into supersampled cached canvases with an outline, optional two-tone
 * gradient fill and a drop shadow.
 *
 * The API keeps the old bitmap-font metrics: `scale` 1 ≈ 7 virtual px cap height,
 * `y` is the cap-top of the text.
 */
import { settings } from '../engine/storage';
import { hiCanvas, HiCanvas, spriteRes } from '../engine/gfx';

const FAMILY = '"Lilita One", "Rubik", system-ui, sans-serif';
/** cap height per scale unit (virtual px) */
const CAP = 7;
/** font px per cap px */
const EM = 1 / 0.7;
const TOP = 3;

export function upper(s: string) {
  return s.toLocaleUpperCase(settings.lang === 'tr' ? 'tr-TR' : 'en-US');
}

let mctx: CanvasRenderingContext2D | null = null;
function fontFor(scale: number) {
  return `${(CAP * scale * EM).toFixed(2)}px ${FAMILY}`;
}

export function measure(text: string, scale = 1) {
  if (typeof document === 'undefined') return text.length * 6 * scale;
  if (!mctx) mctx = document.createElement('canvas').getContext('2d')!;
  mctx.font = fontFor(scale);
  const s = upper(text);
  return mctx.measureText(s).width + s.length * 0.35 * scale;
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
  const thick = outline ? o.thick ?? Math.max(1, scale / 2) : 0;
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
  const res = Math.max(spriteRes(), scale <= 1 ? 4 : 3);
  const [c, g] = hiCanvas(w + pad * 2 + sh + 2, H, res);
  g.font = fontFor(scale);
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  g.miterLimit = 2;
  if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = `${(0.35 * scale).toFixed(2)}px`;
  const bx = pad, by = pad + TOP * scale + capH;
  if (shadow) {
    g.fillStyle = shadow;
    g.strokeStyle = shadow;
    g.lineWidth = thick * 2;
    if (thick) g.strokeText(s, bx + sh, by + sh);
    g.fillText(s, bx + sh, by + sh);
  }
  if (outline) {
    g.strokeStyle = outline;
    g.lineWidth = thick * 2;
    g.strokeText(s, bx, by);
  }
  if (o.color2) {
    const gr = g.createLinearGradient(0, by - capH, 0, by);
    gr.addColorStop(0, color);
    gr.addColorStop(0.5, color);
    gr.addColorStop(0.62, o.color2);
    gr.addColorStop(1, o.color2);
    g.fillStyle = gr;
  } else g.fillStyle = color;
  g.fillText(s, bx, by);
  if (scale >= 2) {
    // glossy highlight on big text
    g.save();
    g.globalCompositeOperation = 'source-atop';
    const hl = g.createLinearGradient(0, by - capH, 0, by - capH * 0.45);
    hl.addColorStop(0, 'rgba(255,255,255,0.35)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl;
    g.fillRect(0, by - capH - 2, w + pad * 2, capH * 0.55 + 2);
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
  const thick = outline ? o.thick ?? Math.max(1, scale / 2) : 0;
  const pad = thick + 1;
  const w = measure(text, scale);
  let dx = x - pad;
  if (o.align === 'center') dx = x - w / 2 - pad;
  else if (o.align === 'right') dx = x - w - pad;
  ctx.drawImage(c, dx, y - TOP * scale - pad);
  return w;
}
