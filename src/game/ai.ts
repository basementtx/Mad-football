import type { Match } from './match';
import type { Player, Team } from './entities';
import { PHYS } from './entities';
import { clamp, dist, norm, rand, chance, segDist } from '../engine/math';
import { SHOT_POWERS } from '../meta/items';

/** Formation spots in normalized coords: u = attack axis (-1 own goal .. +1 opp goal), w = lateral. */
const FORMATIONS: Record<number, [number, number][]> = {
  2: [[-0.42, -0.2], [0.12, 0.3]],
  3: [[-0.48, 0], [-0.05, -0.5], [0.12, 0.5]],
  4: [[-0.52, -0.38], [-0.5, 0.38], [-0.02, -0.15], [0.26, 0.3]],
};

export function formationSpot(m: Match, p: Player, mode: 'kickoff' | 'attack' | 'defend'): [number, number] {
  const P = m.pitch;
  const team = p.team;
  const field = team.players.length - 1;
  const f = FORMATIONS[field] ?? FORMATIONS[3];
  let [u, w] = f[(p.idx - 1) % f.length];
  const b = m.ball;
  if (mode === 'kickoff') {
    u = Math.min(u, -0.12);
    return [team.side * u * P.hw, w * P.hh * 0.75];
  }
  const ballU = (b.x * team.side) / P.hw;
  const ballW = b.y / P.hh;
  if (mode === 'attack') {
    u += 0.28 + ballU * 0.35;
    w = w * 1.15 + ballW * 0.15;
  } else {
    u += -0.08 + ballU * 0.4;
    w = w * 0.8 + ballW * 0.35;
  }
  u = clamp(u, -0.85, 0.82);
  w = clamp(w, -0.85, 0.85);
  return [team.side * u * P.hw, w * P.hh];
}

function moveTo(p: Player, tx: number, ty: number, sprint: boolean, arrive = 1.2) {
  const dx = tx - p.x, dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.25) {
    p.ix = p.iy = 0;
    p.wantSprint = false;
    return;
  }
  const m = Math.min(1, d / arrive);
  p.ix = (dx / d) * m;
  p.iy = (dy / d) * m;
  p.wantSprint = sprint && d > 2.5;
}

const iqOf = (team: Team) => team.diff.iq ?? 0.8;

/** Top speed of a player (m/s), as the physics will actually allow it. */
function topSpeed(p: Player) {
  const mul = p.team.human ? 1 : p.team.diff.speedMul;
  return PHYS.sprintSpeed * (0.9 + p.pace * 0.18) * mul;
}

/** Earliest point where p can reach the free ball (with a small reaction delay). */
function intercept(m: Match, p: Player): [number, number, number] {
  const b = m.ball;
  const spd = topSpeed(p) * 0.92;
  const delay = 0.08 + p.team.diff.react * 0.35 * (1.1 - iqOf(p.team));
  for (let t = 0; t <= 2.5; t += 0.08) {
    const [x, y] = b.predict(t);
    const d = dist(p.x, p.y, x, y);
    if (d / spd + delay <= t + 0.05) return [x, y, t];
  }
  const [x, y] = b.predict(2.5);
  return [x, y, 2.5];
}

