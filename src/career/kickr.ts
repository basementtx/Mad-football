/**
 * KICKR 2.0: the living social network around your career.
 *
 * - Freshness memory: every template, persona line and fact phrase is tracked
 *   per career and only comes back after it has been rested for weeks.
 * - A recurring cast: ultras, a stats nerd, a doomer, a tactics thread guy, a
 *   parody account of you, a transfer insider, a bookmaker, a pundit, a kid
 *   superfan, your mum, KICKR itself. Same names all career long, each with
 *   their own voice.
 * - Compositional takes: opener + one or two concrete facts from the match
 *   (minute of your goal, shots, knockdowns, the derby, the table, your streak)
 *   + closer + emoji tail, so posts are specific and rarely alike.
 * - Story arcs over weeks: goal drought counter, scoring streak, fan campaigns
 *   (#…ForNational / #…Out), transfer saga, rival beef, follower milestones.
 * - Rich media: polls you can vote in, highlight clips, quote-posts, memes,
 *   you-vs-rival comparisons, team rating boards; stories and notifications.
 */
import type { Career, Post, LastMatch, KickrState, KStory, KNotif, Persona, PersonaKind } from './types';
import { FAN_FIRST } from './data';
import { clamp, pick, rand } from '../engine/math';
import { LP, fill, compact } from './util';
import { clubName, isNat, sortTable } from './world';
import { nextId } from './state';

type TP = [string, string];
const T = (p: TP, v: Record<string, string | number> = {}) => fill(LP(p), v);
const abs = (c: Career) => c.season * 100 + c.week;

// ------------------------------------------------------------------ state

export function kx(c: Career): KickrState {
  if (!c.kx) c.kx = { used: {}, personas: [], arcs: { drought: 0, streak: 0, campaign: null, saga: null, beef: 0, milestones: [] }, polls: {}, notifs: [], stories: [], liked: [], seen: 0 };
  return c.kx;
}

/** Pick `n` items from a pool, preferring the ones rested longest (never used = best). */
export function freshN<T>(c: Career, ns: string, pool: readonly T[], n = 1): T[] {
  const st = kx(c);
  const now = abs(c);
  const idx = pool.map((_, i) => i).sort((a, b) => {
    const ua = st.used[ns + a], ub = st.used[ns + b];
    const sa = ua === undefined ? 9999 : now - ua, sb = ub === undefined ? 9999 : now - ub;
    return sb - sa || Math.random() - 0.5;
  });
  // a little randomness among the best rested third
  const top = idx.slice(0, Math.max(n, Math.ceil(idx.length / 3)));
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }
  const out = top.slice(0, n);
  for (const i of out) st.used[ns + i] = now;
  // keep the memory small
  const keys = Object.keys(st.used);
  if (keys.length > 2500) for (const k of keys) if (now - st.used[k] > 300) delete st.used[k];
  return out.map((i) => pool[i]);
}
export const fresh = <T>(c: Career, ns: string, pool: readonly T[]) => freshN(c, ns, pool, 1)[0];

// ------------------------------------------------------------------ the cast

const CAST_NAMES: Record<PersonaKind, TP[]> = {
  ultra: [['Curva {S}', 'Curva {S}'], ['{S} Ultras 1907', '{S} Ultras 1907'], ['Block 12 {S}', '12. Blok {S}'], ['North Stand {S}', 'Kuzey Tribünü {S}']],
  nerd: [['{S} Data Lab', '{S} Veri Lab'], ['Expected Goals {S}', 'Beklenen Gol {S}'], ['{S} Numbers', '{S} Rakamlar']],
  doomer: [['Suffering {S} Fan', 'Acı Çeken {S}\'li'], ['{S} Doom Club', '{S} Kıyamet Kulübü'], ['It\'s Always {S}', 'Hep {S} İşte']],
  tactics: [['Half-Space Hakan', 'Yarı Alan Hakan'], ['Inverted Ian', 'Ters Bek İlkay'], ['The Pressing Trap', 'Pres Tuzağı']],
  parody: [['{Me} But Worse (parody)', '{Me} Ama Kötüsü (parodi)'], ['Not {Me} (parody)', 'Sahte {Me} (parodi)']],
  itk: [['The Insider 🔒', 'Kulis Adamı 🔒'], ['Window Whispers', 'Transfer Fısıltıları']],
  odds: [['MadOdds', 'MadOran'], ['BetBrawl', 'KuponKapışma']],
  pundit: [['Big Ron Pixel', 'Koca Rıza Piksel'], ['Gary Fineline', 'Gürkan İnceçizgi']],
  kid: [['{Me}\'s #1 Fan (age 9)', '{Me}\'ın 1 Numaralı Hayranı (9 yaş)']],
  mum: [['Mum 💙', 'Annem 💙']],
  kickr: [['KICKR', 'KICKR']],
};
const CAST_COLOR: Record<PersonaKind, string> = { ultra: '#c82d20', nerd: '#2f7bff', doomer: '#5a5f6e', tactics: '#14b8a6', parody: '#b04cff', itk: '#15171c', odds: '#2fb45a', pundit: '#c9a227', kid: '#ff7ab8', mum: '#ff5a8a', kickr: '#15171c' };
const CLUB_BOUND: PersonaKind[] = ['ultra', 'nerd', 'doomer'];

/** The recurring account of a kind (club-bound ones follow your current club). */
export function persona(c: Career, kind: PersonaKind): Persona {
  const st = kx(c);
  const club = c.contract && !isNat(c.contract.club) ? c.clubs[c.contract.club] : null;
  const owner = CLUB_BOUND.includes(kind) ? club?.id ?? 'none' : kind === 'parody' || kind === 'kid' ? 'me' : 'world';
  let p = st.personas.find((x) => x.kind === kind && x.owner === owner);
  if (!p) {
    const me = c.me.name.split(' ').pop() ?? c.me.name;
    const S = club?.short ?? 'MAD';
    const nameT = pick(CAST_NAMES[kind]);
    const name = fill(LP(nameT), { S, Me: me });
    const handle = (kind === 'kickr' ? 'KICKR' : name.replace(/[^A-Za-z0-9]/g, '').slice(0, 15)) + (kind === 'kid' ? '9' : '');
    p = { id: nextId('pe'), kind, owner, name, handle, color: club && CLUB_BOUND.includes(kind) ? club.primary : CAST_COLOR[kind], verified: ['pundit', 'itk', 'kickr', 'odds'].includes(kind) };
    st.personas.push(p);
  }
  return p;
}

let tC = 40;
function post(c: Career, p: Persona, text: string, extra: Partial<Post> = {}): Post {
  const likes = extra.likes ?? 0;
  const out: Post = {
    id: nextId('po'), name: p.name, handle: p.handle, verified: p.verified, av: 'c:' + p.color, text, likes,
    reposts: Math.round(likes * rand(0.08, 0.25)), replies: [], replyCount: Math.round(likes * rand(0.03, 0.1)), week: c.week, season: c.season, t: ++tC, ...extra,
  };
  c.feed.unshift(out);
  if (c.feed.length > 180) c.feed.length = 180;
  return out;
}

const reach = (c: Career, m = 1) => Math.max(5, c.me.followers * 0.03 * m * rand(0.55, 1.45) + Math.pow(c.me.rep, 1.5) * 2 * m);

// ------------------------------------------------------------------ compositional takes

