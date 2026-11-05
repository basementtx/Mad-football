/**
 * KICKR (the in-game social network), the news site, DMs and press conferences.
 * Posts are generated from what actually happened, scaled by fame, and react to the user's own posts.
 */
import type { Career, Post, Reply, Headline, DM, MsgFrom, DMChoice, LastMatch, NPC } from './types';
import { OUTLETS, STAT_ACCOUNTS, MEME_ACCOUNTS, JOURNALISTS, AGENTS, SPONSORS, FAN_FIRST, FAN_SUFFIX, nationBy } from './data';
import { clamp, pick, rand } from '../engine/math';
import { L2, LP, fill, compact, money, isTR } from './util';
import { clubName, isNat, natCode, compById, compName, roundName, sortTable, myOvr } from './world';
import { nextId } from './state';
import { fresh, freshN, take, shortReply } from './kickr';
import { has, owns } from './me';

type TP = [string, string];
const T = (p: TP, v: Record<string, string | number> = {}) => fill(LP(p), v);

// ------------------------------------------------------------------ accounts

export function surname(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 && /^(van|de|di|da)$/i.test(parts[parts.length - 2]) ? parts.slice(-2).join(' ') : parts[parts.length - 1];
}

const EMOJI_CLUB = ['🔴', '🔵', '⚪', '🟡', '🟢', '🟣', '⚫', '🦅', '🦁', '🐺', '🔥', '⚡'];

export function fanAccount(c: Career, clubId: string | null, tone: 'any' | 'ultra' | 'casual' = 'any') {
  const k = clubId && !isNat(clubId) ? c.clubs[clubId] : null;
  const nat = k ? nationBy(k.nat) : nationBy(clubId && isNat(clubId) ? natCode(clubId) : c.me.nat);
  const word = pick(nat.fanWords ?? ['fan', 'fc', 'ultra']);
  const base = pick(FAN_FIRST);
  const short = k ? k.short.toLowerCase() : nat.code;
  const r = Math.random();
  const handle = r < 0.33 ? `${base}${pick(FAN_SUFFIX)}` : r < 0.66 ? `${short}_${word}${Math.random() < 0.5 ? pick(FAN_SUFFIX) : ''}` : `${word}${short}${Math.floor(rand(1, 99))}`;
  const disp = tone === 'ultra' || Math.random() < 0.3 ? `${capital(word)} ${k ? k.short : nat.code.toUpperCase()} ${pick(EMOJI_CLUB)}` : `${capital(base)}${Math.random() < 0.4 ? ' ' + pick(EMOJI_CLUB) : ''}`;
  return { name: disp, handle: handle.replace(/[^a-zA-Z0-9_]/g, ''), color: k ? k.primary : '#8a94aa' };
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function meHandle(c: Career) {
  return c.me.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 14) + (c.me.num ?? '');
}
export const myHandle = meHandle;

export function npcHandle(p: NPC) {
  return p.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 13) + p.num;
}

// ------------------------------------------------------------------ engagement

/** How big a post about the user gets. */
function reach(c: Career, mult = 1) {
  const f = c.me.followers;
  return Math.max(3, f * 0.025 * mult * (0.55 + Math.random() * 0.9));
}

function fanLikes(c: Career, viral = 1) {
  const base = 4 + Math.pow(c.me.rep, 1.6) * 0.8;
  return Math.round(base * viral * Math.exp(rand(-1, 1.6)));
}

let tCounter = 0;
function mk(c: Career, p: Partial<Post> & { name: string; handle: string; text: string; av: string }): Post {
  const likes = p.likes ?? 0;
  const post: Post = {
    id: nextId('po'),
    verified: false,
    likes,
    reposts: p.reposts ?? Math.round(likes * rand(0.08, 0.22)),
    replies: [],
    replyCount: p.replyCount ?? Math.round(likes * rand(0.03, 0.09)),
    week: c.week,
    season: c.season,
    t: ++tCounter,
    ...p,
  };
  return post;
}

export function addPost(c: Career, p: Post) {
  c.feed.unshift(p);
  if (c.feed.length > 160) c.feed.length = 160;
  return p;
}

function replies(c: Career, clubId: string | null, pool: TP[], n: number, v: Record<string, string | number>, viral = 1, mood?: 'pos' | 'neg' | 'mix'): Reply[] {
  const out: Reply[] = [];
  const md = mood ?? (pool === REPLY_POS ? 'pos' : pool === REPLY_NEG ? 'neg' : 'mix');
  const own = freshN(c, 'rp:' + pool[0][0].slice(0, 16), pool, n);
  for (let i = 0; i < n; i++) {
    const a = fanAccount(c, clubId);
    // half from this post's own pool, half composed so short replies keep changing
    // small pools (a few lines) give at most one line, the rest is composed
    const useOwn = own[i] && (pool.length > n * 2 ? i % 2 === 0 : i === 0);
    const text = useOwn ? T(own[i], v) : shortReply(c, md);
    out.push({ name: a.name, handle: a.handle, text, likes: Math.round(fanLikes(c, viral) * rand(0.05, 0.6)), color: a.color });
  }
  return out.sort((a, b) => b.likes - a.likes);
}

// ------------------------------------------------------------------ template banks

