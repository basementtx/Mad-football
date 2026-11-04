/** Transfers, loans, renewals and contract negotiation; plus the NPC transfer market. */
import type { Career, Offer, Role, Club } from './types';
import { clamp, pick, rand } from '../engine/math';
import { myOvr, teamStrength, makeNPC, clubName, squadOf } from './world';
import { marketValue, roleFor, roleName, formAvg } from './me';
import { dm, agentName, eventPost, headline, addPost } from './media';
import { nextId } from './state';
import { L2, money, LP } from './util';
import { JOURNALISTS, OUTLETS } from './data';

export const ROLE_RANK: Record<Role, number> = { prospect: 0, rotation: 1, starter: 2, star: 3 };

export function windowOpen(c: Career) {
  return c.phase === 'offseason' || (c.phase === 'season' && (c.week === 0 || (c.week >= 14 && c.week <= 16)));
}

/** Weekly wage a club would pay for you. */
export function wageFor(c: Career, club: Club, role: Role) {
  const ovr = myOvr(c);
  const base = Math.pow(Math.max(0, ovr - 45), 2.4) * 2.2 * (0.45 + club.rep / 90);
  const rk = [0.55, 0.8, 1, 1.3][ROLE_RANK[role]];
  const repK = 1 + c.me.rep / 160;
  return Math.max(250, Math.round((base * rk * repK) / 50) * 50);
}

/** How attractive the user is to a club (0..1+). */
function interest(c: Career, k: Club) {
  const ovr = myOvr(c);
  const lvl = teamStrength(c, k.id);
  const need = squadOf(c, k.id).filter((p) => p.pos === c.me.pos && p.id !== 'me').sort((a, b) => b.ovr - a.ovr);
  const weakest = need[need.length - 1]?.ovr ?? 50;
  // good enough to play there (being far better than a small club adds nothing)
  const fit = clamp((ovr - (lvl - 4)) / 8, -1.5, 0.6);
  const room = clamp((ovr - weakest) / 12, -0.5, 0.5);
  const fame = (c.me.rep - k.rep * 0.45) / 100;
  const age = c.me.age <= 23 ? 0.15 : c.me.age >= 31 ? -0.25 : 0;
  const afford = marketValue(c) <= k.budget * 0.6 ? 0 : -0.7;
  return fit * 0.6 + room * 0.3 + fame * 0.4 + age + afford + k.rep / 250 + (formAvg(c) - 6.6) * 0.12;
}

function makeOffer(c: Career, k: Club, kind: Offer['kind']): Offer {
  const role = roleFor(c, k.id);
  const wage = wageFor(c, k, role);
  const val = marketValue(c);
  const yrs = c.me.age <= 22 ? pick([3, 4, 5]) : c.me.age <= 29 ? pick([2, 3, 4]) : pick([1, 2]);
  const fee = kind === 'transfer' ? Math.round((val * rand(0.85, 1.3)) / 10000) * 10000 : 0;
  return {
    id: nextId('of'), club: k.id, kind, fee, wage: kind === 'loan' ? Math.round(wage * 0.5) : wage, years: kind === 'loan' ? 1 : yrs, role,
    clause: Math.round((val * rand(2, 3.5)) / 100000) * 100000, goalBonus: Math.round((wage * rand(0.15, 0.4)) / 50) * 50,
    maxWage: Math.round(wage * rand(1.15, 1.5)), patience: 3, round: 0, status: 'open', expires: c.week + 2,
  };
}

