/** Career tabs: season, player, contract, life, legacy (and the phone wrapper). */
import type { Career, Competition, Offer, Row, Role } from '../../career/types';
import type { MenuHandlers } from '../common';
import { toast } from '../common';
import { Tab, esc, crestOf, myPortrait, npcPortrait, bar, ratingClass, modal, closeModal, lineChart, stars, flagTag } from './kit';
import { L2, LP, money, compact } from '../../career/util';
import { clubName, sortTable, myOvr, squadOf, isNat, compById, roundName, compShort, teamStrength } from '../../career/world';
import { PERKS, canTakePerk, takePerk, LIFE, owns, buyLife, dropLife, weeklyUpkeep, xpNeed, marketValue, roleName, formAvg, perkBy, avg } from '../../career/me';
import { openOffers, negotiate, signOffer, agentHint, offerTitle, ROLE_RANK, windowOpen, divLabel } from '../../career/transfer';
import { saveCareer, setCareer } from '../../career/state';
import { SPONSORS, nationBy } from '../../career/data';
import { playerName, legacyScore, legacyTier } from '../../career/season';
import { phoneHTML, bindPhone } from './phone';
import { askRetire, collectRewards, showCareer } from './home';
import { audio } from '../../engine/audio';
import { t } from '../../engine/i18n';
import { STAT_KEYS, overall } from '../../meta/cards';

type R = { html: string; bind: (root: HTMLElement) => void };

let calComp: string | null = null;
let meView: 'attr' | 'perks' | 'history' | 'charts' | 'rel' = 'attr';

export function renderTab(c: Career, tab: Tab, h: MenuHandlers, rerender: () => void, go: (t: Tab) => void): R {
  void h;
  void go;
  switch (tab) {
    case 'phone': return { html: phoneHTML(c), bind: (root) => bindPhone(c, root, rerender) };
    case 'cal': return calTab(c, rerender);
    case 'me': return meTab(c, rerender);
    case 'club': return clubTab(c, rerender);
    case 'life': return lifeTab(c, rerender);
    case 'legacy': return legacyTab(c, rerender, h);
  }
  return { html: '', bind: () => {} };
}

// ------------------------------------------------------------------ season / competitions

function tableHTML(c: Career, rows: Row[], hi: string[], zones?: { up: number; down: number }) {
  return `<div class="ct-table">
    <div class="ct-tr th"><span>#</span><span class="tn"></span><span>${L2('P', 'O')}</span><span>${L2('W', 'G')}</span><span>${L2('D', 'B')}</span><span>${L2('L', 'M')}</span><span>${L2('GD', 'AV')}</span><span>${L2('PTS', 'P')}</span><span class="fm">${L2('Form', 'Form')}</span></div>
    ${sortTable(rows).map((r, i) => `<div class="ct-tr ${hi.includes(r.id) ? 'me' : ''} ${zones && i < zones.up ? 'z-up' : ''} ${zones && i >= rows.length - zones.down ? 'z-down' : ''}"><span>${i + 1}</span><span class="tn">${crestOf(c, r.id, 'crest-xs')}${esc(clubName(c, r.id))}</span><span>${r.p}</span><span>${r.w}</span><span>${r.d}</span><span>${r.l}</span><span>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</span><b>${r.pts}</b><span class="fm">${r.form.map((f) => `<i class="f-${f}">${f === 'W' ? L2('W', 'G') : f === 'D' ? L2('D', 'B') : L2('L', 'M')}</i>`).join('')}</span></div>`).join('')}
  </div>`;
}

function koHTML(c: Career, comp: Competition, mine: string[]) {
  const fx = c.fixtures.filter((f) => f.comp === comp.id && ['R16', 'QF', 'SF', 'F'].includes(f.round));
  const rounds = ['R16', 'QF', 'SF', 'F'].filter((r) => fx.some((f) => f.round === r));
  if (!rounds.length) return `<p class="cr-hint">${L2('The draw is coming.', 'Kura yakında.')}</p>`;
  return `<div class="ct-ko">${rounds.map((r) => `<div class="ct-kor"><small>${roundName(r)}</small>${fx.filter((f) => f.round === r).map((f) => {
    const w = f.played ? (f.hg! > f.ag! ? f.home : f.ag! > f.hg! ? f.away : f.pw) : null;
    return `<div class="ct-tie ${mine.includes(f.home) || mine.includes(f.away) ? 'me' : ''}"><span class="${w === f.home ? 'w' : ''}">${crestOf(c, f.home, 'crest-xs')}${esc(shortOf(c, f.home))}</span><b>${f.played ? `${f.hg}-${f.ag}${f.pw ? '*' : ''}` : L2('W', 'H') + f.week}</b><span class="${w === f.away ? 'w' : ''}">${esc(shortOf(c, f.away))}${crestOf(c, f.away, 'crest-xs')}</span></div>`;
  }).join('')}</div>`).join('')}${comp.winner ? `<div class="ct-champ">🏆 ${esc(clubName(c, comp.winner))}</div>` : ''}</div>`;
}

const shortOf = (c: Career, id: string) => (isNat(id) ? LP([nationBy(id.slice(2)).en, nationBy(id.slice(2)).tr]) : c.clubs[id]?.short ?? id);

