import { rand, pick, TAU } from '../engine/math';
import { settings } from '../engine/storage';
import type { Camera } from './camera';

type PType = 'dust' | 'grass' | 'spark' | 'confetti' | 'fire' | 'smoke' | 'star' | 'ring';

interface Particle {
  type: PType;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number;
  color: string;
  rot: number; vr: number;
}

interface FloatText {
  x: number; y: number; z: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

export interface Banner {
  text: string;
  sub: string;
  color: string;
  life: number;
  max: number;
  big: boolean;
}

export class FX {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  banners: Banner[] = [];
  shake = 0;
  flash = 0;
  flashColor = '#fff';
  timeScale = 1;
  private slowT = 0;
  private slowScale = 1;

  get max() {
    return settings.quality === 'high' ? 700 : 250;
  }

  clear() {
    this.particles.length = 0;
    this.texts.length = 0;
    this.banners.length = 0;
    this.shake = 0;
    this.flash = 0;
    this.slowT = 0;
    this.timeScale = 1;
  }

  slowmo(scale: number, dur: number) {
    this.slowScale = scale;
    this.slowT = dur;
  }

  addShake(a: number) {
    this.shake = Math.min(1.2, this.shake + a);
  }

  doFlash(a: number, color = '#fff') {
    this.flash = Math.max(this.flash, a);
    this.flashColor = color;
  }

  private add(p: Particle) {
    if (this.particles.length >= this.max) this.particles.shift();
    this.particles.push(p);
  }

  emit(type: PType, x: number, y: number, z: number, opts: Partial<Particle> & { n?: number; spread?: number; speed?: number; up?: number; colors?: string[] } = {}) {
    const n = Math.ceil((opts.n ?? 6) * (settings.quality === 'high' ? 1 : 0.5));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(0.3, 1) * (opts.speed ?? 2);
      const life = (opts.life ?? 0.6) * rand(0.7, 1.3);
      this.add({
        type,
        x: x + rand(-1, 1) * (opts.spread ?? 0.2),
        y: y + rand(-1, 1) * (opts.spread ?? 0.2),
        z,
        vx: Math.cos(a) * sp + (opts.vx ?? 0),
        vy: Math.sin(a) * sp + (opts.vy ?? 0),
        vz: rand(0.4, 1) * (opts.up ?? 1.5),
        life, max: life,
        size: (opts.size ?? 0.25) * rand(0.7, 1.3),
        color: opts.colors ? pick(opts.colors) : opts.color ?? '#fff',
        rot: rand(0, TAU),
        vr: rand(-10, 10),
      });
    }
  }

  dust(x: number, y: number, n = 6, vx = 0, vy = 0) {
    this.emit('dust', x, y, 0.05, { n, speed: 1.6, up: 0.8, life: 0.7, size: 0.35, color: 'rgba(215,200,160,0.55)', vx: vx * 0.3, vy: vy * 0.3 });
    this.emit('grass', x, y, 0.05, { n: Math.ceil(n * 0.8), speed: 2.5, up: 3.5, life: 0.6, size: 0.1, colors: ['#3ea84a', '#2f8b3a', '#5bc764'], vx: vx * 0.3, vy: vy * 0.3 });
  }

  impact(x: number, y: number, z: number) {
    this.emit('spark', x, y, z, { n: 10, speed: 7, up: 3, life: 0.35, size: 0.35, colors: ['#fff', '#ffe36e', '#ffb43a'] });
    this.emit('ring', x, y, z, { n: 1, speed: 0, up: 0, life: 0.35, size: 0.4, color: '#fff' });
    this.emit('star', x, y, z + 0.6, { n: 4, speed: 2.5, up: 4, life: 0.8, size: 0.35, color: '#ffe36e' });
  }

  confetti(x: number, y: number, colors: string[], n = 90) {
    this.emit('confetti', x, y, 2.5, { n, speed: 8, up: 9, life: 2.8, size: 0.28, colors, spread: 1.5 });
  }

