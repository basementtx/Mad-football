import type { Match } from './match';
import type { Player, Team } from './entities';
import { PHYS } from './entities';
import { clamp, dist, norm, rand, chance, sign, segDist } from '../engine/math';

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

/** Earliest point where p can reach the free ball. */
function intercept(m: Match, p: Player): [number, number, number] {
  const b = m.ball;
  const spd = PHYS.sprintSpeed * 0.85;
  for (let t = 0; t <= 2.5; t += 0.1) {
    const [x, y] = b.predict(t);
    const d = dist(p.x, p.y, x, y);
    if (d / spd <= t + 0.05) return [x, y, t];
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

export function runTeamAI(m: Match, team: Team, dt: number) {
  const b = m.ball;
  const owner = b.owner;
  const field = team.players.filter((p) => !p.isGK);

  // opponent keeper holds the ball: back off out of his box (no cheap goals)
  const keeperHolds = !!owner && owner.isGK && owner.team !== team;

  // rank by distance to ball (or carrier)
  const [bx, by] = owner ? [owner.x, owner.y] : b.predict(0.3);
  const ranked = [...field].sort((a, c) => dist(a.x, a.y, bx, by) - dist(c.x, c.y, bx, by));

  ranked.forEach((p, rank) => {
    if (p === m.human) return;
    if (!p.canAct) {
      p.ix = p.iy = 0;
      return;
    }
    p.aiTimer -= dt;
    const decide = p.aiTimer <= 0;
    if (decide) p.aiTimer = team.diff.react * rand(0.7, 1.3);

    if (keeperHolds) return retreatAI(m, p);
    // ownership can change mid-loop (shoves, passes), so re-read it each time
    const own = b.owner;
    const incoming = !own && b.passTarget && b.passTarget.team === team;
    if (own === p) carrierAI(m, p, decide);
    else if (incoming && b.passTarget === p) {
      const [ix, iy] = intercept(m, p);
      moveTo(p, ix, iy, true, 0.6);
    } else if ((own && own.team === team) || incoming) supportAI(m, p);
    else if (own && own.team !== team) defendAI(m, p, rank, dt);
    else looseAI(m, p, rank);

    // a little off-ball chaos, only near the action and rarely
    if (p.canAct && p.tackleCd <= 0 && chance(team.diff.aggression * 0.07 * dt)) {
      const [q, d] = nearestOpp(p, team);
      if (q && d < 1.2 && q !== b.owner && dist(p.x, p.y, b.x, b.y) < 6 && !q.isGK) m.shove(p, q);
    }
  });

  gkAI(m, team.gk, dt);
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

/** Score passing options for the ball carrier. */
function passOptions(p: Player) {
  const team = p.team;
  const out: { q: Player; score: number; lane: boolean; gain: number; d: number }[] = [];
  for (const q of team.players) {
    if (q === p || q.state === 'down' || q.isGK) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < 3.5 || d > 28) continue;
    let open = 8;
    let lane = true;
    for (const o of team.opp.players) {
      if (o.state === 'down') continue;
      open = Math.min(open, dist(q.x, q.y, o.x, o.y));
      if (segDist(o.x, o.y, p.x, p.y, q.x, q.y) < 1.3) lane = false;
    }
    const gain = (q.x - p.x) * team.side;
    const score = gain * 0.18 + open * 0.45 - Math.abs(d - 11) * 0.06 + (lane ? 1.2 : -2.5);
    out.push({ q, score, lane, gain, d });
  }
  return out.sort((a, c) => c.score - a.score);
}

function carrierAI(m: Match, p: Player, decide: boolean) {
  const team = p.team;
  const P = m.pitch;
  const d = team.diff;
  const gx = team.side * P.hw;
  const dGoal = dist(p.x, p.y, gx, 0);
  const [opp, nd] = nearestOpp(p, team);

  if (decide) {
    const gk = team.opp.gk;
    // power
    if (team.rage >= 1 && dGoal < 22 && chance(0.45)) {
      const ty = (gk.y > 0 ? -1 : 1) * (P.goalHalf - 0.8);
      m.powerShot(p, gx, ty);
      return;
    }
    // shooting: decent angle and a clear-ish lane
    const a1 = Math.atan2(P.goalHalf - p.y, Math.abs(gx - p.x));
    const a2 = Math.atan2(-P.goalHalf - p.y, Math.abs(gx - p.x));
    const angle = Math.abs(a1 - a2);
    const range = 14 + p.power * 6;
    const inFront = (gx - p.x) * team.side > 1;
    let blocked = 0;
    for (const o of team.opp.players) if (!o.isGK && o.state !== 'down' && segDist(o.x, o.y, p.x, p.y, gx, 0) < 1.1) blocked++;
    if (inFront && (dGoal < 7 || (dGoal < range && angle > 0.22 && blocked === 0 && chance(0.6 - d.passiveness * 0.3)) || (dGoal < range && chance(0.12)))) {
      const corner = gk.y > 0.3 ? -1 : gk.y < -0.3 ? 1 : chance(0.5) ? 1 : -1;
      const ty = corner * (P.goalHalf - rand(0.5, 1.2));
      const power = clamp(0.55 + dGoal / 28, 0.55, 0.97);
      m.shootAt(p, gx, ty, power, d.shootErr * (1.3 - p.skill * 0.6));
      return;
    }
    const pressured = !!opp && nd < 2.6;
    const opts = passOptions(p);
    const best = opts[0];
    // dodge a slide or a defender in our face
    if (pressured && (opp!.state === 'slide' || nd < 1.6) && p.spinCd <= 0 && chance(d.dodge * 0.8)) {
      m.spin(p);
    } else if (best) {
      // tactical passing: release under pressure, play forward into space, recycle when blocked
      const forwardOpen = best.lane && best.gain > 3;
      const ownHalf = (p.x * team.side) < 0;
      let want = 0;
      if (pressured) want = best.lane ? 0.75 : 0.35;
      else if (forwardOpen) want = ownHalf ? 0.45 : 0.3;
      else if (opp && nd < 4 && best.lane) want = 0.25; // recycle possession
      want *= 1 - d.passiveness * 0.3;
      if (chance(want)) {
        m.passTo(p, best.q, !best.lane || best.d > 18);
        return;
      }
    }
    // dribble toward goal, steering around defenders
    let [dx, dy] = norm(gx - p.x, -p.y * 0.6);
    let ax = 0, ay = 0;
    for (const q of team.opp.players) {
      if (q.state === 'down') continue;
      const ox = q.x - p.x, oy = q.y - p.y;
      const od = Math.hypot(ox, oy);
      if (od > 6 || od < 0.01) continue;
      const front = (ox * dx + oy * dy) / od;
      if (front < -0.2) continue;
      const w = ((6 - od) / 6) * (0.6 + front);
      const lat = ox * -dy + oy * dx;
      const sd = lat > 0 ? -1 : 1;
      ax += -dy * sd * w * 1.4 - (ox / od) * w * 0.5;
      ay += dx * sd * w * 1.4 - (oy / od) * w * 0.5;
    }
    dx += ax;
    dy += ay;
    if (Math.abs(p.y) > P.hh - 2.5) dy -= sign(p.y) * 1.5;
    if ((p.x - gx) * team.side > -2.5 && Math.abs(p.y) > P.goalHalf) dy -= sign(p.y) * 2;
    [dx, dy] = norm(dx, dy);
    p.aiDirX = dx;
    p.aiDirY = dy;
    p.aiSprint = nd > 3 && p.stamina > 0.3 && (p.x * team.side) > -P.hw * 0.3;
  }
  p.ix = p.aiDirX;
  p.iy = p.aiDirY;
  p.wantSprint = p.aiSprint;
}

function supportAI(m: Match, p: Player) {
  const team = p.team;
  const P = m.pitch;
  const side = team.side;
  const c = m.ball.owner ?? m.ball.passTarget ?? null;
  const cx = c ? c.x : m.ball.x, cy = c ? c.y : m.ball.y;
  let tx: number, ty: number;
  const wave = Math.sin(m.time * 0.5 + p.idx * 1.7);
  if (p.role === 'FWD') {
    // stay ahead of the ball, run into the channels between defenders
    tx = side * clamp(cx * side + 9, P.hw * 0.15, P.hw - 4.5);
    ty = clamp(-cy * 0.35 + (p.idx % 2 ? 4 : -4) + wave * 3, -P.hh + 3, P.hh - 3);
  } else if (p.role === 'MID') {
    // offer a short angle beside / slightly behind the carrier
    tx = cx - side * 2.5;
    ty = cy + (cy > 0 ? -7 : 7) + wave;
  } else {
    // defenders hold a line behind the ball
    tx = side * clamp(cx * side - 12, -P.hw * 0.75, P.hw * 0.2);
    ty = (p.idx % 2 ? 1 : -1) * P.hh * 0.35 + cy * 0.25;
  }
  // spread from teammates and step away from markers
  for (const q of team.players) {
    if (q === p) continue;
    const d = dist(tx, ty, q.x, q.y);
    if (d < 6) {
      const [ux, uy] = norm(tx - q.x, ty - q.y);
      tx += ux * (6 - d) * 0.6;
      ty += uy * (6 - d) * 0.6;
    }
  }
  for (const o of team.opp.players) {
    const d = dist(tx, ty, o.x, o.y);
    if (d < 2.5) {
      const [ux, uy] = norm(tx - o.x, ty - o.y);
      tx += ux * (2.5 - d);
      ty += uy * (2.5 - d);
    }
  }
  tx = clamp(tx, -P.hw + 2, P.hw - 2);
  ty = clamp(ty, -P.hh + 1.5, P.hh - 1.5);
  moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 6);
}

function defendAI(m: Match, p: Player, rank: number, dt: number) {
  const team = p.team;
  const P = m.pitch;
  const c = m.ball.owner!;
  const d = team.diff;
  const ownX = -team.side * P.hw;
  const agg = team.human ? 0.45 : d.aggression;
  const danger = dist(c.x, c.y, ownX, 0) < P.hw * 0.75;
  if (rank === 0) {
    // jockey: stay goal-side about 1.3 m away and wait for the ball
    const [gx, gy] = norm(ownX - c.x, -c.y);
    const dd = dist(p.x, p.y, c.x, c.y);
    const gap = dd > 4 ? 0.6 : 1.3;
    moveTo(p, c.x + c.vx * 0.2 + gx * gap, c.y + c.vy * 0.2 + gy * gap, dd > 3.5, 0.5);
    if (p.tackleCd <= 0 && c.invuln <= 0) {
      if (dd < 1.35 && chance(agg * dt * 1.0)) m.shove(p, c);
      else if (dd > 1.3 && dd < 3.2 && (danger || dd < 2)) {
        const [ux, uy] = norm(c.x + c.vx * 0.25 - p.x, c.y + c.vy * 0.25 - p.y);
        const facing = ux * p.faceX + uy * p.faceY;
        if (facing > 0.85 && chance(agg * dt * 1.1)) m.slide(p, ux, uy);
      }
    }
  } else if (rank === 1) {
    // cover: sit between the ball and goal, cut the most dangerous passing lane
    let tx = c.x + (ownX - c.x) * 0.45;
    let ty = c.y * 0.5;
    let bestQ: Player | null = null;
    let bq = -Infinity;
    for (const q of c.team.players) {
      if (q === c || q.isGK) continue;
      const threat = (q.x - c.x) * c.team.side;
      if (threat > bq) {
        bq = threat;
        bestQ = q;
      }
    }
    if (bestQ && bq > 2) {
      tx = (tx + (c.x + bestQ.x) / 2) / 2;
      ty = (ty + (c.y + bestQ.y) / 2) / 2;
    }
    moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 5);
  } else {
    // mark the nearest unmarked attacker goal-side, otherwise hold the zone
    let [tx, ty] = formationSpot(m, p, 'defend');
    let best: Player | null = null;
    let bd = 12;
    for (const q of team.opp.players) {
      if (q === c || q.isGK) continue;
      const dd = dist(tx, ty, q.x, q.y);
      if (dd < bd) {
        bd = dd;
        best = q;
      }
    }
    if (best) {
      const [ux, uy] = norm(ownX - best.x, -best.y);
      tx = best.x + ux * 1.8;
      ty = best.y + uy * 1.8;
    }
    moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 6);
  }
}

