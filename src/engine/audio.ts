import { settings } from './storage';

/**
 * Fully synthesized audio (no asset files): crowd ambience, kicks, hits,
 * whistle, goal horn, UI clicks. Keeps the bundle tiny for mobile.
 */
class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private crowdGain!: GainNode;
  private crowdFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private crowdLevel = 0.25;
  private crowdTarget = 0.25;
  private started = false;
  private rainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rainTarget = 0;
  private windTarget = 0;
  private lastPlay: { [k: string]: number } = {};

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.noise = this.makeNoise(2.5);
      this.applyVolume();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (!this.started) this.startCrowd();
  }

  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.value = settings.sound ? settings.volume : 0;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private makeNoise(sec: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
    const d = buf.getChannelData(0);
    // pinkish noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    }
    return buf;
  }

  private throttle(key: string, ms: number) {
    const now = performance.now();
    if ((this.lastPlay[key] ?? 0) + ms > now) return true;
    this.lastPlay[key] = now;
    return false;
  }

  private startCrowd() {
    const ctx = this.ctx!;
    this.started = true;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.crowdFilter = ctx.createBiquadFilter();
    this.crowdFilter.type = 'bandpass';
    this.crowdFilter.frequency.value = 520;
    this.crowdFilter.Q.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    src.connect(this.crowdFilter).connect(lp).connect(this.crowdGain).connect(this.master);
    // slow murmur modulation
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.23;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(this.crowdGain.gain);
    lfo.start();
    src.start();
  }

  private startWeather() {
    const ctx = this.ctx!;
    const mk = (type: BiquadFilterType, freq: number, q: number, rate: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.playbackRate.value = rate;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start(0, Math.random() * 2);
      return { f, g };
    };
    this.rainGain = mk('highpass', 2400, 0.4, 1.7).g;
    const w = mk('bandpass', 380, 1.4, 0.6);
    this.windGain = w.g;
    this.windFilter = w.f;
  }

  /** Ambient weather loops: rain hiss and wind howl, 0..1 each. */
  setWeather(rain: number, wind: number) {
    this.rainTarget = rain;
    this.windTarget = wind;
  }

  thunder() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime + 0.15 + Math.random() * 0.5;
    this.noiseBurst(t, 2.2, 'lowpass', 160, 0.7, 0.55, 0.03, 0.5);
    this.noiseBurst(t + 0.05, 0.6, 'lowpass', 600, 0.5, 0.3, 0.01, 0.8);
  }

  /** 0..1 excitement of the crowd. */
  setCrowd(level: number) {
    this.crowdTarget = level;
  }

  update(dt: number) {
    if (!this.ctx || !this.started) return;
    this.crowdLevel += (this.crowdTarget - this.crowdLevel) * Math.min(1, dt * 2);
    const g = 0.06 + this.crowdLevel * 0.22;
    this.crowdGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.1);
    this.crowdFilter.frequency.setTargetAtTime(480 + this.crowdLevel * 500, this.ctx.currentTime, 0.2);
    if (!this.rainGain && (this.rainTarget > 0 || this.windTarget > 0)) this.startWeather();
    if (this.rainGain && this.windGain && this.windFilter) {
      const now = this.ctx.currentTime;
      this.rainGain.gain.setTargetAtTime(this.rainTarget * 0.16, now, 0.5);
      // gusty wind
      const gust = 0.6 + 0.4 * Math.sin(now * 0.7) * Math.sin(now * 0.31 + 1);
      this.windGain.gain.setTargetAtTime(this.windTarget * 0.22 * gust, now, 0.3);
      this.windFilter.frequency.setTargetAtTime(300 + gust * 260, now, 0.3);
    }
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private noiseBurst(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, attack = 0.005, rate = 1) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, attack, dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random() * 1.5, attack + dur + 0.05);
    return f;
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, attack = 0.004) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, peak, attack, dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  private get ready() {
    return !!this.ctx && settings.sound;
  }

  kick(power: number) {
    if (!this.ready || this.throttle('kick', 40)) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'sine', 160 + power * 60, 45, 0.14 + power * 0.06, 0.55 + power * 0.35);
    this.noiseBurst(t, 0.05, 'highpass', 1800, 0.7, 0.25 + power * 0.25);
  }

  touch() {
    if (!this.ready || this.throttle('touch', 90)) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'sine', 120, 60, 0.07, 0.18);
  }

  hit(strength = 1) {
    if (!this.ready || this.throttle('hit', 50)) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'sine', 110, 38, 0.22, 0.7 * strength);
    this.noiseBurst(t, 0.18, 'lowpass', 900, 0.8, 0.6 * strength);
    this.noiseBurst(t + 0.02, 0.08, 'bandpass', 2500, 1.5, 0.15 * strength);
  }

  slide() {
    if (!this.ready || this.throttle('slide', 120)) return;
    const t = this.ctx!.currentTime;
    const f = this.noiseBurst(t, 0.35, 'bandpass', 900, 0.9, 0.3, 0.02);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.35);
  }

  whoosh() {
    if (!this.ready || this.throttle('whoosh', 120)) return;
    const t = this.ctx!.currentTime;
    const f = this.noiseBurst(t, 0.25, 'bandpass', 600, 2, 0.25, 0.05);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
  }

  post() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'triangle', 1320, 1250, 0.6, 0.3);
    this.tone(t, 'sine', 2140, 2100, 0.4, 0.15);
    this.tone(t, 'sine', 180, 60, 0.15, 0.4);
  }

  catchBall() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.noiseBurst(t, 0.09, 'lowpass', 1200, 0.5, 0.45);
    this.tone(t, 'sine', 140, 80, 0.1, 0.35);
  }

  whistle(kind: 'short' | 'long' | 'final' = 'short') {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const blasts = kind === 'final' ? [[0, 0.35], [0.45, 0.35], [0.9, 0.9]] : kind === 'long' ? [[0, 0.7]] : [[0, 0.28]];
    for (const [dt, dur] of blasts) {
      const t = t0 + dt;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 2650;
      const trill = ctx.createOscillator();
      trill.frequency.value = 38;
      const tg = ctx.createGain();
      tg.gain.value = 140;
      trill.connect(tg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.sfx);
      o.start(t);
      trill.start(t);
      o.stop(t + dur + 0.05);
      trill.stop(t + dur + 0.05);
    }
  }

  cheer(intensity = 1) {
    if (!this.ready || this.throttle('cheer', 300)) return;
    const t = this.ctx!.currentTime;
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    const dur = 1.2 + intensity * 2.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45 * intensity, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t);
    s.stop(t + dur + 0.1);
  }

  groan() {
    if (!this.ready || this.throttle('groan', 800)) return;
    const t = this.ctx!.currentTime;
    const f = this.noiseBurst(t, 1.1, 'bandpass', 700, 1.2, 0.3, 0.15);
    f.frequency.exponentialRampToValueAtTime(260, t + 1.1);
  }

  horn() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    g.gain.setValueAtTime(0.16, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    lp.connect(g).connect(this.sfx);
    for (const f of [233, 294, 349, 466]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = Math.random() * 10 - 5;
      o.connect(lp);
      o.start(t);
      o.stop(t + 1.7);
    }
  }

  /** small blaster shot */
  pew() {
    if (!this.ready || this.throttle('pew', 40)) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'square', 1500, 180, 0.12, 0.12);
    this.noiseBurst(t, 0.05, 'highpass', 2500, 0.7, 0.12);
  }
  /** bomb explosion */
  boom() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'sine', 90, 25, 0.6, 0.9);
    this.noiseBurst(t, 0.7, 'lowpass', 700, 0.7, 0.9, 0.003);
    this.noiseBurst(t + 0.03, 0.25, 'bandpass', 1800, 1, 0.3);
  }
  /** mystery box pickup jingle */
  pickup() {
    if (!this.ready || this.throttle('pickup', 120)) return;
    const t = this.ctx!.currentTime;
    [660, 880, 1320, 1760].forEach((f, i) => this.tone(t + i * 0.055, 'square', f, f * 1.01, 0.09, 0.07));
  }
  power() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'sawtooth', 90, 40, 0.5, 0.35);
    const f = this.noiseBurst(t, 0.6, 'bandpass', 300, 1, 0.6, 0.02);
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.5);
    this.tone(t, 'square', 220, 880, 0.3, 0.08);
  }

  click() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'triangle', 900, 600, 0.06, 0.18);
  }

  select() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'triangle', 600, 1200, 0.12, 0.2);
    this.tone(t + 0.06, 'triangle', 900, 1600, 0.1, 0.12);
  }

  countdown(final: boolean) {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'square', final ? 880 : 440, final ? 880 : 440, final ? 0.35 : 0.12, 0.08);
  }
}

export const audio = new AudioEngine();

export function vibrate(ms: number | number[]) {
  if (!settings.vibration) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