const FAN_GREAT: TP[] = [
  ['{name} is HIM. Not a debate anymore. 🔥', '{name} bambaşka bir seviye. Tartışma bitti. 🔥'],
  ['Give {name} whatever he wants. Contract, statue, the keys to the city. Everything.', '{name}\'a ne isterse verin. Sözleşme, heykel, şehrin anahtarı. Her şey.'],
  ['I\'ve watched football for 30 years. {name} tonight was something else 😭', '30 yıldır futbol izliyorum. {name} bu akşam başka bir şeydi 😭'],
  ['{rating} rating?? They should invent an 11 for {name}', '{rating} not mu?? {name} için 11 icat etsinler'],
  ['our number {num} cooking every single week 👨‍🍳', '{num} numaramız her hafta şov yapıyor 👨‍🍳'],
  ['Scouts who passed on {name} at the trial are crying right now', 'Denemede {name}\'ı beğenmeyen scoutlar şu an ağlıyor'],
  ['WHAT A PLAYER. {nick} have a superstar on our hands', 'NE OYUNCU AMA. Elimizde bir süperstar var'],
  ['{name} vs {opp}: owned. Bodied. Retired them.', '{name} - {opp}: sildi süpürdü. Emekli etti.'],
  ['I need {name} highlights on a loop, I\'m not okay', '{name} özetini sonsuz döngüde izlemem lazım, iyi değilim'],
  ['Put {name} in the national team NOW. What are we waiting for', '{name}\'ı HEMEN milli takıma alın. Neyi bekliyoruz'],
  ['That knockdown-and-score sequence from {name} should be illegal (it\'s Mad Football, nothing is illegal) 😂', '{name}\'ın yere serip golü attığı o an yasak olmalı (Mad Football\'da hiçbir şey yasak değil) 😂'],
];
const FAN_GOOD: TP[] = [
  ['Solid from {name} today. Getting better every week 👏', '{name} bugün sağlamdı. Her hafta daha iyi 👏'],
  ['Love the energy from {name}. Pure hunger.', '{name}\'ın enerjisine bayılıyorum. Saf açlık.'],
  ['{name} deserves to keep his place, simple as', '{name} yerini hak ediyor, bu kadar basit'],
  ['Quietly one of our best players this season, {name}', '{name} sessiz sedasız sezonun en iyilerinden'],
  ['Good shift from the lad {name}. More of that please', '{name}\'dan iyi bir mesai. Devamını isteriz'],
  ['{name} {rating}. Fair. Kid\'s growing up fast.', '{name} {rating}. Adil. Çocuk hızlı büyüyor.'],
];
const FAN_MEH: TP[] = [
  ['{name} was... there. I guess.', '{name} sahadaydı... sanırım.'],
  ['Not {name}\'s day but he never hid. Next one.', '{name}\'ın günü değildi ama kaçmadı. Sıradaki maça.'],
  ['Average from {name}. We need more from our number {num}', '{name} vasattı. {num} numaradan daha fazlası lazım'],
  ['Can someone explain what {name}\'s role was today? Genuinely asking', '{name}\'ın bugünkü görevi neydi biri açıklasın? Ciddi soruyorum'],
];
const FAN_BAD: TP[] = [
  ['{name} {rating}... generous honestly', '{name} {rating}... cömert bile'],
  ['Bench {name}. He\'s not ready for this level.', '{name} kesin yedek. Bu seviyeye hazır değil.'],
  ['How many times did {name} lose the ball?? I stopped counting', '{name} kaç kere top kaybetti?? Saymayı bıraktım'],
  ['{name} playing like he\'s already sold. Wake up', '{name} sanki satılmış gibi oynuyor. Uyan artık'],
  ['Every week the same excuses for {name}. Enough.', 'Her hafta {name} için aynı bahaneler. Yeter.'],
  ['Hide {name}\'s phone after this one 💀', 'Bu maçtan sonra {name}\'ın telefonunu saklayın 💀'],
];
const REPLY_POS: TP[] = [
  ['facts', 'aynen'], ['this 👆', 'bu 👆'], ['{name} szn', '{name} sezonu'], ['generational', 'nesil yeteneği'], ['ratio + {name} is better than your fav', 'ratio + {name} senin favorinden iyi'],
  ['said this months ago', 'aylar önce söylemiştim'], ['the vision 🔥', 'vizyon 🔥'], ['GOAT behaviour', 'GOAT davranışı'], ['crying rn', 'şu an ağlıyorum'], ['he\'s one of us 💙', 'o bizden biri 💙'],
];
const REPLY_NEG: TP[] = [
  ['overrated', 'abartılıyor'], ['one good game lol', 'bir iyi maç lol'], ['wait till he plays a real team', 'gerçek bir takımla oynayınca görürüz'], ['agenda', 'gündem yaratıyorlar'],
  ['hype merchants again', 'yine hype tüccarları'], ['sell while his value is up', 'değeri yüksekken satın'], ['nah', 'yok artık'],
];
const REPLY_MIX: TP[] = [
  ['the {opp} fans in the replies are seething 😂', 'cevaplardaki {opp} taraftarları köpürüyor 😂'], ['who asked', 'kim sordu'], ['can\'t wait for next week', 'gelecek haftayı bekleyemiyorum'],
  ['League is so back', 'Lig geri döndü'], ['ref? oh wait, no refs 😂', 'hakem? ah dur, hakem yok 😂'], ['mad football never disappoints', 'mad football asla hayal kırıklığı yaşatmaz'],
];
const OPP_FAN: TP[] = [
  ['Our defence vs {name} was a crime scene. Sack everyone.', 'Savunmamız {name}\'a karşı tam bir olay yeriydi. Herkesi kovun.'],
  ['Who is {name}?? Why did nobody mark him??', '{name} kim?? Neden kimse onu tutmadı??'],
  ['Lucky. {name} won\'t do that again.', 'Şans. {name} bunu bir daha yapamaz.'],
  ['Fine. {name} is good. I hate it here.', 'Tamam. {name} iyi. Burada olmaktan nefret ediyorum.'],
];
const JOURNO_GOOD: TP[] = [
  ['{full} is the story of the weekend. {goals} goals, {rating} rating, and a confidence you rarely see at {age}.', 'Hafta sonunun hikâyesi {full}. {goals} gol, {rating} not ve {age} yaşında nadir görülen bir özgüven.'],
  ['Spoke to people at {club}: they believe {full} is the best young player they\'ve had in a decade.', '{club} içinden kişilerle konuştum: {full}\'ın son on yılda yetiştirdikleri en iyi genç olduğuna inanıyorlar.'],
  ['Scouts from three clubs were in the stands for {full} tonight. Expect noise in the window.', 'Bu akşam tribünde {full} için üç kulübün scoutu vardı. Transfer döneminde ses getirecek.'],
];
const JOURNO_BAD: TP[] = [
  ['Worrying signs for {full}: {rating} tonight and the body language wasn\'t great either.', '{full} için endişe verici işaretler: bu akşam {rating} ve beden dili de iyi değildi.'],
  ['{club} staff are said to be frustrated with {full}\'s decision-making in recent weeks.', '{club} teknik ekibinin son haftalarda {full}\'ın karar verme sürecinden rahatsız olduğu söyleniyor.'],
];
const MEME_HAT: TP[] = [
  ['{name} after his hat-trick walking past the {opp} defence', '{name} hat-trick sonrası {opp} savunmasının yanından geçerken'],
  ['POV: you\'re {opp}\'s keeper and {name} has the ball again', 'POV: {opp} kalecisisin ve top yine {name}\'da'],
];
const MEME_KD: TP[] = [
  ['{name} put {kd} people on the floor today. Physio deserves a raise 🚑', '{name} bugün {kd} kişiyi yere serdi. Fizyoterapiste zam 🚑'],
  ['Mad Football tackle of the week goes to {name}. Somebody check on that midfielder 💀', 'Haftanın Mad Football müdahalesi {name}\'dan. O orta sahacı iyi mi biri baksın 💀'],
];
const MEME_BAD: TP[] = [
  ['{name}\'s first touch today was a long-distance relationship', '{name}\'ın bugünkü ilk dokunuşu uzak mesafe ilişkisi gibiydi'],
  ['{name} trying to find the ball today:', '{name} bugün topu ararken:'],
];
const MATE_SHOUT: TP[] = [
  ['What a ball from my brother {me} 🎯🤝 @{h}', 'Kardeşim {me}\'dan ne pas ama 🎯🤝 @{h}'],
  ['Told you he\'s special 👀 @{h}', 'Size özel olduğunu söylemiştim 👀 @{h}'],
  ['Big 3 points. This kid @{h} 🔥', 'Büyük 3 puan. Bu çocuk @{h} 🔥'],
];
const NEMESIS_JAB: TP[] = [
  ['Some people get 1 good game and think they\'ve made it. Stay humble 🤫', 'Bazıları bir iyi maç yapınca oldum sanıyor. Mütevazı kalın 🤫'],
  ['Goals > posts. Just saying. ⚽⚽', 'Goller > paylaşımlar. Sadece söylüyorum. ⚽⚽'],
  ['Funny how the hype train never stops at the trophy cabinet 🏆😂', 'Hype treni bir türlü kupa dolabında durmuyor ne ilginç 🏆😂'],
];
const NEMESIS_GOAL: TP[] = [
  ['{n} {g} goals today. Who\'s next? 🐐', 'Bugün {g} gol. Sıradaki kim? 🐐'],
  ['Another day, another goal. {club} 🔥', 'Başka bir gün, başka bir gol. {club} 🔥'],
];

// ------------------------------------------------------------------ match media