function nearestOpp(p: Player, team: Team, x = p.x, y = p.y): [Player | null, number] {
  let best: Player | null = null;
  let bd = Infinity;
  for (const q of team.opp.players) {
    if (q.state === 'down') continue;
    const d = dist(x, y, q.x, q.y);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return [best, bd];
}

/** How much free space there is at a point for `team` (distance to the nearest standing rival, capped). */
function openness(team: Team, x: number, y: number, cap = 7) {
  let d = cap;
  for (const o of team.opp.players) if (o.state !== 'down') d = Math.min(d, dist(x, y, o.x, o.y));
  return d;
}

/** Attacking value of a spot for `team`: progress up the pitch + the shooting angle from there. */
function posValue(m: Match, team: Team, x: number, y: number) {
  const P = m.pitch;
  const gx = team.side * P.hw;
  const dx = Math.max(0.5, Math.abs(gx - x));
  const ang = Math.abs(Math.atan2(P.goalHalf - y, dx) - Math.atan2(-P.goalHalf - y, dx));
  const d = dist(x, y, gx, 0);
  const prog = (x * team.side + P.hw) / (2 * P.hw);
  return prog * 1.2 + ang * (d < 22 ? 1.6 : 0.5);
}

/** 0..1: how likely a rival cuts out a ball played along from -> to at `speed`. */
function laneRisk(team: Team, fx: number, fy: number, tx: number, ty: number, speed: number) {
  const L = Math.max(0.1, dist(fx, fy, tx, ty));
  const ux = (tx - fx) / L, uy = (ty - fy) / L;
  let risk = 0;
  for (const o of team.opp.players) {
    if (o.state === 'down' || o.state === 'recover') continue;
    const s = clamp((o.x - fx) * ux + (o.y - fy) * uy, 0, L);
    const cx = fx + ux * s, cy = fy + uy * s;
    const off = dist(o.x, o.y, cx, cy);
    if (off > 4.5) continue;
    const tBall = s / speed;
    const tOpp = Math.max(0, off - 0.7) / (topSpeed(o) * 0.9) + 0.18;
    risk = Math.max(risk, clamp((tBall - tOpp + 0.25) / 0.55, 0, 1));
  }
  return risk;
}

/** Rough chance a shot from p goes in: angle, distance, keeper and blockers. */
function shotValue(m: Match, p: Player) {
  const P = m.pitch;
  const team = p.team;
  const gx = team.side * P.hw;
  const dx = Math.abs(gx - p.x);
  if ((gx - p.x) * team.side < 0.8) return 0;
  const ang = Math.abs(Math.atan2(P.goalHalf - p.y, dx) - Math.atan2(-P.goalHalf - p.y, dx));
  const d = dist(p.x, p.y, gx, 0);
  let v = clamp(ang / 0.9, 0, 1) * clamp(1.25 - d / (16 + p.power * 8), 0, 1);
  for (const o of team.opp.players) {
    if (o.isGK || o.state === 'down') continue;
    if (segDist(o.x, o.y, p.x, p.y, gx, 0) < 1.1 && (o.x - p.x) * team.side > 0) v *= 0.45;
  }
  // a keeper caught out of position is a gift
  const gk = team.opp.gk;
  if (gk && gk.isGK) v *= 1 + clamp(Math.abs(gk.y - p.y * 0.2) - 1, 0, 3) * 0.25;
  return v;
}

const HAZARD_R = 4.4;
/** Get away from a bomb about to go off. Returns true when the player is fleeing. */
function dodgeHazards(m: Match, p: Player) {
  for (const bm of m.bombs) {
    if (bm.by.team === p.team || bm.fuse > 1.3) continue;
    const d = dist(p.x, p.y, bm.x, bm.y);
    if (d < HAZARD_R && chance(0.6 + iqOf(p.team) * 0.4)) {
      const [ux, uy] = d > 0.05 ? norm(p.x - bm.x, p.y - bm.y) : [1, 0];
      moveTo(p, p.x + ux * 6, p.y + uy * 6, true, 0.3);
      return true;
    }
  }
  return false;
}

export function runTeamAI(m: Match, team: Team, dt: number) {
  const b = m.ball;
  const owner = b.owner;
  const field = team.players.filter((p) => !p.isGK);
  const iq = iqOf(team);

  // opponent keeper holds the ball: back off out of his box (no cheap goals)
  const keeperHolds = !!owner && owner.isGK && owner.team !== team;

  // rank by distance to ball (or carrier)
  const [bx, by] = owner ? [owner.x, owner.y] : b.predict(0.3);
  const ranked = [...field].sort((a, c) => dist(a.x, a.y, bx, by) - dist(c.x, c.y, bx, by));

  // --- reading a rival pass: the defender who can get to the ball's path first goes for it
  let cutter: Player | null = null;
  let cutAt: [number, number] = [0, 0];
  const to = !owner ? b.passTarget : null;
  if (to && to.team !== team && b.speed > 4) {
    const tArrive = dist(b.x, b.y, to.x, to.y) / Math.max(4, b.speed);
    let best = Infinity;
    for (const p of field) {
      if (p === m.human || !p.canAct) continue;
      const [ix, iy, t] = intercept(m, p);
      if (t < tArrive * (0.7 + iq * 0.3) && t < best) {
        best = t;
        cutter = p;
        cutAt = [ix, iy];
      }
    }
  }

  // --- marking: the most dangerous free attackers get a marker each (no double-marking)
  const marks = new Map<Player, Player>();
  const theirBall = (owner && owner.team !== team) || (to && to.team !== team);
  if (theirBall) {
    const carrier = owner ?? to!;
    const ownX = -team.side * m.pitch.hw;
    const attackers = team.opp.players.filter((q) => !q.isGK && q !== carrier && !q.isDown).sort((a, c) => dist(a.x, a.y, ownX, 0) - dist(c.x, c.y, ownX, 0));
    const free = ranked.slice(2).filter((p) => p !== m.human && p !== cutter);
    for (const a of attackers) {
      let bm: Player | null = null;
      let bd = 22;
      for (const p of free) {
        const d = dist(p.x, p.y, a.x, a.y);
        if (d < bd) { bd = d; bm = p; }
      }
      if (bm) {
        marks.set(bm, a);
        free.splice(free.indexOf(bm), 1);
      }
    }
  }

  ranked.forEach((p, rank) => {
    if (p === m.human) return;
    if (!p.canAct) {
      p.ix = p.iy = 0;
      return;
    }
    p.aiTimer -= dt;
    const decide = p.aiTimer <= 0;
    if (decide) p.aiTimer = team.diff.react * rand(0.7, 1.3);

    if (dodgeHazards(m, p)) return;
    if (keeperHolds) return retreatAI(m, p);
    if (p === cutter) return moveTo(p, cutAt[0], cutAt[1], true, 0.3);
    // ownership can change mid-loop (shoves, passes), so re-read it each time
    const own = b.owner;
    const incoming = !own && b.passTarget && b.passTarget.team === team;
    if (own === p) carrierAI(m, p, decide);
    else if (incoming && b.passTarget === p) {
      const [ix, iy] = intercept(m, p);
      moveTo(p, ix, iy, true, 0.6);
    } else if ((own && own.team === team) || incoming) supportAI(m, p, decide);
    else if (own && own.team !== team) defendAI(m, p, rank, dt, undefined, marks.get(p));
    else if (to && to.team !== team) defendAI(m, p, rank, dt, to, marks.get(p));
    else looseAI(m, p, rank, dt);

    // a little off-ball chaos, only near the action and rarely
    if (p.canAct && p.tackleCd <= 0 && chance(team.diff.aggression * 0.07 * dt)) {
      const [q, d] = nearestOpp(p, team);
      if (q && d < 1.2 && q !== b.owner && dist(p.x, p.y, b.x, b.y) < 6 && !q.isGK) m.shove(p, q);
    }
  });

  if (team.gk.isGK && team.gk !== m.human) gkAI(m, team.gk, dt);
  if (!team.human) itemAI(m, team, dt);
}

/** When and how an AI team uses the special item it picked up. */
function itemAI(m: Match, team: Team, dt: number) {
  const k = team.item;
  if (!k || team.itemT < 0.8 || m.phase !== 'play') return;
  const b = m.ball;
  const P = m.pitch;
  const gx = team.side * P.hw;
  const own = b.owner;
  const urgent = team.itemT > 14;
  const go = (rate = 1.6) => chance(rate * dt * (urgent ? 2 : 1));
  if (SHOT_POWERS.includes(k)) {
    if (own && own.team === team && !own.isGK && own.canAct) {
      const dGoal = dist(own.x, own.y, gx, 0);
      const inFront = (gx - own.x) * team.side > 2;
      if (inFront && dGoal < (urgent ? 26 : 21) && go(2.5)) {
        const ty = (team.opp.gk.y > 0 ? -1 : 1) * (P.goalHalf - 0.8);
        m.useItem(own, gx, ty);
      }
    }
    return;
  }
  const rival = own && own.team !== team && !own.isGK ? own : null;
  for (const p of team.players) {
    if (p.isGK || !p.canAct) continue;
    const dc = rival ? dist(p.x, p.y, rival.x, rival.y) : 99;
    let use = false;
    let tx = p.x + p.faceX * 8, ty = p.y + p.faceY * 8;
    if (k === 'shockwave') {
      let n = 0;
      for (const q of team.opp.players) if (!q.isGK && !q.isDown && dist(p.x, p.y, q.x, q.y) < 5) n++;
      use = n >= 2 || dc < 3.5;
    } else if (k === 'turbo') {
      const [, nd] = nearestOpp(p, team);
      use = (own === p && nd < 5) || (!!rival && dc < 6);
    } else if (k === 'bomb' || k === 'rifle') {
      const lo = k === 'bomb' ? 3.5 : 2, hi = k === 'bomb' ? 11 : 15;
      if (rival && dc > lo && dc < hi) {
        use = true;
        const lead = k === 'bomb' ? 0.6 : 0.25;
        tx = rival.x + rival.vx * lead;
        ty = rival.y + rival.vy * lead;
      }
    } else if (k === 'drink') {
      use = (own === p && nearestOpp(p, team)[1] < 6) || (!!rival && dc < 8 && dc > 3);
    } else if (k === 'teleport') {
      if (own === p && nearestOpp(p, team)[1] < 2.5) {
        use = true;
        const [ux, uy] = norm(gx - p.x, -p.y * 0.5);
        tx = p.x + ux * 7.5;
        ty = p.y + uy * 7.5;
      }
    } else if (k === 'shield') {
      use = (own === p && nearestOpp(p, team)[1] < 3.5) || (!!rival && dc < 2.5);
    } else if (k === 'quake') {
      let n = 0;
      for (const q of team.opp.players) if (!q.isGK && !q.isDown && dist(p.x, p.y, q.x, q.y) < 12) n++;
      use = n >= 2;
    } else if (k === 'meteor') {
      if (rival && dc > 4 && dc < 16) {
        use = true;
        tx = rival.x + rival.vx * 0.9;
        ty = rival.y + rival.vy * 0.9;
      }
    } else if (k === 'magnet') {
      const db = dist(p.x, p.y, b.x, b.y);
      use = (!own && db > 2 && db < 8) || (own === p && nearestOpp(p, team)[1] < 2.5);
    }
    if (use && go()) {
      m.useItem(p, tx, ty);
      return;
    }
  }
}

/** Stay out of the opponent keeper's box while he holds the ball. */
function retreatAI(m: Match, p: Player) {
  const P = m.pitch;
  const side = p.team.side;
  const gx = side * P.hw; // the goal we attack = their keeper's goal
  let [tx, ty] = formationSpot(m, p, 'defend');
  const minDist = P.boxDepth + 2;
  if ((gx - tx) * side < minDist) tx = gx - side * minDist;
  const d = dist(p.x, p.y, tx, ty);
  moveTo(p, tx, ty, (gx - p.x) * side < minDist && d > 1);
}

type PassPlan = { q: Player; x: number; y: number; val: number; through: boolean; lob: boolean };

/** Every pass the carrier could play (to feet, or into space ahead of a runner), valued. */
function passPlans(m: Match, p: Player): PassPlan[] {
  const team = p.team;
  const P = m.pitch;
  const gx = team.side * P.hw;
  const iq = iqOf(team);
  const out: PassPlan[] = [];
  for (const q of team.players) {
    if (q === p || q.state === 'down' || q.isGK) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < 3 || d > 30) continue;
    const sp = clamp(8 + d * 0.72, 10, 25);
    const risk = laneRisk(team, p.x, p.y, q.x, q.y, sp);
    const open = openness(team, q.x, q.y);
    const lob = risk > 0.55 && d > 9;
    const lobRisk = lob ? 0.25 + (open < 2.5 ? 0.35 : 0) : risk;
    out.push({ q, x: q.x, y: q.y, val: posValue(m, team, q.x, q.y) + open * 0.09 - lobRisk * 1.7 - (d > 22 ? 0.2 : 0), through: false, lob });
    // through ball: into the space in front of a forward-moving team-mate
    const fwd = (q.x - p.x) * team.side;
    if (fwd > -2 && iq > 0.6) {
      const [ux, uy] = norm(gx - q.x, -q.y * 0.35);
      const lead = 3.5 + iq * 2;
      const sx = clamp(q.x + ux * lead + q.vx * 0.4, -P.hw + 1.5, P.hw - 1.5);
      const sy = clamp(q.y + uy * lead + q.vy * 0.4, -P.hh + 1.5, P.hh - 1.5);
      const tq = dist(q.x, q.y, sx, sy) / topSpeed(q);
      let tOpp = Infinity;
      for (const o of team.opp.players) if (o.state !== 'down') tOpp = Math.min(tOpp, dist(o.x, o.y, sx, sy) / topSpeed(o));
      if (tOpp > tq - 0.15) {
        const ds = dist(p.x, p.y, sx, sy);
        const r2 = laneRisk(team, p.x, p.y, sx, sy, clamp(9 + ds * 0.8, 11, 26));
        out.push({ q, x: sx, y: sy, val: posValue(m, team, sx, sy) + 0.3 - r2 * 1.8 - (tOpp < tq + 0.35 ? 0.5 : 0), through: true, lob: false });
      }
    }
  }
  // career: team-mates look for your player (more once they trust you)
  const star = m.cfg.lockStar ? m.star : null;
  if (star && star.team === team && star !== p) {
    const called = m.time - m.passCall < 1.4;
    for (const pl of out) if (pl.q === star) pl.val += (m.cfg.starTrust ?? 0.3) * 0.5 + (called ? 0.9 : 0);
  }
  return out.sort((a, c) => c.val - a.val);
}

