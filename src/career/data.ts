/**
 * Career world data: nations, name pools, towns, club naming, accounts, sponsors.
 * Everything here is original: the clubs, towns, outlets and people are invented.
 */
export interface Nation {
  code: string;
  en: string;
  tr: string;
  /** strength of the national pool 1..5 */
  str: number;
  /** has a domestic league in the career world */
  league: boolean;
  first: string[];
  last: string[];
  towns?: string[];
  /** club name patterns, {T} = town */
  clubFmt?: string[];
  leagueName?: [string, string];
  cupName?: string;
  /** handle-ish words fans of this country use */
  fanWords?: string[];
}

export const NATIONS: Nation[] = [
  {
    code: 'en', en: 'England', tr: 'İngiltere', str: 4.4, league: true,
    first: ['Jack', 'Harry', 'Oliver', 'Charlie', 'George', 'Alfie', 'Callum', 'Reece', 'Mason', 'Kieran', 'Declan', 'Tyler', 'Jamie', 'Connor', 'Lewis', 'Ollie', 'Ethan', 'Ryan'],
    last: ['Whitlock', 'Ashworth', 'Barrow', 'Penfold', 'Haverly', 'Cottam', 'Brierley', 'Fenwick', 'Hollins', 'Thackery', 'Ridley', 'Marsden', 'Kettering', 'Oakes', 'Pember', 'Stanton', 'Wexley', 'Crowther'],
    towns: ['Blackmoor', 'Ravenhill', 'Eastbury', 'Holloway', 'Kingsmere', 'Ashcombe', 'Thornbury', 'Westford', 'Millbrook', 'Harrowgate', 'Dunmore', 'Bramwell', 'Stonebridge', 'Fairhaven', 'Calder', 'Wickham', 'Northam', 'Ironbridge', 'Saltmarsh', 'Redcliffe'],
    clubFmt: ['{T} United', '{T} City', '{T} Rovers', '{T} Athletic', '{T} Town', '{T} Albion', '{T} Wanderers', '{T} FC'],
    leagueName: ['Premier Division', 'Championship Division'], cupName: 'Crown Cup',
    fanWords: ['lad', 'fc', 'til_i_die', 'away_days', 'barmy', 'terrace'],
  },
  {
    code: 'es', en: 'Spain', tr: 'İspanya', str: 4.5, league: true,
    first: ['Álvaro', 'Iker', 'Pablo', 'Sergio', 'Javi', 'Dani', 'Marcos', 'Hugo', 'Rubén', 'Adrián', 'Nico', 'Raúl', 'Unai', 'Mario', 'Óscar', 'Diego', 'Íñigo', 'Pau'],
    last: ['Valcárcel', 'Montoya', 'Iturbe', 'Salcedo', 'Barrenechea', 'Quintana', 'Ferrán', 'Lozada', 'Arriaga', 'Mendaro', 'Robledo', 'Castañer', 'Ugalde', 'Peñalver', 'Soler', 'Navarrete', 'Garrido', 'Olmedo'],
    towns: ['Valdemora', 'Puerto Sol', 'Montenegra', 'Altamira', 'San Lorenzo', 'Villaclara', 'Costabrava', 'Torreblanca', 'Las Dunas', 'Rioseco', 'Peñalta', 'Marbellón', 'Sierralta', 'Almenar', 'Castellana', 'Valdeoro', 'Cabo Verde', 'Monteluz', 'Arenal', 'Fuenteroja'],
    clubFmt: ['Real {T}', 'CD {T}', '{T} CF', 'Atlético {T}', 'UD {T}', 'Racing {T}', 'Deportivo {T}', 'SD {T}'],
    leagueName: ['Primera Mad', 'Segunda Mad'], cupName: 'Copa del Sol',
    fanWords: ['ole', 'afición', 'hala', 'vamos', 'grada', 'peña'],
  },
  {
    code: 'it', en: 'Italy', tr: 'İtalya', str: 4.3, league: true,
    first: ['Lorenzo', 'Matteo', 'Federico', 'Alessandro', 'Davide', 'Giacomo', 'Riccardo', 'Tommaso', 'Nicolò', 'Andrea', 'Gianluca', 'Simone', 'Marco', 'Filippo', 'Luca', 'Pietro', 'Emanuele', 'Stefano'],
    last: ['Bellandi', 'Castoro', 'Ferraresi', 'Gualtieri', 'Mancuso', 'Orsatti', 'Pellegrino', 'Rinaldi', 'Sartori', 'Testa', 'Vianello', 'Zanetto', 'Accardi', 'Bonfanti', 'Cecconi', 'Di Lauro', 'Esposti', 'Marchetto'],
    towns: ['Castelverde', 'Portoalto', 'Valfiorita', 'Montecalvo', 'San Vitale', 'Roccabianca', 'Lagonero', 'Torrazza', 'Bellaria', 'Fontebella', 'Pietrasanta', 'Collemare', 'Acquaviva', 'Borgoforte', 'Serravalle', 'Campolungo', 'Vallerosa', 'Marinella', 'Castelluce', 'Torrebruna'],
    clubFmt: ['AC {T}', '{T} Calcio', 'US {T}', 'Sporting {T}', 'Virtus {T}', 'Real {T}', 'AS {T}', 'FC {T}'],
    leagueName: ['Serie Mad', 'Serie Mad B'], cupName: 'Coppa Tricolore',
    fanWords: ['forza', 'ultras', 'curva', 'tifoso', 'sempre', 'amore'],
  },
  {
    code: 'tr', en: 'Türkiye', tr: 'Türkiye', str: 3.9, league: true,
    first: ['Arda', 'Kerem', 'Emre', 'Burak', 'Mert', 'Yusuf', 'Barış', 'Ozan', 'Kaan', 'Efe', 'Can', 'Oğuz', 'Berk', 'Tolga', 'Umut', 'Serkan', 'Doruk', 'Alp'],
    last: ['Yıldırım', 'Karadağ', 'Aksoy', 'Erdem', 'Kocabaş', 'Tunç', 'Özkaya', 'Sarıgül', 'Demirkol', 'Akın', 'Bozkurt', 'Ertuğrul', 'Kalkan', 'Yalçın', 'Taşdelen', 'Gündoğ', 'Çetinel', 'Uysal'],
    towns: ['Karakaya', 'Akyaka', 'Gökova', 'Yeşilırmak', 'Kızılcahamam', 'Demirtepe', 'Karasu', 'Akçadağ', 'Kuzeyköy', 'Ilgaz', 'Sarıyurt', 'Dumanlı', 'Gölbaşı', 'Kayalar', 'Yamaçlı', 'Taşköprü', 'Altınova', 'Kartaltepe', 'Ormanlı', 'Boğaziçi'],
    clubFmt: ['{T}spor', '{T} SK', '{T} FK', '{T} Gençlik', '{T} Belediyespor', '{T} İdman Yurdu', '{T} Gücü', '{T} 1923'],
    leagueName: ['Mad Süper Lig', 'Mad 1. Lig'], cupName: 'Hilal Kupası',
    fanWords: ['tribün', 'aşkı', 'sevdası', 'kartal', 'ultra', 'şampiyon'],
  },
  {
    code: 'de', en: 'Germany', tr: 'Almanya', str: 4.4, league: false,
    first: ['Lukas', 'Jonas', 'Leon', 'Felix', 'Niklas', 'Moritz', 'Tim', 'Julian', 'Florian', 'Maximilian', 'Kai', 'Jannik'],
    last: ['Brenner', 'Holtmann', 'Kessler', 'Lindqvist', 'Pfeiffer', 'Reinholt', 'Schaller', 'Vogelsang', 'Winterberg', 'Ahlers', 'Dornbach', 'Falkner'],
  },
  {
    code: 'fr', en: 'France', tr: 'Fransa', str: 4.6, league: false,
    first: ['Hugo', 'Lucas', 'Théo', 'Antoine', 'Kylian', 'Mathis', 'Rayan', 'Nathan', 'Enzo', 'Bastien', 'Yanis', 'Maxime'],
    last: ['Delacroix', 'Fournel', 'Garnier', 'Lemaire', 'Marchand', 'Perrault', 'Rousset', 'Vasseur', 'Bénard', 'Cazenave', 'Duval', 'Hébert'],
  },
  {
    code: 'br', en: 'Brazil', tr: 'Brezilya', str: 4.7, league: false,
    first: ['Gabriel', 'Thiago', 'Rafael', 'Vinícius', 'Matheus', 'Lucas', 'Bruno', 'Caio', 'Davi', 'Renan', 'Igor', 'Wesley'],
    last: ['Albuquerque', 'Bragança', 'Cavalcanti', 'Damasceno', 'Figueira', 'Guimarães', 'Macedo', 'Nogueira', 'Pimentel', 'Queiroz', 'Rangel', 'Teixeira'],
  },
  {
    code: 'ar', en: 'Argentina', tr: 'Arjantin', str: 4.6, league: false,
    first: ['Facundo', 'Santiago', 'Lautaro', 'Tomás', 'Agustín', 'Joaquín', 'Franco', 'Thiago', 'Nahuel', 'Valentín', 'Bautista', 'Emiliano'],
    last: ['Acuña', 'Bustamante', 'Correa', 'Echeverría', 'Funes', 'Ledesma', 'Maidana', 'Ojeda', 'Paredes', 'Quiroga', 'Sosa', 'Villalba'],
  },
  {
    code: 'nl', en: 'Netherlands', tr: 'Hollanda', str: 4.2, league: false,
    first: ['Daan', 'Sem', 'Lars', 'Bram', 'Thijs', 'Jesse', 'Ruben', 'Stijn', 'Milan', 'Joris', 'Teun', 'Niels'],
    last: ['van Dalen', 'de Groot', 'Hoekstra', 'Jansma', 'Kuipers', 'van Leeuwen', 'Meijer', 'Ruiter', 'Smit', 'Visser', 'de Wit', 'Zwart'],
  },
  {
    code: 'pt', en: 'Portugal', tr: 'Portekiz', str: 4.3, league: false,
    first: ['João', 'Diogo', 'Rúben', 'Gonçalo', 'Tiago', 'Rafael', 'Nuno', 'Bernardo', 'André', 'Pedro', 'Vitinha', 'Fábio'],
    last: ['Amaral', 'Barros', 'Carvalhal', 'Esteves', 'Fontes', 'Lacerda', 'Moniz', 'Pacheco', 'Rebelo', 'Seixas', 'Tavares', 'Valente'],
  },
  {
    code: 'ng', en: 'Nigeria', tr: 'Nijerya', str: 3.8, league: false,
    first: ['Chidi', 'Emeka', 'Tunde', 'Victor', 'Samuel', 'Ademola', 'Kelechi', 'Wilfred', 'Ifeanyi', 'Moses', 'Sadiq', 'Obinna'],
    last: ['Adeyemi', 'Balogun', 'Chukwu', 'Eze', 'Okonkwo', 'Nwankwo', 'Olatunji', 'Onyeka', 'Uzor', 'Babatunde', 'Ekong', 'Iwobi'],
  },
  {
    code: 'jp', en: 'Japan', tr: 'Japonya', str: 3.9, league: false,
    first: ['Haruto', 'Ren', 'Sota', 'Yuto', 'Kaito', 'Takumi', 'Daichi', 'Riku', 'Kenta', 'Shun', 'Hiroki', 'Kazuki'],
    last: ['Aoki', 'Fujimoto', 'Hayashi', 'Ishikawa', 'Kobayashi', 'Matsuda', 'Nakajima', 'Ogawa', 'Sakamoto', 'Takeda', 'Ueda', 'Yamaguchi'],
  },
];

