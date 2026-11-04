/** The user's footballer: attributes, growth, perks, lifestyle, value, selection. */
import type { Career, Me, MyPos, Personality, Backstory, Role, Objective, NPos } from './types';
import type { Stats, StatKey, CardData } from '../meta/cards';
import { STAT_KEYS, overall } from '../meta/cards';
import { clamp, gauss, rand } from '../engine/math';
import { L2 } from './util';
import { squadOf, myOvr, isNat, teamStrength } from './world';

// ------------------------------------------------------------------ perks

export interface Perk {
  id: string;
  br: 'fin' | 'eng' | 'star';
  tier: number;
  name: [string, string];
  desc: [string, string];
  stat?: Partial<Stats>;
}

export const PERKS: Perk[] = [
  { id: 'rocket', br: 'fin', tier: 1, name: ['Rocket Boot', 'Roket Ayak'], desc: ['+2 SHO. Your shots leave the boot harder on the pitch.', '+2 ŞUT. Sahada şutların daha sert çıkar.'], stat: { sho: 2 } },
  { id: 'clinical', br: 'fin', tier: 2, name: ['Clinical', 'Soğukkanlı'], desc: ['+2 SHO. +20% goal chance in simulated matches.', '+2 ŞUT. Simüle maçlarda gol şansı %20 artar.'], stat: { sho: 2 } },
  { id: 'poacher', br: 'fin', tier: 3, name: ['Fox in the Box', 'Ceza Sahası Tilkisi'], desc: ['Every goal is worth +0.25 extra match rating.', 'Her golün maç notuna +0.25 ekstra katkı yapar.'] },
  { id: 'biggame', br: 'fin', tier: 4, name: ['Big-Game Player', 'Büyük Maç Oyuncusu'], desc: ['+0.4 rating in derbies, finals, continental and international games.', 'Derbi, final, kıta ve milli maçlarda nota +0.4.'] },
  { id: 'jet', br: 'eng', tier: 1, name: ['Jet Heels', 'Jet Topuklar'], desc: ['+2 PAC. A burst of extra speed on the pitch.', '+2 HIZ. Sahada ek hız patlaması.'], stat: { pac: 2 } },
  { id: 'engine', br: 'eng', tier: 2, name: ['Engine', 'Motor'], desc: ['Sprint drains 30% less. Matches cost 25% less fitness.', 'Depar %30 daha az yorar. Maçlar %25 daha az kondisyon harcar.'] },
  { id: 'iron', br: 'eng', tier: 3, name: ['Iron Man', 'Demir Adam'], desc: ['Back on your feet 30% faster. Injury risk -35%.', 'Yerden %30 hızlı kalkarsın. Sakatlık riski %35 azalır.'] },
  { id: 'bulldozer', br: 'eng', tier: 4, name: ['Bulldozer', 'Buldozer'], desc: ['+2 DEF, +2 PHY. Your shoves and slides hit harder.', '+2 DEF, +2 FİZ. İtme ve kaymaların daha sert.'], stat: { def: 2, phy: 2 } },
  { id: 'silk', br: 'star', tier: 1, name: ['Silk Touch', 'İpek Dokunuş'], desc: ['+2 DRI, +2 PAS. Smoother on the ball.', '+2 ÇAL, +2 PAS. Topla daha akıcısın.'], stat: { dri: 2, pas: 2 } },
  { id: 'showman', br: 'star', tier: 2, name: ['Showman', 'Şovmen'], desc: ['Followers grow 50% faster. Goals go viral more often.', 'Takipçilerin %50 hızlı artar. Gollerin daha sık viral olur.'] },
  { id: 'leader', br: 'star', tier: 3, name: ['Leader', 'Lider'], desc: ['Team-mates trust you sooner: more passes, captaincy talks.', 'Takım arkadaşların sana daha çabuk güvenir: daha çok pas, kaptanlık.'] },
  { id: 'icon', br: 'star', tier: 4, name: ['Icon', 'İkon'], desc: ['Sponsor deals pay 30% more. The press goes easier on you.', 'Sponsorlar %30 fazla öder. Basın sana daha yumuşak davranır.'] },
];

