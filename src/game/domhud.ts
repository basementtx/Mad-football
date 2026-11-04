/**
 * In-match HUD as a DOM layer over the pixel canvas, in the "Dossier" style
 * (Cake HUD Blueprint): paper / ink / one yellow marker, Oswald + Roboto Condensed,
 * hard-edged flat shapes. Always-on info is see-through (paper text with a hard ink
 * drop shadow over soft corner scrims); keys, the active item slot and short-lived
 * cards (toasts, the goal slab) are solid.
 *
 * Purely visual: pointer-events are off, the canvas Input still handles touches.
 */
import type { Game } from './game';
import type { Input, BtnId } from '../engine/input';
import type { BtnLabel } from './hud';
import type { Banner } from './fx';
import { GK_HOLD } from './match';
import { t } from '../engine/i18n';
import { itemById, itemName, ROMAN, TIER_COLOR } from '../meta/items';
import { itemIcon } from '../pixel/icons';
import { crestCanvas } from '../pixel/crest';
import { esc } from '../ui/common';

const IDS: BtnId[] = ['a', 'b', 'c', 'd', 'e'];

/** Stroke icons for the round touch keys (24x24, currentColor). */
const ICONS: Record<string, string> = {
  shoot: '<circle cx="15" cy="12" r="6"/><path d="M15 6l-2 4 3 3 3-2M3 9h5M2 13h6M4 17h5"/>',
  pass: '<path d="M3 12h15M12 6l6 6-6 6"/><circle cx="4" cy="12" r="1.2"/>',
  switch: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  slide: '<path d="M5 5l9 9M14 7v7H7"/><path d="M3 20h18" stroke-dasharray="3 3"/>',
  shove: '<path d="M3 12h10M9 7l5 5-5 5"/><path d="M18 4v16"/>',
  header: '<circle cx="9" cy="15" r="5"/><circle cx="17" cy="6" r="3"/><path d="M12 10l2-2"/>',
  sprint: '<path d="M13 2L5 13.5h6L10 22l9-12h-6.5z"/>',
  spin: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3.5v5h-5"/>',
  punt: '<path d="M4 19C7 10 13 7 20 8"/><path d="M16 4l4 4-4 4"/><circle cx="5" cy="19" r="1.5"/>',
  throw: '<path d="M5 20c1-7 6-12 14-13"/><path d="M15 3.5l4 3.5-3.5 4"/><path d="M3 15l3 2"/>',
};
const svg = (id: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] ?? ''}</svg>`;
const RING_C = 2 * Math.PI * 46;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

/** Only touch the DOM when a value really changed. */
function setText(e: HTMLElement, v: string) {
  if (e.textContent !== v) e.textContent = v;
}
function setCls(e: HTMLElement, cls: string, on: boolean) {
  if (e.classList.contains(cls) !== on) e.classList.toggle(cls, on);
}
function setStyle(e: HTMLElement, k: string, v: string) {
  if (e.style.getPropertyValue(k) !== v) e.style.setProperty(k, v);
}

function paintIcon(c: HTMLCanvasElement, id: string | null) {
  if (c.dataset.id === (id ?? '')) return;
  c.dataset.id = id ?? '';
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  const it = id ? itemById(id) : null;
  if (!it) return;
  g.imageSmoothingEnabled = false;
  g.drawImage(itemIcon(it.id, it.type, it.color), 0, 0);
}

export class DomHud {
  root: HTMLElement;
  private me: HTMLElement;
  private meKick: HTMLElement;
  private meName: HTMLElement;
  private meItem: HTMLElement;
  private meItemIcon: HTMLCanvasElement;
  private meItemName: HTMLElement;
  private meItemTier: HTMLElement;
  private score: HTMLElement;
  private sides: { name: HTMLElement; num: HTMLElement; bar: HTMLElement; icon: HTMLCanvasElement; chip: HTMLElement }[] = [];
  private clock: HTMLElement;
  private toasts: HTMLElement;
  private center: HTMLElement;
  private banners = new Map<Banner, HTMLElement>();
  private joy: HTMLElement;
  private knob: HTMLElement;
  private keys = new Map<BtnId, { box: HTMLElement; prog: SVGCircleElement; ico: HTMLElement; label: HTMLElement; icon: HTMLCanvasElement; tier: HTMLElement }>();
  private over: HTMLElement;
  private pause: HTMLElement;
  private hints: HTMLElement;
  private replay: HTMLElement;
  private lastScore = [-1, -1];

  constructor(host: HTMLElement) {
    this.root = el('div', 'dhud');
    host.appendChild(this.root);
    const R = this.root;
    el('div', 'scrim s-tl', R);
    el('div', 'scrim s-tc', R);
    el('div', 'scrim s-br', R);
    el('div', 'scrim s-bl', R);

    // pause key (top corner; the canvas Input owns the hit area)
    this.pause = el('div', 'dkey dpause', R, '<i></i><i></i>');

    // me: controlled player, stamina / keeper timer, held item
    this.me = el('section', 'dme', R);
    this.meKick = el('div', 'kick sh', this.me);
    this.meName = el('div', 'title sh', this.me);
    this.meItem = el('div', 'ditem', this.me);
    this.meItemIcon = el('canvas', 'pix', this.meItem);
    this.meItemIcon.width = this.meItemIcon.height = 13;
    const txt = el('div', 'ditem-t', this.meItem);
    this.meItemName = el('b', '', txt);
    this.meItemTier = el('small', '', txt);

    // score: see-through, team colour bars at the outer edges
    this.score = el('section', 'dscore', R);
    const line = el('div', 'dscore-line', this.score);
    for (let i = 0; i < 2; i++) {
      const side = el('div', 'dside ' + (i ? 'away' : 'home'), line);
      const bar = el('i', 'tbar', side);
      const chip = el('span', 'tchip', side);
      const icon = el('canvas', 'pix', chip);
      icon.width = icon.height = 13;
      const name = el('span', 'tname sh', side);
      const num = el('span', 'tnum sh', side);
      if (i === 0) side.append(bar, chip, name, num);
      else side.append(num, name, chip, bar);
      this.sides.push({ name, num, bar, icon, chip });
      if (i === 0) el('span', 'dash', line);
    }
    this.clock = el('div', 'dclock sh', this.score);

    this.toasts = el('div', 'dtoasts', R);
    this.center = el('div', 'dcenter', R);
    this.replay = el('div', 'dreplay', R, '<i></i><b></b><span></span>');

    // joystick + keys
    this.joy = el('div', 'djoy', R);
    this.knob = el('div', 'djoy-knob', this.joy);
    for (const id of IDS) {
      // round key: progress ring (charge) around a glossy disc with icon + label
      const box = el('div', 'dbtn k-' + id, R);
      box.innerHTML = `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="trk" cx="50" cy="50" r="46"/><circle class="prog" cx="50" cy="50" r="46" stroke-dasharray="${RING_C} ${RING_C}" stroke-dashoffset="${RING_C}"/></svg>`;
      const prog = box.querySelector<SVGCircleElement>('.prog')!;
      const face = el('div', 'face', box);
      const ico = el('div', 'ico', face);
      const icon = el('canvas', 'pix', face);
      icon.width = icon.height = 13;
      const label = el('span', 'lbl', face);
      const tier = el('small', 'tier', box);
      this.keys.set(id, { box, prog, ico, label, icon, tier });
    }
    this.hints = el('div', 'dhints', R);
    // status above the controlled player's head (stamina, charge, keeper clock, effects)
    this.over = el('div', 'dover', R);
  }

  /** Status chips that float above the controlled player's head. */
  private updateOverhead(game: Game, k: number, time: number) {
    const m = game.match;
    const h = m.human;
    const L = t();
    const show = !!h && (m.phase === 'play' || m.phase === 'kickoff') && !m.replaying;
    const x = h ? game.cam.sx(h.x) : 0, y = h ? game.cam.sy(h.y, h.z) : 0;
    const on = show && x > 0 && x < game.cam.W && y > 30 && y < game.cam.H + 10;
    setCls(this.over, 'gone', !on);
    if (!on || !h) return;
    setStyle(this.over, 'transform', `translate(${(x * k).toFixed(1)}px, ${((y - 44) * k).toFixed(1)}px)`);
    const parts: string[] = [];
    const keeper = h.isGK && m.ball.owner === h;
    if (keeper) {
      const left = Math.max(0, GK_HOLD - h.holdT);
      const deg = Math.round((left / GK_HOLD) * 360);
      parts.push(`<div class="oclock ${left < 2 ? 'warn' : ''}" style="--a:${deg}deg"><b>${left < 2 ? '!' : Math.ceil(left)}</b></div><div class="otag ${left < 2 ? 'warn' : ''}">${left < 2 ? L.holdBall : L.pos.GK}</div>`);
    } else {
      if (h.chargeKind !== 'none') {
        const shot = h.chargeKind === 'shot';
        const pct = Math.min(1, h.charge / (shot ? 1.3 : 1)) * 100;
        const mark = shot ? 100 / 1.3 : 28;
        const over = shot && h.charge > 1;
        const curl = shot && Math.abs(m.curl) > 0.15 ? `<span class="ocurl">${m.curl > 0 ? '↻' : '↺'} ${t().curve.replace('!', '')}</span>` : '';
        parts.push(`<div class="ocharge ${shot ? 'shot' : 'pass'} ${over ? 'over' : ''}"><i style="width:${pct.toFixed(0)}%"></i><s style="left:${mark.toFixed(0)}%"></s></div>${curl}`);
      }
      if (h.stamina < 0.985 || h.sprinting) {
        parts.push(`<div class="ostam ${h.exhausted ? 'tired' : ''} ${h.sprinting ? 'run' : ''}">${svg('sprint')}<div><i style="width:${(h.stamina * 100).toFixed(0)}%"></i></div></div>`);
      }
    }
    const fx: [string, number, number][] = [];
    if (h.turbo > 0) fx.push(['pw_turbo', h.turbo, 4]);
    if (h.magnet > 0) fx.push(['pw_magnet', h.magnet, 6]);
    for (const [id, left, max] of fx) {
      const it = itemById(id)!;
      parts.push(`<div class="oeff" style="--c:${it.color};--a:${Math.round((left / max) * 360)}deg"><b>${left.toFixed(1)}</b></div>`);
    }
    const html = parts.join('');
    if (this.over.dataset.h !== html) {
      this.over.dataset.h = html;
      this.over.innerHTML = html;
    }
    void time;
  }

  destroy() {
    this.root.remove();
  }

  update(game: Game, input: Input, labels: Record<BtnId, BtnLabel>, time: number) {
    const m = game.match;
    const L = t();
    const k = input.k;
    const replay = m.replaying;
    setCls(this.root, 'replaying', replay);
    setCls(this.root, 'touch', input.touchMode);

    // ---- replay chip
    if (replay) {
      const [h, a] = m.teams;
      setText(this.replay.querySelector('b')!, L.replay);
      setText(this.replay.querySelector('span')!, `${h.def.short} ${h.score}–${a.score} ${a.def.short}`);
    }

    // ---- score + clock
    m.teams.forEach((team, i) => {
      const s = this.sides[i];
      setText(s.name, team.def.short);
      setStyle(s.bar, 'background', team.def.primary);
      if (this.lastScore[i] !== team.score) {
        if (this.lastScore[i] >= 0) {
          s.num.classList.remove('pop');
          this.score.classList.remove('goal');
          void s.num.offsetWidth;
          s.num.classList.add('pop');
          this.score.classList.add('goal');
        }
        this.lastScore[i] = team.score;
        setText(s.num, String(team.score));
      }
      if (s.icon.dataset.team !== team.def.id) {
        s.icon.dataset.team = team.def.id;
        const cr = crestCanvas(team.def.crest, team.def.primary, team.def.secondary);
        s.icon.width = cr.width;
        s.icon.height = cr.height;
        const g = s.icon.getContext('2d')!;
        g.imageSmoothingEnabled = false;
        g.drawImage(cr, 0, 0);
      }
    });
    const c = Math.ceil(m.clock);
    setText(this.clock, `${Math.floor(c / 60)}:${(c % 60).toString().padStart(2, '0')}`);
    setCls(this.clock, 'urgent', c <= 10 && m.phase === 'play');

    // ---- me
    const h = m.human;
    const team = m.teams[0];
    setCls(this.me, 'gone', !h);
    if (h) {
      setText(this.meKick, `${h.isGK ? L.pos.GK : L.you} · #${h.number}`);
      setText(this.meName, (h.name ?? '').toUpperCase());
      const it = team.item ? itemById('pw_' + team.item) : null;
      const had = !this.meItem.classList.contains('empty');
      setCls(this.meItem, 'empty', !it);
      if (it && !had) {
        this.meItem.classList.remove('got');
        void this.meItem.offsetWidth;
        this.meItem.classList.add('got');
      }
      paintIcon(this.meItemIcon, it ? it.id : null);
      if (it) {
        const tier = team.tiers[team.item!] ?? 1;
        setText(this.meItemName, itemName(it).toUpperCase());
        setText(this.meItemTier, `${L.itemBtn} · ${ROMAN[tier - 1]}`);
        setStyle(this.meItem, '--tc', TIER_COLOR[tier - 1]);
      } else {
        setText(this.meItemName, L.itemBtn);
        setText(this.meItemTier, L.findBox);
      }
    }

    // ---- banners: countdown number, solid slab for big moments, toasts for the rest
    const alive = new Set(m.fx.banners);
    for (const [b, e] of this.banners) {
      if (!alive.has(b)) {
        e.classList.add('out');
        this.banners.delete(b);
        setTimeout(() => e.remove(), 200);
      }
    }
    for (const b of m.fx.banners) {
      if (this.banners.has(b)) continue;
      const short = b.text.length <= 2;
      let e: HTMLElement;
      // white accents vanish on paper: use ink instead
      const col = /^#f{3}(f{3})?$/i.test(b.color) ? '#15171C' : b.color;
      if (b.big && short) {
        e = el('div', 'dcount sh', this.center, esc(b.text));
      } else if (b.big) {
        e = el('div', 'dslab', this.center, `<i style="background:${col}"></i><b>${esc(b.text)}</b>${b.sub ? `<small>${esc(b.sub)}</small>` : ''}`);
      } else {
        e = el('div', 'dtoast', this.toasts, `<i style="background:${col}"></i><small>${L.itemBtn}</small><b>${esc(b.text)}</b>`);
      }
      this.banners.set(b, e);
    }

    // ---- pause key position
    const pr = input.pauseRect;
    setStyle(this.pause, 'left', `${pr.x * k}px`);
    setStyle(this.pause, 'top', `${pr.y * k}px`);
    setStyle(this.pause, 'width', `${pr.w * k}px`);
    setStyle(this.pause, 'height', `${pr.h * k}px`);
    // me panel sits beside the pause key
    const lefty = pr.x > input.W / 2;
    setCls(this.root, 'lefty', lefty);

    // ---- joystick
    const home = input.joyHome;
    const ox = (input.joyActive ? input.joyOX : home.x) * k, oy = (input.joyActive ? input.joyOY : home.y) * k;
    const R = input.joyR * k;
    setStyle(this.joy, 'left', `${ox - R}px`);
    setStyle(this.joy, 'top', `${oy - R}px`);
    setStyle(this.joy, 'width', `${R * 2}px`);
    setStyle(this.joy, 'height', `${R * 2}px`);
    setCls(this.joy, 'active', input.joyActive);
    setStyle(this.knob, 'transform', `translate(${(input.mx * R * 0.6).toFixed(1)}px, ${(input.my * R * 0.6).toFixed(1)}px)`);

    // ---- keys
    const hp = m.human;
    for (const b of input.layout) {
      const key = this.keys.get(b.id)!;
      const lab = labels[b.id];
      const st = input.btn[b.id];
      const size = b.r * 2 * k * 1.02;
      setStyle(key.box, 'left', `${b.x * k - size / 2}px`);
      setStyle(key.box, 'top', `${b.y * k - size / 2}px`);
      setStyle(key.box, 'width', `${size}px`);
      setStyle(key.box, 'height', `${size}px`);
      setStyle(key.box, '--fs', `${Math.max(8, size * (lab.text.length > 6 ? 0.13 : 0.16))}px`);
      setText(key.label, lab.text);
      const ic = lab.ic ?? '';
      if (key.ico.dataset.ic !== ic) {
        key.ico.dataset.ic = ic;
        key.ico.innerHTML = ic ? svg(ic) : '';
      }
      if (st.down && !key.box.classList.contains('down')) {
        // release-style flash ring on every press
        const ring = el('i', 'tap-ring', key.box);
        setTimeout(() => ring.remove(), 460);
      }
      setCls(key.box, 'down', st.down);
      setCls(key.box, 'dim', !!lab.dim);
      setCls(key.box, 'ready', !!lab.glow);
      // charge ring fills around the key while holding shot / pass
      let fill = 0;
      if (hp && (b.id === 'a' || b.id === 'b')) {
        const kind = b.id === 'a' ? 'shot' : 'pass';
        if (hp.chargeKind === kind) fill = Math.min(1, hp.charge / (kind === 'shot' ? 1.3 : 1));
      }
      if (b.id === 'c' && hp && !lab.dim) fill = hp.stamina;
      setStyle(key.prog as unknown as HTMLElement, 'stroke-dashoffset', `${(RING_C * (1 - fill)).toFixed(1)}`);
      setCls(key.box, 'charging', fill > 0 && b.id !== 'c');
      setCls(key.box, 'noprog', fill <= 0.001);
      setCls(key.box, 'over', b.id === 'a' && !!hp && hp.chargeKind === 'shot' && hp.charge > 1);
      setCls(key.box, 'tired', b.id === 'c' && !!hp && hp.exhausted);
      if (b.id === 'e') {
        const id = team.item ? 'pw_' + team.item : null;
        paintIcon(key.icon, id);
        setCls(key.box, 'has', !!id);
        const tier = lab.tier ?? 1;
        setText(key.tier, id && tier > 1 ? ROMAN[tier - 1] : '');
      }
    }

    this.updateOverhead(game, k, time);

    // ---- desktop key hints
    if (!input.touchMode) {
      const html = `<span><b>J</b>${esc(labels.a.text)}</span><span><b>K</b>${esc(labels.b.text)}</span><span><b class="w">SHIFT</b>${L.sprint}</span><span><b>I</b>${L.spin}</span><span><b>E</b>${L.itemBtn}</span>`;
      if (this.hints.dataset.h !== html) {
        this.hints.dataset.h = html;
        this.hints.innerHTML = html;
      }
    }
  }
}
