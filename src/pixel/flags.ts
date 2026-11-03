/** Pixel-art language flags (24x16 + 1px frame), generated at runtime. */
const cache = new Map<string, HTMLCanvasElement>();
const W = 24, H = 16;

type Px = (x: number, y: number) => string;

const FLAGS: Record<string, Px> = {
  // Turkey: red field, white crescent and star
  tr: (x, y) => {
    const cx = x + 0.5, cy = y + 0.5;
    const outer = Math.hypot(cx - 8.6, cy - 8) < 4.9;
    const inner = Math.hypot(cx - 9.9, cy - 8) < 3.95;
    if (outer && !inner) return '#ffffff';
    const STAR = ['..#..', '#####', '.###.', '.#.#.'];
    const sx = x - 13, sy = y - 6;
    if (sx >= 0 && sx < 5 && sy >= 0 && sy < 4 && STAR[sy][sx] === '#') return '#ffffff';
    return '#e30a17';
  },
  // United Kingdom: union flag
  gb: (x, y) => {
    const cx = x + 0.5, cy = y + 0.5;
    const ax = Math.abs(cx - W / 2), ay = Math.abs(cy - H / 2);
    if (ax < 1.5 || ay < 1.5) return '#c8102e';
    if (ax < 3 || ay < 3) return '#ffffff';
    // diagonals
    const k = H / W;
    const d1 = Math.abs(cy - cx * k) / Math.hypot(1, k);
    const d2 = Math.abs(cy - (H - cx * k)) / Math.hypot(1, k);
    const d = Math.min(d1, d2);
    // red diagonal stripe offset (counterchanged) - simplified to the thin centre band
    if (d < 0.75) return '#c8102e';
    if (d < 2.1) return '#ffffff';
    return '#012169';
  },
};

export function flagCanvas(code: string): HTMLCanvasElement {
  const hit = cache.get(code);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = W + 2;
  c.height = H + 2;
  const g = c.getContext('2d')!;
  const px = FLAGS[code] ?? FLAGS.gb;
  g.fillStyle = '#120c1c';
  g.fillRect(0, 0, W + 2, H + 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      g.fillStyle = px(x, y);
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  // cloth shading: light top row, darker bottom row, slight wave
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fillRect(1, 1, W, 1);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(1, H, W, 1);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 1; x <= W; x++) if (Math.floor(x / 6) % 2) g.fillRect(x, 1, 1, H);
  cache.set(code, c);
  return c;
}
