export interface Settings {
  volume: number;
  sound: boolean;
  vibration: boolean;
  autoSwitch: boolean;
  leftHanded: boolean;
  minimap: boolean;
  zoom: number;
  quality: 'high' | 'low';
  lang: Lang;
  /** joystick stays in place instead of following the finger */
  joyFixed: boolean;
  /** light auto-aim for passes */
  passAssist: boolean;
  /** faint aim line while on the ball */
  aimLine: boolean;
  /** size multiplier of the touch buttons and joystick */
  btnScale: number;
  /** custom touch layout: centre as a fraction of the screen + size multiplier, per control (a..e, joy) */
  ctrl: { [id: string]: { x: number; y: number; s: number } } | null;
  /** settings schema version */
  v: number;
}

export interface Record {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  knockdowns: number;
  coins: number;
}

const DEFAULT_SETTINGS: Settings = {
  volume: 0.8,
  sound: true,
  vibration: true,
  autoSwitch: true,
  leftHanded: false,
  minimap: true,
  zoom: 1,
  quality: 'high',
  lang: 'en',
  joyFixed: false,
  passAssist: true,
  aimLine: true,
  btnScale: 1,
  ctrl: null,
  v: 3,
};

const DEFAULT_RECORD: Record = {
  played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, knockdowns: 0, coins: 0,
};

function load<T extends object>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...def };
    return { ...def, ...JSON.parse(raw) };
  } catch {
    return { ...def };
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable - ignore */
  }
}

export type Lang = 'en' | 'tr';

export const settings: Settings = load('mf.settings', DEFAULT_SETTINGS);
// v1 defaulted to Turkish; from v2 the default language is English
const storedVersion = (() => {
  try {
    return (JSON.parse(localStorage.getItem('mf.settings') || '{}') as { v?: number }).v ?? 1;
  } catch {
    return 1;
  }
})();
if (storedVersion < 2) {
  settings.lang = 'en';
  settings.v = 2;
}
// v3: new button layout (SHOOT on top, THROUGH, PASS, big SPRINT / SKILL key): a saved
// custom layout would put the keys back in their old places with their new jobs
if (storedVersion < 3) {
  settings.ctrl = null;
  settings.v = 3;
  try {
    localStorage.setItem('mf.settings', JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
export const record: Record = load('mf.record', DEFAULT_RECORD);

export const saveSettings = () => save('mf.settings', settings);
export const saveRecord = () => save('mf.record', record);

export const lastSetup = load('mf.setup', {
  home: -1, away: 1, size: 7, duration: 180, difficulty: 'normal' as string,
  /** venue choices: an id or 'random' (see game/env.ts) */
  weather: 'random' as string, pitch: 'random' as string, stadium: 'random' as string,
  v: 4,
});
// v0.3: home side defaults to the user's own club
if ((lastSetup.v ?? 0) < 3) {
  lastSetup.home = -1;
  lastSetup.v = 3;
}
// v4: 7v7 is the main format
if ((lastSetup.v ?? 0) < 4) {
  lastSetup.size = 7;
  lastSetup.v = 4;
  save('mf.setup', lastSetup);
}
// fog was removed as a weather: old saves fall back to random
if (lastSetup.weather === 'fog') lastSetup.weather = 'random';
export const saveSetup = () => save('mf.setup', lastSetup);
