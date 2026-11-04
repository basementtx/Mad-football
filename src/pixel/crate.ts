/** Pixel-art loot crates (body + lid drawn separately for the opening animation). */
import { ramp, css, OUTLINE } from './palette';

const W = 40, BODY_H = 26, LID_H = 10;

export function crateCanvases(kind: 'basic' | 'premium' | 'legend'): { body: HTMLCanvasElement; lid: HTMLCanvasElement } {
  const base = kind === 'basic' ? '#a8692f' : kind === 'premium' ? '#4f6fd8' : '#e8a91c';
  const trim = kind === 'basic' ? '#6b6f7a' : kind === 'premium' ? '#c8d0e0' : '#fff2a8';
  const gem = kind === 'basic' ? '#5ff0a4' : kind === 'premium' ? '#3bd9ff' : '#ff3fa4';
  const R = ramp(base), T = ramp(trim), G = ramp(gem);
  const mk = (h: number) => {
    const c = document.createElement('canvas');
    c.width = W + 2;
    c.height = h + 2;
    return c;
  };
  const body = mk(BODY_H), lid = mk(LID_H);
  const paint = (c: HTMLCanvasElement, h: number, isLid: boolean) => {
    const g = c.getContext('2d')!;
    g.fillStyle = css(OUTLINE);
    g.fillRect(0, 0, W + 2, h + 2);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < W; x++) {
        let col = css(R[2]);
        // planks / panels
        const band = isLid ? y : y % 8;
        if (band === 0) col = css(R[3]);
        if (band === 7 || (isLid && y === h - 1)) col = css(R[0]);
        if (kind === 'basic' && !isLid && (x + y * 3) % 17 === 0) col = css(R[1]);
        if (x > W / 2 + 6) col = col === css(R[2]) ? css(R[1]) : col;
        // metal trim on the corners and middle
        if (x < 3 || x >= W - 3 || (isLid ? y >= h - 3 : y < 3)) col = css(T[x < 3 || (isLid ? false : y < 1) ? 3 : 2]);
        if (x === 1 && y % 6 === 2) col = css(T[0]);
        if (x === W - 2 && y % 6 === 2) col = css(T[0]);
        g.fillStyle = col;
        g.fillRect(x + 1, y + 1, 1, 1);
      }
    // lock / gem
    const lx = W / 2 - 3;
    if (isLid) {
      g.fillStyle = css(OUTLINE);
      g.fillRect(lx, h - 4, 8, 6);
      g.fillStyle = css(T[2]);
      g.fillRect(lx + 1, h - 3, 6, 4);
    } else {
      g.fillStyle = css(OUTLINE);
      g.fillRect(lx, 2, 8, 9);
      g.fillStyle = css(T[2]);
      g.fillRect(lx + 1, 3, 6, 7);
      g.fillStyle = css(G[2]);
      g.fillRect(lx + 2, 4, 4, 4);
      g.fillStyle = css(G[3]);
      g.fillRect(lx + 2, 4, 2, 1);
      g.fillStyle = css(OUTLINE);
      g.fillRect(lx + 3, 7, 2, 2);
    }
  };
  paint(body, BODY_H, false);
  paint(lid, LID_H, true);
  return { body, lid };
}

// ------------------------------------------------------------------ 3D crate face textures

export type CrateKind = 'basic' | 'premium' | 'legend';
export type CrateFace = 'front' | 'side' | 'bottom' | 'lidFront' | 'lidSide' | 'lidTop' | 'inside';

const PAL: Record<CrateKind, { base: string; trim: string; gem: string; plank: boolean }> = {
  basic: { base: '#a8692f', trim: '#7a808c', gem: '#5ff0a4', plank: true },
  premium: { base: '#3f62d0', trim: '#d8e0f0', gem: '#3bd9ff', plank: false },
  legend: { base: '#e8a91c', trim: '#fff2a8', gem: '#ff3fa4', plank: false },
};
/** texture size in texels per face: 1 texel = 1/32 of the crate width */
const SZ: Record<CrateFace, [number, number]> = {
  front: [32, 20], side: [24, 20], bottom: [32, 24], lidFront: [32, 8], lidSide: [24, 8], lidTop: [32, 24], inside: [32, 24],
};
const texCache = new Map<string, string>();