export function matchMedia(c: Career, lm: LastMatch) {
  tCounter = 0;
  const me = c.me;
  const my = lm.nat ? 'n:' + me.nat : c.contract?.club ?? null;
  const k = my && !isNat(my) ? c.clubs[my] : null;
  const v = {
    name: surname(me.name), full: me.name, num: me.num, rating: lm.rating.toFixed(1), opp: clubName(c, lm.opp), club: my ? clubName(c, my) : '',
    nick: k ? LP(k.nick) : '', goals: lm.goals, age: me.age, score: `${lm.gf}-${lm.ga}`, kd: lm.line.knockdowns, me: surname(me.name), h: meHandle(c),
  };
  const comp = compName(c, lm.comp);
  const win = lm.gf > lm.ga, loss = lm.gf < lm.ga;
  const big = lm.rating >= 8 || lm.goals >= 2;
  const viral = (1 + lm.goals * 0.6 + (lm.rating >= 8.5 ? 1 : 0) + (lm.goals >= 3 ? 3 : 0)) * (has(c, 'showman') ? 1.5 : 1);

  // official account: full time
  if (k || lm.nat) {
    const offName = k ? k.name : LP(['National Team', 'Milli Takım']) + ' · ' + clubName(c, my!);
    const off = mk(c, {
      name: offName, handle: k ? k.handle : natCode(my!).toUpperCase() + 'NationalTeam', verified: true, av: k ? 'club:' + k.id : 'nat:' + natCode(my!),
      text: `${T(['FULL TIME', 'MAÇ SONU'])} | ${comp}\n\n${clubName(c, lm.home ? my! : lm.opp)} ${lm.home ? lm.gf : lm.ga}-${lm.home ? lm.ga : lm.gf} ${clubName(c, lm.home ? lm.opp : my!)}${win ? ' ✅' : loss ? '' : ''}`,
      likes: Math.round(reach(c, 0.5) + (k ? k.rep * k.rep * 2 : 3000) * rand(0.6, 1.2)),
      media: { kind: 'score', data: { home: lm.home ? my! : lm.opp, away: lm.home ? lm.opp : my!, hg: lm.home ? lm.gf : lm.ga, ag: lm.home ? lm.ga : lm.gf, comp } },
      mood: win ? 0.3 : loss ? -0.2 : 0,
    });
    off.replies = replies(c, my, win ? REPLY_POS : loss ? REPLY_NEG : REPLY_MIX, 2, v);
    addPost(c, off);
  }
  // goal posts
  if (lm.goals > 0 && (k || lm.nat)) {
    const gp = mk(c, {
      name: k ? k.name : clubName(c, my!), handle: k ? k.handle : natCode(my!).toUpperCase() + 'NationalTeam', verified: true, av: k ? 'club:' + k.id : 'nat:' + natCode(my!),
      text: lm.goals >= 3 ? T(['🎩 HAT-TRICK HERO 🎩\n\n{full} takes the match ball home!', '🎩 HAT-TRICK KAHRAMANI 🎩\n\n{full} maç topunu evine götürüyor!'], v) : T([`⚽ GOAL${lm.goals > 1 ? 'S' : ''}! {full} ${lm.goals > 1 ? 'x' + lm.goals : ''} 🔥`, `⚽ GOL${lm.goals > 1 ? 'LER' : ''}! {full} ${lm.goals > 1 ? 'x' + lm.goals : ''} 🔥`], v),
      likes: Math.round(reach(c, 1.2 * viral) + 400),
      media: { kind: 'photo', data: { who: 'me', pose: 'celebrate' } },
      mood: 0.8,
    });
    gp.replies = replies(c, my, REPLY_POS, 3, v, viral);
    addPost(c, gp);
  }
  // stat account
  if (lm.rating >= 7.6 || lm.rating <= 5.4 || lm.goals >= 2) {
    const sa = pick(STAT_ACCOUNTS);
    const lines = [
      `${T(['Rating', 'Not'])}: ${lm.rating.toFixed(1)}`,
      `⚽ ${lm.goals}  🅰️ ${lm.assists}`,
      `${T(['Shots on target', 'İsabetli şut'])}: ${lm.line.onTarget}/${lm.line.shots}`,
      `${T(['Passes', 'Pas'])}: ${lm.line.passOk}  ${T(['Balls won', 'Top kazanma'])}: ${lm.line.steals}`,
      `💥 ${T(['Knockdowns', 'Yere serme'])}: ${lm.line.knockdowns}`,
    ];
    const s = mk(c, {
      name: sa.name, handle: sa.handle, verified: true, av: 'c:' + sa.color,
      text: `${me.name} vs ${clubName(c, lm.opp)}:\n\n${lines.join('\n')}${lm.rating >= 8.5 ? T(['\n\nElite.', '\n\nElit.']) : lm.rating <= 5.4 ? T(['\n\nOne to forget.', '\n\nUnutulacak bir gün.']) : ''}`,
      likes: Math.round(reach(c, 0.8 * viral) + 200),
      media: { kind: 'rating', data: { r: lm.rating.toFixed(1), g: lm.goals, a: lm.assists } },
      mood: lm.rating >= 7 ? 0.5 : -0.5,
    });
    s.replies = replies(c, my, lm.rating >= 7 ? REPLY_POS : REPLY_NEG, 2, v, viral);
    addPost(c, s);
  }
  // fan reactions
  const bucket = lm.rating >= 8 ? FAN_GREAT : lm.rating >= 6.9 ? FAN_GOOD : lm.rating >= 6 ? FAN_MEH : FAN_BAD;
  const nFans = clamp(Math.round(2 + me.rep / 25 + (big ? 2 : 0)), 2, 6);
  const bankKey = bucket === FAN_GREAT ? 'FG' : bucket === FAN_GOOD ? 'FO' : bucket === FAN_MEH ? 'FM' : 'FB';
  const fromBank = freshN(c, bankKey, bucket, Math.ceil(nFans / 2));
  for (let i = 0; i < nFans; i++) {
    const a = fanAccount(c, my);
    const lk = fanLikes(c, viral * (bucket === FAN_GREAT ? 1.5 : 1));
    // every other fan writes a take built from what actually happened in the match
    const text = i % 2 === 1 || !fromBank[i >> 1] ? take(c, lm).text : T(fromBank[i >> 1], v);
    const p = mk(c, { name: a.name, handle: a.handle, av: 'c:' + a.color, text, likes: lk, mood: bucket === FAN_GREAT ? 1 : bucket === FAN_GOOD ? 0.5 : bucket === FAN_MEH ? -0.1 : -0.8 });
    if (Math.random() < 0.6) p.replies = replies(c, my, bucket === FAN_BAD ? [...REPLY_NEG, ...REPLY_MIX] : [...REPLY_POS, ...REPLY_MIX], 1 + Math.floor(Math.random() * 3), v, viral * 0.6);
    addPost(c, p);
  }
  // opposition fans after you hurt them
  if (lm.goals > 0 && !isNat(lm.opp) && c.clubs[lm.opp]) {
    const a = fanAccount(c, lm.opp);
    addPost(c, mk(c, { name: a.name, handle: a.handle, av: 'c:' + a.color, text: T(fresh(c, 'OPP_FAN', OPP_FAN), v), likes: fanLikes(c, viral * 0.5), mood: 0.2 }));
  }
  // journalist
  if (lm.rating >= 8 || lm.rating <= 5.2) {
    const [jn, jh] = pick(JOURNALISTS.filter((j) => j[2] >= 3));
    const jp = mk(c, { name: jn, handle: jh, verified: true, av: 'c:#3a4766', text: T(lm.rating >= 8 ? fresh(c, 'JG', JOURNO_GOOD) : fresh(c, 'JB', JOURNO_BAD), v), likes: Math.round(reach(c, 0.6) + 300), mood: lm.rating >= 8 ? 0.6 : -0.6 });
    jp.replies = replies(c, my, lm.rating >= 8 ? REPLY_POS : REPLY_NEG, 2, v);
    addPost(c, jp);
  }
  // memes
  const mem = lm.goals >= 3 ? MEME_HAT : lm.line.knockdowns >= 4 ? MEME_KD : lm.rating <= 5.2 ? MEME_BAD : null;
  if (mem) {
    const ma = pick(MEME_ACCOUNTS);
    const mp = mk(c, { name: ma.name, handle: ma.handle, av: 'c:' + ma.color, text: T(fresh(c, 'mem' + mem.length, mem), v), likes: Math.round(reach(c, 1.6 * viral) + 2000), media: { kind: 'photo', data: { who: 'me', pose: lm.rating <= 5.2 ? 'down' : 'celebrate' } }, mood: lm.rating <= 5.2 ? -0.4 : 0.6 });
    mp.replies = replies(c, my, REPLY_MIX, 3, v, viral);
    addPost(c, mp);
  }
  // team-mate shout-out
  if (lm.assists > 0 && !lm.nat && c.contract && Math.random() < 0.7) {
    const mate = c.clubs[c.contract.club]?.squad.map((id) => c.npcs[id]).filter((p) => p && p.pos !== 'GK').sort(() => Math.random() - 0.5)[0];
    if (mate) {
      const p = mk(c, { name: mate.name, handle: npcHandle(mate), verified: c.clubs[c.contract.club].rep > 60, av: 'npc:' + mate.id, text: T(fresh(c, 'MATE_SHOUT', MATE_SHOUT), v), likes: Math.round(reach(c, 0.7) + 500), mood: 0.7 });
      addPost(c, p);
    }
  }
  // trending tags
  const trends: { tag: string; n: number }[] = [];
  if (big) trends.push({ tag: surname(me.name).replace(/\s/g, ''), n: Math.round(reach(c, 4 * viral)) });
  const oppShort = isNat(lm.opp) ? natCode(lm.opp).toUpperCase() : c.clubs[lm.opp]?.short ?? 'OPP';
  if (k) trends.push({ tag: `${k.short}v${oppShort}`, n: Math.round((reach(c, 1.5) + k.rep * 300) * rand(0.6, 1.6)) });
  else if (lm.nat) trends.push({ tag: `${natCode(my!).toUpperCase()}v${oppShort}`, n: Math.round(reach(c, 2) * rand(1, 3) + 20000) });
  c.trends = [...trends, ...c.trends.filter((x) => !trends.some((y) => y.tag === x.tag))].slice(0, 8);

  // followers spike & headline
  const spike = Math.round((lm.goals * 40 + Math.max(0, lm.rating - 7) * 80 + (lm.goals >= 3 ? 600 : 0)) * (1 + me.rep / 10) * (has(c, 'showman') ? 1.5 : 1));
  me.followers += Math.max(0, spike);
  if (big) {
    headline(c, {
      kind: 'match', big: lm.goals >= 3 || lm.rating >= 9,
      title: lm.goals >= 3 ? T(['{full} hat-trick floors {opp}', '{full} hat-trick ile {opp}\'u yıktı'], v) : lm.goals >= 2 ? T(['{name} double sinks {opp}', '{name}\'dan {opp}\'a iki gol'], v) : T(['{name} the star in {score} vs {opp}', '{opp} karşısında {score}: yıldız {name}'], v),
      sub: T(['{comp}: a {rating} performance has everyone talking.', '{comp}: {rating}\'lik performans herkesin dilinde.'], { ...v, comp }),
      pic: my ?? undefined,
    });
  } else if (lm.rating <= 5.2) {
    headline(c, { kind: 'match', title: T(['Nightmare for {name} against {opp}', '{name} için {opp} karşısında kâbus'], v), sub: T(['A {rating} rating. Pressure is building.', '{rating} not. Baskı artıyor.'], v), pic: my ?? undefined });
  }
}