export const perkBy = (id: string) => PERKS.find((p) => p.id === id);
export const has = (c: Career, id: string) => c.me.perks.includes(id);

export function canTakePerk(c: Career, p: Perk) {
  if (c.me.perks.includes(p.id) || c.me.perkPts <= 0) return false;
  return PERKS.filter((q) => q.br === p.br && q.tier < p.tier).every((q) => c.me.perks.includes(q.id));
}

export function takePerk(c: Career, id: string) {
  const p = perkBy(id);
  if (!p || !canTakePerk(c, p)) return false;
  c.me.perks.push(id);
  c.me.perkPts--;
  if (p.stat) for (const [k, v] of Object.entries(p.stat)) c.me.stats[k as StatKey] = clamp(c.me.stats[k as StatKey] + (v ?? 0), 1, 99);
  return true;
}

// ------------------------------------------------------------------ lifestyle

export interface LifeItem {
  id: string;
  group: 'home' | 'car' | 'staff';
  name: [string, string];
  desc: [string, string];
  price: number;
  /** weekly upkeep */
  weekly: number;
  icon: string;
  req?: string;
}

export const LIFE: LifeItem[] = [
  { id: 'flat', group: 'home', name: ['City Apartment', 'Şehir Dairesi'], desc: ['Your own place. +5 morale every month.', 'Kendi evin. Her ay +5 moral.'], price: 25000, weekly: 300, icon: '🏢' },
  { id: 'villa', group: 'home', name: ['Seaside Villa', 'Sahil Villası'], desc: ['Peace and a pool. Faster recovery, +morale.', 'Huzur ve havuz. Daha hızlı toparlanma, +moral.'], price: 900000, weekly: 4000, icon: '🏖️', req: 'flat' },
  { id: 'mansion', group: 'home', name: ['Hilltop Mansion', 'Tepe Malikânesi'], desc: ['A footballer\'s dream. Big morale, followers love the tours.', 'Futbolcu rüyası. Büyük moral; ev turları takipçi getirir.'], price: 6000000, weekly: 20000, icon: '🏰', req: 'villa' },
  { id: 'hatch', group: 'car', name: ['City Hatchback', 'Şehir Arabası'], desc: ['Gets you to training on time.', 'Antrenmana zamanında yetiştirir.'], price: 18000, weekly: 80, icon: '🚗' },
  { id: 'sport', group: 'car', name: ['Sports Coupé', 'Spor Coupé'], desc: ['Turns heads. +followers, a little image risk.', 'Herkes dönüp bakar. +takipçi, biraz imaj riski.'], price: 220000, weekly: 900, icon: '🏎️', req: 'hatch' },
  { id: 'hyper', group: 'car', name: ['Hypercar', 'Hiper Otomobil'], desc: ['Pure flex. Big follower boost.', 'Tam bir gösteriş. Büyük takipçi artışı.'], price: 2800000, weekly: 6000, icon: '🚀', req: 'sport' },
  { id: 'chef', group: 'staff', name: ['Personal Chef', 'Özel Aşçı'], desc: ['+5 fitness recovery every week.', 'Her hafta +5 kondisyon toparlanması.'], price: 0, weekly: 1500, icon: '🥗' },
  { id: 'trainer', group: 'staff', name: ['Personal Trainer', 'Kişisel Antrenör'], desc: ['Training gains +20%.', 'Antrenman kazanımları +%20.'], price: 0, weekly: 3500, icon: '🏋️' },
  { id: 'physio', group: 'staff', name: ['Private Physio', 'Özel Fizyoterapist'], desc: ['Injuries heal 30% faster.', 'Sakatlıklar %30 daha hızlı iyileşir.'], price: 0, weekly: 2500, icon: '🩺' },
  { id: 'pr', group: 'staff', name: ['PR Manager', 'Halkla İlişkiler'], desc: ['Softens crises: +image every week, better press.', 'Krizleri yumuşatır: her hafta +imaj, daha iyi basın.'], price: 0, weekly: 3000, icon: '📣' },
  { id: 'analyst', group: 'staff', name: ['Video Analyst', 'Video Analist'], desc: ['+0.2 rating in simulated matches. Drills easier.', 'Simüle maçlarda nota +0.2. Driller daha kolay.'], price: 0, weekly: 2000, icon: '📊' },
];

