/** Career flow: new career, trial, weeks, matches, story beats, season end, awards, retirement. */
import type { Career, Fixture, LastMatch, Moment, Offer, SeasonRecord, NPC } from './types';
import { CAREER_V, nextId } from './state';
import {
  generateWorld, buildSeason, buildTourney, SEASON_PLAN, LAST_WEEK, TOURNEY_WEEKS, squadOf, teamStrength, myOvr, simScore, creditNPCs,
  recordFixture, progressKnockouts, fixtureFor, clubName, isNat, natCode, compById, sortTable, lambdaFor, makeNPC, natPool, compName, roundName,
} from './world';
import { createMe, selectMe, makeObjectives, rateLine, checkObjectives, addXP, grow, marketValue, age as ageMe, has, owns, weeklyUpkeep, formAvg, roleFor, avg, Line } from './me';
import { matchMedia, worldMedia, eventPost, dm, agentName, managerName, headline, nemesisMedia, surname, addPost } from './media';
import { windowOffers, renewalCheck, expireOffers, npcWindow, endLoan, wageFor } from './transfer';
import { clamp, gauss, pick, rand } from '../engine/math';
import { L2, LP, poisson, weighted, money, compact } from './util';
import { NATIONS, LEAGUE_NATIONS, nationBy, AGENTS, SPONSORS } from './data';
import type { Difficulty } from '../game/entities';
import type { StatKey } from '../meta/cards';

// ------------------------------------------------------------------ new career

export interface NewCareerOpts {
  me: Parameters<typeof createMe>[0];
  difficulty: Difficulty;
  duration: number;
}

export function newCareer(o: NewCareerOpts): Career {
  const me = createMe(o.me);
  const c: Career = {
    v: CAREER_V, id: Math.random().toString(36).slice(2), season: 1, week: 0, plan: SEASON_PLAN, difficulty: o.difficulty, duration: o.duration,
    phase: 'trial', me, contract: null, clubs: {}, npcs: {}, comps: [], fixtures: [], nemesis: '', agent: Math.floor(Math.random() * AGENTS.length),
    feed: [], news: [], dms: [], offers: [], log: [], history: [], trophies: [], awards: [], moments: [], seen: [], queue: [],
    ws: { trained: false, played: false, press: null, sel: null, objectives: [] },
    s: { apps: 0, starts: 0, goals: 0, assists: 0, rsum: 0, motm: 0 }, valueHist: [], followHist: [], trends: [], natSquad: [], seq: 0, flags: {}, rewards: [], last: null,
    stats: { goals: 0, assists: 0, apps: 0, motm: 0, hattricks: 0, rsum: 0 },
  };
  generateWorld(c);
  buildSeason(c);
  // the nemesis: same age and position, already at a big academy
  const natL = LEAGUE_NATIONS.includes(me.nat) ? me.nat : pick(LEAGUE_NATIONS);
  const big = Object.values(c.clubs).filter((k) => k.nat === natL && k.div === 1).sort((a, b) => b.rep - a.rep).slice(0, 4);
  const nk = pick(big);
  const n = makeNPC(pick(NATIONS).code, me.pos, myOvr(c) + 3, 17, nk.id);
  n.pot = Math.max(me.pot - 1, 86);
  c.npcs[n.id] = n;
  nk.squad.push(n.id);
  c.nemesis = n.id;
  // welcome
  dm(c, 'agent', agentName(c), L2(
    `Hi ${surname(me.name)}! I'm ${agentName(c)}, your agent from today. Scouts from three clubs will be at your trial match. Play your game, the rest is my job. 🤝`,
    `Selam ${surname(me.name)}! Ben ${agentName(c)}, bugünden itibaren menajerin. Deneme maçında üç kulübün scoutu olacak. Sen oyununu oyna, gerisi benim işim. 🤝`));
  dm(c, 'family', L2('Mum', 'Annem'), L2('Good luck tomorrow sweetheart ❤️ We\'re all so proud of you, whatever happens.', 'Yarın bol şans canım ❤️ Ne olursa olsun hepimiz seninle gurur duyuyoruz.'));
  c.feed.push({
    id: nextId('po'), name: me.name, handle: me.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 14) + me.num, av: 'me', text: L2('Big day tomorrow. Everything I\'ve worked for. 🙏⚽', 'Yarın büyük gün. Bunca emeğin karşılığı. 🙏⚽'),
    likes: 87, reposts: 6, replies: [{ name: 'Coach Benny', handle: 'coachbenny_youth', text: L2('Go show them kid 👊', 'Göster onlara evlat 👊'), likes: 12 }], replyCount: 9, week: 0, season: 1, t: 1, mine: true,
  });
  c.followHist.push({ s: 1, w: 0, v: me.followers });
  return c;
}

// ------------------------------------------------------------------ trial

export function trialOffers(c: Career, rating: number) {
  const natL = LEAGUE_NATIONS.includes(c.me.nat) ? c.me.nat : null;
  const pool = Object.values(c.clubs).filter((k) => !natL || k.nat === natL || Math.random() < 0.25);
  const top = pool.filter((k) => k.div === 1).sort((a, b) => a.rep - b.rep);
  const low = pool.filter((k) => k.div === 2).sort((a, b) => b.rep - a.rep);
  let picks;
  if (rating >= 8.3) picks = [top[Math.floor(top.length * rand(0.45, 0.85))], top[Math.floor(top.length * rand(0, 0.4))], low[0]];
  else if (rating >= 7) picks = [top[Math.floor(top.length * rand(0, 0.35))], low[Math.floor(rand(0, 3))], low[Math.floor(rand(3, 6))]];
  else picks = [low[Math.floor(rand(0, 4))], low[Math.floor(rand(4, 8))], low[Math.floor(rand(6, low.length))]];
  const seen = new Set<string>();
  c.offers = [];
  for (const k of picks) {
    if (!k || seen.has(k.id)) continue;
    seen.add(k.id);
    const role = roleFor(c, k.id);
    const wage = Math.round(wageFor(c, k, role) * 0.7 / 50) * 50;
    c.offers.push({
      id: nextId('of'), club: k.id, kind: 'trial', fee: 0, wage, years: 3, role, clause: Math.round((2e6 + k.rep * 9e4) / 1e5) * 1e5,
      goalBonus: Math.round(wage * 0.2 / 50) * 50, maxWage: wage * 1.2, patience: 3, round: 0, status: 'open', expires: 99, clubOk: true,
      note: role === 'prospect' ? L2('Development squad first, then the first team.', 'Önce gelişim takımı, sonra A takım.') : L2('A real shot at the first team.', 'A takımda gerçek bir şans.'),
    });
  }
}

