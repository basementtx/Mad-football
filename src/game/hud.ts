import type { Match } from './match';
import type { Input } from '../engine/input';
import { clamp } from '../engine/math';
import { settings } from '../engine/storage';

export interface BtnLabel {
  text: string;
  color: string;
  glow?: boolean;
  /** pixel icon drawn instead of text (special item) */
  icon?: HTMLCanvasElement;
  tier?: number;
  dim?: boolean;
}

const INK = '#120c1c';

/** Bevelled pixel panel. */
export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = '#1b2236', light = '#2e3a58', dark = '#0b0f1a') {
  ctx.fillStyle = INK;
  ctx.fillRect(x - 1, y, w + 2, h);
  ctx.fillRect(x, y - 1, w, h + 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 1, w, 1);
}

/**
 * Canvas part of the HUD. Most of the HUD is the DOM layer in domhud.ts;
 * the canvas keeps what lives in the pixel world: the minimap and replay letterbox.
 */
export function drawHUD(ctx: CanvasRenderingContext2D, m: Match, input: Input, W: number, H: number) {
  if (m.replaying) {
    drawReplay(ctx, H, W);
    return;
  }
  if (!m.cfg.demo && settings.minimap) drawMinimap(ctx, m, W, H, input.insets);
}

function drawMinimap(ctx: CanvasRenderingContext2D, m: Match, W: number, H: number, ins: Input['insets']) {
  const P = m.pitch;
  const mw = 58, mh = Math.round(mw * (P.hh / P.hw));
  const x = Math.round(W / 2 - mw / 2);
  const y = H - Math.max(ins.bottom, 3) - mh - 5;
  // see-through ink plate with a paper hairline (Dossier)
  ctx.fillStyle = 'rgba(21,23,28,0.55)';
  ctx.fillRect(x - 2, y - 2, mw + 4, mh + 4);
  ctx.fillStyle = 'rgba(246,241,230,0.4)';
  ctx.fillRect(x, y, mw, 1);
  ctx.fillRect(x, y + mh - 1, mw, 1);
  ctx.fillRect(x, y, 1, mh);
  ctx.fillRect(x + mw - 1, y, 1, mh);
  ctx.fillRect(x + (mw >> 1), y, 1, mh);
  const bx = Math.round((P.boxDepth / (P.hw * 2)) * mw), by = Math.round(((P.boxHalf / P.hh) * mh) / 2);
  const cy = y + (mh >> 1);
  for (const [x0, edge] of [[x, x + bx], [x + mw - bx, x + mw - bx]]) {
    ctx.fillRect(x0, cy - by, bx, 1);
    ctx.fillRect(x0, cy + by, bx, 1);
    ctx.fillRect(edge, cy - by, 1, by * 2);
  }
  const X = (wx: number) => clamp(Math.round(x + ((wx + P.hw) / (P.hw * 2)) * mw), x, x + mw - 2);
  const Y = (wy: number) => clamp(Math.round(y + ((wy + P.hh) / (P.hh * 2)) * mh), y, y + mh - 2);
  for (const p of m.all) {
    const px = X(p.x) - 1, py = Y(p.y) - 1;
    if (p === m.human) {
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(px - 1, py - 1, 4, 4);
    }
    ctx.fillStyle = p.isGK ? p.team.def.gk : p.team.def.primary;
    ctx.fillRect(px, py, 2, 2);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(X(m.ball.x) - 1, Y(m.ball.y) - 1, 2, 2);
}

function drawReplay(ctx: CanvasRenderingContext2D, H: number, W: number) {
  const bar = Math.round(H * 0.09);
  ctx.fillStyle = '#15171C';
  ctx.fillRect(0, 0, W, bar);
  ctx.fillRect(0, H - bar, W, bar);
  ctx.fillStyle = 'rgba(20,30,60,0.12)';
  for (let y = bar; y < H - bar; y += 2) ctx.fillRect(0, y, W, 1);
}