export const lifeBy = (id: string) => LIFE.find((l) => l.id === id);
export const owns = (c: Career, id: string) => c.me.owned.includes(id);

export function weeklyUpkeep(c: Career) {
  return c.me.owned.reduce((a, id) => a + (lifeBy(id)?.weekly ?? 0), 0);
}

export function buyLife(c: Career, id: string): string | null {
  const it = lifeBy(id);
  if (!it || owns(c, id)) return null;
  if (it.req && !owns(c, it.req)) return L2('Unlock the previous one first.', 'Önce bir öncekini al.');
  if (c.me.money < it.price + it.weekly) return L2('Not enough money.', 'Yeterli paran yok.');
  c.me.money -= it.price;
  c.me.owned.push(id);
  return '';
}

export function dropLife(c: Career, id: string) {
  const it = lifeBy(id);
  if (!it || it.group !== 'staff') return;
  c.me.owned = c.me.owned.filter((x) => x !== id);
}

// ------------------------------------------------------------------ creation

const BASE: Record<MyPos, Stats> = {
  DEF: { pac: 58, sho: 40, pas: 52, dri: 48, def: 62, phy: 62 },
  MID: { pac: 58, sho: 52, pas: 62, dri: 60, def: 46, phy: 52 },
  FWD: { pac: 64, sho: 62, pas: 50, dri: 58, def: 30, phy: 54 },
};

export const BACKSTORIES: { id: Backstory; name: [string, string]; desc: [string, string]; stat: Partial<Stats>; pot: number }[] = [
  { id: 'street', name: ['Street Baller', 'Sokak Futbolcusu'], desc: ['Raised on concrete pitches. Tricks for days, raw everywhere else.', 'Beton sahalarda büyüdün. Çalım bol, gerisi ham.'], stat: { dri: 5, pac: 2, pas: -2 }, pot: 0 },
  { id: 'academy', name: ['Academy Graduate', 'Akademi Mezunu'], desc: ['Coached since you were eight. Tidy, smart, disciplined.', 'Sekiz yaşından beri eğitimli. Temiz, akıllı, disiplinli.'], stat: { pas: 4, def: 2, dri: -1 }, pot: 0 },
  { id: 'smalltown', name: ['Small-Town Hero', 'Kasabanın Kahramanı'], desc: ['The whole town knows your name. Strong and loved: fans warm to you fast.', 'Bütün kasaba seni tanır. Güçlüsün ve sevilirsin: taraftar sana çabuk ısınır.'], stat: { phy: 5, sho: 2 }, pot: -1 },
  { id: 'latebloomer', name: ['Late Bloomer', 'Geç Açan Çiçek'], desc: ['Overlooked for years. Weaker today, the highest ceiling of all.', 'Yıllarca gözden kaçtın. Bugün zayıfsın ama tavanın en yüksek.'], stat: { pac: -2, sho: -2, pas: -2, dri: -2, def: -2, phy: -2 }, pot: 5 },
];

export const PERSONALITIES: { id: Personality; name: [string, string]; desc: [string, string]; icon: string }[] = [
  { id: 'humble', name: ['Humble', 'Mütevazı'], desc: ['Team first. Managers and team-mates love you.', 'Önce takım. Hocalar ve arkadaşlar seni sever.'], icon: '🙏' },
  { id: 'confident', name: ['Confident', 'Özgüvenli'], desc: ['You back yourself. Fans enjoy it, rivals do not.', 'Kendine güvenirsin. Taraftar sever, rakipler sevmez.'], icon: '😎' },
  { id: 'showman', name: ['Showman', 'Şovmen'], desc: ['Born for the cameras. Followers come fast; so does drama.', 'Kameralar için doğmuşsun. Takipçi hızlı gelir, drama da.'], icon: '🤩' },
  { id: 'leader', name: ['Leader', 'Lider'], desc: ['You talk, others listen. Captain material.', 'Sen konuşunca dinlerler. Kaptanlık malzemesi.'], icon: '©️' },
];

