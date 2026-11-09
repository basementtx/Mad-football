/**
 * Online 1v1 sync. The host's phone runs the real match; the guest's phone shows a
 * "puppet" copy of it:
 *  - guest -> host: stick + button edges (pressed / released / swiped) and tactic taps
 *  - host -> guest: ~30 snapshots a second (only the fields that changed) plus the
 *    effects and sounds the simulation fired (banners, sparks, kicks, crowd...)
 * Between snapshots the guest moves players and ball on with their velocities.
 */
import type { Match } from '../game/match';
import type { Game } from '../game/game';
import { Player, Team, Ball } from '../game/entities';
import type { Input, Button, BtnId } from '../engine/input';
import { audio } from '../engine/audio';
import { PHYS } from '../game/entities';

export const NET_VERSION = 1;
const BTNS: BtnId[] = ['a', 'b', 'c', 'd', 'e'];

// ---------------------------------------------------------------- value codec

type Enc = number | string | boolean | null | Enc[] | { [k: string]: Enc };

function encode(m: Match, v: unknown, depth = 0): Enc | undefined {
  if (v === null || v === undefined) return null;
  const tp = typeof v;
  if (tp === 'number') return Number.isFinite(v as number) ? Math.round((v as number) * 1000) / 1000 : 0;
  if (tp === 'string' || tp === 'boolean') return v as Enc;
  if (tp !== 'object' || depth > 4) return undefined;
  if (v instanceof Player) return { $p: m.all.indexOf(v) };
  if (v instanceof Team) return { $t: v.index };
  if (Array.isArray(v)) {
    if (v.length > 200) return undefined;
    const out: Enc[] = [];
    for (const x of v) {
      const e = encode(m, x, depth + 1);
      out.push(e === undefined ? null : e);
    }
    return out;
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return undefined; // Map, Set, canvases, class instances
  const out: { [k: string]: Enc } = {};
  for (const k of Object.keys(v as object)) {
    const e = encode(m, (v as Record<string, unknown>)[k], depth + 1);
    if (e !== undefined) out[k] = e;
  }
  return out;
}

function decode(m: Match, v: Enc): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => decode(m, x));
  if ('$p' in v) return m.all[v.$p as number] ?? null;
  if ('$t' in v) return m.teams[v.$t as number] ?? null;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v)) out[k] = decode(m, v[k]);
  return out;
}

const PLAYER_SKIP = new Set(['team', 'slideHit', 'ix', 'iy', 'wantSprint', 'readT', 'boredT', 'yawnT', 'touchT']);
const BALL_SKIP = new Set(['trail', 'lockPlayer', 'lockTime']);
const TEAM_SKIP = new Set(['def', 'players', 'opp', 'diff', 'formation', 'possSince', 'mentT', 'passChain', 'chainX']);
const MATCH_KEYS = ['phase', 'phaseT', 'clock', 'time', 'kickoffTeam', 'excitement', 'lastGoal', 'goalLog', 'goalFlash', 'postHit', 'boxes', 'bombs', 'bullets', 'possTeam', 'replayT', 'countShown'];

interface Slot {
  get: () => object;
  keys: () => string[];
}

function slots(m: Match): Record<string, Slot> {
  const all = (o: object, skip: Set<string>) => () => Object.keys(o).filter((k) => !skip.has(k) && !k.startsWith('ai'));
  const s: Record<string, Slot> = {
    m: { get: () => m, keys: () => MATCH_KEYS },
    b: { get: () => m.ball, keys: all(m.ball, BALL_SKIP) },
    t0: { get: () => m.teams[0], keys: all(m.teams[0], TEAM_SKIP) },
    t1: { get: () => m.teams[1], keys: all(m.teams[1], TEAM_SKIP) },
  };
  m.all.forEach((p, i) => (s['p' + i] = { get: () => p, keys: all(p, PLAYER_SKIP) }));
  return s;
}

