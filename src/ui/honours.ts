/** Trophy cabinet, club legends and club records. */
import { settings } from '../engine/storage';
import { audio } from '../engine/audio';
import { t } from '../engine/i18n';
import { honours, legendScore, CardRecord, Trophy } from '../meta/honours';
import { clubTeamDef } from '../meta/profile';
import type { CardLook } from '../meta/cards';
import { trophyCanvas, DIV_METAL } from '../pixel/trophy';
import { setScreen, bind, esc, paintTag, portraitSource, lookFor, crestTag, MenuHandlers } from './common';

const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);
type Tab = 'cabinet' | 'legends' | 'records';
let tab: Tab = 'cabinet';

const fmtDate = (at: number) => new Date(at).toLocaleDateString(settings.lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function trophyName(tr: Trophy) {
  const div = t().divNames[tr.div] ?? '';
  if (tr.kind === 'cup') return `${L2('Mad Cup', 'Mad Kupası')} #${tr.n}`;
  if (tr.kind === 'league') return `${div} ${L2('Champions', 'Şampiyonu')}`;
  return `${L2('Promoted from', 'Terfi:')} ${div}`;
}

function trophyArt(tr: Trophy, ribbon: string) {
  if (tr.kind === 'cup') return trophyCanvas('cup', ribbon, tr.div <= 2 ? 'gold' : 'gold');
  if (tr.kind === 'league') return trophyCanvas('league', ribbon, DIV_METAL[tr.div] ?? 'gold');
  return trophyCanvas('promotion', ribbon, DIV_METAL[tr.div] ?? 'bronze');
}

/** The cabinet: three lit shelves; won trophies with brass plaques, the rest as faint silhouettes. */
function cabinetHTML() {
  const club = clubTeamDef();
  const rib = club?.primary ?? '#e23a2e';
  const list = [...honours.trophies].sort((a, b) => b.at - a.at);
  const cups = list.filter((x) => x.kind === 'cup').length;
  const titles = list.filter((x) => x.kind === 'league').length;
  const promos = list.filter((x) => x.kind === 'promotion').length;
  // fill shelves: real trophies first, then ghost slots to win
  const ghosts: Trophy[] = [];
  if (!cups) ghosts.push({ kind: 'cup', div: 5, n: 1, at: 0 });
  if (!titles) ghosts.push({ kind: 'league', div: 1, n: 1, at: 0 });
  if (!promos) ghosts.push({ kind: 'promotion', div: 5, n: 1, at: 0 });
  const items = [...list.map((x) => ({ x, ghost: false })), ...ghosts.map((x) => ({ x, ghost: true }))];
  const perShelf = 4;
  const shelves = Math.max(2, Math.ceil(items.length / perShelf));
  let html = '';
  for (let s = 0; s < shelves; s++) {
    const row = items.slice(s * perShelf, s * perShelf + perShelf);
    html += `<div class="hc-shelf"><div class="hc-items">${row.map(({ x, ghost }) => `
      <div class="hc-item ${ghost ? 'ghost' : ''} k-${x.kind}">
        <div class="hc-spot"></div>
        ${paintTag(() => trophyArt(x, rib), 'hc-art')}
        <div class="hc-plaque"><b>${esc(trophyName(x))}</b>${ghost ? `<small>${L2('not won yet', 'henüz kazanılmadı')}</small>` : `<small>${x.kind === 'cup' ? '' : L2('Season', 'Sezon') + ' ' + x.n + ' · '}${fmtDate(x.at)}</small>${x.note ? `<small>${esc(x.note)}</small>` : ''}`}</div>
      </div>`).join('')}</div><div class="hc-board"></div></div>`;
  }
  return `<div class="hc-wrap">
    <div class="hc-sum">
      <div class="hc-stat"><b>${cups}</b><span>${L2('Cups', 'Kupa')}</span></div>
      <div class="hc-stat"><b>${titles}</b><span>${L2('League titles', 'Lig şampiyonluğu')}</span></div>
      <div class="hc-stat"><b>${promos}</b><span>${L2('Promotions', 'Terfi')}</span></div>
    </div>
    <div class="hc-cab">
      <div class="hc-crown">${club ? crestTag(club, 'crest-sm') : ''}<span>${esc(club?.name ?? '')}</span></div>
      <div class="hc-glass">${html}<div class="hc-reflect"></div></div>
    </div>
  </div>`;
}

function portrait(r: CardRecord) {
  const club = clubTeamDef();
  if (!club || !r.look) return '<div class="hl-noface">?</div>';
  return paintTag(portraitSource(lookFor(club, r.look as CardLook, r.pos === 'GK')), 'hl-face');
}

function legendsHTML() {
  const all = Object.entries(honours.cards).map(([id, r]) => ({ id, r, sc: legendScore(r) })).sort((a, b) => b.sc - a.sc);
  if (!all.length) return `<div class="hl-empty">${L2('Play club matches: your best players become club legends here.', 'Kulübünle maç oyna: en iyi oyuncuların burada kulüp efsanesi olur.')}</div>`;
  const top = all.slice(0, 3);
  const frames = ['gold', 'silver', 'bronze'];
  const status = (r: CardRecord) => (r.apps >= 40 || r.goals >= 30 ? L2('CLUB LEGEND', 'KULÜP EFSANESİ') : r.apps >= 15 || r.goals >= 10 ? L2('CLUB HERO', 'KULÜP KAHRAMANI') : L2('RISING', 'YÜKSELEN'));
  const podium = top.map(({ r }, i) => `
    <div class="hl-frame f-${frames[i]} p${i}">
      <div class="hl-rank">${i + 1}</div>
      <div class="hl-pic">${portrait(r)}<div class="hl-glass"></div></div>
      <div class="hl-name"><b>${esc(r.name)}</b><small>${t().pos[r.pos as 'GK'] ?? r.pos} · ${status(r)}</small></div>
      <div class="hl-nums"><span><b>${r.apps}</b>${L2('apps', 'maç')}</span><span><b>${r.goals}</b>${L2('goals', 'gol')}</span><span><b>${r.assists}</b>${L2('assists', 'asist')}</span><span><b>${r.motm}</b>⭐</span></div>
    </div>`).join('');
  const rows = all.slice(0, 12).map(({ r }, i) => `<div class="hl-row ${i < 3 ? 'top' : ''}"><span>${i + 1}</span><b>${esc(r.name)}</b><i>${t().pos[r.pos as 'GK'] ?? r.pos}</i><em>${r.apps}</em><em>${r.goals}</em><em>${r.assists}</em><em>${r.motm}</em></div>`).join('');
  return `<div class="hl-wrap">
    <div class="hl-podium">${podium}</div>
    <div class="hl-table"><div class="hl-row th"><span>#</span><b>${L2('Player', 'Oyuncu')}</b><i></i><em>${L2('Apps', 'Maç')}</em><em>${L2('G', 'G')}</em><em>${L2('A', 'A')}</em><em>⭐</em></div>${rows}</div>
  </div>`;
}

function recordsHTML() {
  const R = honours.records;
  const top = Object.values(honours.cards).sort((a, b) => b.goals - a.goals)[0];
  const most = Object.values(honours.cards).sort((a, b) => b.apps - a.apps)[0];
  const rec = (icon: string, label: string, value: string, sub = '') => `<div class="hr-card"><span class="hr-ic">${icon}</span><div><small>${label}</small><b>${value}</b>${sub ? `<i>${sub}</i>` : ''}</div></div>`;
  return `<div class="hr-grid">
    ${rec('💥', L2('Biggest win', 'En farklı galibiyet'), R.biggestWin ? `${R.biggestWin.gf}-${R.biggestWin.ga}` : '—', R.biggestWin ? `vs ${esc(R.biggestWin.opp)} · ${fmtDate(R.biggestWin.at)}` : '')}
    ${rec('🎯', L2('Most goals in a match', 'Bir maçta en çok gol'), R.mostGoalsMatch ? `${R.mostGoalsMatch.goals}` : '—', R.mostGoalsMatch ? `${esc(R.mostGoalsMatch.name)} · vs ${esc(R.mostGoalsMatch.opp)}` : '')}
    ${rec('🛡️', L2('Longest unbeaten run', 'En uzun yenilmezlik'), `${R.bestUnbeaten}`, L2(`now: ${R.unbeaten}`, `şu an: ${R.unbeaten}`))}
    ${rec('👟', L2('All-time top scorer', 'Tüm zamanların golcüsü'), top ? `${top.goals}` : '—', top ? esc(top.name) : '')}
    ${rec('🎽', L2('Most appearances', 'En çok forma giyen'), most ? `${most.apps}` : '—', most ? esc(most.name) : '')}
    ${rec('📅', L2('Club matches', 'Kulüp maçları'), `${R.matches}`, '')}
  </div>`;
}

export function showHonours(h: MenuHandlers, back: () => void, to?: Tab) {
  if (to) tab = to;
  setScreen(
    'screen-honours',
    `<div class="honours">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${t().back}</button>
        <div class="panel-title">${tab === 'legends' ? L2('CLUB LEGENDS', 'KULÜP EFSANELERİ') : tab === 'records' ? L2('CLUB RECORDS', 'KULÜP REKORLARI') : L2('TROPHY CABINET', 'KUPA DOLABI')}</div>
        <div style="width:80px"></div>
      </div>
      <div class="tabs">
        <button class="tab ${tab === 'cabinet' ? 'on' : ''}" data-tab="cabinet">🏆 ${L2('Trophies', 'Kupalar')} <small>${honours.trophies.length}</small></button>
        <button class="tab ${tab === 'legends' ? 'on' : ''}" data-tab="legends">⭐ ${L2('Legends', 'Efsaneler')}</button>
        <button class="tab ${tab === 'records' ? 'on' : ''}" data-tab="records">📜 ${L2('Records', 'Rekorlar')}</button>
      </div>
      <div class="ho-body">${tab === 'cabinet' ? cabinetHTML() : tab === 'legends' ? legendsHTML() : recordsHTML()}</div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); back(); });
  bind('[data-tab]', (b) => { audio.click(); tab = b.dataset.tab as Tab; showHonours(h, back); });
}
