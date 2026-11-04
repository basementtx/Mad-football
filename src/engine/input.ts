import { clamp } from './math';
import { settings } from './storage';

export interface Button {
  down: boolean;
  pressed: boolean;
  released: boolean;
  held: number;
  /** swiped upward while held (touch) or lift key held (keyboard): cross / chip */
  flick: boolean;
}

const mkBtn = (): Button => ({ down: false, pressed: false, released: false, held: 0, flick: false });

/** Upward finger travel (virtual px) on a held button that counts as a swipe. */
const FLICK_PX = 11;

export type BtnId = 'a' | 'b' | 'c' | 'd';

export interface BtnLayout {
  id: BtnId;
  x: number;
  y: number;
  r: number;
}

export interface Insets { top: number; right: number; bottom: number; left: number }

/**
 * Unified input: virtual joystick + 4 action buttons for touch, keyboard for desktop.
 * a = shoot/tackle, b = pass/switch, c = sprint, d = spin/power
 */
export class Input {
  mx = 0;
  my = 0;
  btn: Record<BtnId, Button> = { a: mkBtn(), b: mkBtn(), c: mkBtn(), d: mkBtn() };
  touchMode = false;
  enabled = true;

  // joystick state (css px)
  joyActive = false;
  joyId = -1;
  joyOX = 0;
  joyOY = 0;
  joyX = 0;
  joyY = 0;
  readonly joyR = 24;
  /** css pixels per virtual pixel */
  k = 1;

  layout: BtnLayout[] = [];
  pauseRect = { x: 0, y: 0, w: 0, h: 0 };
  W = 0;
  H = 0;
  insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  onPause: (() => void) | null = null;

