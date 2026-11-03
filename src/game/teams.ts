/** Pixel crest: outline shape + icon, coloured with the team colours. */
export interface CrestCfg {
  shape: number;
  icon: string;
}

export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'half' | 'sash' | 'chevron';

export interface TeamDef {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  shorts: string;
  socks: string;
  gk: string;
  pattern: KitPattern;
  /** 1..5 */
  pace: number;
  power: number;
  tackle: number;
  skill: number;
  crest: CrestCfg;
  names: string[];
}

export const TEAMS: TeamDef[] = [
  {
    id: 'volcano', name: 'Volcano FC', short: 'VOL', primary: '#e23a2e', secondary: '#1b1b1f', shorts: '#1b1b1f', socks: '#e23a2e', gk: '#ffcc2a',
    pattern: 'chevron', pace: 4, power: 5, tackle: 4, skill: 3, crest: { shape: 0, icon: 'flame' },
    names: ['Magma', 'Ashby', 'Pyro', 'Kral', 'Ember', 'Cinder', 'Blaze', 'Sorin', 'Volk'],
  },
  {
    id: 'thunder', name: 'Thunder United', short: 'THU', primary: '#ffd23f', secondary: '#13215e', shorts: '#13215e', socks: '#ffd23f', gk: '#3fe0a0',
    pattern: 'stripes', pace: 5, power: 3, tackle: 3, skill: 4, crest: { shape: 1, icon: 'bolt' },
    names: ['Bolt', 'Voltan', 'Raiko', 'Storm', 'Ozan', 'Flash', 'Jolt', 'Nimbus', 'Tesla'],
  },
  {
    id: 'frost', name: 'Frost City', short: 'FRO', primary: '#7fd3ff', secondary: '#ffffff', shorts: '#ffffff', socks: '#7fd3ff', gk: '#ff6a3d',
    pattern: 'hoops', pace: 3, power: 3, tackle: 3, skill: 5, crest: { shape: 3, icon: 'star' },
    names: ['Glacius', 'Bora', 'Yeti', 'Sleet', 'Kaan', 'Hail', 'Polar', 'Rime', 'Vex'],
  },
  {
    id: 'jungle', name: 'Jungle Kings', short: 'JUN', primary: '#21a85a', secondary: '#f5c400', shorts: '#0e3b22', socks: '#f5c400', gk: '#ff3fa4',
    pattern: 'sash', pace: 4, power: 4, tackle: 4, skill: 3, crest: { shape: 0, icon: 'crown' },
    names: ['Leo', 'Mamba', 'Simba', 'Arslan', 'Kong', 'Tusk', 'Panthro', 'Rex', 'Zulu'],
  },
  {
    id: 'neon', name: 'Neon Vipers', short: 'NEO', primary: '#ff2fa0', secondary: '#b6ff3b', shorts: '#1c0f2e', socks: '#b6ff3b', gk: '#3bd9ff',
    pattern: 'half', pace: 5, power: 2, tackle: 3, skill: 5, crest: { shape: 2, icon: 'skull' },
    names: ['Venom', 'Kobra', 'Glitch', 'Pixel', 'Neo', 'Fang', 'Hiss', 'Laser', 'Dex'],
  },
  {
    id: 'bulls', name: 'Iron Bulls', short: 'IRN', primary: '#6c7480', secondary: '#ff7a1a', shorts: '#2b2f36', socks: '#ff7a1a', gk: '#9dff4a',
    pattern: 'solid', pace: 2, power: 5, tackle: 5, skill: 2, crest: { shape: 3, icon: 'horns' },
    names: ['Tank', 'Boga', 'Anvil', 'Brick', 'Mauler', 'Demir', 'Hammer', 'Bruno', 'Ox'],
  },
  {
    id: 'ravens', name: 'Royal Ravens', short: 'RAV', primary: '#6b3fd6', secondary: '#d9dce6', shorts: '#2a1960', socks: '#6b3fd6', gk: '#ffd23f',
    pattern: 'stripes', pace: 4, power: 3, tackle: 4, skill: 4, crest: { shape: 1, icon: 'wing' },
    names: ['Corvin', 'Onyx', 'Kuzgun', 'Shade', 'Raven', 'Hugo', 'Talon', 'Noir', 'Cyrus'],
  },
  {
    id: 'scorpions', name: 'Desert Scorpions', short: 'SCO', primary: '#e0b46c', secondary: '#7a3b12', shorts: '#7a3b12', socks: '#e0b46c', gk: '#2fd0ff',
    pattern: 'hoops', pace: 3, power: 4, tackle: 5, skill: 3, crest: { shape: 2, icon: 'ball' },
    names: ['Sting', 'Akrep', 'Dune', 'Sahra', 'Mirage', 'Sandor', 'Rasp', 'Kalahari', 'Oasis'],
  },
];

export const teamRating = (t: TeamDef) => (t.pace + t.power + t.tackle + t.skill) / 4;
