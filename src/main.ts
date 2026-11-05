import '@fontsource/press-start-2p';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/roboto-condensed/500.css';
import '@fontsource/roboto-condensed/700.css';
import '@fontsource/permanent-marker/400.css';
import '@fontsource/roboto-condensed/400.css';
import './ui/style.css';
import './ui/dossier.css';
import './ui/motion.css';
import './ui/store.css';
import './ui/crate3d.css';
import { installMotion } from './ui/motion';
import { initUpdater } from './engine/update';
import { initNotifications } from './engine/notify';
import { lineupChemMuls, addFamiliarity } from './meta/chemistry';
import { missionsAfterMatch } from './meta/missions';
import { resolveEnv, homeGroundEnv, MatchEnv, Weather, PitchStyle, Stadium, Choice } from './game/env';

import { Input, Insets } from './engine/input';
import { audio } from './engine/audio';
import { settings, record, saveRecord, lastSetup } from './engine/storage';
import { Game } from './game/game';
import { Renderer } from './game/renderer';
import { TEAMS, TeamDef } from './game/teams';
import { nextFixture, teamById, leagueDifficulty, recordUserResult } from './meta/league';
import { showLeague } from './ui/league';
import type { Difficulty } from './game/entities';
import { DIFF_REWARD } from './game/entities';
import { showPause, showResults, hideUI, MenuHandlers, homeDef } from './ui/menus';
import { showSplash, showHub } from './ui/hub';
import { installBankShortcut } from './ui/bank';
import { profile, lineupCards, loadoutTiers } from './meta/profile';
import type { CardData } from './meta/cards';
import { t } from './engine/i18n';
import { toast } from './ui/common';
import type { MatchConfig, Match } from './game/match';
import { showCareer } from './ui/career/home';
import { career } from './career/state';
import { careerHudStart, careerHudStop, careerHudTick } from './ui/career/hud';
import './ui/career/career.css';
import './ui/fit.css';
import './ui/formation.css';
import './ui/monetize.css';
import './ui/series.css';

const canvas = document.getElementById('game') as HTMLCanvasElement;
let ctx = canvas.getContext('2d', { alpha: false })!;
const input = new Input(canvas);

let W = 0, H = 0;
let mode: 'menu' | 'play' | 'paused' | 'results' = 'menu';
let demo: Game | null = null;
let game: Game | null = null;

