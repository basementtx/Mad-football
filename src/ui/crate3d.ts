/**
 * 3D loot crate built from CSS 3D transforms: a body (5 outer faces + a glowing
 * interior) and a hinged lid, every face textured with pixel art. Used in the
 * shop, on the hub tile and in the opening sequence.
 */
import { crateTexture, CrateKind, CrateFace } from '../pixel/crate';

let styled = false;
function ensureStyles() {
  if (styled) return;
  styled = true;
  const faces: [string, CrateFace][] = [
    ['.f-front, .f-back', 'front'], ['.f-left, .f-right', 'side'], ['.f-bottom', 'bottom'],
    ['.l-front, .l-back', 'lidFront'], ['.l-left, .l-right', 'lidSide'], ['.l-top', 'lidTop'], ['.f-in, .l-under', 'inside'],
  ];
  let css = '';
  for (const k of ['basic', 'premium', 'legend'] as CrateKind[])
    for (const [sel, f] of faces)
      css += sel.split(', ').map((s) => `.c3d.k-${k} ${s}`).join(', ') + `{background-image:url(${crateTexture(k, f)})}\n`;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
}

/** HTML for a 3D crate. `size` is the crate width in CSS px (any CSS length works). */
export function crate3D(kind: CrateKind, size = '120px', cls = '') {
  ensureStyles();
  return `<div class="c3d k-${kind} ${cls}" style="--s:${size}">
    <div class="c3d-aura"></div>
    <div class="c3d-shadow"></div>
    <div class="c3d-float"><div class="c3d-rot">
      <div class="c3d-body">
        <i class="f f-front"></i><i class="f f-back"></i><i class="f f-left"></i><i class="f f-right"></i><i class="f f-bottom"></i><i class="f f-in"></i>
        <i class="c3d-light"></i>
      </div>
      <div class="c3d-lid">
        <i class="f l-front"></i><i class="f l-back"></i><i class="f l-left"></i><i class="f l-right"></i><i class="f l-top"></i><i class="f l-under"></i>
      </div>
    </div></div>
  </div>`;
}
