/**
 * Extra game modes on top of the match engine.
 *  - freekick: "score hunt" - 10 free kicks from changing spots over a wall and past a
 *    keeper; harder goals (distance, corners, top bins, off the post, curl, streaks)
 *    score more.
 *  - duel: wall duel - 1v1 on a small court, each player striker and keeper at once;
 *    an invisible wall on the halfway line stops the players, never the ball.
 */
import type { Match } from './match';
import type { Team, Player } from './entities';
import type { Input } from '../engine/input';
import { DIFF } from './entities';
import { gkAI, duelAI } from './ai';
import { clamp, dist, norm, rand } from '../engine/math';
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { settings } from '../engine/storage';

export type GameMode = 'freekick' | 'duel';

const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);

export interface ModeLogic {
  /** shown instead of the match clock */
  label?(): string;
  /** the match clock runs */
  clock: boolean;
  /** after both teams are built */
  setup(): void;
  /** right after Match.setupKickoff (first kick-off and after goals) */
  kickoff?(kt: Team): void;
  /** replaces the human control; return true when handled */
  control?(input: Input | null, dt: number): boolean;
  /** replaces the team AI */
  ai(dt: number): void;
  /** after players moved and collided: keep them where they belong */
  constrain?(): void;
  /** every live step after the ball and the interactions */
  step?(dt: number): void;
  /** a goal: return true to deal with it here instead of the normal goal flow */
  goal?(team: Team): boolean;
  /** where the camera should look (null = follow the play as usual) */
  camera?(): [number, number] | null;
}

export function makeMode(m: Match): ModeLogic | null {
  if (m.cfg.mode === 'freekick') return new FreeKicks(m);
  if (m.cfg.mode === 'duel') return new Duel(m);
  return null;
}

/** the best outfield player for a job (the user's own player first) */
function pickPlayer(players: Player[], score: (p: Player) => number): Player {
  const field = players.filter((p) => !p.isGK);
  const star = field.find((p) => p.star);
  if (star) return star;
  return field.reduce((a, c) => (score(c) > score(a) ? c : a), field[0] ?? players[0]);
}

// ---------------------------------------------------------------- free kicks

export type KickResult = 'goal' | 'save' | 'wall' | 'miss';
export const FK_SHOTS = 10;

export class FreeKicks implements ModeLogic {
  clock = false;
  n = 0;
  points = 0;
  goals = 0;
  streak = 0;
  log: { r: KickResult; pts: number; d: number }[] = [];
  private state: 'aim' | 'flight' | 'result' | 'done' = 'aim';
  private t = 0;
  private shooter!: Player;
  private gk!: Player;
  private wall: Player[] = [];
  private wallSpots: [number, number][] = [];
  private spot = { x: 0, y: 0, d: 20 };
  private aimX = 1;
  private aimY = 0;
  private lockX = 1;
  private lockY = 0;
  private curl = 0;
  private spinAtKick = 0;
  private cross: { y: number; z: number } | null = null;
  private jumpT = 0;

  constructor(private m: Match) {}

  setup() {
    const [home, away] = this.m.teams;
    this.shooter = pickPlayer(home.players, (p) => p.power * 0.7 + p.skill * 0.3);
    home.players = [this.shooter];
    this.gk = away.players.find((p) => p.isGK) ?? away.players[0];
    const field = away.players.filter((p) => !p.isGK).slice(0, 5);
    away.players = [this.gk, ...field];
    this.wall = field;
    this.m.all = [...home.players, ...away.players];
  }

  label() {
    return `${L2('KICK', 'ATIŞ')} ${Math.min(this.n + 1, FK_SHOTS)}/${FK_SHOTS} · ${this.points}`;
  }

  kickoff() {
    this.place();
  }

  /** frame the ball and the goal together (the wall and the keeper in view) */
  camera(): [number, number] | null {
    if (this.state === 'done') return null;
    const gx = this.m.pitch.hw;
    return [this.spot.x + (gx - this.spot.x) * 0.5, this.spot.y * 0.55];
  }

