/** Career screens: start, creator, trial, home, match flow, story moments, season review, gala. */
import type { Career, LastMatch, MyPos, Personality, Backstory, Offer } from '../../career/types';
import { career, setCareer, saveCareer, C } from '../../career/state';
import {
  newCareer, trialOffers, signFirstContract, matchInfo, simUserMatch, applyUserMatch, finishWeek, weekLabel, userFixture, SimEvent, lastReview, lastGala, playerName,
  nextFixtures, legacyScore, legacyTier, retire, oppDifficulty, injure,
} from '../../career/season';
import { careerMatchConfig, drillConfig, drillGrade, lineFromMatch } from '../../career/play';
import { FOCUS, INTENSITY, train, objectiveText, roleName, BACKSTORIES, PERSONALITIES, avg } from '../../career/me';
import { pressQuestions, applyPress, PressQ } from '../../career/media';
import { clubName, teamStrength, myOvr, isNat, roundName, compName, compShort, simPens } from '../../career/world';
import { NATIONS, nationBy } from '../../career/data';
import { L2, LP, money, compact } from '../../career/util';
import { npcPortrait, shell, Tab, esc, myPortrait, mySprite, crestOf, bar, formChips, ratingClass, modal, closeModal, flagTag, NEUTRAL, ui } from './kit';
import { setScreen, bind, toast, MenuHandlers, paintTag, portraitSource, lookFor, spriteSource } from '../common';
import { renderTab } from './tabs';
import { compose } from './phone';
import { audio, vibrate } from '../../engine/audio';
import { showHub } from '../hub';
import { SKINS, HAIRS, HAIR_STYLES, FACES, EYE_STYLES, EYE_COLORS } from '../../meta/cards';
import type { Difficulty } from '../../game/entities';
import type { Match } from '../../game/match';
import { record, saveRecord, settings } from '../../engine/storage';
import { t } from '../../engine/i18n';
import { clamp } from '../../engine/math';

let H: MenuHandlers;
let tab: Tab = 'home';

// ------------------------------------------------------------------ entry & routing

export function showCareer(h: MenuHandlers, to?: Tab): void {
  H = h;
  if (to) tab = to;
  const c = career();
  if (!c) return showCareerStart();
  if (c.phase === 'trial') return c.offers.length ? showTrialOffers() : showTrialIntro();
  if (c.queue.length) return showMoment();
  if (c.flags.review && c.flags.review !== c.flags.reviewSeen) return showReview();
  if (c.flags.gala && c.flags.gala !== c.flags.galaSeen && lastGala) return showGala();
  if (c.phase === 'retired') return showRetired();
  render();
}

function render() {
  const c = C();
  const { html, bind: binder } = tab === 'home' ? homeTab(c) : renderTab(c, tab, H, () => render(), (t2) => { tab = t2; render(); });
  setScreen('screen-career', shell(c, tab, html));
  const root = ui();
  bind('[data-act=cr-exit]', () => { audio.click(); showHub(H); });
  bind('[data-tab]', (b) => { tab = b.dataset.tab as Tab; audio.click(); render(); });
  binder(root);
}

export function rerenderCareer() {
  render();
}

// ------------------------------------------------------------------ start

function showCareerStart() {
  setScreen('screen-career', `<div class="cr-start">
    <div class="cs-scene cs-art"><div class="cs-lights"></div>${paintTag(spriteSource(lookFor(NEUTRAL, { skin: SKINS[2], hair: HAIRS[0], hairStyle: 3, beard: false }), 'kick1'), 'cs-hero')}</div>
    <div class="cs-copy">
      <div class="kick">${L2('NEW MODE', 'YENİ MOD')}</div>
      <h1>${L2('PLAYER CAREER', 'OYUNCU KARİYERİ')}</h1>
      <p>${L2('Seventeen years old, one trial match, three scouts in the stands. From the second division to the Golden Ball: transfers, rivals, the press, your phone that never stops buzzing… and a world with no referees.', 'On yedi yaşındasın, bir deneme maçı, tribünde üç scout. İkinci ligden Altın Top\'a: transferler, rakipler, basın, hiç susmayan telefonun… ve hakemi olmayan bir dünya.')}</p>
      <ul class="cs-feats">
        <li>⚽ ${L2('Control only YOUR player · call for the ball', 'Sadece KENDİ oyuncunu yönet · topu iste')}</li>
        <li>📱 ${L2('KICKR social feed, DMs, press, rumours', 'KICKR sosyal akışı, DM, basın, söylentiler')}</li>
        <li>✍️ ${L2('Contracts, transfers, loans, agents', 'Sözleşmeler, transferler, kiralıklar, menajerler')}</li>
        <li>🏆 ${L2('Leagues, cups, Champions Cup, Nations Cup, awards', 'Ligler, kupalar, Şampiyonlar Kupası, Uluslar Kupası, ödüller')}</li>
      </ul>
      <div class="row"><button class="btn btn-ghost" data-act="back">‹ ${L2('BACK', 'GERİ')}</button><button class="btn btn-primary btn-start" data-act="new">${L2('START YOUR STORY', 'HİKÂYENE BAŞLA')} ▶</button></div>
    </div>
  </div>`);
  bind('[data-act=back]', () => { audio.click(); showHub(H); });
  bind('[data-act=new]', () => { audio.select(); showCreatorWizard(); });
}

// ------------------------------------------------------------------ creator wizard

interface Draft {
  name: string; nat: string; num: number; foot: 'R' | 'L'; pos: MyPos; personality: Personality; backstory: Backstory;
  look: { skin: string; hair: string; hairStyle: number; beard: boolean; face: number; eyes: number; eyeColor: string };
  difficulty: Difficulty; duration: number;
}

let draft: Draft | null = null;