/** Nemesis activity after a matchweek (call with the nemesis' goals this week). */
export function nemesisMedia(c: Career, goals: number) {
  const n = c.npcs[c.nemesis];
  if (!n) return;
  if (goals > 0 && Math.random() < 0.7) {
    const p = mk(c, { name: n.name, handle: npcHandle(n), verified: n.ovr > 72, av: 'npc:' + n.id, text: T(fresh(c, 'NEMESIS_GOAL', NEMESIS_GOAL), { n: '', g: goals, club: n.club ? clubName(c, n.club) : '' }), likes: Math.round(Math.pow(n.ovr - 50, 3) * rand(1, 3)) + 50, mood: -0.2, tag: 'nemesis' });
    p.replies = replies(c, n.club, REPLY_POS, 2, { name: surname(n.name), opp: '' });
    addPost(c, p);
  }
  if (c.me.rel.nemesis > 55 && Math.random() < (c.me.rel.nemesis - 40) / 120) {
    const p = mk(c, { name: n.name, handle: npcHandle(n), verified: n.ovr > 72, av: 'npc:' + n.id, text: T(fresh(c, 'NEMESIS_JAB', NEMESIS_JAB)), likes: Math.round(reach(c, 1.8) + 800), mood: -0.6, tag: 'nemesis' });
    p.replies = replies(c, null, [...REPLY_MIX, ['@{h} you gonna take that?', '@{h} buna cevap vermeyecek misin?'], ['this is about {name} right 👀', 'bu {name} hakkında değil mi 👀'], ['beef season 🍿', 'kapışma sezonu 🍿']], 3, { name: surname(c.me.name), h: meHandle(c), opp: '' }, 2);
    addPost(c, p);
    c.me.rel.nemesis = clamp(c.me.rel.nemesis + 3, 0, 100);
  }
}

// ------------------------------------------------------------------ world news (weekly)

export function worldMedia(c: Career) {
  tCounter = 20;
  // last week's talk fades
  c.trends = c.trends.map((x) => ({ ...x, n: Math.round(x.n * 0.55) })).filter((x) => x.n > 800);
  const myLeague = c.contract && !isNat(c.contract.club) ? c.comps.find((k) => k.kind === 'league' && k.teams.includes(c.contract!.club)) : null;
  const lw = c.fixtures.filter((f) => f.week === c.week && f.played);
  // upsets
  for (const f of lw) {
    const kh = c.clubs[f.home], ka = c.clubs[f.away];
    if (!kh || !ka || f.hg === undefined) continue;
    const giantLost = (kh.rep > ka.rep + 25 && f.hg! < f.ag!) || (ka.rep > kh.rep + 25 && f.ag! < f.hg!);
    if (giantLost && Math.random() < 0.5) {
      const o = pick(OUTLETS);
      const loser = kh.rep > ka.rep ? kh : ka, winner = loser === kh ? ka : kh;
      addPost(c, mk(c, {
        name: o.name, handle: o.handle, verified: true, av: 'c:' + o.color,
        text: T(['🚨 SHOCK: {w} stun {l}! {s}', '🚨 ŞOK: {w}, {l}\'u yıktı! {s}'], { w: winner.name, l: loser.name, s: `${f.hg}-${f.ag}` }),
        likes: Math.round(2000 + loser.rep * 80 * rand(0.5, 1.5)),
        media: { kind: 'score', data: { home: f.home, away: f.away, hg: f.hg!, ag: f.ag!, comp: compName(c, f.comp) } },
      }));
      break;
    }
  }
  // the title race (only in weeks with league games)
  const leagueWeek = lw.some((f) => f.comp === myLeague?.id);
  if (myLeague && myLeague.table && leagueWeek && c.week > 6 && Math.random() < 0.45) {
    const tb = sortTable(myLeague.table);
    const o = pick(OUTLETS);
    const gap = tb[0].pts - tb[1].pts;
    addPost(c, mk(c, {
      name: o.name, handle: o.handle, verified: true, av: 'c:' + o.color,
      text: gap <= 2
        ? T(['🔥 {l}: just {g} point(s) between {a} and {b} at the top. This title race is MAD.', '🔥 {l}: zirvede {a} ile {b} arasında sadece {g} puan. Bu şampiyonluk yarışı ÇILGIN.'], { l: LP(myLeague.name), g: gap, a: clubName(c, tb[0].id), b: clubName(c, tb[1].id) })
        : T(['{a} are running away with the {l}: {g} points clear.', '{a} {l}\'de kaçıyor: {g} puan önde.'], { l: LP(myLeague.name), g: gap, a: clubName(c, tb[0].id) }),
      likes: Math.round(800 + rand(500, 6000)),
    }));
  }
  // golden boot race in your league
  if (myLeague && leagueWeek && c.week > 8 && c.week % 4 === 0) {
    const top = Object.values(c.npcs).filter((p) => p.club && myLeague.teams.includes(p.club)).sort((a, b) => b.s.goals - a.s.goals).slice(0, 3);
    const sa = pick(STAT_ACCOUNTS);
    const mineG = c.s.goals;
    const list = [...top.map((p) => ({ n: p.name, g: p.s.goals })), { n: c.me.name, g: mineG }].sort((a, b) => b.g - a.g).slice(0, 4);
    addPost(c, mk(c, {
      name: sa.name, handle: sa.handle, verified: true, av: 'c:' + sa.color,
      text: `${T(['Top scorers', 'Gol krallığı'])} · ${LP(myLeague.name)}\n\n${list.map((x, i) => `${i + 1}. ${x.n} — ${x.g}`).join('\n')}`,
      likes: Math.round(600 + rand(200, 3000)),
      media: { kind: 'stat', data: { title: T(['Golden Boot race', 'Gol krallığı yarışı']) } },
    }));
  }
  if (c.feed.length > 160) c.feed.length = 160;
}

// ------------------------------------------------------------------ event posts

