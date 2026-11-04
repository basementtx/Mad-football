import type { MatchEnv } from './env';
import { settings } from '../engine/storage';
import { audio } from '../engine/audio';

interface Drop {
  x: number;
  y: number;
  v: number;
  /** size / length variant */
  s: number;
  ph: number;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Screen-space weather layer: rain streaks and splashes, snowflakes, drifting fog,
 * wind-blown leaves and lightning. Particles are anchored to the world so they
 * move with the camera instead of sticking to the screen.
 */
export class WeatherFX {
  private drops: Drop[] = [];
  private splashes: { x: number; y: number; t: number }[] = [];
  private W = 0;
  private H = 0;
  private lastT = -1;
  private lastBX = 0;
  private lastBY = 0;
  private fog: HTMLCanvasElement | null = null;
  private bolt = 0;
  private boltX = 0;
  private boltSeed = 0;
  private nextBolt = 6 + Math.random() * 8;

  constructor(private env: MatchEnv) {}

  private get windX() {
    return Math.cos(this.env.windA) * this.env.windF;
  }

  private count() {
    const hi = settings.quality === 'high';
    switch (this.env.weather) {
      case 'rain': return hi ? 170 : 80;
      case 'storm': return hi ? 260 : 120;
      case 'snow': return hi ? 150 : 70;
      case 'wind': return hi ? 26 : 12;
      default: return 0;
    }
  }

  private spawn(d: Drop | null, anywhere: boolean): Drop {
    const w = this.env.weather;
    const o = d ?? { x: 0, y: 0, v: 0, s: 0, ph: 0 };
    o.s = Math.random();
    o.ph = Math.random() * 6.28;
    o.v = w === 'snow' ? 14 + o.s * 16 : w === 'wind' ? 60 + o.s * 60 : 190 + o.s * 110;
    if (anywhere) {
      o.x = Math.random() * this.W;
      o.y = Math.random() * this.H;
    } else if (w === 'wind') {
      o.x = this.windX >= 0 ? -4 : this.W + 4;
      o.y = Math.random() * this.H;
    } else {
      o.x = Math.random() * (this.W + 80) - 40;
      o.y = -4 - Math.random() * 20;
    }
    return o;
  }

