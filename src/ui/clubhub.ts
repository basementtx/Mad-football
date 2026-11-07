/** My Club: squad, formation, facilities, trophy cabinet, legends, my player. */
import { settings } from '../engine/storage';
import { audio } from '../engine/audio';
import { t } from '../engine/i18n';
import { profile, clubTeamDef, clubOverall, cardById } from '../meta/profile';
import { formationFor } from '../game/formations';
import { facLevel, academyReadyIn, stadiumSeats } from '../meta/facilities';
import { honours, legendScore } from '../meta/honours';
import { trophyCanvas } from '../pixel/trophy';
import { setScreen, bind, esc, crestTag, coinsPill, paintTag, portraitSource, lookFor, MenuHandlers } from './common';
import { cardHTML } from './cards';
import type { CardLook } from '../meta/cards';
import { showHub } from './hub';
import { showSquad, showFormations } from './club';
import { showFacilities } from './facilities';
import { showHonours } from './honours';
import { showCreator } from './creator';

const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);

export function showClubHub(h: MenuHandlers) {
  const club = clubTeamDef();
  if (!club) return showHub(h);
  const me = cardById(profile.myPlayer);
  const f5 = formationFor(7, profile.formations?.[7]);
  const best = Object.values(honours.cards).sort((a, b) => legendScore(b) - legendScore(a))[0];
  const trophies = honours.trophies.length;
  const facSum = (['stadium', 'training', 'fitness', 'academy', 'scouting'] as const).reduce((a, id) => a + facLevel(id), 0);
  const gradReady = academyReadyIn() <= 0;
  const dots = f5.spots.map(([u, w], i) => `<i class="ch-dot r-${f5.roles[i]}" style="left:${((u + 1) / 2) * 100}%;top:${((w + 1) / 2) * 100}%"></i>`).join('');
  setScreen(
    'screen-clubhub',
    `<div class="clubhub">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${t().back}</button>
        <div class="ch-title">${crestTag(club, 'crest-sm')}<span>${esc(club.name)}</span><small>${t().ovr} ${clubOverall()}</small></div>
        ${coinsPill()}
      </div>
      <div class="ch-grid">
        <button class="tile ch-t" data-go="squad"><div class="tile-art">${crestTag(club, 'crest-lg')}</div><div class="tile-label">${t().squad}</div><small>${profile.cards.length} ${L2('players', 'oyuncu')}</small></button>
        <button class="tile ch-t" data-go="formation"><div class="tile-art"><div class="ch-pitch">${dots}<i class="ch-dot r-GK" style="left:6%;top:50%"></i></div></div><div class="tile-label">${L2('Formation', 'Diziliş')}</div><small>7v7 ${f5.id}</small></button>
        <button class="tile ch-t ${gradReady ? 'has-badge' : ''}" data-go="facilities"><div class="tile-art"><span class="ch-emoji">🏟️</span></div><div class="tile-label">${L2('Facilities', 'Tesisler')}</div><small>${stadiumSeats(facLevel('stadium')).toLocaleString(settings.lang === 'tr' ? 'tr-TR' : 'en-US')} ${L2('seats', 'koltuk')} · ${L2('lv', 'sv')} ${facSum}/25</small>${gradReady ? `<div class="badge">🎓</div>` : ''}</button>
        <button class="tile ch-t" data-go="cabinet"><div class="tile-art">${paintTag(() => trophyCanvas('cup', club.primary), 'ch-trophy')}</div><div class="tile-label">${L2('Trophy Cabinet', 'Kupa Dolabı')}</div><small>${trophies} ${L2('trophies', 'kupa')}</small></button>
        <button class="tile ch-t" data-go="legends"><div class="tile-art">${best?.look ? paintTag(portraitSource(lookFor(club, best.look as CardLook, best.pos === 'GK')), 'ch-face') : '<span class="ch-emoji">⭐</span>'}</div><div class="tile-label">${L2('Legends & Records', 'Efsaneler & Rekorlar')}</div><small>${best ? esc(best.name) : L2('make history', 'tarih yaz')}</small></button>
        <button class="tile ch-t" data-go="player"><div class="tile-art">${me ? cardHTML(me, { club, size: 'sm' }) : '<div class="plus">+</div>'}</div><div class="tile-label">${me ? t().myPlayer : t().createPlayer}</div></button>
      </div>
    </div>`,
  );
  const back = () => showClubHub(h);
  bind('[data-act=back]', () => { audio.click(); showHub(h); });
  bind('[data-go]', (b) => {
    audio.click();
    const go = b.dataset.go;
    if (go === 'squad') showSquad(h);
    else if (go === 'formation') showFormations(h);
    else if (go === 'facilities') showFacilities(h, back);
    else if (go === 'cabinet') showHonours(h, back, 'cabinet');
    else if (go === 'legends') showHonours(h, back, 'legends');
    else if (go === 'player') showCreator(h, false);
  });
}
