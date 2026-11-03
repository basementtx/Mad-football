import type { Match } from './match';
import type { Input, BtnId } from '../engine/input';
import { roundRect } from './sprites';
import { clamp, easeOutBack, TAU, rgba } from '../engine/math';
import { settings } from '../engine/storage';
import { t } from '../engine/i18n';

const FONT = '"Russo One", sans-serif';

export interface BtnLabel {
  text: string;
  color: string;
  glow?: boolean;
}

export function drawHUD(ctx: CanvasRenderingContext2D, m: Match, input: Input, W: number, H: number, time: number, labels: Record<BtnId, BtnLabel> | null) {
  const ins = input.insets;
  const u = clamp(Math.min(W, H) / 400, 0.8, 1.5);
  if (m.replaying) {
    drawReplay(ctx, m, W, H, u, time, input.touchMode);
    return;
  }
  if (!m.cfg.demo) {
    drawScoreboard(ctx, m, W, ins.top, u);
    if (settings.minimap) drawMinimap(ctx, m, W, ins, u);
    drawRage(ctx, m, W, H, ins, u, time);
    drawPauseBtn(ctx, input, u);
    if (input.touchMode && labels) drawTouch(ctx, input, labels, time, u);
    else if (labels) drawKeyHints(ctx, W, H, u);
  }
  drawBanners(ctx, m, W, H, u);
}

function drawScoreboard(ctx: CanvasRenderingContext2D, m: Match, W: number, top: number, u: number) {
  const [h, a] = m.teams;
  const y = Math.max(top, 6) + 8 * u;
  const bw = 250 * u, bh = 40 * u;
  const x = W / 2 - bw / 2;
  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, x + 2, y + 3, bw, bh, 10 * u);
  ctx.fill();
  // main plate
  const g = ctx.createLinearGradient(0, y, 0, y + bh);
  g.addColorStop(0, '#1b2236');
  g.addColorStop(1, '#0b0f1a');
  ctx.fillStyle = g;
  roundRect(ctx, x, y, bw, bh, 10 * u);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // team colour tabs
  const tab = 10 * u;
  ctx.save();
  roundRect(ctx, x, y, bw, bh, 10 * u);
  ctx.clip();
  ctx.fillStyle = h.def.primary;
  ctx.fillRect(x, y, tab, bh);
  ctx.fillStyle = h.def.secondary;
  ctx.fillRect(x + tab, y, 3 * u, bh);
  ctx.fillStyle = a.def.primary;
  ctx.fillRect(x + bw - tab, y, tab, bh);
  ctx.fillStyle = a.def.secondary;
  ctx.fillRect(x + bw - tab - 3 * u, y, 3 * u, bh);
  ctx.restore();

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = `${16 * u}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(h.def.short, x + tab + 10 * u, y + bh / 2 + 1);
  ctx.textAlign = 'right';
  ctx.fillText(a.def.short, x + bw - tab - 10 * u, y + bh / 2 + 1);
  // score box
  const sw = 86 * u;
  const sg = ctx.createLinearGradient(0, y, 0, y + bh);
  sg.addColorStop(0, '#ffe14d');
  sg.addColorStop(1, '#ffb800');
  ctx.fillStyle = sg;
  roundRect(ctx, W / 2 - sw / 2, y + 4 * u, sw, bh - 8 * u, 7 * u);
  ctx.fill();
  ctx.fillStyle = '#121212';
  ctx.font = `${22 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  const pop = m.goalFlash > 0 ? 1 + m.goalFlash * 0.25 : 1;
  ctx.save();
  ctx.translate(W / 2, y + bh / 2 + 1);
  ctx.scale(pop, pop);
  ctx.fillText(`${h.score}  -  ${a.score}`, 0, 0);
  ctx.restore();
  // clock
  const cw = 70 * u, chh = 22 * u;
  const cy = y + bh + 2 * u;
  ctx.fillStyle = 'rgba(8,10,18,0.85)';
  roundRect(ctx, W / 2 - cw / 2, cy, cw, chh, 6 * u);
  ctx.fill();
  const c = Math.ceil(m.clock);
  const mm = Math.floor(c / 60), ss = c % 60;
  ctx.fillStyle = c <= 10 && m.phase === 'play' ? (Math.floor(m.time * 4) % 2 ? '#ff5a4a' : '#fff') : '#fff';
  ctx.font = `${14 * u}px ${FONT}`;
  ctx.fillText(`${mm}:${ss.toString().padStart(2, '0')}`, W / 2, cy + chh / 2 + 1);
  ctx.restore();
}