export function createMe(o: { name: string; nat: string; pos: MyPos; foot: 'R' | 'L'; num: number; personality: Personality; backstory: Backstory; look: Me['look'] }): Me {
  const bs = BACKSTORIES.find((b) => b.id === o.backstory)!;
  const stats = { ...BASE[o.pos] };
  for (const k of STAT_KEYS) stats[k] = Math.round(clamp(stats[k] + (bs.stat[k] ?? 0) + rand(-2, 2), 25, 80));
  const pot = Math.round(clamp(82 + gauss() * 4.5 + bs.pot, 76, 95));
  const spread = 5;
  const lo = Math.max(overall({ pos: o.pos, stats }) + 8, pot - spread - Math.floor(Math.random() * 3));
  return {
    ...o, age: 17, stats, prog: { pac: 0, sho: 0, pas: 0, dri: 0, def: 0, phy: 0 }, pot, potSeen: [lo, Math.min(99, lo + 8)],
    xp: 0, level: 1, perkPts: 1, perks: [], form: [], fitness: 100, morale: 70, sharpness: 50,
    rep: o.backstory === 'smalltown' ? 6 : 3, followers: o.personality === 'showman' ? 2400 : 900, image: o.personality === 'humble' ? 20 : o.personality === 'showman' ? -5 : 5,
    money: 5000, injury: null,
    rel: { manager: 50, mates: o.personality === 'leader' ? 58 : 50, fans: o.backstory === 'smalltown' ? 60 : 50, agent: 60, media: 50, nemesis: 20 },
    owned: [], sponsors: [], captain: false, capped: false, intlApps: 0, intlGoals: 0, retired: false,
  };
}

/** The user's card, for the pitch and the UI. */
export function myCard(c: Career): CardData {
  return { id: 'me', name: c.me.name, number: c.me.num, pos: c.me.pos, stats: { ...c.me.stats }, look: c.me.look, custom: true };
}

// ------------------------------------------------------------------ growth

function growthRate(age: number) {
  if (age <= 19) return 1;
  if (age <= 22) return 0.8;
  if (age <= 25) return 0.55;
  if (age <= 28) return 0.33;
  if (age <= 30) return 0.18;
  return 0.08;
}

/** Add progress to a stat; whole points are applied (capped by potential). */
export function grow(c: Career, k: StatKey, amt: number): number {
  const me = c.me;
  const ovr = myOvr(c);
  const room = clamp((me.pot - ovr) / 8, 0, 1);
  const real = amt > 0 ? amt * (0.08 + room * 0.92) : amt;
  me.prog[k] += real;
  let gained = 0;
  while (me.prog[k] >= 1 && me.stats[k] < 99) {
    me.prog[k] -= 1;
    if (myOvr(c) >= me.pot && amt > 0) {
      me.prog[k] = Math.min(me.prog[k], 0.95);
      break;
    }
    me.stats[k]++;
    gained++;
  }
  while (me.prog[k] <= -1 && me.stats[k] > 20) {
    me.prog[k] += 1;
    me.stats[k]--;
    gained--;
  }
  return gained;
}

export const FOCUS: { id: string; name: [string, string]; stats: StatKey[]; icon: string }[] = [
  { id: 'finishing', name: ['Finishing', 'Bitiricilik'], stats: ['sho', 'dri'], icon: '🎯' },
  { id: 'speed', name: ['Speed & Agility', 'Hız & Çeviklik'], stats: ['pac', 'dri'], icon: '⚡' },
  { id: 'playmaking', name: ['Playmaking', 'Oyun Kurma'], stats: ['pas', 'dri'], icon: '🧠' },
  { id: 'defending', name: ['Defending', 'Savunma'], stats: ['def', 'phy'], icon: '🛡️' },
  { id: 'gym', name: ['Gym & Power', 'Kuvvet'], stats: ['phy', 'sho'], icon: '🏋️' },
];

