import { showControls } from './controls';
import { TEAMS, TeamDef, teamRating } from '../game/teams';
import { t, LANGS } from '../engine/i18n';
import { settings, saveSettings, record, lastSetup, saveSetup } from '../engine/storage';
import { audio } from '../engine/audio';
import type { Match } from '../game/match';
import type { Difficulty, Player } from '../game/entities';
import { DIFF_REWARD } from '../game/entities';
import { clubTeamDef, clubOverall } from '../meta/profile';
import { clamp } from '../engine/math';
import { ui, esc, bind, setScreen, paintTag, paintAll, crestTag, flagTag, spriteSource, lookFor, coinTag, MenuHandlers } from './common';
import { showHub } from './hub';
import { cardHTML } from './cards';
import type { CardData, Pos } from '../meta/cards';
import { vibrate } from '../engine/audio';
import { WEATHERS, PITCHES, STADIUMS, makeEnv, Weather, PitchStyle, Stadium } from '../game/env';
import { THEMES, GRASS } from '../game/stadium';
import type { Mission } from '../meta/missions';
import { missionLabel } from './missions';
import type { CupOutcome } from '../meta/cup';
import { trophyCanvas } from '../pixel/trophy';
import { watchAd, adsLeft } from '../meta/monetize';
import { addCoins } from '../meta/profile';
const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);

export type { MenuHandlers };