  /** set up the next free kick */
  private place() {
    const m = this.m;
    const P = m.pitch;
    const b = m.ball;
    const gx = P.hw;
    // further out and wider as the round goes on, always a little random
    const d = clamp(rand(17, 24) + this.n * 0.7, 17, 31);
    const y = rand(-1, 1) * Math.min(d * 0.5, P.boxHalf + 2);
    const bx = gx - Math.sqrt(Math.max(1, d * d - y * y));
    this.spot = { x: bx, y, d };
    const [ux, uy] = norm(gx - bx, -y);
    this.aimX = ux;
    this.aimY = uy;
    this.curl = 0;
    this.cross = null;
    // the keeper gets sharper through the round
    const away = m.teams[1];
    away.diff = this.n < 3 ? DIFF.normal : this.n < 7 ? DIFF.hard : DIFF.insane;

    for (const p of m.all) {
      if (p.state !== 'run') p.setState('run');
      p.vx = p.vy = 0;
      p.z = 0;
      p.ix = p.iy = 0;
      p.charge = 0;
      p.chargeKind = 'none';
      p.kickCd = p.tackleCd = p.invuln = 0;
      p.holdT = p.possT = 0;
    }
    // shooter behind the ball, facing the goal
    const s = this.shooter;
    s.x = bx - ux * 0.62;
    s.y = y - uy * 0.62;
    s.face = Math.atan2(uy, ux);
    // the wall: 9 m out (scaled to the pitch), covering the near post
    const near = Math.abs(y) > 1 ? Math.sign(y) : Math.random() < 0.5 ? -1 : 1;
    const [wx, wy] = norm(gx - bx, near * P.goalHalf * 0.45 - y);
    const n = d < 21 ? 5 : d < 26 ? 4 : 3;
    const cx = bx + wx * 7.5, cy = y + wy * 7.5;
    this.wallSpots = [];
    this.wall.forEach((p, i) => {
      if (i >= n) {
        // spares stand by the post, out of the way
        p.x = gx - 1.2;
        p.y = -near * (P.goalHalf + 2.5 + i);
      } else {
        const k = i - (n - 1) / 2;
        p.x = cx - wy * k * 0.72;
        p.y = cy + wx * k * 0.72;
      }
      p.face = Math.atan2(y - p.y, bx - p.x);
      this.wallSpots.push([p.x, p.y]);
    });
    // keeper: middle of the goal, a step toward the far side
    this.gk.x = gx - 1.1;
    this.gk.y = -near * 0.5;
    this.gk.face = Math.PI;
    b.reset();
    b.owner = s;
    b.lastTouch = s;
    b.x = bx;
    b.y = y;
    this.state = 'aim';
    this.t = 0;
    this.jumpT = 0;
    m.fx.banner(`${L2('KICK', 'ATIŞ')} ${this.n + 1}/${FK_SHOTS}`, `${Math.round(d)} m${this.streak >= 2 ? ` · ${L2('STREAK', 'SERİ')} x${this.streak}` : ''}`, '#fff', 1.4);
  }

  /** where the aim meets the goal line */
  private goalY(ax: number, ay: number) {
    const P = this.m.pitch;
    const t = (P.hw - this.spot.x) / Math.max(0.05, ax);
    return this.spot.y + ay * t;
  }

  control(inp: Input | null, dt: number) {
    const m = this.m;
    const s = this.shooter;
    s.ix = s.iy = 0;
    s.wantSprint = false;
    m.human = s;
    if (this.state !== 'aim' || !inp || m.phase !== 'play') {
      m.aim = null;
      m.aimPath = null;
      return true;
    }
    const P = m.pitch;
    const stick = Math.hypot(inp.mx, inp.my) > 0.3;
    const charging = s.chargeKind === 'shot';
    if (!charging && stick) {
      // aim: anywhere in a cone toward the goal
      let [ax, ay] = norm(inp.mx, inp.my);
      const a = clamp(Math.atan2(ay, ax), -1.1, 1.1);
      ax = Math.cos(a);
      ay = Math.sin(a);
      this.aimX += (ax - this.aimX) * Math.min(1, dt * 10);
      this.aimY += (ay - this.aimY) * Math.min(1, dt * 10);
      [this.aimX, this.aimY] = norm(this.aimX, this.aimY);
    }
    if (inp.btn.a.pressed && !charging) {
      s.chargeKind = 'shot';
      s.charge = 0;
      this.lockX = this.aimX;
      this.lockY = this.aimY;
      this.curl = 0;
    }
    if (s.chargeKind === 'shot') {
      // pushing the stick sideways while charging bends it (as in a match)
      const cross = this.lockX * inp.my - this.lockY * inp.mx;
      const target = Math.hypot(inp.mx, inp.my) > 0.35 ? clamp(cross * 1.5, -1, 1) : 0;
      this.curl += (target - this.curl) * Math.min(1, dt * 12);
      if (Math.abs(this.curl) < 0.04) this.curl = 0;
      s.charge = Math.min(1.3, s.charge + dt / 0.9);
      if (!inp.btn.a.down || s.charge >= 1.3) {
        this.kick(s.charge);
        s.chargeKind = 'none';
        s.charge = 0;
        m.aim = null;
        m.aimPath = null;
        m.curl = 0;
        return true;
      }
    }
    m.curl = this.curl;
    const ax = s.chargeKind === 'shot' ? this.lockX : this.aimX;
    const ay = s.chargeKind === 'shot' ? this.lockY : this.aimY;
    const gy = this.goalY(ax, ay);
    m.aim = { x: P.hw, y: gy, kind: 'shot' };
    m.aimPath = this.preview(ax, ay, this.curl);
    return true;
  }

