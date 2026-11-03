import { TEAMS, TeamDef, teamRating } from '../game/teams';
import { drawFootballer } from '../game/sprites';
import { t } from '../engine/i18n';
import { settings, saveSettings, record, lastSetup, saveSetup } from '../engine/storage';
import { audio } from '../engine/audio';
import type { Match } from '../game/match';
import type { Difficulty, Player } from '../game/entities';

export interface MenuHandlers {
  startMatch: () => void;
  resume: () => void;
  restart: () => void;
  quit: () => void;
  settingsChanged: () => void;
}

const ui = () => document.getElementById('ui')!;

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function bind(sel: string, fn: (el: HTMLElement) => void) {
  ui().querySelectorAll<HTMLElement>(sel).forEach((el) =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.unlock();
      fn(el);
    }),
  );
}

function stars(v: number) {
  const full = Math.round(v * 2) / 2;
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="star ${i <= full ? 'on' : i - 0.5 === full ? 'half' : ''}">★</span>`;
  return s;
}

function kitPreview(canvas: HTMLCanvasElement, team: TeamDef, seed: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 90, h = canvas.clientHeight || 110;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  g.clearRect(0, 0, w, h);
  const k = h / 2.75;
  // glow floor
  const fg = g.createRadialGradient(w / 2, h - 8, 2, w / 2, h - 8, w * 0.45);
  fg.addColorStop(0, team.primary + 'aa');
  fg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(w / 2, h - 8, k * 0.5, k * 0.15, 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.translate(w / 2, h - 8);
  drawFootballer(
    g,
    { kit: team, isGK: false, skin: ['#f1cfb0', '#c98d63', '#7a4d30', '#e5b48f'][seed % 4], hair: ['#1a1310', '#c98a3a', '#3b2416', '#b02a1a'][seed % 4], hairStyle: seed % 7, beard: seed % 3 === 0, number: 10, build: 1 },
    { runPhase: 0, speed: 0, facingLeft: seed % 2 === 1, state: 'run', stateT: 0, stateDur: 0, kickAnim: 0, charge: 0, hasBallGK: false, diveUp: 0, spinT: 0 },
    k / 1.18,
  );
  g.restore();
}

// ------------------------------------------------------------------ title

export function showTitle(h: MenuHandlers) {
  const L = t();
  const r = record;
  ui().className = 'screen-title';
  ui().innerHTML = `
    <div class="title-wrap">
      <div class="logo">
        <div class="logo-top">MAD</div>
        <div class="logo-bottom">FOOTBALL</div>
        <div class="logo-tag">${esc(L.tagline)}</div>
      </div>
      <div class="menu-col">
        <button class="btn btn-primary btn-xl" data-act="play">${L.play} <span class="arrow">▶</span></button>
        <div class="row">
          <button class="btn btn-ghost" data-act="howto">${L.howTo}</button>
          <button class="btn btn-ghost" data-act="settings">${L.settings}</button>
        </div>
        <div class="career">
          <span class="career-title">${L.record}</span>
          <span class="pill win">${r.wins}${L.w}</span>
          <span class="pill draw">${r.draws}${L.d}</span>
          <span class="pill loss">${r.losses}${L.l}</span>
          <span class="pill coin">🪙 ${r.coins}</span>
        </div>
      </div>
    </div>
    <div class="version">v0.1 • ${esc(L.hint)}</div>
  `;
  bind('[data-act=play]', () => {
    audio.select();
    showSetup(h);
  });
  bind('[data-act=howto]', () => {
    audio.click();
    showHowTo(() => showTitle(h));
  });
  bind('[data-act=settings]', () => {
    audio.click();
    showSettings(h, () => showTitle(h));
  });
}

// ------------------------------------------------------------------ setup

export function showSetup(h: MenuHandlers) {
  const L = t();
  ui().className = 'screen-setup';
  const diffs: Difficulty[] = ['easy', 'normal', 'hard', 'insane'];
  const render = () => {
    const home = TEAMS[lastSetup.home], away = TEAMS[lastSetup.away];
    const card = (team: TeamDef, side: 'home' | 'away', label: string) => `
      <div class="team-card" style="--c1:${team.primary};--c2:${team.secondary}">
        <div class="team-label">${label}</div>
        <div class="team-main">
          <button class="nav" data-nav="${side}" data-dir="-1">‹</button>
          <canvas class="kit" data-kit="${side}"></canvas>
          <button class="nav" data-nav="${side}" data-dir="1">›</button>
        </div>
        <div class="team-name"><span class="crest">${team.crest}</span>${esc(team.name)}</div>
        <div class="stars">${stars(teamRating(team))}</div>
        <div class="stats">
          ${statBar(L.pace, team.pace)}${statBar(L.power, team.power)}${statBar(L.tackle, team.tackle)}${statBar(L.skill, team.skill)}
        </div>
      </div>`;
    ui().innerHTML = `
      <div class="setup-wrap">
        <div class="setup-head">
          <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
          <div class="setup-title">${L.quickMatch}</div>
          <div style="width:80px"></div>
        </div>
        <div class="teams-row">
          ${card(home, 'home', L.yourTeam)}
          <div class="vs">VS</div>
          ${card(away, 'away', L.opponent)}
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
          <div class="opt">
            <div class="opt-label">${L.difficulty}</div>
            <div class="seg">${diffs.map((d) => `<button class="${lastSetup.difficulty === d ? 'on' : ''} d-${d}" data-diff="${d}">${L[d]}</button>`).join('')}</div>
          </div>
          <button class="btn btn-primary btn-start" data-act="start">${L.start} ▶</button>
        </div>
      </div>`;
    ui().querySelectorAll<HTMLCanvasElement>('canvas[data-kit]').forEach((c) => {
      const side = c.dataset.kit as 'home' | 'away';
      kitPreview(c, side === 'home' ? home : away, side === 'home' ? lastSetup.home + 1 : lastSetup.away + 2);
    });
    bind('[data-act=back]', () => {
      audio.click();
      showTitle(h);
    });
    bind('[data-nav]', (el) => {
      audio.click();
      const side = el.dataset.nav as 'home' | 'away';
      const dir = Number(el.dataset.dir);
      const other = side === 'home' ? lastSetup.away : lastSetup.home;
      let v = side === 'home' ? lastSetup.home : lastSetup.away;
      do v = (v + dir + TEAMS.length) % TEAMS.length;
      while (v === other);
      if (side === 'home') lastSetup.home = v;
      else lastSetup.away = v;
      saveSetup();
      render();
    });
    bind('[data-size]', (el) => {
      audio.click();
      lastSetup.size = Number(el.dataset.size);
      saveSetup();
      render();
    });
    bind('[data-dur]', (el) => {
      audio.click();
      lastSetup.duration = Number(el.dataset.dur);
      saveSetup();
      render();
    });
    bind('[data-diff]', (el) => {
      audio.click();
      lastSetup.difficulty = el.dataset.diff!;
      saveSetup();
      render();
    });
    bind('[data-act=start]', () => {
      audio.select();
      h.startMatch();
    });
  };
  render();
}

function statBar(label: string, v: number) {
  return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${v * 20}%"></i></div></div>`;
}

