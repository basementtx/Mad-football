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
import { PATTERNS as ALL_PATTERNS, cosName, cosFor } from '../meta/cosmetics';
import { lockTag, isLocked, askUnlock } from './unlock';
import { playerChem, teamChem, chemColor, familiarity } from '../meta/chemistry';
import { FORMATIONS, formationFor, Formation } from '../game/formations';
import { settings, lastSetup } from '../engine/storage';

const tl = (o: { tr: string; en: string }) => (settings.lang === 'tr' ? o.tr : o.en);
const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);
const ROLE_TAG: Record<string, { tr: string; en: string }> = { GK: { tr: 'KL', en: 'GK' }, DEF: { tr: 'DEF', en: 'DEF' }, MID: { tr: 'OS', en: 'MID' }, FWD: { tr: 'FV', en: 'FWD' } };

/** Mini pitch with the formation's players (attack to the right). */
function formationPitch(f: Formation) {
  const dot = (u: number, w: number, role: string) =>
    `<i class="fm-dot r-${role}" style="left:${((u + 1) / 2) * 100}%;top:${((w + 1) / 2) * 100}%">${tl(ROLE_TAG[role])}</i>`;
  return `<div class="fm-pitch"><span class="fm-half"></span><span class="fm-circle"></span><span class="fm-box l"></span><span class="fm-box r"></span>${dot(-0.88, 0, 'GK')}${f.spots.map(([u, w], i) => dot(u, w, f.roles[i])).join('')}</div>`;
}

