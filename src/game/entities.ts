import { TeamDef } from './teams';
import type { CardData } from '../meta/cards';
import { attrsOf } from '../meta/cards';
import { pick, randInt } from '../engine/math';
import type { Formation } from './formations';

export interface Pitch {
  hw: number; // half width (x) of playing field
  hh: number; // half height (y)
  goalHalf: number;
  goalDepth: number;
  goalHeight: number;
  boxDepth: number;
  /** item reach multiplier: area effects grow with the pitch (36 m vs the original 30 m) */
  area: number;
  boxHalf: number;
  smallDepth: number;
  smallHalf: number;
  centerR: number;
  /** run-off between lines and boards */
  margin: number;
}

export function makePitch(size: number): Pitch {
  const s = size <= 3 ? 0.84 : size === 4 ? 1 : 1.14;
  // a wider pitch (36 x 22 half-size) leaves room to pass and to play tactics, and a
  // wider goal (9.2 m) gives curled and placed shots a real target
  return {
    hw: 36 * s,
    hh: 22 * s,
    goalHalf: 4.6,
    goalDepth: 2.3,
    goalHeight: 2.6,
    boxDepth: 9.2 * s,
    boxHalf: 10.8 * s,
    smallDepth: 3.4,
    smallHalf: 6.6,
    centerR: 5.4 * s,
    margin: 1.7,
    area: 36 / 30,
  };
}

export const PHYS = {
  gravity: 22,
  bounce: 0.52,
  wallBounce: 0.7,
  ballR: 0.22,
  playerR: 0.42,
  pickupR: 0.8,
  dribbleDist: 0.62,
  runSpeed: 6.3,
  sprintSpeed: 8.8,
  accel: 34,
  slideSpeed: 13.5,
  slideTime: 0.44,
  downTime: 1.45,
};

export type Difficulty = 'easy' | 'normal' | 'hard' | 'insane' | 'legend';

export const DIFF_REWARD: Record<Difficulty, number> = { easy: 0.6, normal: 1, hard: 1.5, insane: 2.2, legend: 3 };

export interface DiffParams {
  react: number;
  speedMul: number;
  aggression: number;
  shootErr: number;
  gkCatch: number;
  gkReact: number;
  stealMul: number;
  dodge: number;
  passiveness: number;
  /** tactical awareness 0..1 (positioning, anticipation, decisions) - kept high on every level */
  iq: number;
}

export const DIFF: Record<Difficulty, DiffParams> = {
  easy: { iq: 0.66, react: 0.3, speedMul: 0.86, aggression: 0.2, shootErr: 0.17, gkCatch: 19, gkReact: 0.3, stealMul: 0.45, dodge: 0.12, passiveness: 0.5 },
  normal: { iq: 0.8, react: 0.22, speedMul: 0.95, aggression: 0.4, shootErr: 0.11, gkCatch: 22.5, gkReact: 0.2, stealMul: 0.65, dodge: 0.32, passiveness: 0.25 },
  hard: { iq: 0.9, react: 0.15, speedMul: 1.01, aggression: 0.6, shootErr: 0.075, gkCatch: 25.5, gkReact: 0.13, stealMul: 0.85, dodge: 0.55, passiveness: 0.1 },
  insane: { iq: 0.97, react: 0.09, speedMul: 1.07, aggression: 0.8, shootErr: 0.05, gkCatch: 28.5, gkReact: 0.085, stealMul: 1.0, dodge: 0.75, passiveness: 0 },
  legend: { iq: 1, react: 0.06, speedMul: 1.12, aggression: 1.0, shootErr: 0.035, gkCatch: 31, gkReact: 0.06, stealMul: 1.15, dodge: 0.9, passiveness: 0 },
};

/** finishers (bike = bicycle kick, dhead = diving header, volley, head) and skill moves */
export type MoveKind = 'none' | 'head' | 'dhead' | 'volley' | 'bike' | 'roulette' | 'stepover' | 'flick' | 'drag';
export const MOVES: MoveKind[] = ['none', 'head', 'dhead', 'volley', 'bike', 'roulette', 'stepover', 'flick', 'drag'];
export const isSkillMove = (m: MoveKind) => m === 'roulette' || m === 'stepover' || m === 'flick' || m === 'drag';

export type PState = 'run' | 'slide' | 'down' | 'recover' | 'shove' | 'spin' | 'dive' | 'celebrate' | 'sad';
export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Mentality = 'def' | 'bal' | 'att';
export const MENTALITIES: Mentality[] = ['def', 'bal', 'att'];
/** -1 defensive, 0 balanced, +1 attacking */
export const mentK = (t: { mentality: Mentality }) => (t.mentality === 'att' ? 1 : t.mentality === 'def' ? -1 : 0);