const OPEN: Record<'great' | 'good' | 'meh' | 'bad', TP[]> = {
  great: [
    ['Okay I need everyone to calm down. Actually no, panic.', 'Tamam herkes sakin olsun. Aslında hayır, panik yapın.'], ['Unreal scenes.', 'Gerçek dışı sahneler.'], ['I have no words. Fine, I have some.', 'Kelimeler yetmiyor. Peki, birkaç tane var.'],
    ['Somebody frame this performance.', 'Biri bu performansı çerçeveletsin.'], ['Witness it. Tell your grandkids.', 'Şahit olun. Torunlarınıza anlatın.'], ['Let the record show:', 'Tutanaklara geçsin:'],
    ['My heart rate is still 140.', 'Nabzım hâlâ 140.'], ['This is why we suffer every other week.', 'Diğer haftalarda bu yüzden acı çekiyoruz.'], ['GET IN!!!', 'HAYDİ BEEE!!!'],
    ['Woke up the whole building.', 'Bütün apartmanı uyandırdım.'], ['I take back everything I said in October.', 'Ekimde söylediğim her şeyi geri alıyorum.'], ['Main character. No notes.', 'Ana karakter. Not yok.'],
    ['Football is a simple game: give the ball to {name}.', 'Futbol basit bir oyun: topu {name}\'a ver.'], ['Ladies and gentlemen, we got him.', 'Bayanlar baylar, aldık onu.'], ['Cinema. Pure cinema.', 'Sinema. Saf sinema.'],
    ['Not even the bookies saw this coming.', 'Bunu bahisçiler bile beklemiyordu.'], ['Somebody check on the {opp} defenders.', 'Biri {opp} defansına baksın.'], ['I\'m in tears in a kebab shop.', 'Bir dönercide ağlıyorum.'],
  ],
  good: [
    ['Tidy from {name}.', '{name}\'dan derli toplu iş.'], ['Quiet but important.', 'Sessiz ama önemli.'], ['Growing every week, this one.', 'Bu çocuk her hafta büyüyor.'],
    ['Can\'t complain.', 'Şikâyet edemem.'], ['Did his job and then some.', 'İşini yaptı, fazlasını da.'], ['That\'s the {name} we signed.', 'İşte aldığımız {name} bu.'],
    ['Solid shift.', 'Sağlam bir mesai.'], ['Starting to look the part.', 'Artık o formayı taşıyor.'], ['Underrated outing.', 'Hak ettiği ilgiyi görmeyen bir maç.'],
    ['Good, not great. But good.', 'İyi, mükemmel değil. Ama iyi.'], ['Nice to watch.', 'İzlemesi keyifli.'], ['Positive signs.', 'Olumlu işaretler.'],
  ],
  meh: [
    ['Hmm.', 'Hmm.'], ['I\'ve seen better, I\'ve seen worse.', 'Daha iyisini de gördüm, kötüsünü de.'], ['Okay-ish.', 'Eh işte.'], ['A 6 out of 10 kind of day.', '10 üzerinden 6\'lık bir gün.'],
    ['Not sure what to make of that.', 'Bundan ne anlamalı bilmiyorum.'], ['Fine. Just fine.', 'İdare eder. Sadece idare eder.'], ['Bit of a nothing game for {name}.', '{name} için pek bir şey olmayan maç.'], ['We move.', 'Devam.'],
  ],
  bad: [
    ['Rough one.', 'Zor bir gün.'], ['I\'m not angry, just disappointed.', 'Kızgın değilim, sadece hayal kırıklığı.'], ['Who was that in our shirt?', 'Formamızdaki o kimdi?'], ['Delete the tape.', 'Kaseti silin.'],
    ['Long week ahead.', 'Uzun bir hafta olacak.'], ['I paid for a ticket for this.', 'Buna bilet parası verdim.'], ['Somebody wake {name} up.', 'Biri {name}\'ı uyandırsın.'], ['Not his day. Not even close.', 'Onun günü değildi. Yakından bile.'],
    ['Painful to watch.', 'İzlemesi acı vericiydi.'], ['We need to talk about {name}.', '{name} hakkında konuşmamız lazım.'],
  ],
};
const CLOSE: Record<'pos' | 'neg', TP[]> = {
  pos: [
    ['More of this.', 'Devamı gelsin.'], ['Sign him for life.', 'Ömür boyu sözleşme verin.'], ['Rest of the league: on notice.', 'Ligin geri kalanı: dikkat.'], ['We go again Saturday.', 'Cumartesi yine.'],
    ['Pay the man.', 'Adamın parasını verin.'], ['Book the parade.', 'Geçit törenini ayarlayın.'], ['Generational.', 'Nesil yeteneği.'], ['Bottle it and sell it.', 'Şişeleyip satın.'],
    ['Next stop: national team.', 'Sıradaki durak: milli takım.'], ['I\'m seated, I\'m listening.', 'Oturdum, dinliyorum.'],
  ],
  neg: [
    ['Bench him.', 'Kesin yedek.'], ['Needs a long look in the mirror.', 'Aynaya uzun uzun bakması lazım.'], ['Sort it out.', 'Toparlansın.'], ['Patience running thin.', 'Sabır taşıyor.'],
    ['Not acceptable at this level.', 'Bu seviyede kabul edilemez.'], ['I want answers.', 'Cevap istiyorum.'], ['Hope training is brutal this week.', 'Umarım bu hafta antrenmanlar sert olur.'], ['Next week. No excuses.', 'Gelecek hafta. Bahane yok.'],
  ],
};
const TAILS = ['🔥', '🔥🔥', '😤', '🐐', '👑', '🙌', '😭', '💙', '⚽', '🎯', '💯', '🚀', '🫡', '🧱', '👀', '🥶'];
const TAILS_NEG = ['💀', '😩', '🙃', '🤦', '😐', '📉', '🫠', '🥲'];

interface Facts { v: Record<string, string | number>; list: [string, TP[]][] }