export function signFirstContract(c: Career, o: Offer) {
  const k = c.clubs[o.club];
  c.contract = { club: k.id, wage: o.wage, until: c.season + o.years - 1, role: o.role, clause: o.clause, goalBonus: o.goalBonus };
  o.status = 'signed';
  c.offers = [];
  c.phase = 'season';
  c.week = 0;
  const taken = new Set(k.squad.map((id) => c.npcs[id]?.num));
  while (taken.has(c.me.num)) c.me.num = (c.me.num % 98) + 1;
  queueMoment(c, 'signed', ['First pro contract', 'İlk profesyonel sözleşme'], [`${k.name} · ${o.years}-year deal`, `${k.name} · ${o.years} yıllık sözleşme`], '✍️');
  eventPost(c, 'signing', { club: k.name, clubId: k.id, fee: L2('Academy contract', 'Altyapı sözleşmesi'), years: o.years });
  dm(c, 'manager', k.manager, L2(
    `Welcome to ${k.name}. I've seen the trial tape. You'll get chances, but here nobody is given anything. Work hard and the shirt is yours.`,
    `${k.name}'a hoş geldin. Deneme maçını izledim. Şans bulacaksın ama burada kimseye bir şey hediye edilmez. Çok çalış, forma senin olur.`));
  dm(c, 'family', L2('Dad', 'Babam'), L2(`A professional footballer at ${k.name}... I always knew it. 😭⚽`, `${k.name}'da profesyonel futbolcu... Hep biliyordum. 😭⚽`));
  const n = c.npcs[c.nemesis];
  if (n) {
    dm(c, 'nemesis', n.name, L2(
      `Heard you signed for ${k.name}. Cute. I'm at ${clubName(c, n.club!)}. See you at the top… if you make it 😉`,
      `${k.name}'a imza atmışsın. Tatlı. Ben ${clubName(c, n.club!)}'dayım. Zirvede görüşürüz… oraya gelebilirsen 😉`),
      { act: 'nem', choices: [{ id: 'ignore', label: L2('Ignore it', 'Görmezden gel') }, { id: 'clap', label: L2('"Watch me." 😤', '"İzle ve gör." 😤') }] });
  }
  prepareWeek(c);
}

// ------------------------------------------------------------------ week

export function weekKind(c: Career): string {
  if (c.phase === 'summer') return 'T';
  return SEASON_PLAN[c.week] ?? 'L';
}

export function myTeam(c: Career): string | null {
  const wk = weekKind(c);
  if ((wk === 'I' || wk === 'T') && c.me.capped) return 'n:' + c.me.nat;
  return c.contract?.club ?? null;
}

export function userFixture(c: Career): Fixture | null {
  const team = myTeam(c);
  if (!team) return null;
  return fixtureFor(c, team, c.week) ?? null;
}

export function isBig(c: Career, f: Fixture) {
  const comp = compById(c, f.comp);
  const my = myTeam(c);
  const opp = f.home === my ? f.away : f.home;
  const derby = !!my && !isNat(my) && c.clubs[my]?.rival === opp;
  return derby || f.round === 'F' || f.round === 'SF' || comp?.kind === 'cont' || comp?.kind === 'intl';
}

export function prepareWeek(c: Career) {
  c.ws = { trained: false, played: false, press: null, sel: null, objectives: [] };
  const wk = weekKind(c);
  if (wk === 'I' || (wk === 'T' && c.week === TOURNEY_WEEKS[0])) callups(c);
  const f = userFixture(c);
  if (f) {
    const team = myTeam(c)!;
    const opp = f.home === team ? f.away : f.home;
    c.ws.sel = selectMe(c, team);
    c.ws.objectives = c.ws.sel === 'start' || c.ws.sel === 'sub' ? makeObjectives(c, team, opp) : [];
    // press conference before the big ones (and after streaks)
    const slump = c.me.form.slice(-3).length === 3 && avg(c.me.form.slice(-3)) < 6.1;
    const streak = c.me.form.slice(-3).length === 3 && avg(c.me.form.slice(-3)) > 7.6;
    if ((c.ws.sel === 'start' || c.ws.sel === 'sub') && (isBig(c, f) || slump || streak) && c.me.rep > 6 && Math.random() < 0.75) c.ws.press = f.id;
  }
}

/** National call-ups before an international week / the tournament. */
function callups(c: Career) {
  const me = c.me;
  const pool = natPool(c, me.nat);
  const rivals = pool.map((id) => c.npcs[id]).filter((p) => p.pos === me.pos).sort((a, b) => b.ovr - a.ovr);
  const slots = me.pos === 'DEF' ? 3 : me.pos === 'MID' ? 3 : 2;
  const worst = rivals[Math.min(slots, rivals.length) - 1]?.ovr ?? 0;
  const my = myOvr(c) + (formAvg(c) - 6.6) * 2 + me.rep / 25;
  const was = me.capped;
  me.capped = !me.injury && me.age >= 18 && my >= worst - 1 && (me.rep >= 12 || myOvr(c) >= 74);
  // the squad without the user's spot
  c.natSquad = me.capped ? pool.filter((id) => id !== rivals[Math.min(slots, rivals.length) - 1]?.id) : pool;
  if (me.capped && !was) {
    const coach = `${pick(nationBy(me.nat).first)} ${pick(nationBy(me.nat).last)}`;
    dm(c, 'national', coach, L2(`You've earned this. Welcome to the national team. Wear the shirt with pride.`, `Bunu hak ettin. Milli takıma hoş geldin. Formayı gururla taşı.`));
    if (!c.seen.includes('callup')) {
      eventPost(c, 'callup');
      queueMoment(c, 'callup', ['National call-up', 'Milli takım daveti'], [LP([nationBy(me.nat).en, nationBy(me.nat).tr]), LP([nationBy(me.nat).en, nationBy(me.nat).tr])], '🌍');
    }
  } else if (!me.capped && was) {
    dm(c, 'agent', agentName(c), L2('You\'ve been left out of the national squad this time. Keep performing and they can\'t ignore you.', 'Bu sefer milli kadroya alınmadın. Performansını sürdür, seni görmezden gelemezler.'));
  }
}

// ------------------------------------------------------------------ matches

/** The opponent and setup for this week's match. */
export function matchInfo(c: Career) {
  const f = userFixture(c);
  if (!f) return null;
  const team = myTeam(c)!;
  const home = f.home === team;
  const opp = home ? f.away : f.home;
  return { f, team, opp, home, comp: compById(c, f.comp), big: isBig(c, f) };
}

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'insane', 'legend'];

export function oppDifficulty(c: Career, team: string, opp: string): Difficulty {
  const base = DIFFS.indexOf(c.difficulty);
  const d = teamStrength(c, opp) - teamStrength(c, team);
  return DIFFS[clamp(base + Math.round(d / 7), 0, 4)];
}

export interface SimEvent {
  min: number;
  kind: 'goal' | 'mygoal' | 'myassist' | 'oppgoal' | 'chance' | 'tackle' | 'save' | 'card' | 'ko' | 'sub' | 'ht' | 'ft';
  text: string;
}

