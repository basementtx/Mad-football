// Keeper regression check: shoots many balls at a keeper and prints goal %. Usage: npm run sim:gk
import { Match } from '../src/game/match';
import { FX } from '../src/game/fx';
import { TEAMS } from '../src/game/teams';
function trial(dist: number, speed: number, vz: number, shot: boolean, corner = false, diff = 'hard') {
  const m = new Match({ home: TEAMS[0], away: TEAMS[1], size: 4, duration: 180, difficulty: diff as any, demo: true }, new FX());
  (m as any).phase = 'play';
  const P = m.pitch, b = m.ball, gk = m.teams[1].gk; // away keeps the +x goal? check side
  const keeper = m.teams.find(t => t.side === -1)!.gk; // defends +x goal
  // park everyone else far away
  for (const p of m.all) if (p !== keeper) { p.x = -P.hw + 3; p.y = (p.idx - 2) * 3; }
  keeper.x = P.hw - 1.5; keeper.y = (Math.random() - 0.5) * 2;
  b.reset(); b.x = P.hw - dist; b.y = (Math.random() - 0.5) * 16;
  const ty = corner ? (Math.random() < 0.5 ? -1 : 1) * (P.goalHalf - 0.45) : (Math.random() * 2 - 1) * (P.goalHalf - 0.4);
  const dx = P.hw - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
  b.vx = dx / d * speed; b.vy = dy / d * speed; b.vz = vz; b.z = 0.12; b.kickAge = 0;
  b.lastTouch = m.teams.find(t => t.side === 1)!.players[1];
  if (shot) b.shotBy = b.lastTouch.team;
  for (let i = 0; i < 60 * 5; i++) {
    m.step(1 / 60, null);
    if (m.phase === 'goal') return 1;
    if (b.owner === keeper || (b.speed < 0.5 && b.z < 0.05)) return 0;
  }
  return 0;
}
const cases: [string, number, number, number, boolean, boolean?][] = [
  ['corner 14m 32', 14, 32, 1.2, true, true],
  ['corner 8m 30', 8, 30, 1.0, true, true],
  ['corner 25m 32', 25, 32, 1.5, true, true],
  ['lob 40m', 40, 24, 8, true],
  ['bouncer 50m', 50, 28, 5, true],
  ['gk punt 55m', 55, 18, 8, false],
  ['long shot 45m', 45, 33, 1.5, true],
  ['mid shot 22m', 22, 30, 1.5, true],
  ['soft roller 12m', 12, 9, 0.3, false],
  ['soft pass 20m', 20, 13, 0.3, false],
];
for (const [name, d, sp, vz, shot, corner] of cases) {
  const out: string[] = [];
  for (const df of ['normal', 'hard', 'legend']) { let g = 0; const N = 150;
  for (let i = 0; i < N; i++) g += trial(d, sp, vz, shot, !!corner, df);
  out.push(df + ' ' + (g / N * 100).toFixed(0) + '%'); }
  console.log(name.padEnd(18), out.join('  '));
}