/** During a window: clubs make offers. Called every window week. */
export function windowOffers(c: Career) {
  if (!c.contract && c.phase !== 'trial') return freeAgentOffers(c);
  if (!c.contract) return;
  const cur = c.clubs[c.contract.club];
  const loaned = !!c.contract.loan;
  const wants = c.flags.wantsMove ? 0.25 : 0;
  const yrsLeft = c.contract.until - c.season;
  const candidates = Object.values(c.clubs).filter((k) => k.id !== c.contract!.club && k.id !== c.contract!.loan?.parent);
  const scored = candidates.map((k) => ({ k, s: interest(c, k) + (k.rep > (cur?.rep ?? 0) ? 0.05 : -0.1) + rand(-0.25, 0.25) + wants })).sort((a, b) => b.s - a.s);
  let made = 0;
  for (const { k, s } of scored.slice(0, 18)) {
    if (made >= 2 || c.offers.filter((o) => o.status === 'open').length >= 3) break;
    if (s < 0.35) continue;
    if (c.offers.some((o) => o.club === k.id && o.status === 'open')) continue;
    if (loaned) continue;
    const o = makeOffer(c, k, 'transfer');
    // your club's answer to the bid: they rarely sell a key player cheaply mid-contract
    const myVal = marketValue(c);
    const keep = cur ? ROLE_RANK[c.contract.role] * 0.12 + (yrsLeft >= 2 ? 0.12 : -0.15) + (cur.rep > k.rep ? 0.15 : -0.05) : 0;
    o.clubOk = o.fee >= c.contract.clause || Math.random() > keep + 0.25 + (o.fee < myVal ? 0.2 : 0);
    if (o.fee >= c.contract.clause) o.note = L2('Release clause met', 'Serbest kalma bedeli karşılandı');
    c.offers.push(o);
    made++;
    dm(c, 'agent', agentName(c), o.clubOk
      ? L2(`${k.name} have bid ${money(o.fee)} for you and ${clubName(c, c.contract.club)} accepted. They're offering ${money(o.wage)}/week as a ${roleName(o.role)}. Want to talk terms?`, `${k.name} senin için ${money(o.fee)} teklif etti ve ${clubName(c, c.contract.club)} kabul etti. ${roleName(o.role)} rolüyle haftalık ${money(o.wage)} öneriyorlar. Şartları konuşalım mı?`)
      : L2(`${k.name} bid ${money(o.fee)}, but ${clubName(c, c.contract.club)} rejected it. You could push for the move… it won't make you popular here.`, `${k.name} ${money(o.fee)} teklif etti ama ${clubName(c, c.contract.club)} reddetti. Transferi zorlayabilirsin… burada pek sevilmezsin.`),
      { data: { offer: o.id } });
    rumour(c, k, o.clubOk ? 4 : 3);
  }
  // young, not playing: loan offers
  const played = c.log.filter((l) => l.season === c.season && !l.nat).length;
  if (!loaned && c.me.age <= 22 && c.contract.role === 'prospect' && c.week >= 14 && played < 6 && Math.random() < 0.8) {
    const lower = scored.map((x) => x.k).filter((k) => k.div === 2 || k.rep < (cur?.rep ?? 50) - 15).slice(0, 4);
    const k = pick(lower.length ? lower : scored.map((x) => x.k));
    if (k && !c.offers.some((o) => o.club === k.id && o.status === 'open')) {
      const o = makeOffer(c, k, 'loan');
      o.role = 'starter';
      o.clubOk = true;
      c.offers.push(o);
      dm(c, 'agent', agentName(c), L2(`You need minutes. ${k.name} want you on loan for the rest of the season as a starter. Your club is open to it.`, `Süre alman lazım. ${k.name} seni sezon sonuna kadar kiralık ve ilk 11 oyuncusu olarak istiyor. Kulübün buna sıcak bakıyor.`), { data: { offer: o.id } });
    }
  }
}

function freeAgentOffers(c: Career) {
  const scored = Object.values(c.clubs).map((k) => ({ k, s: interest(c, k) + rand(-0.2, 0.3) })).sort((a, b) => b.s - a.s);
  let n = 0;
  for (const { k } of scored) {
    if (n >= 3) break;
    if (c.offers.some((o) => o.club === k.id && o.status === 'open')) continue;
    const o = makeOffer(c, k, 'free');
    o.clubOk = true;
    o.expires = c.week + 3;
    c.offers.push(o);
    n++;
  }
  dm(c, 'agent', agentName(c), L2('You\'re a free agent. The phone hasn\'t stopped ringing: check your offers.', 'Serbest oyuncusun. Telefon susmuyor: tekliflerine bak.'));
}