/** Host side: what changed since the last snapshot. */
class DeltaEncoder {
  private last = new Map<string, Map<string, string>>();
  private sl: Record<string, Slot>;
  constructor(private m: Match) {
    this.sl = slots(m);
  }
  diff(full = false): Record<string, Record<string, Enc>> {
    const out: Record<string, Record<string, Enc>> = {};
    for (const id of Object.keys(this.sl)) {
      const s = this.sl[id];
      const o = s.get() as Record<string, unknown>;
      let prev = this.last.get(id);
      if (!prev) this.last.set(id, (prev = new Map()));
      let d: Record<string, Enc> | null = null;
      for (const k of s.keys()) {
        const e = encode(this.m, o[k]);
        if (e === undefined) continue;
        const js = JSON.stringify(e);
        if (!full && prev.get(k) === js) continue;
        prev.set(k, js);
        (d ??= {})[k] = e;
      }
      if (d) out[id] = d;
    }
    return out;
  }
}

function applyDelta(m: Match, d: Record<string, Record<string, Enc>>) {
  for (const id of Object.keys(d)) {
    let o: Record<string, unknown> | null = null;
    if (id === 'm') o = m as unknown as Record<string, unknown>;
    else if (id === 'b') o = m.ball as unknown as Record<string, unknown>;
    else if (id === 't0' || id === 't1') o = m.teams[+id[1]] as unknown as Record<string, unknown>;
    else if (id[0] === 'p') o = (m.all[+id.slice(1)] as unknown as Record<string, unknown>) ?? null;
    if (!o) continue;
    const vals = d[id];
    for (const k of Object.keys(vals)) o[k] = decode(m, vals[k]);
  }
}

// ---------------------------------------------------------------- effects & sounds

const FX_METHODS = ['slowmo', 'addShake', 'doFlash', 'emit', 'swoosh', 'dust', 'impact', 'confetti', 'powerTrail', 'ballTrail', 'bolt', 'goalExplosion', 'fireTrail', 'text', 'banner', 'clear'];
const AUDIO_METHODS = ['kick', 'touch', 'hit', 'slide', 'whoosh', 'post', 'catchBall', 'whistle', 'cheer', 'groan', 'horn', 'pew', 'boom', 'pickup', 'power', 'click', 'select', 'countdown', 'thunder'];

type Ev = [string, string, Enc[]];

