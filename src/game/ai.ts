import type { Match } from './match';
import type { Player, Team } from './entities';
import { PHYS } from './entities';
import { clamp, dist, norm, rand, chance, sign } from '../engine/math';

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
  const P = m.pitch;
  const field = team.players.filter((p) => !p.isGK);

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

    // ownership can change mid-loop (shoves, passes), so re-read it each time
    const own = b.owner;
    const incoming = !own && b.passTarget && b.passTarget.team === team;
    if (own === p) carrierAI(m, p, decide, dt);
    else if (incoming && b.passTarget === p) {
      const [ix, iy] = intercept(m, p);
      moveTo(p, ix, iy, true, 0.6);
    } else if ((own && own.team === team) || incoming) supportAI(m, p);
    else if (own && own.team !== team) defendAI(m, p, rank, dt);
    else looseAI(m, p, rank);

    // chaos: random off-ball shove when an opponent is in reach
    if (p.canAct && p.tackleCd <= 0 && chance(team.diff.aggression * 0.12 * dt)) {
      const [q, d] = nearestOpp(p, team);
      if (q && d < 1.4 && q !== owner) m.shove(p, q);
    }
  });

  gkAI(m, team.gk, dt);
  void P;
}

function carrierAI(m: Match, p: Player, decide: boolean, dt: number) {
  const team = p.team;
  const P = m.pitch;
  const d = team.diff;
  const gx = team.side * P.hw;
  const dGoal = dist(p.x, p.y, gx, 0);
  const [opp, nd] = nearestOpp(p, team);

  if (decide) {
    const gk = team.opp.gk;
    // power shot
    if (team.rage >= 1 && dGoal < 24 && chance(0.55)) {
      const ty = (gk.y > 0 ? -1 : 1) * (P.goalHalf - 0.8);
      m.powerShot(p, gx, ty);
      return;
    }
    // shooting
    const a1 = Math.atan2(P.goalHalf - p.y, Math.abs(gx - p.x));
    const a2 = Math.atan2(-P.goalHalf - p.y, Math.abs(gx - p.x));
    const angle = Math.abs(a1 - a2);
    const range = 15 + p.power * 6;
    const inFront = (gx - p.x) * team.side > 1;
    if (inFront && (dGoal < 7 || (dGoal < range && angle > 0.24 && chance(0.5 - d.passiveness * 0.3)) || (dGoal < range + 6 && chance(0.05)))) {
      const corner = gk.y > 0.3 ? -1 : gk.y < -0.3 ? 1 : chance(0.5) ? 1 : -1;
      const ty = corner * (P.goalHalf - rand(0.5, 1.2));
      const power = clamp(0.55 + dGoal / 28, 0.55, 0.97);
      m.shootAt(p, gx, ty, power, d.shootErr * (1.3 - p.skill * 0.6));
      return;
    }
    // under pressure
    const approaching = opp && nd < 3.2;
    if (approaching) {
      const threat = opp!.state === 'slide' || nd < 1.8;
      if (threat && p.spinCd <= 0 && chance(d.dodge)) {
        m.spin(p);
      } else if (chance(0.45)) {
        const q = bestForwardOption(m, p);
        if (q) {
          m.passTo(p, q, dist(p.x, p.y, q.x, q.y) > 16 && chance(0.5));
          return;
        }
      }
    } else if (chance(0.06 + d.passiveness * 0.1)) {
      const q = bestForwardOption(m, p);
      if (q && (q.x - p.x) * team.side > 4) {
        m.passTo(p, q, false);
        return;
      }
    }
    // dribble direction: goal with avoidance
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
      // steer laterally away from the defender, plus a little repulsion
      const lat = ox * -dy + oy * dx;
      const sd = lat > 0 ? -1 : 1;
      ax += -dy * sd * w * 1.4 - (ox / od) * w * 0.5;
      ay += dx * sd * w * 1.4 - (oy / od) * w * 0.5;
    }
    dx += ax;
    dy += ay;
    // walls
    if (Math.abs(p.y) > P.hh - 2.5) dy -= sign(p.y) * 1.5;
    if ((p.x - gx) * team.side > -2.5 && Math.abs(p.y) > P.goalHalf) dy -= sign(p.y) * 2;
    [dx, dy] = norm(dx, dy);
    p.aiDirX = dx;
    p.aiDirY = dy;
    p.aiSprint = nd > 2.8 && p.stamina > 0.25;
  }
  p.ix = p.aiDirX;
  p.iy = p.aiDirY;
  p.wantSprint = p.aiSprint;
  void dt;
}

