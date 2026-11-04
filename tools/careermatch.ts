// Career "lock to my player" check: control never switches, and calling for the ball gets you passes.
import { Match } from '../src/game/match';
import { FX } from '../src/game/fx';
import { TEAMS } from '../src/game/teams';
import { randomCard } from '../src/meta/cards';
const mk = () => ({ down: false, pressed: false, released: false, held: 0 });
function run(call: boolean) {
  let touches = 0, switches = 0, received = 0, goals = 0, calls = 0, answered = 0;
  let pending = -1;
  for (let g = 0; g < 6; g++) {
    const cards = [randomCard('silver', 'GK'), randomCard('silver', 'DEF'), randomCard('silver', 'DEF'), randomCard('silver', 'MID'), { ...randomCard('gold', 'FWD'), id: 'me' }];
    const inp: any = { mx: 0, my: 0, btn: { a: mk(), b: mk(), c: mk(), d: mk(), e: mk() } };
    const m = new Match({ home: TEAMS[g % 8], away: TEAMS[(g + 3) % 8], size: 5, duration: 120, difficulty: 'normal', demo: false, homeCards: cards, starId: 'me', lockStar: true, starTrust: 0.5 }, new FX());
    m.start();
    let had = false;
    for (let s = 0; s < 60 * 140 && m.phase !== 'over'; s++) {
      for (const k of 'abcde') { inp.btn[k].pressed = false; inp.btn[k].released = false; }
      const h = m.human!;
      if (h !== m.star) switches++;
      const b = m.ball;
      // drift towards the opponent goal, shoot when we have it
      inp.mx = b.owner === h ? 1 : Math.sign(b.x - h.x) * 0.6 + 0.3; inp.my = b.owner === h ? -h.y / 10 : Math.sign(b.y - h.y) * 0.4;
      if (b.owner === h) { if (!had) { touches++; if (b.prevTouch && b.prevTouch.team === h.team) received++; } inp.btn.a.down = s % 50 < 30; inp.btn.a.pressed = s % 50 === 0; if (s % 50 === 30) inp.btn.a.released = true; }
      else if (call && b.owner && b.owner.team === h.team && s % 40 === 0 && pending < 0) { inp.btn.b.pressed = true; calls++; pending = s; }
      if (pending >= 0 && b.passTarget === h && !b.owner) { answered++; pending = -1; }
      if (pending >= 0 && s - pending > 90) pending = -1;
      had = b.owner === h;
      m.step(1 / 60, inp);
    }
    goals += m.star!.goals;
  }
  return { touches, received, switches, goals, calls, answered };
}
console.log('calling', JSON.stringify(run(true)));
console.log('silent ', JSON.stringify(run(false)));
