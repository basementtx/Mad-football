/**
 * Dynamic pitch props (simulation side, no DOM):
 *  - ground wear events (slides, divots from hard kicks, falls, sprint steps)
 *    that the renderer stamps permanently into the turf,
 *  - goal frame vibration when the ball or a player hits the woodwork, plus net bulges,
 *  - corner flags that wobble when brushed and snap off and fly when hit hard.
 */
import type { Pitch, Player, Ball } from './entities';
import { PHYS } from './entities';
import type { FX } from './fx';
import { rand } from '../engine/math';
import { audio } from '../engine/audio';

export type MarkKind = 'skid' | 'divot' | 'fall' | 'step' | 'scorch';

export interface GroundMark {
  kind: MarkKind;
  x: number;
  y: number;
  /** direction (unnormalised velocity is fine) */
  dx: number;
  dy: number;
  /** strength 0..1+ */
  s: number;
}

export interface CornerFlag {
  hx: number;
  hy: number;
  x: number;
  y: number;
  /** height of the pole centre while flying */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** pole angle from vertical in the screen plane (rad) */
  rot: number;
  vr: number;
  broken: boolean;
  /** intact flag: spring lean (rad) */
  wob: number;
  wobV: number;
  /** seconds since it snapped */
  age: number;
  cd: number;
}

export interface NetHit {
  y: number;
  z: number;
  amp: number;
}

export const FLAG_LEN = 1.35;

export class PitchProps {
  marks: GroundMark[] = [];
  /** vibration amplitude per goal (index 0 = left goal, side -1) */
  goalShake = [0, 0];
  /** time since the last hit per goal (drives the oscillation phase) */
  goalT = [9, 9];
  net: NetHit[] = [
    { y: 0, z: 1, amp: 0 },
    { y: 0, z: 1, amp: 0 },
  ];
  flags: CornerFlag[] = [];
  private postCd = new Map<Player, number>();

  constructor(private P: Pitch, private fx: FX) {
    this.reset();
  }

  /** Restore all corner flags (new kickoff). */
  reset() {
    const P = this.P;
    this.flags = [];
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        this.flags.push({ hx: sx * P.hw, hy: sy * P.hh, x: sx * P.hw, y: sy * P.hh, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, vr: 0, broken: false, wob: 0, wobV: 0, age: 0, cd: 0 });
  }

  mark(kind: MarkKind, x: number, y: number, dx: number, dy: number, s: number) {
    const P = this.P;
    if (Math.abs(x) > P.hw + P.margin || Math.abs(y) > P.hh + P.margin) return;
    this.marks.push({ kind, x, y, dx, dy, s });
    if (this.marks.length > 240) this.marks.splice(0, this.marks.length - 240);
  }

  /** Woodwork hit on goal side s (-1 | 1). */
  hitGoal(s: number, amp: number) {
    const i = s < 0 ? 0 : 1;
    this.goalShake[i] = Math.min(1.4, Math.max(this.goalShake[i] * 0.6, 0) + amp);
    this.goalT[i] = 0;
  }

  netHit(s: number, y: number, z: number, amp: number) {
    const n = this.net[s < 0 ? 0 : 1];
    if (amp < n.amp * 0.5) return;
    n.y = y;
    n.z = z;
    n.amp = Math.min(1.2, amp);
    this.hitGoal(s, amp * 0.25);
  }

  update(dt: number, players: Player[], ball: Ball) {
    for (let i = 0; i < 2; i++) {
      this.goalShake[i] *= Math.exp(-2.4 * dt);
      this.goalT[i] += dt;
      this.net[i].amp *= Math.exp(-3.2 * dt);
    }
    this.playersVsPosts(dt, players);
    for (const f of this.flags) this.updateFlag(f, dt, players, ball);
  }