export const LEAGUE_NATIONS = NATIONS.filter((n) => n.league).map((n) => n.code);
export const nationBy = (code: string) => NATIONS.find((n) => n.code === code) ?? NATIONS[0];

/** Stadium name parts */
export const STADIUM_FMT = [
  ['{T} Park', '{T} Park'],
  ['The {T} Ground', '{T} Sahası'],
  ['{T} Arena', '{T} Arena'],
  ['Estadio {T}', 'Estadio {T}'],
  ['Stadio {T}', 'Stadio {T}'],
  ['{T} Stadium', '{T} Stadyumu'],
];

export const NICKNAMES = [
  ['The Wolves', 'Kurtlar'], ['The Hammers', 'Çekiçler'], ['The Hornets', 'Eşek Arıları'], ['The Sharks', 'Köpekbalıkları'],
  ['The Owls', 'Baykuşlar'], ['The Bulls', 'Boğalar'], ['The Lions', 'Aslanlar'], ['The Eagles', 'Kartallar'], ['The Storm', 'Fırtına'],
  ['The Saints', 'Azizler'], ['The Foxes', 'Tilkiler'], ['The Mariners', 'Denizciler'], ['The Blades', 'Kılıçlar'], ['The Comets', 'Kuyrukluyıldızlar'],
  ['The Miners', 'Madenciler'], ['The Falcons', 'Şahinler'], ['The Rams', 'Koçlar'], ['The Vipers', 'Engerekler'], ['The Bears', 'Ayılar'], ['The Ravens', 'Kuzgunlar'],
];

