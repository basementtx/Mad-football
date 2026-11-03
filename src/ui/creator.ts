/** Create / edit your own player: looks, position, number and skill points. */
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { profile, saveProfile, cardById, clubTeamDef, saveMyPlayer } from '../meta/profile';
import { CardData, Pos, SKINS, HAIRS, HAIR_STYLES, STAT_KEYS, StatKey, uid, overall } from '../meta/cards';
import { setScreen, bind, esc, paintTag, paintAll, spriteSource, lookFor, ui, MenuHandlers } from './common';
import { cardHTML } from './cards';
import { showHub } from './hub';

const BASE = 50;
const MAX = 90;
/** points to distribute on top of the base 50 in every stat */
export const CREATOR_POINTS = 110;

export function showCreator(h: MenuHandlers, first: boolean) {
  const L = t();
  const club = clubTeamDef()!;
  const existing = cardById(profile.myPlayer);
  const d: CardData = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id: uid(), name: 'Mad Striker', number: 10, pos: 'FWD', custom: true, look: { skin: SKINS[1], hair: HAIRS[1], hairStyle: 0, beard: false }, stats: { pac: 70, sho: 75, pas: 55, dri: 65, def: 45, phy: 60 } };
  d.custom = true;
  const spent = () => STAT_KEYS.reduce((a, k) => a + (d.stats[k] - BASE), 0);
  // existing players keep their stats valid even if base rules change
  if (spent() > CREATOR_POINTS) for (const k of STAT_KEYS) d.stats[k] = BASE + 10;

  setScreen(
    'screen-editor',
    `<div class="editor">
      <div class="panel-head">
        ${first ? '<div style="width:80px"></div>' : `<button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>`}
        <div class="panel-title">${existing ? L.editPlayerTitle : L.createPlayerTitle}</div>
        <button class="btn btn-primary btn-sm" data-act="save">${L.save}</button>
      </div>
      <div class="editor-body">
        <div class="cr-preview" id="cr-preview"></div>
        <div class="ce-form">
          <div class="ce-row"><label for="cr-name">${L.playerName}</label><input id="cr-name" maxlength="18" value="${esc(d.name)}"></div>
          <div class="ce-row"><label for="cr-num">${L.number}</label><input id="cr-num" type="number" min="1" max="99" value="${d.number}" class="short-in"></div>
          <div class="ce-row"><span>${L.position}</span><div class="opts">${(['GK', 'DEF', 'MID', 'FWD'] as Pos[]).map((p) => `<button class="opt-b ${d.pos === p ? 'on' : ''}" data-pos="${p}">${L.pos[p]}</button>`).join('')}</div></div>
          <div class="ce-row"><span>${L.skin}</span><div class="swatches">${SKINS.map((c) => `<button class="sw ${d.look.skin === c ? 'on' : ''}" data-skin="${c}" style="--c:${c}"></button>`).join('')}</div></div>
          <div class="ce-row"><span>${L.hairStyle}</span><div class="opts" id="cr-hair"></div></div>
          <div class="ce-row"><span>${L.hairColor}</span><div class="swatches">${HAIRS.map((c) => `<button class="sw ${d.look.hair === c ? 'on' : ''}" data-hc="${c}" style="--c:${c}"></button>`).join('')}</div></div>
          <div class="ce-row"><span>${L.beard}</span><button class="toggle ${d.look.beard ? 'on' : ''}" data-act="beard"><i></i></button></div>
          <div class="ce-row stats-head"><span>${L.pointsLeft}</span><b id="cr-pts"></b></div>
          ${STAT_KEYS.map((k) => `<div class="ce-row stat-row"><span>${L.stat[k]}</span><div class="stepper"><button data-dec="${k}">−</button><div class="st-bar"><i id="cr-bar-${k}"></i></div><b id="cr-v-${k}"></b><button data-inc="${k}">+</button></div></div>`).join('')}
        </div>
      </div>
    </div>`,
  );

  const renderPreview = () => {
    const el = document.getElementById('cr-preview')!;
    el.innerHTML = `${cardHTML(d, { club, size: 'lg' })}${paintTag(spriteSource(lookFor(club, d.look, d.pos === 'GK'), 'cel0'), 'kit')}`;
    paintAll(el);
    const hairs = document.getElementById('cr-hair')!;
    hairs.innerHTML = Array.from({ length: HAIR_STYLES }, (_, i) => `<button class="opt-c ${d.look.hairStyle === i ? 'on' : ''}" data-hs="${i}">${paintTag(() => {
      const src = spriteSource(lookFor(club, { ...d.look, hairStyle: i }), 'idle0', false, false)();
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 14;
      c.getContext('2d')!.drawImage(src, 13, 0, 16, 14, 0, 0, 16, 14);
      return c;
    }, 'hair-ic')}</button>`).join('');
    paintAll(hairs);
    bind('[data-hs]', (b) => { d.look.hairStyle = Number(b.dataset.hs); audio.click(); renderPreview(); }, hairs);
    const left = CREATOR_POINTS - spent();
    document.getElementById('cr-pts')!.textContent = String(left);
    for (const k of STAT_KEYS) {
      document.getElementById(`cr-v-${k}`)!.textContent = String(d.stats[k]);
      (document.getElementById(`cr-bar-${k}`) as HTMLElement).style.width = `${d.stats[k]}%`;
    }
  };
  renderPreview();

  const nameIn = document.getElementById('cr-name') as HTMLInputElement;
  const numIn = document.getElementById('cr-num') as HTMLInputElement;
  for (const inp of [nameIn, numIn]) {
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    inp.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  nameIn.addEventListener('input', () => { d.name = nameIn.value.slice(0, 18); renderPreview(); });
  numIn.addEventListener('input', () => { d.number = Math.max(1, Math.min(99, Number(numIn.value) || 1)); renderPreview(); });
  bind('[data-pos]', (b) => { d.pos = b.dataset.pos as Pos; ui().querySelectorAll('[data-pos]').forEach((x) => x.classList.toggle('on', x === b)); audio.click(); renderPreview(); });
  bind('[data-skin]', (b) => { d.look.skin = b.dataset.skin!; ui().querySelectorAll('[data-skin]').forEach((x) => x.classList.toggle('on', x === b)); audio.click(); renderPreview(); });
  bind('[data-hc]', (b) => { d.look.hair = b.dataset.hc!; ui().querySelectorAll('[data-hc]').forEach((x) => x.classList.toggle('on', x === b)); audio.click(); renderPreview(); });
  bind('[data-act=beard]', (b) => { d.look.beard = !d.look.beard; b.classList.toggle('on', d.look.beard); audio.click(); renderPreview(); });
  const step = (k: StatKey, delta: number) => {
    const left = CREATOR_POINTS - spent();
    for (let i = 0; i < 5; i++) {
      if (delta > 0 && (CREATOR_POINTS - spent() <= 0 || d.stats[k] >= MAX)) break;
      if (delta < 0 && d.stats[k] <= BASE - 20) break;
      d.stats[k] += delta;
    }
    void left;
    audio.click();
    renderPreview();
  };
  bind('[data-inc]', (b) => step(b.dataset.inc as StatKey, 1));
  bind('[data-dec]', (b) => step(b.dataset.dec as StatKey, -1));
  bind('[data-act=back]', () => { audio.click(); showHub(h); });
  bind('[data-act=save]', () => {
    d.name = d.name.trim() || 'Mad Striker';
    saveMyPlayer(d);
    if (first) profile.starterCrate = true;
    saveProfile();
    audio.select();
    showHub(h);
    void overall;
  });
}