function scorersHTML(c: Career, comp: Competition) {
  const inComp = (club: string | null) => !!club && comp.teams.includes(club);
  const list = Object.values(c.npcs).filter((p) => inComp(p.club)).map((p) => ({ id: p.id, name: p.name, club: p.club!, g: p.s.goals, a: p.s.assists, avg: p.s.apps ? p.s.rsum / p.s.apps : 0 }));
  if (c.contract && inComp(c.contract.club)) list.push({ id: 'me', name: c.me.name, club: c.contract.club, g: c.s.goals, a: c.s.assists, avg: c.s.apps ? c.s.rsum / c.s.apps : 0 });
  const top = list.sort((a, b) => b.g - a.g || b.a - a.a).slice(0, 8);
  return `<div class="ct-sc"><small>${L2('TOP SCORERS (ALL COMPS)', 'GOL KRALLIĞI (TÜM KORT.)')}</small>${top.map((p, i) => `<div class="${p.id === 'me' ? 'me' : ''}"><span>${i + 1}</span>${p.id === 'me' ? myPortrait(c, 'ct-face') : npcPortrait(c, p.id, 'ct-face')}<b>${esc(p.name)}</b><i>${crestOf(c, p.club, 'crest-xs')}</i><em>${p.g}</em></div>`).join('')}</div>`;
}

function calTab(c: Career, rerender: () => void): R {
  const my = c.contract?.club ?? '';
  const mine = [my, 'n:' + c.me.nat];
  const comps = c.comps.filter((k) => (k.kind === 'league' && (k.teams.includes(my) || (!my && k.div === 1))) || (k.kind === 'cup' && k.teams.includes(my)) || k.id === 'E' || k.id === 'T' || (k.kind === 'league' && k.div === 1));
  const uniq = comps.filter((k, i) => comps.indexOf(k) === i);
  if (!calComp || !uniq.some((k) => k.id === calComp)) calComp = uniq[0]?.id ?? null;
  const comp = calComp ? compById(c, calComp) : null;
  let main = '';
  if (comp) {
    if (comp.kind === 'league' && comp.table) main = `<div class="ct-two">${tableHTML(c, comp.table, mine, { up: comp.div === 2 ? 2 : 0, down: comp.div === 1 ? 2 : 0 })}${scorersHTML(c, comp)}</div>`;
    else if (comp.kind === 'cup') main = koHTML(c, comp, mine);
    else main = `<div class="ct-groups">${(comp.groupTables ?? []).map((g, i) => `<div><small>${roundName('G' + (i + 1))}</small>${tableHTML(c, g, mine)}</div>`).join('')}</div>${koHTML(c, comp, mine)}`;
  }
  const fixtures = c.fixtures.filter((f) => f.home === my || f.away === my || f.home === 'n:' + c.me.nat || f.away === 'n:' + c.me.nat).sort((a, b) => a.week - b.week);
  const myLog = new Map(c.log.filter((l) => l.season === c.season).map((l) => [l.week, l]));
  const list = `<div class="ct-fx">${fixtures.map((f) => {
    const team = f.home === my || f.away === my ? my : 'n:' + c.me.nat;
    const opp = f.home === team ? f.away : f.home;
    const lg = myLog.get(f.week);
    const res = f.played ? (f.home === team ? `${f.hg}-${f.ag}` : `${f.ag}-${f.hg}`) : '';
    const wdl = f.played ? ((f.home === team ? f.hg! - f.ag! : f.ag! - f.hg!) > 0 ? 'w' : (f.home === team ? f.hg! - f.ag! : f.ag! - f.hg!) < 0 ? 'l' : 'd') : '';
    return `<div class="ct-f ${f.week === c.week ? 'now' : ''} ${wdl}"><span class="wk">${L2('W', 'H')}${f.week}</span><span class="cp">${esc(compShort(c, f.comp))}</span>${crestOf(c, opp, 'crest-xs')}<b>${esc(clubName(c, opp))}</b><i>${f.home === team ? L2('H', 'E') : L2('A', 'D')}</i><em>${res}</em>${lg ? `<span class="rt ${ratingClass(lg.rating)}">${lg.rating.toFixed(1)}</span>` : '<span class="rt"></span>'}</div>`;
  }).join('')}</div>`;
  return {
    html: `<div class="ct">
      <div class="ct-left"><div class="sec-label">${L2('YOUR FIXTURES', 'FİKSTÜRÜN')}</div>${list}</div>
      <div class="ct-right"><div class="ct-comps">${uniq.map((k) => `<button class="${k.id === calComp ? 'on' : ''}" data-comp="${k.id}">${k.nat ? flagTag(k.nat, 'cr-flag-xs') : k.id === 'T' ? '🌍' : '⭐'} ${esc(LP(k.name))}</button>`).join('')}<button class="ct-edit" data-act="edit">✎ ${L2('Edit', 'Düzenle')}</button></div>${main}</div>
    </div>`,
    bind: (root) => {
      root.querySelectorAll<HTMLElement>('[data-comp]').forEach((b) => b.addEventListener('click', () => { calComp = b.dataset.comp!; audio.click(); rerender(); }));
      root.querySelector('.ct-f.now')?.scrollIntoView({ block: 'center' });
      root.querySelector('[data-act=edit]')?.addEventListener('click', () => { audio.click(); editPicker(c, comp, rerender); });
    },
  };
}