  /** the first part of the flight on the ground (where it starts to bend, not where it ends) */
  private preview(ax: number, ay: number, curl: number): [number, number][] {
    const { x: bx, y: by, d } = this.spot;
    const rot = curl * 0.85;
    const a = Math.atan2(ay, ax) - rot / 2;
    const sp = 27;
    const T = clamp(d / (sp * 0.85), 0.3, 1.6);
    let spin = rot ? (rot * 1.2) / (3 * (1 - Math.exp(-1.2 * T))) : 0;
    let vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
    let x = bx, y = by;
    const out: [number, number][] = [[x, y]];
    const step = 0.025;
    for (let t = 0; t < T * 0.45; t += step) {
      const c = spin * step * 3;
      const nvx = vx * Math.cos(c) - vy * Math.sin(c);
      vy = vx * Math.sin(c) + vy * Math.cos(c);
      vx = nvx;
      spin *= Math.exp(-1.2 * step);
      x += vx * step;
      y += vy * step;
      out.push([x, y]);
    }
    return out;
  }

  private kick(charge: number) {
    const m = this.m;
    const s = this.shooter;
    const b = m.ball;
    const { d } = this.spot;
    // The dip is set for an ideal pace: at that pace the ball clears the wall (7.5 m out,
    // ~2.35 m high) and drops under the bar at the goal. The ideal is about half the
    // power bar at every distance: more sails over / hits the jumping wall early,
    // less floats in slowly for the keeper.
    const tz = 1.75;
    const ideal = Math.sqrt((82.5 * (d - 7.5)) / (2.45 - (7.5 / d) * tz)) * 0.97;
    const p = clamp(charge, 0.12, 1.3) / 1.3;
    const speed = ideal * (0.72 + p * 0.56) * (0.96 + s.power * 0.08);
    const T = d / ideal;
    const vz = (tz + 11 * T * T) / T;
    const rot = this.curl * 0.85;
    const Ta = clamp(d / (speed * 0.85), 0.3, 1.6);
    const spin = rot ? (rot * 1.2) / (3 * (1 - Math.exp(-1.2 * Ta))) : 0;
    // a little error, less for better strikers
    const a = Math.atan2(this.lockY, this.lockX) - rot / 2 + (Math.random() - 0.5) * 0.03 * (1.3 - s.skill);
    m.kick(s, Math.cos(a) * speed, Math.sin(a) * speed, vz, p);
    b.spin = spin;
    b.shotBy = s.team;
    s.shots++;
    s.team.stats.shots++;
    this.spinAtKick = this.curl;
    this.state = 'flight';
    this.t = 0;
    this.jumpT = 0.55;
    m.fx.addShake(0.08 + p * 0.1);
  }

  ai(dt: number) {
    const m = this.m;
    for (const p of this.wall) {
      p.ix = p.iy = 0;
      p.wantSprint = false;
    }
    // the keeper plays the shot; after a result he just stands
    if (this.state === 'flight' || this.state === 'aim') gkAI(m, this.gk, dt);
    else this.gk.ix = this.gk.iy = 0;
  }

