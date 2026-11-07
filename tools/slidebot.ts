// Usage: npm run sim:slide -- [normal|hard|insane]   (ATTR=0.4 to set the human squad attributes)
// Scripted "slide spammer" human vs AI: chases the ball, slides at every carrier,
// shoots when close. Measures how dominant pure sliding is.
import { Match } from '../src/game/match';
import { FX } from '../src/game/fx';
import { TEAMS } from '../src/game/teams';
const diff = (process.argv[2] || 'hard') as any;
const mk = () => ({ down: false, pressed: false, released: false, held: 0 });
const C={hit:0,kd:0,dodge:0};
const P:any=Match.prototype; const orig=P.resolveSlideHit; P.resolveSlideHit=function(a:any,q:any){ if(!a.team.human) return orig.call(this,a,q); C.hit++; if(q.invuln>0) C.dodge++; orig.call(this,a,q); if(q.state==='down') C.kd++; };
let gf = 0, ga = 0, slides = 0, wins = 0, n = 0, kdCarrier = 0;
for (let i = 0; i < 16; i++) {
  const m = new Match({ home: TEAMS[i % 8], away: TEAMS[(i + 3) % 8], size: 4, duration: 180, difficulty: diff, demo: false }, new FX());
  m.start();
  const A = process.env.ATTR ? Number(process.env.ATTR) : null;
  if (A !== null) for (const p of m.teams[0].players) { p.pace = A; p.power = A; p.tackle = A; p.skill = A; }
  const inp: any = { mx: 0, my: 0, btn: { a: mk(), b: mk(), c: mk(), d: mk() } };
  let steps = 0, aHeld = 0;
  while (m.phase !== 'over' && steps < 60 * 400) {
    for (const k of ['a', 'b', 'c', 'd']) inp.btn[k].pressed = false;
    const h = m.human, b = m.ball;
    if (h && m.phase === 'play') {
      const o = b.owner;
      const tx = o ? o.x + o.vx * 0.2 : b.x, ty = o ? o.y + o.vy * 0.2 : b.y;
      if (o === h) {
        const gx = 30; const dx = gx - h.x, dy = -h.y; const d = Math.hypot(dx, dy);
        inp.mx = dx / d; inp.my = dy / d; inp.btn.c.down = true;
        if (d < 14 && aHeld === 0) { inp.btn.a.pressed = true; inp.btn.a.down = true; aHeld = 1; }
        else if (aHeld > 0) { aHeld++; if (aHeld > 40) { inp.btn.a.down = false; aHeld = 0; } }
      } else {
        aHeld = 0; inp.btn.a.down = false;
        const dx = tx - h.x, dy = ty - h.y; const d = Math.hypot(dx, dy) || 1;
        inp.mx = dx / d; inp.my = dy / d; inp.btn.c.down = true;
        if (o && o.team !== h.team && d < 3 && d > 1.8 && h.canAct && h.tackleCd <= 0) {
          inp.btn.a.pressed = true; slides++;
          const before = o.state;
          (globalThis as any).__watch = o;
        }
      }
    }
    m.step(1 / 60, inp);
    const w = (globalThis as any).__watch;
    if (w && w.state === 'down') { kdCarrier++; (globalThis as any).__watch = null; }
    m.fx.update(1 / 60, 1 / 60);
    steps++;
  }
  gf += m.teams[0].score; ga += m.teams[1].score; n++;
  if (m.teams[0].score > m.teams[1].score) wins++;
}
console.log(JSON.stringify({ contactsPerMatch: C.hit/16, kdPerContact: +(C.kd/C.hit).toFixed(2), dodgedPerContact: +(C.dodge/C.hit).toFixed(2), diff, gf: gf / n, ga: ga / n, winRate: wins / n, slidesPerMatch: slides / n, carrierKDperSlide: +(kdCarrier / Math.max(1, slides)).toFixed(2) }));
