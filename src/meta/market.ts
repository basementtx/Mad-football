/**
 * Transfer market: a rotating list of players for sale (quality depends on your
 * division), haggling with sellers, offers from other clubs for your own
 * players, deadline-day deals and a transfer ledger.
 */
import { CardData, CardRarity, overall, randomCard, rarityOf, uid, Pos } from './cards';
import { profile, saveProfile, autoLineup, cardById, LINEUP_SLOTS, coins, spendCoins, addCoins } from './profile';
import { league } from './league';
import { pick, rand, randInt, clamp } from '../engine/math';

export const SQUAD_MAX = 20;
export const SQUAD_MIN = LINEUP_SLOTS;
export const MARKET_SIZE = 12;
export const REFRESH_EVERY = 3 * 60 * 60 * 1000;
export const REFRESH_COST = 200;
export const MAX_ROUNDS = 3;

export type Tag = 'deadline' | 'bargain' | 'wonderkid' | 'veteran' | 'hot';

export interface Listing {
  id: string;
  card: CardData;
  age: number;
  from: string; // selling club
  value: number; // what he is really worth
  price: number; // asking price
  tags: Tag[];
  /** hidden: lowest share of the asking price the seller accepts */
  floor: number;
  /** haggling */
  rounds: number;
  counter: number | null;
  closed: boolean;
  sold: boolean;
  /** deadline deals expire */
  until?: number;
}

export interface Offer {
  id: string;
  cardId: string;
  club: string;
  amount: number;
}

export interface LedgerEntry {
  at: number;
  kind: 'in' | 'out';
  name: string;
  ovr: number;
  pos: Pos;
  price: number;
  club: string;
}

export interface Market {
  v: number;
  listings: Listing[];
  offers: Offer[];
  refreshAt: number;
  ledger: LedgerEntry[];
  ages: Record<string, number>;
}

const KEY = 'mf.market';

function load(): Market | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Market;
  } catch {
    /* ignore */
  }
  return null;
}

export let market: Market = load() ?? { v: 1, listings: [], offers: [], refreshAt: 0, ledger: [], ages: {} };