export interface TeamStats {
  shots: number;
  onTarget: number;
  knockdowns: number;
  tackles: number;
  possession: number;
  passes: number;
  saves: number;
  powerShots: number;
  /** lofted crosses into the box */
  crosses: number;
  /** chip (lob) shots */
  chips: number;
  /** header / volley shots */
  headers: number;
  /** skill moves that beat a defender */
  skills: number;
}

export class Team {
  players: Player[] = [];
  score = 0;
  opp!: Team;
  /** special item held by the team (power id, e.g. 'bomb'), picked from a mystery box */
  item: string | null = null;
  /** tactical shape (outfield roles + spots); null = the classic default */
  formation: Formation | null = null;
  /** team mentality (tactic): pushes the shape up or back and sets how hard it presses */
  mentality: Mentality = 'bal';
  /** AI: seconds until it reconsiders its mentality */
  mentT = 12;
  /** match time of the last change (the HUD flashes it) */
  mentAt = -99;
  /** seconds the current item has been held (AI uses it after a short wait) */
  itemT = 0;
  /** items this team's mystery boxes can give */
  loadout: string[] = ['fireball', 'bomb', 'rifle'];
  /** tier (skin) per item id */
  tiers: Record<string, number> = {};
  /** match time when this team last gained possession */
  possSince = 0;
  goalfx = 'gx_classic';
  trail = 'tr_basic';
  /** equipped football boots (item id, '' = default) */
  boots = '';
  stats: TeamStats = { shots: 0, onTarget: 0, knockdowns: 0, tackles: 0, possession: 0, passes: 0, saves: 0, powerShots: 0, crosses: 0, chips: 0, headers: 0, skills: 0 };

  constructor(
    public def: TeamDef,
    public index: 0 | 1,
    /** direction of attack along x */
    public side: 1 | -1,
    public human: boolean,
    public diff: DiffParams,
  ) {}

  get gk(): Player {
    return this.players.find((p) => p.isGK) ?? this.players[0];
  }
}

const HAIR_COLORS = ['#1a1310', '#3b2416', '#6b3e1f', '#c98a3a', '#e8d27a', '#d8d8d8', '#b02a1a', '#20263a'];
const SKIN = ['#f3d2b5', '#e5b48f', '#c98d63', '#a8714a', '#7a4d30', '#5a3722'];

export class Player {
  x = 0; y = 0; z = 0;
  vx = 0; vy = 0;
  face = 0;
  get faceX() { return Math.cos(this.face); }
  get faceY() { return Math.sin(this.face); }

  state: PState = 'run';
  stateT = 0;
  stateDur = 0;

  // intent (from human input or AI)
  ix = 0; iy = 0;
  wantSprint = false;

  stamina = 1;
  exhausted = false;
  sprinting = false;

  charge = 0;
  chargeKind: 'none' | 'shot' | 'pass' | 'through' = 'none';

  // cooldowns
  tackleCd = 0;
  spinCd = 0;
  kickCd = 0;
  invuln = 0;
  volleyT = 0;
  kickAnim = 0;
  possT = 0;
  holdT = 0;
  hitByFire = 0;
  slideHit = new Set<Player>();
  /** frozen by an ice shot (seconds) */
  frozen = 0;
  /** turbo rampage power (seconds) */
  turbo = 0;
  /** sprint stamina drain multiplier (boots can lower it) */
  staminaDrain = 1;
  /** magnet boots (seconds) */
  magnet = 0;
  /** force-field bubble (seconds) */
  shield = 0;
  /** energy drink: endless sprint (seconds) */
  drink = 0;
  /** the user's own created player */
  star = false;
  card: CardData | null = null;
  /** special move in progress (finisher or skill move) and its clock */
  move: MoveKind = 'none';
  moveT = 0;
  moveDur = 0;
  /** skill move: direction of the burst and the defenders it already beat */
  moveX = 0;
  moveY = 0;
  /** wrong-footed by a skill move: slow and can't tackle (seconds) */
  beaten = 0;
  diveDirX = 0;
  diveDirY = 0;

  // AI scratch
  aiTimer = Math.random() * 0.3;
  aiDirX = 1;
  aiDirY = 0;
  aiSprint = false;
  /** off-ball target picked by the support AI */
  aiTX = 0;
  aiTY = 0;
  aiHas = false;
  /** keeper took a back pass: plays it with his feet instead of picking it up */
  feetBall = false;
  /** keeper boredom (seconds with nothing to do) and the yawn it ends in */
  boredT = 0;
  yawnT = 0;
  aiTx = 0;
  aiTy = 0;

  // attributes 0..1
  pace: number;
  power: number;
  tackle: number;
  skill: number;

  // looks
  runPhase = Math.random() * 6;
  skin = pick(SKIN);
  hair = pick(HAIR_COLORS);
  hairStyle = randInt(0, 11);
  faceShape = randInt(0, 4);
  eyes = randInt(0, 6);
  eyeColor = ['#5a3e2e', '#2a1e18', '#8a6a2a', '#3f8a4a', '#3f7ad8', '#7a8aa0'][randInt(0, 5)];
  beard = Math.random() < 0.25;
  build = 0.92 + Math.random() * 0.16;

