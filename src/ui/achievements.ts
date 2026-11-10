/** Achievements list (a tab of the Missions screen) and the "unlocked" pop-ups. */
import { settings } from '../engine/storage';
import { audio, vibrate } from '../engine/audio';
import { ACHIEVEMENTS, ACH_REWARD, achStat, achTier, Unlock } from '../meta/achievements';
import { esc, coinTag } from './common';

const lang = () => (settings.lang === 'tr' ? 1 : 0);
const ROMAN = ['', 'I', 'II', 'III'];

export function achievementsHTML() {
  const li = lang();
  return `<div class="ach-grid">${ACHIEVEMENTS.map((d) => {
    const tier = achTier(d.id);
    const v = achStat(d.id);
    const done = tier >= 3;
    const target = d.tiers[Math.min(tier, 2)];
    const prev = tier > 0 ? d.tiers[tier - 1] : 0;
    const pct = done ? 100 : Math.max(0, Math.min(100, Math.round(((v - (d.max ? 0 : prev)) / (target - (d.max ? 0 : prev))) * 100)));
    return `<div class="ach ${tier ? 'got' : ''} ${done ? 'done' : ''}">
      <div class="ach-ic">${d.icon}</div>
      <div class="ach-main">
        <b>${esc(d.name[li])}${tier ? ` <em>${ROMAN[tier]}</em>` : ''}</b>
        <small>${esc(d.desc[li].replace('{n}', String(target)))}</small>
        <div class="m-bar"><i style="width:${pct}%"></i><span>${done ? '✔' : `${Math.min(v, target)}/${target}`}</span></div>
      </div>
      <div class="ach-side">
        <div class="ach-pips">${[0, 1, 2].map((i) => `<i class="${i < tier ? 'on' : ''}"></i>`).join('')}</div>
        ${done ? '' : `<small>+${ACH_REWARD[tier]} ${coinTag()}</small>`}
      </div>
    </div>`;
  }).join('')}</div>`;
}

let queue: Unlock[] = [];
let showing = false;

/** "Achievement unlocked" cards, one after another at the top of the screen. */
export function announceAchievements(list: Unlock[]) {
  if (!list.length) return;
  queue.push(...list);
  if (!showing) next();
}

function next() {
  const u = queue.shift();
  if (!u) {
    showing = false;
    return;
  }
  showing = true;
  const li = lang();
  const el = document.createElement('div');
  el.className = 'ach-pop';
  el.innerHTML = `<div class="ach-ic">${u.def.icon}</div><div><small>${li ? 'BAŞARIM AÇILDI' : 'ACHIEVEMENT UNLOCKED'}</small><b>${esc(u.def.name[li])} ${ROMAN[u.tier]}</b></div><div class="ach-rew">+${u.reward}</div>`;
  document.body.appendChild(el);
  audio.select();
  vibrate(30);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => {
      el.remove();
      next();
    }, 350);
  }, 2600);
}

// ---------------------------------------------------------------- match summaries -> counters

export interface MatchFacts {
  goalsFor: number;
  goalsAgainst: number;
  knockdowns: number;
  powers: number;
  headers: number;
  difficulty: string;
  /** the user's side was behind at some point */
  wasBehind: boolean;
}

export function matchAch(f: MatchFacts): Partial<Record<import('../meta/achievements').AchStat, number>> {
  const win = f.goalsFor > f.goalsAgainst;
  return {
    matches: 1,
    wins: win ? 1 : 0,
    goals: f.goalsFor,
    knockdowns: f.knockdowns,
    powers: f.powers,
    headers: f.headers,
    cleanSheets: f.goalsAgainst === 0 ? 1 : 0,
    hardWins: win && ['hard', 'insane', 'legend'].includes(f.difficulty) ? 1 : 0,
    insaneWins: win && ['insane', 'legend'].includes(f.difficulty) ? 1 : 0,
    comebacks: win && f.wasBehind ? 1 : 0,
    routs: win && f.goalsFor - f.goalsAgainst >= 5 ? 1 : 0,
  };
}

/** Was team `idx` behind at any point (from the match's goal log)? */
export function wasBehind(log: { team: 0 | 1 }[], idx: 0 | 1) {
  let d = 0;
  for (const g of log) {
    d += g.team === idx ? 1 : -1;
    if (d < 0) return true;
  }
  return false;
}