function showCreatorWizard(step = 0) {
  draft ??= {
    name: settings.lang === 'tr' ? 'Deniz Kaya' : 'Alex Storm', nat: settings.lang === 'tr' ? 'tr' : 'en', num: 9, foot: 'R', pos: 'FWD', personality: 'confident', backstory: 'academy',
    look: { skin: SKINS[1], hair: HAIRS[1], hairStyle: 2, beard: false, face: 0, eyes: 0, eyeColor: EYE_COLORS[0] }, difficulty: 'normal', duration: 180,
  };
  const d = draft;
  const steps = [L2('Identity', 'Kimlik'), L2('Style', 'Tarz'), L2('Look', 'Görünüm'), L2('Settings', 'Ayarlar')];
  let body = '';
  if (step === 0) {
    body = `
      <div class="ce-row"><label for="cw-name">${L2('Name', 'İsim')}</label><input id="cw-name" maxlength="20" value="${esc(d.name)}"></div>
      <div class="ce-row"><label for="cw-num">${L2('Shirt number', 'Forma numarası')}</label><input id="cw-num" type="number" min="1" max="99" value="${d.num}" class="short-in"></div>
      <div class="ce-row col"><span>${L2('Nationality', 'Uyruk')}</span><div class="cw-nats">${NATIONS.map((n) => `<button class="cw-nat ${d.nat === n.code ? 'on' : ''}" data-nat="${n.code}">${flagTag(n.code, 'cw-flag')}<small>${esc(LP([n.en, n.tr]))}</small></button>`).join('')}</div></div>
      <div class="ce-row"><span>${L2('Stronger foot', 'Güçlü ayak')}</span><div class="seg small"><button class="${d.foot === 'R' ? 'on' : ''}" data-foot="R">${L2('Right', 'Sağ')}</button><button class="${d.foot === 'L' ? 'on' : ''}" data-foot="L">${L2('Left', 'Sol')}</button></div></div>`;
  } else if (step === 1) {
    body = `
      <div class="ce-row col"><span>${L2('Position', 'Mevki')}</span><div class="cw-cards three">${(['DEF', 'MID', 'FWD'] as MyPos[]).map((p) => `<button class="cw-card ${d.pos === p ? 'on' : ''}" data-pos="${p}"><b>${t().pos[p]}</b><small>${({ DEF: L2('Wall at the back. Tackles, shoves, blocks.', 'Arkada duvar. Müdahale, itme, blok.'), MID: L2('The brain. Passes, tempo, late runs.', 'Beyin. Pas, tempo, geç koşular.'), FWD: L2('Goals. Pace. Pressure. Headlines.', 'Gol. Hız. Baskı. Manşetler.') } as Record<MyPos, string>)[p]}</small></button>`).join('')}</div></div>
      <div class="ce-row col"><span>${L2('Backstory', 'Geçmiş')}</span><div class="cw-cards">${BACKSTORIES.map((b) => `<button class="cw-card ${d.backstory === b.id ? 'on' : ''}" data-bs="${b.id}"><b>${esc(LP(b.name))}</b><small>${esc(LP(b.desc))}</small></button>`).join('')}</div></div>
      <div class="ce-row col"><span>${L2('Personality', 'Kişilik')}</span><div class="cw-cards">${PERSONALITIES.map((p) => `<button class="cw-card ${d.personality === p.id ? 'on' : ''}" data-ps="${p.id}"><b>${p.icon} ${esc(LP(p.name))}</b><small>${esc(LP(p.desc))}</small></button>`).join('')}</div></div>`;
  } else if (step === 2) {
    const kit = NEUTRAL;
    const L = t();
    body = `
      <div class="ce-row"><span>${L.skin}</span><div class="swatches">${SKINS.map((c) => `<button class="sw ${d.look.skin === c ? 'on' : ''}" data-skin="${c}" style="--c:${c}"></button>`).join('')}</div></div>
      <div class="ce-row"><span>${L.hairColor}</span><div class="swatches">${HAIRS.map((c) => `<button class="sw ${d.look.hair === c ? 'on' : ''}" data-hc="${c}" style="--c:${c}"></button>`).join('')}</div></div>
      <div class="ce-row"><span>${L.hairStyle}</span><div class="opts">${Array.from({ length: HAIR_STYLES }, (_, i) => `<button class="opt-c ${d.look.hairStyle === i ? 'on' : ''}" data-hs="${i}">${paintTag(portraitSource(lookFor(kit, { ...d.look, hairStyle: i })), 'face-ic')}</button>`).join('')}</div></div>
      <div class="ce-row"><span>${L.faceShape}</span><div class="opts">${Array.from({ length: FACES }, (_, i) => `<button class="opt-c ${d.look.face === i ? 'on' : ''}" data-fc="${i}">${paintTag(portraitSource(lookFor(kit, { ...d.look, face: i })), 'face-ic')}</button>`).join('')}</div></div>
      <div class="ce-row"><span>${L.eyeStyle}</span><div class="opts">${Array.from({ length: EYE_STYLES }, (_, i) => `<button class="opt-c ${d.look.eyes === i ? 'on' : ''}" data-ey="${i}"><span class="eye-crop">${paintTag(portraitSource(lookFor(kit, { ...d.look, eyes: i })), 'eye-ic')}</span></button>`).join('')}</div></div>
      <div class="ce-row"><span>${L.eyeColor}</span><div class="swatches">${EYE_COLORS.map((c) => `<button class="sw ${d.look.eyeColor === c ? 'on' : ''}" data-ec="${c}" style="--c:${c}"></button>`).join('')}</div></div>
      <div class="ce-row"><span>${L.beard}</span><button class="toggle ${d.look.beard ? 'on' : ''}" data-act="beard"><i></i></button></div>`;
  } else {
    const diffs: [Difficulty, string, string][] = [
      ['easy', L2('Easy', 'Kolay'), L2('Learn the ropes', 'Alış')], ['normal', L2('Normal', 'Normal'), L2('Balanced', 'Dengeli')], ['hard', L2('Hard', 'Zor'), L2('Earn every minute', 'Her dakikayı hak et')], ['insane', L2('Insane', 'Çılgın'), L2('For legends only', 'Sadece efsaneler')],
    ];
    body = `
      <div class="ce-row col"><span>${L2('Difficulty', 'Zorluk')}</span><div class="cw-cards four">${diffs.map(([id, n, s]) => `<button class="cw-card ${d.difficulty === id ? 'on' : ''}" data-df="${id}"><b>${n}</b><small>${s}</small></button>`).join('')}</div></div>
      <div class="ce-row"><span>${L2('Match length', 'Maç süresi')}</span><div class="seg small">${[120, 180, 240].map((s) => `<button class="${d.duration === s ? 'on' : ''}" data-dur="${s}">${s / 60} ${L2('min', 'dk')}</button>`).join('')}</div></div>
      <p class="cr-hint">${L2('In career matches you control only your own player. Tap PASS without the ball to call for it: the better your relationship with your team-mates, the more they look for you.', 'Kariyer maçlarında sadece kendi oyuncunu yönetirsin. Top sende değilken PAS tuşuna bas ve topu iste: takım arkadaşlarınla ilişkin ne kadar iyiyse sana o kadar çok pas atarlar.')}</p>`;
  }
  const preview = `${paintTag(portraitSource(lookFor(NEUTRAL, d.look)), 'cw-portrait')}${paintTag(spriteSource(lookFor(NEUTRAL, d.look), 'idle0'), 'cw-sprite')}
    <div class="cw-id"><b>${esc(d.name)}</b><small>${flagTag(d.nat, 'cr-flag-xs')} ${esc(LP([nationBy(d.nat).en, nationBy(d.nat).tr]))} · #${d.num} · ${t().pos[d.pos]}</small><small>17 ${L2('years old', 'yaşında')}</small></div>`;
  setScreen('screen-editor', `<div class="editor cw">
    <div class="panel-head">
      <button class="btn btn-ghost btn-sm" data-act="prev">‹ ${step ? L2('BACK', 'GERİ') : L2('CANCEL', 'İPTAL')}</button>
      <div class="cw-steps">${steps.map((s, i) => `<span class="${i === step ? 'on' : i < step ? 'done' : ''}">${i + 1}. ${s}</span>`).join('')}</div>
      <button class="btn btn-primary btn-sm" data-act="next">${step < 3 ? L2('NEXT', 'İLERİ') + ' ▶' : L2('TO THE TRIAL', 'DENEMEYE') + ' ▶'}</button>
    </div>
    <div class="editor-body"><div class="cw-preview">${preview}</div><div class="ce-form">${body}</div></div>
  </div>`);
  const redo = () => showCreatorWizard(step);
  const nameIn = document.getElementById('cw-name') as HTMLInputElement | null;
  const numIn = document.getElementById('cw-num') as HTMLInputElement | null;
  for (const inp of [nameIn, numIn]) inp?.addEventListener('keydown', (e) => e.stopPropagation());
  const sync = () => {
    if (nameIn) d.name = nameIn.value.trim().slice(0, 20) || d.name;
    if (numIn) d.num = clamp(Math.round(Number(numIn.value) || d.num), 1, 99);
  };
  bind('[data-act=prev]', () => { sync(); audio.click(); if (step) showCreatorWizard(step - 1); else showCareerStart(); });
  bind('[data-act=next]', () => {
    sync();
    audio.select();
    if (step < 3) return showCreatorWizard(step + 1);
    const c = newCareer({ me: { name: d.name, nat: d.nat, pos: d.pos, foot: d.foot, num: d.num, personality: d.personality, backstory: d.backstory, look: { ...d.look } }, difficulty: d.difficulty, duration: d.duration });
    setCareer(c);
    draft = null;
    showTrialIntro();
  });
  bind('[data-nat]', (b) => { sync(); d.nat = b.dataset.nat!; audio.click(); redo(); });
  bind('[data-foot]', (b) => { sync(); d.foot = b.dataset.foot as 'R' | 'L'; audio.click(); redo(); });
  bind('[data-pos]', (b) => { d.pos = b.dataset.pos as MyPos; audio.click(); redo(); });
  bind('[data-bs]', (b) => { d.backstory = b.dataset.bs as Backstory; audio.click(); redo(); });
  bind('[data-ps]', (b) => { d.personality = b.dataset.ps as Personality; audio.click(); redo(); });
  bind('[data-skin]', (b) => { d.look.skin = b.dataset.skin!; audio.click(); redo(); });
  bind('[data-hc]', (b) => { d.look.hair = b.dataset.hc!; audio.click(); redo(); });
  bind('[data-hs]', (b) => { d.look.hairStyle = Number(b.dataset.hs); audio.click(); redo(); });
  bind('[data-fc]', (b) => { d.look.face = Number(b.dataset.fc); audio.click(); redo(); });
  bind('[data-ey]', (b) => { d.look.eyes = Number(b.dataset.ey); audio.click(); redo(); });
  bind('[data-ec]', (b) => { d.look.eyeColor = b.dataset.ec!; audio.click(); redo(); });
  bind('[data-act=beard]', () => { d.look.beard = !d.look.beard; audio.click(); redo(); });
  bind('[data-df]', (b) => { d.difficulty = b.dataset.df as Difficulty; audio.click(); redo(); });
  bind('[data-dur]', (b) => { d.duration = Number(b.dataset.dur); audio.click(); redo(); });
}

