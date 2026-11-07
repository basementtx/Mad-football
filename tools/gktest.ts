// Keeper check: fires many balls at a lone keeper and prints the goal %.
// Usage: npm run sim:gk
import { Match } from '../src/game/match';
import { FX } from '../src/game/fx';
import { TEAMS } from '../src/game/teams';
function trial(dist: number, speed: number, vz: number, shot: boolean, corner: boolean, diff: string) {
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], size: 7, duration: 180, difficulty: diff as any, demo: true }, new FX());
  (m as any).phase = 'play';
  const P = m.pitch, b = m.ball;
  const keeper = m.teams.find((t) => t.side === -1)!.gk; // defends the +x goal
  for (const p of m.all) if (p !== keeper) { p.x = -P.hw + 3; p.y = (p.idx - 3) * 2.5; }
  keeper.x = P.hw - 1.5; keeper.y = (Math.random() - 0.5) * 2;
  b.reset(); b.x = P.hw - dist; b.y = (Math.random() - 0.5) * 16;
  const ty = corner ? (Math.random() < 0.5 ? -1 : 1) * (P.goalHalf - 0.5) : (Math.random() * 2 - 1) * (P.goalHalf - 0.4);
  const dx = P.hw - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
  b.vx = (dx / d) * speed; b.vy = (dy / d) * speed; b.vz = vz; b.z = 0.12; b.kickAge = 0;
  b.lastTouch = m.teams.find((t) => t.side === 1)!.players[1];
  if (shot) b.shotBy = b.lastTouch.team;
  for (let i = 0; i < 60 * 5; i++) {
    m.step(1 / 60, null);
    if (m.phase === 'goal') return 1;
    if (b.owner === keeper || (b.speed < 0.5 && b.z < 0.05)) return 0;
  }
  return 0;
}
const cases: [string, number, number, number, boolean, boolean][] = [
  ['corner 8m', 8, 30, 1.0, true, true],
  ['corner 14m', 14, 32, 1.2, true, true],
  ['corner 25m', 25, 32, 1.5, true, true],
  ['any 22m', 22, 30, 1.5, true, false],
  ['long 45m', 45, 33, 1.5, true, false],
  ['soft pass 15m', 15, 11, 0.3, false, false],
];
const N = Number(process.env.N || 80);
for (const [name, d, sp, vz, shot, corner] of cases) {
  const out: string[] = [];
  for (const df of ['normal', 'hard', 'legend']) {
    let g = 0;
    for (let i = 0; i < N; i++) g += trial(d, sp, vz, shot, corner, df);
    out.push(`${df} ${((g / N) * 100).toFixed(0)}%`);
  }
  console.log(name.padEnd(16), out.join('  '));
}
