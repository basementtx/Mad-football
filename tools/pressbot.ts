// Pressing check: a scripted human that only chases the AI ball carrier (sprint, shove/tackle when
// close, never slides). Measures how long the AI keeps the ball and how many passes a spell lasts.
// Usage: npm run sim:press -- [hard|insane|...]   (N=matches)
import { Match } from '../src/game/match';
import { FX } from '../src/game/fx';
import { TEAMS } from '../src/game/teams';
const diff = (process.argv[2] || 'hard') as any;
const size = Number(process.argv[3] || 7);
const N = Number(process.env.N || 8);
const mk = () => ({ down: false, pressed: false, released: false, held: 0 });
const R = { n: 0, quick: 0, quickNear: 0, near: 0, held: 0 };
const MP: any = Match.prototype;
for (const fn of ['passTo', 'passToSpot']) { const o = MP[fn]; MP[fn] = function (p: any, ...r: any[]) { if (!p.team.human && !p.isGK && this.phase === 'play') { R.n++; R.held += p.possT; let nd = 99; for (const q of p.team.opp.players) nd = Math.min(nd, Math.hypot(q.x - p.x, q.y - p.y)); if (p.possT < 0.35) R.quick++; if (nd < 2.5) R.near++; if (p.possT < 0.35 && nd < 2.5) R.quickNear++; } return o.call(this, p, ...r); }; }
let spells = 0, passSum = 0, timeSum = 0, longSpells = 0, maxPasses = 0, wins = 0;
const chainHist: number[] = new Array(12).fill(0);
for (let i = 0; i < N; i++) {
  const m = new Match({ home: TEAMS[i % 8], away: TEAMS[(i + 3) % 8], size, duration: 180, difficulty: diff, demo: false }, new FX());
  m.start();
  const inp: any = { mx: 0, my: 0, btn: { a: mk(), b: mk(), c: mk(), d: mk(), e: mk() } };
  const AI = m.teams[1];
  let spellT = -1, spellPasses = 0, lastOwner: any = null;
  for (let s = 0; s < 60 * 400 && m.phase !== 'over'; s++) {
    for (const k of 'abcde') { inp.btn[k].pressed = false; inp.btn[k].released = false; }
    const h = m.human, b = m.ball;
    if (h && m.phase === 'play' && !h.isGK) {
      const o = b.owner;
      if (o === h) { // just clear it forward
        inp.mx = h.team.side; inp.my = 0; inp.btn.b.pressed = true;
      } else {
        const tx = o ? o.x + o.vx * 0.15 : b.x, ty = o ? o.y + o.vy * 0.15 : b.y;
        const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
        inp.mx = dx / d; inp.my = dy / d; inp.btn.c.down = true;
        if (o && o.team === AI && !o.isGK && d < 1.4 && h.canAct && h.tackleCd <= 0) inp.btn.a.pressed = true;
      }
    } else inp.mx = inp.my = 0;
    m.step(1 / 60, inp);
    m.fx.update(1 / 60, 1 / 60);
    if (m.phase !== 'play') { spellT = -1; continue; }
    const o = m.ball.owner;
    if (o && o !== lastOwner) {
      if (o.team === AI && !o.isGK) {
        if (spellT < 0) { spellT = 0; spellPasses = 0; }
        else if (lastOwner && lastOwner.team === AI) spellPasses++;
      } else if (o.team !== AI && spellT >= 0) {
        spells++; passSum += spellPasses; timeSum += spellT; maxPasses = Math.max(maxPasses, spellPasses);
        chainHist[Math.min(11, spellPasses)]++; if (spellPasses >= 6) longSpells++;
        spellT = -1;
      }
      lastOwner = o;
    }
    if (spellT >= 0) spellT += 1 / 60;
  }
  if (m.teams[0].score > m.teams[1].score) wins++;
}
console.log(JSON.stringify({ aiPasses: +(R.n / N).toFixed(1), avgHeldS: +(R.held / R.n).toFixed(2), oneTouchShare: +(R.quick / R.n).toFixed(2), pressedShare: +(R.near / R.n).toFixed(2), oneTouchUnderPressure: +(R.quickNear / R.n).toFixed(2) }));
console.log(JSON.stringify({ diff, spellsPerMatch: +(spells / N).toFixed(1), avgPasses: +(passSum / Math.max(1, spells)).toFixed(2), avgSecs: +(timeSum / Math.max(1, spells)).toFixed(1), spells6plus: +(longSpells / Math.max(1, spells)).toFixed(2), maxPasses, hist: chainHist }));