function playPass(m: Match, p: Player, plan: PassPlan) {
  const d = p.team.diff;
  const err = d.shootErr * 0.45 * (1.2 - p.skill * 0.5);
  if (plan.through) {
    m.passToSpot(p, plan.x, plan.y, plan.q, err);
    return;
  }
  m.passTo(p, plan.q, plan.lob);
  if (err > 0.02) {
    // a slightly mis-hit pass on the lower levels
    const b = m.ball;
    const a = (Math.random() - 0.5) * err * 1.4;
    const c = Math.cos(a), s = Math.sin(a);
    [b.vx, b.vy] = [b.vx * c - b.vy * s, b.vx * s + b.vy * c];
  }
}

function carrierAI(m: Match, p: Player, decide: boolean) {
  const team = p.team;
  const P = m.pitch;
  const d = team.diff;
  const iq = iqOf(team);
  const gx = team.side * P.hw;
  const dGoal = dist(p.x, p.y, gx, 0);
  const [opp, nd] = nearestOpp(p, team);

  if (decide) {
    const gk = team.opp.gk;
    const pressure = clamp((3.4 - nd) / 2.4, 0, 1);
    const inFront = (gx - p.x) * team.side > 1;

    // --- shoot when it is worth it (better players and smarter teams pick their moments)
    const xg = shotValue(m, p);
    const bar = 0.2 - iq * 0.04 + d.passiveness * 0.08 - pressure * 0.06;
    const range = 14 + p.power * 7;
    if (inFront && (dGoal < 6.5 || xg > bar || (dGoal < range && chance(0.03 + (1 - iq) * 0.05)))) {
      // aim away from the keeper, toward where he is NOT moving
      const ky = gk ? gk.y + gk.vy * 0.25 : 0;
      let best = 1, bs = -Infinity;
      for (const side of [-1, 1]) {
        const ty = side * (P.goalHalf - 0.7);
        let sc = Math.abs(ty - ky) + rand(0, 1.2 * (1 - iq));
        for (const o of team.opp.players) if (!o.isGK && o.state !== 'down' && segDist(o.x, o.y, p.x, p.y, gx, ty) < 0.9) sc -= 2;
        if (sc > bs) { bs = sc; best = side; }
      }
      const ty = best * (P.goalHalf - rand(0.45, 1.15));
      const power = clamp(0.55 + dGoal / 28, 0.55, 0.97);
      m.shootAt(p, gx, ty, power, d.shootErr * (1.3 - p.skill * 0.6));
      return;
    }

    // --- pass when a team-mate has a better chance than we do here
    const plans = passPlans(m, p);
    // career: your player called for it - play it unless the lane is suicidal
    const star = m.cfg.lockStar ? m.star : null;
    if (star && star.team === team && star !== p && m.time - m.passCall < 1.4) {
      const sp = plans.find((pl) => pl.q === star);
      if (sp && sp.val > -0.9 + (1 - (m.cfg.starTrust ?? 0.3)) * 0.6) {
        playPass(m, p, sp);
        m.passCall = -9;
        return;
      }
    }
    // backward / square passes only to escape real pressure
    const fwdPlans = plans.filter((pl) => (pl.x - p.x) * team.side > -1.5);
    const best = pressure > 0.55 ? plans[0] : fwdPlans[0];
    // carrying the ball is fun: only pass when it is clearly better, or when the pressure is on
    const space = openness(team, p.x + team.side * 3, p.y, 6);
    const hold = posValue(m, team, p.x, p.y) - pressure * 0.8 + space * 0.08;
    const margin = 0.6 + d.passiveness * 0.15 - pressure * 0.45 + rand(-0.25, 0.25) * (1.1 - iq) + ((best && (best.x - p.x) * team.side < -1.5) ? 0.35 : 0);
    if (best && best.val > hold + margin) {
      playPass(m, p, best);
      return;
    }

    // --- beat the man: spin away from a slide or a tight marker
    if (opp && nd < 1.8 && p.spinCd <= 0) {
      const coming = opp.state === 'slide' || ((p.x - opp.x) * opp.faceX + (p.y - opp.y) * opp.faceY) / Math.max(0.1, nd) > 0.6;
      if (coming && chance(d.dodge * (0.55 + iq * 0.45))) m.spin(p);
    }

    // --- dribble into space: sample directions around the way to goal
    const base = Math.atan2(-p.y * 0.55, gx - p.x);
    let bdx = p.aiDirX, bdy = p.aiDirY, bs = -Infinity;
    for (let k = -4; k <= 4; k++) {
      const a = base + k * 0.32;
      const dx = Math.cos(a), dy = Math.sin(a);
      const px = p.x + dx * 3.2, py = p.y + dy * 3.2;
      if (Math.abs(py) > P.hh - 1.2) continue;
      if (Math.abs(px) > P.hw - 0.8 && Math.abs(py) > P.goalHalf) continue;
      const space = openness(team, px, py, 4);
      const prog = dx * team.side;
      const keep = dx * p.aiDirX + dy * p.aiDirY;
      const sc = space * (0.25 + iq * 0.15) + prog * 2.2 - Math.abs(k) * 0.08 + keep * 0.35;
      if (sc > bs) { bs = sc; bdx = dx; bdy = dy; }
    }
    p.aiDirX = bdx;
    p.aiDirY = bdy;
    p.aiSprint = nd > 2.8 && p.stamina > 0.3 && (p.x * team.side) > -P.hw * 0.35;
  }
  p.ix = p.aiDirX;
  p.iy = p.aiDirY;
  p.wantSprint = p.aiSprint;
}

