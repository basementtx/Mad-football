import { rand, pick, TAU } from '../engine/math';
import { settings } from '../engine/storage';
import type { Camera } from './camera';
import { drawText } from '../pixel/font';
import { star } from '../pixel/props';
import { vw, vh } from '../engine/gfx';

type PType = 'dust' | 'grass' | 'spark' | 'confetti' | 'fire' | 'smoke' | 'star' | 'ring' | 'pix' | 'rocket' | 'bolt' | 'coin' | 'vortex' | 'snow' | 'clod' | 'splinter';

interface Particle {
  type: PType;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number;
  color: string;
  rot: number; vr: number;
  /** gravity override */
  g?: number;
  /** vortex centre */
  cx?: number; cy?: number;
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
  private timers: { t: number; fn: () => void }[] = [];

  /** run fn after `t` seconds of game time */
  after(t: number, fn: () => void) {
    this.timers.push({ t, fn });
  }

  get max() {
    return settings.quality === 'high' ? 700 : 250;
  }

  clear() {
    this.particles.length = 0;
    this.timers.length = 0;
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
        g: opts.g,
      });
    }
  }

  dust(x: number, y: number, n = 6, vx = 0, vy = 0) {
    this.emit('dust', x, y, 0.05, { n, speed: 1.6, up: 0.8, life: 0.7, size: 0.35, color: 'rgba(215,200,160,0.55)', vx: vx * 0.3, vy: vy * 0.3 });
    this.emit('grass', x, y, 0.05, { n: Math.ceil(n * 0.8), speed: 2.5, up: 3.5, life: 0.6, size: 0.1, colors: ['#3ea84a', '#2f8b3a', '#5bc764'], vx: vx * 0.3, vy: vy * 0.3 });
  }

  /** Chunks of soil and torn grass thrown up by a hard kick or slide. */
  clods(x: number, y: number, dx: number, dy: number, n = 6) {
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l;
    this.emit('clod', x, y, 0.05, { n, speed: 2.2, up: 4.5, life: 1.1, size: 0.13, colors: ['#5b4327', '#6e5232', '#4a3620', '#7d6040'], vx: ux * 4, vy: uy * 4, g: 18 });
    this.emit('grass', x, y, 0.05, { n: Math.ceil(n * 1.2), speed: 2.6, up: 4, life: 0.8, size: 0.1, colors: ['#3ea84a', '#2f8b3a', '#5bc764', '#2a7a33'], vx: ux * 3, vy: uy * 3 });
  }

  /** Corner flag snapping: white/red splinters. */
  splinters(x: number, y: number, z: number, vx: number, vy: number) {
    this.emit('splinter', x, y, z + 0.4, { n: 9, speed: 3.5, up: 4, life: 1.0, size: 0.18, colors: ['#ffffff', '#e8e8e8', '#ff4a2a', '#ffd23f'], vx: vx * 0.35, vy: vy * 0.35, g: 16 });
    this.dust(x, y, 6, vx, vy);
  }

  impact(x: number, y: number, z: number) {
    this.emit('spark', x, y, z, { n: 10, speed: 7, up: 3, life: 0.35, size: 0.35, colors: ['#fff', '#ffe36e', '#ffb43a'] });
    this.emit('ring', x, y, z, { n: 1, speed: 0, up: 0, life: 0.35, size: 0.4, color: '#fff' });
    this.emit('star', x, y, z + 0.6, { n: 4, speed: 2.5, up: 4, life: 0.8, size: 0.35, color: '#ffe36e' });
  }

  confetti(x: number, y: number, colors: string[], n = 90) {
    this.emit('confetti', x, y, 2.5, { n, speed: 8, up: 9, life: 2.8, size: 0.28, colors, spread: 1.5 });
  }

  /** Power-shot trail by kind */
  powerTrail(kind: string, x: number, y: number, z: number) {
    switch (kind) {
      case 'ice':
        this.emit('pix', x, y, z, { n: 3, speed: 1, up: 0.6, life: 0.5, size: 0.25, colors: ['#ffffff', '#bfe8ff', '#5fc8ff'], g: 0 });
        if (Math.random() < 0.5) this.emit('snow', x, y, z + 0.3, { n: 1, speed: 1, up: 1, life: 0.8, size: 0.2, color: '#ffffff' });
        break;
      case 'thunder':
        this.emit('spark', x, y, z, { n: 4, speed: 6, up: 3, life: 0.25, colors: ['#ffffff', '#fff6a0', '#3bd9ff'] });
        this.emit('pix', x, y, z, { n: 2, speed: 0.4, up: 0, life: 0.3, size: 0.3, colors: ['#3bd9ff', '#ffffff'], g: 0 });
        break;
      case 'banana':
        this.emit('pix', x, y, z, { n: 3, speed: 0.6, up: 0.2, life: 0.5, size: 0.3, colors: ['#fff07a', '#ffd21f', '#ff9a1f'], g: 0 });
        break;
      default:
        this.fireTrail(x, y, z);
    }
  }

  /** Cosmetic ball trail by item id */
  ballTrail(id: string, x: number, y: number, z: number) {
    const hi = settings.quality === 'high';
    if (!hi && Math.random() < 0.5) return;
    switch (id) {
      case 'tr_fire': this.emit('fire', x, y, z, { n: 2, speed: 0.8, up: 1, life: 0.35, size: 0.4, colors: ['#ffef8a', '#ffb02e', '#ff5a1f'] }); break;
      case 'tr_sparkle': if (Math.random() < 0.6) this.emit('pix', x, y, z, { n: 1, speed: 0.8, up: 0.4, life: 0.6, size: 0.15, colors: ['#ffffff', '#fff3a0'], g: 0 }); break;
      case 'tr_smoke': this.emit('smoke', x, y, z, { n: 1, speed: 0.4, up: 0.6, life: 0.9, size: 0.45, color: '#777' }); break;
      case 'tr_rainbow': {
        const c = ['#ff3b30', '#ff9a1f', '#ffe14d', '#5ff0a4', '#3f8cff', '#b04cff'][Math.floor(performance.now() / 60) % 6];
        this.emit('pix', x, y, z, { n: 2, speed: 0.1, up: 0, life: 0.55, size: 0.3, color: c, g: 0 });
        break;
      }
      case 'tr_electric': this.emit('spark', x, y, z, { n: 2, speed: 5, up: 3, life: 0.2, colors: ['#ffffff', '#3bd9ff'] }); break;
      case 'tr_galaxy':
        this.emit('pix', x, y, z, { n: 2, speed: 0.5, up: 0.2, life: 0.7, size: 0.25, colors: ['#3a1a8a', '#8a5cff', '#d8b0ff'], g: 0 });
        if (Math.random() < 0.15) this.emit('star', x, y, z, { n: 1, speed: 0.5, up: 1, life: 0.5, size: 0.3, color: '#ffffff' });
        break;
      case 'tr_gold':
        this.emit('pix', x, y, z, { n: 2, speed: 0.4, up: 0.2, life: 0.6, size: 0.25, colors: ['#fff2a8', '#ffcc2a', '#c88a00'], g: 0 });
        if (Math.random() < 0.1) this.emit('coin', x, y, z, { n: 1, speed: 1, up: 3, life: 0.8, size: 0.3, color: '#ffcc2a' });
        break;
    }
  }

  /** Lightning strike at a ground point */
  bolt(x: number, y: number) {
    this.emit('bolt', x, y, 0, { n: 1, speed: 0, up: 0, life: 0.3, size: 1, color: '#ffffff', g: 0 });
    this.emit('spark', x, y, 0.3, { n: 10, speed: 6, up: 4, life: 0.4, colors: ['#ffffff', '#3bd9ff', '#fff6a0'] });
    this.doFlash(0.25, '#bfefff');
  }

  /** Rocket-League style goal explosion */
  goalExplosion(id: string, x: number, y: number, team: string[]) {
    this.addShake(0.6);
    switch (id) {
      case 'gx_fireworks': {
        this.confetti(x, y, team, 40);
        const cols = ['#ff3b30', '#ffe14d', '#5ff0a4', '#3f8cff', '#ff3fa4', '#ffffff'];
        for (let i = 0; i < 7; i++) {
          this.after(i * 0.12, () => {
            const c = pick(cols);
            const rx = x + rand(-5, 5), ry = y + rand(-6, 6);
            this.emit('rocket', rx, ry, 0.2, { n: 1, speed: 0.5, up: 9, life: rand(0.55, 0.8), size: 0.3, color: c, g: 6 });
            this.after(0.6, () => this.emit('spark', rx, ry, 4.5, { n: 26, speed: 9, up: 4, life: 0.8, colors: [c, '#ffffff'] }));
          });
        }
        break;
      }
      case 'gx_pixelrain': {
        const cols = ['#ff3b30', '#ff9a1f', '#ffe14d', '#5ff0a4', '#3f8cff', '#b04cff', '#ff3fa4'];
        for (let i = 0; i < 18; i++) this.after(i * 0.05, () => {
          for (let k = 0; k < 8; k++) this.emit('pix', x + rand(-8, 8), y + rand(-8, 8), rand(6, 10), { n: 1, speed: 0.2, up: 0, life: 1.6, size: 0.3, color: pick(cols), g: 7 });
        });
        this.emit('ring', x, y, 0.1, { n: 1, life: 0.6, size: 2, color: '#ffffff' });
        break;
      }
      case 'gx_ice': {
        this.doFlash(0.6, '#bfe8ff');
        this.emit('spark', x, y, 1, { n: 40, speed: 12, up: 6, life: 0.8, colors: ['#ffffff', '#bfe8ff', '#5fc8ff'] });
        this.emit('pix', x, y, 1, { n: 40, speed: 7, up: 6, life: 1.2, size: 0.3, colors: ['#ffffff', '#bfe8ff', '#8ad8ff'] });
        for (let i = 0; i < 20; i++) this.after(i * 0.06, () => this.emit('snow', x + rand(-9, 9), y + rand(-9, 9), 7, { n: 3, speed: 0.6, up: 0, life: 2.2, size: 0.2, color: '#ffffff' }));
        this.emit('ring', x, y, 0.1, { n: 1, life: 0.7, size: 2.5, color: '#bfe8ff' });
        break;
      }
      case 'gx_lightning': {
        for (let i = 0; i < 6; i++) this.after(i * 0.13, () => this.bolt(x + rand(-4, 4), y + rand(-5, 5)));
        this.emit('spark', x, y, 1, { n: 30, speed: 10, up: 5, life: 0.6, colors: ['#ffffff', '#fff6a0', '#3bd9ff'] });
        break;
      }
      case 'gx_supernova': {
        this.doFlash(1, '#ffffff');
        this.addShake(0.6);
        this.slowmo(0.2, 1.4);
        for (let i = 0; i < 4; i++) this.after(i * 0.12, () => this.emit('ring', x, y, 0.1, { n: 1, life: 0.9, size: 3 + i, color: i % 2 ? '#ffe14d' : '#ffffff' }));
        this.emit('spark', x, y, 1, { n: 60, speed: 18, up: 6, life: 0.8, colors: ['#ffffff', '#ffe14d', '#ff9a1f'] });
        this.emit('pix', x, y, 1, { n: 50, speed: 10, up: 8, life: 1.3, size: 0.35, colors: ['#ffffff', '#fff3a0', ...team] });
        break;
      }
      case 'gx_dragon': {
        for (let i = 0; i < 40; i++) this.after(i * 0.025, () => {
          const a = i * 0.55, r = 1.5 + i * 0.05;
          this.emit('fire', x + Math.cos(a) * r, y + Math.sin(a) * r, i * 0.15, { n: 4, speed: 0.6, up: 2.5, life: 0.7, size: 0.7, colors: ['#ffef8a', '#ffb02e', '#ff5a1f', '#c21a0a'] });
        });
        this.after(1.0, () => {
          this.emit('fire', x, y, 1, { n: 50, speed: 9, up: 6, life: 0.7, size: 0.7, colors: ['#ffef8a', '#ffb02e', '#ff5a1f'] });
          this.emit('smoke', x, y, 1, { n: 14, speed: 3, up: 2, life: 1.4, size: 0.9, color: '#444' });
          this.doFlash(0.4, '#ff8a3a');
          this.addShake(0.6);
        });
        break;
      }
      case 'gx_blackhole': {
        this.slowmo(0.4, 1.6);
        for (let i = 0; i < 70; i++) {
          const a = rand(0, TAU), r = rand(4, 9);
          this.add({ type: 'vortex', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: rand(0, 3), vx: 0, vy: 0, vz: 0, life: 0.9, max: 0.9, size: 0.3, color: pick(['#b04cff', '#3a1a8a', '#ffffff', '#ff3fa4']), rot: a, vr: r, cx: x, cy: y, g: 0 });
        }
        this.after(0.9, () => {
          this.doFlash(0.9, '#d8b0ff');
          this.addShake(1);
          for (let i = 0; i < 3; i++) this.emit('ring', x, y, 0.1, { n: 1, life: 0.8, size: 3 + i * 1.5, color: i ? '#b04cff' : '#ffffff' });
          this.emit('spark', x, y, 1, { n: 60, speed: 16, up: 6, life: 0.9, colors: ['#ffffff', '#d8b0ff', '#b04cff', '#ff3fa4'] });
          this.emit('pix', x, y, 1, { n: 40, speed: 9, up: 7, life: 1.4, size: 0.35, colors: ['#3a1a8a', '#b04cff', '#ffffff'] });
        });
        break;
      }
      case 'gx_goldrush': {
        this.doFlash(0.4, '#ffe14d');
        for (let i = 0; i < 24; i++) this.after(i * 0.05, () => this.emit('coin', x, y, 1.5, { n: 4, speed: 6, up: 10, life: 2.2, size: 0.3, color: '#ffcc2a' }));
        this.emit('pix', x, y, 1, { n: 40, speed: 8, up: 6, life: 1.2, size: 0.25, colors: ['#ffffff', '#fff2a8', '#ffcc2a'] });
        break;
      }
      default:
        this.confetti(x, y, team);
    }
  }

  fireTrail(x: number, y: number, z: number) {
    this.emit('fire', x, y, z, { n: 3, speed: 1.2, up: 1.5, life: 0.4, size: 0.5, colors: ['#ffef8a', '#ffb02e', '#ff5a1f', '#ff2a1a'] });
    if (Math.random() < 0.4) this.emit('smoke', x, y, z + 0.2, { n: 1, speed: 0.6, up: 1.2, life: 0.9, size: 0.6, color: 'rgba(60,50,50,0.4)' });
  }

  text(x: number, y: number, z: number, text: string, color = '#fff', size = 1) {
    // stagger texts that pop at the same moment so they don't stack
    const n = this.texts.filter((t) => t.max - t.life < 0.3).length;
    this.texts.push({ x: x + (n % 2 ? 1 : -1) * n * 0.9, y, z: z + n * 0.7, text, color, life: 1.3, max: 1.3, size });
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
      if (p.type === 'vortex') {
        p.rot += dt * 7;
        p.vr *= Math.exp(-3.2 * dt);
        p.x = p.cx! + Math.cos(p.rot) * p.vr;
        p.y = p.cy! + Math.sin(p.rot) * p.vr;
        p.z *= Math.exp(-2 * dt);
        continue;
      }
      const g = p.g ?? (p.type === 'confetti' ? 3 : p.type === 'fire' || p.type === 'smoke' ? -1.5 : p.type === 'star' ? 6 : p.type === 'snow' ? 1.2 : 14);
      p.vz -= g * dt;
      if (p.type === 'snow') p.vz = Math.max(p.vz, -1.4);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const drag = p.type === 'confetti' ? 2.2 : p.type === 'dust' || p.type === 'smoke' ? 3 : p.type === 'clod' ? 0.6 : 1.2;
      p.vx *= Math.exp(-drag * dt);
      p.vy *= Math.exp(-drag * dt);
      if (p.type === 'confetti') p.vz = Math.max(p.vz, -1.6);
      p.rot += p.vr * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= p.type === 'clod' ? -0.25 : -0.3;
        p.vx *= p.type === 'clod' ? 0.35 : 0.6;
        p.vy *= p.type === 'clod' ? 0.35 : 0.6;
        if (p.type === 'clod' || p.type === 'splinter') p.vr *= 0.3;
      }
    }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        this.timers.splice(i, 1);
        tm.fn();
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
    const TAU_ = Math.PI * 2;
    for (const p of this.particles) {
      const sx = cam.sx(p.x), sy = cam.sy(p.y, p.z);
      const k = p.life / p.max;
      switch (p.type) {
        case 'dust':
        case 'smoke': {
          const r = Math.max(0.8, p.size * 5 * (0.5 + (1 - k) * 1.1));
          ctx.globalAlpha = (p.type === 'dust' ? 0.42 : 0.5) * Math.min(1, k * 1.6);
          ctx.fillStyle = p.type === 'dust' ? '#d9caa2' : '#4a4450';
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, TAU_);
          ctx.fill();
          break;
        }
        case 'grass': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 0.7;
          ctx.lineCap = 'round';
          const a = p.rot;
          ctx.beginPath();
          ctx.moveTo(sx - Math.cos(a) * 1.1, sy - Math.sin(a) * 1.1);
          ctx.lineTo(sx + Math.cos(a) * 1.1, sy + Math.sin(a) * 1.1);
          ctx.stroke();
          break;
        }
        case 'clod': {
          // shadow on the grass + tumbling chunk
          const r = p.size * 9;
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#0b1a10';
          ctx.beginPath();
          ctx.ellipse(cam.sx(p.x), cam.sy(p.y), r, r * 0.45, 0, 0, TAU_);
          ctx.fill();
          ctx.globalAlpha = k < 0.2 ? k / 0.2 : 1;
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(sx, sy - r * 0.5);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(-r, -r * 0.4);
          ctx.lineTo(-r * 0.2, -r);
          ctx.lineTo(r, -r * 0.3);
          ctx.lineTo(r * 0.6, r * 0.8);
          ctx.lineTo(-r * 0.7, r * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#3ea84a';
          ctx.fillRect(-r * 0.3, -r * 1.1, r * 0.25, r * 0.6);
          ctx.restore();
          break;
        }
        case 'splinter': {
          ctx.globalAlpha = k < 0.25 ? k / 0.25 : 1;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 0.9;
          ctx.lineCap = 'round';
          const a = p.rot, l = p.size * 10;
          ctx.beginPath();
          ctx.moveTo(sx - Math.cos(a) * l, sy - Math.sin(a) * l);
          ctx.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l);
          ctx.stroke();
          break;
        }
        case 'spark': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = p.color;
          ctx.lineCap = 'round';
          ctx.lineWidth = 0.6 + k * 0.9;
          const tl = 0.035;
          const ex = cam.sx(p.x - p.vx * tl), ey = cam.sy(p.y - p.vy * tl, p.z - p.vz * tl);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ring': {
          const r = 2 + (1 - k) * 10 * p.size;
          ctx.globalAlpha = Math.min(1, k * 1.5);
          ctx.strokeStyle = p.color.startsWith('#') || p.color.startsWith('rgba') ? p.color : '#fff';
          ctx.lineWidth = 0.6 + k * 1.6;
          ctx.beginPath();
          ctx.ellipse(sx, sy, r, r * 0.6, 0, 0, TAU_);
          ctx.stroke();
          break;
        }
        case 'fire': {
          const r = p.size * 3.2 * (0.35 + k * 0.75);
          ctx.globalCompositeOperation = 'lighter';
          const col = k > 0.7 ? '255,240,170' : k > 0.45 ? '255,176,46' : k > 0.2 ? '255,90,31' : '154,32,16';
          const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          gr.addColorStop(0, `rgba(${col},0.95)`);
          gr.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, TAU_);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'confetti': {
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot * 0.5);
          ctx.scale(1, Math.cos(p.rot * 2));
          ctx.fillRect(-1.1, -0.6, 2.2, 1.2);
          ctx.restore();
          break;
        }
        case 'pix':
        case 'snow': {
          const r = Math.max(0.5, p.size * 4 * (p.type === 'pix' ? 0.4 + k * 0.6 : 1));
          ctx.globalAlpha = k > 0.3 ? 1 : k / 0.3;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, TAU_);
          ctx.fill();
          break;
        }
        case 'rocket': {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx - 1, sy - 1, 2, 3);
          ctx.fillStyle = p.color;
          ctx.fillRect(sx - 1, sy + 2, 2, 2);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(255,176,46,0.85)';
          ctx.beginPath();
          ctx.ellipse(sx, sy + 5, 0.9, 2 + Math.random() * 2, 0, 0, TAU_);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'coin': {
          const w = Math.abs(Math.cos(p.rot)) * 2.4 + 0.4;
          ctx.fillStyle = '#7a4a00';
          ctx.beginPath();
          ctx.ellipse(sx, sy, w + 0.6, 3, 0, 0, TAU_);
          ctx.fill();
          ctx.fillStyle = '#ffcc2a';
          ctx.beginPath();
          ctx.ellipse(sx, sy, w, 2.4, 0, 0, TAU_);
          ctx.fill();
          ctx.fillStyle = '#fff2a8';
          ctx.fillRect(sx - w * 0.5, sy - 1.4, Math.max(0.4, w * 0.4), 1);
          break;
        }
        case 'vortex': {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.1, 0, TAU_);
          ctx.fill();
          break;
        }
        case 'bolt': {
          // jagged lightning from the sky to the ground point
          const seed = Math.floor(p.rot * 1000);
          const pts: [number, number][] = [[sx + 10, sy - 90]];
          for (let i = 1; i <= 13; i++) pts.push([sx + (((seed * (i + 3) * 7919) % 13) - 6) * (1 - i / 14) * 0.9, sy - 90 + i * 7]);
          pts.push([sx, sy]);
          ctx.globalAlpha = k > 0.5 ? 1 : 0.6;
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineJoin = 'round';
          for (const [w, c] of [[5, 'rgba(59,217,255,0.35)'], [2.4, '#3bd9ff'], [1, '#ffffff']] as const) {
            ctx.strokeStyle = c;
            ctx.lineWidth = w;
            ctx.beginPath();
            pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
          }
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'star': {
          const st = star();
          ctx.globalAlpha = k > 0.3 ? 1 : k / 0.3;
          ctx.drawImage(st, sx - vw(st) / 2, sy - vh(st) / 2);
          break;
        }
      }
      ctx.globalAlpha = 1;
    }

    // floating texts
    for (const t of this.texts) {
      const age = t.max - t.life;
      const pop = age < 0.12 ? 1 + (0.12 - age) * 4 : 1;
      const sx = cam.sx(t.x), sy = cam.sy(t.y, t.z + 2.6) - (age < 0.12 ? 3 : 0);
      ctx.globalAlpha = Math.min(1, t.life / 0.3);
      const sc = t.size >= 1.1 ? 1.6 : 1.05;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(pop, pop);
      drawText(ctx, t.text, 0, 0, { color: t.color, scale: sc, align: 'center', outline: '#120c1c', thick: 1.1, shadow: 'rgba(0,0,0,0.35)' });
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
}