/** A pixel-art texture (data URL) for one face of the 3D crate. */
export function crateTexture(kind: CrateKind, face: CrateFace): string {
  const key = kind + face;
  const hit = texCache.get(key);
  if (hit) return hit;
  const [w, h] = SZ[face];
  const p = PAL[kind];
  const R = ramp(p.base), T = ramp(p.trim), G = ramp(p.gem);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const put = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const lid = face.startsWith('lid');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let col: string;
      if (face === 'inside') {
        // dark interior with a warm glow toward the middle
        const d = Math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2));
        col = css(d < 0.5 ? R[1] : R[0]);
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) col = css(T[1]);
        put(x, y, col);
        continue;
      }
      // planks (wood) or panels (metal crates)
      if (p.plank) {
        const band = face === 'lidTop' || face === 'bottom' ? x % 8 : y % 5;
        col = css(band === 0 ? R[3] : band === 4 || band === 7 ? R[1] : R[2]);
        if ((x * 7 + y * 13) % 23 === 0) col = css(R[1]);
      } else {
        const diag = ((x + y) % 12) < 2;
        col = css(diag ? R[3] : R[2]);
        if (y > h * 0.6) col = css(diag ? R[2] : R[1]);
      }
      // metal frame on every face
      const fw = lid ? 2 : 3;
      const edge = x < fw || x >= w - fw || y < (lid ? 1 : fw) || y >= h - (face === 'lidFront' || face === 'lidSide' ? 2 : fw);
      if (edge) {
        col = css(T[x < 1 || y < 1 ? 3 : x >= w - 1 || y >= h - 1 ? 0 : 2]);
        // rivets
        if ((x === 1 || x === w - 2) && y % 5 === 2) col = css(T[0]);
        if ((y === 1 || y === h - 2) && x % 6 === 3 && !lid) col = css(T[0]);
      }
      // centre band across body faces
      if ((face === 'front' || face === 'side') && Math.abs(y - h * 0.55) < 1.5 && !edge) col = css(T[y < h * 0.55 ? 3 : 1]);
      // diamond emblem on the lid
      if (face === 'lidTop') {
        const d = Math.abs(x - w / 2 + 0.5) + Math.abs(y - h / 2 + 0.5);
        if (d < 6) col = css(d < 3 ? G[d < 1.5 ? 3 : 2] : d < 4.5 ? T[3] : T[1]);
      }
      put(x, y, col);
    }
  if (face === 'front') {
    // lock plate with the gem
    const lx = w / 2 - 4, ly = 0;
    g.fillStyle = css(OUTLINE);
    g.fillRect(lx, ly, 8, 9);
    g.fillStyle = css(T[2]);
    g.fillRect(lx + 1, ly + 1, 6, 7);
    g.fillStyle = css(T[3]);
    g.fillRect(lx + 1, ly + 1, 6, 1);
    g.fillStyle = css(G[2]);
    g.fillRect(lx + 2, ly + 2, 4, 4);
    g.fillStyle = css(G[3]);
    g.fillRect(lx + 2, ly + 2, 2, 1);
    g.fillStyle = css(OUTLINE);
    g.fillRect(lx + 3, ly + 6, 2, 1);
  }
  if (face === 'lidFront') {
    g.fillStyle = css(OUTLINE);
    g.fillRect(w / 2 - 4, h - 3, 8, 3);
    g.fillStyle = css(T[2]);
    g.fillRect(w / 2 - 3, h - 2, 6, 2);
  }
  const url = c.toDataURL();
  texCache.set(key, url);
  return url;
}
