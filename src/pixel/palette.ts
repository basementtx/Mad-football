import { clamp, hexToRgb } from '../engine/math';

export type RGB = [number, number, number];

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** shift hue toward a target hue by `amt` degrees */
function hueToward(h: number, target: number, amt: number) {
  let d = target - h;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return h + clamp(d, -amt, amt);
}

/**
 * Pixel-art colour ramp with hue shifting: shadows go cooler (toward blue/purple),
 * highlights go warmer (toward yellow). [deep, dark, base, light]
 */
export function ramp(hex: string): RGB[] {
  const base = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(base);
  const deep = hslToRgb(hueToward(h, 250, 22), clamp(s * 0.9 + 0.08, 0, 1), clamp(l * 0.42, 0.05, 1));
  const dark = hslToRgb(hueToward(h, 250, 12), clamp(s + 0.05, 0, 1), clamp(l * 0.72, 0.08, 1));
  const light = hslToRgb(hueToward(h, 55, 10), clamp(s - 0.05, 0, 1), clamp(l + (1 - l) * 0.38, 0, 0.97));
  return [deep, dark, base, light];
}

export const OUTLINE: RGB = [18, 12, 28];

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

export const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

export function cssRamp(hex: string) {
  return ramp(hex).map((c) => css(c));
}
