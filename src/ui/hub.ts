/** Splash ("tap to start") and the main menu hub. */
import { t, LANGS } from '../engine/i18n';
import { settings, saveSettings, record } from '../engine/storage';
import { audio } from '../engine/audio';
import { profile, clubTeamDef, clubOverall, cardById, freeCrateReady } from '../meta/profile';
import { itemById, itemName } from '../meta/items';
import { itemIcon } from '../pixel/icons';
import { setScreen, bind, esc, paintTag, logoSource, flagTag, crestTag, coinsPill, crateTag, spriteSource, portraitSource, lookFor, MenuHandlers } from './common';
import { cardHTML } from './cards';
import { showSetup, showSettings, showHowTo } from './menus';
import { showClubEditor, showSquad } from './club';
import { showCreator } from './creator';
import { showShop } from './shop';
import { showCollection } from './collection';
import { showMarket } from './market';
import { market, tickMarket } from '../meta/market';
import { TEAMS } from '../game/teams';
import { league, positionOf, ROUNDS } from '../meta/league';
import { showLeague } from './league';

export function showSplash(h: MenuHandlers) {
  const L = t();
  setScreen(
    'screen-splash',
    `<div class="splash" data-act="go">
      <div class="logo">
        <div class="logo-top">${paintTag(logoSource('MAD', 4, '#fff6b8', '#ffb21f', '#7a2a08'))}</div>
        <div class="logo-bottom">${paintTag(logoSource('FOOTBALL', 3, '#ffffff', '#ff4a3a', '#5a0a10'))}</div>
        <div class="logo-tag">${esc(L.tagline)}</div>
      </div>
      <div class="tap-start">${L.tapToStart}</div>
    </div>
    <div class="version">v0.3</div>`,
  );
  bind('[data-act=go]', () => {
    h.firstTap();
    audio.select();
    if (!profile.club) showClubEditor(h, true);
    else showHub(h);
  });
}

export function showHub(h: MenuHandlers) {
  const L = t();
  const club = clubTeamDef();
  if (!club) return showClubEditor(h, true);
  const me = cardById(profile.myPlayer);
  tickMarket();
  const free = freeCrateReady() || profile.starterCrate;
  const fx = itemById(profile.equipped.goalfx);
  const kit = profile.loadout.map((id) => itemById(id)).filter((i): i is NonNullable<typeof i> => !!i);
  const lang = LANGS.find((l) => l.code === settings.lang)!;
  setScreen(
    'screen-hub',
    `<div class="hub">
      <div class="hub-top">
        <button class="club-chip" data-act="club">${crestTag(club, 'crest-md')}<div><b>${esc(club.name)}</b><small>${L.ovr} ${clubOverall()} • ${record.wins}${L.w} ${record.draws}${L.d} ${record.losses}${L.l}</small></div></button>
        <div class="hub-top-r">
          ${coinsPill()}
          <button class="icon-btn" data-act="lang">${flagTag(lang.flag)}</button>
          <button class="icon-btn" data-act="howto" aria-label="${L.howTo}">?</button>
          <button class="icon-btn gear" data-act="settings" aria-label="${L.settings}">⚙</button>
        </div>
      </div>
      <div class="hub-grid">
        <button class="tile tile-play" data-act="play">
          <div class="tile-art">${paintTag(spriteSource(lookFor(club, me?.look ?? { skin: '#e5b48f', hair: '#3b2416', hairStyle: 0, beard: false }), 'kick1'), 'tile-sprite')}${paintTag(spriteSource(lookFor(TEAMS[(club.name.length + 3) % TEAMS.length], { skin: '#7a4d30', hair: '#1a1310', hairStyle: 2, beard: true }), 'down0', true, false), 'tile-sprite2')}</div>
          <div class="tile-label big">${L.league}<span class="arr">▶</span></div>
          <small><span class="div-badge d${league.div}">${league.div}</span> ${esc(L.divNames[league.div])} • ${league.round > 0 ? positionOf() + '.' : '—'} • ${L.matchday} ${Math.min(league.round + 1, ROUNDS)}/${ROUNDS}</small>
        </button>
        <button class="tile" data-act="squad">
          <div class="tile-art">${crestTag(club, 'crest-lg')}</div>
          <div class="tile-label">${L.myClub}</div>
          <small>${L.squad} • ${profile.cards.length}</small>
        </button>
        <button class="tile" data-act="player">
          <div class="tile-art">${me ? cardHTML(me, { club, size: 'sm' }) : '<div class="plus">+</div>'}</div>
          <div class="tile-label">${me ? L.myPlayer : L.createPlayer}</div>
        </button>
        <button class="tile ${free ? 'has-badge' : ''}" data-act="shop">
          <div class="tile-art">${crateTag('premium', 'crate-md')}</div>
          <div class="tile-label">${L.crates}</div>
          ${free ? `<div class="badge">${L.free}!</div>` : ''}
        </button>
        <button class="tile" data-act="collection">
          <div class="tile-art col-art">${kit.map((it) => paintTag(() => itemIcon(it.id, it.type, it.color), 'kit-ic')).join('')}</div>
          <div class="tile-label">${L.inventory}</div>
          <small>${kit.length} ${L.items} • ${fx ? esc(itemName(fx)) : ''}</small>
        </button>
        <button class="tile tile-market" data-act="market">
          <div class="tile-art mk-art">${market.listings.slice(0, 3).map((l) => paintTag(portraitSource(lookFor(TEAMS[(l.card.name.length) % TEAMS.length], l.card.look, l.card.pos === 'GK')), 'mk-hub-face')).join('')}</div>
          <div><div class="tile-label">${L.transfers}</div><small>${L.transfersSub}</small></div>
          ${market.offers.length ? `<div class="badge">${market.offers.length}</div>` : ''}
        </button>
        <button class="tile tile-sm" data-act="quick"><div class="tile-label"><span class="bolt">⚡</span> ${L.quickMatch}</div></button>
      </div>
    </div>`,
  );
  bind('[data-act=play]', () => { audio.select(); showLeague(h); });
  bind('[data-act=quick]', () => { audio.select(); showSetup(h); });
  bind('[data-act=squad]', () => { audio.click(); showSquad(h); });
  bind('[data-act=club]', () => { audio.click(); showSquad(h); });
  bind('[data-act=player]', () => { audio.click(); showCreator(h, false); });
  bind('[data-act=shop]', () => { audio.click(); showShop(h); });
  bind('[data-act=collection]', () => { audio.click(); showCollection(h); });
  bind('[data-act=market]', () => { audio.select(); showMarket(h); });
  bind('[data-act=howto]', () => { audio.click(); showHowTo(() => showHub(h)); });
  bind('[data-act=settings]', () => { audio.click(); showSettings(h, () => showHub(h)); });
  bind('[data-act=lang]', () => {
    const i = LANGS.findIndex((l) => l.code === settings.lang);
    settings.lang = LANGS[(i + 1) % LANGS.length].code;
    saveSettings();
    audio.select();
    h.settingsChanged();
    showHub(h);
  });
}
