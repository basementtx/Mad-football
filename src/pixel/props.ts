/**
 * Small HD pixel-art props generated at runtime (2 px per virtual px):
 * ball, shadows, rings, arrow, stars, UI discs. Hard edges, ramp shading, outlines.
 */
import { ramp, css, RGB, OUTLINE, mix } from './palette';
import { hexToRgb } from '../engine/math';
import { hiCanvas, HiCanvas, spriteRes, crisp, pxRing, pxDisc } from '../engine/gfx';

const cache = new Map<string, HiCanvas>();

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, c: HiCanvas) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = hiCanvas(w, h, spriteRes());
  draw(g, c);
  cache.set(key, c);
  return c;
}

/** per-pixel painter in framebuffer pixels */
function paint(g: CanvasRenderingContext2D, c: HiCanvas, fn: (x: number, y: number, N: number, M: number) => [RGB, number] | null) {
  const N = c.width, M = c.height;
  const img = g.getImageData(0, 0, N, M);
  for (let y = 0; y < M; y++)
    for (let x = 0; x < N; x++) {
      const r = fn(x, y, N, M);
      if (!r) continue;
      const o = (y * N + x) * 4;
      img.data[o] = r[0][0];
      img.data[o + 1] = r[0][1];
      img.data[o + 2] = r[0][2];
      img.data[o + 3] = r[1];
    }
  g.putImageData(img, 0, 0);
}

