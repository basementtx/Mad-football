import type { Match } from './match';
import type { Input, BtnId } from '../engine/input';
import { clamp } from '../engine/math';
import { settings } from '../engine/storage';
import { t } from '../engine/i18n';
import { drawText, measure } from '../pixel/font';
import { disc, ringDisc } from '../pixel/props';
import { ramp, css } from '../pixel/palette';
import { vw, vh, roundRect } from '../engine/gfx';

export interface BtnLabel {
  text: string;
  color: string;
  glow?: boolean;
}

const INK = '#120c1c';

/** Rounded glossy panel. */
export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = '#1b2236', light = '#2e3a58', dark = '#0b0f1a') {
  const r = Math.min(4, h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, x - 0.5, y + 0.8, w + 1, h + 1, r + 0.5);
  ctx.fill();
  const gr = ctx.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, light);
  gr.addColorStop(0.45, fill);
  gr.addColorStop(1, dark);
  ctx.fillStyle = gr;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 0.6;
  roundRect(ctx, x + 0.3, y + 0.3, w - 0.6, h - 0.6, r);
  ctx.stroke();
}

export function drawHUD(ctx: CanvasRenderingContext2D, m: Match, input: Input, W: number, H: number, time: number, labels: Record<BtnId, BtnLabel> | null) {
  const ins = input.insets;
  if (m.replaying) {
    drawReplay(ctx, m, W, H, time);
    return;
  }
  if (!m.cfg.demo) {
    drawScoreboard(ctx, m, W, ins.top);
    if (settings.minimap) drawMinimap(ctx, m, W, ins);
    drawRage(ctx, m, W, H, ins, time);
    drawPauseBtn(ctx, input);
    if (input.touchMode && labels) drawTouch(ctx, input, labels, time);
    else if (labels && W >= 300) drawKeyHints(ctx, H, ins);
  }
  drawBanners(ctx, m, W, H, time);
}

function drawScoreboard(ctx: CanvasRenderingContext2D, m: Match, W: number, top: number) {
  const [h, a] = m.teams;
  const y = Math.max(top, 3) + 5;
  const w = 118, hh = 15;
  const x = Math.round(W / 2 - w / 2);
  panel(ctx, x, y, w, hh);
  for (const [tx, team, inner] of [[x, h, x + 4], [x + w - 4, a, x + w - 5]] as const) {
    const rp = ramp(team.def.primary);
    ctx.save();
    roundRect(ctx, x, y, w, hh, 4);
    ctx.clip();
    const tg = ctx.createLinearGradient(0, y, 0, y + hh);
    tg.addColorStop(0, css(rp[3]));
    tg.addColorStop(1, css(rp[1]));
    ctx.fillStyle = tg;
    ctx.fillRect(tx, y, 4, hh);
    ctx.fillStyle = team.def.secondary;
    ctx.fillRect(inner, y, 1, hh);
    ctx.restore();
  }
  drawText(ctx, h.def.short, x + 9, y + 4, { color: '#fff', outline: null });
  drawText(ctx, a.def.short, x + w - 8, y + 4, { color: '#fff', outline: null, align: 'right' });
  const sw = 38;
  const sx = Math.round(W / 2 - sw / 2);
  panel(ctx, sx, y + 2, sw, hh - 4, '#ffcc2a', '#fff0a0', '#c88a00');
  const pop = m.goalFlash > 0.6 && Math.floor(m.time * 10) % 2 === 0;
  drawText(ctx, `${h.score}-${a.score}`, W / 2, y + 4, { color: pop ? '#ffffff' : INK, outline: null, align: 'center' });
  const c = Math.ceil(m.clock);
  const mm = Math.floor(c / 60), ss = c % 60;
  const cw = 30;
  panel(ctx, Math.round(W / 2 - cw / 2), y + hh + 2, cw, 11, '#0d121f', '#1f2840', '#06080f');
  const urgent = c <= 10 && m.phase === 'play' && Math.floor(m.time * 4) % 2 === 0;
  drawText(ctx, `${mm}:${ss.toString().padStart(2, '0')}`, W / 2, y + hh + 4, { color: urgent ? '#ff5a4a' : '#ffffff', outline: null, align: 'center' });
}