  private buildFog() {
    // tileable dithered noise blobs
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(214,222,232,0.55)';
    const blobs: [number, number, number][] = [];
    for (let i = 0; i < 9; i++) blobs.push([Math.random() * S, Math.random() * S, 18 + Math.random() * 26]);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        let v = 0;
        for (const [bx, by, r] of blobs)
          for (const ox of [-S, 0, S])
            for (const oy of [-S, 0, S]) {
              const d = Math.hypot((x - bx - ox) / r, ((y - by - oy) / r) * 1.8);
              if (d < 1) v += (1 - d) * 0.8;
            }
        if (Math.min(1, v) * 16 > BAYER[(y & 3) * 4 + (x & 3)]) g.fillRect(x, y, 1, 1);
      }
    this.fog = c;
  }

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, bx: number, by: number, time: number) {
    const w = this.env.weather;
    const dt = this.lastT < 0 ? 0 : Math.min(0.1, Math.max(0, time - this.lastT));
    this.lastT = time;
    // world anchoring
    const ddx = this.lastBX === 0 && this.lastBY === 0 ? 0 : bx - this.lastBX;
    const ddy = this.lastBX === 0 && this.lastBY === 0 ? 0 : by - this.lastBY;
    this.lastBX = bx;
    this.lastBY = by;
    if (W !== this.W || H !== this.H) {
      this.W = W;
      this.H = H;
      this.drops = [];
    }
    const n = this.count();
    while (this.drops.length < n) this.drops.push(this.spawn(null, true));
    audio.setWeather(w === 'rain' ? 0.6 : w === 'storm' ? 1 : 0, w === 'wind' ? 0.8 : w === 'storm' ? 0.5 : w === 'snow' ? 0.2 : 0);

    if (w === 'fog') this.drawFog(ctx, W, H, bx, by, time);
    if (w === 'rain' || w === 'storm') this.drawRain(ctx, dt, ddx, ddy);
    else if (w === 'snow') this.drawSnow(ctx, dt, ddx, ddy, time);
    else if (w === 'wind') this.drawWind(ctx, dt, ddx, ddy, time);
    if (w === 'storm') this.drawStorm(ctx, W, H, dt);
    if (w === 'night') {
      ctx.fillStyle = 'rgba(6,10,30,0.12)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawRain(ctx: CanvasRenderingContext2D, dt: number, ddx: number, ddy: number) {
    const slant = Math.max(-0.6, Math.min(0.6, this.windX * 0.12)) + 0.12;
    const heavy = this.env.weather === 'storm';
    for (const d of this.drops) {
      d.x += ddx + d.v * slant * dt;
      d.y += ddy + d.v * dt;
      const len = 3 + Math.round(d.s * (heavy ? 5 : 3));
      // land somewhere on screen, leaving a splash
      if (d.y > this.H * (0.25 + d.s * 0.75) || d.x < -40 || d.x > this.W + 40) {
        if (d.y > 0 && d.y < this.H && Math.random() < 0.6) this.splashes.push({ x: d.x, y: d.y, t: 0 });
        this.spawn(d, false);
        continue;
      }
      ctx.fillStyle = d.s > 0.6 ? 'rgba(200,220,245,0.55)' : 'rgba(170,195,230,0.38)';
      for (let i = 0; i < len; i++) ctx.fillRect(Math.round(d.x - slant * i), Math.round(d.y - i), 1, 1);
    }
    ctx.fillStyle = 'rgba(210,228,250,0.6)';
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.t += dt;
      s.x += ddx;
      s.y += ddy;
      if (s.t > 0.16) {
        this.splashes.splice(i, 1);
        continue;
      }
      const r = s.t < 0.08 ? 1 : 2;
      ctx.fillRect(Math.round(s.x) - r, Math.round(s.y), 1, 1);
      ctx.fillRect(Math.round(s.x) + r, Math.round(s.y), 1, 1);
      if (r === 1) ctx.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 1);
    }
    if (this.splashes.length > 200) this.splashes.splice(0, this.splashes.length - 200);
    ctx.fillStyle = heavy ? 'rgba(20,28,48,0.16)' : 'rgba(30,40,60,0.09)';
    ctx.fillRect(0, 0, this.W, this.H);
  }

  private drawSnow(ctx: CanvasRenderingContext2D, dt: number, ddx: number, ddy: number, time: number) {
    const wx = this.windX * 3;
    for (const d of this.drops) {
      d.x += ddx + (wx + Math.sin(time * 1.3 + d.ph) * 8) * dt;
      d.y += ddy + d.v * dt;
      if (d.y > this.H + 4 || d.x < -20 || d.x > this.W + 20) {
        this.spawn(d, false);
        if (wx > 4) d.x -= 30;
        continue;
      }
      const x = Math.round(d.x), y = Math.round(d.y);
      if (d.s > 0.72) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, 2, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x - 1, y, 1, 1);
      } else {
        ctx.fillStyle = d.s > 0.35 ? 'rgba(255,255,255,0.9)' : 'rgba(230,238,250,0.6)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = 'rgba(220,230,245,0.05)';
    ctx.fillRect(0, 0, this.W, this.H);
  }

  private drawWind(ctx: CanvasRenderingContext2D, dt: number, ddx: number, ddy: number, time: number) {
    const dir = this.windX >= 0 ? 1 : -1;
    const vy = Math.sin(this.env.windA) * this.env.windF * 6;
    const cols = ['#c8a23a', '#a8662a', '#7a9a3a', '#d8c890'];
    for (const d of this.drops) {
      d.x += ddx + dir * d.v * dt;
      d.y += ddy + (vy + Math.sin(time * 4 + d.ph) * 14) * dt;
      if (d.x < -10 || d.x > this.W + 10 || d.y < -10 || d.y > this.H + 10) {
        this.spawn(d, false);
        continue;
      }
      const x = Math.round(d.x), y = Math.round(d.y);
      if (d.s < 0.45) {
        // leaf, tumbling
        ctx.fillStyle = cols[Math.floor(d.s * 8.9) % cols.length];
        const f = Math.floor(time * 10 + d.ph * 3) % 2;
        ctx.fillRect(x, y, f ? 2 : 1, f ? 1 : 2);
      } else {
        // dust streak
        ctx.fillStyle = 'rgba(230,220,190,0.25)';
        ctx.fillRect(x - dir * 4, y, 5, 1);
      }
    }
  }

  private drawFog(ctx: CanvasRenderingContext2D, W: number, H: number, bx: number, by: number, time: number) {
    if (!this.fog) this.buildFog();
    const f = this.fog!;
    const S = f.width;
    ctx.fillStyle = 'rgba(190,200,212,0.16)';
    ctx.fillRect(0, 0, W, H);
    for (const [k, sp, a] of [[0.6, 5, 0.55], [1, 9, 0.4]] as const) {
      const ox = (((Math.floor(bx * k + time * sp) % S) + S) % S) - S;
      const oy = (((Math.floor(by * k) % S) + S) % S) - S;
      ctx.globalAlpha = a;
      for (let y = oy; y < H; y += S) for (let x = ox; x < W; x += S) ctx.drawImage(f, x, y);
    }
    ctx.globalAlpha = 1;
  }

  private drawStorm(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number) {
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.bolt = 0.45;
      this.boltX = W * (0.15 + Math.random() * 0.7);
      this.boltSeed = Math.random() * 1000;
      this.nextBolt = 7 + Math.random() * 12;
      audio.thunder();
    }
    if (this.bolt <= 0) return;
    this.bolt -= dt;
    const k = this.bolt / 0.45;
    // double flicker
    const on = k > 0.8 || (k > 0.45 && k < 0.6);
    if (on) {
      ctx.fillStyle = 'rgba(220,230,255,0.35)';
      ctx.fillRect(0, 0, W, H);
      // jagged bolt at the top of the screen
      let x = this.boltX, y = 0;
      ctx.fillStyle = '#ffffff';
      let s = this.boltSeed;
      while (y < H * 0.3) {
        s = (s * 9301 + 49297) % 233280;
        const nx = x + ((s / 233280) * 8 - 4);
        for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x + ((nx - x) * i) / 4), y + i, 2, 1);
        x = nx;
        y += 4;
      }
    } else {
      ctx.fillStyle = `rgba(150,170,220,${(k * 0.12).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
