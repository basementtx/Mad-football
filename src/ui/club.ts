/** Club editor (create / edit) and squad / lineup management. */
import { t } from '../engine/i18n';
import { audio } from '../engine/audio';
import { profile, saveProfile, Club, clubTeamDef, ensureStarterSquad, lineupCards, LINEUP_SLOTS, clubOverall, cardById } from '../meta/profile';
import { overall } from '../meta/cards';
import { CREST_SHAPES, ICON_IDS, crestCanvas } from '../pixel/crest';
import type { KitPattern, TeamDef } from '../game/teams';
import { TEAMS } from '../game/teams';
import { setScreen, bind, esc, paintTag, paintAll, crestTag, spriteSource, lookFor, ui, toast, MenuHandlers } from './common';
import { cardHTML } from './cards';
import { showHub } from './hub';
import { showCreator } from './creator';

export const SWATCHES = ['#e23a2e', '#ff7a1a', '#ffd23f', '#b6ff3b', '#21a85a', '#14b8a6', '#7fd3ff', '#2f7bff', '#13215e', '#6b3fd6', '#ff2fa0', '#ffffff', '#c8d0e0', '#6c7480', '#1b1b1f', '#7a3b12'];
const PATTERNS: KitPattern[] = ['solid', 'stripes', 'hoops', 'half', 'sash', 'chevron'];

function randomClub(): Club {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const primary = pick(SWATCHES);
  let secondary = pick(SWATCHES);
  while (secondary === primary) secondary = pick(SWATCHES);
  return {
    name: pick(['Pixel', 'Chaos', 'Brawl', 'Rocket', 'Storm', 'Wild', 'Iron', 'Night']) + ' ' + pick(['FC', 'United', 'City', 'Rovers', 'Athletic']),
    short: 'MAD',
    primary, secondary, shorts: secondary, socks: primary,
    gk: '#ffcc2a',
    pattern: pick(PATTERNS),
    crest: { shape: Math.floor(Math.random() * CREST_SHAPES), icon: pick(ICON_IDS) },
  };
}

function asTeam(c: Club): TeamDef {
  return { ...TEAMS[0], id: 'club', name: c.name, short: c.short, primary: c.primary, secondary: c.secondary, shorts: c.shorts, socks: c.socks, gk: c.gk, pattern: c.pattern, crest: c.crest };
}

export function showClubEditor(h: MenuHandlers, first: boolean) {
  const L = t();
  const d: Club = profile.club ? { ...profile.club, crest: { ...profile.club.crest } } : randomClub();
  const swatchRow = (key: 'primary' | 'secondary' | 'shorts' | 'socks') =>
    `<div class="ce-row"><span>${({ primary: L.primaryC, secondary: L.secondaryC, shorts: L.shortsC, socks: L.socksC })[key]}</span><div class="swatches">${SWATCHES.map(
      (c) => `<button class="sw ${d[key] === c ? 'on' : ''}" data-col="${key}" data-v="${c}" style="--c:${c}"></button>`,
    ).join('')}</div></div>`;
  setScreen(
    'screen-editor',
    `<div class="editor">
      <div class="panel-head">
        ${first ? '<div style="width:80px"></div>' : `<button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>`}
        <div class="panel-title">${first ? L.createClubTitle : L.editClub}</div>
        <button class="btn btn-primary btn-sm" data-act="save">${first ? L.next + ' ▶' : L.save}</button>
      </div>
      ${first ? `<div class="hint">${L.welcome}</div>` : ''}
      <div class="editor-body">
        <div class="ce-preview" id="ce-preview"></div>
        <div class="ce-form">
          <div class="ce-row"><label for="ce-name">${L.clubName}</label><input id="ce-name" maxlength="18" value="${esc(d.name)}"></div>
          <div class="ce-row"><label for="ce-short">${L.shortName}</label><input id="ce-short" maxlength="3" value="${esc(d.short)}" class="short-in"></div>
          ${swatchRow('primary')}${swatchRow('secondary')}${swatchRow('shorts')}${swatchRow('socks')}
          <div class="ce-row"><span>${L.pattern}</span><div class="opts" id="ce-pat">${PATTERNS.map((p) => `<button class="opt-b ${d.pattern === p ? 'on' : ''}" data-pat="${p}">${p.toUpperCase()}</button>`).join('')}</div></div>
          <div class="ce-row"><span>${L.crestShape}</span><div class="opts" id="ce-shape"></div></div>
          <div class="ce-row"><span>${L.crestIcon}</span><div class="opts" id="ce-icon"></div></div>
        </div>
      </div>
    </div>`,
  );
  const renderPreview = () => {
    const team = asTeam(d);
    const el = document.getElementById('ce-preview')!;
    el.innerHTML = `${crestTag(team, 'crest-xl')}
      <div class="ce-kits">${paintTag(spriteSource(lookFor(team, { skin: '#e5b48f', hair: '#3b2416', hairStyle: 0, beard: false }), 'idle0'), 'kit')}${paintTag(spriteSource(lookFor(team, { skin: '#7a4d30', hair: '#1a1310', hairStyle: 2, beard: false }), 'run2', true), 'kit')}</div>
      <div class="ce-name">${esc(d.name || '...')} <small>${esc(d.short)}</small></div>`;
    paintAll(el);
    const shapes = document.getElementById('ce-shape')!;
    shapes.innerHTML = Array.from({ length: CREST_SHAPES }, (_, i) => `<button class="opt-c ${d.crest.shape === i ? 'on' : ''}" data-shape="${i}">${paintTag(() => crestCanvas({ shape: i, icon: d.crest.icon }, d.primary, d.secondary), 'crest-sm')}</button>`).join('');
    const icons = document.getElementById('ce-icon')!;
    icons.innerHTML = ICON_IDS.map((ic) => `<button class="opt-c ${d.crest.icon === ic ? 'on' : ''}" data-icon="${ic}">${paintTag(() => crestCanvas({ shape: d.crest.shape, icon: ic }, d.primary, d.secondary), 'crest-sm')}</button>`).join('');
    paintAll(shapes);
    paintAll(icons);
    bind('[data-shape]', (b) => { d.crest.shape = Number(b.dataset.shape); audio.click(); renderPreview(); }, shapes);
    bind('[data-icon]', (b) => { d.crest.icon = b.dataset.icon!; audio.click(); renderPreview(); }, icons);
  };
  renderPreview();
  const nameIn = document.getElementById('ce-name') as HTMLInputElement;
  const shortIn = document.getElementById('ce-short') as HTMLInputElement;
  nameIn.addEventListener('input', () => {
    d.name = nameIn.value.slice(0, 18);
    if (!shortIn.dataset.touched) {
      d.short = d.name.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9]/g, '').slice(0, 3).toLocaleUpperCase('tr-TR') || 'MAD';
      shortIn.value = d.short;
    }
    renderPreview();
  });
  shortIn.addEventListener('input', () => {
    shortIn.dataset.touched = '1';
    d.short = shortIn.value.toLocaleUpperCase('tr-TR').slice(0, 3);
    shortIn.value = d.short;
    renderPreview();
  });
  for (const inp of [nameIn, shortIn]) {
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    inp.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  bind('[data-col]', (b) => {
    const key = b.dataset.col as 'primary' | 'secondary' | 'shorts' | 'socks';
    d[key] = b.dataset.v!;
    ui().querySelectorAll(`[data-col=${key}]`).forEach((x) => x.classList.toggle('on', x === b));
    d.gk = ['#ffd23f', '#ffcc2a', '#b6ff3b'].includes(d.primary) ? '#3fe0a0' : '#ffcc2a';
    audio.click();
    renderPreview();
  });
  bind('[data-pat]', (b) => {
    d.pattern = b.dataset.pat as KitPattern;
    ui().querySelectorAll('[data-pat]').forEach((x) => x.classList.toggle('on', x === b));
    audio.click();
    renderPreview();
  });
  bind('[data-act=back]', () => { audio.click(); showSquad(h); });
  bind('[data-act=save]', () => {
    d.name = d.name.trim() || 'Mad FC';
    d.short = (d.short.trim() || 'MAD').padEnd(3, 'X').slice(0, 3);
    profile.club = d;
    ensureStarterSquad();
    saveProfile();
    audio.select();
    if (first) showCreator(h, true);
    else showSquad(h);
  });
}