  private ptrBtn = new Map<number, BtnId>();
  private ptrStart = new Map<number, { x: number; y: number }>();
  private keys = new Set<string>();

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    el.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e));
    el.addEventListener('lostpointercapture', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.reset());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** W/H/insets are in virtual (framebuffer) pixels */
  resize(W: number, H: number, insets: Insets) {
    this.W = W;
    this.H = H;
    this.insets = insets;
    const right = W - insets.right - 8;
    const bottom = H - Math.max(insets.bottom, 3) - 6;
    let L: BtnLayout[] = [
      { id: 'a', x: right - 24, y: bottom - 26, r: 21 },
      { id: 'b', x: right - 70, y: bottom - 15, r: 16 },
      { id: 'd', x: right - 64, y: bottom - 58, r: 15 },
      { id: 'c', x: right - 19, y: bottom - 76, r: 15 },
    ];
    if (settings.leftHanded) L = L.map((b) => ({ ...b, x: W - b.x }));
    this.layout = L;
    const ps = 16;
    const top = Math.max(insets.top, 3) + 4;
    this.pauseRect = settings.leftHanded ? { x: W - insets.right - 6 - ps, y: top, w: ps, h: ps } : { x: insets.left + 6, y: top, w: ps, h: ps };
  }

  get joyHome() {
    const x = this.insets.left + 46;
    return { x: settings.leftHanded ? this.W - x : x, y: this.H - Math.max(this.insets.bottom, 3) - 42 };
  }

  private isJoySide(x: number) {
    return settings.leftHanded ? x > this.W * 0.55 : x < this.W * 0.45;
  }

  private onDown(e: PointerEvent) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') this.touchMode = true;
    if (e.pointerType === 'mouse' && !this.touchMode) return; // desktop uses keyboard; mouse handled by UI
    e.preventDefault();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const x = e.clientX / this.k, y = e.clientY / this.k;
    const pr = this.pauseRect;
    if (x >= pr.x - 6 && x <= pr.x + pr.w + 6 && y >= pr.y - 6 && y <= pr.y + pr.h + 6) {
      this.onPause?.();
      return;
    }
    // buttons (generous hit area)
    let best: BtnLayout | null = null;
    let bd = Infinity;
    for (const b of this.layout) {
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < b.r * 1.35 && d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best) {
      this.ptrBtn.set(e.pointerId, best.id);
      this.ptrStart.set(e.pointerId, { x, y });
      this.press(best.id);
      return;
    }
    if (!this.joyActive && this.isJoySide(x)) {
      this.joyActive = true;
      this.joyId = e.pointerId;
      const home = this.joyHome;
      this.joyOX = settings.joyFixed ? home.x : x;
      this.joyOY = settings.joyFixed ? home.y : y;
      this.joyX = x;
      this.joyY = y;
      this.updateJoy();
    }
  }

  private onMove(e: PointerEvent) {
    const bid = this.ptrBtn.get(e.pointerId);
    if (bid) {
      // swipe up on a held button
      const st = this.ptrStart.get(e.pointerId)!;
      const x = e.clientX / this.k, y = e.clientY / this.k;
      const up = st.y - y, side = Math.abs(x - st.x);
      if (up > FLICK_PX && up > side * 0.8) this.btn[bid].flick = true;
      else if (up < FLICK_PX * 0.4) this.btn[bid].flick = false;
      e.preventDefault();
      return;
    }
    if (e.pointerId === this.joyId && this.joyActive) {
      e.preventDefault();
      this.joyX = e.clientX / this.k;
      this.joyY = e.clientY / this.k;
      // drag the origin along if finger goes too far (floating joystick)
      const dx = this.joyX - this.joyOX, dy = this.joyY - this.joyOY;
      const d = Math.hypot(dx, dy);
      const max = this.joyR * 1.25;
      if (d > max && !settings.joyFixed) {
        this.joyOX = this.joyX - (dx / d) * max;
        this.joyOY = this.joyY - (dy / d) * max;
      }
      this.updateJoy();
    }
  }

  private onUp(e: PointerEvent) {
    if (e.pointerId === this.joyId) {
      this.joyActive = false;
      this.joyId = -1;
      this.mx = 0;
      this.my = 0;
    }
    const id = this.ptrBtn.get(e.pointerId);
    if (id) {
      this.ptrBtn.delete(e.pointerId);
      this.ptrStart.delete(e.pointerId);
      this.release(id);
    }
  }

  private updateJoy() {
    const dx = this.joyX - this.joyOX, dy = this.joyY - this.joyOY;
    const d = Math.hypot(dx, dy);
    const dead = 3;
    if (d < dead) {
      this.mx = 0;
      this.my = 0;
      return;
    }
    const m = clamp((d - dead) / (this.joyR - dead), 0, 1);
    // snap to full speed quickly - arcade feel
    const mag = Math.min(1, m * 1.4);
    this.mx = (dx / d) * mag;
    this.my = (dy / d) * mag;
  }

  private press(id: BtnId) {
    const b = this.btn[id];
    if (!b.down) {
      b.down = true;
      b.pressed = true;
      b.held = 0;
      b.flick = this.keys.has('KeyQ') || this.keys.has('KeyU');
    }
  }

  private release(id: BtnId) {
    const b = this.btn[id];
    if (b.down) {
      b.down = false;
      b.released = true;
    }
  }

  private static KEYMAP: Record<string, BtnId> = {
    KeyJ: 'a', Space: 'a', KeyZ: 'a',
    KeyK: 'b', KeyX: 'b',
    ShiftLeft: 'c', ShiftRight: 'c', KeyL: 'c',
    KeyI: 'd', KeyE: 'd', KeyC: 'd',
  };

  private onKey(e: KeyboardEvent, down: boolean) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (down) this.onPause?.();
      return;
    }
    if (e.code === 'KeyQ' || e.code === 'KeyU') {
      // keyboard "lift" modifier: hold it while shooting / passing for a chip / cross
      if (this.enabled) e.preventDefault();
      if (down) this.keys.add(e.code);
      else this.keys.delete(e.code);
      if (down) for (const k of ['a', 'b'] as BtnId[]) if (this.btn[k].down) this.btn[k].flick = true;
      return;
    }
    const id = Input.KEYMAP[e.code];
    const isMove = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code);
    if (!id && !isMove) return;
    if (this.enabled) e.preventDefault();
    if (e.repeat) return;
    if (down) {
      this.keys.add(e.code);
      if (id) this.press(id);
    } else {
      this.keys.delete(e.code);
      if (id) this.release(id);
    }
    if (isMove) this.updateKeysMove();
  }

  private updateKeysMove() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    const l = Math.hypot(x, y);
    this.mx = l ? x / l : 0;
    this.my = l ? y / l : 0;
  }

  /** Called after each simulation step: clears edge flags. */
  consume(dt: number) {
    for (const id of ['a', 'b', 'c', 'd'] as BtnId[]) {
      const b = this.btn[id];
      b.pressed = false;
      b.released = false;
      if (b.down) b.held += dt;
    }
  }

  reset() {
    for (const id of ['a', 'b', 'c', 'd'] as BtnId[]) this.btn[id] = mkBtn();
    this.keys.clear();
    this.ptrBtn.clear();
    this.ptrStart.clear();
    this.joyActive = false;
    this.joyId = -1;
    this.mx = 0;
    this.my = 0;
  }
}