export function eventPost(c: Career, kind: 'signing' | 'loan' | 'renewal' | 'injury' | 'callup' | 'award' | 'trophy' | 'captain' | 'milestone' | 'return' | 'sponsor', data: Record<string, string | number> = {}) {
  tCounter = 10;
  const me = c.me;
  const v = { full: me.name, name: surname(me.name), h: meHandle(c), ...data };
  const o = pick(OUTLETS);
  const club = c.contract ? c.clubs[c.contract.club] : null;
  const L = (p: TP) => T(p, v);
  const boost = 1 + me.rep / 20;
  switch (kind) {
    case 'signing':
    case 'loan': {
      const j = pick(JOURNALISTS.filter((x) => x[2] >= 4));
      addPost(c, mk(c, { name: j[0], handle: j[1], verified: true, av: 'c:#3a4766', text: L(kind === 'loan' ? ['{full} to {club} on loan. Agreement done, medical booked. ✅🔄', '{full} kiralık olarak {club}\'a. Anlaşma tamam, sağlık kontrolü ayarlandı. ✅🔄'] : ['DONE DEAL ✅ {full} to {club}. {fee}. {years}-year deal. Medical completed.', 'İMZA TAMAM ✅ {full} {club}\'da. {fee}. {years} yıllık sözleşme. Sağlık kontrolü tamam.']), likes: Math.round(reach(c, 2) + 1500 * boost), media: { kind: 'transfer', data: { club: String(data.clubId ?? ''), fee: String(data.fee ?? '') } }, mood: 0.5 }));
      if (data.clubId && c.clubs[String(data.clubId)]) {
        const k = c.clubs[String(data.clubId)];
        const p = mk(c, { name: k.name, handle: k.handle, verified: true, av: 'club:' + k.id, text: L(['✍️ Welcome to {club}, {full}! #{tag}', '✍️ {club}\'a hoş geldin, {full}! #{tag}']).replace('{tag}', k.short + 'Family'), likes: Math.round(reach(c, 1.5) + k.rep * k.rep * 3), media: { kind: 'photo', data: { who: 'me', pose: 'sign' } }, mood: 0.7 });
        p.replies = replies(c, k.id, [...REPLY_POS, ['welcome brother 💪', 'hoş geldin kardeşim 💪'], ['finally!!', 'sonunda!!']], 3, v, 2);
        addPost(c, p);
      }
      headline(c, { kind: 'transfer', big: true, title: L(['{full} completes {club} move', '{full}, {club}\'a imzayı attı']), sub: L(['Fee: {fee}. A new chapter begins.', 'Bonservis: {fee}. Yeni bir sayfa açılıyor.']), pic: String(data.clubId ?? '') });
      break;
    }
    case 'renewal':
      if (club) addPost(c, mk(c, { name: club.name, handle: club.handle, verified: true, av: 'club:' + club.id, text: L(['🖊️ {full} has signed a new {years}-year contract! 💪', '🖊️ {full} {years} yıllık yeni sözleşme imzaladı! 💪']), likes: Math.round(reach(c, 1.2) + club.rep * club.rep * 2), mood: 0.6 }));
      break;
    case 'injury':
      addPost(c, mk(c, { name: o.name, handle: o.handle, verified: true, av: 'c:' + o.color, text: L(['🚑 Blow for {club}: {full} out for around {weeks} weeks ({kind}).', '🚑 {club}\'a kötü haber: {full} yaklaşık {weeks} hafta yok ({kind}).']).replace('{club}', club?.name ?? ''), likes: Math.round(reach(c, 0.8) + 500), media: { kind: 'injury', data: { weeks: data.weeks ?? 0 } }, mood: -0.3 }));
      headline(c, { kind: 'injury', title: L(['{full} injured: {weeks} weeks out', '{full} sakatlandı: {weeks} hafta yok']), sub: L(['Scans confirm a {kind}.', 'Tetkikler {kind} olduğunu doğruladı.']), pic: club?.id });
      break;
    case 'return':
      addPost(c, mk(c, { name: club?.name ?? o.name, handle: club?.handle ?? o.handle, verified: true, av: club ? 'club:' + club.id : 'c:' + o.color, text: L(['👊 Look who\'s back in training! {full} is fit again.', '👊 Bakın kim antrenmana döndü! {full} yeniden hazır.']), likes: Math.round(reach(c, 1) + 400), media: { kind: 'photo', data: { who: 'me', pose: 'train' } }, mood: 0.6 }));
      break;
    case 'callup': {
      const n = nationBy(me.nat);
      const p = mk(c, { name: LP([n.en, n.tr]) + ' ' + T(['National Team', 'Milli Takımı']), handle: n.code.toUpperCase() + 'NationalTeam', verified: true, av: 'nat:' + n.code, text: L(['📋 SQUAD ANNOUNCEMENT\n\n{full} receives a call-up for the first time! 🌟', '📋 KADRO AÇIKLANDI\n\n{full} ilk kez milli takıma çağrıldı! 🌟']), likes: Math.round(reach(c, 2) + 5000), media: { kind: 'callup', data: { nat: n.code } }, mood: 0.8 });
      p.replies = replies(c, 'n:' + n.code, [...REPLY_POS, ['deserved!!', 'hak etti!!'], ['finally a coach with eyes', 'sonunda gözü olan bir hoca']], 3, v, 2);
      addPost(c, p);
      headline(c, { kind: 'intl', big: true, title: L(['{full} earns first national call-up', '{full} ilk kez milli takımda']), sub: L(['A dream come true at {age}.', '{age} yaşında bir rüya gerçek oldu.']).replace('{age}', String(me.age)), pic: 'n:' + n.code });
      break;
    }
    case 'award': {
      const p = mk(c, { name: o.name, handle: o.handle, verified: true, av: 'c:' + o.color, text: L(['🏆 {award}: {full}!', '🏆 {award}: {full}!']), likes: Math.round(reach(c, 3) + 8000), media: { kind: 'award', data: { award: String(data.award ?? '') } }, mood: 1 });
      p.replies = replies(c, club?.id ?? null, REPLY_POS, 4, v, 3);
      addPost(c, p);
      headline(c, { kind: 'award', big: true, title: L(['{full} wins {award}', '{award} {full}\'ın']), sub: L(['The crowning moment of a stunning season.', 'Muhteşem bir sezonun taç giydiği an.']) });
      break;
    }
    case 'trophy':
      if (club) {
        const p = mk(c, { name: club.name, handle: club.handle, verified: true, av: 'club:' + club.id, text: L(['🏆 CHAMPIONS! {trophy} is ours! 🏆', '🏆 ŞAMPİYON! {trophy} bizim! 🏆']), likes: Math.round(reach(c, 3) + club.rep * club.rep * 10), media: { kind: 'award', data: { award: String(data.trophy ?? '') } }, mood: 1 });
        p.replies = replies(c, club.id, [...REPLY_POS, ['best day of my life 😭', 'hayatımın en güzel günü 😭'], ['WE DID IT', 'BAŞARDIK']], 4, v, 3);
        addPost(c, p);
      }
      break;
    case 'captain':
      if (club) addPost(c, mk(c, { name: club.name, handle: club.handle, verified: true, av: 'club:' + club.id, text: L(['©️ Our new captain: {full}. Lead us. 💪', '©️ Yeni kaptanımız: {full}. Bize liderlik et. 💪']), likes: Math.round(reach(c, 1.5) + 3000), mood: 0.8 }));
      break;
    case 'milestone': {
      const sa = pick(STAT_ACCOUNTS);
      addPost(c, mk(c, { name: sa.name, handle: sa.handle, verified: true, av: 'c:' + sa.color, text: L(['🎯 {what}: {full} at just {age}.', '🎯 {what}: {full}, henüz {age} yaşında.']).replace('{age}', String(me.age)), likes: Math.round(reach(c, 1.5) + 1500), media: { kind: 'stat', data: { title: String(data.what ?? '') } }, mood: 0.7 }));
      break;
    }
    case 'sponsor':
      addPost(c, mk(c, { name: String(data.brand), handle: String(data.brand).replace(/\s/g, ''), verified: true, av: 'c:' + String(data.color ?? '#333'), text: L(['Welcome to the team, {full}. #{tag}', 'Takıma hoş geldin, {full}. #{tag}']), likes: Math.round(reach(c, 1) + 2500), media: { kind: 'photo', data: { who: 'me', pose: 'sponsor' } }, mood: 0.4 }));
      break;
  }
}

// ------------------------------------------------------------------ headlines

export function headline(c: Career, h: Omit<Headline, 'id' | 'week' | 'season'>) {
  c.news.unshift({ id: nextId('h'), week: c.week, season: c.season, ...h });
  if (c.news.length > 50) c.news.length = 50;
}

// ------------------------------------------------------------------ DMs

export function dm(c: Career, from: MsgFrom, name: string, text: string, opts: { choices?: DMChoice[]; act?: string; data?: Record<string, unknown>; thread?: string } = {}) {
  const m: DM = { id: nextId('d'), thread: opts.thread ?? from + ':' + name, from, name, text, week: c.week, season: c.season, choices: opts.choices, act: opts.act, data: opts.data };
  c.dms.push(m);
  if (c.dms.length > 120) c.dms = c.dms.slice(-120);
  return m;
}

export function agentName(c: Career) {
  return AGENTS[c.agent % AGENTS.length].name;
}

export function managerName(c: Career) {
  return c.contract ? c.clubs[c.contract.club]?.manager ?? 'Coach' : 'Coach';
}

export const unreadDMs = (c: Career) => c.dms.filter((d) => !d.mine && !d.read).length;

