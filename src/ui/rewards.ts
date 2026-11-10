/** Daily login calendar and the season pass screen. */
import { settings } from '../engine/storage';
import { audio } from '../engine/audio';
import { t } from '../engine/i18n';
import { setScreen, bind, esc, coinTag, coinsPill, toast, paintTag, MenuHandlers } from './common';
import { DAILY, dailyStatus, claimDaily, DailyReward } from '../meta/daily';
import { seasonState, seasonReward, claimSeasonLevel, addSeasonXp, SEASON_LEVELS, XP_PER_LEVEL, SeasonReward } from '../meta/season';
import { itemReward } from '../meta/crates';
import { itemName } from '../meta/items';
import { saveProfile } from '../meta/profile';
import { openFreeCrate } from './shop';
import { itemIconSource } from './cards';
import { popCard } from './achievements';

const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);
const CRATE_NAME = { basic: ['Basic Crate', 'Temel Kasa'], premium: ['Premium Crate', 'Premium Kasa'], legend: ['Legend Crate', 'Efsane Kasa'] } as const;
const CRATE_ICON = { basic: '📦', premium: '💎', legend: '👑' } as const;

export function fmtLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const tr = settings.lang === 'tr';
  if (d > 0) return `${d}${tr ? 'g' : 'd'} ${h}${tr ? 's' : 'h'}`;
  if (h > 0) return `${h}${tr ? 's' : 'h'} ${m}${tr ? 'dk' : 'm'}`;
  return `${m}${tr ? 'dk' : 'm'} ${String(sec).padStart(2, '0')}${tr ? 'sn' : 's'}`;
}

let tick = 0;
function liveTimer(sel: string, ms: () => number, onZero?: () => void) {
  clearInterval(tick);
  tick = window.setInterval(() => {
    const el = document.querySelector(sel);
    if (!el) return clearInterval(tick);
    const left = ms();
    el.textContent = fmtLeft(left);
    if (left <= 0 && onZero) {
      clearInterval(tick);
      onZero();
    }
  }, 1000);
}

// ---------------------------------------------------------------- daily reward

const dailyBody = (r: DailyReward) => {
  const tr = settings.lang === 'tr' ? 1 : 0;
  const parts: string[] = [];
  if (r.crate) parts.push(`<span class="dr-ic">${CRATE_ICON[r.crate]}</span><b>${CRATE_NAME[r.crate][tr]}</b>`);
  if (r.coins) parts.push(`${r.crate ? '' : '<span class="dr-ic">🪙</span>'}<b>+${r.coins}</b>${coinTag()}`);
  return parts.join('');
};