export function showSquad(h: MenuHandlers) {
  const L = t();
  const club = clubTeamDef()!;
  let sel: number | null = null;
  const render = () => {
    const lineup = lineupCards();
    const inLineup = new Set(profile.lineup);
    const reserves = profile.cards.filter((c) => !inLineup.has(c.id)).sort((a, b) => overall(b) - overall(a));
    setScreen(
      'screen-squad',
      `<div class="squad">
        <div class="panel-head">
          <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L.back}</button>
          <div class="squad-title">${crestTag(club, 'crest-sm')}<span>${esc(club.name)}</span><small>${L.ovr} ${clubOverall()}</small></div>
          <button class="btn btn-ghost btn-sm" data-act="edit">${L.editClub}</button>
        </div>
        <div class="sec-label">${L.lineup} <small>${L.slotsHint}</small></div>
        <div class="lineup">
          ${Array.from({ length: LINEUP_SLOTS }, (_, i) => {
            const c = lineup[i];
            return `<div class="slot ${sel === i ? 'sel' : ''}" data-slot="${i}"><div class="slot-n">${i + 1}</div>${c ? cardHTML(c, { club, size: 'md', selected: sel === i }) : '<div class="empty-slot">+</div>'}</div>`;
          }).join('')}
        </div>
        <div class="sec-label">${L.reserves} <small>${sel !== null ? L.tapSlot : ''}</small></div>
        <div class="reserves">${reserves.map((c) => `<div data-card="${c.id}">${cardHTML(c, { club, size: 'sm' })}</div>`).join('') || '<div class="hint">—</div>'}</div>
      </div>`,
    );
    bind('[data-act=back]', () => { audio.click(); showHub(h); });
    bind('[data-act=edit]', () => { audio.click(); showClubEditor(h, false); });
    bind('[data-slot]', (el) => {
      const i = Number(el.dataset.slot);
      if (sel !== null && sel !== i) {
        const tmp = profile.lineup[sel];
        profile.lineup[sel] = profile.lineup[i];
        profile.lineup[i] = tmp;
        sel = null;
        saveProfile();
        audio.select();
      } else {
        sel = sel === i ? null : i;
        audio.click();
      }
      render();
    });
    bind('[data-card]', (el) => {
      if (sel === null) {
        toast(L.tapSlot);
        return;
      }
      profile.lineup[sel] = el.dataset.card!;
      sel = null;
      saveProfile();
      audio.select();
      render();
    });
  };
  render();
  void cardById;
}