  constrain() {
    if (this.state === 'aim' || this.state === 'flight') {
      const s = this.shooter;
      const { x, y } = this.spot;
      const [ux, uy] = norm(this.m.pitch.hw - x, -y);
      s.x = x - ux * 0.62;
      s.y = y - uy * 0.62;
      s.vx = s.vy = 0;
    }
    // the wall holds its line
    this.wall.forEach((p, i) => {
      const sp = this.wallSpots[i];
      if (!sp || p.state !== 'run') return;
      p.x = sp[0];
      p.y = sp[1];
      p.vx = p.vy = 0;
    });
  }

  step(dt: number) {
    const m = this.m;
    const P = m.pitch;
    const b = m.ball;
    // the wall jumps as the ball is struck
    if (this.jumpT > 0) {
      this.jumpT = Math.max(0, this.jumpT - dt);
      const z = Math.sin(((0.55 - this.jumpT) / 0.55) * Math.PI) * 0.45;
      this.wall.forEach((p, i) => { if (i < this.wallSpots.length && p.state === 'run') p.z = z; });
    }
    this.t += dt;
    if (this.state === 'flight') {
      if (!this.cross && b.x >= P.hw - 0.05) this.cross = { y: b.y, z: b.z };
      const o = b.owner;
      if (o && o.team !== this.shooter.team) return this.resolve(o.isGK ? 'save' : 'wall');
      if (o === this.shooter && this.t > 0.4) return this.resolve('miss');
      if (!b.inGoal && b.x > P.hw + 0.4) return this.resolve(b.lastTouch?.isGK ? 'save' : 'miss');
      if (!b.inGoal && Math.hypot(b.vx, b.vy) < 1 && b.z < 0.1 && this.t > 0.6) {
        const lt = b.lastTouch;
        return this.resolve(lt && lt.team !== this.shooter.team ? (lt.isGK ? 'save' : 'wall') : 'miss');
      }
      if (this.t > 4) return this.resolve('miss');
    } else if (this.state === 'result' && this.t > 1.9) {
      this.n++;
      if (this.n >= FK_SHOTS) {
        this.state = 'done';
        m.fx.banner(L2('FINAL SCORE', 'TOPLAM PUAN'), String(this.points), '#ffd23f', 3);
        m.endMode();
      } else this.place();
    }
  }

  goal(team: Team) {
    if (this.state === 'flight' && team === this.shooter.team) this.resolve('goal');
    return true;
  }

  private resolve(r: KickResult) {
    const m = this.m;
    const P = m.pitch;
    this.state = 'result';
    this.t = 0;
    let pts = 0;
    if (r === 'goal') {
      const tags: string[] = [];
      let base = 100 + Math.max(0, Math.round((this.spot.d - 16) * 8));
      const c = this.cross ?? { y: m.ball.y, z: m.ball.z };
      if (Math.abs(c.y) > P.goalHalf - 1.1) {
        base += 50;
        tags.push(L2('CORNER', 'KÖŞE'));
        if (c.z > P.goalHeight - 0.9) {
          base += 50;
          tags.push(L2('TOP BIN', 'DOKSAN'));
        }
      }
      if (m.postHit[1] > 0) {
        base += 60;
        tags.push(L2('OFF THE POST', 'DİREKTEN'));
      }
      if (Math.abs(this.spinAtKick) > 0.45) {
        base += 40;
        tags.push(L2('CURLER', 'FALSO'));
      }
      const mult = 1 + 0.25 * Math.min(this.streak, 4);
      pts = Math.round(base * mult);
      this.points += pts;
      this.goals++;
      this.streak++;
      this.shooter.goals++;
      this.shooter.team.score++;
      const team = this.shooter.team;
      m.fx.goalExplosion(team.goalfx, P.hw + 1, 0, [team.def.primary, team.def.secondary, '#ffffff', '#ffd23f']);
      m.fx.banner(`${L2('GOAL', 'GOL')}! +${pts}`, tags.join(' · ') + (mult > 1 ? ` · x${mult}` : ''), team.def.primary, 1.8);
      m.fx.addShake(0.5);
      m.fx.doFlash(0.35);
      audio.horn();
      audio.cheer(1);
      m.excitement = 1;
    } else {
      this.streak = 0;
      const txt = r === 'save' ? L2('SAVED!', 'KURTARDI!') : r === 'wall' ? L2('THE WALL!', 'BARAJ!') : L2('MISSED', 'AUT');
      m.fx.banner(txt, '', r === 'save' ? '#7fe8ff' : '#ff9d7a', 1.4);
      audio.groan();
    }
    this.log.push({ r, pts, d: Math.round(this.spot.d) });
  }
}

