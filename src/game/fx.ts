import { rand, pick, TAU } from '../engine/math';
import { settings } from '../engine/storage';
import type { Camera } from './camera';
import { drawText } from '../pixel/font';
import { ring, star } from '../pixel/props';

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
    for (const p of this.particles) {
      const sx = cam.sx(p.x), sy = cam.sy(p.y, p.z);
      const k = p.life / p.max;
      switch (p.type) {
        case 'dust':
        case 'smoke': {
          const sz = Math.max(1, Math.round(p.size * 8 * (0.5 + (1 - k) * 0.8)));
          ctx.fillStyle = p.type === 'dust' ? (k > 0.5 ? '#d8c9a0' : '#b7a57c') : k > 0.5 ? '#5a5260' : '#3c3644';
          ctx.globalAlpha = k > 0.35 ? 1 : 0.6;
          ctx.fillRect(sx - (sz >> 1), sy - (sz >> 1), sz, sz);
          break;
        }
        case 'grass':
          ctx.fillStyle = p.color;
          ctx.fillRect(sx, sy, 1, 2);
          break;
        case 'spark': {
          ctx.fillStyle = p.color;
          const len = Math.max(1, Math.round(k * 3));
          const dx = Math.sign(p.vx), dy = Math.sign(p.vy * cam.ys - p.vz);
          for (let i = 0; i < len; i++) ctx.fillRect(sx - dx * i, sy - dy * i, 1, 1);
          break;
        }
        case 'ring': {
          const r = Math.round(2 + (1 - k) * 10 * p.size);
          const img = ringSprite(r);
          ctx.globalAlpha = k > 0.5 ? 1 : 0.6;
          ctx.drawImage(img, sx - (img.width >> 1), sy - (img.height >> 1));
          break;
        }
        case 'fire': {
          const sz = k > 0.66 ? 3 : k > 0.33 ? 2 : 1;
          ctx.fillStyle = k > 0.7 ? '#fff3a0' : k > 0.45 ? '#ffb02e' : k > 0.2 ? '#ff5a1f' : '#9a2010';
          ctx.fillRect(sx - (sz >> 1), sy - (sz >> 1), sz, sz);
          break;
        }
        case 'confetti': {
          ctx.fillStyle = p.color;
          const flip = Math.floor(p.rot * 2) % 2 === 0;
          ctx.fillRect(sx, sy, flip ? 2 : 1, flip ? 1 : 2);
          break;
        }
        case 'star': {
          const st = star();
          ctx.globalAlpha = k > 0.3 ? 1 : 0.5;
          ctx.drawImage(st, sx - 3, sy - 3);
          break;
        }
      }
      ctx.globalAlpha = 1;
    }

    // floating texts
    for (const t of this.texts) {
      const age = t.max - t.life;
      const bounce = age < 0.12 ? -3 : age < 0.2 ? 1 : 0;
      const sx = cam.sx(t.x), sy = cam.sy(t.y, t.z + 2.6) + bounce;
      if (t.life < 0.25 && Math.floor(t.life * 20) % 2) continue; // blink out
      drawText(ctx, t.text, sx, sy, { color: t.color, scale: t.size >= 1.1 ? 2 : 1, align: 'center', outline: '#120c1c', thick: 1, shadow: null });
    }
  }
}

const ringCache = new Map<number, HTMLCanvasElement>();
function ringSprite(r: number) {
  let c = ringCache.get(r);
  if (!c) {
    c = ring(r, Math.max(1, Math.round(r * 0.6)), '#ffffff');
    ringCache.set(r, c);
  }
  return c;
}