/** Manager surnames for any club */
export const MANAGER_FIRST = ['Rafael', 'Dieter', 'Gianni', 'Hakan', 'Jorge', 'Steve', 'Luis', 'Fatih', 'Paolo', 'Bernd', 'Mikel', 'Graham', 'Ercan', 'Claudio', 'Andoni', 'Neil'];
export const MANAGER_LAST = ['Valverde', 'Kramer', 'Ruggeri', 'Özdemir', 'Salgado', 'Pearce', 'Ortega', 'Arıkan', 'Bertolucci', 'Hagen', 'Etxeberria', 'Holloway', 'Kılınç', 'Manfredi', 'Zubizar', 'Burrows'];

/** Outlets & accounts on KICKR (the in-game social network) */
export const OUTLETS = [
  { id: 'msd', name: 'Mad Sport Daily', handle: 'MadSportDaily', color: '#e8322b', tier: 2 },
  { id: 'gg', name: 'Goal Gazette', handle: 'GoalGazette', color: '#2f7bff', tier: 2 },
  { id: 'pp', name: 'Pitch Pulse', handle: 'PitchPulse', color: '#21a85a', tier: 3 },
  { id: 'tt', name: 'Transfer Tower', handle: 'TransferTower', color: '#ffb21f', tier: 3 },
];
export const STAT_ACCOUNTS = [
  { name: 'StatPulse', handle: 'StatPulse', color: '#14b8a6' },
  { name: 'xG Nerds', handle: 'xGnerds', color: '#6b3fd6' },
];
export const MEME_ACCOUNTS = [
  { name: 'Mad Football Memes', handle: 'MadMemesFC', color: '#ff2fa0' },
  { name: 'Pixel Banter', handle: 'PixelBanter', color: '#ff7a1a' },
  { name: 'Shinpad Society', handle: 'ShinpadSoc', color: '#b6ff3b' },
];
/** Journalists: [name, handle, reliability 1..5] */
export const JOURNALISTS: [string, string, number][] = [
  ['Marco Ventura', 'MarcoVentura_', 5],
  ['Selin Arat', 'selinarat', 4],
  ['Tom Hargreaves', 'TomHargreavesFC', 4],
  ['Pablo Ibarra', 'pibarra_mercato', 3],
  ['Kemal Sezer', 'kemalsezer', 3],
  ['Duncan Royle', 'ITKDuncan', 1],
  ['Gossip Gerry', 'GerryKnowsAll', 1],
];

