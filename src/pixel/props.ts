/** Small props generated at runtime (supersampled): ball, shadows, rings, stars, UI discs. */
import { ramp, css, RGB } from './palette';
import { hexToRgb } from '../engine/math';
import { hiCanvas, HiCanvas, spriteRes } from '../engine/gfx';

const cache = new Map<string, HiCanvas>();

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, c: HiCanvas) => void, res = spriteRes()) {
  const k = key + '@' + res;
  const hit = cache.get(k);
  if (hit) return hit;
  const [c, g] = hiCanvas(w, h, res);
  draw(g, c);
  cache.set(k, c);
  return c;
}

const lerp = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------------------------------------------------------------- ball

export const BALL_SIZE = 9;
const BALL_FRAMES = 16;

/** Rotation frames; fire = flaming variant. Per-pixel shaded sphere with anti-aliased edge. */
export function ballFrame(frame: number, fire: boolean) {
  const f = ((frame % BALL_FRAMES) + BALL_FRAMES) % BALL_FRAMES;
  return make(`ball${f}${fire}`, BALL_SIZE, BALL_SIZE, (g, c) => {
    const S = c.__s!;
    const N = c.width;
    const img = g.createImageData(N, N);
    const base = fire ? ramp('#ffd25a') : ramp('#f4f5fa');
    const patch = fire ? ramp('#c2310e') : ramp('#22202e');
    const cx = N / 2, R = 3.6 * S;
    // icosahedron-ish patch centres on the unit sphere
    const P: [number, number, number][] = [];
    const t = (1 + Math.sqrt(5)) / 2;
    for (const [a, b] of [[1, t], [-1, t], [1, -t], [-1, -t]]) {
      P.push([0, a, b], [a, b, 0], [b, 0, a]);
    }
    const norm = P.map(([x, y, z]) => {
      const l = Math.hypot(x, y, z);
      return [x / l, y / l, z / l] as [number, number, number];
    });
    const rot = (f / BALL_FRAMES) * Math.PI * 2 * 0.4;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cx;
        const d = Math.hypot(dx, dy);
        const cov = Math.min(1, Math.max(0, R - d + 0.5));
        if (cov <= 0) continue;
        const nx = dx / R, ny = dy / R;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        // rotate the surface point around a tilted axis (rolling)
        const rx = nx * cr - nz * sr, rz = nx * sr + nz * cr;
        const ry = ny * 0.9 + rz * 0.1;
        let best = -1;
        for (const q of norm) best = Math.max(best, rx * q[0] + ry * q[1] + rz * q[2]);
        const inPatch = best > 0.93;
        const seam = !inPatch && best > 0.9;
        const light = Math.max(0, -nx * 0.45 - ny * 0.65 + nz * 0.6);
        const spec = Math.pow(Math.max(0, -nx * 0.4 - ny * 0.6 + nz * 0.7), 24);
        const rp = inPatch ? patch : base;
        let col = light < 0.5 ? lerp(rp[0], rp[2], Math.min(1, 0.25 + light * 1.5)) : lerp(rp[2], rp[3], (light - 0.5) * 2);
        if (seam) col = lerp(col, rp[1], 0.6);
        col = lerp(col, [255, 255, 255], spec * 0.9);
        // rim darkening
        col = lerp(col, fire ? [120, 30, 10] : [40, 40, 60], Math.pow(d / R, 6) * 0.6);
        const o = (y * N + x) * 4;
        img.data[o] = col[0];
        img.data[o + 1] = col[1];
        img.data[o + 2] = col[2];
        img.data[o + 3] = cov * 255;
      }
    g.putImageData(img, 0, 0);
  });
}

// ---------------------------------------------------------------- shadows & rings

/** Soft contact shadow (radii in virtual px). */
export function shadow(rx: number, ry: number) {
  rx = Math.max(1, Math.round(rx * 2) / 2);
  ry = Math.max(1, Math.round(ry * 2) / 2);
  return make(`sh${rx}_${ry}`, rx * 2 + 2, ry * 2 + 2, (g) => {
    g.translate(rx + 1, ry + 1);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, 'rgba(6,20,12,0.55)');
    gr.addColorStop(0.55, 'rgba(6,20,12,0.38)');
    gr.addColorStop(1, 'rgba(6,20,12,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
  }, 3);
}

