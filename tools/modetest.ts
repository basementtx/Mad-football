// Mode checks: free-kick score hunt with a bot shooter, wall duel bot vs AI.
// Usage: npm run sim:modes
import { Match } from '../src/game/match';
import { FX } from '../src/game/fx';
import { TEAMS } from '../src/game/teams';
import { FreeKicks } from '../src/game/modes';
const mk = () => ({ down: false, pressed: false, released: false, held: 0, flick: false, swiped: false, swipeX: 0, swipeY: 0, swipeUsed: false });
const newInp = (): any => ({ mx: 0, my: 0, btn: { a: mk(), b: mk(), c: mk(), d: mk(), e: mk() }, tacticReq: null });
const clear = (inp: any) => { for (const k of 'abcde') { inp.btn[k].pressed = false; inp.btn[k].released = false; } };

// ---- free kicks: aim at a random spot in the goal, hold for a random charge, maybe curl
const tally: Record<string, number> = { goal: 0, save: 0, wall: 0, miss: 0 };
let pts = 0;
const byCharge: Record<string, number[]> = {};
for (let g = 0; g < 8; g++) {
  const m = new Match({ home: TEAMS[g % 8], away: TEAMS[(g + 3) % 8], size: 7, duration: 999, difficulty: 'normal', demo: false, mode: 'freekick' } as any, new FX());
  m.start();
  const fk = m.mode as FreeKicks;
  const inp = newInp();
  let hold = 0, holdFor = 0, aimed = 0, curl = 0, lastN = -1, logN = 0;
  let chargeAt = 0;
  for (let s = 0; s < 60 * 400 && m.phase !== 'over'; s++) {
    clear(inp);
    const sh = m.teams[0].players[0];
    if (m.phase === 'play' && m.ball.owner === sh && sh.chargeKind !== 'shot' && fk.n !== lastN) {
      // new kick: aim for 0.5 s at a random goal spot
      lastN = fk.n; aimed = 0; hold = 0;
      const ty = (Math.random() * 2 - 1) * (m.pitch.goalHalf - 0.6);
      const dx = m.pitch.hw - m.ball.x, dy = ty - m.ball.y, d = Math.hypot(dx, dy);
      inp.mx = dx / d; inp.my = dy / d;
      holdFor = 0.35 + Math.random() * 0.8; curl = Math.random() < 0.4 ? (Math.random() < 0.5 ? 1 : -1) : 0;
    }
    if (m.phase === 'play' && m.ball.owner === sh) {
      aimed += 1 / 60;
      if (aimed > 0.5 && !inp.btn.a.down) { inp.btn.a.down = true; inp.btn.a.pressed = true; hold = 0; }
      else if (inp.btn.a.down) {
        hold += 1 / 60;
        chargeAt = sh.charge;
        if (curl) { inp.mx = -m.ball.y * 0 + 0.2; inp.my = curl; }
        if (hold >= holdFor) { inp.btn.a.down = false; inp.btn.a.released = true; }
      }
    }
    m.step(1 / 60, inp);
    m.fx.update(1 / 60, 1 / 60);
    while (fk.log.length > logN) {
      const e = fk.log[logN++];
      tally[e.r]++;
      const bucket = (Math.round(chargeAt * 4) / 4).toFixed(2);
      (byCharge[bucket] ??= [0, 0])[e.r === 'goal' ? 0 : 1]++;
    }
  }
  pts += fk.points;
  if (g === 0) console.log('round 1 log:', fk.log.map((e) => `${e.r}${e.pts ? '+' + e.pts : ''}@${e.d}m`).join(' '));
}
console.log('free kicks (80):', tally, 'avg points/round', Math.round(pts / 8));
console.log('goal rate by charge (goals, other):', Object.fromEntries(Object.entries(byCharge).sort()));

// ---- wall duel: bot runs at the ball on its side, shoots at the far corner
let gf = 0, ga = 0, crossed = 0, steps = 0;
for (let g = 0; g < 6; g++) {
  const m = new Match({ home: TEAMS[g % 8], away: TEAMS[(g + 2) % 8], size: 1, duration: 90, difficulty: 'normal', demo: false, mode: 'duel' } as any, new FX());
  m.start();
  const inp = newInp();
  let held = 0;
  for (let s = 0; s < 60 * 200 && m.phase !== 'over'; s++) {
    clear(inp);
    const h = m.human!, b = m.ball;
    if (m.phase === 'play' && h) {
      if (b.owner === h) {
        held += 1 / 60;
        inp.mx = 1; inp.my = -h.y * 0.2;
        if (held > 0.6 && !inp.btn.a.down) { inp.btn.a.down = true; inp.btn.a.pressed = true; }
        else if (inp.btn.a.down && held > 1.1) { inp.btn.a.down = false; inp.btn.a.released = true; }
      } else {
        held = 0; inp.btn.a.down = false;
        // defend: get in line with a ball heading for our goal, else chase it on our side
        let tx = b.x < 0 ? b.x : -m.pitch.hw + 1.5, ty = b.x < 0 ? b.y : b.y * 0.5;
        if (!b.owner && b.vx < -4) { const t = (-m.pitch.hw + 1 - b.x) / b.vx; if (t > 0 && t < 1.5) { tx = -m.pitch.hw + 1; ty = b.y + b.vy * t; } }
        const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
        inp.mx = d > 0.3 ? dx / d : 0; inp.my = d > 0.3 ? dy / d : 0;
      }
    }
    m.step(1 / 60, inp);
    m.fx.update(1 / 60, 1 / 60);
    for (const p of m.all) { steps++; if (p.team.side * p.x > -0.44 && m.phase === 'play') crossed++; }
  }
  gf += m.teams[0].score; ga += m.teams[1].score;
}
console.log('wall duel bot vs AI (6 x 90 s):', { goalsFor: gf, goalsAgainst: ga, playerCrossedWallFrames: crossed });
for (const diff of ['easy', 'normal', 'hard']) {
  let goals = 0, shots = 0;
  for (let g = 0; g < 6; g++) {
    const m = new Match({ home: TEAMS[g % 8], away: TEAMS[(g + 2) % 8], size: 1, duration: 90, difficulty: diff, demo: true, mode: 'duel' } as any, new FX());
    m.start();
    for (let s = 0; s < 60 * 200 && m.phase !== 'over'; s++) { m.step(1 / 60, null); m.fx.update(1 / 60, 1 / 60); }
    goals += m.teams[0].score + m.teams[1].score; shots += m.teams[0].stats.shots + m.teams[1].stats.shots;
  }
  console.log('wall duel AI vs AI', diff, { goalsPer90s: +(goals / 6).toFixed(1), shotsPer90s: +(shots / 6).toFixed(1) });
}