// ------------------------------------------------------------------ trial

function showTrialIntro() {
  const c = C();
  setScreen('screen-career', `<div class="cr-story">
    <div class="cs-scene">${mySprite(c, 'idle0', 'cs-hero', NEUTRAL)}<div class="cs-scouts">${['🧢', '🕶️', '📋'].map((e) => `<span>${e}</span>`).join('')}</div></div>
    <div class="cs-text">
      <div class="kick">${L2('CHAPTER 1', 'BÖLÜM 1')} · ${L2('THE TRIAL', 'DENEME MAÇI')}</div>
      <h2>${L2('One match. Everything on the line.', 'Tek maç. Her şey ortada.')}</h2>
      <p>${L2(`Rain on a municipal pitch. Three scouts in the stand, notebooks open. You are ${c.me.age}, wearing number ${c.me.num}, and nobody outside your town knows your name. Yet.`, `Belediye sahasına yağmur yağıyor. Tribünde üç scout, defterler açık. ${c.me.age} yaşındasın, sırtında ${c.me.num} numara var ve kasaban dışında kimse adını bilmiyor. Henüz.`)}</p>
      <p class="cr-hint">${L2('Your match rating decides which clubs make an offer. 7.0+ catches a top-flight eye, 8.3+ turns heads at the big ones.', 'Maç notun hangi kulüplerin teklif yapacağını belirler. 7.0+ üst lig kulüplerinin dikkatini çeker, 8.3+ büyükleri bile yerinden oynatır.')}</p>
      <div class="row"><button class="btn btn-ghost" data-act="sim">${L2('Simulate', 'Simüle et')} ⏩</button><button class="btn btn-primary btn-start" data-act="play">${L2('PLAY THE TRIAL', 'DENEMEYİ OYNA')} ▶</button></div>
    </div>
  </div>`);
  bind('[data-act=play]', () => {
    audio.select();
    const setup = careerMatchConfig(c, true);
    H.playCareer(setup.cfg, (m) => {
      const line = lineFromMatch(c, m, false, null, true);
      const { rating } = rateTrial(c, line);
      trialDone(rating, true);
    });
  });
  bind('[data-act=sim]', () => {
    audio.click();
    const r = Math.round(clamp(6.6 + (Math.random() - 0.4) * 1.6, 5.5, 8.4) * 10) / 10;
    trialDone(r, false);
  });
}

function rateTrial(c: Career, line: ReturnType<typeof lineFromMatch>) {
  // trial ratings lean on what scouts look for
  let r = 6 + line.goals * 1 + line.assists * 0.7 + line.onTarget * 0.15 + Math.min(1.2, line.steals * 0.2) + Math.min(0.8, line.passOk * 0.06) - Math.min(1, line.lost * 0.1) + (line.gf > line.ga ? 0.3 : line.gf < line.ga ? -0.2 : 0);
  r = Math.round(clamp(r, 4, 10) * 10) / 10;
  void c;
  return { rating: r };
}

function trialDone(rating: number, played: boolean) {
  const c = C();
  trialOffers(c, rating);
  c.flags.trialRating = rating;
  c.flags.trialPlayed = played ? 1 : 0;
  saveCareer();
  showTrialOffers();
}

function offerCard(c: Career, o: Offer, i: number) {
  const k = c.clubs[o.club];
  const lg = c.comps.find((x) => x.kind === 'league' && x.teams.includes(k.id));
  return `<button class="to-card" data-pick="${i}" style="--c:${k.primary};--c2:${k.secondary}">
    <div class="to-crest">${crestOf(c, k.id, 'crest-xl')}</div>
    <b>${esc(k.name)}</b>
    <small>${flagTag(k.nat, 'cr-flag-xs')} ${esc(lg ? LP(lg.name) : '')}</small>
    <div class="to-rep">${L2('Prestige', 'Prestij')} ${'★'.repeat(Math.max(1, Math.round(k.rep / 20)))}</div>
    <div class="to-terms"><span>${L2('Role', 'Rol')}<b>${roleName(o.role)}</b></span><span>${L2('Wage', 'Maaş')}<b>${money(o.wage)}/${L2('wk', 'hf')}</b></span><span>${L2('Contract', 'Sözleşme')}<b>${o.years} ${L2('yrs', 'yıl')}</b></span></div>
    <p>${esc(o.note ?? '')}</p>
    <em>${L2('SIGN', 'İMZALA')} ✍️</em>
  </button>`;
}

function showTrialOffers() {
  const c = C();
  const r = c.flags.trialRating ?? 6.5;
  setScreen('screen-career', `<div class="cr-offers">
    <div class="to-head"><div><div class="kick">${L2('TRIAL RESULT', 'DENEME SONUCU')}</div><h2>${L2('The scouts have spoken', 'Scoutlar kararını verdi')}</h2></div><div class="to-rating ${ratingClass(r)}"><small>${L2('RATING', 'NOT')}</small><b>${r.toFixed(1)}</b></div></div>
    <p class="cr-hint">${L2('Pick your first club. A small club means minutes now; a big one means waiting for your chance.', 'İlk kulübünü seç. Küçük kulüp şimdi süre demek; büyük kulüp şansını beklemek demek.')}</p>
    <div class="to-list">${c.offers.map((o, i) => offerCard(c, o, i)).join('')}</div>
  </div>`);
  bind('[data-pick]', (b) => {
    const o = c.offers[Number(b.dataset.pick)];
    audio.horn();
    signFirstContract(c, o);
    saveCareer();
    showCareer(H, 'home');
  });
}

// ------------------------------------------------------------------ home

function selLabel(sel: string | null) {
  return ({ start: L2('STARTING', 'İLK 11'), sub: L2('ON THE BENCH · WILL COME ON', 'YEDEK · OYUNA GİRECEK'), bench: L2('UNUSED SUB', 'KULÜBEDE'), out: L2('NOT IN SQUAD', 'KADRO DIŞI') } as Record<string, string>)[sel ?? 'out'];
}

