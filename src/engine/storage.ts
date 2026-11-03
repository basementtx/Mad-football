export interface Settings {
  volume: number;
  sound: boolean;
  vibration: boolean;
  autoSwitch: boolean;
  leftHanded: boolean;
  minimap: boolean;
  zoom: number;
  quality: 'high' | 'low';
  lang: 'tr' | 'en';
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
  lang: 'tr',
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

export const settings: Settings = load('mf.settings', DEFAULT_SETTINGS);
export const record: Record = load('mf.record', DEFAULT_RECORD);

export const saveSettings = () => save('mf.settings', settings);
export const saveRecord = () => save('mf.record', record);

export const lastSetup = load('mf.setup', { home: 0, away: 1, size: 4, duration: 180, difficulty: 'normal' as string });
export const saveSetup = () => save('mf.setup', lastSetup);