// ------------------------------------------------------------------ player

function meTab(c: Career, rerender: () => void): R {
  const me = c.me;
  const L = t();
  const views: [typeof meView, string][] = [['attr', L2('Attributes', 'Özellikler')], ['perks', L2('Perks', 'Yetenekler') + (me.perkPts ? ` (${me.perkPts})` : '')], ['history', L2('Career', 'Kariyer')], ['charts', L2('Value & fame', 'Değer & şöhret')], ['rel', L2('Relationships', 'İlişkiler')]];
  let body = '';
  if (meView === 'attr') {
    const ovr = myOvr(c);
    body = `<div class="pl-attr">
      <div class="pl-ovr"><b>${ovr}</b><small>${L2('OVERALL', 'GENEL')}</small><div class="pl-pot"><small>${L2('Scout potential', 'Scout potansiyeli')}</small><b>${me.potSeen[0]}–${me.potSeen[1]}</b></div><div class="pl-lv"><small>${L2('Level', 'Seviye')} ${me.level}</small><div class="cr-track"><i style="width:${(me.xp / xpNeed(me.level)) * 100}%"></i></div><small>${me.xp}/${xpNeed(me.level)} XP</small></div></div>
      <div class="pl-stats">${STAT_KEYS.map((k) => `<div class="pl-st"><span>${L.stat[k]}</span><div class="cr-track big"><i style="width:${me.stats[k]}%"></i><u style="width:${Math.max(0, me.prog[k]) * 1}%;left:${me.stats[k]}%"></u></div><b>${me.stats[k]}</b></div>`).join('')}</div>
      <div class="pl-facts"><span>${L2('Foot', 'Ayak')}<b>${me.foot === 'R' ? L2('Right', 'Sağ') : L2('Left', 'Sol')}</b></span><span>${L2('Form avg', 'Form ort.')}<b>${formAvg(c).toFixed(2)}</b></span><span>${L2('Value', 'Değer')}<b>${money(marketValue(c))}</b></span><span>${L2('Fame', 'Şöhret')}<b>${Math.round(me.rep)}</b></span><span>${L2('Image', 'İmaj')}<b>${me.image > 25 ? L2('Role model', 'Örnek') : me.image < -25 ? L2('Bad boy', 'Asi') : L2('Neutral', 'Nötr')}</b></span></div>
      ${me.age >= 33 ? `<button class="btn btn-danger btn-sm pl-retire" data-act="retire">${L2('Announce retirement', 'Emekliliğini açıkla')}</button>` : ''}
    </div>`;
  } else if (meView === 'perks') {
    const br: [string, string][] = [['fin', L2('FINISHER', 'BİTİRİCİ')], ['eng', L2('ENGINE', 'MOTOR')], ['star', L2('SUPERSTAR', 'SÜPERSTAR')]];
    body = `<div class="pk-tree"><p class="cr-hint">${L2(`Perk points: ${me.perkPts}. You earn one every level.`, `Yetenek puanı: ${me.perkPts}. Her seviyede bir tane kazanırsın.`)}</p><div class="pk-cols">${br.map(([b, name]) => `<div class="pk-col"><small>${name}</small>${PERKS.filter((p) => p.br === b).map((p) => {
      const ownd = me.perks.includes(p.id);
      const can = canTakePerk(c, p);
      return `<button class="pk-n ${ownd ? 'own' : can ? 'can' : 'lock'}" data-perk="${p.id}" ${ownd || !can ? 'disabled' : ''}><b>${esc(LP(p.name))}</b><span>${esc(LP(p.desc))}</span><i>${ownd ? '✔' : can ? '+' : '🔒'}</i></button>`;
    }).join('<div class="pk-link"></div>')}</div>`).join('')}</div></div>`;
  } else if (meView === 'history') {
    const rows = [...c.history].reverse();
    const s = c.stats;
    body = `<div class="pl-hist">
      <div class="pl-tot"><span><b>${s.apps}</b>${L2('apps', 'maç')}</span><span><b>${s.goals}</b>${L2('goals', 'gol')}</span><span><b>${s.assists}</b>${L2('assists', 'asist')}</span><span><b>${s.apps ? (s.rsum / s.apps).toFixed(2) : '—'}</b>${L2('avg', 'ort')}</span><span><b>${s.motm}</b>MOTM</span><span><b>${s.hattricks}</b>${L2('hat-tricks', 'hat-trick')}</span><span><b>${me.intlApps}/${me.intlGoals}</b>${L2('caps/goals', 'milli/gol')}</span></div>
      <div class="ph-table"><div class="ph-tr th"><span>${L2('Season', 'Sezon')}</span><span class="cl">${L2('Club', 'Kulüp')}</span><span>${L2('Age', 'Yaş')}</span><span>${L2('OVR', 'GNL')}</span><span>${L2('Apps', 'Maç')}</span><span>⚽</span><span>🅰️</span><span>${L2('Avg', 'Ort')}</span><span>${L2('Pos', 'Sıra')}</span></div>
      <div class="ph-tr cur"><span>${c.season}</span><span class="cl">${c.contract ? crestOf(c, c.contract.club, 'crest-xs') + esc(clubName(c, c.contract.club)) : '—'}</span><span>${me.age}</span><span>${myOvr(c)}</span><span>${c.s.apps}</span><span>${c.s.goals}</span><span>${c.s.assists}</span><span>${c.s.apps ? (c.s.rsum / c.s.apps).toFixed(2) : '—'}</span><span>…</span></div>
      ${rows.map((r) => `<div class="ph-tr"><span>${r.season}</span><span class="cl">${r.club ? crestOf(c, r.club, 'crest-xs') + esc(clubName(c, r.club)) : '—'}</span><span>${r.age}</span><span>${r.ovr}</span><span>${r.apps}</span><span>${r.goals}</span><span>${r.assists}</span><span>${r.avg.toFixed(2)}</span><span>${r.leaguePos || '—'}${r.trophies.length ? ' 🏆' : ''}</span></div>`).join('')}</div>
    </div>`;
  } else if (meView === 'charts') {
    const vals = c.valueHist.map((x) => x.v);
    const fol = c.followHist.map((x) => x.v);
    body = `<div class="pl-charts"><div><small>${L2('MARKET VALUE', 'PİYASA DEĞERİ')} · <b>${money(marketValue(c))}</b></small>${lineChart(vals, { fmt: money })}</div><div><small>${L2('FOLLOWERS', 'TAKİPÇİ')} · <b>${compact(me.followers)}</b></small>${lineChart(fol, { fmt: compact, color: '#3E7CB8' })}</div></div>`;
  } else {
    const r = me.rel;
    const n = c.npcs[c.nemesis];
    body = `<div class="pl-rel">
      <div class="pl-bars">${bar(L2('Manager trust', 'Hoca güveni'), r.manager, 'mor')}${bar(L2('Team chemistry', 'Takım uyumu'), r.mates, 'fit')}${bar(L2('Fans', 'Taraftar'), r.fans, 'shp')}${bar(L2('Agent', 'Menajer'), r.agent)}${bar(L2('Media', 'Medya'), r.media)}${bar(L2('Image', 'İmaj'), (me.image + 100) / 2, me.image < 0 ? 'warn' : 'fit', String(Math.round(me.image)))}</div>
      ${n ? `<div class="nem-card"><small>${L2('YOUR RIVAL', 'RAKİBİN')}</small><div class="nem-vs"><div>${myPortrait(c, 'nem-face')}<b>${esc(c.me.name)}</b><span>${myOvr(c)} · ${c.stats.goals} ⚽</span></div><i>VS</i><div>${npcPortrait(c, n.id, 'nem-face')}<b>${esc(n.name)}</b><span>${n.ovr} · ${n.cg} ⚽</span><small>${n.club ? crestOf(c, n.club, 'crest-xs') + ' ' + esc(clubName(c, n.club)) : ''}</small></div></div>${bar(L2('Heat', 'Gerilim'), r.nemesis, 'warn')}</div>` : ''}
    </div>`;
  }
  return {
    html: `<div class="pl"><div class="pl-nav">${views.map(([id, l]) => `<button class="${meView === id ? 'on' : ''}" data-mv="${id}">${l}</button>`).join('')}</div><div class="pl-body">${body}</div></div>`,
    bind: (root) => {
      root.querySelectorAll<HTMLElement>('[data-mv]').forEach((b) => b.addEventListener('click', () => { meView = b.dataset.mv as typeof meView; audio.click(); rerender(); }));
      root.querySelectorAll<HTMLElement>('[data-perk]').forEach((b) => b.addEventListener('click', () => {
        if (takePerk(c, b.dataset.perk!)) {
          saveCareer();
          audio.horn();
          toast(`${LP(perkBy(b.dataset.perk!)!.name)} ✔`);
          rerender();
        }
      }));
      root.querySelector('[data-act=retire]')?.addEventListener('click', () => askRetire());
    },
  };
}