export function saveMarket() {
  try {
    localStorage.setItem(KEY, JSON.stringify(market));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- values

/** Market value of a player: grows steeply with OVR, young players cost more, veterans less. */
export function valueOf(c: CardData, age = 25) {
  const o = overall(c);
  let v = 120 + Math.pow(Math.max(0, o - 48), 2) * 3.1;
  if (age <= 21) v *= 1.18;
  else if (age >= 32) v *= 0.72;
  else if (age >= 29) v *= 0.9;
  return Math.round(v / 10) * 10;
}

export const ageOf = (c: CardData) => market.ages[c.id] ?? 25;

/** Quick-sale price (no buyer needed). */
export const quickSaleOf = (c: CardData) => Math.round((valueOf(c, ageOf(c)) * 0.5) / 10) * 10;

const CLUBS_FALLBACK = ['Rocket FC', 'Iron City', 'Neon Rovers', 'Storm United', 'Blaze Athletic', 'Frost Dynamo', 'Golden Rangers', 'Cobalt Albion'];
function clubNames() {
  const names = league?.teams?.map((t) => t.name).filter(Boolean) ?? [];
  return names.length ? names : CLUBS_FALLBACK;
}

/** Rarity odds of the market by division (5 = lowest). */
const DIV_ODDS: Record<number, Partial<Record<CardRarity, number>>> = {
  5: { bronze: 50, silver: 38, gold: 11, hero: 1 },
  4: { bronze: 30, silver: 45, gold: 22, hero: 3 },
  3: { bronze: 12, silver: 40, gold: 38, hero: 9, legend: 1 },
  2: { silver: 28, gold: 47, hero: 21, legend: 4 },
  1: { silver: 12, gold: 48, hero: 32, legend: 8 },
};

function weighted<K extends string>(odds: Partial<Record<K, number>>): K {
  const e = Object.entries(odds) as [K, number][];
  let r = Math.random() * e.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of e) if ((r -= w) <= 0) return k;
  return e[e.length - 1][0];
}

function makeListing(deadline = false): Listing {
  const div = league?.div ?? 5;
  const card = randomCard(weighted(DIV_ODDS[div] ?? DIV_ODDS[5]));
  const roll = Math.random();
  const age = roll < 0.18 ? randInt(18, 21) : roll > 0.85 ? randInt(31, 35) : randInt(22, 30);
  const value = valueOf(card, age);
  const tags: Tag[] = [];
  let price = value * rand(0.95, 1.3);
  if (deadline) {
    price = value * rand(0.62, 0.75);
    tags.push('deadline');
  } else if (Math.random() < 0.18) {
    price = value * rand(0.78, 0.9);
    tags.push('bargain');
  }
  if (age <= 21) tags.push('wonderkid');
  if (age >= 32) tags.push('veteran');
  const r = rarityOf(card);
  if (r === 'hero' || r === 'legend') tags.push('hot');
  price = Math.round(price / 10) * 10;
  return {
    id: uid(),
    card,
    age,
    from: pick(clubNames()),
    value,
    price,
    tags,
    // sellers of bargains / deadline deals don't move much; others have some room
    floor: deadline ? 0.97 : tags.includes('bargain') ? rand(0.9, 0.97) : rand(0.76, 0.92),
    rounds: 0,
    counter: null,
    closed: false,
    sold: false,
    until: deadline ? Date.now() + 25 * 60 * 1000 : undefined,
  };
}

/** Offers from other clubs for your reserves and starters. */
function makeOffers() {
  const mine = profile.cards.filter((c) => !c.custom);
  const offers: Offer[] = [];
  const n = Math.min(mine.length, randInt(1, 3));
  const pool = [...mine].sort(() => Math.random() - 0.5).slice(0, n);
  for (const c of pool) {
    const v = valueOf(c, ageOf(c));
    offers.push({ id: uid(), cardId: c.id, club: pick(clubNames()), amount: Math.round((v * rand(0.65, 1.05)) / 10) * 10 });
  }
  return offers;
}

/** Make sure every squad card has an age (older saves / crate cards). */
function ensureAges() {
  for (const c of profile.cards) if (market.ages[c.id] === undefined) market.ages[c.id] = c.custom ? 22 : randInt(19, 32);
}

export function refreshMarket(paid = false, free = false): boolean {
  if (paid && !free && !spendCoins(REFRESH_COST)) return false;
  ensureAges();
  const listings: Listing[] = [];
  for (let i = 0; i < MARKET_SIZE - 2; i++) listings.push(makeListing());
  listings.push(makeListing(true), makeListing(true));
  listings.sort((a, b) => overall(b.card) - overall(a.card));
  market.listings = listings;
  market.offers = makeOffers();
  market.refreshAt = Date.now() + REFRESH_EVERY;
  saveMarket();
  return true;
}

/** Called whenever the market opens: refresh on schedule, drop expired deadline deals. */
export function tickMarket() {
  ensureAges();
  if (!market.listings.length || Date.now() >= market.refreshAt) refreshMarket();
  const now = Date.now();
  for (const l of market.listings) if (l.until && now > l.until && !l.sold) l.closed = true;
  // offers for players you no longer have disappear
  market.offers = market.offers.filter((o) => cardById(o.cardId));
  saveMarket();
}

// ---------------------------------------------------------------- buying

export type BuyResult = 'ok' | 'coins' | 'full' | 'closed';

function sign(l: Listing, price: number): BuyResult {
  if (l.closed || l.sold) return 'closed';
  if (profile.cards.length >= SQUAD_MAX) return 'full';
  if (coins() < price) return 'coins';
  spendCoins(price);
  const card = { ...l.card, id: uid() };
  profile.cards.push(card);
  market.ages[card.id] = l.age;
  l.sold = true;
  market.ledger.unshift({ at: Date.now(), kind: 'in', name: card.name, ovr: overall(card), pos: card.pos, price, club: l.from });
  market.ledger = market.ledger.slice(0, 40);
  autoLineup();
  saveProfile();
  saveMarket();
  return 'ok';
}

export const buyNow = (l: Listing) => sign(l, l.counter ?? l.price);

export type OfferReply = { kind: 'accept' | 'counter' | 'walk' | 'insult'; amount: number; result?: BuyResult };

/** Haggle: the seller accepts, counters, or walks away after too many rounds / an insulting bid. */
export function makeOffer(l: Listing, amount: number): OfferReply {
  if (l.closed || l.sold) return { kind: 'walk', amount: 0 };
  const ratio = amount / l.price;
  l.rounds++;
  if (ratio < 0.55) {
    // insulting: the seller loses patience faster
    l.rounds++;
    if (l.rounds >= MAX_ROUNDS) l.closed = true;
    saveMarket();
    return { kind: l.closed ? 'walk' : 'insult', amount: l.counter ?? l.price };
  }
  if (ratio >= l.floor) {
    const result = sign(l, amount);
    return { kind: 'accept', amount, result };
  }
  if (l.rounds >= MAX_ROUNDS) {
    l.closed = true;
    saveMarket();
    return { kind: 'walk', amount: 0 };
  }
  // counter somewhere between the floor and the last counter / asking price
  const prev = l.counter ?? l.price;
  const target = l.price * l.floor;
  const counter = Math.round(clamp((prev + Math.max(amount, target)) / 2, target, prev) / 10) * 10;
  l.counter = counter;
  saveMarket();
  return { kind: 'counter', amount: counter };
}

// ---------------------------------------------------------------- selling

export type SellBlock = null | 'custom' | 'min';
export function sellBlock(c: CardData): SellBlock {
  if (c.custom || c.id === profile.myPlayer) return 'custom';
  if (profile.cards.length <= SQUAD_MIN) return 'min';
  return null;
}

function release(c: CardData, price: number, club: string) {
  profile.cards = profile.cards.filter((x) => x.id !== c.id);
  profile.lineup = profile.lineup.map((id) => (id === c.id ? '' : id));
  addCoins(price);
  market.offers = market.offers.filter((o) => o.cardId !== c.id);
  market.ledger.unshift({ at: Date.now(), kind: 'out', name: c.name, ovr: overall(c), pos: c.pos, price, club });
  market.ledger = market.ledger.slice(0, 40);
  delete market.ages[c.id];
  autoLineup();
  saveProfile();
  saveMarket();
}

export function quickSell(c: CardData): boolean {
  if (sellBlock(c)) return false;
  release(c, quickSaleOf(c), '—');
  return true;
}

export function acceptOffer(o: Offer): boolean {
  const c = cardById(o.cardId);
  if (!c || sellBlock(c)) return false;
  release(c, o.amount, o.club);
  return true;
}

export function rejectOffer(o: Offer) {
  market.offers = market.offers.filter((x) => x.id !== o.id);
  saveMarket();
}

/** Best OVR you already have at a position (for the scout comparison). */
export function bestAt(pos: Pos) {
  let best = 0;
  for (const c of profile.cards) if (c.pos === pos) best = Math.max(best, overall(c));
  return best;
}