function drawMinimap(ctx: CanvasRenderingContext2D, m: Match, W: number, ins: Input['insets']) {
  const P = m.pitch;
  const mw = 58, mh = Math.round(mw * (P.hh / P.hw));
  const x = settings.leftHanded ? ins.left + 6 : W - ins.right - mw - 6;
  const y = Math.max(ins.top, 3) + 5;
  panel(ctx, x - 2, y - 2, mw + 4, mh + 4, '#163a22', '#215032', '#0b2214');
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
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
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(px - 1, py - 1, 4, 4);
    }
    ctx.fillStyle = p.isGK ? p.team.def.gk : p.team.def.primary;
    ctx.fillRect(px, py, 2, 2);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(X(m.ball.x) - 1, Y(m.ball.y) - 1, 2, 2);
}

function drawRage(ctx: CanvasRenderingContext2D, m: Match, W: number, H: number, ins: Input['insets'], time: number) {
  const team = m.teams[0];
  if (!team.human) return;
  const segs = 10, sw = 6, gap = 1;
  const w = segs * (sw + gap) - gap;
  const x = Math.round(W / 2 - w / 2);
  const y = H - Math.max(ins.bottom, 3) - 9;
  const full = team.rage >= 1;
  panel(ctx, x - 2, y - 2, w + 4, 8, '#0b0f1a', '#1b2236', '#05070d');
  const n = team.rage * segs;
  for (let i = 0; i < segs; i++) {
    const k = clamp(n - i, 0, 1);
    const col = full ? (Math.floor(time * 8 + i) % 2 ? '#ffe14d' : '#ff8a1f') : i < 4 ? '#ff3b1f' : i < 7 ? '#ff6a1f' : '#ffa21f';
    ctx.fillStyle = '#2a1a1a';
    roundRect(ctx, x + i * (sw + gap), y, sw, 4, 1.2);
    ctx.fill();
    if (k > 0) {
      const ww = Math.max(1, sw * k);
      ctx.fillStyle = col;
      roundRect(ctx, x + i * (sw + gap), y, ww, 4, 1.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(x + i * (sw + gap) + 0.5, y + 0.4, Math.max(0, ww - 1), 1);
    }
  }
  const label = full ? t().rageReady : t().rage;
  if (!full || Math.floor(time * 3) % 3 !== 0) drawText(ctx, label, W / 2, y - 11, { color: full ? '#ffd04d' : '#c8d0e0', align: 'center' });
}

function drawPauseBtn(ctx: CanvasRenderingContext2D, input: Input) {
  const r = input.pauseRect;
  panel(ctx, r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, r.x + 5, r.y + 4, 2, r.h - 8, 0.8);
  ctx.fill();
  roundRect(ctx, r.x + r.w - 7, r.y + 4, 2, r.h - 8, 0.8);
  ctx.fill();
}

function drawTouch(ctx: CanvasRenderingContext2D, input: Input, labels: Record<BtnId, BtnLabel>, time: number) {
  const home = input.joyHome;
  const ox = Math.round(input.joyActive ? input.joyOX : home.x);
  const oy = Math.round(input.joyActive ? input.joyOY : home.y);
  const R = input.joyR;
  ctx.globalAlpha = input.joyActive ? 0.95 : 0.55;
  const base = ringDisc(R, '#9aa6bd', 110);
  ctx.drawImage(base, ox - vw(base) / 2, oy - vh(base) / 2);
  ctx.fillStyle = '#9aa6bd';
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    ctx.beginPath();
    ctx.arc(ox + dx * (R - 5), oy + dy * (R - 5), 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const knob = disc(10, '#c8d0e0', false);
  ctx.drawImage(knob, ox + input.mx * R * 0.65 - vw(knob) / 2, oy + input.my * R * 0.65 - vw(knob) / 2);
  ctx.globalAlpha = 1;

  for (const b of input.layout) {
    const st = input.btn[b.id];
    const L = labels[b.id];
    if (L.glow && Math.floor(time * 6) % 2 === 0) {
      const g = ringDisc(b.r + 3, '#ffe14d', 0);
      ctx.drawImage(g, b.x - vw(g) / 2, b.y - vh(g) / 2);
    }
    const d = disc(b.r, L.color, st.down);
    ctx.globalAlpha = 0.93;
    ctx.drawImage(d, b.x - vw(d) / 2, b.y - vw(d) / 2);
    ctx.globalAlpha = 1;
    drawText(ctx, L.text, b.x, b.y - 3.6 + (st.down ? 2 : 0), { color: '#ffffff', align: 'center', outline: css(ramp(L.color)[0]) });
  }
}

function drawKeyHints(ctx: CanvasRenderingContext2D, H: number, ins: Input['insets']) {
  const L = t();
  const lines = [`J ${L.shoot}/${L.tackleBtn}  K ${L.pass}`, `SHIFT ${L.sprint}  I ${L.spin}`];
  lines.forEach((s, i) => drawText(ctx, s, ins.left + 6, H - 24 + i * 10, { color: '#c8d0e0' }));
}

function drawBanners(ctx: CanvasRenderingContext2D, m: Match, W: number, H: number, time: number) {
  for (const b of m.fx.banners) {
    const age = b.max - b.life;
    const short = b.text.length <= 2;
    let scale = b.big ? (short ? 6 : 4) : 2;
    while (scale > 1 && measure(b.text, scale) > W * 0.9) scale--;
    if (short && age < 0.06) scale = Math.max(1, scale - 2);
    const cy = Math.round(b.big ? H * 0.34 : H * 0.24);
    const tw = measure(b.text, scale);
    const inK = clamp(age / 0.22, 0, 1);
    const outK = clamp(b.life / 0.22, 0, 1);
    const dx = short ? 0 : Math.round((1 - inK) * (1 - inK) * -W * 0.8 + (1 - outK) * (1 - outK) * W * 0.8);
    const rp = ramp(b.color);
    if (b.big && !short) {
      const bh = 7 * scale + 14 + (b.sub ? 14 : 0);
      const by = cy - 7;
      const bw = Math.min(W, tw + 60);
      const bx = Math.round(W / 2 - bw / 2) + Math.round(dx * 0.6);
      const sk = bh / 2;
      const bgr = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      bgr.addColorStop(0, 'rgba(8,6,16,0)');
      bgr.addColorStop(0.15, 'rgba(8,6,16,0.82)');
      bgr.addColorStop(0.85, 'rgba(8,6,16,0.82)');
      bgr.addColorStop(1, 'rgba(8,6,16,0)');
      ctx.fillStyle = bgr;
      ctx.beginPath();
      ctx.moveTo(bx + sk - 6, by);
      ctx.lineTo(bx + bw + sk - 6, by);
      ctx.lineTo(bx + bw - 6, by + bh);
      ctx.lineTo(bx - 6, by + bh);
      ctx.fill();
      const lg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      lg.addColorStop(0, css(rp[2], 0));
      lg.addColorStop(0.2, css(rp[2]));
      lg.addColorStop(0.8, css(rp[2]));
      lg.addColorStop(1, css(rp[2], 0));
      ctx.fillStyle = lg;
      ctx.fillRect(bx + sk - 6, by, bw - 4, 1.5);
      ctx.fillRect(bx - 6, by + bh - 1.5, bw - 4, 1.5);
    }
    const light = css(rp[3]);
    const flashy = b.big && !short && Math.floor(time * 10) % 2 === 0 && age < 0.6;
    drawText(ctx, b.text, W / 2 + dx, cy, {
      scale,
      color: flashy ? '#ffffff' : light,
      color2: flashy ? light : css(rp[2]),
      outline: INK,
      thick: Math.max(1, Math.floor(scale / 2)),
      shadow: css(rp[0]),
      align: 'center',
    });
    if (b.sub) drawText(ctx, b.sub, W / 2 + dx, cy + 7 * scale + 5, { color: '#ffffff', align: 'center' });
  }
}

function drawReplay(ctx: CanvasRenderingContext2D, m: Match, W: number, H: number, time: number) {
  const bar = Math.round(H * 0.09);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, bar);
  ctx.fillRect(0, H - bar, W, bar);
  ctx.fillStyle = 'rgba(20,30,60,0.12)';
  ctx.fillRect(0, bar, W, H - bar * 2);
  const ty = Math.round(bar / 2 - 4);
  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(12.5, ty + 3.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  drawText(ctx, t().replay, 19, ty, { color: '#ffffff', outline: null });
  const [h, a] = m.teams;
  drawText(ctx, `${h.def.short} ${h.score}-${a.score} ${a.def.short}`, W - 10, ty, { color: '#ffe14d', outline: null, align: 'right' });
  if (!m.cfg.demo) drawText(ctx, t().skip, W / 2, H - bar / 2 - 4, { color: '#8a94aa', outline: null, align: 'center' });
}