/** Simulate the user's match. Returns the match line and a commentary timeline. */
export function simUserMatch(c: Career, subOn = false): { line: Line; events: SimEvent[]; gf: number; ga: number } {
  const info = matchInfo(c)!;
  const me = c.me;
  const sa = teamStrength(c, info.team), sb = teamStrength(c, info.opp);
  const gf = poisson(lambdaFor(sa, sb, info.home && !isNat(info.team)) * 1.05);
  const ga = poisson(lambdaFor(sb, sa, !info.home && !isNat(info.team)));
  const sq = squadOf(c, info.team).filter((p) => p.id !== 'me');
  const mine = myOvr(c);
  const share = { FWD: 0.4, MID: 0.22, DEF: 0.08 }[me.pos] * (mine / 72) ** 2 * (has(c, 'clinical') ? 1.2 : 1) * (subOn ? 0.45 : 1) * (0.85 + (formAvg(c) - 6.5) * 0.1);
  const minFrom = subOn ? 60 : 1;
  let goals = 0, assists = 0;
  const events: SimEvent[] = [];
  const mins = (n: number) => Array.from({ length: n }, () => Math.floor(rand(1, 90))).sort((a, b) => a - b);
  const v = { me: surname(me.name), opp: clubName(c, info.opp) };
  for (const m of mins(gf)) {
    if (m >= minFrom && Math.random() < share) {
      goals++;
      events.push({ min: m, kind: 'mygoal', text: L2(`GOAL! ${v.me} finishes it!`, `GOL! ${v.me} bitirdi!`) });
    } else {
      const scorer = sq.length ? weighted(sq.filter((p) => p.pos !== 'GK'), (p) => ({ FWD: 5, MID: 2.2, DEF: 0.7, GK: 0 })[p.pos] * (p.ovr / 70) ** 4) : null;
      const ast = m >= minFrom && Math.random() < { FWD: 0.25, MID: 0.36, DEF: 0.12 }[me.pos] * (subOn ? 0.5 : 1);
      if (ast) assists++;
      events.push({ min: m, kind: ast ? 'myassist' : 'goal', text: ast ? L2(`GOAL! ${scorer ? surname(scorer.name) : '?'} scores, assisted by ${v.me}!`, `GOL! ${scorer ? surname(scorer.name) : '?'} attı, asist ${v.me}!`) : L2(`GOAL! ${scorer ? surname(scorer.name) : '?'} scores.`, `GOL! ${scorer ? surname(scorer.name) : '?'} attı.`) });
    }
  }
  for (const m of mins(ga)) events.push({ min: m, kind: 'oppgoal', text: L2(`${v.opp} score.`, `${v.opp} golü buldu.`) });
  const flavour = Math.floor(rand(3, 6));
  for (let i = 0; i < flavour; i++) {
    const m = Math.floor(rand(minFrom, 90));
    const r = Math.random();
    events.push(r < 0.35
      ? { min: m, kind: 'chance', text: pick([L2(`${v.me} goes close!`, `${v.me} çok yakındı!`), L2(`${v.me} curls one just wide.`, `${v.me}'ın falsolu şutu az farkla dışarıda.`)]) }
      : r < 0.65
        ? { min: m, kind: 'ko', text: pick([L2(`${v.me} flattens a defender. The crowd roars. 💥`, `${v.me} bir defansı yere serdi. Tribünler coştu. 💥`), L2(`Huge collision in midfield!`, `Orta sahada müthiş bir çarpışma!`)]) }
        : r < 0.85
          ? { min: m, kind: 'tackle', text: L2(`${v.me} wins the ball back.`, `${v.me} topu geri kazandı.`) }
          : { min: m, kind: 'save', text: L2(`What a save to deny ${v.me}!`, `${v.me}'a karşı inanılmaz kurtarış!`) });
  }
  if (subOn) events.push({ min: 60, kind: 'sub', text: L2(`${v.me} comes on.`, `${v.me} oyuna girdi.`) });
  events.push({ min: 45, kind: 'ht', text: L2('Half-time.', 'İlk yarı sonu.') });
  events.sort((a, b) => a.min - b.min);
  events.push({ min: 90, kind: 'ft', text: L2('Full time.', 'Maç sonu.') });
  const tacklesBase = me.pos === 'DEF' ? 3 : me.pos === 'MID' ? 2 : 1;
  const line: Line = {
    goals, assists, shots: goals + poisson(me.pos === 'FWD' ? 2.5 : 1.2), onTarget: goals + poisson(0.9), passOk: poisson(me.pos === 'MID' ? 7 : 4), steals: poisson(tacklesBase),
    knockdowns: poisson(1.2), lost: poisson(2), downs: poisson(1), gf, ga, sub: subOn, big: info.big,
  };
  line.onTarget = Math.min(line.onTarget, line.shots);
  return { line, events, gf, ga };
}

/** Write the user's match into the world, update the player, create media. Then the week finishes. */
export function applyUserMatch(c: Career, line: Line, opts: { sim: boolean; sub: boolean; pens?: { me: number; opp: number; won: boolean }; scorers?: LastMatch['scorers'] }): LastMatch {
  const info = matchInfo(c)!;
  const me = c.me;
  const f = info.f;
  // result into the fixture
  f.hg = info.home ? line.gf : line.ga;
  f.ag = info.home ? line.ga : line.gf;
  if (opts.pens && f.hg === f.ag) f.pw = opts.pens.won ? info.team : info.opp;
  f.sc = [];
  for (let i = 0; i < line.goals; i++) f.sc.push('me');
  recordFixture(c, f);
  // NPC credit (both sides)
  if (!info.team.startsWith('trial')) {
    creditNPCs(c, info.team, Math.max(0, line.gf - line.goals), line.ga, f.sc);
    creditNPCs(c, info.opp, line.ga, line.gf, f.sc);
  }
  // rating
  let { rating, breakdown } = rateLine(c, line);
  if (opts.sim) {
    const simR = clamp(6.45 + (myOvr(c) - teamStrength(c, info.team)) * 0.04 + (formAvg(c) - 6.5) * 0.2 + gauss() * 0.45 + line.goals * 0.8 + line.assists * 0.5 + (line.gf - line.ga) * 0.1 + (line.ga === 0 ? (me.pos === 'DEF' ? 0.6 : me.pos === 'MID' ? 0.2 : 0) : 0) + (owns(c, 'analyst') ? 0.2 : 0) - 0.15, 4, 9.6);
    rating = Math.round(simR * 10) / 10;
    breakdown = [[L2('Simulated performance', 'Simüle performans'), rating - 6]];
  }
  checkObjectives(c.ws.objectives, line, rating);
  const objDone = c.ws.objectives.filter((o) => o.done).length;
  const objMiss = c.ws.objectives.length - objDone;
  // man of the match: compare with a plausible best NPC rating
  const motm = rating >= 7.6 + Math.random() * 0.8 || (line.goals >= 2 && line.gf > line.ga);
  // player state
  me.form = [...me.form, rating].slice(-5);
  const fitCost = (opts.sub ? 9 : 19) * (has(c, 'engine') ? 0.75 : 1);
  me.fitness = clamp(me.fitness - fitCost, 0, 100);
  me.sharpness = clamp(me.sharpness + (opts.sub ? 6 : 12), 0, 100);
  const xp = Math.round(45 + (rating - 6) * 55 + line.goals * 25 + line.assists * 15 + objDone * 20 + (motm ? 30 : 0));
  const ups = addXP(c, Math.max(15, xp));
  // match experience grows the stats the position uses
  const keys: StatKey[] = me.pos === 'FWD' ? ['sho', 'pac', 'dri'] : me.pos === 'MID' ? ['pas', 'dri', 'sho'] : ['def', 'phy', 'pas'];
  const statDelta: Partial<Record<StatKey, number>> = {};
  const gm = (Math.max(0, rating - 5.5) * 0.11 + 0.08) * (opts.sim ? 0.6 : 1) * (me.age <= 21 ? 1.25 : me.age <= 25 ? 1 : 0.6);
  keys.forEach((k, i) => {
    const g = grow(c, k, gm * (i === 0 ? 1 : 0.5));
    if (g) statDelta[k] = (statDelta[k] ?? 0) + g;
  });
  // relations & fame
  const comp = info.comp;
  const compW = comp?.kind === 'cont' ? 1.6 : comp?.kind === 'intl' ? 1.7 : comp?.kind === 'cup' ? 1.1 : !isNat(info.team) && c.clubs[info.team]?.div === 2 ? 0.55 : 1;
  me.rep = clamp(me.rep + (0.06 + (rating - 6.3) * 0.5 + line.goals * 0.3 + (motm ? 0.3 : 0)) * compW * (me.rep > 70 ? 0.6 : 1), 0, 100);
  me.rel.manager = clamp(me.rel.manager + (rating - 6.5) * 1.5 + objDone * 2 - objMiss * 1.2, 0, 100);
  me.rel.fans = clamp(me.rel.fans + (rating - 6.4) * 1.8 + (line.gf > line.ga ? 1 : line.gf < line.ga ? -1 : 0), 0, 100);
  me.rel.mates = clamp(me.rel.mates + line.assists * 1.5 + (line.gf > line.ga ? 0.8 : -0.3), 0, 100);
  me.morale = clamp(me.morale + (rating - 6.5) * 2.5 + (line.gf > line.ga ? 2 : line.gf < line.ga ? -2 : 0), 0, 100);
  // season & career numbers
  const nat = isNat(info.team);
  if (!info.team.startsWith('trial')) {
    if (nat) {
      me.intlApps++;
      me.intlGoals += line.goals;
    } else {
      c.s.apps++;
      if (!opts.sub) c.s.starts++;
      c.s.goals += line.goals;
      c.s.assists += line.assists;
      c.s.rsum += rating;
      if (motm) c.s.motm++;
      if (c.contract && line.goals) me.money += c.contract.goalBonus * line.goals;
    }
    c.stats.apps++;
    c.stats.goals += line.goals;
    c.stats.assists += line.assists;
    c.stats.rsum += rating;
    if (motm) c.stats.motm++;
    if (line.goals >= 3) c.stats.hattricks++;
    c.log.push({ season: c.season, week: c.week, comp: f.comp, opp: info.opp, home: info.home, gf: line.gf, ga: line.ga, rating, goals: line.goals, assists: line.assists, sim: opts.sim, sub: opts.sub, motm, nat });
    if (c.log.length > 400) c.log = c.log.slice(-400);
  }
  // injury
  let injury: string | null = null;
  const risk = (0.012 + (100 - me.fitness) * 0.0006 + line.downs * 0.004) * (has(c, 'iron') ? 0.65 : 1);
  if (!info.team.startsWith('trial') && Math.random() < risk) injury = injure(c);
  const lm: LastMatch = {
    fixture: f.id, comp: f.comp, opp: info.opp, home: info.home, gf: line.gf, ga: line.ga, rating, goals: line.goals, assists: line.assists, sim: opts.sim, sel: opts.sub ? 'sub' : 'start',
    breakdown, scorers: opts.scorers ?? [], objectives: c.ws.objectives, xp, motm, motmName: motm ? me.name : '', statDelta, injury, posted: false, pens: opts.pens, nat,
    line: { shots: line.shots, onTarget: line.onTarget, passOk: line.passOk, steals: line.steals, knockdowns: line.knockdowns, lost: line.lost },
  };
  c.last = lm;
  c.ws.played = true;
  if (ups) dm(c, 'agent', agentName(c), L2(`Level up! You reached level ${me.level}. You have a new perk point to spend. 📈`, `Seviye atladın! Artık ${me.level}. seviyedesin. Harcayacak yeni bir yetenek puanın var. 📈`));
  if (!info.team.startsWith('trial')) {
    matchMedia(c, lm);
    storyAfterMatch(c, lm);
  }
  return lm;
}