  private playersVsPosts(dt: number, players: Player[]) {
    const P = this.P;
    const R = PHYS.playerR + 0.1;
    for (const [p, t] of this.postCd) {
      if (t - dt <= 0) this.postCd.delete(p);
      else this.postCd.set(p, t - dt);
    }
    for (const p of players) {
      if (p.z > P.goalHeight) continue;
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          const px = sx * P.hw, py = sy * P.goalHalf;
          const dx = p.x - px, dy = p.y - py;
          const d = Math.hypot(dx, dy);
          if (d >= R || d < 1e-4) continue;
          const ux = dx / d, uy = dy / d;
          const vn = p.vx * ux + p.vy * uy;
          p.x = px + ux * R;
          p.y = py + uy * R;
          if (vn < 0) {
            p.vx -= 1.4 * vn * ux;
            p.vy -= 1.4 * vn * uy;
            const hard = -vn;
            if (hard > 4 && !this.postCd.has(p)) {
              this.postCd.set(p, 0.5);
              this.hitGoal(sx, Math.min(1.2, hard / 11));
              this.fx.addShake(Math.min(0.35, hard / 30));
              audio.post();
            }
          }
        }
    }
  }

  private updateFlag(f: CornerFlag, dt: number, players: Player[], ball: Ball) {
    const P = this.P;
    f.cd = Math.max(0, f.cd - dt);
    if (!f.broken) {
      // spring back to upright
      f.wobV += (-90 * f.wob - 7 * f.wobV) * dt;
      f.wob += f.wobV * dt;
      for (const p of players) {
        const dx = f.hx - p.x, dy = f.hy - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.6 || p.z > 1.2) continue;
        const sp = Math.hypot(p.vx, p.vy);
        const violent = p.state === 'slide' || ((p.state === 'down' || p.state === 'dive') && sp > 3.5) || sp > 8.2;
        if (violent && f.cd <= 0) {
          this.snap(f, p.vx * rand(0.9, 1.25), p.vy * rand(0.9, 1.25), rand(4.5, 7.5));
          return;
        }
        if (sp > 1.5 && f.cd <= 0) {
          f.wobV += (p.vx >= 0 ? 1 : -1) * Math.min(9, sp * 1.4);
          f.cd = 0.25;
        }
      }
      const bd = Math.hypot(ball.x - f.hx, ball.y - f.hy);
      if (bd < 0.38 && ball.z < FLAG_LEN && !ball.owner) {
        const sp = Math.hypot(ball.vx, ball.vy);
        if (sp > 13 && f.cd <= 0) {
          this.snap(f, ball.vx * 0.55, ball.vy * 0.55, rand(5, 8));
          ball.vx *= 0.7;
          ball.vy *= 0.7;
        } else if (sp > 2 && f.cd <= 0) {
          f.wobV += (ball.vx >= 0 ? 1 : -1) * Math.min(10, sp);
          f.cd = 0.2;
          // deflect the ball off the pole
          const ux = (ball.x - f.hx) / (bd || 1), uy = (ball.y - f.hy) / (bd || 1);
          const vn = ball.vx * ux + ball.vy * uy;
          if (vn < 0) {
            ball.vx -= 1.6 * vn * ux;
            ball.vy -= 1.6 * vn * uy;
          }
        }
      }
      return;
    }
    // ---- flying / lying debris
    f.age += dt;
    const onGround = f.z <= Math.abs(Math.cos(f.rot)) * FLAG_LEN * 0.5 + 0.04;
    if (!onGround || f.vz > 0) {
      f.vz -= PHYS.gravity * dt;
      f.vx *= Math.exp(-0.3 * dt);
      f.vy *= Math.exp(-0.3 * dt);
    } else {
      // friction + topple flat
      const k = Math.exp(-5 * dt);
      f.vx *= k;
      f.vy *= k;
      f.vr *= Math.exp(-6 * dt);
      const flat = f.rot >= 0 ? Math.PI / 2 : -Math.PI / 2;
      f.rot += (flat - wrap(f.rot)) * Math.min(1, dt * 6);
    }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.z += f.vz * dt;
    f.rot = wrap(f.rot + f.vr * dt);
    const minZ = Math.abs(Math.cos(f.rot)) * FLAG_LEN * 0.5 + 0.03;
    if (f.z < minZ) {
      f.z = minZ;
      if (f.vz < -2) {
        f.vz = -f.vz * 0.32;
        f.vr = f.vr * 0.55 + rand(-4, 4);
        f.vx *= 0.65;
        f.vy *= 0.65;
        this.fx.dust(f.x, f.y, 3);
        this.mark('step', f.x, f.y, f.vx, f.vy, 0.5);
      } else f.vz = 0;
    }
    const ex = P.hw + P.margin - 0.3, ey = P.hh + P.margin - 0.7;
    if (Math.abs(f.x) > ex) {
      f.x = Math.sign(f.x) * ex;
      f.vx = -f.vx * 0.4;
    }
    if (Math.abs(f.y) > ey) {
      f.y = Math.sign(f.y) * ey;
      f.vy = -f.vy * 0.4;
    }
    // debris lying on the grass gets kicked around
    if (f.z < 0.6) {
      for (const p of players) {
        const sp = Math.hypot(p.vx, p.vy);
        if (sp < 2.5 || Math.hypot(f.x - p.x, f.y - p.y) > 0.55) continue;
        if (f.cd > 0) continue;
        f.cd = 0.3;
        f.vx = p.vx * rand(0.6, 1.1);
        f.vy = p.vy * rand(0.6, 1.1);
        f.vz = rand(1.5, 3) + sp * 0.2;
        f.vr = rand(-14, 14);
      }
    }
  }

  private snap(f: CornerFlag, vx: number, vy: number, vz: number) {
    f.broken = true;
    f.age = 0;
    f.x = f.hx;
    f.y = f.hy;
    f.z = FLAG_LEN * 0.55;
    f.vx = vx;
    f.vy = vy;
    f.vz = vz;
    f.rot = 0;
    f.vr = (vx >= 0 ? 1 : -1) * rand(9, 18);
    f.cd = 0.4;
    this.fx.splinters(f.hx, f.hy, 0.3, vx, vy);
    this.fx.addShake(0.2);
    this.mark('divot', f.hx, f.hy, vx, vy, 0.7);
    audio.kick(0.9);
  }
}

function wrap(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
