/** Career UI kit: the shell (top bar + tabs), avatars, crests, bars, modals. */
import type { Career } from '../../career/types';
import { esc, paintTag, paintAll, crestTag, flagTag, portraitSource, spriteSource, lookFor, ui, bind } from '../common';
import { teamDefOf, isNat, natCode, myOvr, clubName } from '../../career/world';
import { L2, compact, money } from '../../career/util';
import { unreadDMs } from '../../career/media';
import { openOffers } from '../../career/transfer';
import type { TeamDef } from '../../game/teams';
import { TEAMS } from '../../game/teams';
import { lookOf } from '../../career/util';
import { audio } from '../../engine/audio';
import { itemById } from '../../meta/items';
import { profile } from '../../meta/profile';

export type Tab = 'home' | 'cal' | 'phone' | 'me' | 'club' | 'life' | 'legacy';

export const NEUTRAL: TeamDef = { ...TEAMS[0], id: 'neutral', primary: '#3a4766', secondary: '#c8d0e0', shorts: '#1b2236', socks: '#3a4766' };

export function myKit(c: Career): TeamDef {
  const id = c.contract?.club;
  return id ? teamDefOf(c, id) : NEUTRAL;
}

export function myPortrait(c: Career, cls = 'cr-face', kit?: TeamDef) {
  return paintTag(portraitSource(lookFor(kit ?? myKit(c), c.me.look)), cls);
}

export function mySprite(c: Career, frame: string, cls = 'cr-sprite', kit?: TeamDef) {
  return paintTag(spriteSource(lookFor(kit ?? myKit(c), c.me.look, false, itemById(profile.equipped.boots)?.boot), frame), cls);
}

export function npcPortrait(c: Career, id: string, cls = 'cr-face') {
  const p = c.npcs[id];
  if (!p) return '';
  const kit = p.club && c.clubs[p.club] ? teamDefOf(c, p.club) : isNat('n:' + p.nat) ? teamDefOf(c, 'n:' + p.nat) : NEUTRAL;
  return paintTag(portraitSource(lookFor(kit, lookOf(p.id, p.nat), p.pos === 'GK')), cls);
}

/** Crest for a club, a flag for a national team. */
export function crestOf(c: Career, id: string, cls = 'crest-sm') {
  if (!id) return '';
  if (isNat(id)) return flagTag(natCode(id), 'cr-flag ' + cls);
  return crestTag(teamDefOf(c, id), cls);
}

export function ratingClass(r: number) {
  return r >= 8 ? 'r-elite' : r >= 7 ? 'r-good' : r >= 6 ? 'r-ok' : 'r-bad';
}

export function bar(label: string, v: number, cls = '', right?: string) {
  return `<div class="cr-bar ${cls}"><span>${label}</span><div class="cr-track"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div><b>${right ?? Math.round(v)}</b></div>`;
}