function homeTab(c: Career) {
  const me = c.me;
  const info = matchInfo(c);
  const f = userFixture(c);
  const playable = !!info && !c.ws.played && (c.ws.sel === 'start' || c.ws.sel === 'sub');
  const club = c.contract?.club;
  const ovr = myOvr(c);
  const left = `<section class="hm-me">
    <div class="hm-card" style="--c:${club ? c.clubs[club].primary : '#3a4766'}">
      <div class="hm-ovr"><b>${ovr}</b><small>${t().pos[me.pos]}</small></div>
      ${myPortrait(c, 'hm-face')}
      ${me.injury ? `<div class="stamp hm-inj">🚑 ${me.injury.weeks} ${L2('WK', 'HF')}</div>` : ''}
      ${me.captain ? '<div class="hm-cap">C</div>' : ''}
    </div>
    <div class="hm-name"><b>${esc(me.name)}</b><small>${flagTag(me.nat, 'cr-flag-xs')} ${me.age} · ${c.contract ? roleName(c.contract.role) : L2('Free agent', 'Serbest')} · ${L2('Lv', 'Sv')} ${me.level}</small></div>
    ${bar(L2('Fitness', 'Kondisyon'), me.fitness, me.fitness < 45 ? 'warn' : 'fit')}
    ${bar(L2('Morale', 'Moral'), me.morale, 'mor')}
    ${bar(L2('Sharpness', 'Keskinlik'), me.sharpness, 'shp')}
    <div class="hm-form"><small>${L2('FORM', 'FORM')}</small>${formChips(c)}</div>
  </section>`;
  let center: string;
  if (info && f) {
    const opp = info.opp;
    const oppStr = teamStrength(c, opp), myStr = teamStrength(c, info.team);
    const diff = oppDifficulty(c, info.team, opp);
    const res = f.played ? `${info.home ? f.hg : f.ag} - ${info.home ? f.ag : f.hg}` : 'VS';
    center = `<section class="hm-week">
      <div class="hm-wk-head"><span class="hm-comp">${esc(compName(c, f.comp))}</span><span>${esc(roundName(f.round))} · ${info.home ? L2('Home', 'İç saha') : L2('Away', 'Deplasman')}</span>${info.big ? `<span class="hm-big">${L2('BIG MATCH', 'BÜYÜK MAÇ')}</span>` : ''}</div>
      <div class="hm-fx">
        <div class="hm-team">${crestOf(c, info.team, 'crest-xl')}<b>${esc(clubName(c, info.team))}</b><small>${L2('Str', 'Güç')} ${Math.round(myStr)}</small></div>
        <div class="hm-vs">${res}<small>${L2('AI', 'YZ')}: ${(t() as unknown as Record<string, string>)[diff] ?? diff}</small></div>
        <div class="hm-team">${crestOf(c, opp, 'crest-xl')}<b>${esc(clubName(c, opp))}</b><small>${L2('Str', 'Güç')} ${Math.round(oppStr)}</small></div>
      </div>
      <div class="hm-sel s-${c.ws.sel}"><span class="stamp">${selLabel(c.ws.sel)}</span></div>
      ${c.ws.objectives.length && !c.ws.played ? `<div class="hm-obj"><small>${L2("MANAGER'S TARGETS", 'HOCANIN HEDEFLERİ')}</small>${c.ws.objectives.map((o) => `<span>◻ ${objectiveText(o)}</span>`).join('')}</div>` : ''}
      <div class="hm-acts">
        ${c.ws.press && !c.ws.played ? `<button class="btn btn-ghost" data-act="press">🎙 ${L2('Press conference', 'Basın toplantısı')}</button>` : ''}
        ${playable ? `<button class="btn btn-ghost" data-act="sim">${L2('Simulate', 'Simüle et')} ⏩</button><button class="btn btn-primary btn-start" data-act="play">${L2('PLAY', 'OYNA')} ▶</button>` : `<button class="btn btn-primary btn-start" data-act="next">${c.ws.played ? L2('NEXT WEEK', 'SONRAKİ HAFTA') : L2('WATCH & NEXT WEEK', 'İZLE & SONRAKİ HAFTA')} ▶</button>`}
      </div>
    </section>`;
  } else {
    const label = weekLabel(c);
    center = `<section class="hm-week quiet">
      <div class="hm-wk-head"><span class="hm-comp">${esc(label)}</span></div>
      <div class="hm-quiet">${mySprite(c, me.injury ? 'sad0' : 'run2', 'hm-quiet-sprite')}<div><b>${me.injury ? L2('Recovery week', 'Tedavi haftası') : c.week === 0 ? L2('Pre-season', 'Sezon öncesi hazırlık') : L2('No match this week', 'Bu hafta maç yok')}</b><p>${me.injury ? L2(`${me.injury.kind}. Back in about ${me.injury.weeks} week(s).`, `${me.injury.kind}. Yaklaşık ${me.injury.weeks} hafta sonra dönüyorsun.`) : c.week === 0 ? L2('The transfer window is open. Train hard, check your offers, set the tone.', 'Transfer dönemi açık. Sıkı çalış, tekliflerine bak, sezonun tonunu belirle.') : L2('Rest, train, check your phone.', 'Dinlen, antrenman yap, telefonuna bak.')}</p></div></div>
      <div class="hm-acts">${c.phase === 'summer' ? `<button class="btn btn-ghost" data-act="skipsummer">${L2('Skip to pre-season', 'Sezon öncesine geç')} ⏭</button>` : ''}<button class="btn btn-primary btn-start" data-act="next">${L2('NEXT WEEK', 'SONRAKİ HAFTA')} ▶</button></div>
    </section>`;
  }
  const up = nextFixtures(c, 4).filter((x) => x.week > c.week || (x.week === c.week && x.played)).slice(0, 3);
  const latest = c.feed.slice(0, 3);
  const right = `<section class="hm-side">
    <button class="hm-train ${c.ws.trained ? 'done' : ''}" data-act="train" ${c.ws.trained || me.injury ? 'disabled' : ''}><i>🏋️</i><div><b>${c.ws.trained ? L2('Training done', 'Antrenman tamam') : me.injury ? L2('Injured: rehab only', 'Sakat: sadece tedavi') : L2('Training session', 'Antrenman')}</b><small>${c.ws.trained ? L2('See you next week', 'Haftaya görüşürüz') : L2('Choose a focus · play a drill', 'Odak seç · drill oyna')}</small></div></button>
    <button class="hm-phone" data-tab="phone"><div class="hm-ph-head"><b>KICKR</b>${c.dms.filter((d) => !d.mine && !d.read).length ? `<em>${c.dms.filter((d) => !d.mine && !d.read).length} ✉</em>` : ''}</div>${latest.map((p) => `<div class="hm-ph-post"><b>${esc(p.name)}</b><span>${esc(p.text.split('\n')[0].slice(0, 70))}</span><small>♥ ${compact(p.likes)}</small></div>`).join('')}</button>
    ${up.length ? `<div class="hm-next"><small>${L2('COMING UP', 'SIRADAKİ')}</small>${up.map((x) => { const team = x.home.startsWith('n:') || x.away.startsWith('n:') ? 'n:' + me.nat : c.contract?.club; const opp = x.home === team ? x.away : x.home; return `<div><span>${L2('W', 'H')}${x.week}</span>${crestOf(c, opp, 'crest-xs')}<b>${esc(clubName(c, opp))}</b><i>${esc(compShort(c, x.comp))}</i></div>`; }).join('')}</div>` : ''}
  </section>`;
  return {
    html: `<div class="hm">${left}${center}${right}</div>`,
    bind: (root: HTMLElement) => {
      root.querySelector('[data-act=play]')?.addEventListener('click', () => { audio.select(); playWeek(); });
      root.querySelector('[data-act=sim]')?.addEventListener('click', () => { audio.click(); simWeek(); });
      root.querySelector('[data-act=next]')?.addEventListener('click', () => { audio.select(); nextWeek(); });
      root.querySelector('[data-act=skipsummer]')?.addEventListener('click', () => {
        audio.select();
        for (let i = 0; i < 8 && c.phase === 'summer'; i++) finishWeek(c);
        saveCareer();
        showCareer(H, 'home');
      });
      root.querySelector('[data-act=train]')?.addEventListener('click', () => { audio.click(); trainingSheet(); });
      root.querySelector('[data-act=press]')?.addEventListener('click', () => { audio.click(); pressConference(); });
    },
  };
}