function looseAI(m: Match, p: Player, rank: number) {
  const [ix, iy, t] = intercept(m, p);
  if (rank === 0 || (rank === 1 && t < 0.8)) {
    moveTo(p, ix, iy, true, 0.4);
  } else {
    const [tx, ty] = formationSpot(m, p, m.ball.x * p.team.side > 0 ? 'attack' : 'defend');
    moveTo(p, tx, ty, false);
  }
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
    if (g.holdT > 0.8 && (nearOpp > 7 || g.holdT > 2.4)) {
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
      else if (best) m.passTo(g, best, true); // loft it over everyone
      else m.kick(g, s * 18, rand(-4, 4), 8, 0.8);
    }
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

  // positioning on the arc between ball and goal centre
  const [ux, uy] = norm(b.x - ownX, b.y);
  const dBall = dist(b.x, b.y, ownX, 0);
  const r = clamp(0.9 + dBall * 0.06, 0.9, 3.2);
  let tx = ownX + ux * r;
  let ty = uy * r * 1.6;
  ty = clamp(ty, -P.goalHalf + 0.3, P.goalHalf - 0.3);
  if ((tx - ownX) * s < 0.6) tx = ownX + s * 0.6;
  moveTo(g, tx, ty, dist(g.x, g.y, tx, ty) > 2.5, 0.5);
}
