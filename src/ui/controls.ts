/** Touch controls editor: drag the buttons and the joystick, resize them, save. */
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { settings, saveSettings } from '../engine/storage';
import { activeInput } from '../engine/input';
import { setScreen, bind, ui, MenuHandlers } from './common';

type Ctl = { id: string; x: number; y: number; r: number; base: number };
const MIN_S = 0.6, MAX_S = 1.8;

export function showControls(h: MenuHandlers, back: () => void) {
  const L = t();
  const inp = activeInput;
  if (!inp) return back();
  const k = inp.k;
  const C = settings.ctrl;
  const labels: Record<string, string> = { a: L.shoot, b: L.pass, c: L.sprint, d: L.spin, e: L.itemBtn, joy: L.joystick };
  const ctls: Ctl[] = inp.layout.map((b) => ({ id: b.id, x: b.x * k, y: b.y * k, r: b.r * k * 1.02, base: (b.r * k * 1.02) / (C?.[b.id]?.s ?? 1) }));
  const jh = inp.joyHome;
  const jr = inp.joyR * k;
  ctls.push({ id: 'joy', x: jh.x * k, y: jh.y * k, r: jr, base: jr / (C?.joy?.s ?? 1) });
  let sel: Ctl | null = null;

  setScreen(
    'screen-controls',
    `<div class="ctl-stage">
      <div class="ctl-bar">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
        <div class="ctl-title"><b>${L.editControls}</b><small>${L.editControlsHint}</small></div>
        <div class="ctl-size"><button class="btn btn-ghost btn-sm" data-sz="-1">−</button><span id="ctl-sel">—</span><button class="btn btn-ghost btn-sm" data-sz="1">+</button></div>
        <button class="btn btn-ghost btn-sm" data-act="reset">${L.resetLayout}</button>
        <button class="btn btn-primary btn-sm" data-act="save">${L.save}</button>
      </div>
      ${ctls.map((c) => `<div class="ctl ${c.id === 'joy' ? 'ctl-joy' : 'ctl-btn k-' + c.id}" data-ctl="${c.id}"><i></i><span>${labels[c.id]}</span></div>`).join('')}
    </div>`,
  );
  const stage = ui().querySelector<HTMLElement>('.ctl-stage')!;
  const place = (c: Ctl) => {
    const el = stage.querySelector<HTMLElement>(`[data-ctl="${c.id}"]`)!;
    c.r = Math.max(c.base * MIN_S, Math.min(c.base * MAX_S, c.r));
    c.x = Math.max(c.r, Math.min(innerWidth - c.r, c.x));
    c.y = Math.max(c.r + 40, Math.min(innerHeight - c.r, c.y));
    el.style.left = `${c.x - c.r}px`;
    el.style.top = `${c.y - c.r}px`;
    el.style.width = el.style.height = `${c.r * 2}px`;
    el.style.setProperty('--fs', `${Math.max(9, c.r * 0.32)}px`);
  };
  const select = (c: Ctl | null) => {
    sel = c;
    stage.querySelectorAll<HTMLElement>('[data-ctl]').forEach((e) => e.classList.toggle('sel', !!c && e.dataset.ctl === c.id));
    document.getElementById('ctl-sel')!.textContent = c ? `${labels[c.id]} ${Math.round((c.r / c.base) * 100)}%` : '—';
  };
  ctls.forEach(place);

  // dragging
  stage.querySelectorAll<HTMLElement>('[data-ctl]').forEach((el) => {
    const c = ctls.find((x) => x.id === el.dataset.ctl)!;
    let ox = 0, oy = 0, id = -1;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      id = e.pointerId;
      el.setPointerCapture(id);
      ox = e.clientX - c.x;
      oy = e.clientY - c.y;
      el.classList.add('drag');
      select(c);
      audio.click();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      c.x = e.clientX - ox;
      c.y = e.clientY - oy;
      place(c);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      el.classList.remove('drag');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });

  bind('[data-sz]', (b) => {
    if (!sel) return;
    sel.r *= Number(b.dataset.sz) > 0 ? 1.1 : 1 / 1.1;
    place(sel);
    select(sel);
    audio.click();
  });
  bind('[data-act=back]', () => { audio.click(); back(); });
  bind('[data-act=reset]', () => {
    settings.ctrl = null;
    saveSettings();
    h.settingsChanged('ctrl');
    audio.select();
    showControls(h, back);
  });
  bind('[data-act=save]', () => {
    const out: NonNullable<typeof settings.ctrl> = {};
    for (const c of ctls) out[c.id] = { x: c.x / innerWidth, y: c.y / innerHeight, s: c.r / c.base };
    settings.ctrl = out;
    saveSettings();
    h.settingsChanged('ctrl');
    audio.select();
    back();
  });
}
