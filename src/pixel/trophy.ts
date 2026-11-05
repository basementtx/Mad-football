/**
 * Pixel-art trophies, drawn procedurally with lit metal (bright left edge,
 * shaded right edge, specular streak): the cup, the league trophy (metal by
 * division) and the promotion medal. Cached per kind / colour.
 */
export type TrophyArt = 'cup' | 'league' | 'promotion';

const W = 40, H = 52;
const cache = new Map<string, HTMLCanvasElement>();

/** metal ramps: dark -> light */
const METALS: Record<string, string[]> = {
  gold: ['#5a3a04', '#8a5a06', '#c88a10', '#eab52a', '#ffd84a', '#fff2a0', '#ffffff'],
  silver: ['#3a4250', '#5e6674', '#8a94a6', '#b8c0cc', '#dce2ea', '#f4f7fb', '#ffffff'],
  bronze: ['#3a1c08', '#5e300c', '#8a4a18', '#b0682a', '#d08a48', '#f0b47a', '#fff0d8'],
  platinum: ['#2a3a48', '#46607a', '#6a90b0', '#9cc0dc', '#cfe6f6', '#eef8ff', '#ffffff'],
};
export const DIV_METAL: Record<number, string> = { 1: 'gold', 2: 'platinum', 3: 'silver', 4: 'bronze', 5: 'bronze' };

function drawer(g: CanvasRenderingContext2D) {
  return (x: number, y: number, c: string, w = 1, h = 1) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
}

/** Fill a lathe-turned shape: for every row a half-width, lit from the left. */
function lathe(g: CanvasRenderingContext2D, cx: number, y0: number, rows: number[], ramp: string[]) {
  const px = drawer(g);
  rows.forEach((hw, i) => {
    if (hw <= 0) return;
    const y = y0 + i;
    for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) {
      const t = (x - (cx - hw)) / (2 * hw); // 0 left .. 1 right
      // light from the upper left: bright band at ~25%, dark on the right edge
      let k = 4 - Math.abs(t - 0.28) * 7;
      if (t > 0.8) k -= 1;
      k = Math.max(0, Math.min(ramp.length - 2, Math.round(k)));
      px(x, y, ramp[k]);
    }
    // outline
    px(Math.round(cx - hw) - 1, y, '#120c1c');
    px(Math.round(cx + hw), y, '#120c1c');
  });
  // specular streak
  rows.forEach((hw, i) => {
    if (hw >= 3 && i % 1 === 0) px(Math.round(cx - hw * 0.55), y0 + i, ramp[ramp.length - 1]);
  });
}

function base(g: CanvasRenderingContext2D, cx: number, y: number, w: number, wood = '#5a2e10') {
  const px = drawer(g);
  // plinth: wood block with a brass plate
  px(cx - w - 1, y - 1, '#120c1c', 2 * w + 2, 1);
  px(cx - w - 1, y, '#120c1c', 1, 9);
  px(cx + w, y, '#120c1c', 1, 9);
  px(cx - w, y, wood, 2 * w, 8);
  px(cx - w, y, '#7a4a20', 2 * w, 1);
  px(cx - w, y + 7, '#3a1c08', 2 * w, 1);
  px(cx - w - 1, y + 8, '#120c1c', 2 * w + 2, 1);
  px(cx - Math.round(w * 0.6), y + 2, '#c88a10', Math.round(w * 1.2), 4);
  px(cx - Math.round(w * 0.6), y + 2, '#ffd84a', Math.round(w * 1.2), 1);
  px(cx - Math.round(w * 0.6) + 2, y + 4, '#8a5a06', Math.round(w * 1.2) - 4, 1);
}