/** The user did not play this week (bench / out / no fixture / injured). */
export function benchWeek(c: Career) {
  const info = matchInfo(c);
  if (info && !info.f.played) {
    const [hg, ag] = simScore(c, info.f.home, info.f.away);
    info.f.hg = hg;
    info.f.ag = ag;
    recordFixture(c, info.f);
    creditNPCs(c, info.f.home, hg, ag, (info.f.sc = []));
    creditNPCs(c, info.f.away, ag, hg, info.f.sc);
    if (c.ws.sel === 'bench' || c.ws.sel === 'out') {
      const role = c.contract?.role;
      const hurt = role === 'starter' || role === 'star' ? 4 : role === 'rotation' ? 2 : 0.5;
      c.me.morale = clamp(c.me.morale - hurt, 0, 100);
      c.me.sharpness = clamp(c.me.sharpness - 6, 0, 100);
    }
  }
  c.ws.played = true;
}

const INJURIES: { kind: [string, string]; w: [number, number]; p: number }[] = [
  { kind: ['Dead leg', 'Darbe'], w: [1, 1], p: 4 },
  { kind: ['Ankle sprain', 'Ayak bileği burkulması'], w: [2, 4], p: 3 },
  { kind: ['Hamstring strain', 'Arka adale zorlanması'], w: [3, 5], p: 2.5 },
  { kind: ['Groin strain', 'Kasık zorlanması'], w: [2, 4], p: 1.5 },
  { kind: ['Broken toe', 'Ayak parmağı kırığı'], w: [4, 6], p: 0.8 },
  { kind: ['Knee ligament', 'Diz bağı'], w: [8, 14], p: 0.4 },
];

export function injure(c: Career): string {
  const it = weighted(INJURIES, (x) => x.p);
  const weeks = Math.max(1, Math.round(rand(it.w[0], it.w[1] + 0.99) * (owns(c, 'physio') ? 0.7 : 1)));
  c.me.injury = { kind: LP(it.kind), weeks, total: weeks };
  c.me.morale = clamp(c.me.morale - weeks, 0, 100);
  if (weeks >= 2) {
    eventPost(c, 'injury', { weeks, kind: LP(it.kind) });
    dm(c, 'family', L2('Mum', 'Annem'), L2('We saw the news. Rest, eat well and call me tonight. ❤️', 'Haberleri gördük. Dinlen, iyi beslen ve bu akşam beni ara. ❤️'), { act: 'family', choices: [{ id: 'love', label: L2('Love you, I\'ll be fine ❤️', 'Seni seviyorum, iyi olacağım ❤️') }, { id: 'busy', label: L2('Busy, talk later', 'Meşgulüm, sonra konuşuruz') }] });
  }
  if (weeks >= 6) queueMoment(c, 'injury' + c.season + c.week, ['Serious injury', 'Ciddi sakatlık'], [`${LP(it.kind)} · ${weeks} ${L2('weeks', 'hafta')}`, `${LP(it.kind)} · ${weeks} hafta`], '🚑');
  return `${LP(it.kind)} (${weeks} ${L2('wk', 'hf')})`;
}

// ------------------------------------------------------------------ finishing a week

