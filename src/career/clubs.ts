/**
 * Hand-made club database for the career world.
 * Unlicensed-style clubs: real cities, real colours and kit patterns, real derbies and
 * realistic prestige, with original names and original pixel crests (no club badge is copied).
 * The first 10 clubs of every nation start in the top division.
 */
import type { KitPattern, CrestCfg } from '../game/teams';

export interface ClubSeed {
  name: string;
  short: string;
  city: string;
  p: string;
  s: string;
  shorts: string;
  kit: KitPattern;
  rep: number;
  crest: CrestCfg;
  nick: [string, string];
  /** short code of the derby rival */
  rival?: string;
}

const GOLD = '#e8b923';
const SILVER = '#d8dde6';
const W = '#f4f4f4', K = '#1b1b1f', NAVY = '#13215e';

const c = (shape: number, icon: string, o: Partial<CrestCfg> = {}): CrestCfg => ({ shape, icon, ...o });

export const CLUB_SEEDS: Record<string, ClubSeed[]> = {
  en: [
    { name: 'Manchester Red', short: 'MNR', city: 'Manchester', p: '#d71920', s: W, shorts: W, kit: 'solid', rep: 90, crest: c(7, 'bee', { accent: GOLD, ring: true, text: 'MR' }), nick: ['The Red Bees', 'Kırmızı Arılar'], rival: 'MNS' },
    { name: 'Manchester Sky', short: 'MNS', city: 'Manchester', p: '#6cabdd', s: W, shorts: W, kit: 'solid', rep: 92, crest: c(1, 'eagle', { accent: GOLD, ring: true, text: 'MS' }), nick: ['The Sky Eagles', 'Gök Kartalları'], rival: 'MNR' },
    { name: 'London Blues', short: 'LNB', city: 'London', p: '#034694', s: W, shorts: '#034694', kit: 'solid', rep: 88, crest: c(1, 'lion', { accent: GOLD, ring: true }), nick: ['The Blues', 'Maviler'], rival: 'NLW' },
    { name: 'North London Red', short: 'NLR', city: 'London', p: '#db0007', s: W, shorts: W, kit: 'yoke', rep: 89, crest: c(0, 'castle', { bg: 'band', accent: GOLD, text: 'NLR' }), nick: ['The Gunners of the North', 'Kuzeyin Topçuları'], rival: 'NLW' },
    { name: 'Merseyside Red', short: 'MSR', city: 'Liverpool', p: '#c8102e', s: '#00a398', shorts: '#c8102e', kit: 'solid', rep: 91, crest: c(0, 'flame', { accent: '#f6eb61', ring: true }), nick: ['The Mersey Reds', 'Mersey Kırmızıları'], rival: 'MSB' },
    { name: 'North London White', short: 'NLW', city: 'London', p: W, s: '#132257', shorts: '#132257', kit: 'solid', rep: 84, crest: c(3, 'crown', { accent: '#132257', text: 'NLW' }), nick: ['The Lilywhites', 'Beyazlar'], rival: 'NLR' },
    { name: 'Tyneside Stripes', short: 'TYN', city: 'Newcastle', p: K, s: W, shorts: K, kit: 'stripes', rep: 82, crest: c(8, 'tower', { bg: 'stripes', accent: GOLD }), nick: ['The Magpies of the Tyne', 'Tyne Saksağanları'], rival: 'WRS' },
    { name: 'West Midlands Claret', short: 'WMC', city: 'Birmingham', p: '#670e36', s: '#95bfe5', shorts: W, kit: 'yoke', rep: 80, crest: c(7, 'lion', { accent: '#fee505', ring: true }), nick: ['The Villans', 'Köylüler'], rival: 'WVG' },
    { name: 'East London Claret', short: 'ELC', city: 'London', p: '#7a263a', s: '#1bb1e7', shorts: W, kit: 'yoke', rep: 76, crest: c(3, 'castle', { bg: 'halves', accent: GOLD }), nick: ['The Irons of the East', 'Doğunun Demirleri'], rival: 'LNB' },
    { name: 'Merseyside Blue', short: 'MSB', city: 'Liverpool', p: '#003399', s: W, shorts: W, kit: 'solid', rep: 74, crest: c(5, 'gem', { accent: W, ring: true, text: 'MSB' }), nick: ['The Toffee Blues', 'Şekerci Maviler'], rival: 'MSR' },
    { name: 'Yorkshire White', short: 'YKW', city: 'Leeds', p: W, s: '#1d428a', shorts: W, kit: 'solid', rep: 56, crest: c(2, 'star', { accent: '#ffcd00', text: 'YW' }), nick: ['The Whites', 'Beyazlar'] },
    { name: 'Sheffield Stripes', short: 'SHS', city: 'Sheffield', p: '#ee2737', s: W, shorts: K, kit: 'stripes', rep: 47, crest: c(0, 'bolt', { bg: 'stripes', accent: K }), nick: ['The Blades', 'Bıçaklar'] },
    { name: 'Wearside Stripes', short: 'WRS', city: 'Sunderland', p: '#eb172b', s: W, shorts: K, kit: 'stripes', rep: 50, crest: c(8, 'sun', { bg: 'stripes', accent: GOLD }), nick: ['The Black Cats', 'Kara Kediler'], rival: 'TYN' },
    { name: 'Nottingham Red', short: 'NTR', city: 'Nottingham', p: '#dd0000', s: W, shorts: W, kit: 'solid', rep: 51, crest: c(0, 'tree', { accent: W }), nick: ['The Foresters', 'Ormancılar'], rival: 'EMW' },
    { name: 'Leicester Blue', short: 'LCB', city: 'Leicester', p: '#003090', s: W, shorts: W, kit: 'solid', rep: 49, crest: c(1, 'fox', { accent: '#fdbe11', ring: true }), nick: ['The Foxes', 'Tilkiler'] },
    { name: 'South Coast Stripes', short: 'SCS', city: 'Southampton', p: '#d71920', s: W, shorts: K, kit: 'stripes', rep: 46, crest: c(7, 'ship', { bg: 'stripes', accent: '#ffc20e' }), nick: ['The Saints', 'Azizler'] },
    { name: 'East Anglia Yellow', short: 'EAY', city: 'Norwich', p: '#fff200', s: '#00a650', shorts: '#00a650', kit: 'solid', rep: 44, crest: c(1, 'canary', { accent: '#00a650', ring: true }), nick: ['The Canaries', 'Kanaryalar'] },
    { name: 'Teesside Red', short: 'TSR', city: 'Middlesbrough', p: '#e11b22', s: W, shorts: W, kit: 'band', rep: 45, crest: c(9, 'anchor', { accent: W }), nick: ['The Boro Reds', 'Boro Kırmızıları'] },
    { name: 'East Midlands White', short: 'EMW', city: 'Derby', p: W, s: K, shorts: K, kit: 'solid', rep: 47, crest: c(3, 'ram', { accent: K }), nick: ['The Rams', 'Koçlar'], rival: 'NTR' },
    { name: 'Wolverhampton Gold', short: 'WVG', city: 'Wolverhampton', p: '#fdb913', s: K, shorts: K, kit: 'solid', rep: 53, crest: c(2, 'wolf', { accent: K }), nick: ['The Wolves', 'Kurtlar'], rival: 'WMC' },
  ],
  es: [
    { name: 'Madrid White', short: 'MDW', city: 'Madrid', p: W, s: '#febe10', shorts: W, kit: 'solid', rep: 95, crest: c(1, 'crown', { accent: '#febe10', ring: true, text: 'MW' }), nick: ['The Whites', 'Beyazlar'], rival: 'CBR' },
    { name: 'Catalonia Blue-Red', short: 'CBR', city: 'Barcelona', p: '#a50044', s: '#004d98', shorts: '#004d98', kit: 'stripes', rep: 93, crest: c(0, 'cross', { bg: 'stripes', accent: '#edbb00', text: 'CBR' }), nick: ['The Blue-Reds', 'Mavi-Kırmızılar'], rival: 'MDW' },
    { name: 'Madrid Red Stripes', short: 'MRS', city: 'Madrid', p: '#cb3524', s: W, shorts: '#272e61', kit: 'stripes', rep: 87, crest: c(0, 'tree', { bg: 'stripes', accent: '#272e61', ring: true }), nick: ['The Mattress Makers', 'Yatakçılar'], rival: 'MDW' },
    { name: 'Basque Red Stripes', short: 'BRS', city: 'Bilbao', p: '#ee2523', s: W, shorts: K, kit: 'stripes', rep: 81, crest: c(7, 'lion', { bg: 'stripes', accent: K }), nick: ['The Lions', 'Aslanlar'], rival: 'BBS' },
    { name: 'Basque Blue Stripes', short: 'BBS', city: 'San Sebastián', p: '#0067b1', s: W, shorts: W, kit: 'stripes', rep: 80, crest: c(1, 'crown', { bg: 'stripes', accent: GOLD, ring: true }), nick: ['The Txuri-Urdin', 'Mavi-Beyazlar'], rival: 'BRS' },
    { name: 'Andalusia White', short: 'ANW', city: 'Sevilla', p: W, s: '#d71a28', shorts: W, kit: 'solid', rep: 80, crest: c(0, 'castle', { bg: 'band', accent: '#d71a28', text: 'AW' }), nick: ['The Rojiblancos', 'Kırmızı-Beyazlar'], rival: 'ANG' },
    { name: 'Andalusia Green', short: 'ANG', city: 'Sevilla', p: '#00954c', s: W, shorts: W, kit: 'stripes', rep: 78, crest: c(2, 'gem', { bg: 'stripes', accent: GOLD }), nick: ['The Verdiblancos', 'Yeşil-Beyazlar'], rival: 'ANW' },
    { name: 'Valencia White', short: 'VLW', city: 'Valencia', p: W, s: K, shorts: K, kit: 'solid', rep: 79, crest: c(1, 'wing', { accent: '#ee3524', ring: true }), nick: ['The Bats', 'Yarasalar'] },
    { name: 'Castellón Yellow', short: 'CSY', city: 'Villarreal', p: '#ffe114', s: '#005187', shorts: '#ffe114', kit: 'solid', rep: 79, crest: c(5, 'ship', { accent: '#005187' }), nick: ['The Yellow Submarine', 'Sarı Denizaltı'] },
    { name: 'Galicia Sky', short: 'GLS', city: 'Vigo', p: '#8ac3ee', s: W, shorts: W, kit: 'solid', rep: 72, crest: c(3, 'anchor', { accent: '#e5254e', ring: true }), nick: ['The Sky Blues', 'Gök Maviler'] },
    { name: 'Catalonia Blue Stripes', short: 'CBS', city: 'Barcelona', p: '#007fc8', s: W, shorts: '#007fc8', kit: 'stripes', rep: 58, crest: c(9, 'eagle', { bg: 'stripes', accent: GOLD }), nick: ['The Parakeets', 'Muhabbet Kuşları'], rival: 'CBR' },
    { name: 'Navarra Red', short: 'NVR', city: 'Pamplona', p: '#d91a21', s: '#0a346f', shorts: '#0a346f', kit: 'solid', rep: 55, crest: c(0, 'castle', { accent: GOLD }), nick: ['The Reds of Navarre', 'Navarra Kırmızıları'] },
    { name: 'Aragon Blue', short: 'ARB', city: 'Zaragoza', p: W, s: '#1e4fa0', shorts: '#1e4fa0', kit: 'solid', rep: 50, crest: c(7, 'lion', { bg: 'band', accent: GOLD }), nick: ['The Maños', 'Manyolar'] },
    { name: 'Coruña Blue Stripes', short: 'CRB', city: 'A Coruña', p: '#1b4fa3', s: W, shorts: '#1b4fa3', kit: 'stripes', rep: 49, crest: c(1, 'tower', { bg: 'stripes', accent: GOLD, ring: true }), nick: ['The Galicians', 'Galiçyalılar'] },
    { name: 'Costa del Sol Blue', short: 'CSB', city: 'Málaga', p: '#2c7cc2', s: W, shorts: W, kit: 'stripes', rep: 48, crest: c(8, 'sun', { accent: GOLD }), nick: ['The Anchovies', 'Hamsiler'] },
    { name: 'Madrid South Blue', short: 'MSU', city: 'Getafe', p: '#005999', s: W, shorts: '#005999', kit: 'solid', rep: 52, crest: c(2, 'bolt', { accent: W, text: 'MSB' }), nick: ['The Azulones', 'Lacivertler'] },
    { name: 'Castile Purple Stripes', short: 'CPS', city: 'Valladolid', p: '#5c2d91', s: W, shorts: W, kit: 'stripes', rep: 47, crest: c(6, 'castle', { bg: 'stripes', accent: GOLD }), nick: ['The Pucelanos', 'Pucelanolar'] },
    { name: 'Balearic Red', short: 'BLR', city: 'Palma', p: '#e20613', s: K, shorts: K, kit: 'solid', rep: 51, crest: c(1, 'crown', { bg: 'quarters', accent: GOLD, ring: true }), nick: ['The Islanders', 'Adalılar'] },
    { name: 'Vallecas Red Sash', short: 'VRS', city: 'Madrid', p: W, s: '#e53027', shorts: W, kit: 'sash', rep: 45, crest: c(0, 'bolt', { bg: 'sash', accent: K }), nick: ['The Lightning', 'Şimşekler'], rival: 'MSU' },
    { name: 'Canary Yellow', short: 'CNY', city: 'Las Palmas', p: '#ffe400', s: '#0059a2', shorts: '#0059a2', kit: 'solid', rep: 46, crest: c(1, 'canary', { accent: '#0059a2', ring: true }), nick: ['The Islanders', 'Adalılar'] },
  ],
  it: [
    { name: 'Turin Black & White', short: 'TBW', city: 'Torino', p: W, s: K, shorts: W, kit: 'stripes', rep: 91, crest: c(9, 'star', { bg: 'stripes', accent: GOLD, text: 'TBW' }), nick: ['The Old Lady', 'Yaşlı Hanım'], rival: 'TRM' },
    { name: 'Milan Black-Blue', short: 'MBB', city: 'Milano', p: '#0068a8', s: K, shorts: K, kit: 'stripes', rep: 90, crest: c(0, 'griffin', { bg: 'stripes', accent: GOLD, ring: true }), nick: ['The Serpents', 'Yılanlar'], rival: 'MRB' },
    { name: 'Milan Red-Black', short: 'MRB', city: 'Milano', p: '#fb090b', s: K, shorts: W, kit: 'stripes', rep: 89, crest: c(2, 'bolt', { bg: 'stripes', accent: W }), nick: ['The Devils of Milan', 'Milano Şeytanları'], rival: 'MBB' },
    { name: 'Naples Sky', short: 'NPS', city: 'Napoli', p: '#12a0d7', s: W, shorts: W, kit: 'solid', rep: 88, crest: c(1, 'horse', { accent: W, ring: true }), nick: ['The Little Donkeys', 'Küçük Eşekler'], rival: 'RYR' },
    { name: 'Rome Yellow-Red', short: 'RYR', city: 'Roma', p: '#8e1f2f', s: '#f0bc42', shorts: W, kit: 'solid', rep: 85, crest: c(0, 'wolf', { bg: 'halves', accent: '#f0bc42', text: 'RYR' }), nick: ['The Wolves of Rome', 'Roma Kurtları'], rival: 'LTS' },
    { name: 'Latium Sky', short: 'LTS', city: 'Roma', p: '#87d8f7', s: W, shorts: W, kit: 'solid', rep: 82, crest: c(1, 'eagle', { accent: NAVY, ring: true }), nick: ['The Eagles', 'Kartallar'], rival: 'RYR' },
    { name: 'Bergamo Black-Blue', short: 'BGB', city: 'Bergamo', p: '#1e71b8', s: K, shorts: K, kit: 'stripes', rep: 84, crest: c(7, 'star', { bg: 'stripes', accent: W }), nick: ['The Goddess', 'Tanrıça'] },
    { name: 'Florence Violet', short: 'FLV', city: 'Firenze', p: '#482e92', s: W, shorts: W, kit: 'solid', rep: 80, crest: c(3, 'gem', { accent: '#d71920', ring: true }), nick: ['The Violets', 'Menekşeler'] },
    { name: 'Turin Maroon', short: 'TRM', city: 'Torino', p: '#8a1e03', s: W, shorts: W, kit: 'solid', rep: 74, crest: c(0, 'horns', { accent: GOLD }), nick: ['The Bulls', 'Boğalar'], rival: 'TBW' },
    { name: 'Bologna Red-Blue', short: 'BRB', city: 'Bologna', p: '#a21c26', s: '#1a2f48', shorts: W, kit: 'half', rep: 76, crest: c(0, 'tower', { bg: 'halves', accent: W }), nick: ['The Red-Blues', 'Kırmızı-Maviler'] },
    { name: 'Liguria Red-Blue', short: 'LRB', city: 'Genova', p: '#c8102e', s: '#002c5c', shorts: W, kit: 'half', rep: 60, crest: c(7, 'griffin', { bg: 'halves', accent: GOLD }), nick: ['The Griffins', 'Griffonlar'], rival: 'LGB' },
    { name: 'Liguria Blue', short: 'LGB', city: 'Genova', p: '#1d63ad', s: W, shorts: W, kit: 'band', rep: 55, crest: c(1, 'anchor', { bg: 'band', accent: '#e30613' }), nick: ['The Blucerchiati', 'Mavi Halkalılar'], rival: 'LRB' },
    { name: 'Parma Yellow-Blue', short: 'PYB', city: 'Parma', p: W, s: '#003c7d', shorts: K, kit: 'chevron', rep: 54, crest: c(0, 'cross', { accent: '#ffd700' }), nick: ['The Crusaders', 'Haçlılar'] },
    { name: 'Friuli Black-White', short: 'FBW', city: 'Udine', p: K, s: W, shorts: W, kit: 'stripes', rep: 56, crest: c(5, 'horse', { bg: 'stripes', accent: GOLD }), nick: ['The Zebrette', 'Küçük Zebralar'] },
    { name: 'Sicily Pink', short: 'SCP', city: 'Palermo', p: '#f5a3c7', s: K, shorts: K, kit: 'solid', rep: 52, crest: c(1, 'eagle', { accent: K, ring: true }), nick: ['The Pink Eagles', 'Pembe Kartallar'] },
    { name: 'Sardinia Red-Blue', short: 'SRB', city: 'Cagliari', p: '#a50034', s: '#00205b', shorts: W, kit: 'half', rep: 53, crest: c(3, 'sun', { bg: 'quarters', accent: W }), nick: ['The Islanders', 'Adalılar'] },
    { name: 'Verona Yellow-Blue', short: 'VYB', city: 'Verona', p: '#002f6c', s: '#ffdd00', shorts: '#002f6c', kit: 'yoke', rep: 51, crest: c(6, 'castle', { accent: '#ffdd00' }), nick: ['The Mastiffs', 'Mastifler'] },
    { name: 'Salento Yellow-Red', short: 'SYR', city: 'Lecce', p: '#ffd400', s: '#d71920', shorts: K, kit: 'stripes', rep: 48, crest: c(0, 'wolf', { bg: 'stripes', accent: K }), nick: ['The Wolves of Salento', 'Salento Kurtları'] },
    { name: 'Venice Orange-Green', short: 'VOG', city: 'Venezia', p: K, s: '#f47920', shorts: K, kit: 'band', rep: 47, crest: c(2, 'lion', { bg: 'band', accent: '#00843d' }), nick: ['The Lagoon Lions', 'Lagün Aslanları'] },
    { name: 'Emilia Green-Black', short: 'EGB', city: 'Sassuolo', p: '#00a752', s: K, shorts: K, kit: 'stripes', rep: 50, crest: c(1, 'gem', { bg: 'stripes', accent: W, ring: true }), nick: ['The Green-Blacks', 'Yeşil-Siyahlar'] },
  ],
  tr: [
    { name: 'İstanbul Sarı-Kırmızı', short: 'İSK', city: 'İstanbul', p: '#a90432', s: '#fdb912', shorts: W, kit: 'half', rep: 90, crest: c(1, 'lion', { bg: 'halves', accent: '#fdb912', ring: true }), nick: ['The Lions of the Bosphorus', 'Boğazın Aslanları'], rival: 'İSL' },
    { name: 'İstanbul Sarı-Lacivert', short: 'İSL', city: 'İstanbul', p: '#ffed00', s: '#002d72', shorts: W, kit: 'stripes', rep: 89, crest: c(1, 'canary', { bg: 'stripes', accent: '#002d72', ring: true }), nick: ['The Yellow Canaries', 'Sarı Kanaryalar'], rival: 'İSK' },
    { name: 'İstanbul Siyah-Beyaz', short: 'İSB', city: 'İstanbul', p: W, s: K, shorts: K, kit: 'solid', rep: 87, crest: c(0, 'eagle', { bg: 'halves', accent: '#e30a17', text: 'İSB' }), nick: ['The Black Eagles', 'Kara Kartallar'], rival: 'İSK' },
    { name: 'Karadeniz Bordo-Mavi', short: 'KBM', city: 'Trabzon', p: '#7b1e3d', s: '#69b3e7', shorts: W, kit: 'stripes', rep: 82, crest: c(3, 'bolt', { bg: 'stripes', accent: W }), nick: ['The Black Sea Storm', 'Karadeniz Fırtınası'], rival: 'İSL' },
    { name: 'İstanbul Turuncu-Lacivert', short: 'İTL', city: 'İstanbul', p: '#f47a20', s: '#13215e', shorts: '#13215e', kit: 'solid', rep: 75, crest: c(5, 'star', { accent: '#13215e', ring: true, text: 'İTL' }), nick: ['The Owls', 'Baykuşlar'] },
    { name: 'İzmir Sarı-Kırmızı', short: 'İZS', city: 'İzmir', p: '#ffd100', s: '#d71920', shorts: '#d71920', kit: 'half', rep: 70, crest: c(0, 'sun', { bg: 'halves', accent: K }), nick: ['The Giants of İzmir', 'İzmir Devleri'], rival: 'İZB' },
    { name: 'Samsun Kırmızı-Beyaz', short: 'SKB', city: 'Samsun', p: '#d71920', s: W, shorts: W, kit: 'solid', rep: 72, crest: c(7, 'horse', { accent: W, ring: true }), nick: ['The Red Lightning', 'Kırmızı Şimşekler'] },
    { name: 'İstanbul Lacivert-Beyaz', short: 'İLB', city: 'İstanbul', p: '#13215e', s: W, shorts: '#13215e', kit: 'stripes', rep: 67, crest: c(1, 'anchor', { bg: 'stripes', accent: W }), nick: ['The Sailors', 'Denizciler'] },
    { name: 'Konya Yeşil-Beyaz', short: 'KYB', city: 'Konya', p: '#00843d', s: W, shorts: W, kit: 'band', rep: 68, crest: c(2, 'eagle', { bg: 'band', accent: W }), nick: ['The Anatolian Eagles', 'Anadolu Kartalları'] },
    { name: 'Akdeniz Kırmızı-Beyaz', short: 'AKB', city: 'Antalya', p: '#e30613', s: W, shorts: W, kit: 'stripes', rep: 66, crest: c(8, 'gem', { bg: 'stripes', accent: GOLD }), nick: ['The Scorpions', 'Akrepler'] },
    { name: 'Bursa Yeşil-Beyaz', short: 'BYB', city: 'Bursa', p: '#009245', s: W, shorts: W, kit: 'stripes', rep: 56, crest: c(0, 'shark', { bg: 'stripes', accent: W }), nick: ['The Crocodiles', 'Timsahlar'] },
    { name: 'Kayseri Sarı-Kırmızı', short: 'KSK', city: 'Kayseri', p: '#ffd100', s: '#d71920', shorts: '#d71920', kit: 'stripes', rep: 52, crest: c(3, 'star', { bg: 'stripes', accent: K }), nick: ['The Anatolian Stars', 'Anadolu Yıldızları'] },
    { name: 'Sivas Kırmızı-Beyaz', short: 'SVK', city: 'Sivas', p: '#e30613', s: W, shorts: W, kit: 'chevron', rep: 53, crest: c(6, 'bolt', { accent: W }), nick: ['The Brave Ones', 'Yiğitler'] },
    { name: 'Eskişehir Kırmızı-Siyah', short: 'EKS', city: 'Eskişehir', p: '#e30613', s: K, shorts: K, kit: 'stripes', rep: 48, crest: c(1, 'flame', { bg: 'stripes', accent: W, ring: true }), nick: ['The Red Lightning', 'Kırmızı Şimşekler'] },
    { name: 'İzmir Siyah-Beyaz', short: 'İZB', city: 'İzmir', p: K, s: W, shorts: K, kit: 'stripes', rep: 47, crest: c(0, 'moon', { bg: 'stripes', accent: GOLD }), nick: ['The Black-Whites of İzmir', 'İzmir Siyah-Beyazları'], rival: 'İZS' },
    { name: 'Ankara Sarı-Lacivert', short: 'ASL', city: 'Ankara', p: '#ffd100', s: '#13215e', shorts: '#13215e', kit: 'solid', rep: 51, crest: c(2, 'crown', { accent: '#13215e', ring: true }), nick: ['The Capital Yellows', 'Başkent Sarıları'], rival: 'AKS' },
    { name: 'Ankara Kırmızı-Siyah', short: 'AKS', city: 'Ankara', p: '#d71920', s: K, shorts: K, kit: 'half', rep: 49, crest: c(0, 'horns', { bg: 'halves', accent: W }), nick: ['The Poppies', 'Gelinciler'], rival: 'ASL' },
    { name: 'Adana Lacivert-Mavi', short: 'ADL', city: 'Adana', p: '#00a0e9', s: '#13215e', shorts: '#13215e', kit: 'stripes', rep: 50, crest: c(5, 'rocket', { bg: 'stripes', accent: W }), nick: ['The Locomotives', 'Lokomotifler'] },
    { name: 'Hatay Bordo-Beyaz', short: 'HBB', city: 'Hatay', p: '#7b1e3d', s: W, shorts: W, kit: 'band', rep: 47, crest: c(3, 'tree', { bg: 'band', accent: GOLD }), nick: ['The Maroons', 'Bordolar'] },
    { name: 'Rize Yeşil-Mavi', short: 'RYM', city: 'Rize', p: '#00843d', s: '#0072bc', shorts: '#0072bc', kit: 'half', rep: 49, crest: c(9, 'gem', { bg: 'halves', accent: W }), nick: ['The Tea Growers', 'Çaycılar'] },
  ],
};

export const STADIUM_WORDS = ['Arena', 'Park', 'Stadium', 'Ground'];
void SILVER;
