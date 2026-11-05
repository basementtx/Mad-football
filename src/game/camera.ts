import { clamp, damp, sign } from '../engine/math';
import type { Pitch } from './entities';

/** Pixels per meter on the virtual (low-res) framebuffer. */
export const PPM = 15;
/** Ground y squash (tilted broadcast angle): 1 m of depth = 12 px. */
export const YS = 0.75;

/**
 * Pixel-perfect tilted top-down camera. All outputs are integer pixel coordinates
 * on the virtual framebuffer so sprites never shimmer.
 */
export class Camera {
  x = 0;
  y = 0;
  readonly s = PPM;
  readonly ys = YS;
  W = 1;
  H = 1;
  ox = 0;
  oy = 0;
  private bx = 0;
  private by = 0;

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
    this.snap();
  }

  private snap() {
    this.bx = Math.round(this.W / 2 - this.x * this.s);
    this.by = Math.round(this.H / 2 - this.y * this.s * this.ys);
  }

  /** Integer offset of world origin on screen (useful for blitting prerendered layers). */
  get originX() {
    return this.bx + this.ox;
  }
  get originY() {
    return this.by + this.oy;
  }

  sx(x: number) {
    return Math.round(x * this.s) + this.bx + this.ox;
  }
  sy(y: number, z = 0) {
    return Math.round(y * this.s * this.ys - z * this.s) + this.by + this.oy;
  }
  /** Tall objects at the ends (goals) lean outward a little for depth. */
  sxz(x: number, z: number) {
    return this.sx(x) + Math.round(z * this.s * 0.3 * sign(x));
  }

  follow(tx: number, ty: number, dt: number, P: Pitch, speed = 4.5) {
    this.x = damp(this.x, tx, speed, dt);
    this.y = damp(this.y, ty, speed, dt);
    const ex = P.hw + P.margin + 3.5;
    const eyTop = P.hh + P.margin + 4.5;
    const eyBot = P.hh + P.margin + 3;
    const halfW = this.W / 2 / this.s;
    const halfH = this.H / 2 / (this.s * this.ys);
    this.x = halfW >= ex ? 0 : clamp(this.x, -ex + halfW, ex - halfW);
    this.y = halfH * 2 >= eyTop + eyBot ? (eyBot - eyTop) / 2 : clamp(this.y, -eyTop + halfH, eyBot - halfH);
    this.snap();
  }

  applyShake(amount: number, t: number) {
    const a = amount * amount * 7;
    this.ox = Math.round(Math.sin(t * 71) * a + Math.sin(t * 37) * a * 0.5);
    this.oy = Math.round(Math.cos(t * 63) * a + Math.sin(t * 29) * a * 0.5);
  }
}