/** Concrete things that happened, each with several phrasings. */
function facts(c: Career, lm: LastMatch): Facts {
  const myGoals = lm.scorers.filter((s) => s.me);
  const min = (a: number) => Math.max(1, Math.min(90, Math.round(a * 90)));
  const lastGoal = myGoals.length ? min(myGoals[myGoals.length - 1].at) : 0;
  const firstGoal = myGoals.length ? min(myGoals[0].at) : 0;
  const club = c.contract && !isNat(c.contract.club) ? c.clubs[c.contract.club] : null;
  const derby = !!club && !!club.rival && c.clubs[lm.opp]?.short === club.rival;
  const streak = scoreStreak(c);
  const v: Record<string, string | number> = {
    name: c.me.name.split(' ').pop()!, opp: clubName(c, lm.opp), g: lm.goals, a: lm.assists, r: lm.rating.toFixed(1), sh: lm.line.shots, ot: lm.line.onTarget,
    kd: lm.line.knockdowns, st: lm.line.steals, ps: lm.line.passOk, m: lastGoal, m1: firstGoal, score: `${lm.gf}-${lm.ga}`, streak,
  };
  const list: [string, TP[]][] = [];
  if (lm.goals >= 3) list.push(['hat', [['A hat-trick against {opp}. Match ball is his.', '{opp}\'a hat-trick. Maç topu onun.'], ['Three goals. THREE.', 'Üç gol. ÜÇ.'], ['Hat-trick hero vs {opp}.', '{opp} karşısında hat-trick kahramanı.']]]);
  else if (lm.goals === 2) list.push(['brace', [['Brace vs {opp}.', '{opp}\'a iki gol.'], ['Two goals, {sh} shots, zero fear.', 'İki gol, {sh} şut, sıfır korku.'], ['Twice. Against {opp}.', 'İki kere. {opp}\'a.']]]);
  else if (lm.goals === 1) list.push(['goal', [['That goal on {m1}\' though.', 'O {m1}. dakika golü ama.'], ['Scored, and it was a beauty.', 'Attı, hem de ne gol.'], ['On the scoresheet again.', 'Yine golcüler listesinde.']]]);
  if (lastGoal >= 80 && lm.gf > lm.ga && lm.gf - lm.ga <= 1) list.push(['late', [['Winner in the {m}th minute. Ice in the veins.', '{m}. dakikada galibiyet golü. Damarlarında buz var.'], ['{m}\' and the place erupted.', '{m}\' ve stat yıkıldı.'], ['Late, late drama: {m}\'.', 'Son dakika dramı: {m}\'.']]]);
  if (lm.assists > 0) list.push(['assist', [['{a} assist(s) on top.', 'Üstüne {a} asist.'], ['The pass for the goal. Vision.', 'Gol pasındaki vizyon.'], ['Even set one up for a mate.', 'Bir arkadaşına da gol hazırladı.']]]);
  if (lm.line.shots >= 4) list.push(['shots', [['{ot} of {sh} shots on target.', '{sh} şutun {ot}\'i isabetli.'], ['{sh} shots. Never stopped trying.', '{sh} şut. Denemekten hiç vazgeçmedi.']]]);
  if (lm.line.knockdowns >= 3) list.push(['kd', [['Put {kd} people on the floor.', '{kd} kişiyi yere serdi.'], ['{kd} knockdowns. Mad Football at its finest.', '{kd} yere serme. Mad Football\'un dik alası.'], ['Bodied {kd} of them.', '{kd} tanesini devirdi.']]]);
  if (lm.line.steals >= 3) list.push(['steals', [['Won the ball back {st} times.', 'Topu {st} kere geri kazandı.'], ['{st} steals. Pressing monster.', '{st} top kapma. Pres canavarı.']]]);
  if (lm.line.passOk >= 18) list.push(['pass', [['{ps} completed passes.', '{ps} isabetli pas.'], ['Ran the game with {ps} passes.', '{ps} pasla oyunu yönetti.']]]);
  if (derby) list.push(['derby', [['In the DERBY.', 'Hem de DERBİDE.'], ['Derby day belongs to him.', 'Derbi günü onundu.'], ['Against THEM of all teams.', 'Hem de ONLARA karşı.']]]);
  if (streak >= 3) list.push(['streak', [['{streak} games in a row with a goal.', 'Üst üste {streak} maçta gol.'], ['That\'s {streak} straight games scoring.', 'Art arda {streak} maç gol.']]]);
  if (lm.rating >= 8.5) list.push(['rate', [['A {r} rating.', '{r} not.'], ['{r}/10 and that\'s harsh.', '10 üzerinden {r}, o bile az.']]]);
  if (lm.rating <= 5.5) list.push(['rateBad', [['{r} rating.', '{r} not.'], ['Lost the ball too often.', 'Çok fazla top kaybetti.'], ['{sh} shots, {ot} on target.', '{sh} şut, {ot} isabet.']]]);
  if (lm.gf === 0 && lm.ga > 0) list.push(['blank', [['We didn\'t even score.', 'Gol bile atamadık.'], ['Zero goals vs {opp}.', '{opp}\'a sıfır gol.']]]);
  return { v, list };
}

/** A specific, rarely-repeated fan take about your match. */
export function take(c: Career, lm: LastMatch, style: 'plain' | 'caps' | 'doom' = 'plain'): { text: string; mood: number } {
  const tier = lm.rating >= 8 ? 'great' : lm.rating >= 6.9 ? 'good' : lm.rating >= 6 ? 'meh' : 'bad';
  const pos = tier === 'great' || tier === 'good';
  const f = facts(c, lm);
  const open = T(fresh(c, 'op:' + tier, OPEN[tier]), f.v);
  const fs = freshN(c, 'fk', f.list, Math.min(f.list.length, Math.random() < 0.5 ? 1 : 2)).map(([k, ph]) => T(fresh(c, 'fx:' + k, ph), f.v));
  const close = Math.random() < 0.6 ? ' ' + T(fresh(c, 'cl:' + (pos ? 'pos' : 'neg'), CLOSE[pos ? 'pos' : 'neg']), f.v) : '';
  const tail = Math.random() < 0.7 ? ' ' + fresh(c, 'tl:' + (pos ? 'p' : 'n'), pos ? TAILS : TAILS_NEG) : '';
  let text = `${open} ${fs.join(' ')}${close}${tail}`.replace(/\s+/g, ' ').trim();
  if (style === 'caps') text = text.toUpperCase();
  if (style === 'doom') text = pos ? T(fresh(c, 'doompos', [['Enjoy it. It won\'t last.', 'Tadını çıkarın. Sürmeyecek.'], ['Good. Now watch us bottle the next one.', 'Güzel. Şimdi bir sonrakinde batırışımızı izleyin.'], ['I refuse to get my hopes up.', 'Umutlanmayı reddediyorum.']])) + ' ' + fs.join(' ') : text + ' ' + T(fresh(c, 'doomneg', [['Told you all.', 'Size söylemiştim.'], ['Same old story.', 'Hep aynı hikâye.'], ['Relegation form, honestly.', 'Dürüst olmak gerekirse küme düşme formu.']]));
  return { text, mood: tier === 'great' ? 0.9 : tier === 'good' ? 0.5 : tier === 'meh' ? -0.1 : -0.8 };
}

function scoreStreak(c: Career) {
  let n = 0;
  for (let i = c.log.length - 1; i >= 0; i--) {
    if (c.log[i].goals > 0) n++;
    else break;
  }
  return n;
}
function dryRun(c: Career) {
  let n = 0;
  for (let i = c.log.length - 1; i >= 0; i--) {
    if (c.log[i].goals === 0) n++;
    else break;
  }
  return n;
}

// ------------------------------------------------------------------ notifications & stories

export function notify(c: Career, n: Omit<KNotif, 'id' | 'week' | 'season'>) {
  const st = kx(c);
  st.notifs.unshift({ id: nextId('nt'), week: c.week, season: c.season, ...n });
  if (st.notifs.length > 60) st.notifs.length = 60;
}
export const unseenNotifs = (c: Career) => kx(c).notifs.filter((n) => !n.seen).length;

function story(c: Career, s: Omit<KStory, 'id' | 'week' | 'season'>) {
  const st = kx(c);
  st.stories = st.stories.filter((x) => abs(c) - (x.season * 100 + x.week) <= 1 && x.key !== s.key);
  st.stories.unshift({ id: nextId('st'), week: c.week, season: c.season, ...s });
  if (st.stories.length > 8) st.stories.length = 8;
}

// ------------------------------------------------------------------ after your match