// ---------------------------------------------------------------- wall duel

export class Duel implements ModeLogic {
  clock = true;
  constructor(private m: Match) {}

  setup() {
    const [home, away] = this.m.teams;
    const me = pickPlayer(home.players, (p) => p.skill * 0.4 + p.power * 0.3 + p.pace * 0.3);
    const them = pickPlayer(away.players, (p) => p.skill * 0.4 + p.power * 0.3 + p.pace * 0.3);
    home.players = [me];
    away.players = [them];
    this.m.all = [me, them];
  }

  kickoff(kt: Team) {
    const m = this.m;
    const P = m.pitch;
    const b = m.ball;
    for (const team of m.teams) {
      const p = team.players[0];
      const s = team.side;
      p.vx = p.vy = 0;
      p.y = 0;
      if (team === kt) {
        p.x = -s * 3.5;
        p.face = s > 0 ? 0 : Math.PI;
        b.owner = p;
        b.lastTouch = p;
        b.x = p.x + s * 0.6;
        b.y = 0;
      } else {
        p.x = -s * (P.hw - 1.8);
        p.face = s > 0 ? 0 : Math.PI;
      }
    }
  }

  ai(dt: number) {
    for (const team of this.m.teams) duelAI(this.m, team, dt);
  }

  /**
   * Striker and keeper at once: near his own goal a player catches what he can reach
   * (a better player holds harder shots) and parries the rest.
   */
  step() {
    const m = this.m;
    const P = m.pitch;
    const b = m.ball;
    if (b.owner || b.inGoal) return;
    for (const p of m.all) {
      if (!p.canAct && p.state !== 'slide') continue;
      if (b.lockPlayer === p) continue;
      const s = p.team.side;
      const ownX = -s * P.hw;
      if (Math.abs(p.x - ownX) > P.hw * 0.5) continue;
      if (b.vx * s > -3) continue; // only balls heading for his own goal
      // arms out: a keeper's reach (the AI's grows with the difficulty), more when diving in a slide
      const reach = (m.isHuman(p) ? 1.25 : 0.85 + (p.team.diff.iq ?? 0.8) * 0.45) + (p.state === 'slide' ? 0.5 : 0);
      if (dist(p.x, p.y, b.x, b.y) > reach || b.z > 2.1) continue;
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      const hold = 21 + p.skill * 8 + (m.isHuman(p) ? 3 : p.team.diff.gkCatch * 0.1 - 2.2);
      const shot = !!b.shotBy && b.shotBy !== p.team;
      if (sp < hold && p.canAct) {
        m.setOwner(p);
        if (shot && sp > 11) {
          p.saves++;
          p.team.stats.saves++;
          m.fx.text(p.x, p.y, 0.4, t().saved, '#7fe8ff', 1);
          audio.catchBall();
        }
      } else {
        // parry: away from the goal and out to the side
        b.vx = Math.abs(b.vx) * 0.3 * s + rand(0, 2) * s;
        b.vy = (b.y >= p.y ? 1 : -1) * rand(4, 8) + b.vy * 0.2;
        b.vz = rand(2, 4.5);
        b.lockPlayer = p;
        b.lockTime = 0.3;
        b.prevTouch = b.lastTouch;
        b.lastTouch = p;
        b.shotBy = null;
        if (shot) {
          p.saves++;
          p.team.stats.saves++;
          m.fx.text(p.x, p.y, 0.4, t().parried, '#7fe8ff', 1);
        }
        m.fx.impact(b.x, b.y, b.z);
        audio.hit(0.5);
      }
      return;
    }
  }

  /** the invisible wall: nobody crosses the halfway line */
  constrain() {
    for (const p of this.m.all) {
      const lim = 0.45;
      if (p.team.side > 0 && p.x > -lim) {
        p.x = -lim;
        p.vx = Math.min(0, p.vx);
      } else if (p.team.side < 0 && p.x < lim) {
        p.x = lim;
        p.vx = Math.max(0, p.vx);
      }
    }
  }
}
