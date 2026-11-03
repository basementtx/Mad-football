import '@fontsource/russo-one';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/900.css';
import './ui/style.css';

import { Input, Insets } from './engine/input';
import { audio } from './engine/audio';
import { settings, record, saveRecord, lastSetup } from './engine/storage';
import { Game } from './game/game';
import { Renderer } from './game/renderer';
import { TEAMS } from './game/teams';
import type { Difficulty } from './game/entities';
import { showTitle, showPause, showResults, hideUI, MenuHandlers } from './ui/menus';
import { t } from './engine/i18n';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;
const input = new Input(canvas);

let W = 0, H = 0, dpr = 1;
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

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, settings.quality === 'high' ? 2 : 1.25);
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  input.resize(W, H, readInsets());
  demo?.resize(W, H);
  game?.resize(W, H);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

function newDemo() {
  const a = Math.floor(Math.random() * TEAMS.length);
  let b = Math.floor(Math.random() * TEAMS.length);
  if (b === a) b = (a + 1) % TEAMS.length;
  demo = new Game({ home: TEAMS[a], away: TEAMS[b], size: 4, duration: 90, difficulty: 'hard', demo: true }, null);
  demo.match.onEnd = () => newDemo();
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

const handlers: MenuHandlers = {
  startMatch() {
    requestFullscreen();
    audio.unlock();
    const home = TEAMS[lastSetup.home];
    const away = TEAMS[lastSetup.away];
    game = new Game({ home, away, size: lastSetup.size, duration: lastSetup.duration, difficulty: lastSetup.difficulty as Difficulty, demo: false }, input);
    game.match.onEnd = () => endMatch();
    game.resize(W, H);
    input.reset();
    input.enabled = true;
    mode = 'play';
    hideUI();
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
    handlers.startMatch();
  },
  quit() {
    game = null;
    mode = 'menu';
    input.enabled = false;
    audio.resume();
    showTitle(handlers);
  },
  settingsChanged() {
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
  const diffMul = { easy: 0.6, normal: 1, hard: 1.5, insane: 2.2 }[m.cfg.difficulty];
  const coins = Math.round(((res === 'w' ? 100 : res === 'd' ? 40 : 15) + a.score * 10 + a.stats.knockdowns * 2) * diffMul);
  record.coins += coins;
  saveRecord();
  mode = 'results';
  input.enabled = false;
  showResults(handlers, m, coins);
}

// unlock audio on first interaction anywhere
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  (window as unknown as { __mf: unknown }).__mf = { get game() { return game; }, get demo() { return demo; } };
}

async function boot() {
  resize();
  document.documentElement.lang = settings.lang;
  document.querySelector('#rotate p')!.textContent = t().rotate;
  try {
    await Promise.race([document.fonts.load('20px "Russo One"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* ignore */
  }
  newDemo();
  input.enabled = false;
  showTitle(handlers);
  requestAnimationFrame(frame);
}
void boot();