export function kickrAfterMatch(c: Career, lm: LastMatch) {
  tC = 40;
  const st = kx(c);
  const me = c.me;
  const club = c.contract && !isNat(c.contract.club) ? c.clubs[c.contract.club] : null;
  const name = me.name.split(' ').pop()!;
  const v = { name, opp: clubName(c, lm.opp), r: lm.rating.toFixed(1), g: lm.goals, score: `${lm.gf}-${lm.ga}`, club: club?.name ?? '', short: club?.short ?? '' };
  const viral = 1 + lm.goals * 0.6 + (lm.rating >= 8.5 ? 1 : 0);
  const won = lm.gf > lm.ga, lost = lm.gf < lm.ga;

  // the ultras (all caps, flares)
  if (club && (lm.goals > 0 || lm.rating >= 7.5 || won) && Math.random() < 0.8) {
    const t = take(c, lm, 'caps');
    post(c, persona(c, 'ultra'), t.text + ' ' + fresh(c, 'ultraTag', ['🔥🔥🔥', '🧨', '📣📣', '🟥⬛', '🎆']), { likes: Math.round(reach(c, 0.9 * viral)), mood: t.mood });
  }
  // the doomer (always finds the bad side)
  if (club && Math.random() < 0.55) {
    const t = take(c, lm, 'doom');
    post(c, persona(c, 'doomer'), t.text, { likes: Math.round(reach(c, 0.4)), mood: Math.min(0, t.mood) });
  }
  // stats nerd: a little data card
  if (Math.random() < 0.65) {
    const conv = lm.line.shots ? Math.round((lm.goals / lm.line.shots) * 100) : 0;
    const p = post(c, persona(c, 'nerd'), T(fresh(c, 'nerd', [
      ['{name} vs {opp}, the numbers 📊', '{name} - {opp}, rakamlar 📊'], ['Data doesn\'t lie: {name} today 👇', 'Veri yalan söylemez: {name} bugün 👇'],
      ['Thread on {name}\'s game, numbers only. 🧮', '{name}\'ın maçı, sadece rakamlar. 🧮'], ['Pulled the numbers so you don\'t have to.', 'Rakamları sizin için çıkardım.'],
    ]), v), { likes: Math.round(reach(c, 0.5) + 120), mood: lm.rating >= 7 ? 0.4 : -0.3,
      media: { kind: 'graph', data: { rows: [`${LP(['Shots', 'Şut'])}:${lm.line.shots}:6`, `${LP(['On target', 'İsabet'])}:${lm.line.onTarget}:5`, `${LP(['Conversion %', 'Gole çevirme %'])}:${conv}:100`, `${LP(['Passes', 'Pas'])}:${lm.line.passOk}:30`, `${LP(['Steals', 'Top kapma'])}:${lm.line.steals}:8`, `${LP(['Knockdowns', 'Yere serme'])}:${lm.line.knockdowns}:8`].join('|'), r: lm.rating.toFixed(1) } } });
    void p;
  }
  // highlight clip
  if (lm.goals > 0 || lm.rating >= 8) {
    const dur = `0:${String(Math.round(rand(14, 58))).padStart(2, '0')}`;
    const views = Math.round(reach(c, 6 * viral) + 1000);
    const src = club && Math.random() < 0.6 ? null : persona(c, 'ultra');
    const title = T(fresh(c, 'clipT', [['Every touch: {name} vs {opp}', 'Tüm dokunuşlar: {name} - {opp}'], ['{name}\'s goal from every angle 🎥', '{name}\'ın golü her açıdan 🎥'], ['Watch it again. And again.', 'Tekrar izle. Bir daha.'], ['The {name} show 🎬', '{name} şov 🎬']]), v);
    const p = club && !src
      ? { name: club.name, handle: club.handle, verified: true, av: 'club:' + club.id }
      : { name: src!.name, handle: src!.handle, verified: src!.verified, av: 'c:' + src!.color };
    const out: Post = { id: nextId('po'), ...p, text: title, likes: Math.round(views * rand(0.06, 0.12)), reposts: Math.round(views * 0.02), replies: [], replyCount: Math.round(views * 0.01), week: c.week, season: c.season, t: ++tC, mood: 0.7,
      media: { kind: 'clip', data: { dur, views, pose: lm.goals > 0 ? 'celebrate' : 'kick', opp: v.opp } } };
    c.feed.unshift(out);
  }
  // man of the match poll
  if (club) {
    const mates = club.squad.map((id) => c.npcs[id]).filter(Boolean).sort(() => Math.random() - 0.5).slice(0, 2);
    if (mates.length === 2) {
      const myShare = clamp(30 + (lm.rating - 6.5) * 22 + (lm.motm ? 15 : 0), 8, 88);
      const rest = 100 - myShare;
      const a = Math.round(rest * rand(0.45, 0.75));
      const opts = [me.name, mates[0].name, mates[1].name];
      const votes = [Math.round(myShare), a, Math.max(0, 100 - Math.round(myShare) - a)];
      post(c, { id: club.id, kind: 'ultra', owner: club.id, name: club.name, handle: club.handle, color: club.primary, verified: true },
        T(fresh(c, 'pollMotm', [['🗳️ Your Player of the Match vs {opp}?', '🗳️ {opp} maçının oyuncusu sence kim?'], ['Vote now: who was our best tonight? 🗳️', 'Oy ver: bu akşam en iyimiz kimdi? 🗳️'], ['Three names. One award. You decide. 🏅', 'Üç isim. Bir ödül. Sen karar ver. 🏅'], ['MOTM vs {opp} — have your say 👇', '{opp} maçının yıldızı — söz sizde 👇'], ['Who gets your vote after {score}? 🗳️', '{score} sonrası oyun kime? 🗳️'], ['Pick your hero from tonight 🦸', 'Bu akşamın kahramanını seç 🦸']]), v),
        { av: 'club:' + club.id, likes: Math.round(reach(c, 0.8) + club.rep * 30), media: { kind: 'poll', data: { opts: opts.join('|'), pct: votes.join('|'), total: Math.round(reach(c, 3) + club.rep * 80), mine: 0 } } });
    }
  }
  // parody account (only once you are somewhat known)
  if (me.followers > 4000 && Math.random() < 0.45) {
    post(c, persona(c, 'parody'), T(fresh(c, lm.rating >= 7 ? 'parodyG' : 'parodyB', lm.rating >= 7 ? [
      ['Scored today. Going to post 14 selfies about it. 🤳', 'Bugün gol attım. Bununla ilgili 14 selfie paylaşacağım. 🤳'], ['Me after one good game: "I\'m basically the GOAT"', 'Bir iyi maçtan sonra ben: "Ben resmen GOAT\'ım"'],
      ['Already practising my statue pose 🗿', 'Şimdiden heykel pozumu çalışıyorum 🗿'], ['Ordered a gold Lamborghini with my win bonus. It\'s a toy one.', 'Galibiyet primimle altın Lamborghini aldım. Oyuncak olanından.'],
    ] : [
      ['Today\'s performance sponsored by: my bed 🛏️', 'Bugünkü performansın sponsoru: yatağım 🛏️'], ['Lost the ball 9 times but my hair looked great 💇', 'Topu 9 kere kaybettim ama saçım harikaydı 💇'],
      ['Tried a rabona. Shouldn\'t have.', 'Rabona denedim. Denememeliydim.'], ['Sorry to my fantasy managers. All 3 of you.', 'Fantezi liginde beni seçenlerden özür dilerim. Üçünüzden de.'],
    ]), v), { likes: Math.round(reach(c, 1.2) + 300), mood: 0, tag: 'parody' });
  }
  // the kid superfan: wholesome
  if (lm.goals > 0 && Math.random() < 0.4) {
    post(c, persona(c, 'kid'), T(fresh(c, 'kid', [['{name} scored!!!! I did the celebration in my living room and broke a lamp 😭⚽', '{name} gol attı!!!! Salonda sevinç yaptım ve lambayı kırdım 😭⚽'], ['I told everyone at school {name} would score. I WAS RIGHT', 'Okulda herkese {name} gol atacak dedim. HAKLIYDIM'], ['Mum said I can stay up for the highlights!!! {name} is the best', 'Annem özetler için geç yatmama izin verdi!!! {name} en iyisi']]), v), { likes: Math.round(reach(c, 1.6) + 800), mood: 1 });
  }
  // pundit quote-post on the biggest take
  const top = c.feed.find((p) => p.week === c.week && p.season === c.season && !p.mine && p.media?.kind !== 'poll' && p.text.length > 30);
  if (top && Math.random() < 0.6) {
    const good = lm.rating >= 7.3;
    post(c, persona(c, 'pundit'), T(fresh(c, good ? 'pundG' : 'pundB', good ? [['This. I said it in pre-season and I\'ll say it again: special.', 'Aynen. Sezon öncesi de söyledim, yine söylüyorum: özel.'], ['Hate to agree with the internet but… yes.', 'İnternete katılmaktan nefret ediyorum ama… evet.'], ['Proper footballer. Proper.', 'Gerçek futbolcu. Gerçek.'], ['In my day we\'d have kicked him. Nobody can catch him now.', 'Bizim zamanımızda tekmelerdik. Şimdi kimse yakalayamıyor.'], ['Told my producer to cut the ads: we\'re talking about this lad all show.', 'Yapımcıma reklamları kesmesini söyledim: bütün program bu çocuğu konuşacağız.'], ['Rare to see that maturity at his age.', 'O yaşta bu olgunluğu görmek nadir.']] : [['Harsh, but not wrong.', 'Sert ama yanlış değil.'], ['Young players have days like this. The great ones learn.', 'Gençlerin böyle günleri olur. Büyükler ders çıkarır.'], ['I\'ve been there. Switch the phone off, son.', 'Ben de yaşadım. Telefonu kapat evlat.'], ['Body language says it all. Needs an arm round the shoulder.', 'Beden dili her şeyi söylüyor. Birinin omzuna kolunu atması lazım.'], ['Not a crisis. A lesson.', 'Kriz değil. Ders.'], ['The coach has to protect him now.', 'Hoca şimdi onu korumalı.']]), v),
      { likes: Math.round(reach(c, 1.3) + 1500), mood: good ? 0.6 : -0.2, media: { kind: 'quote', data: { qn: top.name, qh: top.handle, qt: top.text.slice(0, 180), qav: top.av } } });
  }
  // a meme when something extreme happened
  if (lm.goals >= 2 || lm.line.knockdowns >= 4 || lm.rating <= 5.2) {
    const [top1, bot1] = lm.rating <= 5.2
      ? fresh(c, 'memeB', [[['ME BEFORE KICK-OFF', 'MAÇ ÖNCESİ BEN'], ['ME AFTER {r}', '{r} SONRASI BEN']], [['THE BALL', 'TOP'], ['{name} TODAY', 'BUGÜN {name}']], [['NOBODY:', 'KİMSE:'], ['{name}: *loses the ball again*', '{name}: *topu yine kaybeder*']]] as [TP, TP][])
      : lm.line.knockdowns >= 4
        ? fresh(c, 'memeK', [[['{opp} PHYSIO', '{opp} FİZYOTERAPİSTİ'], ['WORKING OVERTIME', 'MESAİYE KALDI']], [['REFEREES:', 'HAKEMLER:'], ['*don\'t exist*', '*yoklar*']]] as [TP, TP][])
        : fresh(c, 'memeG', [[['{opp} DEFENDERS', '{opp} DEFANSI'], ['WATCHING {name} RUN', '{name}\'IN KOŞUSUNU İZLERKEN']], [['WHEN {name} GETS THE BALL', 'TOP {name}\'A GELİNCE'], ['EVERYONE: 🍿', 'HERKES: 🍿']], [['{opp} KEEPER', '{opp} KALECİSİ'], ['NEEDS A HUG', 'SARILMAYA İHTİYACI VAR']]] as [TP, TP][]);
    const mp = persona(c, 'parody');
    post(c, { ...mp, name: LP(['Football Memes HQ', 'Futbol Caps Merkezi']), handle: 'FootyMemesHQ', color: '#ffb21f', verified: false },
      fresh(c, 'memeCap', ['💀💀💀', '😂😂', LP(['accurate', 'aynen böyle']), LP(['no context', 'bağlam yok']), '🤣']),
      { likes: Math.round(reach(c, 2.2 * viral) + 3000), mood: lm.rating <= 5.2 ? -0.4 : 0.6, media: { kind: 'meme', data: { top: T(top1, v), bot: T(bot1, v), pose: lm.rating <= 5.2 ? 'down' : 'celebrate' } } });
  }

  // ---- arcs
  const dry = dryRun(c), streak = scoreStreak(c);
  const ar = st.arcs;
  if (lm.goals > 0 && ar.drought >= 4) {
    post(c, persona(c, 'nerd'), T(fresh(c, 'droughtEnd', [['IT\'S OVER. {n} games without a goal and {name} finally breaks the curse. 🎉', 'BİTTİ. {n} maçlık gol orucu sona erdi, {name} laneti bozdu. 🎉'], ['The drought ends at {n} matches. Welcome back, {name}. 💧➡️⚽', 'Kuraklık {n} maçta bitti. Tekrar hoş geldin {name}. 💧➡️⚽']]), { ...v, n: ar.drought }), { likes: Math.round(reach(c, 2) + 2000), mood: 1 });
    trend(c, `${name}IsBack`, reach(c, 5));
  } else if (dry >= 4 && (dry === 4 || dry % 2 === 0)) {
    post(c, persona(c, 'doomer'), T(fresh(c, 'drought', [['Goal watch ⏳ {name}: {n} games without scoring.', 'Gol nöbeti ⏳ {name}: {n} maçtır gol yok.'], ['Day {n} of waiting for a {name} goal. Bring snacks.', '{name} golünü beklemenin {n}. günü. Çerez getirin.'], ['{n} matches. Not a single goal. Someone check his boots.', '{n} maç. Tek gol yok. Biri kramponlarına baksın.']]), { ...v, n: dry }), { likes: Math.round(reach(c, 0.8)), mood: -0.5 });
  }
  ar.drought = dry;
  if (streak >= 3 && streak > ar.streak) {
    post(c, persona(c, 'nerd'), T(fresh(c, 'streak', [['{name} has now scored in {n} straight games. 🔥📈', '{name} art arda {n} maçta gol attı. 🔥📈'], ['{n} in a row for {name}. The streak is ALIVE.', '{name} için üst üste {n}. Seri DEVAM EDİYOR.']]), { ...v, n: streak }), { likes: Math.round(reach(c, 1.6) + 1200), mood: 0.9, media: { kind: 'graph', data: { rows: c.log.slice(-6).map((l, i) => `${LP(['G', 'M'])}${i + 1}:${l.goals}:3`).join('|'), r: String(streak) } } });
    if (streak >= 4) trend(c, `${name}Streak`, reach(c, 3));
  }
  ar.streak = streak;
  // campaigns
  const recent = c.log.slice(-4);
  const avg = recent.length ? recent.reduce((a, l) => a + l.rating, 0) / recent.length : 6.5;
  const campTag = !me.capped ? `${name}ForNational` : !me.captain ? `Give${name}TheArmband` : `${name}BallonDor`;
  if (!ar.campaign && recent.length >= 4 && avg >= 7.8) {
    ar.campaign = { tag: campTag, kind: 'pos', since: abs(c) };
    post(c, persona(c, 'ultra'), T(fresh(c, 'campPos', [['Starting it now: #{t} 📣 Retweet if you agree.', 'Şimdi başlatıyoruz: #{t} 📣 Katılıyorsan paylaş.'], ['Enough is enough. #{t}', 'Artık yeter. #{t}']]), { t: campTag }), { likes: Math.round(reach(c, 2) + 2000), mood: 1 });
    trend(c, campTag, reach(c, 6));
    notify(c, { kind: 'trend', text: LP(['Fans started #{t} for you', 'Taraftarlar senin için #{t} başlattı']).replace('{t}', campTag) });
  } else if (!ar.campaign && recent.length >= 4 && avg <= 5.8) {
    const t = `${name}Out`;
    ar.campaign = { tag: t, kind: 'neg', since: abs(c) };
    post(c, persona(c, 'doomer'), T(fresh(c, 'campNeg', [['I\'ve been patient. Not anymore. #{t}', 'Sabrettim. Artık değil. #{t}'], ['Four games. Four shockers. #{t}', 'Dört maç. Dört felaket. #{t}']]), { t }), { likes: Math.round(reach(c, 1.5) + 800), mood: -0.9 });
    trend(c, t, reach(c, 4));
    notify(c, { kind: 'trend', text: LP(['#{t} is trending. Ouch.', '#{t} gündemde. Ah.']).replace('{t}', t) });
  } else if (ar.campaign) {
    const flipped = ar.campaign.kind === 'pos' ? avg < 6.8 || (campTag !== ar.campaign.tag) : avg >= 7;
    if (flipped) {
      if (ar.campaign.kind === 'neg') post(c, persona(c, 'ultra'), T(fresh(c, 'campBack', [['Remember #{t}? Yeah. Delete it. 😤', '#{t}\'yi hatırlıyor musunuz? Evet. Silin onu. 😤'], ['From #{t} to standing ovations. Football 🤝 redemption.', '#{t}\'tan ayakta alkışa. Futbol 🤝 kefaret.']]), { t: ar.campaign.tag }), { likes: Math.round(reach(c, 1.6) + 900), mood: 0.9 });
      else if (campTag !== ar.campaign.tag) post(c, persona(c, 'ultra'), T(fresh(c, 'campWon', [['#{t} WORKED. We did that. 🫡', '#{t} İŞE YARADI. Biz yaptık. 🫡']]), { t: ar.campaign.tag }), { likes: Math.round(reach(c, 2) + 1500), mood: 1 });
      ar.campaign = null;
    }
  }
  // rival compare when both have numbers
  const nem = c.npcs[c.nemesis];
  if (nem && c.week % 3 === 0 && Math.random() < 0.7) {
    post(c, persona(c, 'nerd'), T(fresh(c, 'cmp', [['The debate, settled with numbers: {a} vs {b} 👇', 'Tartışma rakamlarla bitiyor: {a} - {b} 👇'], ['Season so far: {a} or {b}? 🤔', 'Sezon şu ana kadar: {a} mı {b} mi? 🤔']]), { a: me.name, b: nem.name }),
      { likes: Math.round(reach(c, 1.4) + 900), mood: c.s.goals >= nem.s.goals ? 0.5 : -0.2, tag: 'nemesis',
        media: { kind: 'compare', data: { a: me.name, b: nem.name, nid: nem.id, rows: [`${LP(['Goals', 'Gol'])}:${c.s.goals}:${nem.s.goals}`, `${LP(['Assists', 'Asist'])}:${c.s.assists}:${nem.s.assists}`, `${LP(['Apps', 'Maç'])}:${c.s.apps}:${nem.s.apps}`, `${LP(['Avg rating', 'Ort. not'])}:${c.s.apps ? (c.s.rsum / c.s.apps).toFixed(1) : '-'}:${nem.s.apps ? (nem.s.rsum / nem.s.apps).toFixed(1) : '-'}`].join('|') } } });
  }

  // ---- notifications & stories
  if (lm.goals > 0) notify(c, { kind: 'mention', text: LP(['{n} people mentioned you after your goal', 'Golünden sonra {n} kişi senden bahsetti']).replace('{n}', compact(Math.round(reach(c, 0.6 * viral)))) });
  if (lm.rating >= 7.5) notify(c, { kind: 'follow', text: LP(['{n} new followers this week', 'Bu hafta {n} yeni takipçi']).replace('{n}', compact(Math.round(Math.max(20, lm.rating * 60 * (1 + me.rep / 10))))) });
  if (club) story(c, { key: 'club', av: 'club:' + club.id, name: club.short, slides: [
    { bg: club.primary, big: `${lm.gf}-${lm.ga}`, text: `${club.short} · ${v.opp}`, sub: won ? LP(['WIN 💪', 'GALİBİYET 💪']) : lost ? LP(['DEFEAT', 'MAĞLUBİYET']) : LP(['DRAW', 'BERABERLİK']) },
    ...(lm.goals > 0 ? [{ bg: '#15171c', big: '⚽', text: `${name} ${lm.goals > 1 ? '×' + lm.goals : ''}`, sub: LP(['Goal of the day?', 'Günün golü mü?']) }] : []),
  ] });
  if (lm.goals > 0 || lm.motm) story(c, { key: 'me', av: 'me', name: LP(['You', 'Sen']), slides: [{ bg: '#7a2ad8', big: lm.motm ? '⭐' : '⚽', text: lm.motm ? LP(['Man of the match', 'Maçın adamı']) : LP(['Scored today', 'Bugün gol attın']), sub: `${lm.rating.toFixed(1)}` }] });
  if (nem && lm.goals === 0 && Math.random() < 0.5) story(c, { key: 'nem', av: 'npc:' + nem.id, name: nem.name.split(' ').pop()!, slides: [{ bg: '#c82d20', big: '🤫', text: LP(['Quiet day for some people', 'Bazıları için sessiz bir gün']), sub: '' }] });
}