function bestForwardOption(m: Match, p: Player): Player | null {
  const [dx, dy] = norm(p.team.side, 0);
  return m.bestPassTarget(p, dx, dy, false);
}

function supportAI(m: Match, p: Player) {
  const team = p.team;
  const P = m.pitch;
  let [tx, ty] = formationSpot(m, p, 'attack');
  const b = m.ball;
  // forwards make runs into the box
  if (p.role === 'FWD') {
    tx = team.side * Math.min(P.hw - 5, Math.abs(b.x * team.side > 0 ? b.x : 0) + 8) * 1;
    tx = team.side * clamp(Math.abs(tx), P.hw * 0.25, P.hw - 4.5);
    ty = clamp(-b.y * 0.4 + (p.idx % 2 ? 3 : -3), -P.hh + 3, P.hh - 3);
  }
  // spread from teammates
  for (const q of team.players) {
    if (q === p) continue;
    const d = dist(tx, ty, q.x, q.y);
    if (d < 6) {
      const [ux, uy] = norm(tx - q.x, ty - q.y);
      tx += ux * (6 - d) * 0.6;
      ty += uy * (6 - d) * 0.6;
    }
  }
  tx = clamp(tx, -P.hw + 2, P.hw - 2);
  ty = clamp(ty, -P.hh + 1.5, P.hh - 1.5);
  moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 7);
}

function defendAI(m: Match, p: Player, rank: number, dt: number) {
  const team = p.team;
  const P = m.pitch;
  const c = m.ball.owner!;
  const d = team.diff;
  const ownX = -team.side * P.hw;
  const agg = team.human ? 0.8 : d.aggression;
  if (rank === 0) {
    // press the carrier, staying goal-side
    const lead = 0.35;
    const cx = c.x + c.vx * lead, cy = c.y + c.vy * lead;
    const [gx, gy] = norm(ownX - cx, -cy);
    const dd = dist(p.x, p.y, c.x, c.y);
    const off = dd > 3 ? 0.9 : 0.2;
    moveTo(p, cx + gx * off, cy + gy * off, true, 0.5);
    if (p.tackleCd <= 0) {
      if (dd < 1.45 && chance(agg * dt * 2.2)) {
        m.shove(p, c);
      } else if (dd > 1.3 && dd < 3.8 && c.invuln <= 0) {
        const [ux, uy] = norm(cx - p.x, cy - p.y);
        const facing = ux * p.faceX + uy * p.faceY;
        if (facing > 0.8 && chance(agg * dt * 1.8)) m.slide(p, ux, uy);
      }
    }
  } else if (rank === 1) {
    // cover: between ball and own goal
    const tx = c.x + (ownX - c.x) * 0.45;
    const ty = c.y * 0.55;
    moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 5);
    // gang tackle sometimes
    const dd = dist(p.x, p.y, c.x, c.y);
    if (dd < 3 && dd > 1.3 && p.tackleCd <= 0 && chance(agg * dt * 0.6)) {
      const [ux, uy] = norm(c.x - p.x, c.y - p.y);
      m.slide(p, ux, uy);
    }
  } else {
    // mark nearest unmarked attacker
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
      tx = best.x + ux * 1.6;
      ty = best.y + uy * 1.6;
    }
    moveTo(p, tx, ty, dist(p.x, p.y, tx, ty) > 6);
  }
}

function looseAI(m: Match, p: Player, rank: number) {
  const [ix, iy, t] = intercept(m, p);
  if (rank === 0 || (rank === 1 && t < 1.2)) {
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

  // distribution
  if (b.owner === g) {
    g.ix = g.iy = 0;
    g.face = s > 0 ? 0 : Math.PI;
    if (g.holdT > 0.9) {
      let best: Player | null = null;
      let bs = -Infinity;
      for (const q of team.players) {
        if (q === g || q.state === 'down') continue;
        let open = 8;
        for (const o of team.opp.players) open = Math.min(open, dist(q.x, q.y, o.x, o.y));
        const sc = open + (q.x * s) / 8 + rand(0, 2);
        if (sc > bs) {
          bs = sc;
          best = q;
        }
      }
      if (best) m.passTo(g, best, dist(g.x, g.y, best.x, best.y) > 15);
      else m.kick(g, s * 18, rand(-4, 4), 7, 0.8);
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