export function finishWeek(c: Career) {
  const me = c.me;
  if (!c.ws.played) benchWeek(c);
  // everybody else
  const nemBefore = c.npcs[c.nemesis]?.s.goals ?? 0;
  for (const f of c.fixtures) {
    if (f.week !== c.week || f.played) continue;
    if ((c.phase === 'summer') !== (f.comp === 'T')) continue;
    const [hg, ag] = simScore(c, f.home, f.away);
    f.hg = hg;
    f.ag = ag;
    f.sc = [];
    creditNPCs(c, f.home, hg, ag, f.sc);
    creditNPCs(c, f.away, ag, hg, f.sc);
    recordFixture(c, f);
  }
  progressKnockouts(c, c.week);
  nemesisMedia(c, (c.npcs[c.nemesis]?.s.goals ?? 0) - nemBefore);
  worldMedia(c);
  // money
  const sponsorPay = me.sponsors.reduce((a, s) => a + Math.round((SPONSORS.find((x) => x.id === s.id)?.pay ?? 0) * (has(c, 'icon') ? 1.3 : 1)), 0);
  me.money = Math.round(me.money + (c.contract?.wage ?? 0) + sponsorPay - weeklyUpkeep(c));
  if (me.money < 0) {
    // can't pay the staff: they leave
    for (const id of [...me.owned]) if (['chef', 'trainer', 'physio', 'pr', 'analyst'].includes(id)) me.owned = me.owned.filter((x) => x !== id);
    me.money = Math.max(me.money, 0);
    dm(c, 'agent', agentName(c), L2('Your account went red, so your personal staff were let go. Careful with the spending!', 'Hesabın eksiye düştü, bu yüzden kişisel ekibin ayrıldı. Harcamalara dikkat!'));
  }
  // body & mind
  me.fitness = clamp(me.fitness + 13 + (owns(c, 'chef') ? 5 : 0) + (owns(c, 'villa') ? 3 : 0) + (c.ws.trained ? 0 : 8), 0, 100);
  if (me.injury) {
    me.injury.weeks--;
    if (me.injury.weeks <= 0) {
      const long = me.injury.total >= 4;
      me.injury = null;
      me.sharpness = 30;
      if (long) {
        eventPost(c, 'return');
        queueMoment(c, 'back' + c.season + c.week, ['Back from injury', 'Sakatlıktan döndü'], ['Hungrier than ever.', 'Her zamankinden aç.'], '💪');
      }
    }
  }
  me.sharpness = clamp(me.sharpness - 2, 0, 100);
  const homeBonus = owns(c, 'mansion') ? 3 : owns(c, 'villa') ? 2 : owns(c, 'flat') ? 1 : 0;
  me.morale = clamp(me.morale + (62 + homeBonus * 3 - me.morale) * 0.08 + (me.rel.fans - 50) * 0.02, 0, 100);
  if (owns(c, 'pr')) me.image = clamp(me.image + 1, -100, 100);
  ageMe(c);
  // fame drift
  me.rep = clamp(me.rep - 0.03 - me.rep * 0.0015, 0, 100);
  const carK = owns(c, 'hyper') ? 1.25 : owns(c, 'sport') ? 1.1 : 1;
  const target = (900 + Math.pow(me.rep, 3) * 6.5) * carK * (1 + Math.max(0, me.image) / 400) * (has(c, 'showman') ? 1.4 : 1);
  me.followers = Math.max(100, Math.round(me.followers + (target - me.followers) * 0.07 * (target > me.followers ? 1 : 0.3) + rand(-0.002, 0.004) * me.followers));
  for (const k of Object.keys(me.rel) as (keyof typeof me.rel)[]) me.rel[k] = clamp(me.rel[k] + (50 - me.rel[k]) * 0.01, 0, 100);
  if (c.week % 2 === 0) {
    c.valueHist.push({ s: c.season, w: c.week, v: marketValue(c) });
    c.followHist.push({ s: c.season, w: c.week, v: me.followers });
    if (c.valueHist.length > 260) c.valueHist.shift();
    if (c.followHist.length > 260) c.followHist.shift();
  }
  // sponsor obligations: a post every few weeks
  for (const s of [...me.sponsors]) {
    if (c.week % 8 === 7 && s.posts === 0) {
      const sp = SPONSORS.find((x) => x.id === s.id)!;
      dm(c, 'sponsor', sp.name, L2(`Hey! We haven't seen a #${sp.tag} post in a while 👀 Please keep your side of the deal.`, `Selam! Bir süredir #${sp.tag} paylaşımı görmedik 👀 Lütfen anlaşmanın sana düşen kısmını yerine getir.`));
      me.image -= 1;
    }
    if (c.week % 8 === 7) s.posts = 0;
  }
  // transfer windows & contracts
  if (c.phase === 'season' && (c.week === 0 || (c.week >= 14 && c.week <= 16))) {
    windowOffers(c);
    if (c.week === 0 || c.week === 16) npcWindow(c);
    if (c.week === 16) headline(c, { kind: 'transfer', big: true, title: L2('DEADLINE DAY', 'TRANSFERDE SON GÜN'), sub: L2('The window slams shut tonight. Who\'s moving?', 'Pencere bu gece kapanıyor. Kim nereye gidiyor?') });
  }
  if (c.phase === 'season') renewalCheck(c);
  // a free agent keeps getting calls
  if (!c.contract && c.phase === 'season' && !c.offers.some((o) => o.status === 'open')) windowOffers(c);
  expireOffers(c);
  storyWeekly(c);
  // next week
  if (c.phase === 'season' && c.week >= LAST_WEEK) return endSeason(c);
  if (c.phase === 'summer' && c.week >= TOURNEY_WEEKS[TOURNEY_WEEKS.length - 1]) return startSeason(c);
  c.week++;
  if (c.phase === 'summer' && !c.fixtures.some((f) => f.comp === 'T' && f.week >= c.week && (!f.played))) {
    // the tournament is over for everyone
    if (!c.fixtures.some((f) => f.comp === 'T' && !f.played)) return startSeason(c);
  }
  prepareWeek(c);
}

// ------------------------------------------------------------------ story

export function queueMoment(c: Career, key: string, title: [string, string], sub: [string, string], icon: string) {
  if (c.seen.includes(key)) return;
  c.seen.push(key);
  const m: Moment = { key, title, sub, season: c.season, week: c.week, icon };
  c.queue.push(m);
  c.moments.push(m);
}

function storyAfterMatch(c: Career, lm: LastMatch) {
  const me = c.me;
  const v = { opp: clubName(c, lm.opp) };
  if (!lm.nat) queueMoment(c, 'debut', ['Professional debut', 'Profesyonel ilk maç'], [`vs ${v.opp}`, `${v.opp} karşısında`], '👟');
  if (lm.nat) queueMoment(c, 'cap1', ['First cap', 'Milli formayla ilk maç'], [`vs ${v.opp}`, `${v.opp} karşısında`], '🌍');
  if (lm.goals > 0) {
    if (!c.seen.includes('firstgoal')) {
      queueMoment(c, 'firstgoal', ['First professional goal', 'İlk profesyonel gol'], [`vs ${v.opp}`, `${v.opp} karşısında`], '⚽');
      dm(c, 'family', L2('Mum', 'Annem'), L2('I screamed so loud the neighbours came over 😭😭 YOUR FIRST GOAL!!!', 'Öyle bağırdım ki komşular geldi 😭😭 İLK GOLÜN!!!'), { act: 'family', choices: [{ id: 'love', label: L2('That one was for you ❤️', 'O gol senin içindi ❤️') }, { id: 'busy', label: '😂👍' }] });
    }
    if (lm.nat) queueMoment(c, 'natgoal', ['First international goal', 'Milli formayla ilk gol'], [`vs ${v.opp}`, `${v.opp} karşısında`], '🌍');
  }
  if (lm.goals >= 3) queueMoment(c, 'hat' + c.stats.hattricks, ['Hat-trick!', 'Hat-trick!'], [`vs ${v.opp}`, `${v.opp} karşısında`], '🎩');
  for (const n of [10, 25, 50, 100, 150, 200, 300]) {
    if (c.stats.goals >= n && !c.seen.includes('g' + n)) {
      queueMoment(c, 'g' + n, [`${n} career goals`, `Kariyerde ${n} gol`], [`${me.age} ${L2('years old', 'yaşında')}`, `${me.age} yaşında`], '🎯');
      eventPost(c, 'milestone', { what: L2(`${n} career goals`, `Kariyerde ${n} gol`) });
    }
  }
  for (const n of [50, 100, 200, 300, 400]) if (c.stats.apps >= n) queueMoment(c, 'a' + n, [`${n} appearances`, `${n} maç`], ['', ''], '🏟️');
  // manager feedback
  const last3 = me.form.slice(-3);
  if (last3.length === 3 && avg(last3) < 5.9 && !c.dms.some((d) => d.act === 'mgr_crit' && d.season === c.season && c.week - d.week < 6) && c.contract) {
    dm(c, 'manager', managerName(c), L2('Three poor games in a row. I need more from you, or you\'ll be watching from the bench.', 'Üst üste üç kötü maç. Senden daha fazlasını bekliyorum, yoksa kulübeden izlersin.'), { act: 'mgr_crit', choices: [{ id: 'accept', label: L2('You\'re right. I\'ll work harder.', 'Haklısınız. Daha çok çalışacağım.') }, { id: 'push', label: L2('Play me in my real position.', 'Beni gerçek mevkimde oynatın.') }] });
  } else if (last3.length === 3 && avg(last3) > 7.7 && !c.dms.some((d) => d.act === 'mgr_praise' && d.season === c.season && c.week - d.week < 8) && c.contract) {
    dm(c, 'manager', managerName(c), L2('Brilliant run. The staff is talking about you. Keep this level.', 'Harika bir seri. Teknik ekip senden bahsediyor. Bu seviyeyi koru.'), { act: 'mgr_praise', choices: [{ id: 'thanks', label: L2('Thanks coach 🙏', 'Teşekkürler hocam 🙏') }, { id: 'more', label: L2('There\'s more to come.', 'Daha fazlası gelecek.') }] });
  }
}