export const AGENTS = [
  { name: 'Vera Kaan', handle: 'VK_Management' },
  { name: 'Lorenzo Pace', handle: 'PaceSportsMgmt' },
  { name: 'Diane Okoro', handle: 'OkoroTalent' },
];

export interface SponsorDef {
  id: string;
  name: string;
  kind: 'boots' | 'drink' | 'watch' | 'gaming' | 'car' | 'fashion' | 'food';
  color: string;
  /** minimum followers (K) */
  minF: number;
  /** weekly pay base (euros) */
  pay: number;
  /** one-off signing payment */
  bonus: number;
  /** hashtag they want */
  tag: string;
}

export const SPONSORS: SponsorDef[] = [
  { id: 'spd', name: 'Stride Boots', kind: 'boots', color: '#ff7a1a', minF: 8, pay: 600, bonus: 4000, tag: 'StrideFast' },
  { id: 'zap', name: 'ZAP Energy', kind: 'drink', color: '#b6ff3b', minF: 20, pay: 1400, bonus: 9000, tag: 'ZapIn' },
  { id: 'pix', name: 'Pixelforge Games', kind: 'gaming', color: '#6b3fd6', minF: 45, pay: 3200, bonus: 20000, tag: 'ForgeYourGame' },
  { id: 'kro', name: 'Kronos Watches', kind: 'watch', color: '#c8a24a', minF: 120, pay: 7000, bonus: 60000, tag: 'TimeIsKronos' },
  { id: 'vel', name: 'Velox Motors', kind: 'car', color: '#e23a2e', minF: 300, pay: 15000, bonus: 150000, tag: 'DriveVelox' },
  { id: 'nrd', name: 'NORD Apparel', kind: 'fashion', color: '#1b1b1f', minF: 700, pay: 30000, bonus: 300000, tag: 'WearNORD' },
  { id: 'bite', name: 'Bite Burger', kind: 'food', color: '#ffd23f', minF: 2000, pay: 55000, bonus: 600000, tag: 'BiteMad' },
];

/** Fan handle generator parts */
export const FAN_FIRST = ['mike', 'ayse', 'jordi', 'gio', 'kev', 'deniz', 'lara', 'sam', 'nico', 'emre', 'ola', 'tomi', 'bex', 'marta', 'ali', 'zoe', 'dani', 'luke', 'rosa', 'can', 'yuki', 'femi', 'ines', 'max'];
export const FAN_SUFFIX = ['_', '99', '07', '1923', '_fc', 'x', '10', '_official', '_ultra', '22', 'mad', '_bt', '04', '_real'];
