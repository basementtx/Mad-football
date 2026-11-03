/** League screen: table, next fixture, last results, season end. */
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { league, sortedTable, teamById, nextFixture, ratingOf, zoneOf, positionOf, startNextSeason, ROUNDS, DIV_DIFF } from '../meta/league';
import { setScreen, bind, esc, crestTag, coinsPill, coinTag, MenuHandlers } from './common';
import { showHub } from './hub';

function stars(v: number) {
  const full = Math.round(v * 2) / 2;
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="star ${i <= full ? 'on' : i - 0.5 === full ? 'half' : ''}">■</span>`;
  return s;
}

export function showLeague(h: MenuHandlers) {
  const L = t();
  if (league.pending) return showSeasonEnd(h);
  const rows = sortedTable();
  const fx = nextFixture();
  const last = league.results[league.round - 1];
  const diff = DIV_DIFF[league.div];
  const opp = fx ? teamById(fx.opp) : null;
  const me = teamById('club');
  setScreen(
    'screen-league',
    `<div class="league">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="lg-title"><span class="div-badge d${league.div}">${league.div}</span><b>${esc(L.divNames[league.div])}</b><small>${L.season} ${league.season} • ${L.matchday} ${Math.min(league.round + 1, ROUNDS)}/${ROUNDS}</small></div>
        ${coinsPill()}
      </div>
      <div class="lg-body">
        <div class="lg-table">
          <div class="tr th"><span>#</span><span class="tn"></span><span>${L.colP}</span><span>${L.colW}</span><span>${L.colD}</span><span>${L.colL}</span><span>${L.colGD}</span><span>${L.colPts}</span></div>
          ${rows.map((r, i) => {
            const tm = teamById(r.id);
            const z = zoneOf(i + 1);
            const gd = r.gf - r.ga;
            return `<div class="tr ${r.id === 'club' ? 'me' : ''} z-${z || 'mid'}"><span>${i + 1}</span><span class="tn">${crestTag(tm, 'crest-xs')}${esc(tm.name)}</span><span>${r.p}</span><span>${r.w}</span><span>${r.d}</span><span>${r.l}</span><span>${gd > 0 ? '+' + gd : gd}</span><b>${r.pts}</b></div>`;
          }).join('')}
          <div class="lg-legend">${league.div > 1 ? `<span class="lz up">■ ${L.promoZone}</span>` : ''}${league.div < 5 ? `<span class="lz down">■ ${L.releZone}</span>` : ''}</div>
        </div>
        <div class="lg-side">
          ${fx && opp ? `
          <div class="fixture">
            <div class="sec-label">${L.nextMatch} • ${fx.home ? L.vsHome : L.vsAway}</div>
            <div class="fx-row">
              <div class="fx-team">${crestTag(me, 'crest-md')}<b>${esc(me.short)}</b></div>
              <div class="fx-vs">VS</div>
              <div class="fx-team">${crestTag(opp, 'crest-md')}<b>${esc(opp.short)}</b></div>
            </div>
            <div class="fx-name">${esc(opp.name)}</div>
            <div class="stars">${stars(ratingOf(fx.opp))}</div>
            <div class="fx-diff">${L.difficulty}: ${(L as unknown as Record<string, string>)[diff]}</div>
            <button class="btn btn-primary" data-act="play">${L.playMatchday} ▶</button>
          </div>` : ''}
          ${last ? `<div class="results-mini"><div class="sec-label">${L.lastResults}</div>${last.map((r) => `<div class="rm ${r.home === 'club' || r.away === 'club' ? 'me' : ''}"><span>${esc(teamById(r.home).short)}</span><b>${r.hg}-${r.ag}</b><span>${esc(teamById(r.away).short)}</span></div>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showHub(h); });
  bind('[data-act=play]', () => { audio.select(); h.startLeagueMatch(); });
}

export function showSeasonEnd(h: MenuHandlers) {
  const L = t();
  const p = league.pending!;
  const good = p.outcome === 'promoted' || p.outcome === 'champions';
  setScreen(
    'screen-results',
    `<div class="results season-end">
      <div class="sec-label">${L.seasonEnd} • ${L.season} ${p.season}</div>
      <div class="res-title ${good ? 'win' : p.outcome === 'relegated' ? 'loss' : 'draw'}">${L.outcomes[p.outcome]}</div>
      <div class="se-pos">${L.finished}: <b>${p.pos}.</b> • ${esc(L.divNames[p.div])}</div>
      <div class="coins">+${p.coins} ${coinTag()}</div>
      <div class="row"><button class="btn btn-primary" data-act="next">${L.nextSeason} ▶</button></div>
    </div>`,
  );
  if (good) {
    audio.horn();
    audio.cheer(1);
  } else if (p.outcome === 'relegated') audio.groan();
  bind('[data-act=next]', () => {
    startNextSeason();
    audio.select();
    showLeague(h);
  });
  void positionOf;
}