function readInsets(): Insets {
  const el = document.getElementById('safe-probe')!;
  const cs = getComputedStyle(el);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

/**
 * Pixel-perfect display: the game renders into a low-res virtual framebuffer
 * (~232 px tall) that is scaled up by an integer factor with nearest-neighbour.
 */
const HD = 2;

function resize() {
  const cssW = window.innerWidth, cssH = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
  // the framebuffer has 2 HD pixels per game pixel: the world keeps its chunky
  // look (drawn scaled 2x) while sprites are rasterized at the full density
  const hp = Math.max(1, Math.round(devH / (464 / settings.zoom)));
  const px = hp * 2;
  W = Math.ceil(devW / px);
  H = Math.ceil(devH / px);
  canvas.width = W * HD;
  canvas.height = H * HD;
  canvas.style.width = (W * px) / dpr + 'px';
  canvas.style.height = (H * px) / dpr + 'px';
  ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.setTransform(HD, 0, 0, HD, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const k = px / dpr; // css px per virtual px
  input.k = k;
  const ins = readInsets();
  input.resize(W, H, { top: ins.top / k, right: ins.right / k, bottom: ins.bottom / k, left: ins.left / k });
  demo?.resize(W, H);
  game?.resize(W, H);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

function applyLang() {
  document.documentElement.lang = settings.lang;
  document.querySelector('#rotate p')!.textContent = t().rotate;
}

/** venue shown behind the menus */
let demoEnv: MatchEnv | null = null;

function newDemo() {
  const a = Math.floor(Math.random() * TEAMS.length);
  let b = Math.floor(Math.random() * TEAMS.length);
  if (b === a) b = (a + 1) % TEAMS.length;
  demoEnv ??= resolveEnv('random', 'random', 'random');
  demo = new Game({ home: TEAMS[a], away: TEAMS[b], size: 4, duration: 90, difficulty: 'hard', demo: true, env: demoEnv }, null);
  // menu backdrop: a calm stadium (players warming up), not a running match
  demo.ambient = true;
  demo.resize(W, H);
}

function requestFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (!document.fullscreenElement && matchMedia('(pointer: coarse)').matches) {
      if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
      else el.webkitRequestFullscreen?.();
      const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      void so?.lock?.('landscape').catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/** 'quick' = friendly from the setup screen, 'league' = current league fixture */
let matchMode: 'quick' | 'league' | 'training' | 'career' = 'quick';
/** career: the running config and what to do when it ends */
let careerCfg: MatchConfig | null = null;
let careerEnd: ((m: Match) => void) | null = null;
let trainingMode: 'team' | 'keeper' = 'keeper';

function launch(home: TeamDef, away: TeamDef, difficulty: Difficulty, useClub: boolean, training?: 'team' | 'keeper', env?: MatchEnv) {
  requestFullscreen();
  audio.unlock();
  const homeCards = useClub ? lineupCards().filter((c): c is CardData => !!c) : undefined;
  game?.dispose();
  game = new Game(
    {
      home, away, size: lastSetup.size, duration: lastSetup.duration, difficulty, demo: false,
      homeCards: homeCards && homeCards.length >= lastSetup.size ? homeCards : undefined,
      homeChem: useClub ? lineupChemMuls(lastSetup.size) : undefined,
      homeFormation: profile.formations?.[lastSetup.size] ?? null,
      starId: useClub ? profile.myPlayer : null,
      loadout: { goalfx: profile.equipped.goalfx, trail: profile.equipped.trail, powers: profile.loadout, tiers: loadoutTiers(), boots: profile.equipped.boots },
      training,
      env,
    },
    input,
  );
  game.match.onEnd = () => endMatch();
  game.resize(W, H);
  input.reset();
  input.enabled = true;
  mode = 'play';
  hideUI();
}

function launchCfg(cfg: MatchConfig) {
  requestFullscreen();
  audio.unlock();
  game?.dispose();
  game = new Game(cfg, input);
  game.match.onEnd = () => endMatch();
  game.resize(W, H);
  input.reset();
  input.enabled = true;
  mode = 'play';
  hideUI();
}

const handlers: MenuHandlers = {
  playCareer(cfg, onEnd) {
    // career matches get a random venue and weather too (not the training drills)
    if (!cfg.env && !cfg.drill && !cfg.training) cfg.env = resolveEnv('random', 'random', 'random');
    matchMode = 'career';
    careerCfg = cfg;
    careerEnd = onEnd;
    launchCfg(cfg);
    careerHudStart(!!cfg.drill);
  },
  showCareer() {
    showCareer(handlers);
  },
  startMatch() {
    matchMode = 'quick';
    const env = resolveEnv(lastSetup.weather as Choice<Weather>, lastSetup.pitch as Choice<PitchStyle>, lastSetup.stadium as Choice<Stadium>);
    launch(homeDef(lastSetup.home), TEAMS[lastSetup.away], lastSetup.difficulty as Difficulty, lastSetup.home < 0, undefined, env);
  },
  previewEnv(env) {
    const cur = demo?.match.env;
    if (cur && cur.weather === env.weather && cur.pitch === env.pitch && cur.stadium === env.stadium) return;
    demoEnv = env;
    newDemo();
  },
  startLeagueMatch() {
    const fx = nextFixture();
    if (!fx) return;
    matchMode = 'league';
    // played at the home side's ground (the user's club uses its venue preference)
    const env = homeGroundEnv(fx.home ? 'club' : fx.opp, { stadium: lastSetup.stadium as Choice<Stadium>, pitch: lastSetup.pitch as Choice<PitchStyle> });
    launch(teamById('club'), teamById(fx.opp), leagueDifficulty(), true, undefined, env);
  },
  showLeague() {
    game?.dispose();
    game = null;
    mode = 'menu';
    input.enabled = false;
    showLeague(handlers);
  },
  resume() {
    if (!game) return;
    game.paused = false;
    input.reset();
    mode = 'play';
    audio.resume();
    hideUI();
  },
  startTraining(m: 'team' | 'keeper') {
    matchMode = 'training';
    trainingMode = m;
    const club = teamById('club');
    const opp = TEAMS[Math.floor(Math.random() * TEAMS.length)];
    launch(club, opp, 'normal', true, m);
  },
  restart() {
    if (matchMode === 'career' && careerCfg) {
      launchCfg(careerCfg);
      careerHudStart(!!careerCfg.drill);
      return;
    }
    if (matchMode === 'training') handlers.startTraining(trainingMode);
    else if (matchMode === 'league') handlers.startLeagueMatch();
    else handlers.startMatch();
  },
  quit() {
    game?.dispose();
    game = null;
    mode = 'menu';
    input.enabled = false;
    audio.resume();
    careerHudStop();
    if (matchMode === 'career') {
      // abandoning a career match: back to the week, nothing recorded
      matchMode = 'quick';
      showCareer(handlers);
      return;
    }
    showHub(handlers);
  },
  firstTap() {
    audio.unlock();
    requestFullscreen();
  },
  settingsChanged(key?: string) {
    // only redo the work a setting actually needs: rebuilding the stadium renderers
    // on every toggle is what made the settings screen stutter
    if (!key || key === 'lang') applyLang();
    if (!key || key === 'zoom' || key === 'leftHanded' || key === 'btnScale' || key === 'ctrl') resize();
    if (!key || key === 'quality') {
      // let the menu repaint first, then rebuild (expensive) in the background
      setTimeout(() => {
        if (game) game.renderer = new Renderer(game.match);
        if (demo) demo.renderer = new Renderer(demo.match);
      }, 30);
    }
  },
};

function pause() {
  if (mode !== 'play' || !game) return;
  if (game.match.phase === 'over') return;
  game.paused = true;
  mode = 'paused';
  input.reset();
  showPause(handlers, game.match);
}
input.onPause = pause;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    audio.suspend();
  } else if (mode !== 'paused') audio.resume();
});

function endMatch() {
  if (!game) return;
  const m = game.match;
  if (matchMode === 'career') {
    // career matches report back to the career flow instead of the quick results
    careerHudStop();
    const done = careerEnd;
    careerEnd = null;
    matchMode = 'quick';
    game.dispose();
    game = null;
    mode = 'menu';
    input.enabled = false;
    audio.resume();
    try {
      done?.(m);
    } catch (e) {
      reportError('career', e);
      showCareer(handlers);
    }
    return;
  }
  const [a, b] = m.teams;
  const res = a.score > b.score ? 'w' : a.score < b.score ? 'l' : 'd';
  record.played++;
  if (res === 'w') record.wins++;
  else if (res === 'l') record.losses++;
  else record.draws++;
  record.goalsFor += a.score;
  record.goalsAgainst += b.score;
  record.knockdowns += a.stats.knockdowns;
  const diffMul = DIFF_REWARD[m.cfg.difficulty] ?? 1;
  const coins = Math.round(((res === 'w' ? 100 : res === 'd' ? 40 : 15) + a.score * 10 + a.stats.knockdowns * 2) * diffMul);
  record.coins += coins;
  saveRecord();
  if (matchMode === 'league') recordUserResult(a.score, b.score);
  if (m.cfg.homeCards) addFamiliarity(m.cfg.size);
  const w = m.env.weather;
  const done = missionsAfterMatch({
    res, goalsFor: a.score, goalsAgainst: b.score, knockdowns: a.stats.knockdowns, passes: a.stats.passes,
    crosses: a.stats.crosses, chips: a.stats.chips, headers: a.stats.headers, powers: a.stats.powerShots, steals: a.stats.tackles,
    hard: ['hard', 'insane', 'legend'].includes(m.cfg.difficulty), badWeather: w === 'rain' || w === 'storm' || w === 'snow',
    league: matchMode === 'league',
  });
  mode = 'results';
  input.enabled = false;
  showResults(handlers, m, coins, matchMode === 'league', done);
}

// unlock audio on first interaction anywhere
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

let last = performance.now();
// ---------------------------------------------------------------- crash safety
// The loop must never stop: one exception used to leave a frozen screen forever.
// Errors are logged (Settings shows the last one) and a match that keeps failing
// is abandoned back to the menu.
let errStreak = 0;
let lastErrAt = 0;
export function reportError(where: string, e: unknown) {
  const msg = e instanceof Error ? `${e.message}\n${(e.stack ?? '').split('\n').slice(0, 4).join('\n')}` : String(e);
  console.error('Mad Football error in', where, e);
  try {
    localStorage.setItem('mf.lastError', JSON.stringify({ at: new Date().toISOString(), where, msg, v: (import.meta.env.VITE_BUILD as string) || 'dev' }));
  } catch {
    /* ignore */
  }
}
window.addEventListener('error', (e) => reportError('window', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => reportError('promise', e.reason));

function frame(now: number) {
  requestAnimationFrame(frame); // schedule first, so nothing below can stop the loop
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000) || 0);
  last = now;
  try {
    ctx.imageSmoothingEnabled = false;
    if (mode === 'play' || mode === 'paused' || (mode === 'results' && game)) {
      game!.update(mode === 'play' || mode === 'results' ? dt : 0);
      game!.draw(ctx, W, H, mode === 'play');
      if (matchMode === 'career' && game) careerHudTick(game.match, !!careerCfg?.startScore, false, mode === 'play');
    } else {
      if (!demo) newDemo();
      demo!.update(dt);
      demo!.draw(ctx, W, H, false);
    }
    errStreak = 0;
  } catch (e) {
    errStreak++;
    if (now - lastErrAt > 2000) {
      lastErrAt = now;
      reportError(mode, e);
    }
    // a match that keeps throwing is abandoned instead of freezing the game
    if (errStreak > 20) {
      errStreak = 0;
      try {
        if (game) {
          game.dispose();
          game = null;
          mode = 'menu';
          input.enabled = false;
          showHub(handlers);
          toast(t().crashRecovered);
        } else demo = null;
      } catch (e2) {
        reportError('recover', e2);
      }
    }
  }
}