function stars(v: number) {
  const full = Math.round(v * 2) / 2;
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="star ${i <= full ? 'on' : i - 0.5 === full ? 'half' : ''}">■</span>`;
  return s;
}

const SKIN_P = ['#f1cfb0', '#c98d63', '#7a4d30', '#e5b48f'];
const HAIR_P = ['#1a1310', '#c98a3a', '#3b2416', '#b02a1a'];

/** Home-side choices: -1 = the user's own club, 0.. = built-in teams. */
export function homeDef(idx: number): TeamDef {
  return idx < 0 ? clubTeamDef() ?? TEAMS[0] : TEAMS[idx];
}

// ------------------------------------------------------------------ match setup (step 1: teams)

export function showSetup(h: MenuHandlers) {
  const L = t();
  if (lastSetup.home >= 0 && clubTeamDef() && lastSetup.home === lastSetup.away) lastSetup.home = -1;
  const render = () => {
    const home = homeDef(lastSetup.home), away = TEAMS[lastSetup.away];
    const isClub = lastSetup.home < 0;
    const rating = isClub ? Math.min(5, Math.max(1, (clubOverall() - 40) / 11)) : teamRating(home);
    const card = (team: TeamDef, side: 'home' | 'away', label: string, r: number, seed: number) => `
      <div class="team-card" style="--c1:${team.primary};--c2:${team.secondary}">
        <div class="team-label">${label}</div>
        <div class="team-main">
          <button class="nav" data-nav="${side}" data-dir="-1">‹</button>
          ${paintTag(spriteSource(lookFor(team, { skin: SKIN_P[seed % 4], hair: HAIR_P[seed % 4], hairStyle: seed % 7, beard: seed % 3 === 0 }), 'idle0', seed % 2 === 1), 'kit')}
          <button class="nav" data-nav="${side}" data-dir="1">›</button>
        </div>
        <div class="team-name">${crestTag(team, 'crest-sm')}${esc(team.name)}</div>
        <div class="stars">${stars(r)}</div>
        <div class="stats">
          ${statBar(L.pace, team.pace)}${statBar(L.power, team.power)}${statBar(L.tackle, team.tackle)}${statBar(L.skill, team.skill)}
        </div>
      </div>`;
    setScreen(
      'screen-setup',
      `<div class="setup-wrap">
        <div class="setup-head">
          <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
          <div class="setup-title">${L.quickMatch}</div>
          <div style="width:80px"></div>
        </div>
        <div class="teams-row">
          ${card(home, 'home', isClub ? L.myClubOpt.toUpperCase() : L.yourTeam, rating, lastSetup.home + 3)}
          <div class="vs">VS</div>
          ${card(away, 'away', L.opponent, teamRating(away), lastSetup.away + 2)}
        </div>
        <div class="options">
          <div class="opt">
            <div class="opt-label">${L.teamSize}</div>
            <div class="seg">${[3, 4, 5].map((n) => `<button class="${lastSetup.size === n ? 'on' : ''}" data-size="${n}">${n}v${n}</button>`).join('')}</div>
          </div>
          <div class="opt">
            <div class="opt-label">${L.duration}</div>
            <div class="seg">${[120, 180, 300].map((d) => `<button class="${lastSetup.duration === d ? 'on' : ''}" data-dur="${d}">${d / 60} ${L.min}</button>`).join('')}</div>
          </div>
          <button class="btn btn-primary btn-start" data-act="next">${L.next} ▶</button>
        </div>
      </div>`,
    );
    bind('[data-act=back]', () => { audio.click(); showHub(h); });
    bind('[data-nav]', (el) => {
      audio.click();
      const side = el.dataset.nav as 'home' | 'away';
      const dir = Number(el.dataset.dir);
      if (side === 'home') {
        // -1 (my club) .. TEAMS.length-1, skipping the opponent
        const min = clubTeamDef() ? -1 : 0;
        let v = lastSetup.home;
        do {
          v += dir;
          if (v >= TEAMS.length) v = min;
          if (v < min) v = TEAMS.length - 1;
        } while (v === lastSetup.away);
        lastSetup.home = v;
      } else {
        let v = lastSetup.away;
        do v = (v + dir + TEAMS.length) % TEAMS.length;
        while (v === lastSetup.home);
        lastSetup.away = v;
      }
      saveSetup();
      render();
    });
    bind('[data-size]', (el) => { audio.click(); lastSetup.size = Number(el.dataset.size); saveSetup(); render(); });
    bind('[data-dur]', (el) => { audio.click(); lastSetup.duration = Number(el.dataset.dur); saveSetup(); render(); });
    bind('[data-act=next]', () => { audio.select(); showDifficulty(h); });
  };
  render();
}

// ------------------------------------------------------------------ match setup (step 2: difficulty)

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'insane', 'legend'];
const DIFF_COL: Record<Difficulty, string> = { easy: '#2fb45a', normal: '#2f7bff', hard: '#e8701a', insane: '#e8322b', legend: '#b04cff' };

export function showDifficulty(h: MenuHandlers) {
  const L = t();
  const home = homeDef(lastSetup.home), away = TEAMS[lastSetup.away];
  setScreen(
    'screen-setup',
    `<div class="setup-wrap">
      <div class="setup-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="setup-title">${L.difficulty}</div>
        <div class="vs-mini">${crestTag(home, 'crest-sm')}<span>${esc(home.short)}</span><b>VS</b><span>${esc(away.short)}</span>${crestTag(away, 'crest-sm')}</div>
      </div>
      <div class="diff-row">
        ${DIFFS.map((d, i) => `
          <button class="diff-card ${lastSetup.difficulty === d ? 'on' : ''}" data-diff="${d}" style="--dc:${DIFF_COL[d]}">
            <div class="diff-skulls">${'■'.repeat(i + 1)}</div>
            <div class="diff-name">${(L as unknown as Record<string, string>)[d]}</div>
            <div class="diff-desc">${esc(L.diffDesc[d])}</div>
            <div class="diff-rew">${L.rewards} ×${DIFF_REWARD[d]}</div>
          </button>`).join('')}
      </div>
      <div class="options">
        <button class="btn btn-primary btn-start" data-act="next">${L.next} ▶</button>
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showSetup(h); });
  bind('[data-diff]', (el) => {
    lastSetup.difficulty = el.dataset.diff!;
    saveSetup();
    audio.click();
    showDifficulty(h);
  });
  bind('[data-act=next]', () => { audio.select(); showVenue(h); });
}

// ------------------------------------------------------------------ match setup (step 3: venue & weather)

const WEATHER_ICON: Record<string, string> = { clear: '☀️', night: '🌙', rain: '🌧️', storm: '⛈️', snow: '❄️', fog: '☁️', wind: '💨', random: '🎲' };