export function fmtText(s: string) {
  return esc(s)
    .replace(/(#[\wÇĞİÖŞÜçğıöşü]+)/g, '<span class="ht">$1</span>')
    .replace(/(@[\w]+)/g, '<span class="mn">$1</span>')
    .replace(/\n/g, '<br>');
}

export function formChips(c: Career) {
  const f = c.me.form;
  if (!f.length) return `<span class="cr-form-empty">—</span>`;
  return f.map((r) => `<span class="cr-fchip ${ratingClass(r)}">${r.toFixed(1)}</span>`).join('');
}

export function shell(c: Career, tab: Tab, body: string) {
  const dms = unreadDMs(c);
  const offers = openOffers(c).length;
  const tabs: [Tab, string, string, number][] = [
    ['home', '⌂', L2('HOME', 'ANA'), 0],
    ['cal', '▦', L2('SEASON', 'SEZON'), 0],
    ['phone', '◉', 'KICKR', dms],
    ['me', '★', L2('PLAYER', 'OYUNCU'), c.me.perkPts],
    ['club', '◆', L2('CONTRACT', 'SÖZLEŞME'), offers],
    ['life', '◇', L2('LIFE', 'YAŞAM'), 0],
    ['legacy', '♛', L2('LEGACY', 'MİRAS'), c.rewards.length],
  ];
  const club = c.contract?.club;
  return `<div class="cr">
    <header class="cr-top">
      <button class="cr-back" data-act="cr-exit" aria-label="${L2('Main menu', 'Ana menü')}">‹</button>
      <div class="cr-who">${myPortrait(c, 'cr-face-xs')}<div><b>${esc(c.me.name)}</b><small>${club ? `${crestOf(c, club, 'crest-xs')} ${esc(clubName(c, club))}` : L2('Free agent', 'Serbest oyuncu')} · ${myOvr(c)} ${L2('OVR', 'GNL')}</small></div></div>
      <div class="cr-chips">
        <span class="cr-chip"><i>${L2('S', 'S')}${c.season}</i>${c.phase === 'summer' ? L2('SUMMER', 'YAZ') : L2('WK', 'HF') + ' ' + c.week}</span>
        <span class="cr-chip money">${money(c.me.money)}</span>
        <span class="cr-chip fol">◉ ${compact(c.me.followers)}</span>
      </div>
    </header>
    <main class="cr-body cr-tab-${tab}">${body}</main>
    <nav class="cr-tabs">${tabs.map(([id, ic, label, badge]) => `<button class="cr-tabb ${tab === id ? 'on' : ''}" data-tab="${id}"><i>${ic}</i><span>${label}</span>${badge ? `<em>${badge}</em>` : ''}</button>`).join('')}</nav>
  </div>`;
}

// ------------------------------------------------------------------ modal

export function modal(html: string, cls = '') {
  closeModal();
  const m = document.createElement('div');
  m.className = 'cr-modal ' + cls;
  m.innerHTML = `<div class="cr-modal-box">${html}</div>`;
  ui().appendChild(m);
  paintAll(m);
  requestAnimationFrame(() => m.classList.add('in'));
  return m;
}

export function closeModal() {
  ui().querySelectorAll('.cr-modal').forEach((m) => m.remove());
}

export function bindIn(root: ParentNode, sel: string, fn: (el: HTMLElement, e: Event) => void) {
  bind(sel, fn, root);
}

export function stars(n: number, max = 5) {
  let s = '';
  for (let i = 1; i <= max; i++) s += `<i class="${i <= n ? 'on' : ''}">★</i>`;
  return `<span class="cr-stars">${s}</span>`;
}

export function click() {
  audio.click();
}

/** Simple SVG line chart. */
export function lineChart(points: number[], opts: { w?: number; h?: number; color?: string; fmt?: (v: number) => string } = {}) {
  const w = opts.w ?? 300, h = opts.h ?? 110;
  if (points.length < 2) return `<div class="cr-chart-empty">${L2('Not enough data yet', 'Henüz yeterli veri yok')}</div>`;
  const max = Math.max(...points), min = Math.min(...points);
  const pad = 8;
  const xs = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const ys = (v: number) => h - pad - ((v - min) / Math.max(1e-9, max - min)) * (h - pad * 2 - 12);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
  const area = `${d} L${xs(points.length - 1).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  const fmt = opts.fmt ?? ((v: number) => String(Math.round(v)));
  const col = opts.color ?? 'var(--marker)';
  return `<svg class="cr-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${area}" fill="${col}" opacity="0.18"/>
    <path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${xs(points.length - 1)}" cy="${ys(points[points.length - 1])}" r="4" fill="${col}" stroke="#15171c" stroke-width="2"/>
    <text x="${w - pad}" y="12" text-anchor="end" class="cr-chart-t">${fmt(max)}</text>
    <text x="${w - pad}" y="${h - 2}" text-anchor="end" class="cr-chart-t">${fmt(min)}</text>
  </svg>`;
}

export { esc, paintTag, paintAll, crestTag, flagTag, ui };
