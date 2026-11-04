/** In-match career overlay: live rating and the manager's targets. */
import type { Match } from '../../game/match';
import { career } from '../../career/state';
import { rateLine, checkObjectives, objectiveText, Line } from '../../career/me';
import { L2 } from '../../career/util';
import type { Objective } from '../../career/types';

let el: HTMLElement | null = null;
let last = 0;
let hintUntil = 0;

export function careerHudStart(drill: boolean) {
  careerHudStop();
  el = document.createElement('div');
  el.id = 'cr-hud';
  el.className = drill ? 'drill' : '';
  document.body.appendChild(el);
  last = 0;
  hintUntil = performance.now() + 9000;
}

export function careerHudStop() {
  el?.remove();
  el = null;
}

export function careerHudTick(m: Match, sub: boolean, big: boolean, visible: boolean) {
  if (!el) return;
  el.style.display = visible ? '' : 'none';
  const now = performance.now();
  if (now - last < 250) return;
  last = now;
  const c = career();
  const s = m.star;
  if (!c || !s) return;
  if (m.cfg.drill) {
    el.innerHTML = `<div class="ch-rate"><small>${L2('GOALS', 'GOL')}</small><b>${m.teams[0].score}</b></div>`;
    return;
  }
  const [a, b] = m.teams;
  const line: Line = { goals: s.goals, assists: s.assists, shots: s.shots, onTarget: s.onTarget, passOk: s.passOk, steals: s.steals, knockdowns: s.knockdowns, lost: s.lost, downs: s.downs, gf: a.score, ga: b.score, sub, big };
  const { rating } = rateLine(c, line);
  const objs: Objective[] = c.phase === 'trial' ? [] : c.ws.objectives.map((o) => ({ ...o }));
  checkObjectives(objs, line, rating);
  const cls = rating >= 8 ? 'r-elite' : rating >= 7 ? 'r-good' : rating >= 6 ? 'r-ok' : 'r-bad';
  el.innerHTML = `<div class="ch-rate ${cls}"><small>${L2('RATING', 'NOT')}</small><b>${rating.toFixed(1)}</b></div>
    ${objs.length ? `<div class="ch-obj">${objs.map((o) => `<span class="${o.done ? 'ok' : ''}">${o.done ? '✔' : '○'} ${objectiveText(o)}</span>`).join('')}</div>` : ''}
    ${now < hintUntil ? `<div class="ch-hint">${L2('Without the ball, PASS = call for it', 'Top sende değilken PAS = topu iste')}</div>` : ''}`;
}