const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

function pitchSwatch(p: PitchStyle): string {
  const g = GRASS[p];
  const a = rgb(g[3]), b = rgb(g[4]);
  switch (p) {
    case 'checker': return `background: conic-gradient(${a} 25%, ${b} 0 50%, ${a} 0 75%, ${b} 0) 0 0 / 12px 12px`;
    case 'diagonal': return `background: repeating-linear-gradient(45deg, ${a} 0 5px, ${b} 5px 10px)`;
    case 'rings': return `background: repeating-radial-gradient(circle at 50% 50%, ${a} 0 5px, ${b} 5px 10px)`;
    case 'astro': return `background: repeating-linear-gradient(90deg, ${a} 0 3px, ${b} 3px 6px)`;
    case 'dry': return `background: repeating-linear-gradient(90deg, ${a} 0 9px, ${b} 9px 18px)`;
    default: return `background: repeating-linear-gradient(90deg, ${a} 0 6px, ${b} 6px 12px)`;
  }
}

function stadiumSwatch(s: Stadium): string {
  const T = THEMES[s];
  return `background: linear-gradient(180deg, ${T.roof} 0 22%, ${T.roofEdge} 22% 28%, ${T.seat} 28% 46%, ${T.step} 46% 50%, ${T.seat} 50% 68%, ${T.step} 68% 72%, ${T.board} 72% 80%, ${rgb(GRASS.stripes[4])} 80%)`;
}