export const INTENSITY = [
  { id: 'light', name: ['Light', 'Hafif'] as [string, string], gain: 0.6, cost: 3, inj: 0 },
  { id: 'normal', name: ['Normal', 'Normal'] as [string, string], gain: 1, cost: 8, inj: 0.004 },
  { id: 'intense', name: ['Intense', 'Yoğun'] as [string, string], gain: 1.45, cost: 15, inj: 0.018 },
];

export function coachQuality(c: Career) {
  const k = c.contract ? c.clubs[c.contract.club] : null;
  return k ? 0.8 + k.rep / 250 : 0.85;
}

/** One training session. grade: drill result multiplier (1 = quick session). */
export function train(c: Career, focusId: string, intensityId: string, grade = 1): { delta: Partial<Record<StatKey, number>>; xp: number; injured: boolean } {
  const f = FOCUS.find((x) => x.id === focusId) ?? FOCUS[0];
  const it = INTENSITY.find((x) => x.id === intensityId) ?? INTENSITY[1];
  const me = c.me;
  const base = 0.4 * growthRate(me.age) * it.gain * coachQuality(c) * (owns(c, 'trainer') ? 1.2 : 1) * grade * (me.fitness < 40 ? 0.6 : 1);
  const delta: Partial<Record<StatKey, number>> = {};
  f.stats.forEach((k, i) => {
    const g = grow(c, k, base * (i === 0 ? 1 : 0.55));
    if (g) delta[k] = g;
  });
  me.fitness = clamp(me.fitness - it.cost * (has(c, 'engine') ? 0.8 : 1), 0, 100);
  me.sharpness = clamp(me.sharpness + 4 * it.gain, 0, 100);
  const xp = Math.round(12 * it.gain * grade);
  addXP(c, xp);
  const injured = Math.random() < it.inj * (has(c, 'iron') ? 0.65 : 1) * (me.fitness < 35 ? 2.5 : 1);
  return { delta, xp, injured };
}

export function xpNeed(level: number) {
  return Math.round(160 * Math.pow(level, 1.25));
}

export function addXP(c: Career, xp: number): number {
  const me = c.me;
  me.xp += xp;
  let ups = 0;
  while (me.xp >= xpNeed(me.level)) {
    me.xp -= xpNeed(me.level);
    me.level++;
    me.perkPts++;
    ups++;
  }
  return ups;
}

/** Ageing: called every week. */
export function age(c: Career) {
  const a = c.me.age;
  if (a < 30) return;
  const k = (a - 29) * 0.035;
  grow(c, 'pac', -k * 1.3);
  grow(c, 'phy', -k);
  if (a >= 32) {
    grow(c, 'sho', -k * 0.4);
    grow(c, 'def', -k * 0.4);
  }
}

// ------------------------------------------------------------------ value & role

export function marketValue(c: Career): number {
  const me = c.me;
  const ovr = myOvr(c);
  const base = Math.pow(Math.max(0, ovr - 45), 3) * 95;
  const ageK = me.age <= 21 ? 1.6 : me.age <= 24 ? 1.35 : me.age <= 27 ? 1.1 : me.age <= 29 ? 0.85 : me.age <= 31 ? 0.55 : 0.3;
  const potK = 1 + Math.max(0, me.potSeen[1] - ovr) / 40;
  const repK = 0.8 + me.rep / 120;
  const formK = me.form.length ? clamp(0.85 + (avg(me.form) - 6.5) * 0.18, 0.7, 1.35) : 1;
  const yrs = c.contract ? Math.max(0, c.contract.until - c.season) : 0;
  const ctK = yrs <= 0 ? 0.55 : yrs === 1 ? 0.8 : 1;
  const injK = me.injury && me.injury.weeks > 6 ? 0.8 : 1;
  return Math.round((base * ageK * potK * repK * formK * ctK * injK) / 1000) * 1000;
}