/** Off-ball attacking: find a spot that is open, reachable by a pass and useful. */
function supportAI(m: Match, p: Player, decide: boolean) {
  const team = p.team;
  const P = m.pitch;
  const side = team.side;
  const iq = iqOf(team);
  const c = m.ball.owner ?? m.ball.passTarget ?? null;
  const cx = c ? c.x : m.ball.x, cy = c ? c.y : m.ball.y;
  let ax: number, ay: number;
  const wave = Math.sin(m.time * 0.5 + p.idx * 1.7);
  if (p.role === 'FWD') {
    // stay ahead of the ball, threaten the space behind the last defender
    ax = side * clamp(cx * side + 9, P.hw * 0.15, P.hw - 4);
    ay = clamp(-cy * 0.35 + (p.idx % 2 ? 4 : -4) + wave * 3, -P.hh + 3, P.hh - 3);
  } else if (p.role === 'MID') {
    // a short angle beside / slightly ahead of the carrier
    ax = cx + side * 1.5;
    ay = cy + (cy > 0 ? -7 : 7) + wave;
  } else {
    // defenders hold a line behind the ball and offer a safe back pass
    ax = side * clamp(cx * side - 11, -P.hw * 0.75, P.hw * 0.25);
    ay = (p.idx % 2 ? 1 : -1) * P.hh * 0.35 + cy * 0.25;
  }
  if (decide || !p.aiHas) {
    let bx = ax, by = ay, bs = -Infinity;
    const roleW = p.role === 'FWD' ? 1.3 : p.role === 'MID' ? 0.8 : 0.3;
    for (let i = 0; i < 11; i++) {
      const a = i * 0.9 + p.idx;
      const r = i === 0 ? 0 : 2.5 + (i % 3) * 2.5;
      const x = clamp(ax + Math.cos(a) * r, -P.hw + 2, P.hw - 2);
      const y = clamp(ay + Math.sin(a) * r, -P.hh + 1.5, P.hh - 1.5);
      const open = openness(team, x, y);
      const dc = c ? dist(cx, cy, x, y) : 10;
      const lane = c && c !== p ? 1 - laneRisk(team, cx, cy, x, y, clamp(8 + dc * 0.72, 10, 25)) : 1;
      let crowd = 0;
      for (const q of team.players) if (q !== p && !q.isGK) crowd += Math.max(0, 5.5 - dist(q.x, q.y, x, y));
      const sc = open * 0.32 + lane * 1.5 * iq + posValue(m, team, x, y) * roleW - crowd * 0.3 - Math.abs(dc - 10) * 0.05 - dist(x, y, ax, ay) * 0.07 - dist(p.x, p.y, x, y) * 0.03;
      if (sc > bs) { bs = sc; bx = x; by = y; }
    }
    p.aiTX = bx;
    p.aiTY = by;
    p.aiHas = true;
  }
  moveTo(p, p.aiTX, p.aiTY, dist(p.x, p.y, p.aiTX, p.aiTY) > 5);
}