  // per-match stats
  goals = 0;
  shots = 0;
  knockdowns = 0;
  steals = 0;
  saves = 0;
  assists = 0;
  /** completed passes, balls lost, shots on target, times knocked down (match ratings) */
  passOk = 0;
  lost = 0;
  onTarget = 0;
  downs = 0;

  constructor(
    public team: Team,
    public idx: number,
    public role: Role,
    public name: string,
    public number: number,
  ) {
    const d = team.def;
    const v = () => (Math.random() - 0.5) * 0.18;
    this.pace = Math.min(1, (d.pace - 1) / 4 * 0.8 + 0.2 + v());
    this.power = Math.min(1, (d.power - 1) / 4 * 0.8 + 0.2 + v());
    this.tackle = Math.min(1, (d.tackle - 1) / 4 * 0.8 + 0.2 + v());
    this.skill = Math.min(1, (d.skill - 1) / 4 * 0.8 + 0.2 + v());
    if (role === 'FWD') { this.power += 0.08; this.pace += 0.05; }
    if (role === 'DEF') this.tackle += 0.1;
  }

  /** Use a player card for attributes and looks. */
  applyCard(c: CardData) {
    this.card = c;
    Object.assign(this, attrsOf(c));
    this.skin = c.look.skin;
    this.hair = c.look.hair;
    this.hairStyle = c.look.hairStyle;
    this.faceShape = c.look.face ?? 0;
    this.eyes = c.look.eyes ?? 0;
    if (c.look.eyeColor) this.eyeColor = c.look.eyeColor;
    this.beard = c.look.beard;
    this.number = c.number;
  }

  get isGK() {
    return this.role === 'GK';
  }

  /** Can take voluntary actions. */
  get canAct() {
    return (this.state === 'run' || this.state === 'spin') && (this.move === 'none' || isSkillMove(this.move));
  }

  get isDown() {
    return this.state === 'down' || this.state === 'recover' || this.state === 'dive';
  }

  setState(s: PState, dur = 0) {
    this.state = s;
    this.stateT = 0;
    this.stateDur = dur;
  }
}

export class Ball {
  x = 0; y = 0; z = 0;
  vx = 0; vy = 0; vz = 0;
  spin = 0;
  rot = 0;
  owner: Player | null = null;
  lastTouch: Player | null = null;
  prevTouch: Player | null = null;
  lockPlayer: Player | null = null;
  lockTime = 0;
  kickAge = 10;
  fire = 0;
  /** visual/behaviour kind of the active power shot */
  power: 'fire' | 'ice' | 'thunder' | 'banana' = 'fire';
  passTarget: Player | null = null;
  /** current flight is a cross (receiver can attack it from further away) */
  cross = false;
  shotBy: Team | null = null;
  inGoal = 0;
  /** skin tier of the active power shot */
  tier = 1;
  trail: { x: number; y: number; z: number }[] = [];
  /** a flick over a defender: only its owner may collect it until the timer runs out */
  skillBy: Player | null = null;
  skillT = 0;
  /** last shot was a finisher (header, volley, bicycle kick...): its kind, for the goal banner */
  finisher: MoveKind = 'none';
  /** seconds of finisher sparkle trail left */
  finisherT = 0;

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  reset() {
    this.x = this.y = this.z = 0;
    this.vx = this.vy = this.vz = 0;
    this.spin = 0;
    this.cross = false;
    this.owner = null;
    this.lastTouch = this.prevTouch = null;
    this.lockPlayer = null;
    this.lockTime = 0;
    this.fire = 0;
    this.passTarget = null;
    this.shotBy = null;
    this.inGoal = 0;
    this.trail.length = 0;
    this.skillBy = null;
    this.skillT = 0;
    this.finisher = 'none';
    this.finisherT = 0;
    this.kickAge = 10;
  }

  /** Predict free ball ground position after t seconds (ignores walls). */
  predict(t: number): [number, number] {
    if (this.owner) return [this.x + this.vx * t, this.y + this.vy * t];
    let x = this.x, y = this.y, vx = this.vx, vy = this.vy;
    const step = 0.05;
    for (let s = 0; s < t; s += step) {
      const sp = Math.hypot(vx, vy);
      if (sp < 0.05) break;
      const ns = Math.max(0, sp - (2.4 + 0.32 * sp) * step);
      vx *= ns / sp;
      vy *= ns / sp;
      x += vx * step;
      y += vy * step;
    }
    return [x, y];
  }
}

/** Spinning rainbow "?" box on the pitch: run over it to get a special item. */
export interface MysteryBox {
  x: number;
  y: number;
  age: number;
  seed: number;
}

export interface Bomb {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  fuse: number;
  by: Player;
  tier: number;
}

export interface Bullet {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  by: Player;
  tier: number;
  delay: number;
}