export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function formAvg(c: Career) {
  return c.me.form.length ? avg(c.me.form) : 6.5;
}

export function roleName(r: Role) {
  return ({ prospect: L2('Prospect', 'Gelecek Vadeden'), rotation: L2('Rotation', 'Rotasyon'), starter: L2('Starter', 'İlk 11'), star: L2('Key Player', 'Kilit Oyuncu') } as Record<Role, string>)[r];
}

/** What role a club would offer given your level vs its squad. */
export function roleFor(c: Career, clubId: string): Role {
  const sq = squadOf(c, clubId).filter((p) => p.id !== 'me' && p.pos === c.me.pos).sort((a, b) => b.ovr - a.ovr);
  const mine = myOvr(c);
  const slots = c.me.pos === 'DEF' ? 2 : 1;
  const better = sq.filter((p) => p.ovr > mine + 1).length;
  if (better === 0 && mine >= (sq[0]?.ovr ?? 0) + 4) return 'star';
  if (better < slots) return 'starter';
  if (better <= slots) return 'rotation';
  return 'prospect';
}

/**
 * Manager's pick for this week: start, come on as a sub, unused bench, or out of the squad.
 */
export function selectMe(c: Career, team: string): 'start' | 'sub' | 'bench' | 'out' {
  const me = c.me;
  if (me.injury) return 'out';
  if (isNat(team)) {
    if (!me.capped) return 'out';
    const sq = squadOf(c, team).filter((p) => p.pos === me.pos && p.id !== 'me').sort((a, b) => b.ovr - a.ovr);
    const mine = myOvr(c) + (formAvg(c) - 6.6) * 2;
    const slots = me.pos === 'DEF' ? 2 : 1;
    const better = sq.filter((p) => p.ovr > mine).length;
    return better < slots ? 'start' : better <= slots + 1 ? 'sub' : 'bench';
  }
  if (!c.contract) return 'out';
  const role = c.contract.role;
  const sq = squadOf(c, team).filter((p) => p.pos === me.pos && p.id !== 'me').sort((a, b) => b.ovr - a.ovr);
  const trust = (me.rel.manager - 50) / 10;
  const score = myOvr(c) + (formAvg(c) - 6.6) * 2.2 + trust + (me.sharpness - 50) / 25 + ({ prospect: -3, rotation: 0, starter: 2, star: 5 } as Record<Role, number>)[role];
  const slots = me.pos === 'DEF' ? 2 : 1;
  const better = sq.filter((p) => p.ovr + rand(-1.5, 1.5) > score).length;
  if (me.fitness < 38 && role !== 'star') return Math.random() < 0.5 ? 'bench' : 'sub';
  if (role === 'star' && me.fitness >= 30) return 'start';
  if (better < slots) return 'start';
  if (better === slots) return Math.random() < 0.72 ? 'sub' : 'bench';
  if (better === slots + 1) return Math.random() < 0.45 ? 'sub' : Math.random() < 0.6 ? 'bench' : 'out';
  return Math.random() < 0.2 ? 'sub' : Math.random() < 0.5 ? 'bench' : 'out';
}

// ------------------------------------------------------------------ match objectives & ratings

export function makeObjectives(c: Career, team: string, opp: string): Objective[] {
  const pos: NPos = c.me.pos;
  const pool: Objective['key'][] = pos === 'FWD' ? ['goal', 'goal', 'shots3', 'rating7', 'goals2', 'assist'] : pos === 'MID' ? ['assist', 'passes5', 'rating7', 'goal', 'tackles3'] : ['tackles3', 'rating7', 'cleanish', 'passes5', 'win'];
  const diff = teamStrength(c, team) - teamStrength(c, opp);
  const out: Objective[] = [];
  const keys = new Set<string>();
  while (out.length < 2) {
    let k = pool[Math.floor(Math.random() * pool.length)];
    if (k === 'goals2' && diff < 4) k = 'goal';
    if (k === 'rating7' && myOvr(c) > 82 && Math.random() < 0.5) k = 'rating8';
    if (keys.has(k)) continue;
    keys.add(k);
    out.push({ key: k });
  }
  if (diff > 5 && !keys.has('win')) out.push({ key: 'win' });
  return out;
}