// ------------------------------------------------------------------ contract / club / offers

function clubTab(c: Career, rerender: () => void): R {
  const ct = c.contract;
  const k = ct ? c.clubs[ct.club] : null;
  const offers = openOffers(c);
  const squad = k ? squadOf(c, k.id).sort((a, b) => ['GK', 'DEF', 'MID', 'FWD'].indexOf(a.pos) - ['GK', 'DEF', 'MID', 'FWD'].indexOf(b.pos) || b.ovr - a.ovr) : [];
  const html = `<div class="cl">
    <div class="cl-left">
      ${k && ct ? `<div class="cl-club" style="--c:${k.primary};--c2:${k.secondary}">${crestOf(c, k.id, 'crest-xl')}<div><b>${esc(k.name)}</b><small>"${esc(LP(k.nick))}" · ${esc(divLabel(c, k.id))}</small><small>🏟 ${esc(k.stadium)} · 📋 ${esc(k.manager)}</small><small>${L2('Prestige', 'Prestij')} ${stars(Math.round(k.rep / 20))}</small></div></div>
      <div class="cl-contract">
        <div class="sec-label">${ct.loan ? L2('LOAN DEAL', 'KİRALIK ANLAŞMA') : L2('YOUR CONTRACT', 'SÖZLEŞMEN')}</div>
        <div class="cl-terms"><span>${L2('Wage', 'Maaş')}<b>${money(ct.wage)}/${L2('wk', 'hf')}</b></span><span>${L2('Until', 'Bitiş')}<b>${L2('End of S', 'S')}${ct.until}${L2('', ' sonu')}</b></span><span>${L2('Role', 'Rol')}<b>${roleName(ct.role)}</b></span><span>${L2('Goal bonus', 'Gol primi')}<b>${money(ct.goalBonus)}</b></span><span>${L2('Release clause', 'Serbest kalma')}<b>${ct.clause ? money(ct.clause) : '—'}</b></span><span>${L2('Market value', 'Piyasa değeri')}<b>${money(marketValue(c))}</b></span></div>
        ${ct.loan ? `<small class="cr-hint">${L2('Parent club', 'Asıl kulüp')}: ${esc(clubName(c, ct.loan.parent))}</small>` : ''}
      </div>` : `<div class="cl-free"><b>${L2('Free agent', 'Serbest oyuncu')}</b><p>${L2('Clubs will contact your agent. Check the offers.', 'Kulüpler menajerinle iletişime geçecek. Teklifleri incele.')}</p></div>`}
      <div class="cl-offers"><div class="sec-label">${L2('OFFERS', 'TEKLİFLER')} ${windowOpen(c) ? `<span class="cl-win">${L2('WINDOW OPEN', 'TRANSFER DÖNEMİ AÇIK')}</span>` : ''}</div>
        ${offers.length ? offers.map((o) => `<button class="cl-of" data-of="${o.id}">${crestOf(c, o.club, 'crest-md')}<div><b>${esc(offerTitle(c, o))}</b><small>${money(o.wage)}/${L2('wk', 'hf')} · ${o.years} ${L2('yrs', 'yıl')} · ${roleName(o.role)}${o.fee ? ` · ${L2('fee', 'bonservis')} ${money(o.fee)}` : ''}</small>${o.clubOk === false ? `<em class="bad">${L2('Your club rejected the bid', 'Kulübün teklifi reddetti')}</em>` : ''}</div><i>▶</i></button>`).join('') : `<p class="cr-hint">${windowOpen(c) ? L2('No offers right now. Perform and they will come.', 'Şu an teklif yok. Performans göster, gelecekler.') : L2('Windows: pre-season and weeks 14–16.', 'Transfer dönemleri: sezon öncesi ve 14–16. haftalar.')}</p>`}
      </div>
    </div>
    <div class="cl-squad"><div class="sec-label">${L2('SQUAD', 'KADRO')} · ${L2('Strength', 'Güç')} ${k ? Math.round(teamStrength(c, k.id)) : '—'}</div>
      ${squad.map((p) => { const n = c.npcs[p.id]; return `<div class="cl-p ${p.id === 'me' ? 'me' : ''} ${p.id === c.nemesis ? 'nem' : ''}">${p.id === 'me' ? myPortrait(c, 'cl-face') : npcPortrait(c, p.id, 'cl-face')}<span class="pos p-${p.pos}">${t().pos[p.pos]}</span><b>${esc(p.name)}</b><small>${p.age}</small><small>${p.id === 'me' ? c.s.goals : n?.s.goals ?? 0}⚽</small><em>${p.ovr}</em></div>`; }).join('')}
    </div>
  </div>`;
  return {
    html,
    bind: (root) => {
      root.querySelectorAll<HTMLElement>('[data-of]').forEach((b) => b.addEventListener('click', () => { audio.click(); negotiation(c, offers.find((o) => o.id === b.dataset.of)!, rerender); }));
    },
  };
}

