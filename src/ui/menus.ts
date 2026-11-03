import { TEAMS, TeamDef, teamRating } from '../game/teams';
import { t, LANGS } from '../engine/i18n';
import { settings, saveSettings, record, lastSetup, saveSetup } from '../engine/storage';
import { audio } from '../engine/audio';
import type { Match } from '../game/match';
import type { Difficulty, Player } from '../game/entities';
import { DIFF_REWARD } from '../game/entities';
import { clubTeamDef, clubOverall } from '../meta/profile';
import { ui, esc, bind, setScreen, paintTag, paintAll, crestTag, flagTag, spriteSource, lookFor, coinTag, MenuHandlers } from './common';
import { showHub } from './hub';

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
        <button class="btn btn-primary btn-start" data-act="start">${L.start} ▶</button>
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
  bind('[data-act=start]', () => { audio.select(); h.startMatch(); });
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
        </div>
        <div>
          ${toggle('minimap', L.minimap)}
          ${seg(L.zoom, 'zoom', [[1.18, L.near], [1, L.mid], [0.84, L.far]], settings.zoom)}
          ${seg(L.quality, 'quality', [['high', L.high], ['low', L.low]], settings.quality)}
          <div class="set-row lang-row"><span>${L.language}</span><div class="langs">${LANGS.map((l) => `<button class="lang-btn ${settings.lang === l.code ? 'on' : ''}" data-lang="${l.code}">${flagTag(l.flag)}<span>${l.name}</span></button>`).join('')}</div></div>
        </div>
      </div>
    </div>`,
  );
  const again = () => showSettings(h, back, inGame);
  bind('[data-act=back]', () => { audio.click(); back(); });
  bind('[data-toggle]', (el) => {
    const k = el.dataset.toggle as 'sound' | 'vibration' | 'autoSwitch' | 'leftHanded' | 'minimap';
    settings[k] = !settings[k];
    saveSettings();
    audio.applyVolume();
    audio.click();
    h.settingsChanged();
    again();
  });
  bind('[data-seg]', (el) => {
    const k = el.dataset.seg!;
    const v = el.dataset.val!;
    if (k === 'zoom') settings.zoom = Number(v);
    if (k === 'quality') settings.quality = v as 'high' | 'low';
    if (k === 'joy') settings.joyFixed = v === 'fixed';
    saveSettings();
    audio.click();
    h.settingsChanged();
    again();
  });
  bind('[data-lang]', (el) => {
    settings.lang = el.dataset.lang as typeof settings.lang;
    saveSettings();
    audio.select();
    h.settingsChanged();
    again();
  });
  ui().querySelector<HTMLInputElement>('[data-range=volume]')?.addEventListener('input', (e) => {
    settings.volume = Number((e.target as HTMLInputElement).value);
    saveSettings();
    audio.applyVolume();
  });
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

export function showResults(h: MenuHandlers, m: Match, coins: number) {
  const L = t();
  const [a, b] = m.teams;
  const res = a.score > b.score ? 'win' : a.score < b.score ? 'loss' : 'draw';
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
          <div class="mvp" style="--c:${mvp.team.def.primary}">
            <div class="mvp-label">⭐ ${L.mvp}</div>
            ${paintTag(spriteSource(lookFor(mvp.team.def, mvp, mvp.isGK), 'cel0'), 'mvp-kit')}
            <div class="mvp-name">${esc(mvp.name)} <small>#${mvp.number}</small></div>
            <div class="mvp-line">⚽ ${mvp.goals} · 💥 ${mvp.knockdowns} · 🧤 ${mvp.saves}</div>
          </div>
          <div class="coins">+${coins} ${coinTag()}</div>
        </div>
      </div>
      <div class="row">
        <button class="btn btn-ghost" data-act="quit">${L.menu}</button>
        <button class="btn btn-primary" data-act="restart">${L.rematch} ▶</button>
      </div>
    </div>`;
  paintAll();
  bind('[data-act=quit]', () => h.quit());
  bind('[data-act=restart]', () => h.restart());
  void record;
}