export function objectiveText(o: Objective) {
  const m: Record<Objective['key'], [string, string]> = {
    goal: ['Score a goal', 'Gol at'], goals2: ['Score twice', 'İki gol at'], assist: ['Get an assist', 'Asist yap'],
    rating7: ['Match rating 7.0+', 'Maç notu 7.0+'], rating8: ['Match rating 8.0+', 'Maç notu 8.0+'], win: ['Win the match', 'Maçı kazan'],
    tackles3: ['Win the ball 3 times', '3 kez top kap'], cleanish: ['Concede 1 or fewer', 'En fazla 1 gol yeme'],
    passes5: ['Complete 5 passes', '5 isabetli pas'], shots3: ['3 shots on target', '3 isabetli şut'],
  };
  return L2(...m[o.key]);
}

export interface Line {
  goals: number; assists: number; shots: number; onTarget: number; passOk: number; steals: number; knockdowns: number; lost: number; downs: number;
  gf: number; ga: number; sub: boolean; big: boolean;
}

export function rateLine(c: Career, l: Line): { rating: number; breakdown: [string, number][] } {
  const pos = c.me.pos;
  const bd: [string, number][] = [];
  const add = (label: string, v: number) => { if (Math.abs(v) >= 0.05) bd.push([label, v]); };
  const goalW = 1.05 + (has(c, 'poacher') ? 0.25 : 0) + (pos === 'DEF' ? 0.2 : 0);
  add(L2('Goals', 'Goller'), l.goals * goalW);
  add(L2('Assists', 'Asistler'), l.assists * 0.7);
  add(L2('Shots on target', 'İsabetli şut'), l.onTarget * 0.14 + (l.shots - l.onTarget) * 0.02);
  add(L2('Passing', 'Pas'), Math.min(1.1, l.passOk * (pos === 'MID' ? 0.08 : 0.055)));
  add(L2('Ball winning', 'Top kazanma'), Math.min(1.4, l.steals * (pos === 'DEF' ? 0.22 : 0.15)));
  add(L2('Knockdowns', 'Yere sermeler'), Math.min(0.5, l.knockdowns * 0.07));
  add(L2('Lost the ball', 'Top kaybı'), -Math.min(1.2, l.lost * 0.11));
  const gd = l.gf - l.ga;
  add(L2('Result', 'Sonuç'), clamp(gd * 0.14, -0.45, 0.45));
  if (pos === 'DEF') add(L2('Goals conceded', 'Yenen goller'), -Math.max(0, l.ga - 1) * 0.16);
  if (l.ga === 0 && pos !== 'FWD') add(L2('Clean sheet', 'Gol yemeden'), pos === 'DEF' ? 0.6 : 0.25);
  else if (l.ga === 1 && pos === 'DEF') add(L2('Solid at the back', 'Arkada sağlam'), 0.15);
  if (l.big && has(c, 'biggame')) add(L2('Big-game player', 'Büyük maç oyuncusu'), 0.4);
  let r = 6 + bd.reduce((a, [, v]) => a + v, 0);
  if (l.sub) r = 6 + (r - 6) * 0.85;
  r = Math.round(clamp(r, 3, 10) * 10) / 10;
  return { rating: r, breakdown: bd };
}

export function checkObjectives(objs: Objective[], l: Line, rating: number) {
  for (const o of objs) {
    o.done = ({
      goal: l.goals >= 1, goals2: l.goals >= 2, assist: l.assists >= 1, rating7: rating >= 7, rating8: rating >= 8, win: l.gf > l.ga,
      tackles3: l.steals >= 3, cleanish: l.ga <= 1, passes5: l.passOk >= 5, shots3: l.onTarget >= 3,
    } as Record<Objective['key'], boolean>)[o.key];
  }
}