/** Your club offers a new deal (contract ending, or you outgrew it). */
export function renewalCheck(c: Career) {
  if (!c.contract || c.contract.loan) return;
  const yrsLeft = c.contract.until - c.season;
  const k = c.clubs[c.contract.club];
  const deserved = roleFor(c, k.id);
  const outgrew = ROLE_RANK[deserved] > ROLE_RANK[c.contract.role] && c.contract.wage < wageFor(c, k, deserved) * 0.7;
  if ((yrsLeft <= 0 && c.week >= 10) || (outgrew && c.week % 9 === 4)) {
    if (c.offers.some((o) => o.kind === 'renewal' && o.status === 'open')) return;
    const o = makeOffer(c, k, 'renewal');
    o.role = deserved;
    o.wage = Math.max(c.contract.wage, wageFor(c, k, deserved));
    o.clubOk = true;
    o.expires = c.week + 4;
    c.offers.push(o);
    dm(c, 'club', k.name, L2(`The board would like to offer you a new contract: ${money(o.wage)}/week, ${o.years} years, ${roleName(o.role)}.`, `Yönetim sana yeni bir sözleşme önermek istiyor: haftalık ${money(o.wage)}, ${o.years} yıl, ${roleName(o.role)}.`), { data: { offer: o.id } });
  }
}

export function expireOffers(c: Career) {
  for (const o of c.offers) if (o.status === 'open' && c.week > o.expires && c.phase === 'season') o.status = 'expired';
  c.offers = c.offers.filter((o) => o.status === 'open' || (o.status === 'signed' && c.week - o.expires < 4));
}

export function openOffers(c: Career) {
  return c.offers.filter((o) => o.status === 'open');
}

/** Agent read on how far a club will go. */
export function agentHint(o: Offer) {
  const room = o.maxWage / o.wage;
  if (room > 1.35) return L2('"They have room. Push them."', '"Esneme payları var. Zorla."');
  if (room > 1.18) return L2('"There\'s a bit more in it."', '"Biraz daha çıkarlar."');
  return L2('"This is close to their limit."', '"Bu, sınırlarına yakın."');
}

export interface Ask {
  wage: number;
  years: number;
  role: Role;
  clause: number;
}

/** Counter-offer. Returns 'accept' | 'counter' | 'walk'. */
export function negotiate(c: Career, o: Offer, ask: Ask): 'accept' | 'counter' | 'walk' {
  o.round++;
  const k = c.clubs[o.club];
  const deserved = roleFor(c, k.id);
  const roleGap = ROLE_RANK[ask.role] - ROLE_RANK[deserved];
  const wageOver = ask.wage / o.maxWage;
  const clauseLow = ask.clause < o.clause * 0.8 ? (o.clause * 0.8 - ask.clause) / o.clause : 0;
  let risk = Math.max(0, wageOver - 1) * 3 + Math.max(0, roleGap) * 0.45 + clauseLow * 1.2 + (ask.years !== o.years ? 0.05 : 0);
  risk -= c.me.rel.agent / 400;
  if (risk <= 0.05) {
    Object.assign(o, ask);
    return 'accept';
  }
  o.patience -= risk > 0.6 ? 2 : 1;
  if (o.patience <= 0) {
    o.status = 'rejected';
    return 'walk';
  }
  // they meet you part of the way
  o.wage = Math.round(Math.min(o.maxWage, (o.wage + ask.wage) / 2) / 50) * 50;
  if (roleGap <= 1 && Math.random() < 0.5) o.role = ROLE_RANK[ask.role] > ROLE_RANK[o.role] ? (['prospect', 'rotation', 'starter', 'star'] as Role[])[Math.min(3, ROLE_RANK[o.role] + 1)] : o.role;
  o.clause = Math.round(((o.clause + ask.clause) / 2) / 100000) * 100000;
  o.years = ask.years;
  return 'counter';
}