/** Records effect / sound / turf-wear calls the host's simulation makes. */
class EventTap {
  events: Ev[] = [];
  private undo: (() => void)[] = [];
  constructor(private m: Match) {
    const tap = (target: Record<string, unknown>, kind: string, name: string) => {
      const orig = target[name] as ((...a: unknown[]) => unknown) | undefined;
      if (typeof orig !== 'function') return;
      const self = this;
      const wrapped = function (this: unknown, ...args: unknown[]) {
        const enc: Enc[] = [];
        for (const a of args) {
          const e = encode(self.m, a);
          enc.push(e === undefined ? null : e);
        }
        if (self.events.length < 400) self.events.push([kind, name, enc]);
        return orig.apply(this, args);
      };
      target[name] = wrapped;
      this.undo.push(() => {
        if (target[name] === wrapped) delete target[name];
        if (target[name] !== orig) target[name] = orig;
      });
    };
    for (const n of FX_METHODS) tap(m.fx as unknown as Record<string, unknown>, 'f', n);
    for (const n of AUDIO_METHODS) tap(audio as unknown as Record<string, unknown>, 'a', n);
    tap(m as unknown as Record<string, unknown>, 'w', 'wear');
  }
  take(): Ev[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  dispose() {
    for (const u of this.undo.reverse()) u();
    this.undo = [];
  }
}

function playEvents(m: Match, evs: Ev[]) {
  for (const [kind, name, args] of evs) {
    const a = args.map((x) => decode(m, x));
    try {
      if (kind === 'f') (m.fx as unknown as Record<string, (...x: unknown[]) => void>)[name]?.(...a);
      else if (kind === 'a') (audio as unknown as Record<string, (...x: unknown[]) => void>)[name]?.(...a);
      else if (kind === 'w') (m.wear as (...x: unknown[]) => void).apply(m, a);
    } catch {
      /* a cosmetic effect must never break the match */
    }
  }
}

// ---------------------------------------------------------------- input

/** Guest -> host input packet. */
export interface InputPacket {
  t: 'i';
  /** stick */
  x: number;
  y: number;
  /** held buttons / flick (swiped-up) buttons, as bit masks a=1 b=2 c=4 d=8 e=16 */
  d: number;
  f: number;
  /** edges in order: [0, btn] press, [1, btn, flick] release, [2, x, y] swipe on SPRINT */
  ev: (number | string)[][];
  /** tactic tap: 0..2 pick, -1 next */
  tac?: number;
}

/** Guest side: turns the local Input into packets (edges are never lost). */
export class InputSender {
  private ev: (number | string)[][] = [];
  private lastKey = '';
  private lastAt = 0;
  collect(inp: Input) {
    for (const id of BTNS) {
      const b = inp.btn[id];
      if (b.pressed) this.ev.push([0, id]);
      if (b.swiped && id === 'c') this.ev.push([2, Math.round(b.swipeX * 100) / 100, Math.round(b.swipeY * 100) / 100]);
      if (b.released) this.ev.push([1, id, b.flick ? 1 : 0]);
    }
  }
  /** a packet when something changed, else a keep-alive every 100 ms */
  packet(inp: Input, now: number): InputPacket | null {
    let d = 0, f = 0;
    BTNS.forEach((id, i) => {
      if (inp.btn[id].down) d |= 1 << i;
      if (inp.btn[id].flick) f |= 1 << i;
    });
    const x = Math.round(inp.mx * 100) / 100, y = Math.round(inp.my * 100) / 100;
    const key = `${x},${y},${d},${f}`;
    const tac = inp.tacticReq;
    if (!this.ev.length && key === this.lastKey && tac == null && now - this.lastAt < 100) return null;
    inp.tacticReq = null;
    this.lastKey = key;
    this.lastAt = now;
    const p: InputPacket = { t: 'i', x, y, d, f, ev: this.ev };
    if (tac != null) p.tac = tac;
    this.ev = [];
    return p;
  }
}

const mkBtn = (): Button => ({ down: false, pressed: false, released: false, held: 0, flick: false, swiped: false, swipeX: 0, swipeY: 0, swipeUsed: false });

/** Host side: the guest's input, replayed one edge per button per simulation step. */
export class RemoteInput {
  mx = 0;
  my = 0;
  btn: Record<BtnId, Button> = { a: mkBtn(), b: mkBtn(), c: mkBtn(), d: mkBtn(), e: mkBtn() };
  tacticReq: number | null = null;
  tacticOn = true;
  private queue: (number | string)[][] = [];
  private levelDown = 0;
  private levelFlick = 0;

  receive(p: InputPacket) {
    this.mx = Math.max(-1, Math.min(1, +p.x || 0));
    this.my = Math.max(-1, Math.min(1, +p.y || 0));
    this.levelDown = p.d | 0;
    this.levelFlick = p.f | 0;
    if (Array.isArray(p.ev)) for (const e of p.ev.slice(0, 40)) this.queue.push(e);
    if (p.tac != null && Number.isFinite(p.tac)) this.tacticReq = Math.max(-1, Math.min(2, p.tac | 0));
  }

  /** before a simulation step: apply queued edges (one per button), then the held levels */
  prepare() {
    const touched = new Set<string>();
    while (this.queue.length) {
      const e = this.queue[0];
      const kind = e[0];
      const id = (kind === 2 ? 'c' : e[1]) as BtnId;
      if (!this.btn[id] || touched.has(id)) break;
      this.queue.shift();
      touched.add(id);
      const b = this.btn[id];
      if (kind === 0) {
        b.down = true;
        b.pressed = true;
        b.held = 0;
        b.swipeUsed = false;
      } else if (kind === 1) {
        b.down = false;
        b.released = true;
        b.flick = !!e[2];
      } else if (kind === 2) {
        b.swiped = true;
        b.swipeX = +e[1] || 0;
        b.swipeY = +e[2] || 0;
      }
    }
    // with no edges pending, follow the held / flick levels the guest reported
    if (!this.queue.length) {
      BTNS.forEach((id, i) => {
        const b = this.btn[id];
        if (touched.has(id)) return;
        const down = !!(this.levelDown & (1 << i));
        if (down && !b.down) {
          b.down = true;
          b.pressed = true;
          b.held = 0;
        } else if (!down && b.down) {
          b.down = false;
          b.released = true;
        }
        b.flick = !!(this.levelFlick & (1 << i));
      });
    }
  }