// ------------------------------------------------------------------ the week (with or without your match)

export function kickrWeek(c: Career) {
  tC = 60;
  const st = kx(c);
  const me = c.me;
  const club = c.contract && !isNat(c.contract.club) ? c.clubs[c.contract.club] : null;
  const name = me.name.split(' ').pop()!;
  // follower milestones
  const MS = [1000, 10000, 50000, 100000, 250000, 500000, 1000000, 5000000];
  for (const m of MS) {
    if (me.followers >= m && !st.arcs.milestones.includes(m)) {
      st.arcs.milestones.push(m);
      if (m < 10000 && st.arcs.milestones.length > 1) continue;
      post(c, persona(c, 'kickr'), T(fresh(c, 'msK', [['🎉 {name} just hit {m} followers on KICKR!', '🎉 {name} KICKR\'da {m} takipçiye ulaştı!'], ['Big moment: {m} people now follow {name}. 🚀', 'Büyük an: artık {m} kişi {name}\'ı takip ediyor. 🚀']]), { name: me.name, m: compact(m) }),
        { likes: Math.round(reach(c, 1.5) + m * 0.02), mood: 0.8, media: { kind: 'milestone', data: { m: compact(m) } } });
      notify(c, { kind: 'milestone', text: LP(['You reached {m} followers! 🎉', '{m} takipçiye ulaştın! 🎉']).replace('{m}', compact(m)) });
      story(c, { key: 'ms', av: 'c:#15171c', name: 'KICKR', slides: [{ bg: '#15171c', big: compact(m), text: LP(['followers', 'takipçi']), sub: '🎉' }] });
    }
  }
  // transfer saga (an open offer or an agent push)
  const offer = c.offers.find((o) => o.status === 'open' && (o.kind === 'transfer' || o.kind === 'loan' || o.kind === 'free') && o.club !== c.contract?.club);
  const ar = st.arcs;
  if (offer) {
    const oc = offer.club;
    if (!ar.saga || ar.saga.club !== oc) ar.saga = { club: oc, stage: 0, since: abs(c) };
    const stg = ar.saga.stage;
    if (stg < 3 && Math.random() < 0.7) {
      const lines: TP[][] = [
        [['🟡 Hearing {club} have asked about {full}. Early stages.', '🟡 {club}\'un {full} için nabız yokladığı duyuluyor. Henüz başlarda.'], ['👀 {club} scouts were watching {full} again this weekend.', '👀 {club} scoutları bu hafta sonu yine {full}\'ı izledi.']],
        [['🟠 {club} preparing a formal offer for {full}. Talks ongoing.', '🟠 {club}, {full} için resmi teklif hazırlıyor. Görüşmeler sürüyor.'], ['🟠 Personal terms discussed between {full}\'s camp and {club}.', '🟠 {full}\'ın ekibi ile {club} arasında şahsi şartlar konuşuldu.']],
        [['🔴 {club} and {full}: it\'s getting very serious. Decision expected soon.', '🔴 {club} ve {full}: iş çok ciddileşiyor. Karar yakında.'], ['🔴 Final details being discussed. {club} are pushing hard for {full}.', '🔴 Son detaylar konuşuluyor. {club}, {full} için bastırıyor.']],
      ];
      post(c, persona(c, 'itk'), T(fresh(c, 'saga' + stg, lines[stg]), { club: clubName(c, oc), full: me.name }), { likes: Math.round(reach(c, 1.8) + 2000), mood: 0.2 });
      ar.saga.stage++;
      if (stg === 0) trend(c, `${name}To${c.clubs[oc]?.short ?? 'X'}`, reach(c, 3));
    }
  } else if (ar.saga && abs(c) - ar.saga.since > 6) {
    ar.saga = null;
  }
  // bookmaker odds for the next fixture
  const nf = c.contract ? c.fixtures.find((f) => !f.played && f.week > c.week && (f.home === c.contract!.club || f.away === c.contract!.club)) : null;
  if (nf && Math.random() < 0.3) {
    const mineHome = nf.home === c.contract!.club;
    const opp = mineHome ? nf.away : nf.home;
    const ra = club?.rep ?? 50, rb = c.clubs[opp]?.rep ?? 50;
    const pw = clamp(0.45 + (ra - rb) / 120 + (mineHome ? 0.06 : -0.04), 0.12, 0.82);
    const pd = 0.26, pl = Math.max(0.06, 1 - pw - pd);
    const odd = (p: number) => (1 / p * 0.92).toFixed(2);
    const goal = clamp(1 / (0.18 + c.me.stats.sho / 260 + (ar.streak >= 2 ? 0.08 : 0)), 1.6, 9).toFixed(2);
    post(c, persona(c, 'odds'), T(fresh(c, 'odds', [['📈 Early prices: {h} v {a}', '📈 İlk oranlar: {h} - {a}'], ['The board is up for {h} v {a} 👇', '{h} - {a} oranları açıldı 👇']]), { h: clubName(c, nf.home), a: clubName(c, nf.away) }),
      { likes: Math.round(300 + rand(100, 1600)), media: { kind: 'odds', data: { h: clubName(c, nf.home), a: clubName(c, nf.away), o1: odd(mineHome ? pw : pl), ox: odd(pd), o2: odd(mineHome ? pl : pw), sc: `${name} ${LP(['to score', 'gol atar'])}`, so: goal } } });
  }
  // tactics thread (every few weeks)
  if (club && c.week % 4 === 2 && c.log.length >= 3) {
    const recent = c.log.slice(-3);
    const g = recent.reduce((a, l) => a + l.goals, 0);
    post(c, persona(c, 'tactics'), T(fresh(c, 'thread', [['🧵 Why {name} is thriving at {club} (a thread) 1/4\n\nWatch where he receives the ball: between the lines, half-turned, already facing goal.', '🧵 {name} {club}\'da neden parlıyor (flood) 1/4\n\nTopu nerede aldığına bakın: hatlar arasında, yarı dönük, zaten kaleye bakarak.'], ['🧵 Let\'s talk about {name}\'s movement. 1/3\n\n{g} goals in his last 3 is not luck: it\'s the runs off the shoulder.', '🧵 {name}\'ın koşularını konuşalım. 1/3\n\nSon 3 maçta {g} gol şans değil: savunmanın omzundan yaptığı koşular.'], ['🧵 Unpopular opinion thread: {name} is being used wrong. 1/5', '🧵 Popüler olmayan görüş floodu: {name} yanlış kullanılıyor. 1/5'], ['🧵 Pressing triggers and why {name} is the key to them. 1/4', '🧵 Pres tetikleyicileri ve {name} bunun neden anahtarı. 1/4'], ['🧵 Freeze-frame analysis: {name}\'s first touch is doing half the work. 1/3', '🧵 Durdurulmuş kare analizi: {name}\'ın ilk dokunuşu işin yarısını yapıyor. 1/3'], ['🧵 {club} without {name} vs with {name}: the difference is wild. 1/4', '🧵 {name}\'sız ve {name}\'lı {club}: fark inanılmaz. 1/4']]), { name, club: club.name, g }),
      { likes: Math.round(reach(c, 0.9) + 500), mood: 0.3, media: { kind: 'board', data: { pose: 'run' } } });
  }
  // on this day: a great match one season ago
  const ago = c.log.find((l) => l.season === c.season - 1 && l.week === c.week && (l.goals >= 2 || l.rating >= 8.3));
  if (ago) {
    post(c, persona(c, 'nerd'), T(fresh(c, 'otd', [['📅 On this day, one year ago: {name} vs {opp}. {g} goal(s), a {r} rating. Still not over it.', '📅 Bir yıl önce bugün: {name} - {opp}. {g} gol, {r} not. Hâlâ etkisindeyim.'], ['📅 Throwback: exactly a season ago {name} did THIS to {opp}.', '📅 Geri dönüş: tam bir sezon önce {name}, {opp}\'a BUNU yapmıştı.']]), { name, opp: clubName(c, ago.opp), g: ago.goals, r: ago.rating.toFixed(1) }),
      { likes: Math.round(reach(c, 0.9) + 400), mood: 0.6, media: { kind: 'clip', data: { dur: '0:31', views: Math.round(reach(c, 3)), pose: 'celebrate', opp: clubName(c, ago.opp), old: 1 } } });
  }
  // birthday
  if (c.week === 1 && c.season > 1) {
    if (club) post(c, { id: club.id, kind: 'ultra', owner: club.id, name: club.name, handle: club.handle, color: club.primary, verified: true }, T(fresh(c, 'bday', [['🎂 Happy birthday to our number {num}, {full}! {age} today. 🎉', '🎂 {num} numaramız {full}\'ın doğum günü kutlu olsun! Bugün {age} yaşında. 🎉']]), { num: me.num, full: me.name, age: me.age }), { av: 'club:' + club.id, likes: Math.round(reach(c, 1.2) + 1000), mood: 0.8 });
    post(c, persona(c, 'mum'), T(fresh(c, 'mumBday', [['Happy birthday my boy 💙 still remember you kicking a ball against my kitchen wall', 'Doğum günün kutlu olsun oğlum 💙 mutfak duvarıma top attığın günleri hâlâ hatırlıyorum'], ['{age} years old and still won\'t wear a jacket. Happy birthday darling 💙', '{age} yaşında ve hâlâ mont giymiyor. İyi ki doğdun canım 💙']]), { age: me.age }), { likes: Math.round(reach(c, 0.8) + 300), mood: 1 });
  }
  // the league table on KICKR (the stat account), with the gap
  const myLeague = c.contract && !isNat(c.contract.club) ? c.comps.find((k) => k.kind === 'league' && k.teams.includes(c.contract!.club)) : null;
  if (myLeague?.table && c.week % 5 === 0 && c.week > 5) {
    const tb = sortTable(myLeague.table);
    const pos = tb.findIndex((r) => r.id === c.contract!.club) + 1;
    post(c, persona(c, 'nerd'), T(fresh(c, 'tbl', [['Where we stand after week {w}: {pos}th, {pts} points. 📋', '{w}. hafta sonunda durum: {pos}. sıra, {pts} puan. 📋'], ['Table check ✅ {club} sit {pos}th.', 'Tablo kontrolü ✅ {club} {pos}. sırada.'], ['The view from {pos}th place 👀', '{pos}. sıradan manzara 👀'], ['{pts} points. Is that enough? Discuss. 📋', '{pts} puan. Yeterli mi? Tartışın. 📋'], ['Standings update, week {w}. Breathe. 📋', 'Puan durumu, {w}. hafta. Derin nefes. 📋']]), { w: c.week, pos, pts: tb[pos - 1]?.pts ?? 0, club: club?.name ?? '' }),
      { likes: Math.round(300 + rand(100, 1200)), media: { kind: 'table', data: { rows: tb.slice(Math.max(0, pos - 3), Math.max(0, pos - 3) + 5).map((r, i) => `${Math.max(0, pos - 3) + i + 1}:${clubName(c, r.id)}:${r.pts}:${r.id === c.contract!.club ? 1 : 0}`).join('|') } } });
  }
  // the trending list slowly cools
  st.stories = st.stories.filter((x) => abs(c) - (x.season * 100 + x.week) <= 1);
}

