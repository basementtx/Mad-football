/** Daily and weekly missions screen. */
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { refreshMissions, resetsIn, claimMission, Mission } from '../meta/missions';
import { setScreen, bind, esc, coinTag, coinsPill, toast, MenuHandlers } from './common';
import { showHub } from './hub';

export function missionLabel(m: Mission) {
  return (t().missionText[m.type] ?? m.type).replace('{n}', String(m.target));
}

function fmtTime(ms: number) {
  const L = t();
  const min = Math.max(1, Math.floor(ms / 60000));
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), mm = min % 60;
  return d > 0 ? `${d}${L.days} ${h}${L.hours}` : h > 0 ? `${h}${L.hours} ${mm}${L.minutes}` : `${mm}${L.minutes}`;
}

export function showMissions(h: MenuHandlers) {
  const L = t();
  const st = refreshMissions();
  const r = resetsIn();
  const row = (m: Mission, key: string) => {
    const done = m.progress >= m.target;
    const pct = Math.round((m.progress / m.target) * 100);
    return `<div class="mission ${done ? 'done' : ''} ${m.claimed ? 'claimed' : ''}">
      <div class="m-main">
        <div class="m-text">${esc(missionLabel(m))}</div>
        <div class="m-bar"><i style="width:${pct}%"></i><span>${m.progress}/${m.target}</span></div>
      </div>
      <div class="m-side">
        <div class="m-rew">+${m.reward} ${coinTag()}</div>
        ${m.claimed ? `<div class="m-tag">✔ ${L.claimed}</div>` : done ? `<button class="btn btn-primary btn-sm" data-claim="${key}">${L.claim}</button>` : ''}
      </div>
    </div>`;
  };
  setScreen(
    'screen-missions',
    `<div class="panel missions">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="panel-title">${L.missions}</div>
        ${coinsPill()}
      </div>
      <div class="panel-body cols">
        <div class="m-col">
          <div class="sec-label">${L.daily} <small>${L.resetsIn}: ${fmtTime(r.daily)}</small></div>
          ${st.daily.map((m, i) => row(m, 'd' + i)).join('')}
        </div>
        <div class="m-col">
          <div class="sec-label">${L.weekly} <small>${L.resetsIn}: ${fmtTime(r.weekly)}</small></div>
          ${st.weekly.map((m, i) => row(m, 'w' + i)).join('')}
        </div>
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showHub(h); });
  bind('[data-claim]', (el) => {
    const k = el.dataset.claim!;
    const m = (k[0] === 'd' ? st.daily : st.weekly)[Number(k.slice(1))];
    const got = claimMission(m);
    if (got) {
      audio.select();
      toast(`+${got}`);
    }
    showMissions(h);
  });
}