function nextWeek() {
  const c = C();
  finishWeek(c);
  saveCareer();
  showCareer(H, 'home');
}

// ------------------------------------------------------------------ training

function trainingSheet() {
  const c = C();
  let focus = FOCUS[c.me.pos === 'FWD' ? 0 : c.me.pos === 'MID' ? 2 : 3].id;
  let inten = 'normal';
  const draw = () => {
    const m = modal(`<div class="tr-sheet">
      <div class="cr-mh"><b>🏋️ ${L2('Training', 'Antrenman')}</b><button class="cr-x" data-x>✕</button></div>
      <div class="tr-focus">${FOCUS.map((f) => `<button class="tr-f ${focus === f.id ? 'on' : ''}" data-f="${f.id}"><i>${f.icon}</i><b>${esc(LP(f.name))}</b><small>${f.stats.map((k) => t().stat[k]).join(' · ')}</small></button>`).join('')}</div>
      <div class="tr-row"><span>${L2('Intensity', 'Yoğunluk')}</span><div class="seg small">${INTENSITY.map((i) => `<button class="${inten === i.id ? 'on' : ''}" data-i="${i.id}">${esc(LP(i.name))}</button>`).join('')}</div><small>${L2('Fitness', 'Kondisyon')} −${INTENSITY.find((i) => i.id === inten)!.cost} · ${L2('Now', 'Şu an')} ${Math.round(c.me.fitness)}</small></div>
      <div class="tr-acts"><button class="btn btn-ghost" data-go="quick">${L2('Quick session', 'Hızlı antrenman')}</button><button class="btn btn-primary" data-go="drill">${L2('Shooting drill', 'Şut drilli')} ▶<small>${L2('45s vs keeper · up to ×1.6 gains', '45sn kaleciye karşı · ×1.6\'ya kadar kazanım')}</small></button></div>
    </div>`, 'sheet');
    m.querySelector('[data-x]')?.addEventListener('click', () => closeModal());
    m.querySelectorAll<HTMLElement>('[data-f]').forEach((b) => b.addEventListener('click', () => { focus = b.dataset.f!; audio.click(); draw(); }));
    m.querySelectorAll<HTMLElement>('[data-i]').forEach((b) => b.addEventListener('click', () => { inten = b.dataset.i!; audio.click(); draw(); }));
    m.querySelector('[data-go=quick]')?.addEventListener('click', () => { closeModal(); doTrain(focus, inten, 1, null); });
    m.querySelector('[data-go=drill]')?.addEventListener('click', () => {
      closeModal();
      audio.select();
      H.playCareer(drillConfig(c), (mm: Match) => {
        const g = drillGrade(mm.teams[0].score);
        doTrain(focus, inten, g.mult, `${g.grade} · ${mm.teams[0].score} ${L2('goals', 'gol')}`);
      });
    });
  };
  draw();
}

function doTrain(focus: string, inten: string, grade: number, drill: string | null) {
  const c = C();
  const r = train(c, focus, inten, grade);
  c.ws.trained = true;
  let inj = '';
  if (r.injured) {
    inj = injure(c);
  }
  saveCareer();
  showCareer(H, 'home');
  const gains = Object.entries(r.delta).map(([k, v]) => `${t().stat[k as keyof ReturnType<typeof t>['stat']]} +${v}`).join(' · ');
  modal(`<div class="tr-result">
    <div class="cr-mh"><b>${L2('Session complete', 'Antrenman bitti')}</b></div>
    ${drill ? `<div class="tr-grade">${esc(drill)}</div>` : ''}
    <p>${gains ? `📈 ${gains}` : L2('Small progress: the gains will show soon.', 'Küçük bir ilerleme: kazanımlar yakında görünecek.')}</p>
    <p>+${r.xp} XP</p>
    ${inj ? `<p class="bad">🚑 ${L2('Picked up a knock', 'Sakatlandın')}: ${esc(inj)}</p>` : ''}
    <button class="btn btn-primary" data-x>OK</button>
  </div>`, 'sheet').querySelector('[data-x]')?.addEventListener('click', () => { closeModal(); showCareer(H, 'home'); });
}


// ------------------------------------------------------------------ press conference

function pressConference() {
  const c = C();
  const info = matchInfo(c);
  if (!info) return;
  const slump = c.me.form.slice(-3).length === 3 && avg(c.me.form.slice(-3)) < 6.1;
  const streak = c.me.form.slice(-3).length === 3 && avg(c.me.form.slice(-3)) > 7.6;
  const derby = !isNat(info.team) && c.clubs[info.team]?.rival === info.opp;
  const qs = pressQuestions(c, { opp: info.opp, derby, final: info.f.round === 'F', slump, streak, rumours: c.offers.some((o) => o.status === 'open' && o.kind === 'transfer') });
  const answers: PressQ['a'][number][] = [];
  const ask = (i: number) => {
    if (i >= qs.length) {
      applyPress(c, answers, info.opp);
      c.ws.press = null;
      saveCareer();
      closeModal();
      toast(L2('Your words are already on KICKR…', 'Sözlerin şimdiden KICKR\'da…'));
      showCareer(H, 'home');
      return;
    }
    const q = qs[i];
    const m = modal(`<div class="pc">
      <div class="pc-stage"><div class="pc-mics">🎙️🎙️🎙️</div>${myPortrait(c, 'pc-face')}<div class="pc-flash"></div></div>
      <div class="pc-q"><small>${L2('QUESTION', 'SORU')} ${i + 1}/${qs.length}</small><p>“${esc(q.q)}”</p></div>
      <div class="pc-as">${q.a.map((a, j) => `<button class="pc-a s-${a.style}" data-a="${j}"><i>${a.style === 'humble' ? '🙏' : a.style === 'bold' ? '😎' : '🔥'}</i>${esc(a.text)}</button>`).join('')}</div>
    </div>`, 'press');
    m.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => { answers.push(q.a[Number(b.dataset.a)]); audio.click(); ask(i + 1); }));
  };
  ask(0);
}

// ------------------------------------------------------------------ playing & simulating

function playWeek() {
  const c = C();
  const info = matchInfo(c)!;
  const setup = careerMatchConfig(c);
  H.playCareer(setup.cfg, (m) => {
    const line = lineFromMatch(c, m, setup.sub, setup.startScore, info.big);
    const scorers = m.goalLog.map((g) => ({ name: g.star ? c.me.name : g.scorer, team: g.team, at: setup.sub ? 0.6 + g.at * 0.4 : g.at, me: g.star }));
    const ko = ['R16', 'QF', 'SF', 'F'].includes(info.f.round);
    if (ko && line.gf === line.ga) return penalties(line.gf, line.ga, (pens) => finishMatch(line, false, setup.sub, scorers, pens));
    finishMatch(line, false, setup.sub, scorers);
  });
}

function finishMatch(line: ReturnType<typeof lineFromMatch>, sim: boolean, sub: boolean, scorers: LastMatch['scorers'], pens?: { me: number; opp: number; won: boolean }) {
  const c = C();
  const lm = applyUserMatch(c, line, { sim, sub, pens, scorers });
  saveCareer();
  showPostMatch(lm);
}