/**
 * Defending. `carrier` is the player to defend against (the ball owner, or the
 * receiver of a pass we can't cut out). The first defender contains: he reads
 * where the carrier is going, stands goal-side and shows him outside, and only
 * commits near our goal or when the attacker loses control. The second covers
 * the most dangerous lane, the rest mark the attackers they were given.
 */
function defendAI(m: Match, p: Player, rank: number, dt: number, carrier?: Player, mark?: Player) {
  const team = p.team;
  const P = m.pitch;
  const c = carrier ?? m.ball.owner!;
  const d = team.diff;
  const iq = iqOf(team);
  const ownX = -team.side * P.hw;
  const agg = team.human ? 0.45 : d.aggression;
  const dGoal = dist(c.x, c.y, ownX, 0);
  const danger = dGoal < P.hw * 0.75;
  const vsHuman = c.team.human;
  // possession just changed (or the pass is still travelling): stay patient
  const since = carrier && m.ball.owner !== c ? 0 : m.time - c.team.possSince;
  const settle = vsHuman ? 0.8 + d.react * 4 : 0.25;
  const patient = since < settle && !(danger && dGoal < P.boxDepth + 3);
  const lead = 0.15 + iq * 0.3;
  const fx = c.x + c.vx * lead, fy = c.y + c.vy * lead;
  if (rank === 0) {
    // goal-side, nudged toward the middle so the carrier is shown the touchline
    let [gx, gy] = norm(ownX - fx, -fy * (1 + iq * 0.5));
    [gx, gy] = norm(gx, gy);
    const dd = dist(p.x, p.y, c.x, c.y);
    let gap = patient ? 3.4 : dGoal > P.hw * 1.25 ? 2.6 : danger ? 1.3 : 1.8;
    if (!vsHuman && !patient) gap = Math.min(gap, 1.4);
    // beaten (the attacker is goal-side of us): recover at full speed toward the goal, not the man
    const beaten = (p.x - c.x) * -team.side < -0.5 && dd > 1.5;
    const sprint = beaten || dd > (vsHuman ? 7 : 3.5);
    if (beaten && iq > 0.6) {
      const tx = c.x + (ownX - c.x) * 0.35, ty = c.y * 0.6;
      moveTo(p, tx, ty, true, 0.5);
    } else moveTo(p, fx + gx * gap, fy + gy * gap, sprint, patient ? 1.4 : 0.5);
    if (!patient && m.ball.owner === c && p.tackleCd <= 0 && c.invuln <= 0) {
      const tk = agg * (vsHuman ? 0.75 : 1) * (1 + iq * 0.35);
      if (dd < 1.35 && chance(tk * dt)) m.shove(p, c);
      else if (dd > 1.3 && dd < 3.2 && (danger || dd < 2)) {
        const [ux, uy] = norm(c.x + c.vx * 0.25 - p.x, c.y + c.vy * 0.25 - p.y);
        const facing = ux * p.faceX + uy * p.faceY;
        if (facing > 0.85 && chance(tk * dt * 1.1)) m.slide(p, ux, uy);
      }
    }
  } else if (rank === 1) {
    // counter-press: a carrier deep in his own half gets a second man closing the back pass
    if (!patient && (c.x * c.team.side) < -P.hw * 0.15 && !vsHuman) {
      const [bx, by] = norm(-c.team.side, 0);
      moveTo(p, fx + bx * 1.8 + (p.y > c.y ? 1.2 : -1.2), fy + by * 1.8, true, 0.5);
      return;
    }
    // a carrier in our box gets doubled; otherwise cover and cut the most dangerous lane
    if (iq > 0.75 && dGoal < P.boxDepth + 2 && !patient) {
      const [gx, gy] = norm(ownX - fx, -fy);
      moveTo(p, fx + gx * 1.6 - gy * 1.2, fy + gy * 1.6 + gx * 1.2, true, 0.5);
      return;
    }
    let tx = fx + (ownX - fx) * 0.45;
    let ty = fy * 0.5;
    let bestQ: Player | null = null;
    let bq = -Infinity;
    for (const q of c.team.players) {
      if (q === c || q.isGK || q.isDown) continue;
      const threat = (q.x - c.x) * c.team.side - dist(q.x, q.y, ownX, 0) * 0.15;
      if (threat > bq) {
        bq = threat;
        bestQ = q;
      }
    }
    if (bestQ) {
      // stand on the passing lane, a bit closer to the receiver
      const k = 0.55 + iq * 0.15;
      tx = (tx + (c.x + (bestQ.x - c.x) * k)) / 2;
      ty = (ty + (c.y + (bestQ.y - c.y) * k)) / 2;
    }
    moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 4);
  } else {
    let tx: number, ty: number;
    const q = mark;
    if (q) {
      // goal-side and ball-side of the man: ready to step in front of a pass
      const [gx, gy] = norm(ownX - q.x, -q.y);
      const [bx, by] = norm(c.x - q.x, c.y - q.y);
      const [ux, uy] = norm(gx + bx * (0.4 + iq * 0.6), gy + by * (0.4 + iq * 0.6));
      const tight = dist(q.x, q.y, ownX, 0) < P.hw * 0.8 ? 1.3 : 2.2;
      tx = q.x + q.vx * lead + ux * tight;
      ty = q.y + q.vy * lead + uy * tight;
    } else {
      [tx, ty] = formationSpot(m, p, 'defend');
    }
    moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 4);
  }
}