function storyWeekly(c: Career) {
  const me = c.me;
  if (!c.contract) return;
  const k = c.clubs[c.contract.club];
  // sponsors find you
  for (const sp of SPONSORS) {
    if (me.followers < sp.minF * 1000 || me.sponsors.some((s) => s.id === sp.id) || me.sponsors.length >= 3) continue;
    if (c.dms.some((d) => d.data?.sponsor === sp.id)) continue;
    if (me.image < -40 && Math.random() < 0.7) continue;
    dm(c, 'sponsor', sp.name, L2(`Hi ${surname(me.name)}! ${sp.name} would love you as an ambassador: ${money(sp.bonus)} signing bonus + ${money(sp.pay)}/week for 2 seasons. Interested?`, `Selam ${surname(me.name)}! ${sp.name} olarak seni marka elçimiz yapmak istiyoruz: ${money(sp.bonus)} imza bonusu + 2 sezon boyunca haftalık ${money(sp.pay)}. İlgilenir misin?`),
      { act: 'sponsor', data: { sponsor: sp.id }, choices: [{ id: 'accept', label: L2('Let\'s do it 🤝', 'Yapalım 🤝') }, { id: 'decline', label: L2('Not for me', 'Bana göre değil') }] });
    break;
  }
  // captaincy
  if (!me.captain && me.age >= 22 && me.rel.manager >= 72 && me.rel.mates >= 66 && (has(c, 'leader') || me.personality === 'leader' || me.rep > 40) && !c.contract.loan && !c.dms.some((d) => d.act === 'cap' && d.season === c.season)) {
    dm(c, 'manager', managerName(c), L2(`I want you to be our captain. The dressing room respects you. What do you say?`, `Kaptanımız olmanı istiyorum. Soyunma odası sana saygı duyuyor. Ne dersin?`), { act: 'cap', choices: [{ id: 'accept', label: L2('It would be an honour ©️', 'Benim için onur olur ©️') }, { id: 'decline', label: L2('Not yet, coach', 'Henüz değil hocam') }] });
  }
  // team-mate banter
  if (Math.random() < 0.12) {
    const mate = k.squad.map((id) => c.npcs[id]).filter(Boolean)[Math.floor(Math.random() * k.squad.length)];
    if (mate) dm(c, 'mate', mate.name, pick([
      L2('bro who let you pick the music in the dressing room 💀', 'kanka soyunma odasında müziği seçmene kim izin verdi 💀'),
      L2('5-a-side after training? losers buy dinner 😤', 'antrenmandan sonra halı saha? kaybeden yemek ısmarlar 😤'),
      L2('saw your new boots… bold choice 😂', 'yeni kramponlarını gördüm… cesur seçim 😂'),
      L2('the gaffer was in a mood today 😬 keep your head down', 'hoca bugün sinirliydi 😬 dikkatli ol'),
    ]), { act: 'mate_banter', choices: [{ id: 'banter', label: L2('Banter back 😂', 'Laf sok 😂') }, { id: 'serious', label: L2('Focus on the next game 💪', 'Sıradaki maça odaklan 💪') }] });
  }
  // not playing: agent suggests a move
  const apps = c.log.filter((l) => l.season === c.season && !l.nat).length;
  if (c.week === 12 && apps < 4 && !c.contract.loan) {
    dm(c, 'agent', agentName(c), L2(`Only ${apps} games so far. The winter window opens soon: want me to find you a club where you play?`, `Şu ana kadar sadece ${apps} maç. Devre arası transfer dönemi yakında: forma giyebileceğin bir kulüp bulayım mı?`), { act: 'agent_move', choices: [{ id: 'push', label: L2('Yes, find me minutes', 'Evet, bana süre bul') }, { id: 'stay', label: L2('I\'ll fight for my place', 'Yerim için savaşacağım') }] });
  }
  // nemesis needles
  const n = c.npcs[c.nemesis];
  if (n && me.rel.nemesis > 45 && Math.random() < 0.06) {
    dm(c, 'nemesis', n.name, pick([
      L2(`${n.s.goals} goals and counting. You? 😴`, `${n.s.goals} gol ve devam. Sen? 😴`),
      L2('Enjoying the bench? 😂', 'Kulübe rahat mı? 😂'),
      L2('Saw your highlights. Mine are longer. 🤷', 'Özetlerini gördüm. Benimkiler daha uzun. 🤷'),
    ]), { act: 'nem', choices: [{ id: 'ignore', label: L2('Leave on read', 'Görüldü bırak') }, { id: 'clap', label: L2('Clap back 🔥', 'Cevabı yapıştır 🔥') }] });
  }
}

// ------------------------------------------------------------------ season end

export interface SeasonAwards {
  league: string;
  boot: { id: string; goals: number };
  poty: { id: string; avg: number };
  young: { id: string; avg: number } | null;
  tots: string[];
}

export interface SeasonReview {
  season: number;
  leaguePos: number;
  leagueName: string;
  trophies: string[];
  awards: string[];
  awardsRace: SeasonAwards | null;
  coins: number;
  promoted: boolean;
  relegated: boolean;
}

export let lastReview: SeasonReview | null = null;

function scoreNPC(p: NPC) {
  const a = p.s.apps ? p.s.rsum / p.s.apps : 0;
  return { avg: a, goals: p.s.goals, apps: p.s.apps };
}

function myAvg(c: Career) {
  return c.s.apps ? c.s.rsum / c.s.apps : 0;
}

