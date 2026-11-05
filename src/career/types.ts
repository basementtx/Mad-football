/** Career mode save data. Everything lives in one JSON blob (localStorage 'mf.career'). */
import type { CardLook, Stats, StatKey } from '../meta/cards';
import type { KitPattern, CrestCfg } from '../game/teams';
import type { Difficulty } from '../game/entities';

export type NPos = 'GK' | 'DEF' | 'MID' | 'FWD';
export type MyPos = 'DEF' | 'MID' | 'FWD';
export type CompKind = 'league' | 'cup' | 'cont' | 'intl' | 'trial';
export type Role = 'prospect' | 'rotation' | 'starter' | 'star';
export type Personality = 'humble' | 'confident' | 'showman' | 'leader';
export type Backstory = 'street' | 'academy' | 'smalltown' | 'latebloomer';

export interface SeasonLine {
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  /** sum of match ratings (avg = rsum / apps) */
  rsum: number;
  motm: number;
}

export interface NPC {
  id: string;
  name: string;
  nat: string;
  pos: NPos;
  age: number;
  ovr: number;
  pot: number;
  club: string | null;
  num: number;
  s: SeasonLine;
  /** career totals (for awards / legends) */
  cg: number;
  ca: number;
}

export interface Club {
  id: string;
  name: string;
  short: string;
  nat: string;
  div: 1 | 2;
  /** prestige 1..100 */
  rep: number;
  primary: string;
  secondary: string;
  shorts: string;
  pattern: KitPattern;
  crest: CrestCfg;
  stadium: string;
  nick: [string, string];
  rival: string | null;
  manager: string;
  /** player ids (NPCs); the user is not in this list */
  squad: string[];
  /** transfer budget (euros) */
  budget: number;
  /** handle on KICKR */
  handle: string;
}

export interface Row {
  id: string;
  p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number;
  form: string[];
}

export interface Fixture {
  id: string;
  comp: string;
  week: number;
  /** label key, e.g. 'R16', 'QF', 'SF', 'F', 'MD3', 'G1' */
  round: string;
  home: string;
  away: string;
  hg?: number;
  ag?: number;
  /** penalties winner when drawn in a knockout */
  pw?: string;
  played?: boolean;
  /** scorer npc ids (and 'me') */
  sc?: string[];
}

export interface Competition {
  id: string;
  kind: CompKind;
  nat?: string;
  div?: number;
  name: [string, string];
  teams: string[];
  table?: Row[];
  /** for group stages: team ids per group */
  groups?: string[][];
  groupTables?: Row[][];
  winner?: string;
  /** knockout: teams still in */
  alive?: string[];
  knockout?: boolean;
}

export type MsgFrom = 'agent' | 'manager' | 'mate' | 'club' | 'sponsor' | 'family' | 'nemesis' | 'national' | 'press';

export interface DMChoice {
  id: string;
  label: string;
}
export interface DM {
  id: string;
  thread: string;
  from: MsgFrom;
  name: string;
  text: string;
  week: number;
  season: number;
  mine?: boolean;
  read?: boolean;
  choices?: DMChoice[];
  /** action key resolved when a choice is picked */
  act?: string;
  data?: Record<string, unknown>;
}

export interface Reply {
  name: string;
  handle: string;
  text: string;
  likes: number;
  verified?: boolean;
  color?: string;
}

export interface Post {
  id: string;
  name: string;
  handle: string;
  verified?: boolean;
  /** avatar: 'me' | 'npc:<id>' | 'club:<id>' | 'c:<color>' */
  av: string;
  text: string;
  likes: number;
  reposts: number;
  replies: Reply[];
  replyCount: number;
  week: number;
  season: number;
  /** order within the week (for time-ago) */
  t: number;
  mine?: boolean;
  /** attached media card */
  media?: { kind: 'score' | 'rating' | 'transfer' | 'award' | 'stat' | 'injury' | 'callup' | 'photo' | 'clip' | 'poll' | 'quote' | 'meme' | 'compare' | 'graph' | 'odds' | 'board' | 'table' | 'milestone'; data: Record<string, string | number> };
  /** sentiment towards the user (-1..1) for the vibe meter */
  mood?: number;
  tag?: string;
}

