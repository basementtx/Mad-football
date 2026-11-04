/** Locked looks in the editors: price chip + "try it on, then buy" sheet. */
import { t } from '../engine/i18n';
import { audio, vibrate } from '../engine/audio';
import { CosKind, cosFor, unlocked, buyCosmetic, cosName, cosKindName } from '../meta/cosmetics';
import { RARITY_COLOR } from '../meta/items';
import { esc, paintAll, ui, coinTag, toast } from './common';

export const LOCK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7h1zm2 0h4V5a2 2 0 0 0-4 0v2z"/></svg>';

/** Small price chip for a locked option ('' when it is free / owned). */
export function lockTag(kind: CosKind, value: string | number) {
  const c = cosFor(kind, value);
  if (!c || unlocked(kind, value)) return '';
  return `<span class="lk" style="--rc:${RARITY_COLOR[c.rarity]}">${LOCK_SVG}${c.price}</span>`;
}
export const isLocked = (kind: CosKind, value: string | number) => !unlocked(kind, value);

/**
 * Ask to unlock a look the player is trying on. `preview` is HTML (may contain
 * paintTag canvases). onBuy runs after a successful purchase, onCancel otherwise.
 */
export function askUnlock(kind: CosKind, value: string | number, preview: string, onBuy: () => void, onCancel: () => void) {
  const L = t();
  const c = cosFor(kind, value);
  if (!c) return onBuy();
  document.querySelector('.unlock-modal')?.remove();
  const el = document.createElement('div');
  el.className = 'unlock-modal';
  el.innerHTML = `<div class="um-box" style="--rc:${RARITY_COLOR[c.rarity]}">
    <div class="um-kick">${esc(cosKindName(c))} · ${L.itemRarity[c.rarity]}</div>
    <div class="um-name">${esc(cosName(c))}</div>
    <div class="um-prev">${preview}</div>
    <div class="um-btns">
      <button class="btn btn-ghost" data-um="no">${L.back}</button>
      <button class="btn btn-primary" data-um="buy">${L.unlockFor} ${coinTag()} ${c.price}</button>
    </div>
  </div>`;
  ui().appendChild(el);
  paintAll(el);
  const close = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  };
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-um]');
    if (!b && e.target !== el) return;
    if (b?.dataset.um === 'buy') {
      if (!buyCosmetic(c.id)) {
        toast(L.notEnough);
        audio.groan();
        return;
      }
      audio.cheer(0.5);
      audio.select();
      vibrate(50);
      el.querySelector('.um-box')!.classList.add('bought');
      setTimeout(() => {
        close();
        onBuy();
      }, 520);
      return;
    }
    audio.click();
    close();
    onCancel();
  });
}