function leagueAwards(c: Career, leagueId: string): SeasonAwards {
  const comp = compById(c, leagueId)!;
  const players = Object.values(c.npcs).filter((p) => p.club && comp.teams.includes(p.club));
  const meIn = c.contract && comp.teams.includes(c.contract.club);
  type E = { id: string; goals: number; avg: number; apps: number; age: number; pos: string };
  const list: E[] = players.map((p) => ({ id: p.id, goals: p.s.goals, avg: scoreNPC(p).avg, apps: p.s.apps, age: p.age, pos: p.pos }));
  if (meIn) list.push({ id: 'me', goals: c.s.goals, avg: myAvg(c), apps: c.s.apps, age: c.me.age, pos: c.me.pos });
  const minApps = 12;
  const boot = [...list].sort((a, b) => b.goals - a.goals || b.avg - a.avg)[0];
  const elig = list.filter((e) => e.apps >= minApps);
  const poty = [...elig].sort((a, b) => b.avg + b.goals * 0.02 - (a.avg + a.goals * 0.02))[0] ?? boot;
  const young = [...elig.filter((e) => e.age <= 21)].sort((a, b) => b.avg - a.avg)[0] ?? null;
  const tots: string[] = [];
  for (const [pos, n] of [['GK', 1], ['DEF', 2], ['MID', 1], ['FWD', 1]] as [string, number][]) tots.push(...elig.filter((e) => e.pos === pos).sort((a, b) => b.avg - a.avg).slice(0, n).map((e) => e.id));
  return { league: leagueId, boot: { id: boot.id, goals: boot.goals }, poty: { id: poty.id, avg: poty.avg }, young: young ? { id: young.id, avg: young.avg } : null, tots };
}

export function playerName(c: Career, id: string) {
  return id === 'me' ? c.me.name : c.npcs[id]?.name ?? '?';
}

function endSeason(c: Career) {
  const me = c.me;
  const club = c.contract?.club ?? null;
  const trophies: string[] = [];
  const awards: string[] = [];
  let leaguePos = 0, leagueName = '', promoted = false, relegated = false;
  let race: SeasonAwards | null = null;
  // trophies for the user's club
  for (const comp of c.comps) {
    let won = false;
    if (comp.kind === 'league' && comp.table) {
      const tb = sortTable(comp.table);
      if (club && comp.teams.includes(club)) {
        leaguePos = tb.findIndex((r) => r.id === club) + 1;
        leagueName = LP(comp.name);
        won = leaguePos === 1;
        promoted = comp.div === 2 && leaguePos <= 2;
        relegated = comp.div === 1 && leaguePos >= 9;
        race = leagueAwards(c, comp.id);
      }
      comp.winner = tb[0].id;
    } else if (comp.winner && club && comp.winner === club) won = true;
    if (won && c.s.apps > 0) {
      trophies.push(LP(comp.name));
      c.trophies.push({ season: c.season, key: comp.id, name: comp.name, club: club! });
      eventPost(c, 'trophy', { trophy: LP(comp.name) });
      queueMoment(c, 'tr' + c.season + comp.id, [`${comp.name[0]} winner`, `${comp.name[1]} şampiyonu`], [`${c.season}. ${L2('season', 'sezon')}`, `${c.season}. sezon`], '🏆');
      me.rep = clamp(me.rep + (comp.kind === 'cont' ? 7 : comp.kind === 'league' ? (comp.div === 1 ? 6 : 2) : 3), 0, 100);
    }
  }
  if (race) {
    const r = race;
    const give = (key: string, name: [string, string]) => {
      awards.push(LP(name));
      c.awards.push({ season: c.season, key, name });
      eventPost(c, 'award', { award: LP(name) });
      queueMoment(c, 'aw' + c.season + key, name, [leagueName, leagueName], '🏅');
      me.rep = clamp(me.rep + 4, 0, 100);
    };
    if (r.boot.id === 'me' && r.boot.goals > 0) give('boot', ['Golden Boot', 'Gol Kralı']);
    if (r.poty.id === 'me') give('poty', ['Player of the Season', 'Sezonun Oyuncusu']);
    if (r.young?.id === 'me') give('young', ['Young Player of the Season', 'Sezonun Genç Oyuncusu']);
    if (r.tots.includes('me')) give('tots', ['Team of the Season', 'Sezonun Takımı']);
  }
  const avgR = myAvg(c);
  const rec: SeasonRecord = {
    season: c.season, age: me.age, club: club ?? '', div: club ? c.clubs[club]?.div ?? 0 : 0, nat: me.nat, ovr: myOvr(c), apps: c.s.apps, goals: c.s.goals, assists: c.s.assists,
    avg: Math.round(avgR * 100) / 100, motm: c.s.motm, leaguePos, trophies, awards, value: marketValue(c), intlApps: me.intlApps, intlGoals: me.intlGoals,
  };
  c.history.push(rec);
  const coins = Math.round(400 + c.s.goals * 25 + c.s.assists * 15 + c.s.apps * 10 + trophies.length * 1200 + awards.length * 1500);
  c.rewards.push({ coins, note: L2(`Season ${c.season} complete`, `${c.season}. sezon tamamlandı`) });
  lastReview = { season: c.season, leaguePos, leagueName, trophies, awards, awardsRace: race, coins, promoted, relegated };
  c.flags.review = c.season;
  // the summer tournament (even seasons)
  if (c.season % 2 === 0) {
    c.phase = 'summer';
    c.week = TOURNEY_WEEKS[0];
    buildTourney(c);
    prepareWeek(c);
  } else startSeason(c);
}

// ------------------------------------------------------------------ new season

export interface Gala {
  season: number;
  ranking: { id: string; score: number }[];
  myRank: number;
}
export let lastGala: Gala | null = null;

function goldenBall(c: Career): Gala {
  const winners = new Set(c.comps.filter((k) => k.winner).map((k) => k.winner!));
  const contW = compById(c, 'E')?.winner;
  const tW = compById(c, 'T')?.winner;
  const list = Object.values(c.npcs).filter((p) => p.s.apps >= 10).map((p) => ({
    id: p.id,
    score: (p.s.rsum / Math.max(1, p.s.apps) - 6) * 12 + p.s.goals * 0.9 + p.s.assists * 0.5 + p.ovr * 0.35 + (p.club && winners.has(p.club) ? 4 : 0) + (p.club === contW ? 7 : 0) + (tW === 'n:' + p.nat ? 5 : 0),
  }));
  const myAvgR = c.s.apps ? c.s.rsum / c.s.apps : 0;
  const club = c.history[c.history.length - 1]?.club;
  const myScore = c.s.apps >= 8 ? (myAvgR - 6) * 12 + c.s.goals * 0.9 + c.s.assists * 0.5 + myOvr(c) * 0.35 + (club && winners.has(club) ? 4 : 0) + (club === contW ? 7 : 0) + (tW === 'n:' + c.me.nat ? 5 : 0) + c.awards.filter((a) => a.season === c.season).length * 2 : 0;
  if (myScore) list.push({ id: 'me', score: myScore });
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  return { season: c.season, ranking: top, myRank: list.findIndex((x) => x.id === 'me') + 1 };
}