export function showVenue(h: MenuHandlers) {
  const L = t();
  const home = homeDef(lastSetup.home), away = TEAMS[lastSetup.away];
  const preview = () => {
    // concrete choice → show it behind the menu; random → keep a default look
    const w = (lastSetup.weather === 'random' ? 'clear' : lastSetup.weather) as Weather;
    const p = (lastSetup.pitch === 'random' ? 'stripes' : lastSetup.pitch) as PitchStyle;
    const st = (lastSetup.stadium === 'random' ? 'arena' : lastSetup.stadium) as Stadium;
    h.previewEnv(makeEnv(w, p, st));
  };
  const chip = (key: string, id: string, label: string, swatch: string, icon = '') => `
    <button class="venue-chip ${(lastSetup as unknown as Record<string, string>)[key] === id ? 'on' : ''}" data-venue="${key}" data-id="${id}">
      <i class="sw" style="${swatch}">${icon}</i><span>${esc(label)}</span>
    </button>`;
  const rnd = (key: string) => chip(key, 'random', L.random, 'background:#26304a', '?');
  setScreen(
    'screen-venue',
    `<div class="setup-wrap venue-wrap">
      <div class="setup-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="setup-title">${L.venue}</div>
        <div class="vs-mini">${crestTag(home, 'crest-sm')}<span>${esc(home.short)}</span><b>VS</b><span>${esc(away.short)}</span>${crestTag(away, 'crest-sm')}</div>
      </div>
      <div class="venue-body">
        <div class="venue-group">
          <div class="opt-label">${L.stadium}</div>
          <div class="venue-chips">${STADIUMS.map((x) => chip('stadium', x, L.stadiumNames[x], stadiumSwatch(x))).join('')}${rnd('stadium')}</div>
        </div>
        <div class="venue-group">
          <div class="opt-label">${L.pitchStyle}</div>
          <div class="venue-chips">${PITCHES.map((x) => chip('pitch', x, L.pitchNames[x], pitchSwatch(x))).join('')}${rnd('pitch')}</div>
        </div>
        <div class="venue-group">
          <div class="opt-label">${L.weather}</div>
          <div class="venue-chips">${[...WEATHERS, 'random'].map((x) => chip('weather', x, x === 'random' ? L.random : L.weatherNames[x], 'background:#1b2236', WEATHER_ICON[x])).join('')}</div>
          <div class="venue-desc">${WEATHER_ICON[lastSetup.weather] ?? ''} ${esc(L.weatherDesc[lastSetup.weather] ?? '')}</div>
        </div>
      </div>
      <div class="options">
        <button class="btn btn-primary btn-start" data-act="start">${L.start} ▶</button>
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showDifficulty(h); });
  bind('[data-venue]', (el) => {
    (lastSetup as unknown as Record<string, string>)[el.dataset.venue!] = el.dataset.id!;
    saveSetup();
    audio.click();
    showVenue(h);
  });
  bind('[data-act=start]', () => { audio.select(); h.startMatch(); });
  preview();
}

function statBar(label: string, v: number) {
  return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${v * 20}%"></i></div></div>`;
}

// ------------------------------------------------------------------ settings

export function showSettings(h: MenuHandlers, back: () => void, inGame = false) {
  const L = t();
  const toggle = (key: keyof typeof settings, label: string) =>
    `<div class="set-row"><span>${label}</span><button class="toggle ${settings[key] ? 'on' : ''}" data-toggle="${key}"><i></i></button></div>`;
  const seg = (label: string, key: string, opts: [string | number, string][], cur: string | number) =>
    `<div class="set-row"><span>${label}</span><div class="seg small">${opts
      .map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-seg="${key}" data-val="${v}">${l}</button>`)
      .join('')}</div></div>`;
  setScreen(
    'screen-settings' + (inGame ? ' in-game' : ''),
    `<div class="panel">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="panel-title">${L.settings}</div>
        <div style="width:80px"></div>
      </div>
      <div class="panel-body cols">
        <div>
          ${toggle('sound', L.sound)}
          <div class="set-row"><span>${L.volume}</span><input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-range="volume" id="set-volume"></div>
          ${toggle('vibration', L.vibration)}
          ${toggle('autoSwitch', L.autoSwitch)}
          ${toggle('leftHanded', L.leftHanded)}
          ${seg(L.joystick, 'joy', [['float', L.joyFloat], ['fixed', L.joyFixed]], settings.joyFixed ? 'fixed' : 'float')}
          ${toggle('passAssist', L.passAssist)}
          ${toggle('aimLine', L.aimLine)}

        <div>
          ${toggle('minimap', L.minimap)}
          ${seg(L.zoom, 'zoom', [[1.18, L.near], [1, L.mid], [0.84, L.far]], settings.zoom)}
          ${seg(L.quality, 'quality', [['high', L.high], ['low', L.low]], settings.quality)}
          ${seg(L.btnSize, 'btnScale', [[0.8, L.sizeS], [1, L.sizeM], [1.2, L.sizeL], [1.4, L.sizeXL]], settings.btnScale ?? 1)}
          <div class="set-row"><span>${L.controlsLayout}${settings.ctrl ? ` <small class="ctl-custom">${L.custom}</small>` : ''}</span><button class="btn btn-ghost btn-sm" data-act="controls">${L.edit} ▶</button></div>
          ${lastErrorHTML()}
          <div class="set-row lang-row"><span>${L.language}</span><div class="langs">${LANGS.map((l) => `<button class="lang-btn ${settings.lang === l.code ? 'on' : ''}" data-lang="${l.code}">${flagTag(l.flag)}<span>${l.name}</span></button>`).join('')}</div></div>
        </div>
      </div>
    </div>`,
  );
  const again = () => showSettings(h, back, inGame);
  bind('[data-act=back]', () => { audio.click(); back(); });
  bind('[data-act=controls]', () => { audio.click(); showControls(h, again); });
  // update the control in place (instant feedback) instead of rebuilding the screen
  bind('[data-toggle]', (el) => {
    const k = el.dataset.toggle as 'sound' | 'vibration' | 'autoSwitch' | 'leftHanded' | 'minimap' | 'passAssist' | 'aimLine';
    settings[k] = !settings[k];
    el.classList.toggle('on', settings[k]);
    audio.applyVolume();
    audio.click();
    saveSettings();
    h.settingsChanged(k);
  });
  bind('[data-seg]', (el) => {
    const k = el.dataset.seg!;
    const v = el.dataset.val!;
    if (k === 'zoom') settings.zoom = Number(v);
    if (k === 'quality') settings.quality = v as 'high' | 'low';
    if (k === 'joy') settings.joyFixed = v === 'fixed';
    if (k === 'btnScale') settings.btnScale = Number(v);
    el.parentElement?.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
    audio.click();
    saveSettings();
    h.settingsChanged(k);
  });
  bind('[data-lang]', (el) => {
    settings.lang = el.dataset.lang as typeof settings.lang;
    saveSettings();
    audio.select();
    h.settingsChanged('lang');
    again();
  });
  ui().querySelector<HTMLInputElement>('[data-range=volume]')?.addEventListener('input', (e) => {
    settings.volume = Number((e.target as HTMLInputElement).value);
    saveSettings();
    audio.applyVolume();
  });
}

function lastErrorHTML() {
  try {
    const raw = localStorage.getItem('mf.lastError');
    if (!raw) return '';
    const e = JSON.parse(raw) as { at: string; where: string; msg: string; v: string };
    return `<div class="set-row err-row"><span>${t().lastError}</span><small>${esc(e.at.replace('T', ' ').slice(0, 19))} · ${esc(e.where)} · ${esc(e.v)}<br>${esc(e.msg).replace(/\n/g, '<br>')}</small></div>`;
  } catch {
    return '';
  }
}

// ------------------------------------------------------------------ how to

export function showHowTo(back: () => void) {
  const L = t();
  setScreen(
    'screen-howto',
    `<div class="panel">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="panel-title">${L.howTo}</div>
        <div style="width:80px"></div>
      </div>
      <div class="panel-body howto-grid">
        ${L.howToItems.map(([i, title, d]) => `<div class="howto-item"><div class="hi-icon">${i}</div><div><b>${esc(title)}</b><p>${esc(d)}</p></div></div>`).join('')}
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); back(); });
}