/** Sign the offer: move clubs, new contract, media. */
export function signOffer(c: Career, o: Offer) {
  const from = c.contract?.club;
  const k = c.clubs[o.club];
  o.status = 'signed';
  if (o.kind === 'renewal') {
    c.contract = { ...c.contract!, wage: o.wage, until: c.season + o.years - (c.week > 20 ? 0 : 1), role: o.role, clause: o.clause, goalBonus: o.goalBonus };
    c.me.rel.manager += 5;
    c.me.rel.fans += 4;
    eventPost(c, 'renewal', { years: o.years });
  } else if (o.kind === 'loan') {
    const parent = c.contract!;
    c.contract = { club: o.club, wage: o.wage, until: c.season, role: o.role, clause: 0, goalBonus: o.goalBonus, loan: { parent: parent.club, until: parent.until } };
    c.me.rel.manager = 55;
    c.me.rel.mates = 50;
    c.me.rel.fans = 50;
    eventPost(c, 'loan', { club: k.name, clubId: k.id });
  } else {
    if (from && o.fee > 0) {
      c.clubs[from].budget += o.fee;
      k.budget -= o.fee;
    }
    c.contract = { club: o.club, wage: o.wage, until: c.season + o.years - (c.phase === 'offseason' || c.week === 0 ? 1 : 0), role: o.role, clause: o.clause, goalBonus: o.goalBonus };
    c.me.rel.manager = 55;
    c.me.rel.mates = c.me.personality === 'leader' ? 56 : 50;
    c.me.rel.fans = 52 + Math.round(c.me.rep / 6);
    c.me.captain = false;
    c.flags.wantsMove = 0;
    eventPost(c, 'signing', { club: k.name, clubId: k.id, fee: o.fee ? money(o.fee) : L2('Free transfer', 'Bonservissiz'), years: o.years });
  }
  // one shirt number per squad
  const taken = new Set(squadOf(c, o.club).filter((p) => p.id !== 'me').map((p) => c.npcs[p.id]?.num));
  if (taken.has(c.me.num)) {
    for (const n of [c.me.num + 10, 7, 10, 9, 11, 17, 19, 21, 22, 27, 77, 99]) if (!taken.has(n) && n < 100) { c.me.num = n; break; }
  }
  for (const x of c.offers) if (x.status === 'open' && x !== o) x.status = 'expired';
}

/** Loan finished: back to the parent club. */
export function endLoan(c: Career) {
  const ct = c.contract;
  if (!ct?.loan) return;
  const parent = ct.loan.parent;
  c.contract = { club: parent, wage: Math.round(ct.wage * 2), until: ct.loan.until, role: roleFor(c, parent), clause: Math.round(marketValue(c) * 2.5), goalBonus: ct.goalBonus };
  dm(c, 'club', c.clubs[parent].name, L2('Your loan is over. Welcome back: the manager has followed your progress closely.', 'Kiralık dönemin bitti. Tekrar hoş geldin: hoca gelişimini yakından takip etti.'));
}

// ------------------------------------------------------------------ rumours & NPC market

