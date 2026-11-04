import '@fontsource/press-start-2p';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './ui/style.css';
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
import { profile, lineupCards } from './meta/profile';
import type { CardData } from './meta/cards';
import { t } from './engine/i18n';

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
function resize() {
  const cssW = window.innerWidth, cssH = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
  const px = Math.max(1, Math.round(devH / (232 / settings.zoom)));
  W = Math.ceil(devW / px);
  H = Math.ceil(devH / px);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = (W * px) / dpr + 'px';
  canvas.style.height = (H * px) / dpr + 'px';
  ctx = canvas.getContext('2d', { alpha: false })!;
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
let matchMode: 'quick' | 'league' = 'quick';

function launch(home: TeamDef, away: TeamDef, difficulty: Difficulty, useClub: boolean, env: MatchEnv) {
  requestFullscreen();
  audio.unlock();
  const homeCards = useClub ? lineupCards().filter((c): c is CardData => !!c) : undefined;
  game = new Game(
    {
      home, away, size: lastSetup.size, duration: lastSetup.duration, difficulty, demo: false,
      homeCards: homeCards && homeCards.length >= lastSetup.size ? homeCards : undefined,
      homeChem: useClub ? lineupChemMuls() : undefined,
      starId: useClub ? profile.myPlayer : null,
      loadout: profile.equipped,
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

const handlers: MenuHandlers = {
  startMatch() {
    matchMode = 'quick';
    const env = resolveEnv(lastSetup.weather as Choice<Weather>, lastSetup.pitch as Choice<PitchStyle>, lastSetup.stadium as Choice<Stadium>);
    launch(homeDef(lastSetup.home), TEAMS[lastSetup.away], lastSetup.difficulty as Difficulty, lastSetup.home < 0, env);
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
    launch(teamById('club'), teamById(fx.opp), leagueDifficulty(), true, env);
  },
  showLeague() {
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
  restart() {
    if (matchMode === 'league') handlers.startLeagueMatch();
    else handlers.startMatch();
  },
  quit() {
    game = null;
    mode = 'menu';
    input.enabled = false;
    audio.resume();
    showHub(handlers);
  },
  firstTap() {
    audio.unlock();
    requestFullscreen();
  },
  settingsChanged() {
    applyLang();
    resize();
    if (game) game.renderer = new Renderer(game.match);
    if (demo) demo.renderer = new Renderer(demo.match);
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
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.imageSmoothingEnabled = false;
  if (mode === 'play' || mode === 'paused' || (mode === 'results' && game)) {
    game!.update(mode === 'play' || mode === 'results' ? dt : 0);
    game!.draw(ctx, W, H, mode === 'play');
  } else {
    if (!demo) newDemo();
    demo!.update(dt);
    demo!.draw(ctx, W, H, false);
  }
  requestAnimationFrame(frame);
}

if (import.meta.env.DEV) {
  (window as unknown as { __mf: unknown }).__mf = { get game() { return game; }, get demo() { return demo; }, preview: (e: MatchEnv) => handlers.previewEnv(e), handlers };
}

async function boot() {
  resize();
  applyLang();
  try {
    await Promise.race([document.fonts.load('16px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* ignore */
  }
  newDemo();
  input.enabled = false;
  showSplash(handlers);
  requestAnimationFrame(frame);
}
void boot();