// ------------------------------------------------------------------ KICKR 2.0

export type PersonaKind = 'ultra' | 'nerd' | 'doomer' | 'tactics' | 'parody' | 'itk' | 'odds' | 'pundit' | 'kid' | 'mum' | 'kickr';
export interface Persona { id: string; kind: PersonaKind; owner: string; name: string; handle: string; color: string; verified: boolean }
export interface KNotif { id: string; kind: 'like' | 'mention' | 'follow' | 'milestone' | 'quote' | 'trend'; text: string; week: number; season: number; seen?: boolean }
export interface KStorySlide { bg: string; big: string; text: string; sub: string }
export interface KStory { id: string; key: string; av: string; name: string; slides: KStorySlide[]; week: number; season: number; seen?: boolean }
export interface KickrState {
  /** template key -> absolute week (season*100+week) it was last used */
  used: Record<string, number>;
  personas: Persona[];
  arcs: { drought: number; streak: number; campaign: { tag: string; kind: 'pos' | 'neg'; since: number } | null; saga: { club: string; stage: number; since: number } | null; beef: number; milestones: number[] };
  /** post id -> option you voted for */
  polls: Record<string, number>;
  notifs: KNotif[];
  stories: KStory[];
  liked: string[];
  seen: number;
}

export interface Headline {
  id: string;
  week: number;
  season: number;
  title: string;
  sub: string;
  kind: 'match' | 'transfer' | 'rumour' | 'award' | 'injury' | 'league' | 'feature' | 'intl';
  /** rumour reliability 1..5 */
  rel?: number;
  big?: boolean;
  /** club or nation for the picture */
  pic?: string;
}

export interface Contract {
  club: string;
  wage: number;
  /** last season of the contract (inclusive) */
  until: number;
  role: Role;
  clause: number;
  /** bonus per goal */
  goalBonus: number;
  loan?: { parent: string; until: number };
}

export interface Offer {
  id: string;
  club: string;
  kind: 'transfer' | 'loan' | 'renewal' | 'free' | 'trial';
  fee: number;
  wage: number;
  years: number;
  role: Role;
  clause: number;
  goalBonus: number;
  /** club accepted the bid (your club, for a transfer) */
  clubOk?: boolean;
  /** the buying club's hidden ceiling for the wage */
  maxWage: number;
  patience: number;
  /** negotiation round */
  round: number;
  status: 'open' | 'accepted' | 'rejected' | 'expired' | 'signed';
  expires: number;
  note?: string;
}

export interface Injury {
  kind: string;
  weeks: number;
  total: number;
}

export interface MatchLog {
  season: number;
  week: number;
  comp: string;
  opp: string;
  home: boolean;
  gf: number;
  ga: number;
  rating: number;
  goals: number;
  assists: number;
  sim: boolean;
  sub?: boolean;
  motm?: boolean;
  /** played for the national team */
  nat?: boolean;
}

export interface SeasonRecord {
  season: number;
  age: number;
  club: string;
  div: number;
  nat: string;
  ovr: number;
  apps: number;
  goals: number;
  assists: number;
  avg: number;
  motm: number;
  leaguePos: number;
  trophies: string[];
  awards: string[];
  value: number;
  intlApps: number;
  intlGoals: number;
}

export interface Trophy {
  season: number;
  key: string;
  name: [string, string];
  club: string;
}

export interface Award {
  season: number;
  key: string;
  name: [string, string];
}

export interface Moment {
  key: string;
  title: [string, string];
  sub: [string, string];
  season: number;
  week: number;
  icon: string;
}

export interface Relations {
  manager: number;
  mates: number;
  fans: number;
  agent: number;
  media: number;
  /** rivalry heat with the nemesis (0..100) */
  nemesis: number;
}

