/** Career save slot. */
import type { Career } from './types';

const KEY = 'mf.career';
export const CAREER_V = 1;

let cur: Career | null = null;
let loaded = false;

export function career(): Career | null {
  if (!loaded) {
    loaded = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const c = JSON.parse(raw) as Career;
        if (c && c.v === CAREER_V) cur = c;
      }
    } catch {
      cur = null;
    }
  }
  return cur;
}

/** The running career (throws when there is none: callers check career() first). */
export function C(): Career {
  const c = career();
  if (!c) throw new Error('no career');
  return c;
}

export function setCareer(c: Career | null) {
  cur = c;
  loaded = true;
  saveCareer();
}

export function saveCareer() {
  try {
    if (!cur) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    // storage full: trim the social history and try once more
    if (cur) {
      cur.feed = cur.feed.slice(0, 60);
      cur.news = cur.news.slice(0, 20);
      cur.dms = cur.dms.slice(-60);
      try {
        localStorage.setItem(KEY, JSON.stringify(cur));
      } catch {
        /* give up */
      }
    }
  }
}

let seq = 0;
/** Unique-enough ids for posts, offers, messages. */
export const nextId = (p = 'x') => p + (++seq).toString(36) + Math.floor(Math.random() * 46656).toString(36);