function drawMinimap(ctx: CanvasRenderingContext2D, m: Match, W: number, ins: Input['insets'], u: number) {
  const P = m.pitch;
  const mw = 112 * u, mh = mw * (P.hh / P.hw);
  const x = settings.leftHanded ? ins.left + 12 * u : W - ins.right - mw - 12 * u;
  const y = Math.max(ins.top, 6) + 10 * u;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(10,40,20,0.7)';
  roundRect(ctx, x - 3, y - 3, mw + 6, mh + 6, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, mw, mh);
  ctx.beginPath();
  ctx.moveTo(x + mw / 2, y);
  ctx.lineTo(x + mw / 2, y + mh);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + mw / 2, y + mh / 2, (P.centerR / P.hw) * mw / 2, 0, TAU);
  ctx.stroke();
  const bx = (P.boxDepth / (P.hw * 2)) * mw, by = (P.boxHalf / P.hh) * mh / 2;
  ctx.strokeRect(x, y + mh / 2 - by, bx, by * 2);
  ctx.strokeRect(x + mw - bx, y + mh / 2 - by, bx, by * 2);
  const X = (wx: number) => x + ((wx + P.hw) / (P.hw * 2)) * mw;
  const Y = (wy: number) => y + ((wy + P.hh) / (P.hh * 2)) * mh;
  for (const p of m.all) {
    ctx.fillStyle = p.isGK ? p.team.def.gk : p.team.def.primary;
    ctx.beginPath();
    ctx.arc(clamp(X(p.x), x, x + mw), clamp(Y(p.y), y, y + mh), (p === m.human ? 4 : 3) * u, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = p === m.human ? '#ffe14d' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = p === m.human ? 2 : 1;
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(clamp(X(m.ball.x), x, x + mw), clamp(Y(m.ball.y), y, y + mh), 2.5 * u, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawRage(ctx: CanvasRenderingContext2D, m: Match, W: number, H: number, ins: Input['insets'], u: number, time: number) {
  const team = m.teams[0];
  if (!team.human) return;
  const bw = 150 * u, bh = 12 * u;
  const x = W / 2 - bw / 2;
  const y = H - Math.max(ins.bottom, 6) - 24 * u;
  const full = team.rage >= 1;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, x - 3, y - 3, bw + 6, bh + 6, 8 * u);
  ctx.fill();
  const g = ctx.createLinearGradient(x, 0, x + bw, 0);
  g.addColorStop(0, '#ff3b1f');
  g.addColorStop(0.6, '#ff8a1f');
  g.addColorStop(1, '#ffe14d');
  ctx.fillStyle = g;
  ctx.save();
  roundRect(ctx, x, y, bw, bh, 6 * u);
  ctx.clip();
  ctx.fillRect(x, y, bw * team.rage, bh);
  // moving shine
  if (full) {
    const sx = x + ((time * 1.5) % 1) * bw * 1.4 - bw * 0.2;
    const sg = ctx.createLinearGradient(sx - 20, 0, sx + 20, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(x, y, bw, bh);
  }
  ctx.restore();
  if (full) {
    ctx.shadowColor = '#ff8a1f';
    ctx.shadowBlur = 14 + Math.sin(time * 8) * 6;
    ctx.strokeStyle = '#ffd04d';
    ctx.lineWidth = 2;
    roundRect(ctx, x - 1, y - 1, bw + 2, bh + 2, 7 * u);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.font = `${11 * u}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = full ? '#ffd04d' : 'rgba(255,255,255,0.8)';
  ctx.fillText(full ? '🔥 ' + t().rageReady : t().rage, W / 2, y - 5);
  ctx.restore();
}

function drawPauseBtn(ctx: CanvasRenderingContext2D, input: Input, u: number) {
  const r = input.pauseRect;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.6)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 10 * u);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  const bw = r.w * 0.14, bh = r.h * 0.42;
  ctx.fillRect(r.x + r.w * 0.33, r.y + (r.h - bh) / 2, bw, bh);
  ctx.fillRect(r.x + r.w * 0.53, r.y + (r.h - bh) / 2, bw, bh);
  ctx.restore();
}

function drawTouch(ctx: CanvasRenderingContext2D, input: Input, labels: Record<BtnId, BtnLabel>, time: number, u: number) {
  ctx.save();
  // joystick
  const home = input.joyHome;
  const ox = input.joyActive ? input.joyOX : home.x;
  const oy = input.joyActive ? input.joyOY : home.y;
  const R = input.joyR;
  ctx.globalAlpha = input.joyActive ? 0.9 : 0.45;
  ctx.fillStyle = 'rgba(10,14,24,0.45)';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ox, oy, R, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // direction ticks
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.arc(ox + Math.cos(a) * R * 0.78, oy + Math.sin(a) * R * 0.78, 3, 0, TAU);
    ctx.fill();
  }
  const kx = ox + input.mx * R * 0.7, ky = oy + input.my * R * 0.7;
  const kg = ctx.createRadialGradient(kx - 6, ky - 8, 2, kx, ky, R * 0.45);
  kg.addColorStop(0, '#ffffff');
  kg.addColorStop(1, '#b9c3d6');
  ctx.fillStyle = kg;
  ctx.beginPath();
  ctx.arc(kx, ky, R * 0.42, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  // buttons
  for (const b of input.layout) {
    const st = input.btn[b.id];
    const L = labels[b.id];
    const sc = st.down ? 0.9 : 1;
    const r = b.r * sc;
    ctx.save();
    ctx.translate(b.x, b.y);
    if (L.glow) {
      ctx.shadowColor = L.color;
      ctx.shadowBlur = 18 + Math.sin(time * 8) * 8;
    }
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, rgba(L.color, st.down ? 1 : 0.95));
    g.addColorStop(1, rgba(L.color, st.down ? 0.85 : 0.6));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 2.5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(10, r * 0.34)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeText(L.text, 0, 1);
    ctx.fillText(L.text, 0, 1);
    ctx.restore();
  }
  ctx.restore();
  void u;
}

function drawKeyHints(ctx: CanvasRenderingContext2D, W: number, H: number, u: number) {
  const L = t();
  const text = `WASD  •  J/Space ${L.shoot}/${L.tackleBtn}  •  K ${L.pass}  •  Shift ${L.sprint}  •  I ${L.spin}  •  Esc`;
  ctx.save();
  ctx.font = `${11 * u}px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(text, W - 14, H - 10);
  ctx.restore();
}

function drawBanners(ctx: CanvasRenderingContext2D, m: Match, W: number, H: number, u: number) {
  for (const b of m.fx.banners) {
    const age = b.max - b.life;
    const inT = clamp(age / 0.35, 0, 1);
    const out = clamp(b.life / 0.3, 0, 1);
    const sc = easeOutBack(inT);
    ctx.save();
    ctx.globalAlpha = out;
    const cy = b.big ? H * 0.42 : H * 0.28;
    ctx.translate(W / 2, cy);
    ctx.scale(sc, sc);
    ctx.rotate(-0.04);
    const big = b.big ? (b.text.length <= 2 ? 96 : 64) * u : 34 * u;
    ctx.font = `${big}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // backing slash
    if (b.big && b.text.length > 2) {
      const tw = Math.min(W * 0.95, ctx.measureText(b.text).width + 120 * u);
      ctx.save();
      ctx.transform(1, 0, -0.25, 1, 0, 0);
      const gg = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
      gg.addColorStop(0, 'rgba(0,0,0,0)');
      gg.addColorStop(0.15, 'rgba(0,0,0,0.65)');
      gg.addColorStop(0.85, 'rgba(0,0,0,0.65)');
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(-tw / 2, -big * 0.75, tw, big * (b.sub ? 2.1 : 1.5));
      ctx.fillStyle = b.color;
      ctx.fillRect(-tw / 2 + 40 * u, -big * 0.75, tw - 80 * u, 4 * u);
      ctx.fillRect(-tw / 2 + 40 * u, -big * 0.75 + big * (b.sub ? 2.1 : 1.5) - 4 * u, tw - 80 * u, 4 * u);
      ctx.restore();
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = big * 0.14;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(b.text, 0, 0);
    const tg = ctx.createLinearGradient(0, -big / 2, 0, big / 2);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.55, b.color);
    tg.addColorStop(1, shadeMix(b.color));
    ctx.fillStyle = tg;
    ctx.fillText(b.text, 0, 0);
    if (b.sub) {
      ctx.font = `${20 * u}px ${FONT}`;
      ctx.lineWidth = 5 * u;
      ctx.strokeText(b.sub, 0, big * 0.78);
      ctx.fillStyle = '#fff';
      ctx.fillText(b.sub, 0, big * 0.78);
    }
    ctx.restore();
  }
}

function shadeMix(hex: string) {
  return rgba(hex, 1).replace(/rgba\((\d+),(\d+),(\d+),1\)/, (_s, r, g, b) => `rgb(${Math.floor(r * 0.6)},${Math.floor(g * 0.6)},${Math.floor(b * 0.6)})`);
}

function drawReplay(ctx: CanvasRenderingContext2D, m: Match, W: number, H: number, u: number, time: number, touch: boolean) {
  const bar = H * 0.09;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, bar);
  ctx.fillRect(0, H - bar, W, bar);
  // film grain-ish tint
  ctx.fillStyle = 'rgba(40,60,90,0.12)';
  ctx.fillRect(0, bar, W, H - bar * 2);
  ctx.font = `${18 * u}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const x = 34 * u;
  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(x, bar / 2, 7 * u, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.fillText(t().replay, x + 16 * u, bar / 2 + 1);
  const lg = m.lastGoal;
  if (lg) {
    ctx.textAlign = 'right';
    ctx.fillStyle = lg.team.def.primary;
    ctx.fillText(`${m.teams[0].def.short} ${m.teams[0].score} - ${m.teams[1].score} ${m.teams[1].def.short}`, W - 24, bar / 2 + 1);
  }
  ctx.textAlign = 'center';
  ctx.font = `${12 * u}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  if (!m.cfg.demo) ctx.fillText(t().skip, W / 2, H - bar / 2);
  void touch;
  ctx.restore();
}