/** The 7-day calendar. `after` runs when the player moves on. */
export function showDaily(h: MenuHandlers, after: () => void) {
  const st = dailyStatus();
  setScreen(
    'screen-daily',
    `<div class="panel daily">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${t().back}</button>
        <div class="panel-title">${L2('DAILY REWARD', 'GÜNLÜK ÖDÜL')}</div>
        ${coinsPill()}
      </div>
      <div class="dr-days">
        ${DAILY.map((r, i) => {
          const got = i < st.claimed;
          const today = st.ready && i === st.day;
          return `<div class="dr-day ${got ? 'got' : ''} ${today ? 'today' : ''} ${i === 6 ? 'big' : ''}">
            <small>${L2('DAY', 'GÜN')} ${i + 1}</small>
            <div class="dr-rew">${dailyBody(r)}</div>
            <i>${got ? '✔' : today ? L2('TODAY', 'BUGÜN') : ''}</i>
          </div>`;
        }).join('')}
      </div>
      <div class="dr-foot">
        ${st.reset ? `<p class="dr-note">${L2('You missed a day - the week starts over.', 'Bir gün kaçırdın, hafta baştan başladı.')}</p>` : ''}
        ${st.ready
          ? `<button class="btn btn-xl btn-primary" data-act="claim">${L2('CLAIM', 'ÖDÜLÜ AL')} ▶</button>`
          : `<p class="dr-next">${L2('Next reward in', 'Sıradaki ödüle')} <b class="dr-left">${fmtLeft(st.nextIn)}</b></p>
             <button class="btn" data-act="back">${L2('CONTINUE', 'DEVAM')} ▶</button>`}
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); clearInterval(tick); after(); });
  if (!st.ready) liveTimer('.dr-left', () => dailyStatus().nextIn, () => showDaily(h, after));
  bind('[data-act=claim]', () => {
    const r = claimDaily();
    if (!r) return;
    audio.horn();
    const lv = addSeasonXp(r.xp ?? 0);
    lv.forEach((n) => popCard('⭐', L2('SEASON LEVEL UP', 'SEZON SEVİYESİ'), `${L2('Level', 'Seviye')} ${n}`, '🎁'));
    if (r.crate) openFreeCrate(h, r.crate, () => showDaily(h, after));
    else {
      toast(`+${r.coins} ${t().coins}`);
      showDaily(h, after);
    }
  });
}

// ---------------------------------------------------------------- season pass

function rewardLabel(r: SeasonReward) {
  const tr = settings.lang === 'tr' ? 1 : 0;
  if (r.kind === 'coins') return `<span class="sp-ic">🪙</span><b>+${r.n}</b>`;
  if (r.kind === 'crate') return `<span class="sp-ic">${CRATE_ICON[r.id]}</span><b>${CRATE_NAME[r.id][tr]}</b>`;
  return `${paintTag(itemIconSource(r.item), 'sp-item')}<b>${esc(itemName(r.item))}</b>`;
}

export function showSeason(h: MenuHandlers, back: () => void) {
  const st = seasonState();
  setScreen(
    'screen-season',
    `<div class="panel season">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${t().back}</button>
        <div class="panel-title">${L2('SEASON', 'SEZON')} ${st.number}</div>
        ${coinsPill()}
      </div>
      <div class="sp-top">
        <div class="sp-lv"><small>${L2('LEVEL', 'SEVİYE')}</small><b>${st.level}</b></div>
        <div class="sp-xp">
          <div class="m-bar"><i style="width:${Math.round((st.into / XP_PER_LEVEL) * 100)}%"></i><span>${st.level >= SEASON_LEVELS ? 'MAX' : `${st.into}/${XP_PER_LEVEL} XP`}</span></div>
          <small>${L2('Earn XP in every match, free-kick round, duel, online game and daily reward.', 'Her maç, serbest vuruş, düello, online maç ve günlük ödülden XP kazan.')}</small>
        </div>
        <div class="sp-end"><small>${L2('ENDS IN', 'BİTİŞE')}</small><b class="sp-left">${fmtLeft(st.endsIn)}</b></div>
      </div>
      <div class="sp-track">
        ${Array.from({ length: SEASON_LEVELS }, (_, i) => {
          const lv = i + 1;
          const r = seasonReward(st.season, lv);
          const got = st.claimed.includes(lv);
          const ready = lv <= st.level && !got;
          return `<div class="sp-cell ${got ? 'got' : ''} ${ready ? 'ready' : ''} ${lv > st.level ? 'locked' : ''} ${r.kind === 'item' ? 'star' : ''}" ${ready ? `data-claim="${lv}"` : ''}>
            <small>${lv}</small>
            <div class="sp-rew">${rewardLabel(r)}</div>
            <i>${got ? '✔' : ready ? L2('CLAIM', 'AL') : '🔒'}</i>
          </div>`;
        }).join('')}
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); clearInterval(tick); back(); });
  liveTimer('.sp-left', () => seasonState().endsIn, () => showSeason(h, back));
  // scroll the track to the first reward still to claim (or the current level)
  const track = document.querySelector<HTMLElement>('.sp-track');
  const focus = track?.querySelector<HTMLElement>('.sp-cell.ready') ?? track?.querySelectorAll<HTMLElement>('.sp-cell')[Math.max(0, st.level - 1)];
  if (track && focus) track.scrollLeft = Math.max(0, focus.offsetLeft - track.clientWidth / 3);
  bind('[data-claim]', (el) => {
    const lv = Number(el.dataset.claim);
    const r = claimSeasonLevel(lv);
    if (!r) return;
    audio.horn();
    if (r.kind === 'crate') return openFreeCrate(h, r.id, () => showSeason(h, back));
    if (r.kind === 'item') {
      const got = itemReward(r.item);
      saveProfile();
      toast(got.kind === 'item' && got.dupe ? `+${got.refund} ${t().coins}` : `${itemName(r.item)} ✔`);
    } else toast(`+${r.n} ${t().coins}`);
    showSeason(h, back);
  });
}
