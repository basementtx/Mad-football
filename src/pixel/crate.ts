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
