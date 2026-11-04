/**
 * Store preview: a tiny live match on its own canvas that loops a scripted scene
 * for one item - a curled shot showing a ball trail, a goal explosion in the
 * net, or a special item used on a couple of rivals.
 */
import { Match } from './match';
import { Camera } from './camera';
import { Renderer } from './renderer';
import { FX } from './fx';
import type { TeamDef } from './teams';
import { TEAMS } from './teams';
import { SHOT_POWERS, POWER_ID, type Item } from '../meta/items';
import type { CardData } from '../meta/cards';
import { norm } from '../engine/math';

const STEP = 1 / 60;
export const SHOW_W = 240;
export const SHOW_H = 135;

export class Showcase {
  private match: Match;
  private fx = new FX();
  private cam = new Camera();
  private renderer: Renderer;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  /** time inside the current loop of the scene */
  private t = 0;
  private fired = false;
  private readonly period: number;

  constructor(private canvas: HTMLCanvasElement, private item: Item, club: TeamDef, cards?: CardData[]) {
    canvas.width = SHOW_W * 2;
    canvas.height = SHOW_H * 2;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx.setTransform(2, 0, 0, 2, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    const away = TEAMS.find((tm) => tm.primary !== club.primary) ?? TEAMS[1];
    this.match = new Match(
      {
        home: club, away, size: 3, duration: 999, difficulty: 'normal', demo: true, showcase: true,
        homeCards: cards && cards.length >= 3 ? cards : undefined,
        loadout: {
          goalfx: item.type === 'goalfx' ? item.id : 'gx_classic',
          trail: item.type === 'trail' ? item.id : 'tr_basic',
          powers: [], tiers: {},
        },
      },
      this.fx,
    );
    this.renderer = new Renderer(this.match);
    this.cam.resize(SHOW_W, SHOW_H);
    this.match.start();
    // skip the intro / kickoff
    for (let i = 0; i < 120 && this.match.phase !== 'play'; i++) this.match.step(STEP, null);
    this.period = item.type === 'trail' ? 2.6 : item.type === 'goalfx' ? 4.2 : 3.9;
    this.reset();
    const [tx, ty] = this.focus();
    this.cam.x = tx;
    this.cam.y = ty;
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.canvas.isConnected) return this.stop();
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.renderer.draw(this.ctx, this.cam, this.time);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private get me() {
    return this.match.teams[0].players[0];
  }

  /** put everybody back for the next loop */
  private reset() {
    const m = this.match;
    const P = m.pitch;
    const me = this.me;
    const b = m.ball;
    this.fired = false;
    this.t = 0;
    m.bombs.length = 0;
    m.bullets.length = 0;
    b.reset();
    for (const p of m.all) {
      p.setState('run');
      p.vx = p.vy = 0;
      p.z = 0;
      p.frozen = p.turbo = p.magnet = p.shield = p.drink = 0;
      p.invuln = 0;
      p.ix = p.iy = 0;
      p.wantSprint = false;
    }
    const opp = m.teams[1].players;
    const gk = opp.find((p) => p.isGK)!;
    gk.x = P.hw - 1.2;
    gk.y = 0;
    gk.face = Math.PI;
    const field = opp.filter((p) => !p.isGK);
    if (this.item.type === 'trail') {
      me.x = P.hw - 15;
      me.y = 4;
      field.forEach((p, i) => { p.x = P.hw - 7 + i * 2; p.y = i ? -4 : 1.5; p.face = Math.PI; });
    } else if (this.item.type === 'goalfx') {
      me.x = P.hw - 7;
      me.y = 3;
      field.forEach((p, i) => { p.x = P.hw - 4 - i * 2; p.y = i ? -3 : 1; p.face = Math.PI; });
    } else {
      me.x = -2;
      me.y = 0;
      field.forEach((p, i) => { p.x = 3.2 + i * 1.4; p.y = i ? 1.4 : -1; p.face = Math.PI; });
    }
    me.face = 0;
    const shot = this.item.type === 'power' && SHOT_POWERS.includes(POWER_ID(this.item.id));
    if (this.item.type === 'trail' || shot) {
      b.owner = me;
      b.lastTouch = me;
      b.x = me.x + 0.6;
      b.y = me.y;
    } else if (this.item.id === 'pw_magnet') {
      b.x = me.x + 1.5;
      b.y = me.y + 4.5;
    } else {
      b.x = -P.hw + 4;
      b.y = -P.hh + 2;
    }
    m.teams[0].item = this.item.type === 'power' ? POWER_ID(this.item.id) : null;
  }

  private fire() {
    const m = this.match;
    const P = m.pitch;
    const me = this.me;
    this.fired = true;
    if (this.item.type === 'trail') {
      const [dx, dy] = norm(P.hw - me.x, -1.5 - me.y);
      m.kick(me, dx * 26, dy * 26, 2.6, 1);
      m.ball.spin = 0.55;
    } else if (this.item.type === 'goalfx') {
      const tm = m.teams[0];
      m.fx.goalExplosion(this.item.id, P.hw + 1, 0, [tm.def.primary, tm.def.secondary, '#ffffff', '#ffd23f']);
      m.fx.doFlash(0.45);
      m.fx.addShake(0.6);
    } else {
      const kind = POWER_ID(this.item.id);
      const target = m.teams[1].players.find((p) => !p.isGK)!;
      let tx = target.x, ty = target.y;
      if (SHOT_POWERS.includes(kind)) { tx = P.hw; ty = 0; }
      if (kind === 'teleport') { tx = me.x + 7.5; ty = me.y - 2.5; }
      m.useItem(me, tx, ty);
      // give the effect something to do
      if (kind === 'shield') for (const q of m.teams[1].players) if (!q.isGK) { q.ix = -1; q.iy = (me.y - q.y) * 0.4; }
      if (kind === 'turbo' || kind === 'drink') { me.ix = 1; me.wantSprint = true; }
    }
  }

  /** where the camera looks */
  private focus(): [number, number] {
    const m = this.match;
    const P = m.pitch;
    if (this.item.type === 'goalfx') return [P.hw - 3, 0];
    if (this.item.type === 'trail') return [m.ball.x - 1, m.ball.y];
    const b = m.ball;
    if (b.fire > 0 && !b.owner) return [b.x, b.y];
    return [this.me.x + 3, 0];
  }

  private update(dt: number) {
    const ts = this.fx.timeScale;
    this.acc += dt * ts;
    let n = 0;
    while (this.acc >= STEP && n < 5) {
      this.match.step(STEP, null);
      this.acc -= STEP;
      this.t += STEP;
      n++;
    }
    if (n >= 5) this.acc = 0;
    this.time += dt;
    this.fx.update(dt * ts, dt);
    if (!this.fired && this.t > 0.45) this.fire();
    if (this.t > this.period) this.reset();
    const [tx, ty] = this.focus();
    this.cam.follow(tx, ty, dt, this.match.pitch, 5);
    this.cam.applyShake(this.fx.shake, this.time);
  }
}