const ROLES: Role[] = ['prospect', 'rotation', 'starter', 'star'];

function negotiation(c: Career, o: Offer, rerender: () => void) {
  const k = c.clubs[o.club];
  const ask = { wage: o.wage, years: o.years, role: o.role, clause: o.clause };
  let msg = agentHint(o);
  const draw = () => {
    const blocked = o.clubOk === false;
    const m = modal(`<div class="ng">
      <div class="cr-mh"><b>${crestOf(c, k.id, 'crest-sm')} ${esc(offerTitle(c, o))}</b><button class="cr-x" data-x>✕</button></div>
      <div class="ng-body">
        <div class="ng-club" style="--c:${k.primary}">${crestOf(c, k.id, 'crest-xl')}<b>${esc(k.name)}</b><small>${esc(divLabel(c, k.id))}</small><small>${L2('Prestige', 'Prestij')} ${stars(Math.round(k.rep / 20))}</small><small>${L2('Your role there', 'Oradaki rolün')}: <b>${roleName(o.role)}</b></small>${o.fee ? `<small>${L2('Fee', 'Bonservis')}: <b>${money(o.fee)}</b></small>` : ''}<div class="ng-pat">${L2('Patience', 'Sabır')} ${'●'.repeat(Math.max(0, o.patience))}${'○'.repeat(Math.max(0, 3 - o.patience))}</div></div>
        <div class="ng-form">
          ${blocked ? `<p class="bad">${L2('Your club rejected the bid. Forcing the move will damage your relationship with the manager and the fans.', 'Kulübün teklifi reddetti. Transferi zorlamak hoca ve taraftarla ilişkini zedeler.')}</p><button class="btn btn-danger" data-force>${L2('Hand in a transfer request', 'Transfer talebinde bulun')}</button>` : `
          <div class="ng-row"><span>${L2('Weekly wage', 'Haftalık maaş')}</span><div class="ng-step"><button data-w="-1">−</button><b>${money(ask.wage)}</b><button data-w="1">+</button></div><small>${L2('Offer', 'Teklif')}: ${money(o.wage)}</small></div>
          <div class="ng-row"><span>${L2('Years', 'Yıl')}</span><div class="seg small">${[1, 2, 3, 4, 5].map((y) => `<button class="${ask.years === y ? 'on' : ''}" data-y="${y}">${y}</button>`).join('')}</div></div>
          <div class="ng-row"><span>${L2('Role', 'Rol')}</span><div class="seg small">${ROLES.map((r) => `<button class="${ask.role === r ? 'on' : ''}" data-r="${r}">${roleName(r)}</button>`).join('')}</div></div>
          ${o.kind !== 'loan' ? `<div class="ng-row"><span>${L2('Release clause', 'Serbest kalma bedeli')}</span><div class="ng-step"><button data-cl="-1">−</button><b>${money(ask.clause)}</b><button data-cl="1">+</button></div></div>` : ''}
          <div class="ng-agent">💼 ${esc(msg)}</div>
          <div class="row"><button class="btn btn-ghost" data-reject>${L2('Reject', 'Reddet')}</button><button class="btn btn-ghost" data-counter>${L2('Counter-offer', 'Karşı teklif')}</button><button class="btn btn-primary" data-sign>${L2('Sign', 'İmzala')} ✍️</button></div>`}
        </div>
      </div>
    </div>`, 'sheet wide');
    m.querySelector('[data-x]')?.addEventListener('click', () => closeModal());
    m.querySelectorAll<HTMLElement>('[data-w]').forEach((b) => b.addEventListener('click', () => { ask.wage = Math.max(100, Math.round((ask.wage * (1 + Number(b.dataset.w) * 0.05)) / 50) * 50); audio.click(); draw(); }));
    m.querySelectorAll<HTMLElement>('[data-cl]').forEach((b) => b.addEventListener('click', () => { ask.clause = Math.max(100000, Math.round((ask.clause * (1 + Number(b.dataset.cl) * 0.15)) / 100000) * 100000); audio.click(); draw(); }));
    m.querySelectorAll<HTMLElement>('[data-y]').forEach((b) => b.addEventListener('click', () => { ask.years = Number(b.dataset.y); audio.click(); draw(); }));
    m.querySelectorAll<HTMLElement>('[data-r]').forEach((b) => b.addEventListener('click', () => { ask.role = b.dataset.r as Role; audio.click(); draw(); }));
    m.querySelector('[data-reject]')?.addEventListener('click', () => { o.status = 'rejected'; saveCareer(); closeModal(); rerender(); });
    m.querySelector('[data-force]')?.addEventListener('click', () => {
      o.clubOk = true;
      c.me.rel.manager = Math.max(0, c.me.rel.manager - 15);
      c.me.rel.fans = Math.max(0, c.me.rel.fans - 12);
      c.me.image -= 5;
      toast(L2('Transfer request submitted. The fans are not happy…', 'Transfer talebi verildi. Taraftar hiç memnun değil…'));
      saveCareer();
      draw();
    });
    m.querySelector('[data-counter]')?.addEventListener('click', () => {
      const r = negotiate(c, o, ask);
      audio.click();
      if (r === 'accept') { msg = L2('"They accepted your terms! Sign it."', '"Şartlarını kabul ettiler! İmzala."'); Object.assign(ask, { wage: o.wage, years: o.years, role: o.role, clause: o.clause }); }
      else if (r === 'walk') { saveCareer(); closeModal(); toast(L2(`${k.name} walked away from the talks.`, `${k.name} masadan kalktı.`)); rerender(); return; }
      else { msg = L2(`"They came back with ${money(o.wage)}/wk as ${roleName(o.role)}."`, `"${roleName(o.role)} rolüyle haftalık ${money(o.wage)} ile döndüler."`); Object.assign(ask, { wage: o.wage, role: o.role, clause: o.clause, years: o.years }); }
      saveCareer();
      draw();
    });
    m.querySelector('[data-sign]')?.addEventListener('click', () => {
      // signing the current offer as it stands (counter first to change terms)
      signOffer(c, o);
      saveCareer();
      closeModal();
      audio.horn();
      toast(L2('Signed! ✍️', 'İmzalandı! ✍️'));
      rerender();
    });
  };
  draw();
  void ROLE_RANK;
}

