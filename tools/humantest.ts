// Scripted "human" vs AI smoke test: keeper control, hold limit, items, curled shots, AI pressing.
import { Match } from '../src/game/match';
import { FX } from '../src/game/fx';
import { TEAMS } from '../src/game/teams';
const mk = () => ({ down: false, pressed: false, released: false, held: 0 });
const inp: any = { mx: 0, my: 0, btn: { a: mk(), b: mk(), c: mk(), d: mk(), e: mk() } };
const press = (k: string) => { inp.btn[k].down = true; inp.btn[k].pressed = true; };
const release = (k: string) => { inp.btn[k].down = false; inp.btn[k].released = true; };
const consume = () => { for (const k of 'abcde') { inp.btn[k].pressed = false; inp.btn[k].released = false; } };
const diff = (process.argv[2] || 'normal') as any;
let presses = 0, maxCurl = 0, gkHolds = 0, gkAuto = 0, gkThrows = 0, items = 0, curls = 0, goalsFor = 0, goalsAg = 0, nearSum = 0, nearN = 0, lostEarly = 0, poss = 0;
for (let g = 0; g < 6; g++) {
  const m = new Match({ home: TEAMS[g % 8], away: TEAMS[(g + 3) % 8], size: 4, duration: 120, difficulty: diff, demo: false, loadout: { goalfx: 'gx_classic', trail: 'tr_basic', powers: ['pw_fireball', 'pw_bomb', 'pw_rifle'], tiers: { bomb: 3 } } }, new FX());
  m.start();
  let shotT = 0, gkT = 0, wasGK = false, ownT = 0, wasOwner = false;
  for (let s = 0; s < 60 * 200 && m.phase !== 'over'; s++) {
    const h = m.human, b = m.ball;
    consume();
    if (h && m.phase === 'play') {
      const has = b.owner === h;
      if (has && !wasOwner) { ownT = 0; poss++; }
      if (!has && wasOwner && !h.isGK && ownT < 1.2 && b.owner && b.owner.team !== h.team) lostEarly++;
      wasOwner = has;
      if (has) ownT += 1 / 60;
      if (has && !h.isGK && ownT < 1.5) {
        let nd = 99; for (const q of m.teams[1].players) if (!q.isGK) nd = Math.min(nd, Math.hypot(q.x - h.x, q.y - h.y));
        nearSum += nd; nearN++;
      }
      if (h.isGK && has) {
        if (!wasGK) { gkHolds++; gkT = 0; }
        gkT += 1 / 60;
        inp.mx = 1; inp.my = 0.2;
        // every other hold: throw by hand after 2s, otherwise wait for the auto release
        if (gkHolds % 2 === 0 && gkT > 2 && !inp.btn.b.down) press('b');
        else if (inp.btn.b.down && gkT > 2.2) { release('b'); gkThrows++; }
      } else if (wasGK && gkT > 5.9) gkAuto++;
      wasGK = h.isGK && has;
      if (!h.isGK) {
        const tx = has ? 30 : b.x, ty = has ? 0 : b.y;
        const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
        inp.mx = dx / d; inp.my = dy / d;
        if (has && ownT < 1.5) { inp.mx = 0; inp.my = 0; } // stand still after receiving
        if (has && Math.abs(h.x - 30) < 16) {
          if (!inp.btn.a.down) { press('a'); shotT = 0; presses++; }
          maxCurl = Math.max(maxCurl, Math.abs(m.curl));
          shotT += 1 / 60;
          if (shotT > 0) inp.my = 0.9; // push sideways while charging: curl
          if (shotT > 0.5) { if (Math.abs(m.curl) > 0.3) curls++; release('a'); }
        }
        if (m.teams[0].item && m.canUseItem(h)) { press('e'); items++; }
      }
    }
    m.step(1 / 60, inp);
    m.fx.update(1 / 60, 1 / 60);
  }
  goalsFor += m.teams[0].score; goalsAg += m.teams[1].score;
}
console.log(JSON.stringify({ diff, presses, maxCurl, gkHolds, gkThrows, gkAuto, items, curls, goalsFor, goalsAg, avgNearestOppFirst1_5s: +(nearSum / nearN).toFixed(2), possessions: poss, lostWithin1_2s: lostEarly }));
