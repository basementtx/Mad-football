/**
 * Match environment: weather, pitch (mowing) style and stadium design.
 * Weather also nudges the physics a little (wet = skiddy ball, snow = heavy ball, wind = drift).
 */

export type Weather = 'clear' | 'rain' | 'snow' | 'wind' | 'storm' | 'night';
export type PitchStyle = 'stripes' | 'checker' | 'diagonal' | 'rings' | 'dry' | 'astro';
export type Stadium = 'arena' | 'retro' | 'street' | 'coliseum' | 'neon';

export const WEATHERS: Weather[] = ['clear', 'night', 'rain', 'storm', 'snow', 'wind'];

/**
 * How often each weather turns up when it is left to chance. Most matches are played
 * in clear weather; rain, snow, wind and storms are the occasional twist.
 */
const WEATHER_ODDS: [Weather, number][] = [['clear', 0.62], ['night', 0.14], ['rain', 0.08], ['wind', 0.07], ['snow', 0.05], ['storm', 0.04]];

/** A random weather, weighted towards clear skies. */
export function randomWeather(): Weather {
  let r = Math.random();
  for (const [w, p] of WEATHER_ODDS) {
    r -= p;
    if (r < 0) return w;
  }
  return 'clear';
}

/** A setup value that may come from an older save (e.g. the removed 'fog'). */
export const isWeather = (w: string): w is Weather => (WEATHERS as string[]).includes(w);
export const PITCHES: PitchStyle[] = ['stripes', 'checker', 'diagonal', 'rings', 'dry', 'astro'];
export const STADIUMS: Stadium[] = ['arena', 'retro', 'street', 'coliseum', 'neon'];

export interface MatchEnv {
  weather: Weather;
  pitch: PitchStyle;
  stadium: Stadium;
  /** wind direction (radians) and strength (m/s^2 on an airborne ball) */
  windA: number;
  windF: number;
}

/** Physics modifiers derived from the weather. */
export interface EnvPhys {
  /** multiplier on rolling friction of the ball */
  roll: number;
  /** ground bounce coefficient multiplier */
  bounce: number;
  /** player acceleration multiplier (slippery ground) */
  grip: number;
  /** player top speed multiplier */
  speed: number;
  /** slide tackle speed multiplier */
  slide: number;
}

export function envPhys(env: MatchEnv | undefined): EnvPhys {
  switch (env?.weather) {
    case 'rain': return { roll: 0.72, bounce: 0.8, grip: 0.8, speed: 1, slide: 1.18 };
    case 'storm': return { roll: 0.66, bounce: 0.75, grip: 0.72, speed: 0.98, slide: 1.22 };
    case 'snow': return { roll: 1.45, bounce: 0.6, grip: 0.85, speed: 0.93, slide: 0.92 };
    default:
      if (env?.pitch === 'astro') return { roll: 0.88, bounce: 1.12, grip: 1, speed: 1.02, slide: 1 };
      if (env?.pitch === 'dry') return { roll: 0.92, bounce: 1.08, grip: 1, speed: 1, slide: 1.04 };
      return { roll: 1, bounce: 1, grip: 1, speed: 1, slide: 1 };
  }
}

/** Home grounds of the built-in teams. */
const HOME: Record<string, { stadium: Stadium; pitch: PitchStyle; weathers: Weather[] }> = {
  volcano: { stadium: 'coliseum', pitch: 'dry', weathers: ['clear', 'night', 'wind'] },
  thunder: { stadium: 'arena', pitch: 'stripes', weathers: ['storm', 'rain', 'night', 'clear'] },
  frost: { stadium: 'arena', pitch: 'checker', weathers: ['snow', 'clear', 'clear'] },
  jungle: { stadium: 'retro', pitch: 'rings', weathers: ['rain', 'clear', 'clear'] },
  neon: { stadium: 'neon', pitch: 'astro', weathers: ['night', 'night', 'rain'] },
  bulls: { stadium: 'street', pitch: 'astro', weathers: ['clear', 'wind', 'rain', 'night'] },
  ravens: { stadium: 'retro', pitch: 'diagonal', weathers: ['rain', 'night', 'clear'] },
  scorpions: { stadium: 'coliseum', pitch: 'dry', weathers: ['clear', 'wind', 'wind'] },
};

const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

export function makeEnv(weather: Weather, pitch: PitchStyle, stadium: Stadium): MatchEnv {
  const windy = weather === 'wind' ? 1 : weather === 'storm' ? 0.7 : weather === 'snow' ? 0.25 : weather === 'rain' ? 0.2 : 0;
  return {
    weather,
    pitch,
    stadium,
    windA: Math.random() * Math.PI * 2,
    windF: windy * (2.2 + Math.random() * 1.6),
  };
}

/** 'random' or a concrete id, as stored in the setup. */
export type Choice<T extends string> = T | 'random';

export function resolveEnv(w: Choice<Weather>, p: Choice<PitchStyle>, s: Choice<Stadium>): MatchEnv {
  return makeEnv(w === 'random' || !isWeather(w) ? randomWeather() : w, p === 'random' ? pick(PITCHES) : p, s === 'random' ? pick(STADIUMS) : s);
}

/** Environment of a fixture played at `homeId`'s ground (custom club: its saved preference). */
export function homeGroundEnv(homeId: string, club?: { stadium: Choice<Stadium>; pitch: Choice<PitchStyle> }): MatchEnv {
  const h = HOME[homeId];
  if (h) {
    // usually clear skies; now and then the team's typical home weather
    const w = Math.random() < 0.3 ? pick(h.weathers) : randomWeather();
    return makeEnv(w, h.pitch, h.stadium);
  }
  return resolveEnv('random', club?.pitch ?? 'stripes', club?.stadium ?? 'arena');
}
