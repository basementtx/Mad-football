import { rand, pick, TAU } from '../engine/math';
import { settings } from '../engine/storage';
import type { Camera } from './camera';
import { drawText } from '../pixel/font';
import { ring, star } from '../pixel/props';

type PType = 'dust' | 'grass' | 'spark' | 'confetti' | 'fire' | 'smoke' | 'star' | 'ring' | 'pix' | 'rocket' | 'bolt' | 'coin' | 'vortex' | 'snow' | 'heart' | 'bubble' | 'meteor';

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

  impact(x: number, y: number, z: number) {
    this.emit('spark', x, y, z, { n: 10, speed: 7, up: 3, life: 0.35, size: 0.35, colors: ['#fff', '#ffe36e', '#ffb43a'] });
    this.emit('ring', x, y, z, { n: 1, speed: 0, up: 0, life: 0.35, size: 0.4, color: '#fff' });
    this.emit('star', x, y, z + 0.6, { n: 4, speed: 2.5, up: 4, life: 0.8, size: 0.35, color: '#ffe36e' });
  }

  confetti(x: number, y: number, colors: string[], n = 90) {
    this.emit('confetti', x, y, 2.5, { n, speed: 8, up: 9, life: 2.8, size: 0.28, colors, spread: 1.5 });
  }

  /** Power-shot trail by kind */
  powerTrail(kind: string, x: number, y: number, z: number, tier: string[] | null = null) {
    // higher item tiers (skins) add their own coloured aura
    if (tier) {
      this.emit('pix', x, y, z, { n: 2, speed: 1.4, up: 0.6, life: 0.45, size: 0.3, colors: tier, g: 0 });
      if (Math.random() < 0.25) this.emit('star', x, y, z + 0.2, { n: 1, speed: 1, up: 1.5, life: 0.4, size: 0.3, color: tier[0] });
    }
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
      case 'tr_ice':
        this.emit('pix', x, y, z, { n: 2, speed: 0.5, up: 0.2, life: 0.6, size: 0.25, colors: ['#ffffff', '#bfe8ff', '#5fc8ff'], g: 0 });
        if (Math.random() < 0.2) this.emit('snow', x, y, z + 0.2, { n: 1, speed: 0.6, up: 0.5, life: 0.9, size: 0.18, color: '#ffffff' });
        break;
      case 'tr_hearts':
        if (Math.random() < 0.35) this.emit('heart', x, y, z, { n: 1, speed: 0.4, up: 1.2, life: 0.8, size: 0.3, colors: ['#ff3fa4', '#ff7ac0', '#ff3b5a'], g: -1 });
        this.emit('pix', x, y, z, { n: 1, speed: 0.2, up: 0, life: 0.4, size: 0.2, color: '#ffb3d1', g: 0 });
        break;
      case 'tr_toxic':
        if (Math.random() < 0.5) this.emit('bubble', x, y, z, { n: 1, speed: 0.4, up: 0.8, life: 0.8, size: 0.3, colors: ['#7aff3a', '#c8ff5a', '#2fb45a'], g: -1.2 });
        this.emit('pix', x, y, z, { n: 1, speed: 0.3, up: 0, life: 0.5, size: 0.3, colors: ['#7aff3a', '#2fb45a'], g: 0 });
        break;
      case 'tr_sakura':
        if (Math.random() < 0.6) this.emit('confetti', x, y, z, { n: 1, speed: 1.2, up: 0.8, life: 1.1, size: 0.25, colors: ['#ffb3d1', '#ff8ab8', '#ffffff'] });
        break;
      case 'tr_neon': {
        const c = Math.floor(performance.now() / 90) % 2 ? '#ff3fa4' : '#3bd9ff';
        this.emit('pix', x, y, z, { n: 2, speed: 0.05, up: 0, life: 0.45, size: 0.35, color: c, g: 0 });
        break;
      }
      case 'tr_shadow':
        this.emit('smoke', x, y, z, { n: 1, speed: 0.3, up: 0.3, life: 0.7, size: 0.5, color: '#222' });
        this.emit('pix', x, y, z, { n: 1, speed: 0.4, up: 0.2, life: 0.6, size: 0.3, colors: ['#3a1a5a', '#6a2aa8', '#120c1c'], g: 0 });
        break;
      case 'tr_comet':
        this.emit('fire', x, y, z, { n: 3, speed: 0.6, up: 0.4, life: 0.45, size: 0.5 });
        this.emit('pix', x, y, z, { n: 2, speed: 0.3, up: 0.1, life: 0.5, size: 0.35, colors: ['#ffffff', '#8ad8ff', '#3f8cff'], g: 0 });
        break;
      case 'tr_bubbles':
        if (Math.random() < 0.6) this.emit('bubble', x, y, z, { n: 1, speed: 0.6, up: 1, life: 1, size: 0.3, colors: ['#bfe8ff', '#ffffff', '#8ad8ff'], g: -0.8 });
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
      case 'gx_hearts': {
        this.doFlash(0.35, '#ff7ac0');
        this.emit('heart', x, y, 1, { n: 40, speed: 6, up: 6, life: 2, size: 0.3, colors: ['#ff3fa4', '#ff7ac0', '#ff3b5a', '#ffffff'], g: -0.6 });
        this.confetti(x, y, ['#ff3fa4', '#ffb3d1', '#ffffff'], 50);
        for (let i = 0; i < 3; i++) this.after(i * 0.2, () => this.emit('ring', x, y, 0.1, { n: 1, life: 0.7, size: 2 + i, color: '#ff7ac0' }));
        break;
      }
      case 'gx_sakura': {
        for (let i = 0; i < 24; i++) this.after(i * 0.05, () => this.emit('confetti', x + rand(-6, 6), y + rand(-7, 7), rand(4, 8), { n: 4, speed: 2, up: 0.5, life: 2.4, size: 0.3, colors: ['#ffb3d1', '#ff8ab8', '#ffe0ee', '#ffffff'] }));
        this.emit('ring', x, y, 0.1, { n: 1, life: 0.8, size: 2.5, color: '#ffb3d1' });
        break;
      }
      case 'gx_toxic': {
        this.doFlash(0.3, '#7aff3a');
        this.emit('bubble', x, y, 0.5, { n: 50, speed: 5, up: 3, life: 1.8, size: 0.35, colors: ['#7aff3a', '#c8ff5a', '#2fb45a'], g: -1.5 });
        this.emit('smoke', x, y, 0.5, { n: 18, speed: 3, up: 1, life: 1.6, size: 0.9, color: '#3a6a2a' });
        this.emit('pix', x, y, 1, { n: 30, speed: 8, up: 6, life: 1, size: 0.3, colors: ['#7aff3a', '#eaff8a'] });
        break;
      }
      case 'gx_disco': {
        const cols = ['#ff3fa4', '#3bd9ff', '#ffe14d', '#5ff0a4', '#b04cff'];
        for (let i = 0; i < 8; i++) this.after(i * 0.12, () => {
          this.emit('ring', x, y, 0.1, { n: 1, life: 0.6, size: 1.5 + i * 0.5, color: cols[i % cols.length] });
          this.emit('star', x + rand(-5, 5), y + rand(-5, 5), rand(1, 4), { n: 3, speed: 2, up: 3, life: 0.7, size: 0.3, color: '#ffffff' });
          this.doFlash(0.18, cols[i % cols.length]);
        });
        this.emit('pix', x, y, 1, { n: 50, speed: 9, up: 7, life: 1.4, size: 0.3, colors: cols });
        break;
      }
      case 'gx_volcano': {
        this.addShake(0.8);
        for (let i = 0; i < 30; i++) this.after(i * 0.04, () => {
          this.emit('fire', x + rand(-1, 1), y + rand(-1, 1), 0.3, { n: 6, speed: 1.5, up: 9, life: 0.9, size: 0.8, g: 6 });
          if (i % 3 === 0) this.emit('pix', x, y, 0.5, { n: 3, speed: 5, up: 9, life: 1.4, size: 0.4, colors: ['#3a2a2a', '#5a3a2a', '#ff5a1f'], g: 12 });
        });
        this.emit('smoke', x, y, 1, { n: 20, speed: 2.5, up: 3, life: 2, size: 1, color: '#333' });
        this.after(1.1, () => { this.doFlash(0.5, '#ff5a1f'); this.emit('ring', x, y, 0.1, { n: 1, life: 0.8, size: 3.5, color: '#ff9a1f' }); });
        break;
      }
      case 'gx_tornado': {
        for (let i = 0; i < 60; i++) this.after(i * 0.02, () => {
          const a = i * 0.7, r = 0.6 + i * 0.06;
          this.emit('pix', x + Math.cos(a) * r, y + Math.sin(a) * r, i * 0.12, { n: 2, speed: 0.4, up: 1.5, life: 1, size: 0.3, colors: ['#ffffff', '#c8d0e0', '#8a94aa', ...team.slice(0, 2)], g: -0.5 });
        });
        this.fx_dustRing(x, y);
        this.slowmo(0.5, 1);
        break;
      }
      case 'gx_meteor': {
        this.slowmo(0.5, 1.4);
        for (let i = 0; i < 7; i++) this.after(i * 0.16, () => {
          const mx = x + rand(-6, 6), my = y + rand(-7, 7);
          this.add({ type: 'meteor', x: mx - 4, y: my, z: 14, vx: 10, vy: 0, vz: -32, life: 0.44, max: 0.44, size: 0.4, color: '#ff9a1f', rot: 0, vr: 0, g: 0 });
          this.after(0.43, () => {
            this.emit('ring', mx, my, 0.1, { n: 1, life: 0.5, size: 1.8, color: '#ffe14d' });
            this.emit('fire', mx, my, 0.3, { n: 14, speed: 5, up: 5, life: 0.6, size: 0.6 });
            this.emit('pix', mx, my, 0.3, { n: 8, speed: 5, up: 6, life: 0.9, size: 0.35, colors: ['#3a2a2a', '#6a4a3a'], g: 12 });
            this.addShake(0.35);
            this.doFlash(0.25, '#ff9a1f');
          });
        });
        break;
      }
      default:
        this.confetti(x, y, team);
    }
  }

  private fx_dustRing(x: number, y: number) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      this.emit('dust', x + Math.cos(a) * 2, y + Math.sin(a) * 2, 0.1, { n: 2, speed: 3, up: 1, life: 1, size: 0.5, color: '#d8c9a0', vx: Math.cos(a) * 4, vy: Math.sin(a) * 4 });
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
      const g = p.g ?? (p.type === 'confetti' ? 3 : p.type === 'fire' || p.type === 'smoke' ? -1.5 : p.type === 'star' ? 6 : p.type === 'snow' ? 1.2 : p.type === 'heart' ? -0.6 : p.type === 'bubble' ? -1 : 14);
      p.vz -= g * dt;
      if (p.type === 'snow') p.vz = Math.max(p.vz, -1.4);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const drag = p.type === 'confetti' ? 2.2 : p.type === 'dust' || p.type === 'smoke' ? 3 : 1.2;
      p.vx *= Math.exp(-drag * dt);
      p.vy *= Math.exp(-drag * dt);
      if (p.type === 'confetti') p.vz = Math.max(p.vz, -1.6);
      if (p.type === 'meteor') {
        if (Math.random() < 0.9) this.emit('fire', p.x, p.y, p.z, { n: 2, speed: 0.4, up: 0.3, life: 0.3, size: 0.6 });
        if (p.z <= 0.05) { p.life = 0; continue; }
      }
      p.rot += p.vr * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.3;
        p.vx *= 0.6;
        p.vy *= 0.6;
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
        case 'pix':
        case 'snow': {
          const sz = Math.max(1, Math.round(p.size * 8 * (p.type === 'pix' ? 0.4 + k * 0.6 : 1)));
          ctx.globalAlpha = k > 0.3 ? 1 : 0.55;
          ctx.fillStyle = p.color;
          ctx.fillRect(sx - (sz >> 1), sy - (sz >> 1), sz, sz);
          break;
        }
        case 'rocket': {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx - 1, sy - 1, 2, 3);
          ctx.fillStyle = p.color;
          ctx.fillRect(sx - 1, sy + 2, 2, 2);
          ctx.fillStyle = '#ffb02e';
          ctx.fillRect(sx, sy + 4, 1, 2 + (Math.random() * 3) | 0);
          break;
        }
        case 'coin': {
          const w = Math.abs(Math.cos(p.rot)) > 0.5 ? 3 : 1;
          ctx.fillStyle = '#7a4a00';
          ctx.fillRect(sx - (w >> 1) - 1, sy - 2, w + 2, 5);
          ctx.fillStyle = '#ffcc2a';
          ctx.fillRect(sx - (w >> 1), sy - 1, w, 3);
          ctx.fillStyle = '#fff2a8';
          ctx.fillRect(sx - (w >> 1), sy - 1, 1, 1);
          break;
        }
        case 'vortex': {
          ctx.fillStyle = p.color;
          ctx.fillRect(sx, sy, 2, 2);
          break;
        }
        case 'bolt': {
          // jagged lightning from the sky to the ground point
          let x = sx + 10, y = sy - 90;
          const seed = Math.floor(p.rot * 1000);
          ctx.globalAlpha = k > 0.5 ? 1 : 0.6;
          for (let i = 0; y < sy; i++) {
            const nx = sx + (((seed * (i + 3) * 7919) % 13) - 6) * (1 - i / 14) * 0.9;
            const ny = Math.min(sy, y + 7);
            const steps = Math.max(1, Math.abs(ny - y));
            for (let j = 0; j < steps; j++) {
              const px = Math.round(x + ((nx - x) * j) / steps), py = Math.round(y + j);
              ctx.fillStyle = '#3bd9ff';
              ctx.fillRect(px - 1, py, 3, 1);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(px, py, 1, 1);
            }
            x = nx;
            y = ny;
          }
          break;
        }
        case 'heart': {
          ctx.globalAlpha = k > 0.3 ? 1 : 0.55;
          ctx.fillStyle = '#120c1c';
          ctx.fillRect(sx - 3, sy - 2, 7, 4);
          ctx.fillRect(sx - 2, sy + 2, 5, 1);
          ctx.fillRect(sx - 1, sy + 3, 3, 1);
          ctx.fillStyle = p.color;
          ctx.fillRect(sx - 2, sy - 2, 2, 1);
          ctx.fillRect(sx + 1, sy - 2, 2, 1);
          ctx.fillRect(sx - 2, sy - 1, 5, 2);
          ctx.fillRect(sx - 1, sy + 1, 3, 1);
          ctx.fillRect(sx, sy + 2, 1, 1);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx - 2, sy - 2, 1, 1);
          break;
        }
        case 'bubble': {
          const r = k > 0.66 ? 1 : 2;
          ctx.globalAlpha = k > 0.25 ? 0.95 : 0.5;
          ctx.fillStyle = p.color;
          ctx.fillRect(sx - r, sy - r - 1, r * 2 + 1, 1);
          ctx.fillRect(sx - r, sy + r + 1, r * 2 + 1, 1);
          ctx.fillRect(sx - r - 1, sy - r, 1, r * 2 + 1);
          ctx.fillRect(sx + r + 1, sy - r, 1, r * 2 + 1);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx - r + 1, sy - r + 1, 1, 1);
          break;
        }
        case 'meteor': {
          ctx.fillStyle = '#ffe14d';
          ctx.fillRect(sx - 3, sy - 3, 6, 6);
          ctx.fillStyle = '#5a3a2a';
          ctx.fillRect(sx - 2, sy - 2, 4, 4);
          ctx.fillStyle = '#8a6a4a';
          ctx.fillRect(sx - 2, sy - 2, 2, 2);
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

