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
import { esc } from '../ui/common';

const IDS: BtnId[] = ['a', 'b', 'c', 'd', 'e'];

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
  private meBarLabel: HTMLElement;
  private meBarVal: HTMLElement;
  private meBar: HTMLElement;
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
  private keys = new Map<BtnId, { box: HTMLElement; fill: HTMLElement; label: HTMLElement; icon: HTMLCanvasElement; tier: HTMLElement }>();
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
    const row = el('div', 'bar-row', this.me);
    this.meBarLabel = el('span', 'kick sh', row);
    this.meBarVal = el('span', 'val sh', row);
    this.meBar = el('i', '', el('div', 'dbar', this.me));
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
      const box = el('div', 'dkey dbtn k-' + id, R);
      const fill = el('i', 'fill', box);
      const icon = el('canvas', 'pix', box);
      icon.width = icon.height = 13;
      const label = el('span', 'lbl', box);
      const tier = el('small', 'tier', box);
      this.keys.set(id, { box, fill, label, icon, tier });
    }
    this.hints = el('div', 'dhints', R);
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
          void s.num.offsetWidth;
          s.num.classList.add('pop');
        }
        this.lastScore[i] = team.score;
        setText(s.num, String(team.score));
      }
      paintIcon(s.icon, team.item ? 'pw_' + team.item : null);
      setCls(s.chip, 'on', !!team.item);
    });
    const c = Math.ceil(m.clock);
    setText(this.clock, `${Math.floor(c / 60)}:${(c % 60).toString().padStart(2, '0')}`);
    setCls(this.clock, 'urgent', c <= 10 && m.phase === 'play');

    // ---- me
    const h = m.human;
    const team = m.teams[0];
    setCls(this.me, 'gone', !h);
    if (h) {
      const keeper = h.isGK && m.ball.owner === h;
      setText(this.meKick, `${h.isGK ? L.pos.GK : L.you} · #${h.number}`);
      setText(this.meName, (h.name ?? '').toUpperCase());
      if (keeper) {
        const left = Math.max(0, GK_HOLD - h.holdT);
        setText(this.meBarLabel, L.holdBall);
        setText(this.meBarVal, `${left.toFixed(1)}s`);
        setStyle(this.meBar, 'width', `${(left / GK_HOLD) * 100}%`);
        setCls(this.meBar, 'warn', left < 2);
      } else {
        setText(this.meBarLabel, L.sprint);
        setText(this.meBarVal, `${Math.round(h.stamina * 100)}%`);
        setStyle(this.meBar, 'width', `${h.stamina * 100}%`);
        setCls(this.meBar, 'warn', h.exhausted);
      }
      const it = team.item ? itemById('pw_' + team.item) : null;
      setCls(this.meItem, 'empty', !it);
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
      const size = b.r * 2 * k * 0.92;
      setStyle(key.box, 'left', `${b.x * k - size / 2}px`);
      setStyle(key.box, 'top', `${b.y * k - size / 2}px`);
      setStyle(key.box, 'width', `${size}px`);
      setStyle(key.box, 'height', `${size}px`);
      setStyle(key.box, '--fs', `${Math.max(9, size * (lab.text.length > 5 ? 0.2 : 0.25))}px`);
      setText(key.label, lab.text);
      setCls(key.box, 'down', st.down);
      setCls(key.box, 'dim', !!lab.dim);
      setCls(key.box, 'glow', !!lab.glow && Math.floor(time * 3) % 2 === 0);
      // holding: the marker fill rises with the charge
      let fill = 0;
      if (hp && (b.id === 'a' || b.id === 'b')) {
        const kind = b.id === 'a' ? 'shot' : 'pass';
        if (hp.chargeKind === kind) fill = Math.min(1, hp.charge / (kind === 'shot' ? 1.3 : 1));
      }
      if (b.id === 'c' && st.down) fill = hp ? hp.stamina : 0;
      setStyle(key.fill, 'height', `${Math.round(fill * 100)}%`);
      setCls(key.box, 'over', b.id === 'a' && !!hp && hp.chargeKind === 'shot' && hp.charge > 1);
      if (b.id === 'e') {
        const id = team.item ? 'pw_' + team.item : null;
        paintIcon(key.icon, id);
        setCls(key.box, 'has', !!id);
        const tier = lab.tier ?? 1;
        setText(key.tier, id && tier > 1 ? ROMAN[tier - 1] : '');
      }
    }

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
