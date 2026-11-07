import { Ball, DIFF, Difficulty, makePitch, PHYS, Pitch, Player, PState, Role, Team } from './entities';
import { TeamDef } from './teams';
import { FX } from './fx';
import { audio, vibrate } from '../engine/audio';
import { clamp, dist, gauss, norm, pick, rand, rotateToward, sign, angleDiff, segDist } from '../engine/math';
import { Input } from '../engine/input';
import { settings } from '../engine/storage';
import { t } from '../engine/i18n';
import { runTeamAI, formationSpot } from './ai';
import type { CardData } from '../meta/cards';
import { POWER_ID } from '../meta/items';

export type Phase = 'intro' | 'kickoff' | 'play' | 'goal' | 'fulltime' | 'over';

export interface MatchConfig {
  home: TeamDef;
  away: TeamDef;
  size: number;
  duration: number;
  difficulty: Difficulty;
  demo: boolean;
  /** home squad from the user's club (slot 0 = GK) */
  homeCards?: CardData[];
  /** id of the user's own created player */
  starId?: string | null;
  loadout?: { power: string; goalfx: string; trail: string };
}

interface Frame {
  p: number[][];
  b: number[];
}
const STATES: PState[] = ['run', 'slide', 'down', 'recover', 'shove', 'spin', 'dive', 'celebrate', 'sad'];
const REPLAY_FRAMES = 60 * 3.3;

const ROLES: Record<number, Role[]> = {
  3: ['GK', 'DEF', 'FWD'],
  4: ['GK', 'DEF', 'MID', 'FWD'],
  5: ['GK', 'DEF', 'DEF', 'MID', 'FWD'],
};

export class Match {
  pitch: Pitch;
  teams: [Team, Team];
  all: Player[] = [];
  ball = new Ball();
  phase: Phase = 'intro';
  phaseT = 0;
  clock: number;
  time = 0;
  human: Player | null = null;
  private lastSwitch = 0;
  kickoffTeam: Team;
  excitement = 0.25;
  lastGoal: { team: Team; scorer: Player | null; own: boolean } | null = null;
  onEnd: (() => void) | null = null;
  private countShown = -1;
  /** player the human would pass to (for UI hint) */
  passHint: Player | null = null;
  /** human aim direction (for the aim arrow) */
  aimX = 1;
  aimY = 0;
  /** where the human's ball would go (for the aim line) */
  aim: { x: number; y: number; kind: 'shot' | 'pass' | 'free' } | null = null;
  goalFlash = 0;

  // ---- action replay
  private history: Frame[] = [];
  private replay: Frame[] | null = null;
  replayT = 0;
  private replayDone = false;
  get replaying() {
    return this.replay !== null;
  }