if (import.meta.env.DEV) {
  (window as unknown as { __mf: unknown }).__mf = { get game() { return game; }, get demo() { return demo; }, get career() { return career(); }, preview: (e: MatchEnv) => handlers.previewEnv(e), handlers };
}

/** One-time test gift: 50 000 coins (granted once per install). */
function testGift() {
  try {
    if (localStorage.getItem('mf.gift.test50k')) return;
    localStorage.setItem('mf.gift.test50k', '1');
    record.coins += 50000;
    saveRecord();
    setTimeout(() => toast(settings.lang === 'tr' ? 'Test hediyesi: +50.000 altın!' : 'Test gift: +50,000 coins!'), 1500);
  } catch {
    /* ignore */
  }
}

async function boot() {
  installMotion();
  testGift();
  resize();
  applyLang();
  try {
    await Promise.race([document.fonts.load('16px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* ignore */
  }
  newDemo();
  input.enabled = false;
  installBankShortcut(handlers);
  showSplash(handlers);
  initUpdater();
  initNotifications();
  requestAnimationFrame(frame);
  // studio screen: keep it up for a moment, then fade out
  const bootEl = document.getElementById('boot');
  if (bootEl) {
    const shown = performance.now() - bootStart;
    setTimeout(() => {
      bootEl.style.opacity = '0';
      setTimeout(() => bootEl.remove(), 450);
    }, Math.max(0, 1600 - shown));
  }
}
const bootStart = performance.now();
void boot();