/** The user answered a DM with a choice. Returns a toast line. */
export function resolveDM(c: Career, d: DM, choice: DMChoice): string {
  d.read = true;
  const me = c.me;
  const rel = me.rel;
  const reply = (t: string) => dm(c, d.from, d.name, t, { thread: d.thread });
  const mine = (t: string) => {
    const m = dm(c, d.from, d.name, t, { thread: d.thread });
    m.mine = true;
    m.read = true;
  };
  mine(choice.label);
  d.choices = undefined;
  switch (d.act + ':' + choice.id) {
    case 'mgr_crit:accept': rel.manager += 4; me.morale -= 2; reply(T(['Good. Show me on the pitch.', 'Güzel. Sahada göster.'])); return T(['Manager trust +4', 'Hoca güveni +4']);
    case 'mgr_crit:push': rel.manager -= 6; me.morale += 3; reply(T(['Minutes are earned, not demanded.', 'Süre talep edilmez, kazanılır.'])); return T(['Manager trust -6', 'Hoca güveni -6']);
    case 'mgr_praise:thanks': rel.manager += 3; reply(T(['Keep your feet on the ground.', 'Ayakların yere bassın.'])); return T(['Manager trust +3', 'Hoca güveni +3']);
    case 'mgr_praise:more': rel.manager += 1; me.morale += 4; reply(T(['Ha. Hungry. I like it.', 'Ha. Açsın. Hoşuma gitti.'])); return T(['Morale +4', 'Moral +4']);
    case 'mate_banter:banter': rel.mates += 4; reply(pick([T(['😂😂 dinner\'s on you then', '😂😂 o zaman yemek senden']), T(['bro stop 💀', 'kanka yapma 💀'])])); return T(['Team chemistry +4', 'Takım uyumu +4']);
    case 'mate_banter:serious': rel.mates += 1; reply(T(['fair enough captain 🫡', 'haklısın kaptan 🫡'])); return T(['Team chemistry +1', 'Takım uyumu +1']);
    case 'nem:ignore': rel.media += 2; me.image += 2; return T(['Image +2', 'İmaj +2']);
    case 'nem:clap': rel.nemesis += 10; me.followers += Math.round(me.followers * 0.02 + 200); me.image -= 3; reply(T(['See you on the pitch 🤫', 'Sahada görüşürüz 🤫'])); return T(['Rivalry heats up 🔥 Followers up', 'Rekabet kızıştı 🔥 Takipçi arttı']);
    case 'agent_move:push': rel.agent += 3; c.flags.wantsMove = c.season * 100 + c.week; rel.manager -= 3; reply(T(['On it. I\'ll make some calls.', 'Hemen. Birkaç telefon açacağım.'])); return T(['Your agent will look for a move', 'Menajerin transfer arayacak']);
    case 'agent_move:stay': rel.manager += 2; c.flags.wantsMove = 0; reply(T(['Understood. Patience can pay off.', 'Anlaşıldı. Sabır meyvesini verir.'])); return T(['Manager trust +2', 'Hoca güveni +2']);
    case 'sponsor:accept': {
      const sp = SPONSORS.find((s) => s.id === d.data?.sponsor);
      if (sp) {
        const pay = Math.round(sp.pay * (has(c, 'icon') ? 1.3 : 1));
        me.sponsors.push({ id: sp.id, until: c.season + 2, posts: 0 });
        me.money += sp.bonus;
        reply(T(['Welcome aboard! Signing bonus {b} sent. {p}/week. Remember: one post with #{t} every few weeks 😉', 'Aramıza hoş geldin! {b} imza bonusu gönderildi. Haftalık {p}. Unutma: birkaç haftada bir #{t} paylaşımı 😉'], { b: money(sp.bonus), p: money(pay), t: sp.tag }));
        eventPost(c, 'sponsor', { brand: sp.name, tag: sp.tag, color: sp.color });
        return T(['Sponsor signed: +{b}', 'Sponsor imzalandı: +{b}'], { b: money(sp.bonus) });
      }
      return '';
    }
    case 'sponsor:decline': reply(T(['Understood. The door stays open.', 'Anlaşıldı. Kapı açık.'])); return '';
    case 'family:love': me.morale += 5; return T(['Morale +5', 'Moral +5']);
    case 'family:busy': me.morale -= 1; return '';
    case 'cap:accept': me.captain = true; rel.mates += 6; rel.manager += 4; eventPost(c, 'captain'); reply(T(['Proud of you. Lead by example.', 'Seninle gurur duyuyorum. Örnek ol.'])); return T(['You are the captain! ©️', 'Artık kaptansın! ©️']);
    case 'cap:decline': rel.manager -= 2; reply(T(['I respect it. The offer stands.', 'Saygı duyuyorum. Teklif geçerli.'])); return '';
  }
  return '';
}

// ------------------------------------------------------------------ the user's own posts

export interface PostOption {
  id: string;
  label: string;
  text: string;
  /** -1 bad taste .. 1 classy */
  tone: number;
  hype: number;
  tagNemesis?: boolean;
  sponsor?: string;
}

export function postOptions(c: Career, lm: LastMatch | null): PostOption[] {
  const me = c.me;
  const club = c.contract ? c.clubs[c.contract.club] : null;
  const nick = club ? LP(club.nick) : '';
  const n = c.npcs[c.nemesis];
  const v = { opp: lm ? clubName(c, lm.opp) : '', nick, club: club?.name ?? '', g: lm?.goals ?? 0 };
  const out: PostOption[] = [];
  const won = lm ? lm.gf > lm.ga : false, lost = lm ? lm.gf < lm.ga : false;
  const good = lm ? lm.rating >= 7 : true;
  if (lm && lm.goals > 0) out.push({ id: 'goal', label: L2('Celebrate the goal', 'Golü kutla'), text: T(fresh(c, 'po1', <TP[]>[['What a feeling. {g} for the badge ⚽❤️', 'Ne duygu ama. Arma için {g} gol ⚽❤️'], ['Dreamed of nights like this as a kid 🙏⚽', 'Çocukken böyle geceleri hayal ederdim 🙏⚽']]), v), tone: 0.5, hype: 1.3 });
  out.push(won || !lm
    ? { id: 'humble', label: L2('Humble', 'Mütevazı'), text: T(fresh(c, 'po2', <TP[]>[['Team effort. Big 3 points. On to the next one 🙏', 'Takım işi. Büyük 3 puan. Sıradakine 🙏'], ['Proud of the boys today. We keep going 💪', 'Bugün çocuklarla gurur duyuyorum. Devam 💪'], ['Three points, clean shirts, happy dressing room. 🧺😄', 'Üç puan, temiz formalar, mutlu soyunma odası. 🧺😄'], ['Job done vs {opp}. Recovery, then we go again.', '{opp} karşısında iş tamam. Toparlanma, sonra yeniden.'], ['Credit to the lads. Everyone ran for each other today.', 'Çocuklara teşekkürler. Bugün herkes birbiri için koştu.'], ['Small steps. Big dreams. 🙏', 'Küçük adımlar. Büyük hayaller. 🙏']]), v), tone: 0.8, hype: 0.7 }
    : { id: 'apology', label: L2('Own it', 'Sorumluluk al'), text: T(fresh(c, 'po3', <TP[]>[['Not good enough today. That\'s on me. We go again 💪', 'Bugün yeterince iyi değildi. Bu benim hatam. Yeniden 💪'], ['Sorry to everyone who travelled. We\'ll fix this.', 'Deplasmana gelen herkesten özür dilerim. Bunu düzelteceğiz.']]), v), tone: 0.9, hype: 0.6 });
  out.push({ id: 'fans', label: L2('Thank the fans', 'Taraftara teşekkür'), text: T(fresh(c, 'po4', <TP[]>[['That atmosphere tonight 😍 Thank you {nick}!', 'Bu akşamki atmosfer 😍 Teşekkürler {nick}!'], ['You were our 6th player tonight. Respect ❤️', 'Bu akşam altıncı oyuncumuzdunuz. Saygılar ❤️'], ['Heard you from the first minute to the last. This one\'s yours. 📣', 'İlk dakikadan sonuncusuna kadar sizi duydum. Bu sizin. 📣'], ['To everyone who travelled: we see you. ❤️🚌', 'Deplasmana gelen herkese: sizi görüyoruz. ❤️🚌'], ['Goosebumps when the stand started singing. Thank you.', 'Tribün şarkıya başladığında tüylerim diken diken oldu. Teşekkürler.']]), v), tone: 0.7, hype: 0.9 });
  out.push(good
    ? { id: 'swag', label: L2('Confident', 'Özgüvenli'), text: T(fresh(c, 'po5', <TP[]>[['Told you. This is just the start. 😤🔥', 'Söylemiştim. Bu daha başlangıç. 😤🔥'], ['They\'re not ready. 🔥', 'Hazır değiller. 🔥'], ['Built different. 🧱', 'Farklı yapıdayım. 🧱'], ['Mood: unstoppable. 🚀', 'Ruh hali: durdurulamaz. 🚀'], ['Doubters, your silence is loud. 🤫', 'Şüphe edenler, sessizliğiniz çok gürültülü. 🤫'], ['Different gravity on my side of the pitch. 🌍', 'Sahanın benim tarafında yerçekimi farklı. 🌍'], ['Not my best. Still better than yours. 😉', 'En iyim değildi. Yine de sizinkinden iyi. 😉']]), v), tone: -0.2, hype: 1.6 }
    : { id: 'swag', label: L2('Shrug it off', 'Umursama'), text: T(fresh(c, 'po6', <TP[]>[['Bad days happen. Kings don\'t panic. 👑', 'Kötü günler olur. Krallar panik yapmaz. 👑'], ['Noise. 🎧', 'Gürültü. 🎧']]), v), tone: -0.5, hype: 1.2 });
  if (n) out.push({ id: 'nem', label: L2(`Jab at ${surname(n.name)}`, `${surname(n.name)}'a laf at`), text: T(fresh(c, 'po7', <TP[]>[['Some people talk. I score. 🤫', 'Bazıları konuşur. Ben gol atarım. 🤫'], ['Saw the comments. Funny. See you on the pitch 😉', 'Yorumları gördüm. Komik. Sahada görüşürüz 😉']]), v) + ` @${npcHandle(n)}`, tone: -0.8, hype: 2.2, tagNemesis: true });
  const sp = me.sponsors[0] ? SPONSORS.find((s) => s.id === me.sponsors[0].id) : null;
  if (sp) out.push({ id: 'sponsor', label: L2('Sponsor post', 'Sponsor paylaşımı'), text: T(fresh(c, 'po8', <TP[]>[['Fresh {b} for the weekend 👌 #{t} #ad', 'Hafta sonu için taze {b} 👌 #{t} #reklam'], ['Recovery mode with {b} ⚡ #{t} #ad', '{b} ile toparlanma modu ⚡ #{t} #reklam']]), { b: sp.name, t: sp.tag }), tone: 0.1, hype: 0.6, sponsor: sp.id });
  void lost;
  return out;
}

