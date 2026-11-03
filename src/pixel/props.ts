/** Small pixel-art props generated at runtime: ball, shadows, rings, stars, UI discs. */
import { ramp, css, RGB, OUTLINE, mix } from './palette';
import { hexToRgb } from '../engine/math';

const cache = new Map<string, HTMLCanvasElement>();

function make(key: string, w: number, h: number, draw: (img: ImageData) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  draw(img);
  g.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

function put(img: ImageData, x: number, y: number, c: RGB, a = 255) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const o = (y * img.width + x) * 4;
  img.data[o] = c[0];
  img.data[o + 1] = c[1];
  img.data[o + 2] = c[2];
  img.data[o + 3] = a;
}

function filled(img: ImageData, x: number, y: number) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return false;
  return img.data[(y * img.width + x) * 4 + 3] > 0;
}

function outline(img: ImageData, col: RGB = OUTLINE) {
  const w = img.width, h = img.height;
  const mark: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (filled(img, x, y)) continue;
      if (filled(img, x + 1, y) || filled(img, x - 1, y) || filled(img, x, y + 1) || filled(img, x, y - 1)) mark.push(x, y);
    }
  for (let i = 0; i < mark.length; i += 2) put(img, mark[i], mark[i + 1], col);
}

// ---------------------------------------------------------------- ball

export const BALL_SIZE = 9;

/** 8 rotation frames; fire = flaming variant */
export function ballFrame(frame: number, fire: boolean) {
  const f = ((frame % 8) + 8) % 8;
  return make(`ball${f}${fire}`, BALL_SIZE, BALL_SIZE, (img) => {
    const base = fire ? ramp('#ffd25a') : ramp('#f2f2f6');
    const patch = fire ? ramp('#c2310e') : ramp('#2a2836');
    const c = 4.5, R = 3.35;
    for (let y = 0; y < BALL_SIZE; y++)
      for (let x = 0; x < BALL_SIZE; x++) {
        const dx = x + 0.5 - c, dy = y + 0.5 - c;
        const d = Math.hypot(dx, dy);
        if (d > R) continue;
        // sphere mapping for patches: rotate around vertical axis
        const nz = Math.sqrt(Math.max(0, 1 - (d / R) ** 2));
        const nx = dx / R, ny = dy / R;
        const lon = Math.atan2(nx, nz) + (f / 8) * Math.PI * 0.8;
        const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
        const pa = Math.cos(lon * 2.5) * Math.cos(lat * 2.5) > 0.55 || Math.cos((lon + 0.65) * 2.5) * Math.cos((lat - 1.1) * 2.5) > 0.7;
        const light = -nx * 0.6 - ny * 0.8;
        let tone = light > 0.45 ? 3 : light < -0.35 ? 1 : 2;
        if (d / R > 0.85 && light < 0) tone = 1;
        put(img, x, y, (pa ? patch : base)[pa ? Math.max(1, tone - 1) : tone]);
      }
    put(img, 3, 2, fire ? [255, 255, 220] : [255, 255, 255]);
    outline(img, fire ? [90, 20, 10] : OUTLINE);
  });
}

// ---------------------------------------------------------------- shadows & rings

export function shadow(rx: number, ry: number) {
  rx = Math.max(1, Math.round(rx));
  ry = Math.max(1, Math.round(ry));
  return make(`sh${rx}_${ry}`, rx * 2 + 1, ry * 2 + 1, (img) => {
    for (let y = 0; y <= ry * 2; y++)
      for (let x = 0; x <= rx * 2; x++) {
        const dx = (x - rx) / (rx + 0.5), dy = (y - ry) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) put(img, x, y, [10, 30, 20], 95);
      }
  });
}

export function ring(rx: number, ry: number, color: string) {
  rx = Math.round(rx);
  ry = Math.round(ry);
  return make(`ring${rx}_${ry}_${color}`, rx * 2 + 3, ry * 2 + 4, (img) => {
    const c = hexToRgb(color);
    const dk = ramp(color)[0];
    const pts = new Set<string>();
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const x = Math.round(rx + 1 + Math.cos(a) * rx), y = Math.round(ry + 1 + Math.sin(a) * ry);
      pts.add(`${x},${y}`);
    }
    for (const p of pts) {
      const [x, y] = p.split(',').map(Number);
      put(img, x, y + 1, dk);
    }
    for (const p of pts) {
      const [x, y] = p.split(',').map(Number);
      put(img, x, y, c as RGB);
    }
  });
}

export function arrow(color: string) {
  return make(`arrow${color}`, 9, 7, (img) => {
    const r = ramp(color);
    const rows = ['#######', '.#####.', '..###..', '...#...'];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') put(img, x + 1, y + 1, y === 0 ? r[3] : r[2]);
    });
    outline(img);
  });
}

export function star(color = '#ffe14d') {
  return make(`star${color}`, 7, 7, (img) => {
    const r = ramp(color);
    const rows = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') put(img, x + 1, y + 1, y < 2 ? r[3] : r[2]);
    });
    outline(img);
  });
}

/** Shaded UI disc (touch buttons / joystick). */
export function disc(r: number, color: string, pressed: boolean, alpha = 255) {
  r = Math.round(r);
  const size = r * 2 + 3;
  return make(`disc${r}${color}${pressed}${alpha}`, size, size + 2, (img) => {
    const rp = ramp(color);
    const cx = r + 1.5, cy = r + 1.5;
    // bottom lip (3D edge)
    if (!pressed) {
      for (let y = 0; y < size + 2; y++)
        for (let x = 0; x < size; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - (cy + 2));
          if (d <= r) put(img, x, y, rp[0], alpha);
        }
    }
    const oy = pressed ? 2 : 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        const l = (-dx * 0.6 - dy * 0.8) / r;
        let tone = 2;
        if (d > r - 1.2 && l > 0.1) tone = 3;
        else if (l > 0.55) tone = 3;
        else if (l < -0.5) tone = 1;
        put(img, x, y + oy, pressed && tone === 3 ? rp[2] : rp[tone], alpha);
      }
    outline(img, mix(rp[0], OUTLINE, 0.6));
  });
}

export function ringDisc(r: number, color: string, alpha: number) {
  r = Math.round(r);
  const size = r * 2 + 3;
  return make(`rdisc${r}${color}${alpha}`, size, size, (img) => {
    const c = hexToRgb(color) as RGB;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - (r + 1.5), y + 0.5 - (r + 1.5));
        if (d <= r && d > r - 1.5) put(img, x, y, c, 220);
        else if (d <= r) put(img, x, y, [8, 12, 24], alpha);
      }
  });
}

export const cssOf = css;