function rumour(c: Career, k: Club, rel: number) {
  const j = pick(JOURNALISTS.filter((x) => Math.abs(x[2] - rel) <= 1));
  const me = c.me;
  const v = { full: me.name, club: k.name };
  const text = rel >= 4
    ? L2(`${k.name} have made a concrete bid for ${me.name}. Talks are ongoing. 🔴 Exclusive`, `${k.name}, ${me.name} için somut bir teklif yaptı. Görüşmeler sürüyor. 🔴 Özel`)
    : L2(`Hearing ${k.name} are monitoring ${me.name} closely. One to watch 👀`, `${k.name}'ın ${me.name}'ı yakından takip ettiğini duyuyorum. Takipte kalın 👀`);
  void v;
  addPost(c, {
    id: nextId('po'), name: j[0], handle: j[1], verified: j[2] >= 3, av: 'c:#3a4766', text, likes: Math.round(me.followers * 0.04 + 300 * rel), reposts: 0, replies: [], replyCount: Math.round(me.followers * 0.004 + 40),
    week: c.week, season: c.season, t: 5, mood: 0.3,
  });
  headline(c, { kind: 'rumour', rel: j[2], title: L2(`${k.name} chase ${me.name}`, `${k.name}, ${me.name}'ın peşinde`), sub: L2(`Source: ${j[0]}`, `Kaynak: ${j[0]}`), pic: k.id });
}

/** A few NPC transfers each window so the world keeps moving. */
export function npcWindow(c: Career) {
  const clubs = Object.values(c.clubs);
  const moves = Math.floor(rand(5, 10));
  for (let i = 0; i < moves; i++) {
    const buyer = pick(clubs.filter((k) => k.rep > 55));
    const pool = Object.values(c.npcs).filter((p) => p.club && p.club !== buyer.id && c.clubs[p.club] && c.clubs[p.club].rep < buyer.rep && p.ovr > teamStrength(c, buyer.id) - 2 && p.age < 31 && p.id !== c.nemesis);
    if (!pool.length) continue;
    const p = pick(pool);
    const seller = c.clubs[p.club!];
    // the buyer lets its weakest player of that position go
    const out = buyer.squad.map((id) => c.npcs[id]).filter((q) => q && q.pos === p.pos).sort((a, b) => a.ovr - b.ovr)[0];
    seller.squad = seller.squad.filter((id) => id !== p.id);
    buyer.squad.push(p.id);
    p.club = buyer.id;
    if (out) {
      buyer.squad = buyer.squad.filter((id) => id !== out.id);
      seller.squad.push(out.id);
      out.club = seller.id;
    } else {
      const y = makeNPC(seller.nat, p.pos, p.ovr - 6, 18, seller.id);
      c.npcs[y.id] = y;
      seller.squad.push(y.id);
    }
    const fee = Math.round(Math.pow(Math.max(1, p.ovr - 45), 3) * 90 / 100000) * 100000;
    if (Math.random() < 0.45) {
      const o = pick(OUTLETS);
      addPost(c, {
        id: nextId('po'), name: o.name, handle: o.handle, verified: true, av: 'c:' + o.color,
        text: L2(`✅ OFFICIAL: ${p.name} joins ${buyer.name} from ${seller.name} (${money(fee)}).`, `✅ RESMİ: ${p.name}, ${seller.name}'dan ${buyer.name}'a transfer oldu (${money(fee)}).`),
        likes: Math.round(500 + buyer.rep * 40 * rand(0.5, 1.5)), reposts: 0, replies: [], replyCount: Math.round(rand(20, 300)), week: c.week, season: c.season, t: 30 + i,
        media: { kind: 'transfer', data: { club: buyer.id, fee: money(fee), npc: p.id } },
      });
    }
  }
}

export function offerTitle(c: Career, o: Offer) {
  const kind = { transfer: L2('Transfer', 'Transfer'), loan: L2('Loan', 'Kiralık'), renewal: L2('New contract', 'Yeni sözleşme'), free: L2('Free agent offer', 'Serbest oyuncu teklifi'), trial: L2('Academy offer', 'Altyapı teklifi') }[o.kind];
  return `${kind} · ${clubName(c, o.club)}`;
}

export const divLabel = (c: Career, clubId: string) => {
  const k = c.clubs[clubId];
  if (!k) return '';
  const lg = c.comps.find((x) => x.kind === 'league' && x.teams.includes(clubId));
  return lg ? LP(lg.name) : '';
};

export { clamp };
