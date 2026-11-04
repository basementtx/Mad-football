/**
 * Match environment: weather, pitch (mowing) style and stadium design.
 * Weather also nudges the physics a little (wet = skiddy ball, snow = heavy ball, wind = drift).
 */

export type Weather = 'clear' | 'rain' | 'snow' | 'fog' | 'wind' | 'storm' | 'night';
export type PitchStyle = 'stripes' | 'checker' | 'diagonal' | 'rings' | 'dry' | 'astro';
export type Stadium = 'arena' | 'retro' | 'street' | 'coliseum' | 'neon';

export const WEATHERS: Weather[] = ['clear', 'night', 'rain', 'storm', 'snow', 'fog', 'wind'];
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
  frost: { stadium: 'arena', pitch: 'checker', weathers: ['snow', 'snow', 'fog', 'clear'] },
  jungle: { stadium: 'retro', pitch: 'rings', weathers: ['rain', 'fog', 'clear'] },
  neon: { stadium: 'neon', pitch: 'astro', weathers: ['night', 'night', 'rain'] },
  bulls: { stadium: 'street', pitch: 'astro', weathers: ['clear', 'wind', 'rain', 'night'] },
  ravens: { stadium: 'retro', pitch: 'diagonal', weathers: ['fog', 'rain', 'night', 'clear'] },
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
  return makeEnv(w === 'random' ? pick(WEATHERS) : w, p === 'random' ? pick(PITCHES) : p, s === 'random' ? pick(STADIUMS) : s);
}

/** Environment of a fixture played at `homeId`'s ground (custom club: its saved preference). */
export function homeGroundEnv(homeId: string, club?: { stadium: Choice<Stadium>; pitch: Choice<PitchStyle> }): MatchEnv {
  const h = HOME[homeId];
  if (h) {
    // mostly the team's typical weather, sometimes anything
    const w = Math.random() < 0.75 ? pick(h.weathers) : pick(WEATHERS);
    return makeEnv(w, h.pitch, h.stadium);
  }
  return resolveEnv('random', club?.pitch ?? 'stripes', club?.stadium ?? 'arena');
}