  /** after a simulation step */
  consume(dt: number) {
    for (const id of BTNS) {
      const b = this.btn[id];
      b.pressed = false;
      b.released = false;
      b.swiped = false;
      if (b.down) b.held += dt;
    }
  }
}

// ---------------------------------------------------------------- host / guest sessions

export interface Snapshot {
  t: 's';
  n: number;
  d: Record<string, Record<string, Enc>>;
  e: Ev[];
  /** the guest's control state: controlled player, pass hint, aim line, curl */
  c: Enc;
  /** replay running */
  r: boolean;
}

/** Host: runs the real match, feeds the guest's input in, ships snapshots out. */
export class HostSync {
  readonly input = new RemoteInput();
  private enc: DeltaEncoder;
  private tap: EventTap;
  private n = 0;
  private steps = 0;
  constructor(private m: Match, private send: (msg: unknown) => void) {
    this.enc = new DeltaEncoder(m);
    this.tap = new EventTap(m);
    m.remoteInput = this.input as unknown as Input;
  }
  beforeStep() {
    this.input.prepare();
  }
  afterStep(dt: number) {
    this.input.consume(dt);
    // 30 snapshots a second
    if (++this.steps % 2 === 0) this.flush();
  }
  flush(full = false) {
    const m = this.m;
    const c = m.guestCtl();
    const snap: Snapshot = {
      t: 's',
      n: ++this.n,
      d: this.enc.diff(full),
      e: this.tap.take(),
      c: encode(m, c) ?? null,
      r: m.replaying,
    };
    this.send(snap);
  }
  dispose() {
    this.tap.dispose();
    this.m.remoteInput = null;
  }
}

/** Guest: applies snapshots to its puppet match and moves things on between them. */
export class GuestSync {
  readonly sender = new InputSender();
  private gotFirst = false;
  constructor(private game: Game) {}

  receive(s: Snapshot) {
    const m = this.game.match;
    applyDelta(m, s.d);
    playEvents(m, s.e ?? []);
    const c = decode(m, s.c as Enc) as Record<string, unknown> | null;
    if (c) m.applyGuestCtl(c);
    m.netReplay = !!s.r;
    if (!this.gotFirst) {
      this.gotFirst = true;
      // the intro banner was already played locally by the puppet's start()
      m.fx.banners.length = 0;
    }
  }

  /** every frame: dead-reckon positions until the next snapshot, keep the ball trail */
  tick(dt: number) {
    const m = this.game.match;
    if (!this.gotFirst) return;
    if (m.phase === 'play' || m.phase === 'goal') {
      for (const p of m.all) {
        if (p.state === 'down' && Math.hypot(p.vx, p.vy) < 0.05) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.runPhase += Math.hypot(p.vx, p.vy) * dt * 2.1;
        p.stateT += dt;
        p.kickAnim = Math.max(0, p.kickAnim - dt);
      }
      const b: Ball = m.ball;
      if (!b.owner) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.z > 0 || b.vz > 0) {
          b.vz -= PHYS.gravity * dt;
          b.z = Math.max(0, b.z + b.vz * dt);
        }
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 16 || b.fire > 0) {
        b.trail.push({ x: b.x, y: b.y, z: b.z });
        if (b.trail.length > 10) b.trail.shift();
      } else if (b.trail.length) b.trail.shift();
      b.rot += sp * dt * 3;
    }
    audio.setCrowd(m.excitement);
  }
}