export function trend(c: Career, tag: string, n: number) {
  c.trends = [{ tag, n: Math.round(n) }, ...c.trends.filter((t) => t.tag !== tag)].slice(0, 8);
}

// ------------------------------------------------------------------ interactions

/** Vote in a poll: your vote shifts it a little and is remembered. */
export function votePoll(c: Career, p: Post, i: number) {
  const st = kx(c);
  if (st.polls[p.id] !== undefined || !p.media || p.media.kind !== 'poll') return;
  st.polls[p.id] = i;
  const pct = String(p.media.data.pct).split('|').map(Number);
  pct[i] = Math.min(100, pct[i] + 1);
  const sum = pct.reduce((a, b) => a + b, 0);
  p.media.data.pct = pct.map((x) => Math.round((x / sum) * 100)).join('|');
  p.media.data.total = Number(p.media.data.total) + 1;
  // voting for yourself: the internet notices
  if (i === 0 && String(p.media.data.opts).split('|')[0] === c.me.name && Math.random() < 0.5) {
    p.replies.unshift({ name: LP(['Eagle-eyed fan', 'Kartal gözlü taraftar']), handle: 'seen_it_all', text: LP(['did he just vote for himself 💀', 'kendine mi oy verdi 💀']), likes: Math.round(p.likes * 0.3) });
    c.me.image = clamp(c.me.image - 1, -100, 100);
  }
}