// ------------------------------------------------------------------ pause

export function showPause(h: MenuHandlers, m: Match) {
  const L = t();
  const [a, b] = m.teams;
  setScreen(
    'screen-pause',
    `<div class="pause-box">
      <div class="panel-title">${L.paused}</div>
      <div class="mini-score">${crestTag(a.def, 'crest-sm')}<span style="color:${a.def.primary}">${esc(a.def.short)}</span> ${a.score} - ${b.score} <span style="color:${b.def.primary}">${esc(b.def.short)}</span>${crestTag(b.def, 'crest-sm')}</div>
      <button class="btn btn-primary" data-act="resume">${L.resume}</button>
      <button class="btn btn-ghost" data-act="settings">${L.settings}</button>
      <button class="btn btn-ghost" data-act="howto">${L.howTo}</button>
      <button class="btn btn-ghost" data-act="restart">${L.restart}</button>
      <button class="btn btn-danger" data-act="quit">${L.quit}</button>
    </div>`,
  );
  bind('[data-act=resume]', () => h.resume());
  bind('[data-act=restart]', () => h.restart());
  bind('[data-act=quit]', () => h.quit());
  bind('[data-act=settings]', () => showSettings(h, () => showPause(h, m), true));
  bind('[data-act=howto]', () => showHowTo(() => showPause(h, m)));
}

export function hideUI() {
  ui().className = 'hidden';
  ui().innerHTML = '';
}

// ------------------------------------------------------------------ results

export function mvpOf(m: Match): Player {
  let best = m.all[0];
  let bs = -1;
  for (const p of m.all) {
    const s = p.goals * 4 + p.assists * 2 + p.knockdowns * 0.8 + p.steals * 0.6 + p.saves * 1.5 + p.shots * 0.2 + (p.team.score > p.team.opp.score ? 1 : 0);
    if (s > bs) {
      bs = s;
      best = p;
    }
  }
  return best;
}

