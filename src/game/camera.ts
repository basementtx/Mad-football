import { clamp, damp } from '../engine/math';
import type { Pitch } from './entities';

/**
 * Tilted top-down camera. World units are meters. Ground y is squashed by `ys`
 * to fake a 3/4 broadcast angle; height (z) lifts things up on screen.
 */
export class Camera {
  x = 0;
  y = 0;
  s = 20;
  readonly ys = 0.78;
  W = 1;
  H = 1;
  zoom = 1;
  zoomFx = 1;
  ox = 0;
  oy = 0;

  resize(W: number, H: number, zoomSetting: number) {
    this.W = W;
    this.H = H;
    const base = Math.min(W / 31, H / (19 * this.ys));
    this.s = base * zoomSetting * this.zoom * this.zoomFx;
  }

  sx(x: number) {
    return (x - this.x) * this.s + this.W / 2 + this.ox;
  }
  sy(y: number, z = 0) {
    return ((y - this.y) * this.ys - z) * this.s + this.H / 2 + this.oy;
  }

  /** Perspective-aware x for tall objects (goals, boards): tops lean away from the view centre. */
  sxz(x: number, z: number) {
    const halfW = this.W / 2 / this.s;
    return this.sx(x) + z * this.s * 0.32 * ((x - this.x) / halfW);
  }

  follow(tx: number, ty: number, dt: number, P: Pitch, speed = 4.5) {
    this.x = damp(this.x, tx, speed, dt);
    this.y = damp(this.y, ty, speed, dt);
    // clamp so we don't show too much outside the stadium
    const ex = P.hw + P.margin + 4;
    const eyTop = P.hh + P.margin + 4;
    const eyBot = P.hh + P.margin + 3;
    const halfW = this.W / 2 / this.s;
    const halfH = this.H / 2 / (this.s * this.ys);
    this.x = halfW >= ex ? 0 : clamp(this.x, -ex + halfW, ex - halfW);
    this.y = halfH * 2 >= eyTop + eyBot ? (eyBot - eyTop) / 2 : clamp(this.y, -eyTop + halfH, eyBot - halfH);
  }

  applyShake(amount: number, t: number) {
    const a = amount * amount * this.s * 0.6;
    this.ox = Math.sin(t * 71) * a + Math.sin(t * 37) * a * 0.5;
    this.oy = Math.cos(t * 63) * a + Math.sin(t * 29) * a * 0.5;
  }
}