function simWeek() {
  const c = C();
  const info = matchInfo(c)!;
  const sub = c.ws.sel === 'sub';
  const r = simUserMatch(c, sub);
  const ko = ['R16', 'QF', 'SF', 'F'].includes(info.f.round);
  let pens: { me: number; opp: number; won: boolean } | undefined;
  if (ko && r.gf === r.ga) {
    const [w, ph, pa] = simPens(c, info.team, info.opp);
    pens = { me: ph, opp: pa, won: w === info.team };
    r.events.push({ min: 120, kind: 'ft', text: L2(`Penalties: ${ph}-${pa}`, `Penaltılar: ${ph}-${pa}`) });
  }
  liveSim(info.team, info.opp, r.events, () => {
    const scorers = r.events.filter((e) => e.kind === 'mygoal' || e.kind === 'goal' || e.kind === 'myassist' || e.kind === 'oppgoal').map((e) => ({ name: e.kind === 'mygoal' ? c.me.name : e.kind === 'oppgoal' ? clubName(c, info.opp) : e.text.replace(/^[^!]*! /, '').split(/[ ,.]/)[0], team: (e.kind === 'oppgoal' ? 1 : 0) as 0 | 1, at: e.min / 90, me: e.kind === 'mygoal' }));
    finishMatch(r.line, true, sub, scorers, pens);
  });
}

function liveSim(team: string, opp: string, events: SimEvent[], done: () => void) {
  const c = C();
  setScreen('screen-career', `<div class="ls">
    <div class="ls-board">
      <div class="ls-t">${crestOf(c, team, 'crest-lg')}<b>${esc(clubName(c, team))}</b></div>
      <div class="ls-score"><b id="ls-h">0</b><span>-</span><b id="ls-a">0</b><small id="ls-min">0'</small></div>
      <div class="ls-t">${crestOf(c, opp, 'crest-lg')}<b>${esc(clubName(c, opp))}</b></div>
    </div>
    <div class="ls-bar"><i id="ls-prog"></i></div>
    <div class="ls-feed" id="ls-feed"></div>
    <div class="row"><button class="btn btn-ghost" data-act="skip">${L2('Skip', 'Geç')} ⏭</button></div>
  </div>`);
  let i = 0, h = 0, a = 0, min = 0, over = false;
  const feed = document.getElementById('ls-feed')!;
  const end = () => {
    if (over) return;
    over = true;
    clearInterval(timer);
    setTimeout(done, 400);
  };
  const timer = setInterval(() => {
    min += 1.5;
    const mEl = document.getElementById('ls-min');
    if (!mEl) return end();
    mEl.textContent = Math.min(90, Math.floor(min)) + "'";
    (document.getElementById('ls-prog') as HTMLElement).style.width = Math.min(100, (min / 90) * 100) + '%';
    while (i < events.length && events[i].min <= min) {
      const e = events[i++];
      if (e.kind === 'mygoal' || e.kind === 'goal' || e.kind === 'myassist') { h++; audio.horn(); vibrate(30); }
      if (e.kind === 'oppgoal') { a++; audio.groan(); }
      if (e.kind === 'ko') audio.hit(0.6);
      document.getElementById('ls-h')!.textContent = String(h);
      document.getElementById('ls-a')!.textContent = String(a);
      const row = document.createElement('div');
      row.className = 'ls-ev k-' + e.kind;
      row.innerHTML = `<span>${e.min}'</span><p>${esc(e.text)}</p>`;
      feed.prepend(row);
    }
    if (min >= 92) end();
  }, 70);
  bind('[data-act=skip]', () => { min = 999; });
}

function penalties(gf: number, ga: number, done: (p: { me: number; opp: number; won: boolean }) => void) {
  const c = C();
  const info = matchInfo(c)!;
  const kicks: { me: boolean[]; opp: boolean[] } = { me: [], opp: [] };
  const sMine = teamStrength(c, info.team), sOpp = teamStrength(c, info.opp);
  const draw = (msg = '') => {
    setScreen('screen-career', `<div class="pk">
      <div class="kick">${L2('PENALTY SHOOT-OUT', 'PENALTI ATIŞLARI')} · ${gf}-${ga}</div>
      <div class="pk-rows">
        <div class="pk-row">${crestOf(c, info.team, 'crest-sm')}<b>${esc(clubName(c, info.team))}</b>${Array.from({ length: Math.max(5, kicks.me.length) }, (_, i) => `<i class="${kicks.me[i] === undefined ? '' : kicks.me[i] ? 'in' : 'out'}"></i>`).join('')}</div>
        <div class="pk-row">${crestOf(c, info.opp, 'crest-sm')}<b>${esc(clubName(c, info.opp))}</b>${Array.from({ length: Math.max(5, kicks.opp.length) }, (_, i) => `<i class="${kicks.opp[i] === undefined ? '' : kicks.opp[i] ? 'in' : 'out'}"></i>`).join('')}</div>
      </div>
      <div class="pk-goal"><div class="pk-net"></div>${mySprite(c, 'kick1', 'pk-me')}</div>
      <p class="pk-msg">${msg}</p>
      ${kicks.me.length === 2 && kicks.opp.length === 2 ? `<div class="pk-aim"><small>${L2('Your kick. Pick a corner:', 'Sıra sende. Köşeni seç:')}</small><div class="row"><button class="btn btn-ghost" data-k="L">◤ ${L2('Left', 'Sol')}</button><button class="btn btn-ghost" data-k="C">▲ ${L2('Middle', 'Orta')}</button><button class="btn btn-ghost" data-k="R">${L2('Right', 'Sağ')} ◥</button></div></div>` : `<div class="row"><button class="btn btn-primary" data-act="nextpk">${L2('Next kick', 'Sıradaki atış')} ▶</button></div>`}
    </div>`);
    bind('[data-k]', (b) => {
      const dive = ['L', 'C', 'R'][Math.floor(Math.random() * 3)];
      const scored = b.dataset.k !== dive && Math.random() < 0.9 + (c.me.stats.sho - 70) * 0.004;
      kicks.me.push(scored);
      if (scored) { audio.horn(); vibrate(40); } else audio.groan();
      oppKick();
      check(scored ? L2('GOAL! Ice cold. 🥶', 'GOL! Buz gibi. 🥶') : dive === b.dataset.k ? L2('SAVED! He read it.', 'KURTARDI! Okudu.') : L2('Off the post!', 'Direkten döndü!'));
    });
    bind('[data-act=nextpk]', () => {
      kicks.me.push(Math.random() < 0.74 + (sMine - sOpp) * 0.004);
      oppKick();
      audio.click();
      check('');
    });
  };
  const oppKick = () => kicks.opp.push(Math.random() < 0.74 + (sOpp - sMine) * 0.004);
  const score = (a: boolean[]) => a.filter(Boolean).length;
  const check = (msg: string) => {
    const n = kicks.me.length;
    const m = score(kicks.me), o = score(kicks.opp);
    const left = Math.max(0, 5 - n);
    const decided = n <= 5 ? m > o + left || o > m + left : m !== o;
    if (decided || (n >= 5 && m !== o)) {
      const won = m > o;
      setTimeout(() => done({ me: m, opp: o, won }), 900);
      draw(`${msg} ${won ? L2('WE WIN THE SHOOT-OUT! 🎉', 'PENALTILARI KAZANDIK! 🎉') : L2('Out on penalties…', 'Penaltılarla elendik…')}`);
      return;
    }
    draw(msg);
  };
  draw();
}

// ------------------------------------------------------------------ post-match

