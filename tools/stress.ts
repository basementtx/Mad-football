// Crash hunt: random human input for many matches; reports exceptions, NaN state and slow frames.
import { Match } from '../src/game/match';
import { FX } from '../src/game/fx';
import { TEAMS } from '../src/game/teams';
import { makeEnv } from '../src/game/env';
const mk = () => ({ down: false, pressed: false, released: false, held: 0, flick: false });
const N = Number(process.env.N || 30);
const diffs = ['easy', 'normal', 'hard', 'insane', 'legend'];
const sizes = [3, 4, 5, 7];
const weathers = ['clear', 'rain', 'storm', 'snow', 'wind', 'night'];
let errors = 0, nans = 0, slow = 0, maxMs = 0;
for (let i = 0; i < N; i++) {
  const diff = diffs[i % 5], size = sizes[i % 4], w = weathers[i % 6];
  let m: any;
  try {
    m = new Match({ home: TEAMS[i % 8], away: TEAMS[(i + 3) % 8], size, duration: 150, difficulty: diff as any, demo: false, env: makeEnv(w as any),
      loadout: { goalfx: 'gx_classic', trail: 'tr_basic', powers: ['pw_fireball', 'pw_bomb', 'pw_rifle'], tiers: {} } } as any, new FX());
    m.start();
  } catch (e) { console.log('CTOR', diff, size, w, e); errors++; continue; }
  const inp: any = { mx: 0, my: 0, btn: { a: mk(), b: mk(), c: mk(), d: mk(), e: mk() } };
  for (let s = 0; s < 60 * 200 && m.phase !== 'over'; s++) {
    for (const k of 'abcde') { const bt = inp.btn[k]; bt.pressed = false; bt.released = false; bt.flick = false;
      if (Math.random() < 0.03) { if (bt.down) { bt.down = false; bt.released = true; bt.flick = Math.random() < 0.2; } else { bt.down = true; bt.pressed = true; } } }
    if (Math.random() < 0.05) { const a = Math.random() * 6.3, r = Math.random() < 0.15 ? 0 : 1; inp.mx = Math.cos(a) * r; inp.my = Math.sin(a) * r; }
    const t0 = performance.now();
    try { m.step(1 / 60, inp); m.fx.update(1 / 60, 1 / 60); }
    catch (e: any) { errors++; console.log('STEP ERR', diff, size, w, 'phase', m.phase, e?.stack?.split('\n').slice(0, 6).join(' | ')); break; }
    const dt = performance.now() - t0; maxMs = Math.max(maxMs, dt); if (dt > 30) { slow++; if (slow < 5) console.log('SLOW', dt.toFixed(0), 'ms', diff, size, w, m.phase); }
    const b = m.ball;
    if (![b.x, b.y, b.z, b.vx, b.vy].every(Number.isFinite) || m.all.some((p: any) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      nans++; console.log('NaN', diff, size, w, 'phase', m.phase, 's', s, 'ball', b.x, b.y, b.vx, 'owner', b.owner?.role,
        m.all.filter((p: any) => !Number.isFinite(p.x)).map((p: any) => p.role + ':' + p.state)); break;
    }
  }
}
console.log({ matches: N, errors, nans, slow, maxMs: +maxMs.toFixed(1) });