export function toggleLike(c: Career, p: Post) {
  const st = kx(c);
  const i = st.liked.indexOf(p.id);
  if (i >= 0) { st.liked.splice(i, 1); p.likes--; return false; }
  st.liked.push(p.id);
  if (st.liked.length > 300) st.liked.shift();
  p.likes++;
  // liking a nemesis jab or a hate post gets noticed
  if (p.tag === 'nemesis' && !p.mine) c.me.rel.nemesis = clamp(c.me.rel.nemesis + 2, 0, 100);
  return true;
}

void FAN_FIRST;

// ------------------------------------------------------------------ replies (composed)

const R_POS: TP[] = [
  ['HIM', 'O BAŞKA'], ['certified baller', 'onaylı top cambazı'], ['chef\'s kiss', 'parmak ısırtan'], ['goosebumps', 'tüylerim diken diken'], ['obsessed with this guy', 'bu adama takıntılıyım'],
  ['the aura', 'o aura'], ['generational talent fr', 'cidden nesil yeteneği'], ['he\'s different', 'o farklı'], ['frame it', 'çerçeveletin'], ['football heritage', 'futbol mirası'],
  ['we are so back', 'geri döndük'], ['my player', 'benim oyuncum'], ['ballon d\'or loading', 'altın top yükleniyor'], ['too clean', 'çok temiz'], ['the hair, the boots, the goals', 'saç, krampon, goller'],
  ['love this kid', 'bu çocuğu seviyorum'], ['pure class', 'saf klas'], ['let him cook', 'bırakın pişirsin'], ['main character', 'ana karakter'], ['bow down', 'eğilin'],
  ['textbook', 'ders niteliğinde'], ['the confidence 😮‍💨', 'o özgüven 😮‍💨'], ['national team NOW', 'HEMEN milli takım'], ['captain material', 'kaptanlık malzemesi'], ['statue when', 'heykel ne zaman'],
  ['I\'m in love', 'aşık oldum'], ['different gravity', 'farklı yerçekimi'], ['give him the 10', '10 numarayı verin'], ['cinema', 'sinema'], ['shut it down', 'kapatın gitsin'],
];
const R_NEG: TP[] = [
  ['overrated', 'abartılıyor'], ['one-season wonder', 'tek sezonluk mucize'], ['wait till he plays a real team', 'gerçek bir takımla oynasın görelim'], ['ratio', 'ratio'], ['agenda', 'gündem'],
  ['flat track bully', 'sadece küçüklere atıyor'], ['sell while you can', 'değeri varken satın'], ['nah', 'yok artık'], ['hype merchants again', 'yine hype tüccarları'], ['mid', 'vasat'],
  ['his agent wrote this', 'bunu menajeri yazdı'], ['PR team working overtime', 'PR ekibi mesaide'], ['stats padder', 'istatistik şişiriyor'], ['bench him', 'yedeğe çekin'], ['who?', 'kim?'],
  ['clown behaviour', 'palyaço davranışı'], ['not even top 5 in his team', 'takımında ilk 5\'te bile değil'], ['go back to the academy', 'altyapıya dönsün'], ['zzz', 'zzz'], ['delete', 'sil'],
];
const R_MIX: TP[] = [
  ['who asked', 'kim sordu'], ['can\'t wait for next week', 'gelecek haftayı bekleyemiyorum'], ['refs? oh right, no refs 😂', 'hakem? ha doğru, hakem yok 😂'], ['the replies 💀', 'yorumlar 💀'], ['this app is wild today', 'bugün bu uygulama çıldırmış'],
  ['mad football never misses', 'mad football asla ıskalamaz'], ['popcorn ready 🍿', 'patlamış mısır hazır 🍿'], ['screenshotting this', 'ekran görüntüsü alıyorum'], ['bookmarking for later', 'sonra bakmak için kaydettim'], ['saw this coming', 'bunu görmüştüm'],
  ['quote of the week', 'haftanın sözü'], ['I\'m just here for the comments', 'ben sadece yorumlar için buradayım'], ['the timeline is undefeated', 'zaman tüneli yenilmez'], ['this will age well', 'bu iyi yaşlanacak'], ['or very badly', 'ya da çok kötü'],
];
const R_TAIL_P = ['', '', ' 🔥', ' 👑', ' 🐐', ' 😭', ' 💙', ' 🙌', ' 💯', ' 🫡'];
const R_TAIL_N = ['', '', ' 💀', ' 🙄', ' 🤡', ' 📉', ' 🥱'];
const R_TAIL_M = ['', '', ' 😂', ' 👀', ' 🍿', ' 🤔'];

/** A short reply, rotated so the same few lines don't keep coming back. */
export function shortReply(c: Career, mood: 'pos' | 'neg' | 'mix') {
  const head = T(fresh(c, 'rr:' + mood, mood === 'pos' ? R_POS : mood === 'neg' ? R_NEG : R_MIX));
  const tail = pick(mood === 'pos' ? R_TAIL_P : mood === 'neg' ? R_TAIL_N : R_TAIL_M);
  const s = Math.random();
  return (s < 0.2 ? head.toUpperCase() : s < 0.35 ? head.charAt(0).toUpperCase() + head.slice(1) : head) + tail;
}