export function ring(rx: number, ry: number, color: string) {
  rx = Math.round(rx);
  ry = Math.round(ry);
  return make(`ring${rx}_${ry}_${color}`, rx * 2 + 4, ry * 2 + 5, (g) => {
    const dk = ramp(color.startsWith('#') ? color : '#ffffff')[0];
    g.lineWidth = 1.3;
    g.strokeStyle = css(dk, 0.7);
    g.beginPath();
    g.ellipse(rx + 2, ry + 2.8, rx, ry, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = color;
    g.beginPath();
    g.ellipse(rx + 2, ry + 2, rx, ry, 0, 0, Math.PI * 2);
    g.stroke();
  });
}

export function arrow(color: string) {
  return make(`arrow${color}`, 11, 9, (g) => {
    const r = ramp(color);
    g.beginPath();
    g.moveTo(1.2, 1.2);
    g.lineTo(9.8, 1.2);
    g.lineTo(5.5, 7);
    g.closePath();
    g.lineJoin = 'round';
    g.lineWidth = 1.6;
    g.strokeStyle = '#120c1c';
    g.stroke();
    const gr = g.createLinearGradient(0, 1, 0, 7);
    gr.addColorStop(0, css(r[3]));
    gr.addColorStop(1, css(r[1]));
    g.fillStyle = gr;
    g.fill();
  });
}

function starPath(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
}

export function star(color = '#ffe14d') {
  return make(`star${color}`, 7, 7, (g) => {
    const r = ramp(color);
    starPath(g, 3.5, 3.7, 3.2, 1.4);
    g.lineJoin = 'round';
    g.lineWidth = 0.9;
    g.strokeStyle = '#120c1c';
    g.stroke();
    const gr = g.createLinearGradient(0, 0, 0, 7);
    gr.addColorStop(0, css(r[3]));
    gr.addColorStop(1, css(r[2]));
    g.fillStyle = gr;
    g.fill();
  });
}

/** Glossy UI disc (touch buttons / joystick). */
export function disc(r: number, color: string, pressed: boolean, alpha = 255) {
  r = Math.round(r);
  const size = r * 2 + 3;
  return make(`disc${r}${color}${pressed}${alpha}`, size, size + 2, (g) => {
    const rp = ramp(color);
    const cx = r + 1.5, cy = r + 1.5;
    g.globalAlpha = alpha / 255;
    if (!pressed) {
      g.fillStyle = css(rp[0]);
      g.beginPath();
      g.arc(cx, cy + 2, r, 0, Math.PI * 2);
      g.fill();
    }
    const oy = pressed ? 2 : 0;
    const gr = g.createRadialGradient(cx - r * 0.35, cy + oy - r * 0.45, r * 0.1, cx, cy + oy, r);
    gr.addColorStop(0, css(pressed ? rp[2] : rp[3]));
    gr.addColorStop(0.65, css(rp[2]));
    gr.addColorStop(1, css(rp[1]));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy + oy, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = css(rp[0]);
    g.stroke();
    // gloss
    g.save();
    g.clip();
    const gl = g.createLinearGradient(0, cy + oy - r, 0, cy + oy);
    gl.addColorStop(0, 'rgba(255,255,255,0.38)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.beginPath();
    g.ellipse(cx, cy + oy - r * 0.45, r * 0.78, r * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

export function ringDisc(r: number, color: string, alpha: number) {
  r = Math.round(r);
  const size = r * 2 + 3;
  return make(`rdisc${r}${color}${alpha}`, size, size, (g) => {
    const c = hexToRgb(color) as RGB;
    const cx = r + 1.5;
    if (alpha > 0) {
      const gr = g.createRadialGradient(cx, cx, r * 0.2, cx, cx, r);
      gr.addColorStop(0, `rgba(8,12,24,${(alpha / 255) * 0.5})`);
      gr.addColorStop(1, `rgba(8,12,24,${alpha / 255})`);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(cx, cx, r, 0, Math.PI * 2);
      g.fill();
    }
    g.lineWidth = 1.4;
    g.strokeStyle = css(c, 0.86);
    g.beginPath();
    g.arc(cx, cx, r - 0.7, 0, Math.PI * 2);
    g.stroke();
  });
}

export const cssOf = css;