export function trophyCanvas(kind: TrophyArt, ribbon = '#e23a2e', metal = 'gold'): HTMLCanvasElement {
  const key = `${kind}|${ribbon}|${metal}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const px = drawer(g);
  const R = METALS[metal] ?? METALS.gold;
  const cx = 20;

  if (kind === 'cup') {
    // handles (behind the bowl)
    for (const s of [-1, 1]) {
      const hx = cx + s * 12;
      for (let i = 0; i < 12; i++) {
        const ox = Math.round(Math.sin((i / 11) * Math.PI) * 5) * s;
        px(hx + ox - (s < 0 ? 1 : 0), 6 + i, '#120c1c', 2, 1);
        px(hx + ox + (s < 0 ? 1 : -1), 6 + i, i < 4 ? R[5] : R[3]);
      }
      // ribbon in the club colour hanging from the handle
      px(hx + s * 3, 13, ribbon, 2, 10);
      px(hx + s * 3 + (s > 0 ? 2 : -1), 15, ribbon, 1, 9);
      px(hx + s * 3, 23, '#120c1c', 2, 1);
    }
    // bowl
    const bowl: number[] = [];
    for (let i = 0; i < 17; i++) bowl.push(11.5 - Math.pow(i / 16, 2.2) * 8.5);
    lathe(g, cx, 3, bowl, R);
    px(cx - 12, 2, '#120c1c', 24, 1); // rim
    px(cx - 11, 3, R[6], 22, 1);
    // stem + knot
    lathe(g, cx, 20, [2.5, 2, 2, 3.5, 3.5, 2, 2, 2.5, 3.5, 5, 6.5], R);
    base(g, cx, 32, 9);
    // engraved star on the bowl
    px(cx - 1, 9, R[1], 3, 1);
    px(cx, 8, R[1], 1, 3);
  } else if (kind === 'league') {
    // tall trophy with a lid and a star on top
    lathe(g, cx, 8, [3, 4, 5, 5.5, 6, 6.5, 7, 7, 7, 6.5, 6, 5, 4, 3, 2.5, 2.5, 2.5, 3.5, 4.5, 6, 7.5], R);
    // lid
    lathe(g, cx, 4, [2, 4, 5.5, 6.5], R);
    // star
    const star = [[0, 0], [-1, 1], [0, 1], [1, 1], [-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2], [-1, 3], [0, 3], [1, 3], [-2, 4], [2, 4]];
    for (const [x, y] of star) px(cx + x, y - 1 + 0, y < 2 ? '#ffffff' : '#ffd84a');
    // side wings
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) px(cx + s * (8 + Math.round(i * 0.6)), 10 + i, i < 2 ? R[5] : R[3], 1, 1);
    // ribbon band
    px(cx - 6, 16, ribbon, 12, 2);
    px(cx - 6, 18, '#120c1c', 12, 1);
    base(g, cx, 30, 10);
  } else {
    // promotion medal: ribbon V, round medal with an up arrow
    for (let i = 0; i < 14; i++) {
      px(cx - 9 + Math.round(i * 0.5), i + 1, ribbon, 4, 1);
      px(cx + 6 - Math.round(i * 0.5), i + 1, ribbon, 4, 1);
      px(cx - 9 + Math.round(i * 0.5), i + 1, '#ffffff', 1, 1);
    }
    const rows: number[] = [];
    for (let i = 0; i < 20; i++) rows.push(Math.sqrt(Math.max(0, 100 - Math.pow(i - 9.5, 2))));
    lathe(g, cx, 14, rows, R);
    // inner ring + arrow
    for (let a = 0; a < 40; a++) {
      const t = (a / 40) * Math.PI * 2;
      px(Math.round(cx + Math.cos(t) * 7) - 0, Math.round(24 + Math.sin(t) * 7), R[1]);
    }
    const arrow = [[0, -4], [-1, -3], [0, -3], [1, -3], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2], [1, 2]];
    for (const [x, y] of arrow) px(cx + x, 24 + y, '#ffffff');
    base(g, cx, 36, 8);
  }
  cache.set(key, c);
  return c;
}
