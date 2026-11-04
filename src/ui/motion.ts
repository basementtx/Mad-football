/**
 * Menu motion: staggered screen entrances, pointer-tracked light on tiles,
 * 3D tilt + holographic glare on player cards, touch ripples, coin count-up.
 * Everything animates transform / opacity / CSS variables only, so it stays
 * on the compositor and runs at the display's refresh rate.
 */
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const STAGGER = [
  '.hub-top > *', '.hub-top-r > *', '.panel-head > *', '.hub-grid > .tile', '.lineup > .slot', '.reserves > *',
  '.mk-grid > *', '.items-grid > *', '.crates > *', '.rewards > *',
];

let enterTimer = 0;
let shownCoins: number | null = null;

/** Called by setScreen after the new HTML is in place. */
export function enhanceScreen(root: HTMLElement, fresh: boolean) {
  // decorate: gloss layer on tiles, hero-tile extras, card glare
  root.querySelectorAll<HTMLElement>('.tile').forEach((t) => {
    if (!t.querySelector(':scope > .gloss')) t.insertAdjacentHTML('afterbegin', '<span class="gloss"></span>');
  });
  const play = root.querySelector<HTMLElement>('.tile-play');
  if (play && !play.querySelector('.tl-rays')) play.insertAdjacentHTML('afterbegin', '<span class="tl-rays"></span><span class="tl-sheen"></span>');
  root.querySelectorAll<HTMLElement>('.pcard').forEach((c) => {
    if (!c.querySelector(':scope > .pc-glare')) c.insertAdjacentHTML('beforeend', '<div class="pc-glare"></div>');
  });

  if (fresh && !reduced()) {
    for (const sel of STAGGER) root.querySelectorAll<HTMLElement>(sel).forEach((e, i) => e.style.setProperty('--i', String(i)));
    root.querySelectorAll<HTMLElement>('.badge').forEach((e, i) => e.style.setProperty('--i', String(i)));
    root.classList.remove('enter');
    void root.offsetWidth;
    root.classList.add('enter');
    clearTimeout(enterTimer);
    enterTimer = window.setTimeout(() => root.classList.remove('enter'), 1600);
  }

  // coins: count up from what the player saw last
  const pill = root.querySelector<HTMLElement>('.coins-pill span');
  if (pill) {
    const target = Number(pill.textContent) || 0;
    if (shownCoins !== null && shownCoins !== target && !reduced()) countUp(pill, shownCoins, target);
    shownCoins = target;
  }
}

function countUp(el: HTMLElement, from: number, to: number) {
  const pill = el.closest<HTMLElement>('.coins-pill');
  const t0 = performance.now();
  const dur = Math.min(1400, 500 + Math.abs(to - from) * 2);
  el.textContent = String(from);
  const step = (now: number) => {
    if (!el.isConnected) return;
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 4);
    el.textContent = String(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
    else if (pill) {
      pill.classList.remove('bump');
      void pill.offsetWidth;
      pill.classList.add('bump');
    }
  };
  setTimeout(() => requestAnimationFrame(step), 350);
}

// ------------------------------------------------------------------ pointer effects (delegated, rAF-throttled)
let pending: PointerEvent | null = null;
let tilted: HTMLElement | null = null;

function untilt() {
  if (!tilted) return;
  tilted.classList.remove('tilting');
  tilted.style.setProperty('--rx', '0deg');
  tilted.style.setProperty('--ry', '0deg');
  tilted = null;
}

function onMove() {
  const e = pending;
  pending = null;
  if (!e) return;
  const target = e.target as Element | null;
  // light that follows the pointer on hub tiles
  const tile = target?.closest?.<HTMLElement>('#ui .tile') ?? null;
  if (tile) {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    tile.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  }
  // 3D tilt on player cards
  const card = target?.closest?.<HTMLElement>('#ui .pcard') ?? null;
  if (card !== tilted) untilt();
  if (!card || reduced()) return;
  const r = card.getBoundingClientRect();
  const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  const max = 16;
  card.classList.add('tilting');
  card.style.setProperty('--ry', `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
  card.style.setProperty('--rx', `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
  card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
  card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  card.style.setProperty('--hx', `${(px * 100).toFixed(1)}%`);
  card.style.setProperty('--hy', `${(py * 100).toFixed(1)}%`);
  tilted = card;
}

const RIPPLE = '#ui .tile, #ui .btn, #ui .icon-btn, #ui .club-chip, #ui .crate-card, #ui .mk-tile, #ui .tab, #ui .diff-card, #ui .team-card';

function ripple(e: PointerEvent) {
  if (reduced()) return;
  const host = (e.target as Element | null)?.closest?.<HTMLElement>(RIPPLE);
  if (!host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const r = host.getBoundingClientRect();
  const layer = document.createElement('span');
  layer.className = 'rip-host';
  const dot = document.createElement('i');
  dot.style.left = `${e.clientX - r.left}px`;
  dot.style.top = `${e.clientY - r.top}px`;
  dot.style.setProperty('--rs', String(Math.ceil((Math.hypot(r.width, r.height) * 2) / 20)));
  layer.appendChild(dot);
  host.appendChild(layer);
  setTimeout(() => layer.remove(), 650);
}

let installed = false;
export function installMotion() {
  if (installed) return;
  installed = true;
  document.addEventListener('pointermove', (e) => {
    if (!pending) requestAnimationFrame(onMove);
    pending = e;
  }, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    pending = e;
    onMove();
    ripple(e);
  }, { passive: true });
  document.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') untilt(); }, { passive: true });
  document.addEventListener('pointercancel', untilt, { passive: true });
  document.documentElement.addEventListener('pointerleave', untilt, { passive: true });
}