export function startSeason(c: Career) {
  const me = c.me;
  // golden ball for the season that ended
  const g = goldenBall(c);
  lastGala = g;
  c.flags.gala = c.season;
  if (g.myRank === 1) {
    const name: [string, string] = ['Golden Ball', 'Altın Top'];
    c.awards.push({ season: c.season, key: 'ball', name });
    eventPost(c, 'award', { award: LP(name) });
    queueMoment(c, 'ball' + c.season, name, [L2('The best player in the world.', 'Dünyanın en iyi oyuncusu.'), 'Dünyanın en iyi oyuncusu.'], '🌟');
    me.rep = clamp(me.rep + 10, 0, 100);
    c.rewards.push({ coins: 5000, note: L2('Golden Ball', 'Altın Top') });
  }
  if (c.phase === 'summer') {
    const tw = compById(c, 'T')?.winner;
    if (tw === 'n:' + me.nat && me.capped && c.log.some((l) => l.season === c.season && l.comp === 'T')) {
      const name: [string, string] = ['Mad Nations Cup', 'Mad Uluslar Kupası'];
      c.trophies.push({ season: c.season, key: 'T', name, club: tw });
      queueMoment(c, 'tT' + c.season, ['World champion!', 'Dünya şampiyonu!'], [LP(name), LP(name)], '🏆');
      me.rep = clamp(me.rep + 8, 0, 100);
    }
  }
  const prevTables: Record<string, string[]> = {};
  for (const comp of c.comps) if (comp.kind === 'league' && comp.table) prevTables[comp.id] = sortTable(comp.table).map((r) => r.id);
  // promotion / relegation
  for (const code of LEAGUE_NATIONS) {
    const t1 = prevTables[`L1_${code}`], t2 = prevTables[`L2_${code}`];
    if (!t1 || !t2) continue;
    for (const id of t1.slice(-2)) c.clubs[id].div = 2;
    for (const id of t2.slice(0, 2)) c.clubs[id].div = 1;
    // prestige follows results
    t1.forEach((id, i) => { c.clubs[id].rep = clamp(c.clubs[id].rep + (4.5 - i) * 0.5, 20, 97); });
    t2.forEach((id, i) => { c.clubs[id].rep = clamp(c.clubs[id].rep + (4.5 - i) * 0.4, 18, 70); });
  }
  // world ages
  for (const p of Object.values(c.npcs)) {
    p.age++;
    const d = p.age <= 21 ? rand(1, 5) : p.age <= 25 ? rand(0, 3) : p.age <= 29 ? rand(-1, 1.5) : p.age <= 32 ? rand(-3, 0) : rand(-5, -1);
    p.ovr = Math.round(clamp(p.ovr + d * (p.ovr < p.pot ? 1 : 0.3) - (p.ovr > p.pot ? 1 : 0), 40, Math.max(p.pot, 45)));
    p.s = { apps: 0, starts: 0, goals: 0, assists: 0, rsum: 0, motm: 0 };
    if (p.id !== c.nemesis && (p.age >= 37 || (p.age >= 34 && Math.random() < 0.35))) {
      // retire: a youngster takes the place
      const k = p.club ? c.clubs[p.club] : null;
      delete c.npcs[p.id];
      if (k) {
        k.squad = k.squad.filter((id) => id !== p.id);
        const y = makeNPC(Math.random() < 0.75 ? k.nat : pick(NATIONS).code, p.pos, 49 + k.rep * 0.37 - rand(4, 10), Math.floor(rand(17, 20)), k.id);
        c.npcs[y.id] = y;
        k.squad.push(y.id);
      } else {
        const y = makeNPC(p.nat, p.pos, p.ovr - 4, 19, null);
        c.npcs[y.id] = y;
      }
    }
  }
  // the user
  c.season++;
  me.age++;
  c.s = { apps: 0, starts: 0, goals: 0, assists: 0, rsum: 0, motm: 0 };
  me.capped = false;
  c.natSquad = [];
  me.fitness = 100;
  me.potSeen = [Math.max(me.potSeen[0], myOvr(c)), Math.max(me.potSeen[1], myOvr(c) + 1)];
  if (Math.random() < 0.35) me.potSeen = [Math.min(me.pot, me.potSeen[0] + 1), Math.max(me.pot, me.potSeen[1] - 1)];
  me.sponsors = me.sponsors.filter((s) => s.until >= c.season);
  c.phase = 'season';
  c.week = 0;
  buildSeason(c, prevTables);
  // contracts
  if (c.contract?.loan) endLoan(c);
  if (c.contract && c.contract.until < c.season) {
    const old = c.contract.club;
    c.contract = null;
    dm(c, 'agent', agentName(c), L2(`Your contract with ${clubName(c, old)} has expired. You're a free agent: let's find the right club.`, `${clubName(c, old)} ile sözleşmen sona erdi. Serbest oyuncusun: doğru kulübü bulalım.`));
    windowOffers(c);
  }
  // retirement hints
  if (me.age >= 38) {
    me.retired = true;
    c.phase = 'retired';
    queueMoment(c, 'retire', ['End of an era', 'Bir devrin sonu'], [L2('Time to hang up the boots.', 'Kramponları asma vakti.'), 'Kramponları asma vakti.'], '👋');
    return;
  }
  if (me.age >= 34 && myOvr(c) < 66 && !c.flags.retireHint) {
    c.flags.retireHint = 1;
    dm(c, 'agent', agentName(c), L2('Honest talk: the offers are getting smaller. Whenever you feel it\'s time, you can announce your retirement from your profile. No rush.', 'Dürüst olayım: teklifler küçülüyor. Zamanının geldiğini hissettiğinde profilinden emekliliğini açıklayabilirsin. Acele yok.'));
  }
  headline(c, { kind: 'league', big: true, title: L2(`Season ${c.season} kicks off`, `${c.season}. sezon başlıyor`), sub: L2('New dreams, new rivals, same madness.', 'Yeni hayaller, yeni rakipler, aynı çılgınlık.') });
  prepareWeek(c);
  // the window opens in pre-season
  void compact;
}

// ------------------------------------------------------------------ retirement

export function retire(c: Career) {
  c.me.retired = true;
  c.phase = 'retired';
  const legacy = legacyScore(c);
  c.rewards.push({ coins: Math.round(legacy * 40), note: L2('Career legacy', 'Kariyer mirası') });
  addPost(c, {
    id: nextId('po'), name: c.me.name, handle: c.me.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 14) + c.me.num, verified: c.me.followers > 50000, av: 'me',
    text: L2('Thank you, football. For everything. ❤️⚽ It\'s time.', 'Teşekkürler futbol. Her şey için. ❤️⚽ Vakit geldi.'),
    likes: Math.round(c.me.followers * 0.2), reposts: Math.round(c.me.followers * 0.04), replies: [], replyCount: Math.round(c.me.followers * 0.02), week: c.week, season: c.season, t: 1, mine: true,
  });
}

export function legacyScore(c: Career) {
  const s = c.stats;
  return Math.round(s.goals * 1.2 + s.assists * 0.7 + s.apps * 0.3 + c.trophies.length * 25 + c.awards.length * 30 + c.awards.filter((a) => a.key === 'ball').length * 120 + c.me.intlApps * 0.8 + Math.max(0, myOvr(c) - 60));
}

export function legacyTier(c: Career) {
  const s = legacyScore(c);
  if (s >= 900) return L2('Immortal', 'Ölümsüz');
  if (s >= 600) return L2('Legend', 'Efsane');
  if (s >= 350) return L2('Club icon', 'Kulüp ikonu');
  if (s >= 180) return L2('Fan favourite', 'Taraftarın sevgilisi');
  return L2('Journeyman', 'Gezgin futbolcu');
}

// ------------------------------------------------------------------ misc

export function weekLabel(c: Career) {
  const k = weekKind(c);
  const m: Record<string, [string, string]> = {
    P: ['Pre-season', 'Sezon öncesi'], L: ['League', 'Lig'], C: ['Cup', 'Kupa'], E: ['Champions Cup', 'Şampiyonlar Kupası'], I: ['International break', 'Milli ara'], T: ['Mad Nations Cup', 'Mad Uluslar Kupası'],
  };
  return LP(m[k] ?? m.L);
}

export function nextFixtures(c: Career, n = 6) {
  const team = c.contract?.club;
  const out: Fixture[] = [];
  for (const f of [...c.fixtures].sort((a, b) => a.week - b.week)) {
    if (f.week < c.week) continue;
    if (f.home === team || f.away === team || (c.me.capped && (f.home === 'n:' + c.me.nat || f.away === 'n:' + c.me.nat))) out.push(f);
    if (out.length >= n) break;
  }
  return out;
}

export { compName, roundName, natCode };