export interface Me {
  name: string;
  nat: string;
  pos: MyPos;
  foot: 'R' | 'L';
  num: number;
  age: number;
  /** birthday week in a season (age goes up at season start) */
  personality: Personality;
  backstory: Backstory;
  look: CardLook;
  stats: Stats;
  /** fractional stat progress */
  prog: Record<StatKey, number>;
  pot: number;
  /** scout's estimate window around the potential */
  potSeen: [number, number];
  xp: number;
  level: number;
  perkPts: number;
  perks: string[];
  form: number[];
  fitness: number;
  morale: number;
  sharpness: number;
  rep: number;
  followers: number;
  /** image: -100 (bad boy) .. 100 (role model) */
  image: number;
  money: number;
  injury: Injury | null;
  rel: Relations;
  owned: string[];
  sponsors: { id: string; until: number; posts: number }[];
  captain: boolean;
  /** national team status */
  capped: boolean;
  intlApps: number;
  intlGoals: number;
  retired: boolean;
}

export interface WeekState {
  trained: boolean;
  /** user fixture this week resolved */
  played: boolean;
  /** pending press conference id */
  press: string | null;
  /** the user's selection for this week's match */
  sel: 'start' | 'sub' | 'bench' | 'out' | null;
  objectives: Objective[];
}

export interface Objective {
  key: 'goal' | 'goals2' | 'assist' | 'rating7' | 'rating8' | 'win' | 'tackles3' | 'cleanish' | 'passes5' | 'shots3';
  done?: boolean;
}

export interface Career {
  v: number;
  id: string;
  season: number;
  week: number;
  /** weeks in the season plan (league season) */
  plan: string[];
  difficulty: Difficulty;
  duration: number;
  phase: 'trial' | 'season' | 'summer' | 'offseason' | 'retired';
  me: Me;
  contract: Contract | null;
  clubs: Record<string, Club>;
  npcs: Record<string, NPC>;
  comps: Competition[];
  fixtures: Fixture[];
  nemesis: string;
  agent: number;
  feed: Post[];
  news: Headline[];
  dms: DM[];
  offers: Offer[];
  log: MatchLog[];
  history: SeasonRecord[];
  trophies: Trophy[];
  awards: Award[];
  moments: Moment[];
  /** moments already shown (keys) */
  seen: string[];
  /** queued story moments to show */
  queue: Moment[];
  ws: WeekState;
  s: SeasonLine;
  /** market value history (one point per few weeks) */
  valueHist: { s: number; w: number; v: number }[];
  followHist: { s: number; w: number; v: number }[];
  /** trending hashtags this week */
  trends: { tag: string; n: number }[];
  /** national team squad (npc ids) when called up */
  natSquad: string[];
  /** counter for ids */
  seq: number;
  /** flags for one-off story beats */
  flags: Record<string, number>;
  /** main-profile rewards earned but not yet collected */
  rewards: { coins: number; note: string }[];
  /** last match summary for the post-match screen */
  last: LastMatch | null;
  stats: { goals: number; assists: number; apps: number; motm: number; hattricks: number; rsum: number };
  /** KICKR 2.0 memory, cast, arcs, polls, notifications, stories */
  kx?: KickrState;
}

export interface LastMatch {
  fixture: string;
  comp: string;
  opp: string;
  home: boolean;
  gf: number;
  ga: number;
  rating: number;
  goals: number;
  assists: number;
  sim: boolean;
  sel: 'start' | 'sub';
  breakdown: [string, number][];
  scorers: { name: string; team: 0 | 1; at: number; me?: boolean }[];
  objectives: Objective[];
  xp: number;
  motm: boolean;
  motmName: string;
  statDelta: Partial<Record<StatKey, number>>;
  injury: string | null;
  posted: boolean;
  pens?: { me: number; opp: number; won: boolean };
  nat?: boolean;
  line: { shots: number; onTarget: number; passOk: number; steals: number; knockdowns: number; lost: number };
}