function outline(g: CanvasRenderingContext2D, c: HiCanvas, col: RGB = OUTLINE) {
  const N = c.width, M = c.height;
  const img = g.getImageData(0, 0, N, M);
  const d = img.data;
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < M && d[(y * N + x) * 4 + 3] > 0;
  const mark: number[] = [];
  for (let y = 0; y < M; y++)
    for (let x = 0; x < N; x++) {
      if (filled(x, y)) continue;
      if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) mark.push(x, y);
    }
  for (let i = 0; i < mark.length; i += 2) {
    const o = (mark[i + 1] * N + mark[i]) * 4;
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- ball

export const BALL_SIZE = 9;
const BALL_FRAMES = 12;

/** Rotation frames; fire = flaming variant. Ramp-shaded sphere with pentagon patches. */
export function ballFrame(frame: number, fire: boolean) {
  const f = ((frame % BALL_FRAMES) + BALL_FRAMES) % BALL_FRAMES;
  return make(`ball${f}${fire}`, BALL_SIZE, BALL_SIZE, (g, c) => {
    const base = fire ? ramp('#ffd25a') : ramp('#f4f5fa');
    const patch = fire ? ramp('#c2310e') : ramp('#2a2836');
    const S = c.__s!;
    const cx = c.width / 2, R = 3.5 * S;
    const t = (1 + Math.sqrt(5)) / 2;
    const P: [number, number, number][] = [];
    for (const [a, b] of [[1, t], [-1, t], [1, -t], [-1, -t]]) P.push([0, a, b], [a, b, 0], [b, 0, a]);
    const norm = P.map(([x, y, z]) => {
      const l = Math.hypot(x, y, z);
      return [x / l, y / l, z / l] as [number, number, number];
    });
    const rot = (f / BALL_FRAMES) * Math.PI * 2 * 0.4;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    paint(g, c, (x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cx;
      const d = Math.hypot(dx, dy);
      if (d > R) return null;
      const nx = dx / R, ny = dy / R;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const rx = nx * cr - nz * sr, rz = nx * sr + nz * cr;
      const ry = ny * 0.9 + rz * 0.1;
      let best = -1;
      for (const q of norm) best = Math.max(best, rx * q[0] + ry * q[1] + rz * q[2]);
      const inPatch = best > 0.925;
      const light = -nx * 0.55 - ny * 0.75 + nz * 0.35;
      let tone = light > 0.62 ? 3 : light > 0.05 ? 2 : light > -0.45 ? 1 : 0;
      if (d / R > 0.82 && light < 0.2) tone = Math.min(tone, 1);
      const rp = inPatch ? patch : base;
      if (inPatch) tone = Math.max(1, tone - (tone === 3 ? 0 : 1));
      if (light > 0.85 && d / R < 0.6) return [[255, 255, 255], 255];
      return [rp[tone], 255];
    });
    outline(g, c, fire ? [90, 20, 10] : OUTLINE);
  });
}

// ---------------------------------------------------------------- shadows & rings

/** Flat translucent contact shadow with a slightly darker core (radii in virtual px). */
export function shadow(rx: number, ry: number) {
  rx = Math.max(1, Math.round(rx * 2) / 2);
  ry = Math.max(1, Math.round(ry * 2) / 2);
  return make(`sh${rx}_${ry}`, rx * 2 + 1, ry * 2 + 1, (g) => {
    g.fillStyle = 'rgba(8,26,14,0.32)';
    g.beginPath();
    pxDisc(g, rx + 0.5, ry + 0.5, rx, ry);
    g.fill();
    g.beginPath();
    pxDisc(g, rx + 0.5, ry + 0.5, rx * 0.7, ry * 0.66);
    g.fill();
  });
}

export function ring(rx: number, ry: number, color: string) {
  rx = Math.round(rx * 2) / 2;
  ry = Math.round(ry * 2) / 2;
  return make(`ring${rx}_${ry}_${color}`, rx * 2 + 3, ry * 2 + 4, (g) => {
    const dk = ramp(color.startsWith('#') ? color : '#ffffff')[0];
    g.fillStyle = css(dk);
    g.beginPath();
    pxRing(g, rx + 1.5, ry + 2, rx, ry, 2);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    pxRing(g, rx + 1.5, ry + 1.5, rx, ry, 2);
    g.fill();
  });
}

export function arrow(color: string) {
  return make(`arrow${color}`, 11, 9, (g, c) => {
    const r = ramp(color);
    g.beginPath();
    g.moveTo(1.5, 1.5);
    g.lineTo(9.5, 1.5);
    g.lineTo(5.5, 6.8);
    g.closePath();
    g.fillStyle = css(r[2]);
    g.fill();
    crisp(c);
    g.fillStyle = css(r[3]);
    g.fillRect(2, 1.5, 7, 1);
    g.fillStyle = css(r[1]);
    g.globalCompositeOperation = 'source-atop';
    g.fillRect(0, 4.5, 11, 3);
    g.globalCompositeOperation = 'source-over';
    outline(g, c);
  });
}

export function star(color = '#ffe14d') {
  return make(`star${color}`, 7, 7, (g, c) => {
    const r = ramp(color);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? 1.25 : 2.9;
      g.lineTo(3.5 + Math.cos(a) * rr, 3.6 + Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = css(r[2]);
    g.fill();
    crisp(c);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = css(r[3]);
    g.fillRect(0, 0, 7, 3);
    g.globalCompositeOperation = 'source-over';
    outline(g, c);
  });
}

/** Shaded pixel UI disc (touch buttons / joystick). */
export function disc(r: number, color: string, pressed: boolean, alpha = 255) {
  r = Math.round(r);
  const size = r * 2 + 3;
  return make(`disc${r}${color}${pressed}${alpha}`, size, size + 2, (g, c) => {
    const rp = ramp(color);
    const S = c.__s!;
    const cx = (r + 1.5) * S, cy = (r + 1.5) * S, R = r * S;
    const oy = pressed ? 2 * S : 0;
    paint(g, c, (x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy - oy;
      const d = Math.hypot(dx, dy);
      if (d <= R) {
        const l = (-dx * 0.6 - dy * 0.8) / R;
        let tone = 2;
        if (d > R - 1.5 * S && l > 0.1) tone = 3;
        else if (l > 0.5) tone = 3;
        else if (l < -0.45) tone = 1;
        if (d > R - S * 0.8 && l < -0.3) tone = 1;
        // gloss band
        if (dy < -R * 0.35 && dy > -R * 0.75 && Math.abs(dx) < R * 0.55 && !pressed) tone = 3;
        return [pressed && tone === 3 ? rp[2] : rp[tone], alpha];
      }
      if (!pressed && Math.hypot(dx, dy - 2 * S) <= R) return [rp[0], alpha];
      return null;
    });
    outline(g, c, mix(rp[0], OUTLINE, 0.6));
  });
}

export function ringDisc(r: number, color: string, alpha: number) {
  r = Math.round(r);
  const size = r * 2 + 3;
  return make(`rdisc${r}${color}${alpha}`, size, size, (g, c) => {
    const col = hexToRgb(color) as RGB;
    const S = c.__s!;
    const cx = (r + 1.5) * S, R = r * S;
    paint(g, c, (x, y) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cx);
      if (d <= R && d > R - 2.5) return [col, 220];
      if (d <= R && alpha > 0) return [[8, 12, 24], alpha];
      return null;
    });
  });
}

export const cssOf = css;