/** The player's card, or one made up from his match attributes (rivals have no card). */
function cardOf(p: Player): CardData {
  if (p.card) return p.card;
  const pos: Pos = p.isGK ? 'GK' : (p.role as Pos);
  const v = (x: number) => Math.round(clamp(45 + x * 45, 30, 95));
  return {
    id: 'motm', name: p.name, number: p.number, pos,
    stats: { pac: v(p.pace), sho: v(p.power), pas: v(p.skill), dri: v(p.skill * 0.6 + p.pace * 0.4), def: v(p.tackle), phy: v(p.power * 0.5 + p.tackle * 0.5) },
    look: { skin: p.skin, hair: p.hair, hairStyle: p.hairStyle, beard: p.beard, face: p.faceShape, eyes: p.eyes, eyeColor: p.eyeColor },
  };
}

export function showResults(h: MenuHandlers, m: Match, coins: number, leagueMode: false | 'league' | 'cup' = false, done: Mission[] = [], cupOut: CupOutcome | null = null) {
  const L = t();
  // rewarded ad: double the match coins (a small floor so a loss still pays something)
  const adBonus = m.cfg.training ? 0 : Math.max(coins, 100);
  const [a, b] = m.teams;
  // cup ties are decided on penalties
  const res = cupOut?.pens ? (cupOut.won ? 'win' : 'loss') : a.score > b.score ? 'win' : a.score < b.score ? 'loss' : 'draw';
  const total = a.stats.possession + b.stats.possession || 1;
  const pa = Math.round((a.stats.possession / total) * 100);
  const rows: [string, number | string, number | string][] = [
    [L.possession, pa + '%', 100 - pa + '%'],
    [L.shots, a.stats.shots, b.stats.shots],
    [L.knockdowns, a.stats.knockdowns, b.stats.knockdowns],
    [L.tackles, a.stats.tackles, b.stats.tackles],
    [L.passes, a.stats.passes, b.stats.passes],
    [L.saves, a.stats.saves, b.stats.saves],
  ];
  const mvp = mvpOf(m);
  const scorers = (tm: typeof a) =>
    tm.players
      .filter((p) => p.goals > 0)
      .map((p) => `${esc(p.name)}${p.goals > 1 ? ' ×' + p.goals : ''}`)
      .join(', ') || '&nbsp;';
  ui().className = 'screen-results';
  ui().innerHTML = `
    <div class="results">
      <div class="res-title ${res}">${res === 'win' ? L.win : res === 'loss' ? L.loss : L.draw}</div>
      ${cupOut ? `<div class="res-cup ${cupOut.won ? 'up' : 'out'}">🏆 ${cupOut.pens ? `${L2('Penalties', 'Penaltılar')} ${cupOut.pens[0]}-${cupOut.pens[1]} · ` : ''}${cupOut.champion ? L2('CUP WINNERS!', 'KUPA ŞAMPİYONU!') : cupOut.won ? L2('Through to the next round', 'Bir sonraki tura yükseldin') : L2('Knocked out of the cup', 'Kupadan elendin')}${cupOut.coins ? ` · +${cupOut.coins} ${coinTag()}` : ''}</div>` : ''}
      <div class="res-score">
        <div class="res-team" style="--c:${a.def.primary}">${crestTag(a.def, 'crest-sm')}${esc(a.def.name)}<small>${scorers(a)}</small></div>
        <div class="res-num">${a.score}<span>-</span>${b.score}</div>
        <div class="res-team right" style="--c:${b.def.primary}">${crestTag(b.def, 'crest-sm')}${esc(b.def.name)}<small>${scorers(b)}</small></div>
      </div>
      <div class="res-body">
        <div class="res-stats">
          ${rows.map(([l, x, y]) => `<div class="rs-row"><b>${x}</b><span>${l}</span><b>${y}</b></div>`).join('')}
        </div>
        <div class="res-side">
          <div class="mvp motm" style="--c:${mvp.team.def.primary}">
            <div class="motm-stage"><div class="motm-rays"></div>${cardHTML(cardOf(mvp), { club: mvp.team.def, size: 'md' })}<div class="stamp motm-stamp">⭐ ${L.mvp}</div></div>
            <div class="motm-info"><div class="mvp-name">${esc(mvp.name)} <small>#${mvp.number}</small></div>
            <div class="mvp-line"><span>⚽ <b data-count="${mvp.goals}">0</b></span><span>🎯 <b data-count="${mvp.assists}">0</b></span><span>💥 <b data-count="${mvp.knockdowns}">0</b></span>${mvp.isGK ? `<span>🧤 <b data-count="${mvp.saves}">0</b></span>` : ''}</div></div>
          </div>
          <div class="res-pay"><div class="coins" id="res-coins">+${coins} ${coinTag()}</div>
          ${adBonus > 0 && adsLeft('match_bonus') > 0 ? `<button class="ad-cta" data-act="adx2"><span class="ad-cta-tv"><i></i><b>▶</b></span><span class="ad-cta-t"><small>${L2('WATCH AN AD', 'REKLAM İZLE')}</small><b>+${adBonus} ${coinTag('ad-cta-coin')} <em>×2</em></b></span><span class="ad-cta-shine"></span></button>` : ''}</div>
          ${done.map((d) => `<div class="res-mission">🎯 ${esc(L.missionDone)}: ${esc(missionLabel(d))}</div>`).join('')}
        </div>
      </div>
      <div class="row">
        <button class="btn btn-ghost" data-act="quit">${L.menu}</button>
        ${leagueMode === 'cup' ? `<button class="btn btn-primary" data-act="cup">${L.continueBtn} ▶</button>` : leagueMode ? `<button class="btn btn-primary" data-act="league">${L.continueBtn} ▶</button>` : `<button class="btn btn-primary" data-act="restart">${L.rematch} ▶</button>`}
      </div>
    </div>`;
  paintAll();
  // man of the match: the card spins in, the stamp lands, the numbers count up
  setTimeout(() => { audio.whoosh(); }, 450);
  setTimeout(() => { audio.horn(); vibrate(40); }, 1350);
  setTimeout(() => {
    ui().querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
      const n = Number(el.dataset.count);
      for (let i = 1; i <= n; i++) setTimeout(() => { el.textContent = String(i); audio.click(); }, i * 160);
    });
  }, 1700);
  bind('[data-act=adx2]', async (btn) => {
    if (btn.classList.contains('done')) return;
    audio.click();
    if (!(await watchAd('match_bonus'))) return;
    addCoins(adBonus);
    audio.horn();
    audio.cheer(0.5);
    vibrate([40, 30, 80]);
    btn.classList.add('done');
    btn.innerHTML = `<span class="ad-cta-t"><small>${L2('BONUS COLLECTED', 'BONUS ALINDI')}</small><b>✓ +${adBonus} ${coinTag('ad-cta-coin')}</b></span>`;
    paintAll(btn);
    const c = document.getElementById('res-coins');
    if (c) { c.innerHTML = `+${coins + adBonus} ${coinTag()}`; paintAll(c); c.classList.add('bump'); }
  });
  bind('[data-act=quit]', () => h.quit());
  bind('[data-act=restart]', () => h.restart());
  bind('[data-act=league]', () => h.showLeague());
  bind('[data-act=cup]', () => h.showCup());
  // cup winners: the trophy and the special card
  if (cupOut?.champion && cupOut.card) {
    const card = cupOut.card;
    setTimeout(() => {
      if (!ui().classList.contains('screen-results')) return;
      const pop = document.createElement('div');
      pop.className = 'cup-win';
      pop.innerHTML = `<div class="cup-win-in"><div class="cup-win-rays"></div>${paintTag(() => trophyCanvas('cup', m.teams[0].def.primary), 'cup-win-trophy')}<b>${L2('CUP WINNERS!', 'KUPA ŞAMPİYONU!')}</b>${cardHTML(card, { club: m.teams[0].def, size: 'lg', badge: L2('REWARD', 'ÖDÜL') })}<button class="btn btn-primary" data-act="cw-ok">${L2('LIFT IT!', 'KALDIR!')} 🏆</button></div>`;
      ui().appendChild(pop);
      paintAll(pop);
      audio.horn();
      audio.cheer(1);
      vibrate([60, 40, 120]);
      pop.querySelector('[data-act=cw-ok]')!.addEventListener('click', (e) => { e.stopPropagation(); audio.click(); pop.remove(); });
    }, 1900);
  }
  void record;
}