function showPostMatch(lm: LastMatch) {
  const c = C();
  const team = lm.nat ? 'n:' + c.me.nat : c.contract?.club ?? '';
  const res = lm.gf > lm.ga || lm.pens?.won ? 'win' : lm.gf < lm.ga || (lm.pens && !lm.pens.won) ? 'loss' : 'draw';
  const L = t();
  const deltas = Object.entries(lm.statDelta).map(([k, v]) => `<span>${L.stat[k as keyof typeof L.stat]} +${v}</span>`).join('');
  setScreen('screen-career', `<div class="pm">
    <div class="pm-head">
      <div class="pm-t">${crestOf(c, lm.home ? team : lm.opp, 'crest-lg')}<b>${esc(clubName(c, lm.home ? team : lm.opp))}</b></div>
      <div class="pm-score ${res}"><b>${lm.home ? lm.gf : lm.ga} - ${lm.home ? lm.ga : lm.gf}</b><small>${esc(compName(c, lm.comp))}${lm.pens ? ` · ${L2('pens', 'pen.')} ${lm.pens.me}-${lm.pens.opp}` : ''}${lm.sim ? ' · SIM' : ''}</small></div>
      <div class="pm-t">${crestOf(c, lm.home ? lm.opp : team, 'crest-lg')}<b>${esc(clubName(c, lm.home ? lm.opp : team))}</b></div>
    </div>
    <div class="pm-body">
      <div class="pm-rate">
        <div class="pm-ring ${ratingClass(lm.rating)}" style="--p:${lm.rating * 10}"><b data-rate="${lm.rating}">0.0</b><small>${L2('RATING', 'NOT')}</small></div>
        ${lm.motm ? `<div class="stamp pm-motm">⭐ ${L2('MAN OF THE MATCH', 'MAÇIN ADAMI')}</div>` : ''}
        <div class="pm-line"><span>⚽ ${lm.goals}</span><span>🅰️ ${lm.assists}</span><span>🎯 ${lm.line.onTarget}/${lm.line.shots}</span><span>↔ ${lm.line.passOk}</span><span>🛡 ${lm.line.steals}</span><span>💥 ${lm.line.knockdowns}</span></div>
      </div>
      <div class="pm-mid">
        <div class="pm-sec"><small>${L2('RATING BREAKDOWN', 'NOT DÖKÜMÜ')}</small>${lm.breakdown.map(([l, v]) => `<div class="pm-bd ${v >= 0 ? 'pos' : 'neg'}"><span>${esc(l)}</span><b>${v >= 0 ? '+' : ''}${v.toFixed(2)}</b></div>`).join('') || `<div class="pm-bd"><span>${L2('Quiet game', 'Sessiz maç')}</span><b>0</b></div>`}</div>
        ${lm.objectives.length ? `<div class="pm-sec"><small>${L2('TARGETS', 'HEDEFLER')}</small>${lm.objectives.map((o) => `<div class="pm-obj ${o.done ? 'ok' : 'no'}">${o.done ? '✔' : '✘'} ${objectiveText(o)}</div>`).join('')}</div>` : ''}
      </div>
      <div class="pm-side">
        <div class="pm-sec"><small>${L2('PROGRESS', 'GELİŞİM')}</small><div class="pm-xp">+${Math.max(15, lm.xp)} XP</div>${deltas ? `<div class="pm-deltas">${deltas}</div>` : ''}${lm.injury ? `<div class="pm-inj">🚑 ${esc(lm.injury)}</div>` : ''}</div>
        <div class="pm-sec pm-goals"><small>${L2('GOALS', 'GOLLER')}</small>${lm.scorers.length ? lm.scorers.map((s) => `<div class="${s.me ? 'me' : ''} t${s.team}"><span>${Math.max(1, Math.round(s.at * 90))}'</span>${esc(s.name)}</div>`).join('') : '<div>—</div>'}</div>
      </div>
    </div>
    <div class="row pm-acts"><button class="btn btn-ghost" data-act="post">✎ ${L2('Post on KICKR', "KICKR'da paylaş")}</button><button class="btn btn-primary btn-start" data-act="cont">${L2('CONTINUE', 'DEVAM')} ▶</button></div>
  </div>`);
  // count the rating up
  const el = ui().querySelector<HTMLElement>('[data-rate]');
  if (el) {
    const target = lm.rating;
    let v = 0;
    const tm = setInterval(() => {
      v = Math.min(target, v + 0.2);
      el.textContent = v.toFixed(1);
      if (v >= target) clearInterval(tm);
    }, 30);
  }
  if (res === 'win') { audio.horn(); audio.cheer(0.8); } else if (res === 'loss') audio.groan();
  bind('[data-act=post]', (b) => {
    if (lm.posted) return;
    compose(c, lm, () => { b.setAttribute('disabled', ''); b.textContent = '✔ ' + L2('Posted', 'Paylaşıldı'); });
  });
  bind('[data-act=cont]', () => { audio.select(); nextWeek(); });
}

// ------------------------------------------------------------------ story moments

function showMoment() {
  const c = C();
  const m = c.queue[0];
  setScreen('screen-career', `<div class="mo" data-act="mo">
    <div class="mo-rays"></div>
    <div class="mo-in">
      <div class="mo-icon">${m.icon}</div>
      <div class="kick">${L2('SEASON', 'SEZON')} ${m.season} · ${L2('WEEK', 'HAFTA')} ${m.week}${c.queue.length > 1 ? ` · 1/${c.queue.length}` : ''}</div>
      <h1>${esc(LP(m.title))}</h1>
      <p>${esc(LP(m.sub))}</p>
      ${mySprite(c, m.key === 'retire' ? 'idle0' : m.key.startsWith('injury') ? 'sad0' : 'cel0', 'mo-sprite')}
      <small class="mo-tap">${L2('tap to continue', 'devam etmek için dokun')}</small>
    </div>
  </div>`);
  audio.horn();
  vibrate([30, 40, 60]);
  bind('[data-act=mo]', () => {
    c.queue.shift();
    saveCareer();
    audio.click();
    showCareer(H);
  });
}

// ------------------------------------------------------------------ season review & gala

function showReview(): void {
  const c = C();
  const r = lastReview;
  c.flags.reviewSeen = c.flags.review;
  saveCareer();
  if (!r) return showCareer(H);
  const race = r.awardsRace;
  const awardRow = (label: string, id: string | undefined, val: string) => `<div class="rv-aw ${id === 'me' ? 'me' : ''}">${id && id !== 'me' ? '' : id === 'me' ? myPortrait(c, 'rv-face') : ''}<small>${label}</small><b>${id ? esc(playerName(c, id)) : '—'}</b><span>${val}</span></div>`;
  setScreen('screen-career', `<div class="rv">
    <div class="rv-head"><div class="kick">${L2('SEASON', 'SEZON')} ${r.season} ${L2('REVIEW', 'DEĞERLENDİRMESİ')}</div><h1>${r.leaguePos ? `${r.leaguePos}. · ${esc(r.leagueName)}` : L2('Season over', 'Sezon bitti')}</h1>${r.promoted ? `<span class="stamp up">${L2('PROMOTED', 'ŞAMPİYON/YÜKSELDİ')}</span>` : r.relegated ? `<span class="stamp down">${L2('RELEGATED', 'KÜME DÜŞTÜ')}</span>` : ''}</div>
    <div class="rv-body">
      <div class="rv-me">${myPortrait(c, 'rv-big')}<div class="rv-stats"><span><b>${c.history[c.history.length - 1]?.apps ?? 0}</b>${L2('apps', 'maç')}</span><span><b>${c.history[c.history.length - 1]?.goals ?? 0}</b>${L2('goals', 'gol')}</span><span><b>${c.history[c.history.length - 1]?.assists ?? 0}</b>${L2('assists', 'asist')}</span><span><b>${(c.history[c.history.length - 1]?.avg ?? 0).toFixed(2)}</b>${L2('avg', 'ort')}</span></div></div>
      <div class="rv-awards">${race ? `
        ${awardRow(L2('Golden Boot', 'Gol Kralı'), race.boot.id, `${race.boot.goals} ⚽`)}
        ${awardRow(L2('Player of the Season', 'Sezonun Oyuncusu'), race.poty.id, race.poty.avg.toFixed(2))}
        ${awardRow(L2('Young Player', 'Genç Oyuncu'), race.young?.id, race.young ? race.young.avg.toFixed(2) : '')}
        <div class="rv-tots"><small>${L2('TEAM OF THE SEASON', 'SEZONUN TAKIMI')}</small>${race.tots.map((id) => `<span class="${id === 'me' ? 'me' : ''}">${esc(playerName(c, id))}</span>`).join('')}</div>` : ''}
      </div>
      <div class="rv-tro">${r.trophies.map((x) => `<div class="rv-cup">🏆<b>${esc(x)}</b></div>`).join('')}${r.awards.map((x) => `<div class="rv-cup aw">🏅<b>${esc(x)}</b></div>`).join('')}${!r.trophies.length && !r.awards.length ? `<p class="cr-hint">${L2('No silverware this time. Next season.', 'Bu sefer kupa yok. Gelecek sezon.')}</p>` : ''}<div class="rv-coins">+${r.coins} ${L2('coins for your main profile (collect in Legacy)', 'altın ana profiline (Miras sekmesinden topla)')}</div></div>
    </div>
    <div class="row"><button class="btn btn-primary btn-start" data-act="ok">${c.phase === 'summer' ? L2('TO THE NATIONS CUP', 'ULUSLAR KUPASINA') : L2('CONTINUE', 'DEVAM')} ▶</button></div>
  </div>`);
  if (r.trophies.length || r.awards.length) { audio.horn(); audio.cheer(1); }
  bind('[data-act=ok]', () => { audio.select(); showCareer(H); });
}

function showGala() {
  const c = C();
  const g = lastGala!;
  c.flags.galaSeen = c.flags.gala;
  saveCareer();
  const list = [...g.ranking].reverse();
  setScreen('screen-career', `<div class="gala">
    <div class="kick">${L2('THE GOLDEN BALL', 'ALTIN TOP')} · ${L2('SEASON', 'SEZON')} ${g.season}</div>
    <h1>${L2('Who is the best in the world?', 'Dünyanın en iyisi kim?')}</h1>
    <div class="gala-list">${list.map((e, i) => {
      const rank = list.length - i;
      const n = e.id === 'me' ? null : c.npcs[e.id];
      const club = e.id === 'me' ? c.contract?.club ?? '' : n?.club ?? '';
      return `<div class="gala-row ${e.id === 'me' ? 'me' : ''} ${rank === 1 ? 'first' : ''}" style="--d:${i * 0.45}s"><b>${rank}</b>${e.id === 'me' ? myPortrait(c, 'gala-face') : n ? npcFace(c, n.id) : ''}<span>${esc(playerName(c, e.id))}</span><small>${club ? crestOf(c, club, 'crest-xs') : ''} ${club ? esc(clubName(c, club)) : ''}</small></div>`;
    }).join('')}</div>
    ${g.myRank > 10 || !g.myRank ? `<p class="gala-me">${g.myRank ? L2(`Your world ranking: #${g.myRank}. Keep climbing.`, `Dünya sıralamandaki yerin: ${g.myRank}. Tırmanmaya devam.`) : L2('Not enough games to be ranked this year.', 'Bu yıl sıralamaya girecek kadar maç oynamadın.')}</p>` : ''}
    <div class="row"><button class="btn btn-primary" data-act="ok">${L2('CONTINUE', 'DEVAM')} ▶</button></div>
  </div>`);
  audio.whoosh();
  setTimeout(() => { audio.horn(); }, list.length * 450);
  bind('[data-act=ok]', () => { audio.select(); showCareer(H); });
}

const npcFace = (c: Career, id: string) => npcPortrait(c, id, 'gala-face');

// ------------------------------------------------------------------ retirement

export function askRetire() {
  const c = C();
  const m = modal(`<div class="tr-result"><div class="cr-mh"><b>${L2('Hang up the boots?', 'Kramponları asıyor musun?')}</b></div><p>${L2('Your career ends here. Your legacy is written, and your main profile receives the rewards.', 'Kariyerin burada biter. Mirasın yazılır ve ana profilin ödülleri alır.')}</p><div class="row"><button class="btn btn-ghost" data-x>${L2('Not yet', 'Henüz değil')}</button><button class="btn btn-danger" data-go>${L2('Retire', 'Emekli ol')}</button></div></div>`, 'sheet');
  m.querySelector('[data-x]')?.addEventListener('click', () => closeModal());
  m.querySelector('[data-go]')?.addEventListener('click', () => { closeModal(); retire(c); saveCareer(); showRetired(); });
}

function showRetired() {
  const c = C();
  const s = c.stats;
  const L = legacyScore(c);
  setScreen('screen-career', `<div class="rt">
    <div class="rt-l">${myPortrait(c, 'rt-face')}<h1>${esc(c.me.name)}</h1><div class="rt-tier">${esc(legacyTier(c))}</div><small>${L2('Legacy score', 'Miras puanı')} ${L}</small></div>
    <div class="rt-r">
      <div class="rt-grid"><span><b>${s.apps}</b>${L2('apps', 'maç')}</span><span><b>${s.goals}</b>${L2('goals', 'gol')}</span><span><b>${s.assists}</b>${L2('assists', 'asist')}</span><span><b>${s.motm}</b>MOTM</span><span><b>${c.me.intlApps}</b>${L2('caps', 'milli maç')}</span><span><b>${c.trophies.length}</b>${L2('trophies', 'kupa')}</span></div>
      <div class="rt-list">${c.trophies.map((x) => `<span>🏆 ${esc(LP(x.name))} <small>S${x.season}</small></span>`).join('')}${c.awards.map((x) => `<span>🏅 ${esc(LP(x.name))} <small>S${x.season}</small></span>`).join('')}</div>
      ${c.rewards.length ? `<button class="btn btn-primary" data-act="collect">${L2('Collect', 'Topla')} +${c.rewards.reduce((a, r) => a + r.coins, 0)} ${L2('coins', 'altın')}</button>` : ''}
      <div class="row"><button class="btn btn-ghost" data-act="hub">${L2('Main menu', 'Ana menü')}</button><button class="btn btn-danger" data-act="new">${L2('New career', 'Yeni kariyer')}</button></div>
    </div>
  </div>`);
  bind('[data-act=collect]', () => { collectRewards(c); showRetired(); });
  bind('[data-act=hub]', () => { audio.click(); showHub(H); });
  bind('[data-act=new]', () => {
    const m = modal(`<div class="tr-result"><div class="cr-mh"><b>${L2('Start over?', 'Baştan başla?')}</b></div><p>${L2('This career will be deleted.', 'Bu kariyer silinecek.')}</p><div class="row"><button class="btn btn-ghost" data-x>${L2('Cancel', 'İptal')}</button><button class="btn btn-danger" data-go>${L2('Delete & start', 'Sil ve başla')}</button></div></div>`, 'sheet');
    m.querySelector('[data-x]')?.addEventListener('click', () => closeModal());
    m.querySelector('[data-go]')?.addEventListener('click', () => { closeModal(); collectRewards(c); setCareer(null); showCareerStart(); });
  });
}

export function collectRewards(c: Career) {
  const total = c.rewards.reduce((a, r) => a + r.coins, 0);
  if (!total) return;
  record.coins += total;
  saveRecord();
  c.rewards = [];
  saveCareer();
  audio.horn();
  toast(L2(`+${total} coins added to your main profile!`, `+${total} altın ana profiline eklendi!`));
}