// ------------------------------------------------------------------ life

function lifeTab(c: Career, rerender: () => void): R {
  const me = c.me;
  const sp = me.sponsors.map((s) => SPONSORS.find((x) => x.id === s.id)!).filter(Boolean);
  const income = (c.contract?.wage ?? 0) + sp.reduce((a, s) => a + s.pay, 0);
  const groups: ['home' | 'car' | 'staff', string][] = [['home', L2('HOME', 'EV')], ['car', L2('GARAGE', 'GARAJ')], ['staff', L2('PERSONAL STAFF', 'KİŞİSEL EKİP')]];
  return {
    html: `<div class="lf">
      <div class="lf-left">
        <div class="lf-bank"><small>${L2('BANK', 'BANKA')}</small><b>${money(me.money)}</b><div><span>+${money(income)}/${L2('wk', 'hf')}</span><span class="neg">−${money(weeklyUpkeep(c))}/${L2('wk', 'hf')}</span></div></div>
        <div class="lf-sp"><small>${L2('SPONSORS', 'SPONSORLAR')}</small>${sp.length ? sp.map((s) => `<div class="lf-spi" style="--c:${s.color}"><b>${esc(s.name)}</b><span>${money(s.pay)}/${L2('wk', 'hf')} · #${esc(s.tag)}</span></div>`).join('') : `<p class="cr-hint">${L2('Brands come when your following grows. Next target:', 'Takipçin büyüdükçe markalar gelir. Sonraki hedef:')} ${compact((SPONSORS.find((s) => s.minF * 1000 > me.followers)?.minF ?? 0) * 1000)}</p>`}</div>
      </div>
      <div class="lf-shop">${groups.map(([g, gl]) => `<div class="lf-g"><small>${gl}</small><div class="lf-items">${LIFE.filter((i) => i.group === g).map((i) => {
        const own = owns(c, i.id);
        const locked = !!i.req && !owns(c, i.req);
        return `<button class="lf-it ${own ? 'own' : ''} ${locked ? 'lock' : ''}" data-life="${i.id}" ${locked ? 'disabled' : ''}><i>${i.icon}</i><b>${esc(LP(i.name))}</b><span>${esc(LP(i.desc))}</span><em>${own ? (i.group === 'staff' ? L2('Hired · tap to let go', 'İşe alındı · bırakmak için dokun') : L2('Owned', 'Sahipsin')) : `${i.price ? money(i.price) : ''}${i.weekly ? ` · ${money(i.weekly)}/${L2('wk', 'hf')}` : ''}`}</em></button>`;
      }).join('')}</div></div>`).join('')}</div>
    </div>`,
    bind: (root) => {
      root.querySelectorAll<HTMLElement>('[data-life]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.life!;
        if (owns(c, id)) {
          dropLife(c, id);
          saveCareer();
          rerender();
          return;
        }
        const err = buyLife(c, id);
        if (err) { toast(err); audio.groan(); return; }
        if (err === '') { audio.horn(); toast(L2('Bought! ✨', 'Satın alındı! ✨')); c.me.morale = Math.min(100, c.me.morale + 4); }
        saveCareer();
        rerender();
      }));
    },
  };
}

// ------------------------------------------------------------------ legacy

function legacyTab(c: Career, rerender: () => void, h: MenuHandlers): R {
  const rew = c.rewards.reduce((a, r) => a + r.coins, 0);
  return {
    html: `<div class="lg2">
      <div class="lg2-left">
        <div class="lg2-score"><small>${L2('LEGACY', 'MİRAS')}</small><b>${legacyScore(c)}</b><span>${esc(legacyTier(c))}</span></div>
        ${rew ? `<button class="btn btn-primary" data-act="collect">${L2('Collect', 'Topla')} +${rew} ${L2('coins', 'altın')} 🪙</button><small class="cr-hint">${L2('Rewards go to your main profile (crates, items, boots).', 'Ödüller ana profiline gider (kasalar, eşyalar, kramponlar).')}</small>` : ''}
        <div class="lg2-cab"><small>${L2('TROPHY CABINET', 'KUPA DOLABI')}</small><div>${c.trophies.length ? c.trophies.map((x) => `<span class="cup">🏆<b>${esc(LP(x.name))}</b><i>S${x.season}</i></span>`).join('') : `<p class="cr-hint">${L2('Empty… for now.', 'Boş… şimdilik.')}</p>`}</div></div>
        <div class="lg2-cab"><small>${L2('AWARDS', 'ÖDÜLLER')}</small><div>${c.awards.length ? c.awards.map((x) => `<span class="cup aw">${x.key === 'ball' ? '🌟' : '🏅'}<b>${esc(LP(x.name))}</b><i>S${x.season}</i></span>`).join('') : `<p class="cr-hint">—</p>`}</div></div>
      </div>
      <div class="lg2-story"><small>${L2('YOUR STORY', 'HİKÂYEN')}</small><button class="lg2-del" data-act="del">${L2('Delete career', 'Kariyeri sil')}</button>${[...c.moments].reverse().map((m) => `<div class="lg2-m"><i>${m.icon}</i><div><b>${esc(LP(m.title))}</b><span>${esc(LP(m.sub))}</span></div><em>S${m.season} · ${L2('W', 'H')}${m.week}</em></div>`).join('')}</div>
    </div>`,
    bind: (root) => {
      root.querySelector('[data-act=collect]')?.addEventListener('click', () => { collectRewards(c); rerender(); });
      root.querySelector('[data-act=del]')?.addEventListener('click', () => {
        const m = modal(`<div class="tr-result"><div class="cr-mh"><b>${L2('Delete this career?', 'Bu kariyer silinsin mi?')}</b></div><p>${L2('Everything in this save is lost. Uncollected rewards are added to your main profile first.', 'Bu kayıttaki her şey silinir. Toplanmamış ödüller önce ana profiline eklenir.')}</p><div class="row"><button class="btn btn-ghost" data-x>${L2('Cancel', 'İptal')}</button><button class="btn btn-danger" data-go>${L2('Delete', 'Sil')}</button></div></div>`, 'sheet');
        m.querySelector('[data-x]')?.addEventListener('click', () => closeModal());
        m.querySelector('[data-go]')?.addEventListener('click', () => { closeModal(); collectRewards(c); setCareer(null); showCareer(h); });
      });
    },
  };
}

void avg;
void overall;
void playerName;
void ratingClass;

// ------------------------------------------------------------------ edit mode (names, like the classic option files)

function editPicker(c: Career, comp: Competition | null | undefined, rerender: () => void) {
  const ids = (comp?.teams ?? []).filter((id) => c.clubs[id]);
  const m = modal(`<div class="ed">
    <div class="cr-mh"><b>✎ ${L2('Edit mode', 'Düzenleme modu')}</b><button class="cr-x" data-x>✕</button></div>
    <p class="cr-hint">${L2('Rename clubs and players in this save. Changes stay in your own career only.', 'Bu kayıttaki kulüp ve oyuncu isimlerini değiştir. Değişiklikler sadece kendi kariyerinde kalır.')}</p>
    <div class="ed-clubs">${ids.map((id) => `<button data-club="${id}">${crestOf(c, id, 'crest-sm')}<span>${esc(clubName(c, id))}</span></button>`).join('') || `<p class="cr-hint">${L2('Pick a league or cup first.', 'Önce bir lig ya da kupa seç.')}</p>`}</div>
  </div>`, 'sheet wide');
  m.querySelector('[data-x]')?.addEventListener('click', () => closeModal());
  m.querySelectorAll<HTMLElement>('[data-club]').forEach((b) => b.addEventListener('click', () => { audio.click(); editClub(c, b.dataset.club!, comp, rerender); }));
}

function editClub(c: Career, id: string, comp: Competition | null | undefined, rerender: () => void) {
  const k = c.clubs[id];
  const players = k.squad.map((pid) => c.npcs[pid]).filter(Boolean);
  const m = modal(`<div class="ed">
    <div class="cr-mh"><b>${crestOf(c, id, 'crest-sm')} ${esc(k.name)}</b><button class="cr-x" data-x>✕</button></div>
    <div class="ed-form">
      <label>${L2('Club name', 'Kulüp adı')}<input class="ed-in" data-f="name" maxlength="28" value="${esc(k.name)}"></label>
      <label>${L2('Short (3)', 'Kısaltma (3)')}<input class="ed-in short" data-f="short" maxlength="3" value="${esc(k.short)}"></label>
      <label>${L2('Stadium', 'Stadyum')}<input class="ed-in" data-f="stadium" maxlength="28" value="${esc(k.stadium)}"></label>
      <label>${L2('Manager', 'Teknik direktör')}<input class="ed-in" data-f="manager" maxlength="28" value="${esc(k.manager)}"></label>
      <div class="ed-players"><small>${L2('PLAYERS', 'OYUNCULAR')}</small>${players.map((p) => `<label><span class="pos p-${p.pos}">${t().pos[p.pos]}</span><input class="ed-in" data-p="${p.id}" maxlength="24" value="${esc(p.name)}"><input class="ed-in num" data-n="${p.id}" type="number" min="1" max="99" value="${p.num}"></label>`).join('')}</div>
    </div>
    <div class="row"><button class="btn btn-ghost" data-back>‹ ${L2('Clubs', 'Kulüpler')}</button><button class="btn btn-primary" data-save>${L2('Save', 'Kaydet')}</button></div>
  </div>`, 'sheet wide');
  m.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
  m.querySelector('[data-x]')?.addEventListener('click', () => closeModal());
  m.querySelector('[data-back]')?.addEventListener('click', () => editPicker(c, comp, rerender));
  m.querySelector('[data-save]')?.addEventListener('click', () => {
    const val = (f: string) => (m.querySelector<HTMLInputElement>(`[data-f=${f}]`)?.value ?? '').trim();
    if (val('name')) {
      k.name = val('name');
      k.handle = k.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 15) || k.handle;
    }
    if (val('short')) k.short = val('short').toUpperCase().slice(0, 3);
    if (val('stadium')) k.stadium = val('stadium');
    if (val('manager')) k.manager = val('manager');
    m.querySelectorAll<HTMLInputElement>('[data-p]').forEach((i) => { const p = c.npcs[i.dataset.p!]; if (p && i.value.trim()) p.name = i.value.trim(); });
    m.querySelectorAll<HTMLInputElement>('[data-n]').forEach((i) => { const p = c.npcs[i.dataset.n!]; const n = Math.round(Number(i.value)); if (p && n >= 1 && n <= 99) p.num = n; });
    saveCareer();
    audio.select();
    toast(L2('Saved ✔', 'Kaydedildi ✔'));
    editPicker(c, comp, rerender);
    rerender();
  });
}
