/** Cup screen: bracket (QF -> SF -> final), prizes and your next tie. */
import { settings } from '../engine/storage';
import { audio } from '../engine/audio';
import { cup, newCup, cupTeam, userTie, userOpp, cupRating, roundPay, cupDifficulty, CupTie, CUP_ROUNDS } from '../meta/cup';
import { league } from '../meta/league';
import { t } from '../engine/i18n';
import { trophyCanvas } from '../pixel/trophy';
import { setScreen, bind, esc, crestTag, coinTag, coinsPill, paintTag, MenuHandlers } from './common';
import { showHub } from './hub';

const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);
const ROUND_NAMES = () => [L2('Quarter-finals', 'Çeyrek Final'), L2('Semi-finals', 'Yarı Final'), L2('Final', 'Final')];

function stars(v: number) {
  const full = Math.round(v * 2) / 2;
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="star ${i <= full ? 'on' : i - 0.5 === full ? 'half' : ''}">■</span>`;
  return s;
}

function slot(id: string | undefined, goals: number | undefined, pens: number | undefined, win: boolean | undefined) {
  if (!id) return `<div class="cp-slot tbd"><span class="cp-crest"></span><b>?</b></div>`;
  const tm = cupTeam(id);
  return `<div class="cp-slot ${id === 'club' ? 'me' : ''} ${win === true ? 'w' : win === false ? 'l' : ''}">${crestTag(tm, 'crest-xs')}<b>${esc(tm.short)}</b>${goals !== undefined ? `<em>${goals}${pens !== undefined ? `<small>(${pens})</small>` : ''}</em>` : ''}</div>`;
}

function tieHTML(tie: CupTie | undefined) {
  if (!tie) return `<div class="cp-tie">${slot(undefined, undefined, undefined, undefined)}${slot(undefined, undefined, undefined, undefined)}</div>`;
  const done = !!tie.w;
  return `<div class="cp-tie ${done ? 'done' : ''} ${tie.a === 'club' || tie.b === 'club' ? 'mine' : ''}">
    ${slot(tie.a, tie.ag, tie.pens?.[0], done ? tie.w === tie.a : undefined)}
    ${slot(tie.b, tie.bg, tie.pens?.[1], done ? tie.w === tie.b : undefined)}
  </div>`;
}

export function showCup(h: MenuHandlers) {
  const c = cup ?? newCup();
  const champ = c.rounds[CUP_ROUNDS - 1]?.[0]?.w;
  const tie = userTie();
  const opp = userOpp();
  const oppDef = opp ? cupTeam(opp) : null;
  const club = cupTeam('club');
  const cols = [0, 1, 2].map((r) => {
    const n = 4 >> r;
    const ties = c.rounds[r] ?? [];
    return `<div class="cp-col r${r}"><div class="cp-rname">${ROUND_NAMES()[r]}</div><div class="cp-ties">${Array.from({ length: n }, (_, i) => tieHTML(ties[i])).join('')}</div></div>`;
  }).join('');
  setScreen(
    'screen-cup',
    `<div class="cupscr">
      <div class="panel-head">
        <button class="btn btn-ghost btn-sm" data-act="back">‹ ${t().back}</button>
        <div class="cp-title"><b>${L2('MAD CUP', 'MAD KUPASI')}</b><small>#${c.edition} · ${esc(t().divNames[c.div] ?? '')}</small></div>
        ${coinsPill()}
      </div>
      <div class="cp-body">
        <div class="cp-bracket">
          ${cols}
          <div class="cp-col champ"><div class="cp-rname">${L2('Winner', 'Şampiyon')}</div><div class="cp-ties"><div class="cp-champ ${champ ? 'set' : ''}">${paintTag(() => trophyCanvas('cup', club.primary), 'cp-cup-sm')}${champ ? slot(champ, undefined, undefined, true) : '<b>?</b>'}</div></div></div>
        </div>
        <div class="cp-side">
          ${c.status === 'running' && tie && oppDef ? `
          <div class="cp-next">
            <div class="sec-label">${ROUND_NAMES()[c.round]} · ${L2('your tie', 'senin maçın')}</div>
            <div class="fx-row"><div class="fx-team">${crestTag(club, 'crest-md')}<b>${esc(club.short)}</b></div><div class="fx-vs">VS</div><div class="fx-team">${crestTag(oppDef, 'crest-md')}<b>${esc(oppDef.short)}</b></div></div>
            <div class="fx-name">${esc(oppDef.name)}</div>
            <div class="stars">${stars(cupRating(opp!))}</div>
            <div class="fx-diff">${t().difficulty}: ${(t() as unknown as Record<string, string>)[cupDifficulty()]} · ${L2('draw = penalties', 'beraberlik = penaltı')}</div>
            <button class="btn btn-primary" data-act="play">${L2('PLAY CUP TIE', 'KUPA MAÇINI OYNA')} ▶</button>
          </div>` : `
          <div class="cp-next end ${c.status}">
            ${paintTag(() => trophyCanvas('cup', club.primary), 'cp-cup-lg')}
            <b>${c.status === 'won' ? L2('CUP WINNERS!', 'KUPA ŞAMPİYONU!') : L2('Knocked out', 'Elendin')}</b>
            <small>${c.status === 'won' ? L2('The trophy is in your cabinet.', 'Kupa artık dolabında.') : L2('Better luck in the next edition.', 'Bir sonraki kupada şansın açık olsun.')}</small>
            <button class="btn btn-primary" data-act="new">${L2('NEXT CUP', 'YENİ KUPA')} #${c.edition + 1} ▶</button>
          </div>`}
          <div class="cp-prizes">
            <div class="sec-label">${L2('Prizes', 'Ödüller')}</div>
            ${[0, 1, 2].map((r) => `<div class="cp-prize ${c.round > r || c.status === 'won' ? 'got' : c.round === r && c.status === 'running' ? 'now' : ''}"><span>${r < 2 ? L2('Win the', 'Kazan:') + ' ' + ROUND_NAMES()[r] : L2('Win the final', 'Finali kazan')}</span><b>+${roundPay(r)} ${coinTag()}</b>${r === 2 ? `<em>+ ${L2('special card', 'özel kart')} & 🏆</em>` : ''}</div>`).join('')}
          </div>
        </div>
      </div>
    </div>`,
  );
  bind('[data-act=back]', () => { audio.click(); showHub(h); });
  bind('[data-act=play]', () => { audio.select(); h.startCupMatch(); });
  bind('[data-act=new]', () => { audio.select(); newCup(); showCup(h); });
  void league;
}
