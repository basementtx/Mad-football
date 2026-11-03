// Headless balance check: plays 20 AI-vs-AI matches and prints averages.
// Usage: npm run sim -- [easy|normal|hard|insane] [3|4|5]
import { Match } from '../src/game/match';
import { FX } from '../src/game/fx';
import { TEAMS } from '../src/game/teams';
const diff = (process.argv[2] || 'normal') as any;
const size = Number(process.argv[3] || 4);
let goals = 0, n = 0, kd = 0, shots = 0, saves=0, passes=0, pow=0;
const t0 = Date.now();
for (let i = 0; i < 20; i++) {
  const m = new Match({ home: TEAMS[i % 8], away: TEAMS[(i + 3) % 8], size, duration: 180, difficulty: diff, demo: true }, new FX());
  m.start();
  let steps = 0;
  while (m.phase !== 'over' && steps < 60 * 400) { m.step(1 / 60, null); m.fx.update(1/60,1/60); steps++; }
  goals += m.teams[0].score + m.teams[1].score; n++;
  for (const t of m.teams) { kd += t.stats.knockdowns; shots += t.stats.shots; saves += t.stats.saves; passes += t.stats.passes; pow += t.stats.powerShots; }
}
console.log(JSON.stringify({ diff, size, goalsPerMatch: goals / n, kdPerMatch: kd / n, shots: shots / n, saves: saves / n, passes: passes/n, pow: pow/n, ms: Date.now() - t0 }));