/** Formation picker: one choice per match size (3v3 / 4v4 / 5v5). */
export function showFormations(h: MenuHandlers, size = FORMATIONS[lastSetup.size] ? lastSetup.size : 5) {
  const cur = formationFor(size, profile.formations?.[size]);
  setScreen(
    'screen-formation',
    `<div class="formation">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${t().back}</button>
        <div class="panel-title">${L2('FORMATION', 'DİZİLİŞ')}</div>
        <div class="fm-cur">${cur.id}</div>
      </div>
      <div class="tabs">${[3, 4, 5].map((n) => `<button class="tab ${n === size ? 'on' : ''}" data-size="${n}">${n}v${n} <small>${formationFor(n, profile.formations?.[n]).id}</small></button>`).join('')}</div>
      <div class="fm-grid">
        ${FORMATIONS[size].map((f) => `<button class="fm-card ${f.id === cur.id ? 'on' : ''}" data-fm="${f.id}">
          ${formationPitch(f)}
          <div class="fm-txt"><b>${f.id}</b><span>${esc(tl(f.name))}</span><small>${esc(tl(f.desc))}</small></div>
        </button>`).join('')}
      </div>
      <div class="hint fm-hint">${L2('Lineup slots 2-' + size + ' play these roles in ' + size + 'v' + size + '. Players in their own position get chemistry.', size + 'v' + size + ' maçta 2-' + size + '. sıradaki oyuncular bu rollerde oynar. Kendi mevkiinde oynayan oyuncu kimya kazanır.')}</div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showSquad(h); });
  bind('[data-size]', (b) => { audio.click(); showFormations(h, Number(b.dataset.size)); });
  bind('[data-fm]', (b) => {
    profile.formations = { ...(profile.formations ?? {}), [size]: b.dataset.fm! };
    saveProfile();
    audio.select();
    showFormations(h, size);
  });
}

export const SWATCHES = ['#e23a2e', '#ff7a1a', '#ffd23f', '#b6ff3b', '#21a85a', '#14b8a6', '#7fd3ff', '#2f7bff', '#13215e', '#6b3fd6', '#ff2fa0', '#ffffff', '#c8d0e0', '#6c7480', '#1b1b1f', '#7a3b12'];
const FREE_PATTERNS: KitPattern[] = ['solid', 'stripes', 'hoops', 'half', 'sash', 'chevron'];
const PATTERNS = ALL_PATTERNS as KitPattern[];

function randomClub(): Club {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const primary = pick(SWATCHES);
  let secondary = pick(SWATCHES);
  while (secondary === primary) secondary = pick(SWATCHES);
  const first = pick(['Pixel', 'Chaos', 'Brawl', 'Rocket', 'Storm', 'Wild', 'Iron', 'Night']);
  return {
    name: first + ' ' + pick(['FC', 'United', 'City', 'Rovers', 'Athletic']),
    short: first.slice(0, 3).toUpperCase(),
    primary, secondary, shorts: secondary, socks: primary,
    gk: '#ffcc2a',
    pattern: pick(FREE_PATTERNS),
    crest: { shape: Math.floor(Math.random() * 5), icon: pick(ICON_IDS.slice(0, 10)) },
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
          <div class="ce-row"><span>${L.pattern}</span><div class="opts" id="ce-pat">${PATTERNS.map((p) => `<button class="opt-b ${d.pattern === p ? 'on' : ''} ${isLocked('pattern', p) ? 'locked' : ''}" data-pat="${p}">${(cosFor('pattern', p) ? cosName(cosFor('pattern', p)!) : p).toUpperCase()}${lockTag('pattern', p)}</button>`).join('')}</div></div>
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
    shapes.innerHTML = Array.from({ length: CREST_SHAPES }, (_, i) => `<button class="opt-c ${d.crest.shape === i ? 'on' : ''} ${isLocked('shape', i) ? 'locked' : ''}" data-shape="${i}">${paintTag(() => crestCanvas({ shape: i, icon: d.crest.icon }, d.primary, d.secondary), 'crest-sm')}${lockTag('shape', i)}</button>`).join('');
    const icons = document.getElementById('ce-icon')!;
    icons.innerHTML = ICON_IDS.map((ic) => `<button class="opt-c ${d.crest.icon === ic ? 'on' : ''} ${isLocked('icon', ic) ? 'locked' : ''}" data-icon="${ic}">${paintTag(() => crestCanvas({ shape: d.crest.shape, icon: ic }, d.primary, d.secondary), 'crest-sm')}${lockTag('icon', ic)}</button>`).join('');
    paintAll(shapes);
    paintAll(icons);
    const crestPrev = () => crestTag(asTeam(d), 'crest-xl');
    bind('[data-shape]', (b) => {
      const prev = d.crest.shape;
      d.crest.shape = Number(b.dataset.shape);
      audio.click();
      renderPreview();
      if (isLocked('shape', d.crest.shape)) askUnlock('shape', d.crest.shape, crestPrev(), renderPreview, () => { d.crest.shape = prev; renderPreview(); });
    }, shapes);
    bind('[data-icon]', (b) => {
      const prev = d.crest.icon;
      d.crest.icon = b.dataset.icon!;
      audio.click();
      renderPreview();
      if (isLocked('icon', d.crest.icon)) askUnlock('icon', d.crest.icon, crestPrev(), renderPreview, () => { d.crest.icon = prev; renderPreview(); });
    }, icons);
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
  const setPat = (p: KitPattern) => {
    d.pattern = p;
    ui().querySelectorAll<HTMLElement>('[data-pat]').forEach((x) => {
      x.classList.toggle('on', x.dataset.pat === p);
      x.classList.toggle('locked', isLocked('pattern', x.dataset.pat!));
      x.querySelector('.lk')?.remove();
      x.insertAdjacentHTML('beforeend', lockTag('pattern', x.dataset.pat!));
    });
    renderPreview();
  };
  bind('[data-pat]', (b) => {
    const prev = d.pattern;
    const p = b.dataset.pat as KitPattern;
    audio.click();
    setPat(p);
    if (isLocked('pattern', p)) {
      const team = asTeam(d);
      askUnlock('pattern', p, `<div class="ce-kits">${paintTag(spriteSource(lookFor(team, { skin: '#e5b48f', hair: '#3b2416', hairStyle: 0, beard: false }), 'idle0'), 'kit')}${paintTag(spriteSource(lookFor(team, { skin: '#7a4d30', hair: '#1a1310', hairStyle: 2, beard: false }), 'run2', true), 'kit')}</div>`, () => setPat(p), () => setPat(prev));
    }
  });
  bind('[data-act=back]', () => { audio.click(); showSquad(h); });
  bind('[data-act=save]', () => {
    // never save a look that is still locked
    if (isLocked('pattern', d.pattern)) d.pattern = 'solid';
    if (isLocked('shape', d.crest.shape)) d.crest.shape = 0;
    if (isLocked('icon', d.crest.icon)) d.crest.icon = 'star';
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
          <div class="sq-acts"><button class="btn btn-primary btn-sm" data-act="formation">⚽ ${L2('FORMATION', 'DİZİLİŞ')} <small>${formationFor(5, profile.formations?.[5]).id}</small></button><button class="btn btn-ghost btn-sm" data-act="edit">${L.editClub}</button></div>
        </div>
        <div class="chem-bar" style="--cc:${chemColor(teamChem())}"><b>${L.chemistry}</b><div class="cb"><i style="width:${teamChem()}%"></i></div><span>${teamChem()}</span><small>${esc(L.chemHint)}</small></div>
        <div class="sec-label">${L.lineup} <small>${L.slotsHint}</small></div>
        <div class="lineup">
          ${Array.from({ length: LINEUP_SLOTS }, (_, i) => {
            const c = lineup[i];
            let chem = '';
            if (c) {
              const ci = playerChem(c, i);
              const tip = ci.wrongGK ? L.chemGK : !ci.posOk ? L.chemWrongPos : '';
              chem = `<div class="chem-dots" title="${familiarity(c.id)} ${L.chemGames}">${'◆'.repeat(ci.points)}<span>${'◆'.repeat(3 - ci.points)}</span>${tip ? `<em>${esc(tip)}</em>` : ''}</div>`;
            }
            return `<div class="slot ${sel === i ? 'sel' : ''}" data-slot="${i}"><div class="slot-n">${i + 1}</div>${c ? cardHTML(c, { club, size: 'md', selected: sel === i }) : '<div class="empty-slot">+</div>'}${chem}</div>`;
          }).join('')}
        </div>
        <div class="sec-label">${L.reserves} <small>${sel !== null ? L.tapSlot : ''}</small></div>
        <div class="reserves">${reserves.map((c) => `<div data-card="${c.id}">${cardHTML(c, { club, size: 'sm' })}</div>`).join('') || '<div class="hint">—</div>'}</div>
      </div>`,
    );
    bind('[data-act=back]', () => { audio.click(); showHub(h); });
    bind('[data-act=edit]', () => { audio.click(); showClubEditor(h, false); });
    bind('[data-act=formation]', () => { audio.click(); showFormations(h); });
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
