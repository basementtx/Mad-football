/**
 * Front-facing pixel portrait (head + shoulders) for player cards, like a
 * trading-card headshot looking straight at the viewer. Built per pixel with
 * the same ramps / outline as the in-game sprites, so cards match the players.
 */
import type { PlayerLook } from './player';
import { ramp, RGB, OUTLINE, mix } from './palette';

export const PORTRAIT_W = 32;
export const PORTRAIT_H = 30;

const cache = new Map<string, HTMLCanvasElement>();
const WHITE: RGB = [246, 244, 238];
const EYE: RGB = [24, 20, 34];

export function portraitCanvas(look: PlayerLook): HTMLCanvasElement {
  const key = `${look.kit.id}|${look.kit.primary}|${look.kit.secondary}|${look.kit.pattern}|${look.isGK}|${look.skin}|${look.hair}|${look.hairStyle}|${look.beard}|${look.face ?? 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const W = PORTRAIT_W, H = PORTRAIT_H;
  const px: (RGB | null)[] = new Array(W * H).fill(null);
  const set = (x: number, y: number, c: RGB) => {
    if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c;
  };
  const get = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? px[y * W + x] : null);

  const SK = ramp(look.skin);
  const HR = ramp(look.hair);
  const jerHex = look.isGK ? look.kit.gk : look.kit.primary;
  const J1 = ramp(jerHex);
  const J2 = ramp(look.isGK ? '#1b1b22' : look.kit.secondary);
  const pattern = look.isGK ? 'gk' : look.kit.pattern;
  const cx = 15.5;
  // light from the top-left: pick a ramp step from a -1..1 "facing" value
  const shade = (r: RGB[], f: number) => (f > 0.45 ? r[3] : f > -0.25 ? r[2] : f > -0.7 ? r[1] : r[0]);

  // ---------------------------------------------------------------- shoulders + kit
  for (let y = 20; y < H; y++) {
    const t = (y - 20) / (H - 20);
    const half = 7 + t * 8.5 + (t > 0.15 ? 1 : 0);
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) > half) continue;
      const u = dx / half; // -1..1 across the chest
      // pattern in chest space
      let sec = false;
      switch (pattern) {
        case 'stripes': sec = Math.floor((dx + 16) / 3) % 2 === 0; break;
        case 'hoops': sec = Math.floor((y - 20) / 3) % 2 === 1; break;
        case 'half': sec = dx < 0; break;
        case 'sash': sec = Math.abs(dx + (y - 24) * 1.1) < 2.2; break;
        case 'chevron': sec = Math.abs(y - 25 - Math.abs(dx) * 0.55) < 1.1; break;
        case 'gk': sec = Math.abs(y - 26) < 0.6; break;
        case 'pinstripe': sec = Math.floor((dx + 16) / 2) % 3 === 0; break;
        case 'checker': sec = (Math.floor((dx + 16) / 3) + Math.floor((y - 20) / 3)) % 2 === 0; break;
        case 'band': sec = Math.abs(dx) < 3; break;
        case 'yoke': sec = y < 23; break;
        case 'diagonal': sec = dx + (y - 25) * 1.2 > 0; break;
        case 'zigzag': sec = Math.abs(y - 25 - (Math.abs(((dx + 16) / 2) % 2 - 1) - 0.5) * 2.4) < 0.9; break;
      }
      const r = sec ? J2 : J1;
      let f = -u * 0.9 + 0.15 - t * 0.3;
      if (Math.abs(u) > 0.86) f -= 0.6; // rounded shoulder edge
      set(x, y, shade(r, f));
    }
  }
  // collar: a V in the secondary colour
  for (let y = 20; y < 25; y++) {
    const w = 3.6 - (y - 20) * 0.75;
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - cx);
      if (dx < w + 1.1 && dx >= w - 0.1) set(x, y, J2[y < 22 ? 2 : 1]);
    }
  }

  // ---------------------------------------------------------------- neck
  for (let y = 16; y < 23; y++)
    for (let x = 12; x < 20; x++) {
      const dx = x + 0.5 - cx;
      const w = y > 20 ? 3.4 - (y - 21) * 0.9 : 3.4;
      if (Math.abs(dx) > w) continue;
      set(x, y, y < 18 ? SK[1] : shade(SK, -dx / 6 + 0.1));
    }

  // ---------------------------------------------------------------- hair behind the head
  const hy = 10.5; // head centre
  const st = look.hairStyle;
  if (st === 2) {
    // afro: a big round mass behind the head
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x + 0.5 - cx) / 9.4, (y + 0.5 - 8.2) / 8.6);
        if (d < 1) set(x, y, shade(HR, -(x - cx) / 9 + (8 - y) / 12 + ((x * 7 + y * 3) % 5 === 0 ? 0.6 : 0)));
      }
  }
  if (st === 5) {
    // long hair: a rounded mass around the head that falls to the shoulders
    for (let y = 1; y < 22; y++)
      for (let x = 0; x < W; x++) {
        const dx = Math.abs(x + 0.5 - cx), dy = y + 0.5 - hy;
        const crown = dy < 2 && (dx / 7.3) ** 2 + ((dy + 0.6) / 8.3) ** 2 < 1;
        const sides = dy >= 0 && dy < 10 && dx > 4.4 && dx < 7.3 - Math.max(0, dy - 5) * 0.55;
        if (crown || sides) set(x, y, shade(HR, -(x - cx) / 7 - 0.1 - (dy > 6 ? 0.45 : 0)));
      }
  }

  if (st === 10) {
    // dreads: hanging locks around the head down to the shoulders
    for (let y = 2; y < 24; y++)
      for (let x = 0; x < W; x++) {
        const dx = Math.abs(x + 0.5 - cx), dy = y + 0.5 - hy;
        const crown = dy < 2 && (dx / 7.4) ** 2 + ((dy + 0.6) / 8.4) ** 2 < 1;
        const locks = dy >= 0 && dy < 12 && dx > 4.6 && dx < 8 && x % 2 === 0;
        if (crown || locks) set(x, y, shade(HR, -(x - cx) / 7 - 0.1 - (dy > 6 ? 0.4 : 0) + (y % 3 === 0 ? 0.4 : 0)));
      }
  }

  // ---------------------------------------------------------------- ears + head
  for (const ex of [cx - 6.6, cx + 6.6]) {
    for (let y = 9; y < 14; y++)
      for (let x = Math.floor(ex - 1.4); x <= Math.ceil(ex + 1.4); x++) {
        if (Math.hypot(x + 0.5 - ex, (y + 0.5 - 11.4) * 0.7) < 1.45) set(x, y, ex < cx ? SK[2] : SK[1]);
      }
  }
  const fs = look.face ?? 0;
  const inHead = (x: number, y: number) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - hy;
    let rx = 6.1, ry = 7.1, jaw = 0.55, from = 2;
    if (fs === 1) { rx = 6.6; jaw = 0.25; ry = 7; } // round
    else if (fs === 2) { rx = 6.4; jaw = 1.1; from = 4.4; ry = 7.2; } // square jaw
    else if (fs === 3) { rx = 5.6; ry = 7.7; jaw = 0.45; } // long
    else if (fs === 4) { rx = 6.3; jaw = 0.95; from = 1; } // heart / pointed chin
    if (dy > from) rx -= (dy - from) * jaw;
    if (fs === 2 && dy > 0 && dy < 5.6) return Math.abs(dx) < rx && dy < 6.6;
    return rx > 0 && (dx / rx) ** 2 + (dy / ry) ** 2 < 1;
  };
  for (let y = 2; y < 19; y++)
    for (let x = 0; x < W; x++) {
      if (!inHead(x, y)) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - hy;
      let f = -dx / 9 - dy / 16 + 0.1;
      if (dx > 4.4) f -= 0.45;
      if (dx < -4.6) f -= 0.15;
      if (dy > 5.6) f -= 0.4; // under the chin
      set(x, y, shade(SK, f));
    }

  // ---------------------------------------------------------------- face
  const eyeY = 11;
  for (const s of [-1, 1]) {
    const ex = Math.round(cx + s * 2.6 - 0.5);
    // eye white + pupil looking at the viewer
    set(ex - 1, eyeY, WHITE);
    set(ex + 1, eyeY, WHITE);
    set(ex, eyeY, EYE);
    set(ex + (s < 0 ? 0 : 0), eyeY + 1, mix(SK[1], EYE, 0.25));
    // brow
    for (let i = -1; i <= 1; i++) set(ex + i, eyeY - 2, mix(HR[0], SK[1], 0.25));
  }
  // nose
  set(Math.round(cx - 0.5), 13, SK[1]);
  set(Math.round(cx + 0.5), 13, SK[1]);
  set(Math.round(cx + 0.5), 12, SK[2]);
  set(Math.round(cx - 0.5), 12, SK[3]);
  // mouth
  for (let x = Math.round(cx - 2); x <= Math.round(cx + 1); x++) set(x, 15, mix(SK[0], [120, 40, 40], 0.4));
  set(Math.round(cx - 2) , 15, SK[1]);
  set(Math.round(cx + 1), 15, SK[1]);
  // cheek highlight
  set(Math.round(cx - 4), 13, SK[3]);

  // ---------------------------------------------------------------- beard
  if (look.beard) {
    for (let y = 12; y < 19; y++)
      for (let x = 0; x < W; x++) {
        if (!inHead(x, y)) continue;
        const dx = Math.abs(x + 0.5 - cx);
        const mouth = y === 15 && dx < 2.2;
        const cheek = y < 14 && dx < 4.6;
        if (mouth || cheek) continue;
        if (((x + y) & 1) === 0 && y === 12) continue;
        set(x, y, shade(HR, -(x - cx) / 6 - 0.2));
      }
  }

  // ---------------------------------------------------------------- hair on top
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - hy;
      const head = inHead(x, y);
      const edge = Math.hypot(dx / 6.6, dy / 7.6) < 1; // slightly outside the head
      let hair = false;
      switch (st) {
        case 0: hair = edge && (dy < -3.4 + (dx > 1.2 ? 0.8 : 0) || (Math.abs(dx) > 5 && dy < -0.5)); break;
        case 1: hair = head && dy < -3.9 && ((x + y) % 3 !== 0 || dy < -5); break;
        case 2: hair = edge && dy < -2.6; break;
        case 3: hair = (Math.abs(dx) < 1.7 && dy < -3 && dy > -10.5) || (head && dy < -4.4 && ((x + y) & 1) === 0); break;
        case 4: hair = false; break;
        case 7: hair = (edge && dy < -3.4 + (dx > 1.2 ? 0.8 : 0)) || Math.hypot(dx, dy + 9.4) < 2.7; break;
        case 8: hair = Math.hypot(dx / 7.5, dy / 8.7) < 1 && dy < -2.6 && ((x * 3 + y * 5) % 4 !== 0 || dy < -5); break;
        case 9: hair = (edge && (dy < -3.4 || (Math.abs(dx) > 5 && dy < 1))) || (head && dy < -1.4 - Math.max(0, dx) * 0.35 && dx < 3.5); break;
        case 10: hair = edge && (dy < -3.2 || (Math.abs(dx) > 4.8 && dy < 4)) && (x % 2 === 0 || dy < -4.5); break;
        case 11: hair = (Math.abs(dx) < 6.2 && dy < -3.3 && dy > -10.2) || (edge && Math.abs(dx) > 5 && dy < -0.5); break;
        case 5: hair = edge && (dy < -3.2 || (Math.abs(dx) > 4.8 && dy < 3)); break;
        case 6: {
          if (edge && dy < -3.4) hair = true;
          else if (dy < -3.4 && dy > -11) {
            const k = ((dx + 8) / 3.2) % 1;
            hair = Math.abs(dx) < 6.5 && Math.abs(k - 0.5) * 2 < (dy + 11) / 7.6;
          }
          break;
        }
      }
      if (hair) set(x, y, shade(HR, -dx / 5 - dy / 10 + ((x * 5 + y * 3) % 7 === 0 ? 0.5 : 0) - 0.2));
    }
  if (st === 4) {
    // bald shine
    set(Math.round(cx - 2.5), 5, SK[3]);
    set(Math.round(cx - 1.5), 4, mix(SK[3], WHITE, 0.4));
  }

  // ---------------------------------------------------------------- outline + raster
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let col = get(x, y);
      if (!col) {
        if (get(x - 1, y) || get(x + 1, y) || get(x, y - 1) || (y < H - 1 && get(x, y + 1))) col = OUTLINE;
        else continue;
      }
      const i = (y * W + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}