function looseAI(m: Match, p: Player, rank: number, dt: number) {
  void dt;
  const [ix, iy, t] = intercept(m, p);
  const team = p.team;
  // the nearest goes for it; the second also does when it is close - and the rest get ready for what comes next
  if (rank === 0 || (rank === 1 && t < 0.9)) {
    moveTo(p, ix, iy, true, 0.4);
    return;
  }
  // who will win it? if they will, drop into shape; if we will, push up
  let ours = Infinity, theirs = Infinity;
  for (const q of team.players) if (!q.isGK && q.canAct) ours = Math.min(ours, dist(q.x, q.y, ix, iy) / topSpeed(q));
  for (const q of team.opp.players) if (!q.isGK && q.canAct) theirs = Math.min(theirs, dist(q.x, q.y, ix, iy) / topSpeed(q));
  const [tx, ty] = formationSpot(m, p, ours <= theirs ? 'attack' : 'defend');
  moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 6);
}

function gkAI(m: Match, g: Player, dt: number) {
  if (g === m.human) return;
  const team = g.team;
  const P = m.pitch;
  const b = m.ball;
  const s = team.side;
  const ownX = -s * P.hw;
  if (!g.canAct) {
    g.ix = g.iy = 0;
    return;
  }

  // distribution: wait until the box is clear, then pick a safe target
  if (b.owner === g) {
    g.ix = g.iy = 0;
    g.face = s > 0 ? 0 : Math.PI;
    let nearOpp = 99;
    for (const o of team.opp.players) nearOpp = Math.min(nearOpp, dist(g.x, g.y, o.x, o.y));
    if (g.holdT > 0.8 && (nearOpp > 7 || g.holdT > 2.4)) gkDistribute(m, g);
    return;
  }

  // react to shots
  const towardOwn = b.vx * -s > 3;
  if (!b.owner && towardOwn && b.kickAge > team.diff.gkReact && b.shotBy !== team) {
    const tt = (g.x - b.x) / b.vx;
    if (tt > 0 && tt < 0.9) {
      const py = b.y + b.vy * tt;
      if (Math.abs(py) < P.goalHalf + 1.2) {
        if (Math.abs(py - g.y) > 0.85 && b.z < 2.2 && tt < 0.55) {
          m.dive(g, g.x + s * 0.3, py);
          return;
        }
        moveTo(g, g.x, py, true, 0.3);
        return;
      }
    }
  }

  const inBox = (bx: number, by: number) => Math.abs(bx - ownX) < P.boxDepth && Math.abs(by) < P.boxHalf;

  // sweep: a through ball heading into the box that the keeper reaches first
  if (!b.owner && b.shotBy !== team.opp && b.speed > 3 && iqOf(team) > 0.6) {
    const [ix, iy, t] = intercept(m, g);
    if (inBox(ix, iy) && t < 1.6) {
      let first = true;
      for (const q of team.opp.players) {
        const [qx, qy] = [q.x + q.vx * t, q.y + q.vy * t];
        if (dist(qx, qy, ix, iy) < topSpeed(q) * 0.25 + 0.6 || dist(q.x, q.y, ix, iy) / topSpeed(q) < t - 0.1) first = false;
      }
      if (first) {
        moveTo(g, ix, iy, true, 0.3);
        return;
      }
    }
  }

  // claim loose balls in the box
  if (!b.owner && inBox(b.x, b.y) && b.speed < 14) {
    let closest = true;
    const dg = dist(g.x, g.y, b.x, b.y);
    for (const q of team.opp.players) if (dist(q.x, q.y, b.x, b.y) < dg - 1) closest = false;
    if (closest || dg < 4) {
      moveTo(g, b.x, b.y, true, 0.3);
      return;
    }
  }

  // rush a 1v1 attacker
  const o = b.owner;
  if (o && o.team !== team && inBox(o.x, o.y)) {
    const dd = dist(g.x, g.y, o.x, o.y);
    if (dd < 6) {
      moveTo(g, o.x, o.y, true, 0.3);
      if (dd < 2.6 && dd > 1.2 && g.tackleCd <= 0 && chance(team.diff.aggression * dt * 1.5)) {
        const [ux, uy] = norm(o.x - g.x, o.y - g.y);
        m.slide(g, ux, uy);
      }
      return;
    }
  }

  // narrow the angle: stand on the line from the ball to a point inside the near post
  const iq = iqOf(team);
  const [px, py] = b.owner ? [b.owner.x + b.owner.vx * 0.2, b.owner.y + b.owner.vy * 0.2] : b.predict(0.2);
  const aimY = clamp(py * (0.12 + iq * 0.1), -P.goalHalf * 0.55, P.goalHalf * 0.55);
  const [ux, uy] = norm(px - ownX, py - aimY);
  const dBall = dist(px, py, ownX, 0);
  const r = clamp(0.9 + dBall * (0.05 + iq * 0.025), 0.9, 3.4);
  let tx = ownX + ux * r;
  let ty = aimY + uy * r;
  ty = clamp(ty, -P.goalHalf + 0.3, P.goalHalf - 0.3);
  if ((tx - ownX) * s < 0.6) tx = ownX + s * 0.6;
  moveTo(g, tx, ty, dist(g.x, g.y, tx, ty) > 2.5, 0.5);
}

/** Keeper releases the ball: throw to an open man, or loft it over everyone. */
export function gkDistribute(m: Match, g: Player) {
  const team = g.team;
  const s = team.side;
  let best: Player | null = null;
  let bs = -Infinity;
  let bestLane = false;
  for (const q of team.players) {
    if (q === g || q.state === 'down') continue;
    let open = 8;
    let lane = true;
    for (const o of team.opp.players) {
      open = Math.min(open, dist(q.x, q.y, o.x, o.y));
      if (segDist(o.x, o.y, g.x, g.y, q.x, q.y) < 1.8) lane = false;
    }
    const sc = open + (q.x * s) / 10 + (lane ? 3 : 0) + rand(0, 1);
    if (sc > bs) {
      bs = sc;
      best = q;
      bestLane = lane;
    }
  }
  if (best && bestLane && dist(g.x, g.y, best.x, best.y) < 20) m.passTo(g, best, false);
  else if (best) m.passTo(g, best, true);
  else m.kick(g, s * 18, rand(-4, 4), 8, 0.8);
}