/** Publish the user's post: followers, image and how the internet reacts. Returns a summary line. */
export function publishPost(c: Career, o: PostOption, lm: LastMatch | null): string {
  tCounter = 0;
  const me = c.me;
  const club = c.contract?.club ?? null;
  const v = { name: surname(me.name), opp: lm ? clubName(c, lm.opp) : '', h: meHandle(c) };
  const good = lm ? lm.rating >= 6.8 : true;
  const lost = lm ? lm.gf < lm.ga : false;
  const backfire = (o.tone < -0.1 && (!good || lost)) || (o.tagNemesis && lm && lm.rating < 6.5);
  const pr = owns(c, 'pr') ? 0.6 : 1;
  const likes = Math.round(me.followers * rand(0.04, 0.09) * o.hype * (backfire ? 1.5 : 1) * (has(c, 'showman') ? 1.4 : 1) + 20);
  const post = mk(c, { name: me.name, handle: meHandle(c), verified: me.followers > 50000, av: 'me', text: o.text, likes, mine: true, media: lm && o.id !== 'sponsor' ? { kind: 'photo', data: { who: 'me', pose: o.id === 'apology' ? 'sad' : 'celebrate' } } : undefined, mood: 0 });
  let pool: TP[];
  let line: string;
  const fGain = Math.round(me.followers * (0.004 + 0.01 * o.hype) * (backfire ? 1.8 : 1) * (has(c, 'showman') ? 1.5 : 1) + 30);
  me.followers += fGain;
  if (backfire) {
    pool = [['delete this 💀', 'sil bunu 💀'], ['ratio', 'ratio'], ['{rating}… and you post THIS?', 'bu performansla BUNU mu paylaşıyorsun?'], ['clown behaviour 🤡', 'palyaço davranışı 🤡'], ['the arrogance', 'bu kibir'], ['PR team where are you', 'PR ekibi neredesiniz']];
    me.image -= Math.round(8 * pr);
    me.rel.fans -= Math.round(7 * pr);
    me.rel.media -= Math.round(4 * pr);
    if (o.tagNemesis) me.rel.nemesis += 12;
    post.replyCount = Math.round(post.likes * rand(0.4, 0.9));
    headline(c, { kind: 'feature', title: T(['{name} slammed for post after {opp} game', '{name}, {opp} maçı sonrası paylaşımıyla tepki çekti'], v), sub: T(['Fans call it "tone-deaf". The club is aware.', 'Taraftarlar "duyarsız" diyor. Kulüp durumdan haberdar.']) });
    line = L2(`Backlash! You got ratio'd. Image ↓, fans ↓, followers +${compact(fGain)}`, `Tepki yağdı! Ratio yedin. İmaj ↓, taraftar ↓, takipçi +${compact(fGain)}`);
  } else {
    pool = o.tone > 0.4 ? [['class act 👏', 'klas adam 👏'], ['this is why we love you', 'bu yüzden seni seviyoruz'], ['humble king 👑', 'mütevazı kral 👑'], ['❤️❤️❤️', '❤️❤️❤️']] : [['HIM 🔥', 'O BAŞKA 🔥'], ['the aura 😮‍💨', 'aura 😮‍💨'], ['main character', 'ana karakter'], ['let him cook 👨‍🍳', 'bırakın şov yapsın 👨‍🍳'], ['{opp} fans in shambles', '{opp} taraftarı perişan']];
    me.image += Math.round(o.tone * 4);
    me.rel.fans += Math.round(o.tone * 3 + (o.id === 'fans' ? 4 : 0));
    if (o.tagNemesis) {
      me.rel.nemesis += 10;
      me.rel.manager -= 2;
    }
    line = L2(`Posted! +${compact(fGain)} followers`, `Paylaşıldı! +${compact(fGain)} takipçi`);
  }
  if (o.sponsor) {
    const s = me.sponsors.find((x) => x.id === o.sponsor);
    if (s) s.posts++;
  }
  post.replies = replies(c, club, pool, 4, { ...v, rating: lm ? lm.rating.toFixed(1) : '' }, backfire ? 2 : 1.2, backfire ? 'neg' : 'pos');
  if (o.tagNemesis && c.npcs[c.nemesis] && Math.random() < 0.6) {
    const n = c.npcs[c.nemesis];
    post.replies.unshift({ name: n.name, handle: npcHandle(n), verified: true, text: T(fresh(c, 'po9', <TP[]>[['cute 😂', 'tatlı 😂'], ['scoreboard says otherwise', 'skorbord öyle demiyor'], ['🥱', '🥱']])), likes: Math.round(post.likes * 0.6) });
  }
  addPost(c, post);
  me.image = clamp(me.image, -100, 100);
  for (const k of Object.keys(me.rel) as (keyof typeof me.rel)[]) me.rel[k] = clamp(me.rel[k], 0, 100);
  return line;
}

// ------------------------------------------------------------------ press conferences

export interface PressQ {
  q: string;
  a: { text: string; fx: Partial<Record<'manager' | 'fans' | 'media' | 'nemesis' | 'image' | 'morale' | 'mates', number>>; style: 'humble' | 'bold' | 'spicy' }[];
}

