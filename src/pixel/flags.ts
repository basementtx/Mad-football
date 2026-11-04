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

// ---- simple national flags for the career world
const hBands = (...c: string[]): Px => (_x, y) => c[Math.min(c.length - 1, Math.floor((y / H) * c.length))];
const vBands = (...c: string[]): Px => (x) => c[Math.min(c.length - 1, Math.floor((x / W) * c.length))];
Object.assign(FLAGS, {
  en: (x: number, y: number) => (Math.abs(x + 0.5 - W / 2) < 2 || Math.abs(y + 0.5 - H / 2) < 2 ? '#ce1124' : '#ffffff'),
  es: (x: number, y: number) => (y < 4 || y >= 12 ? '#c60b1e' : x >= 5 && x <= 8 && y >= 6 && y <= 9 ? '#ad1519' : '#ffc400'),
  it: vBands('#009246', '#ffffff', '#ce2b37'),
  de: hBands('#1a1a1a', '#dd0000', '#ffce00'),
  fr: vBands('#0055a4', '#ffffff', '#ef4135'),
  nl: hBands('#ae1c28', '#ffffff', '#21468b'),
  ng: vBands('#008751', '#ffffff', '#008751'),
  ar: (x: number, y: number) => (Math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2) < 2.2 && y >= 5 && y < 11 ? '#f6b40e' : y < 5 || y >= 11 ? '#74acdf' : '#ffffff'),
  jp: (x: number, y: number) => (Math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2) < 4.6 ? '#bc002d' : '#ffffff'),
  pt: (x: number, y: number) => (Math.hypot(x + 0.5 - 9.6, y + 0.5 - H / 2) < 3.4 ? (Math.hypot(x + 0.5 - 9.6, y + 0.5 - H / 2) < 2 ? '#ffffff' : '#ffe000') : x < 9.6 ? '#006600' : '#ff0000'),
  br: (x: number, y: number) => {
    const cx = x + 0.5 - W / 2, cy = y + 0.5 - H / 2;
    if (Math.hypot(cx, cy) < 3.7) return Math.abs(cy + cx * 0.25 - 0.3) < 0.6 ? '#ffffff' : '#002776';
    if (Math.abs(cx) / 10.5 + Math.abs(cy) / 6.5 < 1) return '#ffdf00';
    return '#009c3b';
  },
});

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