  constructor(public cfg: MatchConfig, public fx: FX) {
    this.pitch = makePitch(cfg.size);
    this.clock = cfg.duration;
    const home = new Team(cfg.home, 0, 1, !cfg.demo, cfg.demo ? DIFF.normal : DIFF.normal);
    const away = new Team(cfg.away, 1, -1, false, DIFF[cfg.difficulty]);
    home.opp = away;
    away.opp = home;
    this.teams = [home, away];
    for (const team of this.teams) {
      const roles = ROLES[cfg.size] ?? ROLES[4];
      const names = [...team.def.names].sort(() => Math.random() - 0.5);
      const nums = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 17, 19, 23].sort(() => Math.random() - 0.5);
      const cards = team.index === 0 ? cfg.homeCards : undefined;
      roles.forEach((r, i) => {
        const card = cards?.[i];
        const p = new Player(team, i, r, card ? card.name.split(' ').pop()! : names[i % names.length], r === 'GK' ? 1 : nums[i]);
        if (r === 'FWD') p.number = pick([9, 10, 11, 7]);
        if (card) {
          p.applyCard(card);
          p.star = !!cfg.starId && card.id === cfg.starId;
        }
        team.players.push(p);
        this.all.push(p);
      });
    }
    if (cfg.loadout) {
      home.power = POWER_ID(cfg.loadout.power);
      home.goalfx = cfg.loadout.goalfx;
      home.trail = cfg.loadout.trail;
    }
    this.kickoffTeam = Math.random() < 0.5 ? home : away;
    this.setupKickoff(this.kickoffTeam);
    this.phase = 'intro';
  }

  get homeTeam() {
    return this.teams[0];
  }

  // ---------------------------------------------------------------- setup

  setupKickoff(kt: Team) {
    const P = this.pitch;
    const b = this.ball;
    b.reset();
    this.kickoffTeam = kt;
    for (const team of this.teams) {
      const field = team.players.filter((p) => !p.isGK);
      for (const p of team.players) {
        p.setState('run');
        p.vx = p.vy = 0;
        p.z = 0;
        p.charge = 0;
        p.chargeKind = 'none';
        p.stamina = Math.max(p.stamina, 0.7);
        p.exhausted = false;
        p.invuln = p.kickCd = p.tackleCd = p.spinCd = 0;
        p.face = team.side > 0 ? 0 : Math.PI;
        if (p.isGK) {
          p.x = -team.side * (P.hw - 1.2);
          p.y = 0;
        } else {
          const [x, y] = formationSpot(this, p, 'kickoff');
          p.x = x;
          p.y = y;
          if (team !== kt) {
            // stay out of the centre circle
            const d = Math.hypot(p.x, p.y);
            if (d < P.centerR + 1) {
              const k = (P.centerR + 1) / Math.max(d, 0.01);
              p.x *= k;
              p.y *= k;
              if (Math.sign(p.x) === team.side) p.x = -team.side * (P.centerR + 1);
            }
          }
        }
      }
      if (team === kt) {
        const kicker = field[field.length - 1];
        kicker.x = -team.side * 0.65;
        kicker.y = 0;
        if (field.length > 1) {
          const sup = field[field.length - 2];
          sup.x = -team.side * 4.5;
          sup.y = 4;
        }
        b.owner = kicker;
        b.lastTouch = kicker;
        b.x = kicker.x + team.side * 0.6;
      }
    }
    // human control
    const ht = this.teams[0];
    if (ht.human) {
      const field = ht.players.filter((p) => !p.isGK);
      this.human = kt === ht ? field[field.length - 1] : field.reduce((a, c) => (Math.abs(c.x) < Math.abs(a.x) ? c : a));
      const star = field.find((p) => p.star);
      if (star && kt !== ht) this.human = star;
    } else this.human = null;
    this.countShown = -1;
  }

  start() {
    this.phase = 'intro';
    this.phaseT = 0;
    if (!this.cfg.demo) {
      this.fx.banner(`${this.teams[0].def.name}`, `${t().vs}  ${this.teams[1].def.name}`, '#fff', 2.2);
    }
  }

  // ---------------------------------------------------------------- loop

  step(dt: number, input: Input | null) {
    this.time += dt;
    this.phaseT += dt;
    this.goalFlash = Math.max(0, this.goalFlash - dt);

    switch (this.phase) {
      case 'intro':
        if (this.phaseT > (this.cfg.demo ? 0.5 : 2.2)) this.toPhase('kickoff');
        break;
      case 'kickoff': {
        const left = 3 - this.phaseT;
        const n = Math.ceil(left);
        if (this.cfg.demo) {
          if (this.phaseT > 1) this.beginPlay();
        } else if (n !== this.countShown && n > 0) {
          this.countShown = n;
          this.fx.banner(String(n), '', '#ffd23f', 0.9);
          audio.countdown(false);
        }
        if (left <= 0 && this.phase === 'kickoff') this.beginPlay();
        break;
      }
      case 'play':
        this.clock -= dt;
        if (this.clock <= 0) {
          this.clock = 0;
          this.toPhase('fulltime');
          audio.whistle('final');
          audio.cheer(0.8);
          this.fx.banner(t().fulltime, `${this.teams[0].score} - ${this.teams[1].score}`, '#fff', 3.5);
          for (const p of this.all) {
            if (p.state === 'run' || p.state === 'spin') p.setState('run');
            p.chargeKind = 'none';
          }
        }
        break;
      case 'goal': {
        const skip = !!input && this.replay !== null && this.replayT > 0.4 && (input.btn.a.pressed || input.btn.b.pressed || input.btn.d.pressed);
        if (this.replay === null && !this.replayDone && this.phaseT > 2.3 && this.history.length > 30 && !this.cfg.demo) this.startReplay();
        if (this.replay !== null) {
          this.replayT += dt * 0.65;
          if (!this.applyReplayFrame() || skip) this.endReplay();
        }
        const done = this.cfg.demo ? this.phaseT > 3.4 : this.replayDone && this.phaseT > 2.6;
        if (done) {
          if (this.clock <= 0) {
            this.toPhase('fulltime');
            audio.whistle('final');
          } else {
            this.setupKickoff(this.lastGoal!.team.opp);
            this.toPhase('kickoff');
          }
        }
        break;
      }
      case 'fulltime':
        if (this.phaseT > 3.6) {
          this.phase = 'over';
          this.onEnd?.();
        }
        break;
    }

    const live = this.phase === 'play';
    if (live) {
      if (input && this.teams[0].human) this.controlHuman(input, dt);
      for (const team of this.teams) runTeamAI(this, team, dt);
    } else if (this.phase === 'goal') {
      if (this.replay !== null) {
        this.updateExcitement(dt);
        return;
      }
      this.celebrate(dt);
    } else if (this.phase === 'fulltime') {
      for (const p of this.all) {
        p.ix *= 0.9;
        p.iy *= 0.9;
        p.wantSprint = false;
      }
    } else {
      for (const p of this.all) {
        p.ix = p.iy = 0;
        p.wantSprint = false;
      }
    }

    if (this.phase !== 'intro' && this.phase !== 'kickoff') {
      for (const p of this.all) this.updatePlayer(p, dt);
      this.collidePlayers();
    }
    this.updateBall(dt);
    if (live) {
      this.interactions(dt);
      this.unstickBall(dt);
      this.record();
      this.checkGoal();
      const o = this.ball.owner;
      if (o) o.team.stats.possession += dt;
    }
    this.updateExcitement(dt);
  }

  private stuckT = 0;
  /**
   * Failsafe: if the free ball sits somewhere nobody can reach (on the goal
   * roof, wedged behind the goal line, hanging high) give it to the keeper.
   */
  private unstickBall(dt: number) {
    const b = this.ball;
    const P = this.pitch;
    if (b.owner || b.inGoal) {
      this.stuckT = 0;
      return;
    }
    const slow = Math.hypot(b.vx, b.vy) < 2.5;
    const behindLine = Math.abs(b.x) > P.hw + 0.05 && Math.abs(b.y) < P.goalHalf + 0.6;
    const hanging = b.z > 1.2 && slow;
    if ((behindLine && slow) || hanging) this.stuckT += dt;
    else this.stuckT = 0;
    if (this.stuckT < 1.2) return;
    this.stuckT = 0;
    const end = b.x >= 0 ? 1 : -1;
    const team = this.teams.find((tm) => tm.side === -end)!;
    const g = team.gk;
    if (g.state !== 'run') g.setState('run');
    g.x = end * (P.hw - 1.2);
    g.y = clamp(b.y, -P.goalHalf + 0.5, P.goalHalf - 0.5);
    g.vx = g.vy = 0;
    b.z = 0;
    b.vx = b.vy = b.vz = 0;
    this.setOwner(g);
    g.holdT = 0;
  }

  private toPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    if (p === 'goal') this.replayDone = false;
    if (p === 'kickoff' || p === 'fulltime') {
      this.history.length = 0;
      this.replay = null;
    }
  }

  // ---------------------------------------------------------------- replay

  private record() {
    const b = this.ball;
    const f: Frame = {
      p: this.all.map((p) => [p.x, p.y, p.z, p.vx, p.vy, p.face, STATES.indexOf(p.state), p.stateT, p.stateDur, p.runPhase, p.kickAnim]),
      b: [b.x, b.y, b.z, b.rot, b.fire, b.owner ? this.all.indexOf(b.owner) : -1, b.vx, b.vy],
    };
    this.history.push(f);
    if (this.history.length > REPLAY_FRAMES) this.history.shift();
  }

  private startReplay() {
    this.replay = this.history.slice();
    this.replayT = 0;
    this.saved = this.all.map((p) => [p.x, p.y, p.z, p.vx, p.vy, p.face, STATES.indexOf(p.state), p.stateT, p.stateDur, p.runPhase, p.kickAnim]);
    this.savedBall = [this.ball.x, this.ball.y, this.ball.z, this.ball.inGoal];
    this.fx.particles.length = 0;
    this.fx.texts.length = 0;
    this.fx.banners.length = 0;
    audio.whoosh();
  }

  private saved: number[][] = [];
  private savedBall: number[] = [];

  private applyReplayFrame(): boolean {
    const R = this.replay!;
    const i = Math.floor(this.replayT * 60);
    if (i >= R.length) return false;
    const f = R[i];
    this.all.forEach((p, k) => {
      const a = f.p[k];
      [p.x, p.y, p.z, p.vx, p.vy, p.face] = a;
      p.state = STATES[a[6]];
      p.stateT = a[7];
      p.stateDur = a[8];
      p.runPhase = a[9];
      p.kickAnim = a[10];
    });
    const b = this.ball;
    const [x, y, z, rot, fire, oi, vx, vy] = f.b;
    b.x = x; b.y = y; b.z = z; b.rot = rot; b.fire = fire; b.vx = vx; b.vy = vy;
    b.owner = oi >= 0 ? this.all[oi] : null;
    b.inGoal = 0;
    if (Math.hypot(vx, vy) > 16 || fire > 0) {
      b.trail.push({ x, y, z });
      if (b.trail.length > 10) b.trail.shift();
    } else if (b.trail.length) b.trail.shift();
    if (fire > 0) this.fx.powerTrail(b.power, x, y, z + 0.2);
    return true;
  }

  private endReplay() {
    // restore the celebration state
    this.all.forEach((p, k) => {
      const a = this.saved[k];
      [p.x, p.y, p.z, p.vx, p.vy, p.face] = a;
      p.state = STATES[a[6]];
      p.stateT = a[7];
      p.stateDur = a[8];
    });
    const b = this.ball;
    b.owner = null;
    [b.x, b.y, b.z, b.inGoal] = this.savedBall;
    b.vx = b.vy = b.vz = 0;
    b.trail.length = 0;
    this.replay = null;
    this.replayDone = true;
    this.phaseT = 2.0;
  }

  private beginPlay() {
    this.toPhase('play');
    audio.whistle('short');
    if (!this.cfg.demo) this.fx.banner(t().kickoff, '', '#fff', 0.9);
  }

  private updateExcitement(dt: number) {
    const b = this.ball;
    const P = this.pitch;
    const nearGoal = Math.max(0, (Math.abs(b.x) - P.hw * 0.45) / (P.hw * 0.55));
    let target = 0.18 + nearGoal * 0.45 + Math.min(0.2, b.speed / 120);
    if (this.phase === 'goal') target = 1;
    this.excitement += (target - this.excitement) * Math.min(1, dt * 1.5);
    audio.setCrowd(this.excitement);
  }

  // ---------------------------------------------------------------- human

  setHuman(p: Player) {
    if (this.human === p) return;
    if (this.human) {
      this.human.chargeKind = 'none';
      this.human.charge = 0;
    }
    this.human = p;
    this.lastSwitch = this.time;
  }

  private switchHuman() {
    const team = this.teams[0];
    const b = this.ball;
    const [bx, by] = b.predict(0.4);
    let best: Player | null = null;
    let bd = Infinity;
    for (const p of team.players) {
      if (p.isGK || p === this.human || p.state === 'down') continue;
      const d = dist(p.x, p.y, bx, by);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best) this.setHuman(best);
  }

  private controlHuman(inp: Input, dt: number) {
    const team = this.teams[0];
    const b = this.ball;
    if (b.owner && b.owner.team === team && !b.owner.isGK && b.owner !== this.human) this.setHuman(b.owner);
    const h = this.human;
    if (!h) return;

    // auto switch while defending / loose ball
    if (settings.autoSwitch && (!b.owner || b.owner.team !== team) && this.time - this.lastSwitch > 0.9 && h.chargeKind === 'none') {
      const target = b.passTarget && b.passTarget.team === team && !b.passTarget.isGK ? b.passTarget : null;
      if (target && target !== h) this.setHuman(target);
      else if (!target) {
        const [bx, by] = b.predict(0.3);
        const dh = dist(h.x, h.y, bx, by) + (h.state === 'down' ? 10 : 0);
        for (const p of team.players) {
          if (p.isGK || p === h || p.state === 'down') continue;
          if (dist(p.x, p.y, bx, by) < dh - 6 && dh > 8) {
            this.setHuman(p);
            break;
          }
        }
      }
    }

    const hp = this.human!;
    hp.ix = inp.mx;
    hp.iy = inp.my;
    hp.wantSprint = inp.btn.c.down;
    const stick = Math.hypot(inp.mx, inp.my) > 0.25;
    const dirX = stick ? inp.mx : hp.faceX;
    const dirY = stick ? inp.my : hp.faceY;
    const [ndx, ndy] = norm(dirX, dirY);
    const hasBall = b.owner === hp;
    this.aimX = ndx;
    this.aimY = ndy;

    // pass hint (light assist) and aim line target
    this.passHint = hasBall ? this.assistTarget(hp, ndx, ndy, hp.chargeKind === 'pass' && hp.charge > 0.35) : null;
    this.aim = null;
    if (hasBall) {
      const gt = this.aimAtGoal(hp, ndx, ndy);
      const dGoal = gt ? dist(hp.x, hp.y, gt[0], gt[1]) : 99;
      if (gt && (hp.chargeKind === 'shot' || dGoal < 24)) this.aim = { x: gt[0], y: gt[1], kind: 'shot' };
      else if (this.passHint) this.aim = { x: this.passHint.x + this.passHint.vx * 0.3, y: this.passHint.y + this.passHint.vy * 0.3, kind: 'pass' };
      else this.aim = { x: hp.x + ndx * 7, y: hp.y + ndy * 7, kind: 'free' };
    }

    // A: shoot / tackle / volley
    if (inp.btn.a.pressed && hp.canAct) {
      if (hasBall) {
        hp.chargeKind = 'shot';
        hp.charge = 0;
      } else if (!b.owner && b.z > 0.6 && dist(hp.x, hp.y, b.x, b.y) < 3) {
        hp.volleyT = 0.45;
      } else {
        this.tackleAction(hp, ndx, ndy, stick);
      }
    }
    if (hp.chargeKind === 'shot') {
      if (!hasBall || !hp.canAct) {
        hp.chargeKind = 'none';
      } else if (inp.btn.a.down) {
        hp.charge = Math.min(1.3, hp.charge + dt / 0.85);
      } else {
        const power = 0.3 + Math.min(1, hp.charge) * 0.7;
        const over = Math.max(0, hp.charge - 1);
        this.humanShoot(hp, ndx, ndy, power, over);
        hp.chargeKind = 'none';
        hp.charge = 0;
      }
    }

    // B: pass / switch
    if (inp.btn.b.pressed) {
      if (hasBall && hp.canAct) {
        hp.chargeKind = 'pass';
        hp.charge = 0;
      } else if (!hasBall) {
        this.switchHuman();
      }
    }
    if (hp.chargeKind === 'pass') {
      if (!hasBall || !hp.canAct) hp.chargeKind = 'none';
      else if (inp.btn.b.down) hp.charge = Math.min(1, hp.charge + dt / 0.7);
      else {
        const lob = hp.charge > 0.35;
        const q = this.assistTarget(hp, ndx, ndy, lob);
        if (q) {
          this.passTo(hp, q, lob);
          if (!q.isGK) this.setHuman(q);
        } else {
          // no assist: the ball goes exactly where you point
          const sp = lob ? 11 + hp.charge * 9 : 15;
          this.kick(hp, ndx * sp, ndy * sp, lob ? 5 + hp.charge * 4 : 0.3, 0.4);
        }
        hp.chargeKind = 'none';
        hp.charge = 0;
      }
    }

    // D: spin / power shot
    if (inp.btn.d.pressed && hp.canAct) {
      const areaPower = team.power === 'shockwave' || team.power === 'turbo';
      if (team.rage >= 1 && (hasBall || areaPower)) {
        const tgt = this.aimAtGoal(hp, ndx, ndy) ?? [hp.x + ndx * 20, hp.y + ndy * 20];
        this.powerShot(hp, tgt[0], tgt[1]);
      } else this.spin(hp);
    }
  }

  private humanShoot(p: Player, dx: number, dy: number, power: number, over: number) {
    const tgt = this.aimAtGoal(p, dx, dy);
    let ax = dx, ay = dy;
    if (tgt) [ax, ay] = norm(tgt[0] - p.x, tgt[1] - p.y);
    const pressure = this.pressureOn(p);
    const err = 0.025 + pressure * 0.05 + (1 - p.skill) * 0.03;
    this.shootDir(p, ax, ay, power, err, over);
  }

  /** Aim assist: if direction points at the goal area, pick a point inside the goal mouth. */
  aimAtGoal(p: Player, dx: number, dy: number): [number, number] | null {
    const P = this.pitch;
    const gx = p.team.side * P.hw;
    if (dx * p.team.side < 0.12) return null;
    const tt = (gx - p.x) / dx;
    const yAt = p.y + dy * tt;
    if (Math.abs(yAt) > P.goalHalf + 7 + Math.abs(gx - p.x) * 0.25) return null;
    const lim = P.goalHalf - 0.45;
    return [gx, clamp(yAt * 0.85, -lim, lim)];
  }

  private pressureOn(p: Player) {
    let m = 0;
    for (const q of p.team.opp.players) {
      const d = dist(p.x, p.y, q.x, q.y);
      if (d < 3 && q.canAct) m = Math.max(m, 1 - d / 3);
    }
    return m;
  }

  private tackleAction(p: Player, dx: number, dy: number, stick: boolean) {
    if (p.tackleCd > 0) return;
    // shove if anyone is right in front
    let target: Player | null = null;
    let bd = 1.75;
    for (const q of p.team.opp.players) {
      if (q.state === 'down' || q.state === 'recover') continue;
      const d = dist(p.x, p.y, q.x, q.y);
      if (d > bd) continue;
      const dot = ((q.x - p.x) * p.faceX + (q.y - p.y) * p.faceY) / Math.max(d, 0.01);
      if (dot > 0.1 || d < 1) {
        bd = d;
        target = q;
      }
    }
    if (target) {
      this.shove(p, target);
      return;
    }
    // slide with soft aim assist toward ball carrier / nearest opponent in the cone
    let ax = dx, ay = dy;
    let bestScore = 0;
    for (const q of p.team.opp.players) {
      if (q.state === 'down') continue;
      const lead = 0.25;
      const qx = q.x + q.vx * lead, qy = q.y + q.vy * lead;
      const d = dist(p.x, p.y, qx, qy);
      if (d > 5.5) continue;
      const [ux, uy] = norm(qx - p.x, qy - p.y);
      const cos = ux * dx + uy * dy;
      if (cos < (stick ? 0.9 : 0.75)) continue;
      const sc = cos + (this.ball.owner === q ? 0.5 : 0) - d * 0.03;
      if (sc > bestScore) {
        bestScore = sc;
        ax = ux;
        ay = uy;
      }
    }
    this.slide(p, ax, ay);
  }

  // ---------------------------------------------------------------- actions

  kick(p: Player, vx: number, vy: number, vz: number, power = 0.5) {
    const b = this.ball;
    if (b.owner && b.owner !== p) return;
    b.owner = null;
    b.x = p.x + p.faceX * 0.5;
    b.y = p.y + p.faceY * 0.5;
    b.vx = vx;
    b.vy = vy;
    b.vz = vz;
    b.z = Math.max(b.z, 0.12);
    b.prevTouch = b.lastTouch !== p ? b.lastTouch : b.prevTouch;
    b.lastTouch = p;
    b.lockPlayer = p;
    b.lockTime = 0.25;
    b.kickAge = 0;
    b.passTarget = null;
    b.shotBy = null;
    b.fire = 0;
    p.kickAnim = 0.3;
    p.possT = 0;
    p.face = Math.atan2(vy, vx);
    audio.kick(power);
  }

  shootDir(p: Player, dx: number, dy: number, power: number, err: number, over = 0) {
    const speed = (14 + power * 18) * (0.92 + p.power * 0.16);
    const ang = Math.atan2(dy, dx) + gauss() * err;
    let vz = 0.6 + power * 2.3 + over * 38 * rand(0.8, 1.2);
    if (power > 0.9 && over === 0) vz += rand(0, 1.5);
    this.kick(p, Math.cos(ang) * speed, Math.sin(ang) * speed, vz, power);
    const b = this.ball;
    b.shotBy = p.team;
    b.spin = gauss() * 0.3;
    p.shots++;
    p.team.stats.shots++;
    p.team.rage = Math.min(1, p.team.rage + 0.04);
    // on target?
    const P = this.pitch;
    const gx = p.team.side * P.hw;
    const tt = (gx - p.x) / (Math.cos(ang) * speed);
    if (tt > 0) {
      const yAt = p.y + Math.sin(ang) * speed * tt;
      if (Math.abs(yAt) < P.goalHalf && vz < 7) p.team.stats.onTarget++;
    }
    this.fx.addShake(0.08 + power * 0.12);
    if (power > 0.85) this.fx.emit('ring', b.x, b.y, 0.2, { n: 1, life: 0.3, size: 0.5, color: '#fff' });
  }

  shootAt(p: Player, tx: number, ty: number, power: number, err: number) {
    const [dx, dy] = norm(tx - p.x, ty - p.y);
    this.shootDir(p, dx, dy, power, err);
  }

  /** Use the team's equipped power (rage meter full). */
  powerShot(p: Player, tx: number, ty: number) {
    const team = p.team;
    if (team.rage < 1) return;
    const kind = team.power;
    const b = this.ball;
    if (kind === 'shockwave') return this.shockwave(p);
    if (kind === 'turbo') return this.turboRampage(p);
    if (b.owner !== p) return;
    team.rage = 0;
    team.stats.powerShots++;
    let [dx, dy] = norm(tx - p.x, ty - p.y);
    let sp = 34 + p.power * 4;
    let spin = 0;
    let vz = 1.2;
    const look = { fire: ['#ffb02e', '#ff8a1f'], ice: ['#bfe8ff', '#5fc8ff'], thunder: ['#fff6a0', '#3bd9ff'], banana: ['#fff07a', '#ffd21f'] } as const;
    let pk: 'fire' | 'ice' | 'thunder' | 'banana' = 'fire';
    if (kind === 'ice') { pk = 'ice'; sp = 31; }
    else if (kind === 'thunder') { pk = 'thunder'; sp = 44; vz = 0.6; }
    else if (kind === 'banana') {
      pk = 'banana';
      sp = 29;
      // start wide of the target and bend back in
      const side = (p.y > 0 ? 1 : -1) * team.side;
      const a = Math.atan2(dy, dx) + side * 0.62;
      dx = Math.cos(a);
      dy = Math.sin(a);
      spin = -side * 1.05;
      vz = 0.8;
    }
    this.kick(p, dx * sp, dy * sp, vz, 1);
    b.fire = 2.4;
    b.power = pk;
    b.spin = spin;
    b.shotBy = team;
    p.shots++;
    team.stats.shots++;
    for (const q of this.all) q.hitByFire = 0;
    audio.power();
    vibrate(60);
    this.fx.doFlash(0.6, look[pk][0]);
    this.fx.addShake(0.6);
    this.fx.slowmo(0.35, 0.35);
    this.fx.banner(this.powerName(kind), '', look[pk][1], 1.2, false);
    this.excitement = 1;
  }

  private powerName(kind: string) {
    const L = t();
    return ({ fireball: L.powerShotBanner, ice: L.pIce, thunder: L.pThunder, banana: L.pBanana, shockwave: L.pShock, turbo: L.pTurbo } as Record<string, string>)[kind] ?? L.powerShotBanner;
  }

  private shockwave(p: Player) {
    const team = p.team;
    team.rage = 0;
    team.stats.powerShots++;
    p.setState('shove', 0.35);
    for (const q of team.opp.players) {
      const d = dist(p.x, p.y, q.x, q.y);
      if (d < 6.5) {
        const [ux, uy] = norm(q.x - p.x, q.y - p.y);
        q.invuln = 0;
        this.knockdown(q, p, ux * (12 - d), uy * (12 - d), 1.8);
      }
    }
    for (let i = 0; i < 3; i++) this.fx.emit('ring', p.x, p.y, 0.1, { n: 1, life: 0.5 + i * 0.15, size: 1.6 + i * 0.6, color: '#d8b0ff' });
    this.fx.dust(p.x, p.y, 24);
    this.fx.emit('spark', p.x, p.y, 0.3, { n: 30, speed: 12, up: 4, life: 0.5, colors: ['#ffffff', '#d8b0ff', '#b04cff'] });
    audio.power();
    audio.hit(1);
    vibrate([50, 30, 80]);
    this.fx.doFlash(0.5, '#d8b0ff');
    this.fx.addShake(1);
    this.fx.banner(this.powerName('shockwave'), '', '#b04cff', 1.2, false);
    this.excitement = 1;
  }

  private turboRampage(p: Player) {
    const team = p.team;
    team.rage = 0;
    team.stats.powerShots++;
    p.turbo = 4;
    p.invuln = 0.2;
    p.stamina = 1;
    audio.power();
    vibrate(60);
    this.fx.doFlash(0.4, '#ff6a4a');
    this.fx.addShake(0.5);
    this.fx.banner(this.powerName('turbo'), '', '#ff3b30', 1.2, false);
    this.excitement = 1;
  }

  /**
   * Light pass assist: snaps to a teammate near the aim direction.
   * A tap (ground pass) prefers the nearest sensible option; a held (lofted)
   * pass may look further. Close teammates get a wider angular window, because
   * a small sideways offset is a big angle up close.
   */
  assistTarget(p: Player, dx: number, dy: number, lob = false): Player | null {
    if (!settings.passAssist) return null;
    let best: Player | null = null;
    let bs = -Infinity;
    const maxD = lob ? 34 : 24;
    for (const q of p.team.players) {
      if (q === p || q.state === 'down') continue;
      // lead a running teammate a little, like the pass itself does
      const qx = q.x + q.vx * 0.25, qy = q.y + q.vy * 0.25;
      const ox = qx - p.x, oy = qy - p.y;
      const d = Math.hypot(ox, oy);
      if (d < 2.5 || d > maxD) continue;
      const along = ox * dx + oy * dy;
      if (along <= 0) continue;
      const cos = along / d;
      const lat = Math.abs(ox * -dy + oy * dx);
      // ~40° window up close, narrowing to ~20° far away
      const minCos = clamp(0.76 + d * 0.008, 0.76, 0.94);
      if (cos < minCos || lat > 2.2 + d * 0.15) continue;
      let lane = 0;
      if (!lob) {
        for (const o of p.team.opp.players) {
          if (o.state === 'down') continue;
          const sd = segDist(o.x, o.y, p.x, p.y, q.x, q.y);
          if (sd < 1.1) lane += 1.1 - sd;
        }
      }
      const sc = cos * 3 - lat * 0.35 - d * (lob ? 0.015 : 0.07) - lane * 0.8 - (q.isGK ? 1.5 : 0);
      if (sc > bs) {
        bs = sc;
        best = q;
      }
    }
    return best;
  }

  bestPassTarget(p: Player, dx: number, dy: number, directional: boolean): Player | null {
    let best: Player | null = null;
    let bs = -Infinity;
    for (const q of p.team.players) {
      if (q === p || q.state === 'down') continue;
      const ox = q.x - p.x, oy = q.y - p.y;
      const d = Math.hypot(ox, oy);
      if (d < 2.5 || d > 38) continue;
      const cos = (ox * dx + oy * dy) / d;
      if (directional && cos < 0.35) continue;
      let open = 6;
      let lane = 0;
      for (const o of p.team.opp.players) {
        open = Math.min(open, dist(q.x, q.y, o.x, o.y));
        const sd = segDist(o.x, o.y, p.x, p.y, q.x, q.y);
        if (sd < 1.3) lane += 1.3 - sd;
      }
      const fwd = (ox * p.team.side) / 30;
      const sc = cos * (directional ? 3 : 0.8) - d / 30 + open / 6 - lane * 0.9 + fwd * 0.6 - (q.isGK ? 1.5 : 0);
      if (sc > bs) {
        bs = sc;
        best = q;
      }
    }
    return best;
  }

  passTo(p: Player, q: Player, lob: boolean) {
    const d0 = dist(p.x, p.y, q.x, q.y);
    if (lob) {
      const T = clamp(0.65 + d0 * 0.035, 0.8, 1.6);
      const tx = q.x + q.vx * T * 0.8, ty = q.y + q.vy * T * 0.8;
      const d = dist(p.x, p.y, tx, ty);
      const [ux, uy] = norm(tx - p.x, ty - p.y);
      const h = (d / T) * 0.97;
      this.kick(p, ux * h, uy * h, (PHYS.gravity * T) / 2, 0.6);
    } else {
      let sp = clamp(8 + d0 * 0.72, 10, 25);
      const tt = d0 / sp;
      const tx = q.x + q.vx * tt * 0.75, ty = q.y + q.vy * tt * 0.75;
      const d = dist(p.x, p.y, tx, ty);
      sp = clamp(8 + d * 0.72, 10, 25);
      const [ux, uy] = norm(tx - p.x, ty - p.y);
      this.kick(p, ux * sp, uy * sp, 0.4, 0.35);
    }
    this.ball.passTarget = q;
  }

  slide(p: Player, dx: number, dy: number) {
    if (p.tackleCd > 0 || !p.canAct) return;
    // slides cost stamina: a tired player can't keep flying in
    if (p.stamina < PHYS.slideStamina) {
      if (p === this.human) this.fx.text(p.x, p.y, 0.3, '...', '#ccc', 0.7);
      p.tackleCd = 0.25;
      return;
    }
    p.stamina -= PHYS.slideStamina;
    p.setState('slide', PHYS.slideTime);
    p.face = Math.atan2(dy, dx);
    // exhausted legs = shorter, slower slide
    const sp = PHYS.slideSpeed * (0.86 + p.pace * 0.2) * (0.8 + Math.min(1, p.stamina + 0.3) * 0.2);
    p.vx = dx * sp;
    p.vy = dy * sp;
    p.tackleCd = 1.5;
    p.slideHit.clear();
    p.slideWhiff = true;
    p.chargeKind = 'none';
    audio.slide();
    this.fx.dust(p.x, p.y, 8, p.vx, p.vy);
    this.warnSlide(p, dx, dy);
  }

  /** AI players who see a slide coming may react with a dodge (skill + difficulty). */
  private warnSlide(p: Player, dx: number, dy: number) {
    for (const q of p.team.opp.players) {
      if (q === this.human || q.isGK || !q.canAct || q.spinCd > 0 || q.dodgeT >= 0) continue;
      const ox = q.x - p.x, oy = q.y - p.y;
      const d = Math.hypot(ox, oy);
      if (d > 5.5 || d < 0.3) continue;
      const along = (ox * dx + oy * dy) / d;
      if (along < 0.55) continue;
      const diff = q.team.diff;
      const carrier = this.ball.owner === q;
      const ch = diff.dodge * (0.35 + q.skill * 0.6) * (carrier ? 1 : 0.35);
      if (Math.random() >= ch) continue;
      q.dodgeT = diff.react * rand(0.35, 0.7);
      // sidestep perpendicular to the slide, away from its line
      const lat = ox * -dy + oy * dx;
      const s = lat >= 0 ? 1 : -1;
      q.dodgeX = -dy * s;
      q.dodgeY = dx * s;
    }
  }

  /** Chance that a slide connecting with q actually brings q down. */
  private slideLands(p: Player, q: Player): number {
    let c = 0.72 + (p.tackle - 0.55) * 1.0 - (q.power - 0.55) * 0.35 - (q.skill - 0.55) * 0.25;
    // a slide that has lost its speed is weak
    const sp = Math.hypot(p.vx, p.vy);
    c -= clamp((7 - sp) / 7, 0, 1) * 0.25;
    // head-on slides are easy to read; from the side / behind they're nasty
    const qs = Math.hypot(q.vx, q.vy);
    if (qs > 2 && sp > 0.1) {
      const dot = (p.vx * q.vx + p.vy * q.vy) / (sp * qs);
      if (dot < -0.4) c -= 0.06;
    }
    if (this.ball.owner !== q) c += 0.12;
    if (!q.team.human) c -= q.team.diff.slideRes;
    if (q.exhausted) c += 0.1;
    return clamp(c, 0.1, 0.92);
  }

  /** A slide made contact: stats decide between a knockdown, a poke and a shrug-off. */
  private resolveSlideHit(p: Player, q: Player) {
    const [ux, uy] = norm(p.vx, p.vy);
    if (q.invuln > 0) {
      this.knockdown(q, p, 0, 0); // shows DENIED
      return;
    }
    if (Math.random() < this.slideLands(p, q)) {
      this.knockdown(q, p, ux * 6 + p.vx * 0.3, uy * 6 + p.vy * 0.3, PHYS.downTime);
      return;
    }
    const b = this.ball;
    const show = q === this.human || p === this.human || Math.random() < 0.4;
    if (b.owner === q && Math.random() < 0.3) {
      // toe-poke: the ball squirts loose, but the carrier stays on his feet
      b.owner = null;
      b.vx = ux * 6 + q.vx * 0.3 + rand(-1.5, 1.5);
      b.vy = uy * 6 + q.vy * 0.3 + rand(-1.5, 1.5);
      b.vz = 1.2;
      b.z = 0.15;
      b.lockPlayer = q;
      b.lockTime = 0.3;
      b.prevTouch = q;
      b.lastTouch = p;
      b.kickAge = 0;
      q.kickCd = 0.3;
      audio.touch();
    } else if (show) {
      this.fx.text(q.x, q.y, 0.3, t().shrug, '#7fe8ff', 0.9);
    }
    // the slider bounces off a player he couldn't bring down
    p.vx *= 0.25;
    p.vy *= 0.25;
    q.vx = q.vx * 0.6 + ux * 1.5;
    q.vy = q.vy * 0.6 + uy * 1.5;
    q.invuln = Math.max(q.invuln, 0.2);
    this.fx.dust(q.x, q.y, 5, ux, uy);
    audio.hit(0.4);
  }

  shove(p: Player, q: Player) {
    if (p.tackleCd > 0 || !p.canAct) return;
    p.setState('shove', 0.3);
    const [ux, uy] = norm(q.x - p.x, q.y - p.y);
    p.face = Math.atan2(uy, ux);
    p.tackleCd = 0.75;
    p.vx += ux * 3;
    p.vy += uy * 3;
    const ok = this.knockdown(q, p, ux * 7.5 + p.vx * 0.2, uy * 7.5 + p.vy * 0.2, 1.05);
    if (!ok) audio.whoosh();
  }

  spin(p: Player) {
    if (p.spinCd > 0 || !p.canAct) return;
    p.setState('spin', 0.42);
    p.invuln = 0.48;
    p.spinCd = 1.25;
    audio.whoosh();
    this.fx.emit('ring', p.x, p.y, 0.1, { n: 1, life: 0.3, size: 0.6, color: 'rgba(255,255,255,0.8)' });
  }

  /** Keeper dive toward (tx, ty), sized so he arrives about when the ball does (tt seconds). */
  dive(g: Player, tx: number, ty: number, tt = 0.4) {
    if (!g.canAct) return;
    const [ux, uy] = norm(tx - g.x, ty - g.y);
    g.setState('dive', 0.55);
    g.diveDirX = ux;
    g.diveDirY = uy;
    // displacement after t seconds of a dive is sp * (1 - e^-2t) / 2
    const travel = Math.max(0.3, dist(g.x, g.y, tx, ty) - 0.55);
    const T = clamp(tt, 0.15, 0.55);
    const maxSp = 8.5 + g.pace * 2;
    const sp = clamp((travel * 2) / (1 - Math.exp(-2 * T)), 2.5, maxSp);
    g.vx = ux * sp;
    g.vy = uy * sp;
    this.fx.dust(g.x, g.y, 5);
  }

  knockdown(v: Player, a: Player | null, ix: number, iy: number, dur = PHYS.downTime): boolean {
    if (v.state === 'down' || v.state === 'recover' || this.phase !== 'play') return false;
    if (v.invuln > 0 || (v.isGK && this.ball.owner === v)) {
      // keepers holding the ball are protected (no cheap goals)
      this.fx.text(v.x, v.y, 0, t().denied, '#7fe8ff', 0.9);
      return false;
    }
    const b = this.ball;
    if (b.owner === v) {
      b.owner = null;
      b.vx = v.vx * 0.4 + ix * 0.55 + rand(-2, 2);
      b.vy = v.vy * 0.4 + iy * 0.55 + rand(-2, 2);
      b.vz = 2.8;
      b.z = 0.3;
      b.lockPlayer = v;
      b.lockTime = 0.6;
      b.lastTouch = v;
      b.kickAge = 0;
      if (a) {
        a.steals++;
        a.team.stats.tackles++;
      }
    }
    v.setState('down', dur * (1.12 - v.power * 0.22));
    v.vx = ix;
    v.vy = iy;
    v.chargeKind = 'none';
    v.charge = 0;
    v.kickCd = 0.3;
    this.fx.impact(v.x, v.y, 1.0);
    this.fx.dust(v.x, v.y, 10, ix, iy);
    this.fx.addShake(0.32);
    audio.hit(1);
    const humanInvolved = v === this.human || a === this.human;
    if (humanInvolved || Math.random() < 0.5) {
      this.fx.text(v.x, v.y, 0.2, pick(t().ko), a ? (a.team.index === 0 ? '#ffe14d' : '#ff6b5a') : '#fff', humanInvolved ? 1.15 : 0.85);
    }
    if (humanInvolved) vibrate(v === this.human ? [40, 30, 40] : 35);
    if (a && a.team !== v.team) {
      a.knockdowns++;
      a.team.stats.knockdowns++;
      const before = a.team.rage;
      a.team.rage = Math.min(1, a.team.rage + 0.1);
      if (before < 1 && a.team.rage >= 1 && a.team.human) {
        this.fx.banner(t().rageReady, '', '#ff8a1f', 1.6, false);
        audio.select();
      }
    }
    this.excitement = Math.min(1, this.excitement + 0.3);
    if (Math.random() < 0.4) audio.cheer(0.35);
    return true;
  }

  private steal(q: Player, o: Player) {
    const b = this.ball;
    o.kickCd = 0.55;
    o.chargeKind = 'none';
    this.setOwner(q);
    q.steals++;
    q.team.stats.tackles++;
    q.team.rage = Math.min(1, q.team.rage + 0.06);
    if (o === this.human || q === this.human) this.fx.text(q.x, q.y, 0, t().stolen, '#7fe8ff', 0.9);
    b.x = q.x + q.faceX * PHYS.dribbleDist;
    b.y = q.y + q.faceY * PHYS.dribbleDist;
  }

  setOwner(p: Player) {
    const b = this.ball;
    if (b.passTarget && b.lastTouch && b.lastTouch.team === p.team && b.lastTouch !== p) p.team.stats.passes++;
    if (b.lastTouch !== p) b.prevTouch = b.lastTouch;
    b.owner = p;
    b.lastTouch = p;
    b.passTarget = null;
    b.shotBy = null;
    b.fire = 0;
    b.spin = 0;
    b.vz = 0;
    p.possT = 0;
    p.holdT = 0;
    audio.touch();
  }

  // ---------------------------------------------------------------- physics

  private updatePlayer(p: Player, dt: number) {
    p.stateT += dt;
    p.tackleCd = Math.max(0, p.tackleCd - dt);
    p.spinCd = Math.max(0, p.spinCd - dt);
    p.kickCd = Math.max(0, p.kickCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.volleyT = Math.max(0, p.volleyT - dt);
    p.kickAnim = Math.max(0, p.kickAnim - dt);
    p.hitByFire = Math.max(0, p.hitByFire - dt);
    const b = this.ball;
    const hasBall = b.owner === p;
    p.sprinting = false;
    p.frozen = Math.max(0, p.frozen - dt);
    if (p.dodgeT >= 0) {
      p.dodgeT -= dt;
      if (p.dodgeT < 0) {
        if (this.phase === 'play' && p.canAct && p !== this.human) {
          this.spin(p);
          if (p.state === 'spin') {
            p.vx += p.dodgeX * 5;
            p.vy += p.dodgeY * 5;
          }
        }
        p.dodgeT = -1;
      }
    }
    if (p.turbo > 0) {
      p.turbo -= dt;
      p.invuln = Math.max(p.invuln, 0.05);
      p.stamina = 1;
      if (Math.random() < 0.7) this.fx.emit('fire', p.x - p.vx * 0.05, p.y - p.vy * 0.05, 0.6, { n: 1, speed: 0.5, up: 0.5, life: 0.3, size: 0.5, colors: [p.team.def.primary, '#ffb02e', '#ffffff'] });
      if (this.phase === 'play' && (p.state === 'run' || p.state === 'spin')) {
        for (const q of p.team.opp.players) {
          if (q.state === 'down' || q.state === 'recover') continue;
          if (dist(p.x, p.y, q.x, q.y) < 1.05) {
            const [ux, uy] = norm(q.x - p.x, q.y - p.y);
            q.invuln = 0;
            this.knockdown(q, p, ux * 9 + p.vx * 0.4, uy * 9 + p.vy * 0.4, 1.5);
          }
        }
      }
    }

    switch (p.state) {
      case 'run':
      case 'spin':
      case 'celebrate':
      case 'sad': {
        let mx = p.ix, my = p.iy;
        const mag = Math.hypot(mx, my);
        if (mag > 1) {
          mx /= mag;
          my /= mag;
        }
        const m = Math.min(1, mag);
        if (p.exhausted && p.stamina > 0.3) p.exhausted = false;
        const sprint = p.wantSprint && !p.exhausted && m > 0.3 && p.state !== 'sad';
        const diffMul = p.team.human ? 1 : p.team.diff.speedMul;
        let max = (sprint ? PHYS.sprintSpeed : PHYS.runSpeed) * (0.85 + p.pace * 0.27) * diffMul;
        if (hasBall) max *= 0.93;
        if (p.chargeKind !== 'none') max *= 0.75;
        if (p.state === 'spin') max *= 1.12;
        if (p.turbo > 0) max *= 1.5;
        if (p.state === 'sad') max *= 0.45;
        if (p.isGK) max *= 0.95;
        const tvx = mx * max, tvy = my * max;
        let dvx = tvx - p.vx, dvy = tvy - p.vy;
        const dv = Math.hypot(dvx, dvy);
        const acc = (hasBall ? 26 : PHYS.accel) * dt;
        if (dv > acc) {
          dvx *= acc / dv;
          dvy *= acc / dv;
        }
        p.vx += dvx;
        p.vy += dvy;
        if (m > 0.12) p.face = rotateToward(p.face, Math.atan2(my, mx), (hasBall ? 11 : 16) * dt);
        if (sprint) {
          p.sprinting = true;
          p.stamina -= dt * 0.26;
          if (p.stamina <= 0) {
            p.stamina = 0;
            p.exhausted = true;
          }
        } else p.stamina = Math.min(1, p.stamina + dt * (m < 0.2 ? 0.28 : 0.16));
        if (p.state === 'spin' && p.stateT > p.stateDur) p.setState('run');
        if (p.state === 'celebrate') p.z = Math.abs(Math.sin(p.stateT * 9)) * 0.35;
        break;
      }
      case 'slide': {
        const k = Math.exp(-2.6 * dt);
        p.vx *= k;
        p.vy *= k;
        if (Math.random() < 0.5) this.fx.dust(p.x, p.y, 1, p.vx, p.vy);
        // hits
        for (const q of this.all) {
          if (q === p || q.team === p.team || p.slideHit.has(q)) continue;
          if (q.state === 'down' || q.state === 'recover') continue;
          if (dist(p.x, p.y, q.x, q.y) < 0.85) {
            p.slideHit.add(q);
            p.slideWhiff = false;
            this.resolveSlideHit(p, q);
          }
        }
        if (p.stateT > p.stateDur) {
          // a whiffed slide leaves you on the floor for a while
          p.setState('recover', p.slideWhiff ? 0.8 : 0.45);
        }
        break;
      }
      case 'shove': {
        const k = Math.exp(-8 * dt);
        p.vx *= k;
        p.vy *= k;
        if (p.stateT > p.stateDur) p.setState('run');
        break;
      }
      case 'down': {
        const k = Math.exp(-4.5 * dt);
        p.vx *= k;
        p.vy *= k;
        p.stamina = Math.min(1, p.stamina + dt * 0.2);
        if (p.stateT > p.stateDur) p.setState('recover', 0.38);
        break;
      }
      case 'recover': {
        const k = Math.exp(-10 * dt);
        p.vx *= k;
        p.vy *= k;
        if (p.stateT > p.stateDur) p.setState('run');
        break;
      }
      case 'dive': {
        const k = Math.exp(-2 * dt);
        p.vx *= k;
        p.vy *= k;
        p.z = Math.sin(Math.min(1, p.stateT / p.stateDur) * Math.PI) * 0.55;
        if (p.stateT > p.stateDur) {
          p.z = 0;
          p.setState('recover', 0.55);
          this.fx.dust(p.x, p.y, 6);
        }
        break;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const spd = Math.hypot(p.vx, p.vy);
    p.runPhase += spd * dt * 2.1;

    // walls
    const P = this.pitch;
    const lx = P.hw + P.margin - 0.45, ly = P.hh + P.margin - 0.45;
    if (p.x < -lx) { p.x = -lx; p.vx = Math.max(0, p.vx); }
    if (p.x > lx) { p.x = lx; p.vx = Math.min(0, p.vx); }
    if (p.y < -ly) { p.y = -ly; p.vy = Math.max(0, p.vy); }
    if (p.y > ly) { p.y = ly; p.vy = Math.min(0, p.vy); }
    // keep out of the goal mouth (and the net)
    if (Math.abs(p.x) > P.hw - 0.15 && Math.abs(p.y) < P.goalHalf + 0.4) {
      const sx = sign(p.x);
      if (Math.abs(p.x) < P.hw + 0.6) {
        p.x = sx * (P.hw - 0.15);
        if (p.vx * sx > 0) p.vx = 0;
      } else {
        // behind the goal: push out sideways
        p.y = sign(p.y) * (P.goalHalf + 0.4);
      }
    }
  }

  private collidePlayers() {
    const n = this.all.length;
    const R2 = PHYS.playerR * 2;
    for (let i = 0; i < n; i++) {
      const a = this.all[i];
      if (a.state === 'down' || a.state === 'dive') continue;
      for (let j = i + 1; j < n; j++) {
        const c = this.all[j];
        if (c.state === 'down' || c.state === 'dive') continue;
        const dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < R2 && d > 1e-4) {
          const push = (R2 - d) / 2;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push;
          a.y -= uy * push;
          c.x += ux * push;
          c.y += uy * push;
        }
      }
    }
  }

  private updateBall(dt: number) {
    const b = this.ball;
    const P = this.pitch;
    const R = PHYS.ballR;
    b.kickAge += dt;
    if (b.lockTime > 0) {
      b.lockTime -= dt;
      if (b.lockTime <= 0) b.lockPlayer = null;
    }
    if (b.fire > 0) {
      b.fire -= dt;
      this.fx.powerTrail(b.power, b.x, b.y, b.z + 0.2);
      if (b.speed < 9) b.fire = 0;
    }

    if (b.owner) {
      const o = b.owner;
      if (o.isGK && o.state !== 'dive') {
        b.x = o.x + o.faceX * 0.35;
        b.y = o.y + o.faceY * 0.2 + 0.05;
        b.z = 1.05;
      } else if (o.state === 'dive') {
        b.x = o.x + o.diveDirX * 0.6;
        b.y = o.y + o.diveDirY * 0.6;
        b.z = o.z + 0.3;
      } else {
        const tx = o.x + o.faceX * PHYS.dribbleDist;
        const ty = o.y + o.faceY * PHYS.dribbleDist;
        const k = 1 - Math.exp(-25 * dt);
        b.x += (tx - b.x) * k;
        b.y += (ty - b.y) * k;
        b.z = Math.abs(Math.sin(o.runPhase * 0.5)) * 0.14;
      }
      b.vx = o.vx;
      b.vy = o.vy;
      b.vz = 0;
      b.rot += Math.hypot(o.vx, o.vy) * dt * 3;
      b.trail.length = 0;
      return;
    }

    const px = b.x, py = b.y;
    // curve
    if (b.spin !== 0 && (b.z > 0.05 || (b.fire > 0 && b.power === 'banana'))) {
      const c = b.spin * dt * 3;
      const vx = b.vx * Math.cos(c) - b.vy * Math.sin(c);
      const vy = b.vx * Math.sin(c) + b.vy * Math.cos(c);
      b.vx = vx;
      b.vy = vy;
    }
    b.spin *= Math.exp(-1.2 * dt);

    b.vz -= PHYS.gravity * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -2) {
        b.vz = -b.vz * PHYS.bounce;
        b.vx *= 0.92;
        b.vy *= 0.92;
      } else b.vz = 0;
    }
    const sp = Math.hypot(b.vx, b.vy);
    if (b.z <= 0.02) {
      const ns = Math.max(0, sp - (2.4 + 0.32 * sp) * dt);
      if (sp > 0) {
        b.vx *= ns / sp;
        b.vy *= ns / sp;
      }
    } else {
      const k = Math.exp(-0.1 * dt);
      b.vx *= k;
      b.vy *= k;
    }
    b.rot += sp * dt * 3;

    // equipped cosmetic trail of whoever touched it last
    if (b.fire <= 0 && sp > 11 && b.lastTouch && b.lastTouch.team.trail !== 'tr_basic') this.fx.ballTrail(b.lastTouch.team.trail, b.x, b.y, b.z + 0.25);
    // trail
    if (sp > 16 || b.fire > 0) {
      b.trail.push({ x: b.x, y: b.y, z: b.z });
      if (b.trail.length > 10) b.trail.shift();
    } else if (b.trail.length) b.trail.shift();

    if (b.inGoal) {
      const s = b.inGoal;
      const back = P.hw + P.goalDepth - R;
      if (b.x * s > back) {
        b.x = s * back;
        b.vx = -b.vx * 0.15;
        b.vy *= 0.5;
        if (Math.abs(b.vx) > 1 && this.phaseT < 0.2) this.fx.addShake(0.1);
      }
      if (b.x * s < P.hw + R) {
        b.x = s * (P.hw + R);
        b.vx = -b.vx * 0.2;
      }
      const lim = P.goalHalf - R;
      if (Math.abs(b.y) > lim) {
        b.y = sign(b.y) * lim;
        b.vy = -b.vy * 0.2;
      }
      if (b.z > P.goalHeight - R) {
        b.z = P.goalHeight - R;
        b.vz = -Math.abs(b.vz) * 0.2;
      }
      const k = Math.exp(-2.5 * dt);
      b.vx *= k;
      b.vy *= k;
      return;
    }

    // posts
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        if (b.z > P.goalHeight + R) continue;
        const pxp = sx * P.hw, pyp = sy * P.goalHalf;
        const dx = b.x - pxp, dy = b.y - pyp;
        const d = Math.hypot(dx, dy);
        if (d < R + 0.1 && d > 1e-4) {
          const ux = dx / d, uy = dy / d;
          const dot = b.vx * ux + b.vy * uy;
          if (dot < 0) {
            b.vx -= 1.75 * dot * ux;
            b.vy -= 1.75 * dot * uy;
            b.x = pxp + ux * (R + 0.11);
            b.y = pyp + uy * (R + 0.11);
            if (-dot > 6) {
              audio.post();
              this.fx.text(b.x, b.y, 0, t().post, '#fff', 0.9);
              this.fx.addShake(0.2);
              this.excitement = 1;
              audio.groan();
            }
          }
        }
      }
      // crossbar
      if (Math.abs(b.y) < P.goalHalf && Math.abs(b.z - P.goalHeight) < R + 0.08 && px * sx <= P.hw && b.x * sx > P.hw - R) {
        if (b.vx * sx > 0) {
          b.vx = -b.vx * 0.5;
          b.vz = b.z > P.goalHeight ? Math.abs(b.vz) + 2 : -Math.abs(b.vz);
          b.x = sx * (P.hw - R);
          if (Math.abs(b.vx) > 4) {
            audio.post();
            this.fx.text(b.x, b.y, b.z, t().post, '#fff', 0.9);
            audio.groan();
          }
        }
      }
      // side netting from outside
      if (b.x * sx > P.hw && Math.abs(py) >= P.goalHalf && Math.abs(b.y) < P.goalHalf + R && b.z < P.goalHeight) {
        b.y = sign(py) * (P.goalHalf + R);
        b.vy = -b.vy * 0.25;
        b.vx *= 0.6;
      }
      // roof netting
      if (b.x * sx > P.hw && b.x * sx < P.hw + P.goalDepth && Math.abs(b.y) < P.goalHalf && b.z < P.goalHeight + R && b.z > P.goalHeight - 0.3 && b.vz < 0 && px * sx > P.hw) {
        b.z = P.goalHeight + R;
        b.vz = -b.vz * 0.2;
        b.vx *= 0.5;
        b.vy *= 0.5;
        // the roof net sags: a ball that settles up there rolls back onto the pitch
        if (Math.abs(b.vz) < 1.5 && Math.hypot(b.vx, b.vy) < 3) {
          b.vx = -sx * rand(4, 5.5);
          b.vy = rand(-1.5, 1.5);
          b.vz = 1.2;
        }
      }
    }

    // goal mouth entry
    for (const sx of [-1, 1]) {
      if (b.x * sx > P.hw + R && px * sx <= P.hw + R && Math.abs(b.y) < P.goalHalf - R * 0.5 && b.z < P.goalHeight - R) {
        b.inGoal = sx;
        return;
      }
    }

    // outer boards
    const ex = P.hw + P.margin - R, ey = P.hh + P.margin - R;
    if (Math.abs(b.y) > ey) {
      b.y = sign(b.y) * ey;
      b.vy = -b.vy * PHYS.wallBounce;
      if (Math.abs(b.vy) > 6) audio.touch();
    }
    if (Math.abs(b.x) > ex) {
      b.x = sign(b.x) * ex;
      b.vx = -b.vx * PHYS.wallBounce;
      if (Math.abs(b.vx) > 6) audio.touch();
    }
  }

  private interactions(dt: number) {
    const b = this.ball;
    if (b.owner) {
      const o = b.owner;
      o.possT += dt;
      if (o.isGK) {
        o.holdT += dt;
        return;
      }
      if (o.invuln > 0 || o.possT < 0.3) return;
      for (const q of o.team.opp.players) {
        if (!q.canAct || q.kickCd > 0 || q.isGK) continue;
        if (dist(q.x, q.y, b.x, b.y) > 0.78) continue;
        // the human wins the ball more easily; AI robs the human less often
        const mul = q === this.human ? o.team.diff.humanEdge : q.team.human ? 1 : q.team.diff.stealMul * (o === this.human ? q.team.diff.vsHuman : 1);
        const rate = (0.5 + q.tackle * 2.1) * mul - o.skill * 1.0;
        if (Math.random() < Math.max(0.15, rate) * dt) {
          this.steal(q, o);
          return;
        }
      }
      return;
    }

    let best: Player | null = null;
    let bd = Infinity;
    for (const p of this.all) {
      if (p === b.lockPlayer) continue;
      if (p.state === 'down' || p.state === 'recover' || p.state === 'celebrate' || p.state === 'sad') continue;
      const d = dist(p.x, p.y, b.x, b.y);
      if (d > 1.6) continue;
      // fireball flattens everyone in its path
      if (b.fire > 0 && p !== b.lastTouch && d < 0.95 && b.z < 2.3 && p.hitByFire <= 0) {
        p.hitByFire = 1.5;
        this.powerHit(p);
        b.vx *= b.power === 'thunder' ? 0.95 : 0.9;
        b.vy *= b.power === 'thunder' ? 0.95 : 0.9;
        continue;
      }
      if (p.isGK) {
        if (this.gkTouch(p, d)) return;
        continue;
      }
      if (p.kickCd > 0) continue;
      if (p.state === 'slide') {
        if (d < 0.9 && b.z < 0.7) {
          const [ux, uy] = norm(p.vx, p.vy);
          b.vx = ux * 8 + p.vx * 0.3 + rand(-1.5, 1.5);
          b.vy = uy * 8 + p.vy * 0.3 + rand(-1.5, 1.5);
          b.vz = 1.5;
          b.lastTouch = p;
          b.lockPlayer = p;
          b.lockTime = 0.2;
          b.kickAge = 0;
          b.shotBy = null;
          audio.touch();
        }
        continue;
      }
      if (p.state === 'dive' || p.state === 'shove') continue;
      // airborne ball: header / volley / chest
      if (b.z > 0.85 && b.z < 2.3 && d < 0.8) {
        this.airTouch(p);
        return;
      }
      // soft ball magnet for the controlled player
      if (p === this.human && p.canAct && b.z < 0.7 && d < 1.8 && d > 0.3 && b.speed < 11) {
        b.vx += ((p.x - b.x) / d) * 7 * dt;
        b.vy += ((p.y - b.y) / d) * 7 * dt;
      }
      const reach = p === this.human ? 1.0 : PHYS.pickupR;
      if (b.z <= (p === this.human ? 1.0 : 0.85) && d < reach && d < bd) {
        bd = d;
        best = p;
      }
    }
    if (!best) return;
    const p = best;
    const rel = Math.hypot(b.vx - p.vx, b.vy - p.vy);
    const limit = 15 + p.skill * 7 + (b.passTarget === p ? 9 : 0) + (p === this.human ? 8 : 0);
    if (rel > 25 && b.z > 0.25 && b.lastTouch && b.lastTouch.team !== p.team) {
      this.fx.text(p.x, p.y, 0.4, t().bonk, '#fff', 1);
      this.knockdown(p, b.lastTouch, b.vx * 0.25, b.vy * 0.25, 1.2);
      this.deflect(p, 0.35);
    } else if (rel > limit) {
      this.deflect(p, 0.45);
    } else {
      if (p.volleyT > 0 && b.z > 0.3 && p === this.human) {
        this.airTouch(p);
        return;
      }
      this.setOwner(p);
    }
  }

  /** A power shot ploughs through a player. */
  private powerHit(p: Player) {
    const b = this.ball;
    const by = b.lastTouch;
    if (b.power === 'ice') {
      p.invuln = 0;
      if (this.knockdown(p, by, b.vx * 0.15, b.vy * 0.15, 2.4)) {
        p.frozen = 2.4;
        this.fx.emit('spark', p.x, p.y, 1, { n: 14, speed: 5, up: 3, life: 0.6, colors: ['#ffffff', '#bfe8ff', '#5fc8ff'] });
      }
    } else if (b.power === 'thunder') {
      this.knockdown(p, by, b.vx * 0.3, b.vy * 0.3, 2.0);
      this.fx.bolt(p.x, p.y);
      // chain to nearby players of the same team
      for (const q of p.team.players) {
        if (q === p || q.hitByFire > 0 || dist(p.x, p.y, q.x, q.y) > 4) continue;
        q.hitByFire = 1.5;
        q.invuln = 0;
        this.knockdown(q, by, (q.x - p.x) * 2, (q.y - p.y) * 2, 1.6);
        this.fx.bolt(q.x, q.y);
      }
    } else {
      this.knockdown(p, by, b.vx * 0.35, b.vy * 0.35, 1.9);
    }
  }

  private deflect(p: Player, damp: number) {
    const b = this.ball;
    const [nx, ny] = norm(b.x - p.x, b.y - p.y);
    const dot = b.vx * nx + b.vy * ny;
    if (dot < 0) {
      b.vx -= 1.6 * dot * nx;
      b.vy -= 1.6 * dot * ny;
    }
    b.vx = b.vx * damp + rand(-1.5, 1.5);
    b.vy = b.vy * damp + rand(-1.5, 1.5);
    b.vz = Math.max(b.vz, 1.6);
    b.lockPlayer = p;
    b.lockTime = 0.22;
    b.prevTouch = b.lastTouch;
    b.lastTouch = p;
    b.shotBy = null;
    b.passTarget = null;
    audio.touch();
  }

  private airTouch(p: Player) {
    const b = this.ball;
    const P = this.pitch;
    const gx = p.team.side * P.hw;
    const dGoal = dist(p.x, p.y, gx, 0);
    const wantsShot = p === this.human ? p.volleyT > 0 : dGoal < 17 && Math.abs(p.y) < P.boxHalf + 2 && Math.random() < 0.75;
    if (wantsShot && (p.x - gx) * p.team.side < 0) {
      const lim = P.goalHalf - 0.6;
      const ty = clamp(rand(-lim, lim) * 0.7 + p.y * 0.2, -lim, lim);
      const header = b.z > 1.3;
      b.owner = p;
      const [dx, dy] = norm(gx - p.x, ty - p.y);
      const sp = header ? 17 + p.power * 4 : 22 + p.power * 6;
      this.kick(p, dx * sp, dy * sp, header ? 0.5 : 1.5, 0.8);
      b.shotBy = p.team;
      b.z = Math.max(0.3, b.z);
      p.shots++;
      p.team.stats.shots++;
      p.volleyT = 0;
      if (header) {
        p.kickAnim = 0;
        p.z = 0.4;
      }
      this.fx.impact(b.x, b.y, b.z);
      this.fx.text(p.x, p.y, 0.6, header ? (p === this.human ? t().header + '!' : '') : 'VOLLEY!', '#fff', 0.9);
    } else {
      // chest / head control: kill the ball
      b.vx = b.vx * 0.2 + p.vx * 0.5;
      b.vy = b.vy * 0.2 + p.vy * 0.5;
      b.vz = Math.min(b.vz, 0) * 0.3;
      b.lockPlayer = null;
      b.prevTouch = b.lastTouch;
      b.lastTouch = p;
      b.shotBy = null;
      audio.touch();
    }
  }

  private gkTouch(g: Player, d: number): boolean {
    const b = this.ball;
    const P = this.pitch;
    const diving = g.state === 'dive';
    if (!g.canAct && !diving) return false;
    const reach = diving ? 1.35 : 0.95;
    const hmax = diving ? 2.0 : 2.6;
    if (d > reach || b.z > hmax) return false;
    const ownX = -g.team.side * P.hw;
    const inBox = Math.abs(b.x - ownX) < P.boxDepth + 0.6 && Math.abs(b.y) < P.boxHalf + 0.6;
    if (!inBox) {
      if (d < PHYS.pickupR && b.z < 0.85 && g.canAct) {
        this.setOwner(g);
        return true;
      }
      return false;
    }
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    const limit = g.team.diff.gkCatch * (0.92 + g.skill * 0.16) * (diving ? 0.92 : 1);
    const wasShot = !!b.shotBy && b.shotBy !== g.team;
    if (sp < limit) {
      this.setOwner(g);
      g.holdT = 0;
      if (wasShot && sp > 11) {
        g.saves++;
        g.team.stats.saves++;
        this.fx.text(g.x, g.y, 0.4, t().saved, '#7fe8ff', 1);
        audio.catchBall();
        audio.cheer(0.4);
        this.excitement = 0.9;
      } else audio.catchBall();
      return true;
    }
    // parry
    const out = g.team.side;
    const sy = b.y - 0 === 0 ? (Math.random() < 0.5 ? -1 : 1) : sign(b.y);
    b.vx = Math.abs(b.vx) * 0.32 * out + rand(-1, 2) * out;
    b.vy = sy * rand(5, 9) + b.vy * 0.2;
    b.vz = rand(2.5, 5.5);
    b.lockPlayer = g;
    b.lockTime = 0.35;
    b.prevTouch = b.lastTouch;
    b.lastTouch = g;
    b.shotBy = null;
    if (wasShot) {
      g.saves++;
      g.team.stats.saves++;
      this.fx.text(g.x, g.y, 0.4, t().parried, '#7fe8ff', 1);
      audio.cheer(0.5);
    }
    this.fx.impact(b.x, b.y, b.z);
    audio.hit(0.5);
    return true;
  }

  private checkGoal() {
    const b = this.ball;
    const P = this.pitch;
    if (b.owner && Math.abs(b.x) > P.hw + PHYS.ballR && Math.abs(b.y) < P.goalHalf) {
      const o = b.owner;
      b.owner = null;
      b.lastTouch = o;
      b.inGoal = sign(b.x);
      b.vx = o.vx;
      b.vy = o.vy;
    }
    if (!b.inGoal) return;
    const scoring = this.teams.find((tm) => tm.side === b.inGoal)!;
    const scorer = b.lastTouch;
    const own = !!scorer && scorer.team !== scoring;
    scoring.score++;
    this.lastGoal = { team: scoring, scorer, own };
    if (scorer && !own) {
      scorer.goals++;
      const assist = b.prevTouch;
      if (assist && assist !== scorer && assist.team === scoring) assist.assists++;
    }
    scoring.opp.rage = Math.min(1, scoring.opp.rage + 0.25);
    this.toPhase('goal');
    this.goalFlash = 1;
    for (const p of this.all) {
      p.chargeKind = 'none';
      if (p.state === 'run' || p.state === 'spin') p.setState(p.team === scoring ? 'celebrate' : 'sad');
    }
    const gx = b.inGoal * P.hw;
    this.fx.goalExplosion(scoring.goalfx, gx + b.inGoal * 1, 0, [scoring.def.primary, scoring.def.secondary, '#ffffff', '#ffd23f']);
    // explosion blast: players near the goal get thrown back
    for (const p of this.all) {
      const d = dist(p.x, p.y, gx, 0);
      if (d > 8 || p.isGK && p.team !== scoring && d > 3) continue;
      const [ux, uy] = norm(p.x - gx, p.y || 0.01);
      const f = (8 - d) * 2.2;
      p.setState('down', 0.9 + (8 - d) * 0.08);
      p.vx = ux * f;
      p.vy = uy * f;
      p.chargeKind = 'none';
    }
    this.fx.slowmo(0.3, 1.1);
    this.fx.addShake(0.7);
    this.fx.doFlash(0.5);
    const humanScored = scoring.human;
    const title = own ? t().ownGoal : t().goal;
    const sub = scorer ? `${scorer.name.toUpperCase()}  #${scorer.number}` : '';
    this.fx.banner(title, sub, scoring.def.primary, 3.2);
    audio.horn();
    audio.cheer(1);
    audio.whistle('short');
    this.excitement = 1;
    if (humanScored) vibrate([80, 40, 120]);
    else if (this.teams[0].human) vibrate(60);
  }

  private celebrate(dt: number) {
    const lg = this.lastGoal;
    if (!lg) return;
    const P = this.pitch;
    const scorer = lg.scorer && !lg.own ? lg.scorer : lg.team.players[lg.team.players.length - 1];
    const cx = lg.team.side * (P.hw - 4), cy = sign(scorer.y || 1) * (P.hh - 2);
    for (const p of this.all) {
      if (p.state === 'down' || p.state === 'recover') continue;
      if (p.team === lg.team) {
        if (p.state !== 'celebrate') p.setState('celebrate');
        const tx = p === scorer ? cx : scorer.x - lg.team.side * 1.5 + (p.idx - 2) * 1.2;
        const ty = p === scorer ? cy : scorer.y + (p.idx % 2 ? 1 : -1) * 1.2;
        const [ux, uy] = norm(tx - p.x, ty - p.y);
        const d = dist(p.x, p.y, tx, ty);
        const m = Math.min(1, d / 2);
        p.ix = ux * m;
        p.iy = uy * m;
        p.wantSprint = d > 3;
        if (p.isGK) p.ix = p.iy = 0;
      } else {
        if (p.state !== 'sad') p.setState('sad');
        const tx = -p.team.side * P.hw * 0.25;
        const [ux, uy] = norm(tx - p.x, -p.y * 0.3);
        p.ix = ux * 0.6;
        p.iy = uy * 0.6;
        if (p.isGK) p.ix = p.iy = 0;
      }
    }
    void dt;
  }

  /** Is the opponent goalkeeper facing a fast incoming shot? Used by AI. */
  angleTo(p: Player, x: number, y: number) {
    return Math.abs(angleDiff(p.face, Math.atan2(y - p.y, x - p.x)));
  }
}