export function pressQuestions(c: Career, ctx: { opp: string; derby: boolean; final: boolean; slump: boolean; streak: boolean; rumours: boolean }): PressQ[] {
  const n = c.npcs[c.nemesis];
  const v = { opp: clubName(c, ctx.opp), nem: n ? n.name : '', club: c.contract ? clubName(c, c.contract.club) : '' };
  const qs: PressQ[] = [];
  if (ctx.derby) qs.push({
    q: T(['It\'s derby week. What does this game mean to you?', 'Derbi haftası. Bu maç senin için ne ifade ediyor?'], v),
    a: [
      { text: T(['I know what it means to the fans. We\'ll give everything.', 'Taraftar için ne demek olduğunu biliyorum. Her şeyimizi vereceğiz.']), fx: { fans: 4, manager: 2 }, style: 'humble' },
      { text: T(['Derbies are made for players like me.', 'Derbiler benim gibi oyuncular için yapılır.']), fx: { fans: 5, image: -1, morale: 3 }, style: 'bold' },
      { text: T(['{opp}? They should be worried, not us.', '{opp} mi? Endişelenmesi gereken onlar, biz değil.'], v), fx: { fans: 7, media: -3, image: -4, manager: -2 }, style: 'spicy' },
    ],
  });
  if (ctx.final) qs.push({
    q: T(['A final. Nerves?', 'Bir final. Heyecan var mı?']),
    a: [
      { text: T(['Of course. Nerves mean it matters.', 'Elbette. Heyecan önemsediğimizi gösterir.']), fx: { media: 3, image: 2 }, style: 'humble' },
      { text: T(['No. I\'ve been waiting for this my whole life.', 'Hayır. Bütün hayatım boyunca bunu bekledim.']), fx: { morale: 4, fans: 3 }, style: 'bold' },
      { text: T(['The trophy is already ours. We just have to collect it.', 'Kupa zaten bizim. Sadece gidip alacağız.']), fx: { fans: 4, media: -5, image: -5, manager: -3 }, style: 'spicy' },
    ],
  });
  if (ctx.slump) qs.push({
    q: T(['Your form has dipped. Are you feeling the pressure?', 'Formun düştü. Baskıyı hissediyor musun?']),
    a: [
      { text: T(['I need to be better. I\'m working on it every day.', 'Daha iyi olmalıyım. Her gün bunun için çalışıyorum.']), fx: { manager: 4, fans: 3, media: 2 }, style: 'humble' },
      { text: T(['Form is temporary. Class is permanent.', 'Form geçicidir, kalite kalıcı.']), fx: { morale: 4, image: -1 }, style: 'bold' },
      { text: T(['Maybe ask why I keep getting played out of position.', 'Belki neden sürekli mevkim dışında oynatıldığımı sormalısınız.']), fx: { manager: -8, media: 4, morale: 2 }, style: 'spicy' },
    ],
  });
  if (ctx.streak) qs.push({
    q: T(['You\'re flying. Is this the best you\'ve ever played?', 'Uçuyorsun. Hayatının en iyi dönemi mi?']),
    a: [
      { text: T(['The team makes it easy for me.', 'Takım işimi kolaylaştırıyor.']), fx: { mates: 5, manager: 2 }, style: 'humble' },
      { text: T(['I\'m only getting started.', 'Daha yeni başlıyorum.']), fx: { fans: 3, morale: 3 }, style: 'bold' },
      { text: T(['Best in the league. Write that down.', 'Ligin en iyisiyim. Bunu not edin.']), fx: { fans: 4, image: -5, nemesis: 8, media: -2 }, style: 'spicy' },
    ],
  });
  if (ctx.rumours) qs.push({
    q: T(['There are reports of interest from bigger clubs. Will you stay at {club}?', 'Daha büyük kulüplerin ilgilendiği konuşuluyor. {club}\'da kalacak mısın?'], v),
    a: [
      { text: T(['I\'m happy here. My focus is the next game.', 'Burada mutluyum. Odağım bir sonraki maç.']), fx: { fans: 5, manager: 3 }, style: 'humble' },
      { text: T(['My agent handles that. I just play.', 'Onu menajerim halleder. Ben sadece oynarım.']), fx: { media: 1 }, style: 'bold' },
      { text: T(['Every player dreams of the biggest stage.', 'Her oyuncu en büyük sahneyi hayal eder.']), fx: { fans: -7, manager: -4, media: 4 }, style: 'spicy' },
    ],
  });
  if (n) qs.push({
    q: T(['{nem} said this week you\'re "all hype". Your response?', '{nem} bu hafta senin için "sadece hype" dedi. Cevabın?'], v),
    a: [
      { text: T(['I respect him. Let\'s talk about football.', 'Ona saygım var. Futbol konuşalım.']), fx: { image: 4, media: 3, nemesis: -4 }, style: 'humble' },
      { text: T(['I\'ll answer on the pitch.', 'Cevabımı sahada vereceğim.']), fx: { fans: 3, nemesis: 3 }, style: 'bold' },
      { text: T(['Who? Oh, the guy with zero trophies.', 'Kim? Ha, sıfır kupalı olan mı.']), fx: { fans: 4, image: -6, nemesis: 14, media: 2 }, style: 'spicy' },
    ],
  });
  qs.push({
    q: T(['What do you expect from {opp}?', '{opp}\'dan ne bekliyorsun?'], v),
    a: [
      { text: T(['A tough game. We respect every opponent.', 'Zor bir maç. Her rakibe saygı duyarız.']), fx: { media: 2, manager: 2 }, style: 'humble' },
      { text: T(['If we play our game, we win.', 'Kendi oyunumuzu oynarsak kazanırız.']), fx: { morale: 2, fans: 2 }, style: 'bold' },
      { text: T(['Three points. Easy.', 'Üç puan. Kolay.']), fx: { fans: 3, image: -3, media: -2 }, style: 'spicy' },
    ],
  });
  return qs.slice(0, 3);
}

export function applyPress(c: Career, answers: PressQ['a'][number][], opp: string) {
  const me = c.me;
  const ic = has(c, 'icon') || owns(c, 'pr') ? 0.6 : 1;
  for (const a of answers) {
    for (const [k, v0] of Object.entries(a.fx)) {
      const v = (v0 ?? 0) < 0 && k !== 'nemesis' ? (v0 ?? 0) * ic : v0 ?? 0;
      if (k === 'image') me.image = clamp(me.image + v, -100, 100);
      else if (k === 'morale') me.morale = clamp(me.morale + v, 0, 100);
      else me.rel[k as keyof typeof me.rel] = clamp(me.rel[k as keyof typeof me.rel] + v, 0, 100);
    }
  }
  const spicy = answers.find((a) => a.style === 'spicy');
  const v = { name: surname(me.name), opp: clubName(c, opp) };
  if (spicy) {
    headline(c, { kind: 'feature', big: true, title: T(['"{q}" - {name} fires warning', '"{q}" - {name}\'dan sert mesaj'], { ...v, q: spicy.text.length > 48 ? spicy.text.slice(0, 46) + '…' : spicy.text }), sub: T(['Bold words before {opp}. Now he has to back them up.', '{opp} öncesi iddialı sözler. Şimdi sahada kanıtlaması lazım.'], v) });
    const o = pick(OUTLETS);
    const p = mk(c, { name: o.name, handle: o.handle, verified: true, av: 'c:' + o.color, text: `🎙️ ${me.name}: "${spicy.text}"`, likes: Math.round(reach(c, 2) + 1500), mood: 0 });
    p.replies = replies(c, c.contract?.club ?? null, [['he said WHAT 😳', 'NE dedi 😳'], ['main character energy', 'ana karakter enerjisi'], ['this will age well or very badly', 'bu ya çok iyi ya çok kötü yaşlanacak'], ['love the confidence', 'bu özgüveni seviyorum']], 3, v, 1.5);
    addPost(c, p);
    c.flags.bold = c.week + c.season * 100;
  } else {
    const o = pick(OUTLETS);
    addPost(c, mk(c, { name: o.name, handle: o.handle, verified: true, av: 'c:' + o.color, text: `🎙️ ${me.name}: "${answers[0].text}"`, likes: Math.round(reach(c, 0.6) + 300), mood: 0.2 }));
  }
}

// ------------------------------------------------------------------ helpers for UI

export function timeAgo(c: Career, p: { week: number; season: number; t?: number }) {
  const w = (c.season - p.season) * 40 + (c.week - p.week);
  if (w <= 0) {
    const m = Math.max(1, (p.t ?? 1) * 7 % 59);
    return (p.t ?? 0) < 8 ? (isTR() ? `${m}dk` : `${m}m`) : isTR() ? `${Math.max(1, Math.round((p.t ?? 0) / 4))}sa` : `${Math.max(1, Math.round((p.t ?? 0) / 4))}h`;
  }
  if (w < 4) return isTR() ? `${w * 7}g` : `${w * 7}d`;
  return isTR() ? `${Math.round(w / 4)}ay` : `${Math.round(w / 4)}mo`;
}

/** Overall vibe of the feed about the user (-1..1). */
export function vibe(c: Career) {
  const recent = c.feed.filter((p) => p.season === c.season && c.week - p.week <= 2 && p.mood !== undefined);
  if (!recent.length) return 0;
  return clamp(recent.reduce((a, p) => a + (p.mood ?? 0), 0) / recent.length, -1, 1);
}

export { compById, roundName, myOvr };
