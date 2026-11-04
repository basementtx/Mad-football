/** Shared DOM helpers for the menu screens. */
import { audio } from '../engine/audio';
import { flagCanvas } from '../pixel/flags';
import { playerSheet, FRAMES, CELL_W, CELL_H, PlayerLook } from '../pixel/player';
import { textCanvas } from '../pixel/font';
import { crestCanvas } from '../pixel/crest';
import { crateCanvases } from '../pixel/crate';
import { ramp, css } from '../pixel/palette';
import type { TeamDef, CrestCfg } from '../game/teams';
import { record } from '../engine/storage';

export const ui = () => document.getElementById('ui')!;

export function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function bind(sel: string, fn: (el: HTMLElement, e: Event) => void, root: ParentNode = ui()) {
  root.querySelectorAll<HTMLElement>(sel).forEach((el) =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.unlock();
      fn(el, e);
    }),
  );
}

export function setScreen(cls: string, html: string) {
  ui().className = cls;
  ui().innerHTML = html;
  paintAll();
}

// ------------------------------------------------------------------ canvas painting registry
// Screens are built as HTML strings; pixel canvases are declared with paintTag() and
// filled after the HTML is inserted.
const registry = new Map<string, () => HTMLCanvasElement>();
let seq = 0;

export function paintTag(src: () => HTMLCanvasElement, cls = '', attrs = '') {
  const id = 'pt' + seq++;
  registry.set(id, src);
  return `<canvas class="pix ${cls}" data-paint="${id}" ${attrs}></canvas>`;
}

export function paintAll(root: ParentNode = ui()) {
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-paint]').forEach((c) => {
    const fn = registry.get(c.dataset.paint!);
    if (!fn) return;
    const src = fn();
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0);
    registry.delete(c.dataset.paint!);
    c.removeAttribute('data-paint');
  });
  if (registry.size > 600) registry.clear();
}

// ------------------------------------------------------------------ pixel sources
export const flagTag = (code: string, cls = 'flag') => paintTag(() => flagCanvas(code), cls);

export function crestTag(def: { crest: CrestCfg; primary: string; secondary: string }, cls = 'crest-img') {
  return paintTag(() => crestCanvas(def.crest, def.primary, def.secondary), cls);
}

export function spriteSource(look: PlayerLook, frame: string, left = false, glow = true) {
  return () => {
    const sheet = playerSheet(look).canvas;
    const c = document.createElement('canvas');
    c.width = CELL_W;
    c.height = CELL_H;
    const g = c.getContext('2d')!;
    if (glow) {
      const rp = ramp(look.kit.primary);
      g.fillStyle = css(rp[1], 0.6);
      g.fillRect(9, 34, 22, 2);
      g.fillRect(12, 33, 16, 4);
    }
    g.drawImage(sheet, FRAMES[frame] * CELL_W, (left ? 1 : 0) * CELL_H, CELL_W, CELL_H, 0, 0, CELL_W, CELL_H);
    return c;
  };
}

/** Upper-body crop of a sprite for card portraits. */
export function portraitSource(look: PlayerLook) {
  return () => {
    const sheet = playerSheet(look).canvas;
    const c = document.createElement('canvas');
    c.width = 26;
    c.height = 24;
    c.getContext('2d')!.drawImage(sheet, FRAMES.idle0 * CELL_W + 8, 2, 26, 24, 0, 0, 26, 24);
    return c;
  };
}

export function logoSource(text: string, scale: number, color: string, color2: string, shadow: string) {
  return () => textCanvas(text, { scale, color, color2, outline: '#120c1c', thick: Math.max(1, Math.floor(scale / 2)), shadow });
}

let coinC: HTMLCanvasElement | null = null;
export function coinSource() {
  return () => {
    if (coinC) return coinC;
    const c = document.createElement('canvas');
    c.width = 9;
    c.height = 9;
    const g = c.getContext('2d')!;
    const rows = ['..#####..', '.#yyyyy#.', '#yYYyyyo#', '#yYyyyyo#', '#yyy#yyo#', '#yyyyyyo#', '#yyyyyoo#', '.#oooo#.', '..#####..'];
    const col: Record<string, string> = { '#': '#5a3a00', y: '#ffcc2a', Y: '#fff2a8', o: '#c88a00' };
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (col[ch]) {
        g.fillStyle = col[ch];
        g.fillRect(x, y, 1, 1);
      }
    }));
    return (coinC = c);
  };
}
export const coinTag = (cls = 'coin-ic') => paintTag(coinSource(), cls);

export const crateTag = (kind: 'basic' | 'premium' | 'legend', cls = 'crate-ic') =>
  paintTag(() => {
    const { body, lid } = crateCanvases(kind);
    const c = document.createElement('canvas');
    c.width = body.width;
    c.height = body.height + lid.height - 2;
    const g = c.getContext('2d')!;
    g.drawImage(body, 0, lid.height - 2);
    g.drawImage(lid, 0, 0);
    return c;
  }, cls);

export function coinsPill() {
  return `<div class="coins-pill">${coinTag()}<span>${record.coins}</span></div>`;
}

let toastT = 0;
export function toast(msg: string) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'show';
  clearTimeout(toastT);
  toastT = window.setTimeout(() => el!.classList.remove('show'), 2200);
}

export function lookFor(kit: TeamDef, l: { skin: string; hair: string; hairStyle: number; beard: boolean }, isGK = false, boot?: PlayerLook['boot']): PlayerLook {
  return { kit, isGK, skin: l.skin, hair: l.hair, hairStyle: l.hairStyle, beard: l.beard, boot };
}

export interface MenuHandlers {
  startMatch: () => void;
  startLeagueMatch: () => void;
  showLeague: () => void;
  resume: () => void;
  restart: () => void;
  quit: () => void;
  settingsChanged: () => void;
  /** first user gesture: unlock audio / fullscreen */
  firstTap: () => void;
}