// ------------------------------------------------------------------ settings

export function showSettings(h: MenuHandlers, back: () => void, inGame = false) {
  const L = t();
  ui().className = 'screen-settings' + (inGame ? ' in-game' : '');
  const toggle = (key: keyof typeof settings, label: string) =>
    `<div class="set-row"><span>${label}</span><button class="toggle ${settings[key] ? 'on' : ''}" data-toggle="${key}"><i></i></button></div>`;
  const seg = (label: string, key: string, opts: [string | number, string][], cur: string | number) =>
    `<div class="set-row"><span>${label}</span><div class="seg small">${opts
      .map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-seg="${key}" data-val="${v}">${l}</button>`)
      .join('')}</div></div>`;
  ui().innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="panel-title">${L.settings}</div>
        <div style="width:80px"></div>
      </div>
      <div class="panel-body cols">
        <div>
          ${toggle('sound', L.sound)}
          <div class="set-row"><span>${L.volume}</span><input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-range="volume"></div>
          ${toggle('vibration', L.vibration)}
          ${toggle('autoSwitch', L.autoSwitch)}
          ${toggle('leftHanded', L.leftHanded)}
        </div>
        <div>
          ${toggle('minimap', L.minimap)}
          ${seg(L.zoom, 'zoom', [[1.18, L.near], [1, L.mid], [0.84, L.far]], settings.zoom)}
          ${seg(L.quality, 'quality', [['high', L.high], ['low', L.low]], settings.quality)}
          ${seg(L.language, 'lang', [['tr', 'Türkçe'], ['en', 'English']], settings.lang)}
        </div>
      </div>
    </div>`;
  bind('[data-act=back]', () => {
    audio.click();
    back();
  });
  bind('[data-toggle]', (el) => {
    const k = el.dataset.toggle as 'sound' | 'vibration' | 'autoSwitch' | 'leftHanded' | 'minimap';
    settings[k] = !settings[k];
    saveSettings();
    audio.applyVolume();
    audio.click();
    h.settingsChanged();
    showSettings(h, back, inGame);
  });
  bind('[data-seg]', (el) => {
    const k = el.dataset.seg!;
    const v = el.dataset.val!;
    if (k === 'zoom') settings.zoom = Number(v);
    if (k === 'quality') settings.quality = v as 'high' | 'low';
    if (k === 'lang') settings.lang = v as 'tr' | 'en';
    saveSettings();
    audio.click();
    h.settingsChanged();
    showSettings(h, back, inGame);
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
  ui().className = 'screen-howto';
  ui().innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="panel-title">${L.howTo}</div>
        <div style="width:80px"></div>
      </div>
      <div class="panel-body howto-grid">
        ${L.howToItems.map(([i, title, d]) => `<div class="howto-item"><div class="hi-icon">${i}</div><div><b>${esc(title)}</b><p>${esc(d)}</p></div></div>`).join('')}
      </div>
    </div>`;
  bind('[data-act=back]', () => {
    audio.click();
    back();
  });
}

// ------------------------------------------------------------------ pause

export function showPause(h: MenuHandlers, m: Match) {
  const L = t();
  ui().className = 'screen-pause';
  const [a, b] = m.teams;
  ui().innerHTML = `
    <div class="pause-box">
      <div class="panel-title">${L.paused}</div>
      <div class="mini-score"><span style="color:${a.def.primary}">${a.def.short}</span> ${a.score} - ${b.score} <span style="color:${b.def.primary}">${b.def.short}</span></div>
      <button class="btn btn-primary" data-act="resume">${L.resume}</button>
      <button class="btn btn-ghost" data-act="settings">${L.settings}</button>
      <button class="btn btn-ghost" data-act="howto">${L.howTo}</button>
      <button class="btn btn-ghost" data-act="restart">${L.restart}</button>
      <button class="btn btn-danger" data-act="quit">${L.quit}</button>
    </div>`;
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
        <div class="res-team" style="--c:${a.def.primary}"><span class="crest">${a.def.crest}</span>${esc(a.def.name)}<small>${scorers(a)}</small></div>
        <div class="res-num">${a.score}<span>-</span>${b.score}</div>
        <div class="res-team right" style="--c:${b.def.primary}"><span class="crest">${b.def.crest}</span>${esc(b.def.name)}<small>${scorers(b)}</small></div>
      </div>
      <div class="res-body">
        <div class="res-stats">
          ${rows.map(([l, x, y]) => `<div class="rs-row"><b>${x}</b><span>${l}</span><b>${y}</b></div>`).join('')}
        </div>
        <div class="res-side">
          <div class="mvp" style="--c:${mvp.team.def.primary}">
            <div class="mvp-label">⭐ ${L.mvp}</div>
            <canvas class="mvp-kit"></canvas>
            <div class="mvp-name">${esc(mvp.name)} <small>#${mvp.number}</small></div>
            <div class="mvp-line">⚽ ${mvp.goals} · 💥 ${mvp.knockdowns} · 🧤 ${mvp.saves}</div>
          </div>
          <div class="coins">+${coins} 🪙</div>
        </div>
      </div>
      <div class="row">
        <button class="btn btn-ghost" data-act="quit">${L.menu}</button>
        <button class="btn btn-primary" data-act="restart">${L.rematch} ▶</button>
      </div>
    </div>`;
  const c = ui().querySelector<HTMLCanvasElement>('.mvp-kit');
  if (c) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 70, hh = c.clientHeight || 80;
    c.width = w * dpr;
    c.height = hh * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.translate(w / 2, hh - 4);
    drawFootballer(
      g,
      { kit: mvp.team.def, isGK: mvp.isGK, skin: mvp.skin, hair: mvp.hair, hairStyle: mvp.hairStyle, beard: mvp.beard, number: mvp.number, build: mvp.build },
      { runPhase: 0, speed: 0, facingLeft: false, state: 'celebrate', stateT: 0.1, stateDur: 0, kickAnim: 0, charge: 0, hasBallGK: false, diveUp: 0, spinT: 0 },
      (hh - 8) / 2.9 / 1.18,
    );
  }
  bind('[data-act=quit]', () => h.quit());
  bind('[data-act=restart]', () => h.restart());
  void record;
}