  fireTrail(x: number, y: number, z: number) {
    this.emit('fire', x, y, z, { n: 3, speed: 1.2, up: 1.5, life: 0.4, size: 0.5, colors: ['#ffef8a', '#ffb02e', '#ff5a1f', '#ff2a1a'] });
    if (Math.random() < 0.4) this.emit('smoke', x, y, z + 0.2, { n: 1, speed: 0.6, up: 1.2, life: 0.9, size: 0.6, color: 'rgba(60,50,50,0.4)' });
  }

  text(x: number, y: number, z: number, text: string, color = '#fff', size = 1) {
    this.texts.push({ x, y, z, text, color, life: 1.3, max: 1.3, size });
    if (this.texts.length > 6) this.texts.shift();
  }

  banner(text: string, sub = '', color = '#fff', dur = 2, big = true) {
    this.banners = this.banners.filter((b) => b.big !== big);
    this.banners.push({ text, sub, color, life: dur, max: dur, big });
  }

  /** dtReal: unscaled delta */
  update(dt: number, dtReal: number) {
    if (this.slowT > 0) {
      this.slowT -= dtReal;
      this.timeScale = this.slowT > 0.25 ? this.slowScale : this.slowScale + (1 - this.slowScale) * (1 - this.slowT / 0.25);
      if (this.slowT <= 0) this.timeScale = 1;
    } else this.timeScale = 1;

    this.shake = Math.max(0, this.shake - dtReal * 2.2);
    this.flash = Math.max(0, this.flash - dtReal * 3);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const g = p.type === 'confetti' ? 3 : p.type === 'fire' || p.type === 'smoke' ? -1.5 : p.type === 'star' ? 6 : 14;
      p.vz -= g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const drag = p.type === 'confetti' ? 2.2 : p.type === 'dust' || p.type === 'smoke' ? 3 : 1.2;
      p.vx *= Math.exp(-drag * dt);
      p.vy *= Math.exp(-drag * dt);
      if (p.type === 'confetti') p.vz = Math.max(p.vz, -1.6);
      p.rot += p.vr * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.3;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dtReal;
      t.z += dtReal * 1.2;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.banners.length - 1; i >= 0; i--) {
      this.banners[i].life -= dtReal;
      if (this.banners[i].life <= 0) this.banners.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    const s = cam.s;
    for (const p of this.particles) {
      const sx = cam.sx(p.x), sy = cam.sy(p.y, p.z);
      const k = p.life / p.max;
      const sz = p.size * s;
      switch (p.type) {
        case 'dust':
        case 'smoke':
          ctx.globalAlpha = k * 0.9;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, sz * (1.6 - k * 0.8), 0, TAU);
          ctx.fill();
          break;
        case 'grass':
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.fillStyle = p.color;
          ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz * 1.6);
          break;
        case 'spark':
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1.5, sz * 0.25);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - p.vx * s * 0.04, sy - (p.vy * cam.ys - p.vz) * s * 0.04);
          ctx.stroke();
          break;
        case 'ring':
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * k + 1;
          ctx.beginPath();
          ctx.ellipse(sx, sy, sz * (1 + (1 - k) * 4), sz * (1 + (1 - k) * 4) * 0.7, 0, 0, TAU);
          ctx.stroke();
          break;
        case 'fire': {
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.arc(sx, sy, sz * (0.4 + k * 0.6), 0, TAU);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'confetti': {
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.rot * 1.7));
          ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
          ctx.restore();
          break;
        }
        case 'star': {
          ctx.globalAlpha = Math.min(1, k * 2);
          drawStar(ctx, sx, sy, sz * 0.6, p.rot, p.color);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;

    // floating texts
    for (const t of this.texts) {
      const k = t.life / t.max;
      const age = t.max - t.life;
      const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.6 : age < 0.3 ? 1.2 - ((age - 0.15) / 0.15) * 0.2 : 1;
      const sx = cam.sx(t.x), sy = cam.sy(t.y, t.z + 2.2);
      const fs = Math.max(14, s * 0.75 * t.size) * pop;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = `${fs}px "Russo One", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = fs * 0.18;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineJoin = 'round';
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.08);
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * TAU - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.15);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.stroke();
  ctx.restore();
}
