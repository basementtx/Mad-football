// Slide-spam balance check: a scripted "human" that only chases and slides at every
// carrier (and shoots when close). Shows how dominant pure sliding is and whether
// squad strength matters.  Usage: npm run sim:slide -- [normal|hard|insane] [size]
//   ATTR=0.4 / ATTR=0.95 sets every attribute of the human squad.
import { Match } from '../src/game/match';
import { FX } from '../src/game/fx';
import { TEAMS } from '../src/game/teams';
const diff = (process.argv[2] || 'hard') as any;
const size = Number(process.argv[3] || 7);
const N = Number(process.env.N || 12);
const A = process.env.ATTR ? Number(process.env.ATTR) : null;
const mk = () => ({ down: false, pressed: false, released: false, held: 0 });
const C = { slides: 0, contacts: 0, kd: 0, started: 0, hops: 0 };
const P: any = Match.prototype;
const origKD = P.knockdown;
const oS = P.slide; P.slide = function (p: any, ...r: any[]) { const before = p.state; oS.call(this, p, ...r); if (p === this.human && before !== 'slide' && p.state === 'slide') C.started++; };
const oH = P.hopSlide; P.hopSlide = function (q: any, sl: any) { if (sl === this.human) C.hops++; oH.call(this, q, sl); };
P.knockdown = function (v: any, a: any, ...rest: any[]) {
  const ok = origKD.call(this, v, a, ...rest);
  if (ok && a && a === this.human && a.state === 'slide') C.kd++;
  return ok;
};
let gf = 0, ga = 0, wins = 0, losses = 0;
for (let i = 0; i < N; i++) {
  const m = new Match({ home: TEAMS[i % 8], away: TEAMS[(i + 3) % 8], size, duration: 180, difficulty: diff, demo: false }, new FX());
  m.start();
  if (A !== null) for (const p of m.teams[0].players) { p.pace = A; p.power = A; p.tackle = A; p.skill = A; }
  const inp: any = { mx: 0, my: 0, btn: { a: mk(), b: mk(), c: mk(), d: mk(), e: mk() } };
  let steps = 0, aHeld = 0;
  while (m.phase !== 'over' && steps < 60 * 400) {
    for (const k of 'abcde') { inp.btn[k].pressed = false; inp.btn[k].released = false; }
    const h = m.human, b = m.ball;
    if (h && m.phase === 'play' && !h.isGK) {
      const o = b.owner;
      if (o === h) {
        const gx = h.team.side * m.pitch.hw; const dx = gx - h.x, dy = -h.y; const d = Math.hypot(dx, dy);
        inp.mx = dx / d; inp.my = dy / d; inp.btn.c.down = true;
        if (d < 16 && aHeld === 0) { inp.btn.a.pressed = true; inp.btn.a.down = true; aHeld = 1; }
        else if (aHeld > 0) { aHeld++; if (aHeld > 40) { inp.btn.a.down = false; inp.btn.a.released = true; aHeld = 0; } }
      } else {
        aHeld = 0; inp.btn.a.down = false;
        const tx = o ? o.x + o.vx * 0.2 : b.x, ty = o ? o.y + o.vy * 0.2 : b.y;
        const dx = tx - h.x, dy = ty - h.y; const d = Math.hypot(dx, dy) || 1;
        inp.mx = dx / d; inp.my = dy / d; inp.btn.c.down = true;
        if (o && o.team !== h.team && !o.isGK && d < 3.2 && d > 1.8 && h.canAct && h.tackleCd <= 0) { inp.btn.a.pressed = true; inp.btn.a.down = true; C.slides++; }
      }
    } else inp.mx = inp.my = 0;
    m.step(1 / 60, inp);
    m.fx.update(1 / 60, 1 / 60);
    steps++;
  }
  gf += m.teams[0].score; ga += m.teams[1].score;
  if (m.teams[0].score > m.teams[1].score) wins++; else if (m.teams[0].score < m.teams[1].score) losses++;
}
console.log(JSON.stringify({ diff, size, attr: A, gf: +(gf / N).toFixed(2), ga: +(ga / N).toFixed(2), win: +(wins / N).toFixed(2), loss: +(losses / N).toFixed(2), slides: +(C.slides / N).toFixed(1), kdPerSlide: +(C.kd / Math.max(1, C.slides)).toFixed(2), started: +(C.started / Math.max(1, C.slides)).toFixed(2), hopsPerSlide: +(C.hops / Math.max(1, C.slides)).toFixed(2) }));
