/** Unlockable cosmetics and powers. */
import { settings } from '../engine/storage';

export type ItemType = 'goalfx' | 'trail' | 'power' | 'boots';
export const ITEM_TYPES: ItemType[] = ['boots', 'goalfx', 'trail', 'power'];
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Item {
  id: string;
  type: ItemType;
  rarity: ItemRarity;
  color: string;
  name: { en: string; tr: string };
  desc: { en: string; tr: string };
  /** owned from the start */
  starter?: boolean;
  /** football boots: colours and stat bonuses */
  boot?: BootSpec;
}

/** Bonus points (1 point = +1 card stat) given to every player of your team. */
export interface BootBonus {
  pace: number;
  power: number;
  skill: number;
  tackle: number;
  /** stamina: less drain while sprinting */
  stamina: number;
}
export const BOOT_STATS = ['pace', 'power', 'skill', 'tackle', 'stamina'] as const;

export interface BootSpec {
  /** upper colour */
  main: string;
  /** toe cap / swoosh */
  accent: string;
  /** studs & sole */
  sole: string;
  bonus: BootBonus;
}

/** Market price in coins by rarity. */
export const BOOT_PRICE: Record<ItemRarity, number> = { common: 350, rare: 900, epic: 2000, legendary: 4200 };

export const RARITY_COLOR: Record<ItemRarity, string> = {
  common: '#9aa6bd',
  rare: '#3f8cff',
  epic: '#b04cff',
  legendary: '#ff9a1f',
};

const I = (id: string, type: ItemType, rarity: ItemRarity, color: string, en: string, tr: string, den: string, dtr: string, starter = false): Item => ({
  id, type, rarity, color, name: { en, tr }, desc: { en: den, tr: dtr }, starter,
});

const B = (
  id: string, rarity: ItemRarity, main: string, accent: string, sole: string,
  [pace, power, skill, tackle, stamina]: [number, number, number, number, number],
  en: string, tr: string, den: string, dtr: string, starter = false,
): Item => ({ ...I(id, 'boots', rarity, main, en, tr, den, dtr, starter), boot: { main, accent, sole, bonus: { pace, power, skill, tackle, stamina } } });

export const ITEMS: Item[] = [
  // ---- football boots (bonus: pace, power, skill, tackle, stamina)
  B('bt_classic', 'common', '#2a2a36', '#eef0f5', '#c8ccd8', [0, 0, 0, 0, 0], 'Classic Black', 'Klasik Siyah', 'Old-school leather. Never lets you down.', 'Eski usul deri. Seni asla yarı yolda bırakmaz.', true),
  B('bt_street', 'common', '#f2f2f5', '#e8323c', '#2a2a36', [3, 0, 2, 0, 0], 'Street Runner', 'Sokak Koşucusu', 'Light and comfy, born on concrete pitches.', 'Hafif ve rahat, beton sahalarda doğdu.'),
  B('bt_turf', 'common', '#2fa84f', '#f5f0a0', '#1b3a24', [0, 2, 0, 3, 0], 'Turf Grinder', 'Çim Öğütücü', 'Extra studs for brutal grip.', 'Acımasız tutuş için ekstra krampon dişi.'),
  B('bt_classicw', 'common', '#e8e2d0', '#1b2236', '#8a5a2a', [0, 0, 3, 0, 2], 'Vintage Cream', 'Vintage Krem', 'Hand-stitched classic. Smooth touch.', 'El dikimi klasik. Yumuşak dokunuş.'),
  B('bt_volt', 'rare', '#e6ff2a', '#16121e', '#3a3a46', [7, 0, 2, 0, 2], 'Volt Sprint', 'Volt Sprint', 'Neon speed boots. Leave them in the dust.', 'Neon hız kramponu. Rakipleri tozda bırak.'),
  B('bt_cobalt', 'rare', '#2a6cff', '#ffffff', '#16245a', [0, 7, 2, 0, 0], 'Cobalt Striker', 'Kobalt Golcü', 'Reinforced strike zone for rocket shots.', 'Füze şutlar için güçlendirilmiş vuruş bölgesi.'),
  B('bt_crimson', 'rare', '#d81f3a', '#ffd23f', '#4a0c18', [2, 0, 7, 0, 0], 'Crimson Control', 'Kızıl Kontrol', 'Grippy texture: the ball sticks to your feet.', 'Pürüzlü doku: top ayağına yapışır.'),
  B('bt_iron', 'rare', '#6a7284', '#ff9a1f', '#2a2e38', [0, 2, 0, 7, 2], 'Iron Tank', 'Demir Tank', 'Steel toe caps. Slide tackles hurt more.', 'Çelik burun. Kayarak müdahaleler daha çok acıtır.'),
  B('bt_phantom', 'epic', '#5a2a9a', '#3bd9ff', '#1a0c2e', [8, 0, 8, 0, 3], 'Phantom Glide', 'Hayalet Süzülüş', 'Feather-light. Defenders grab thin air.', 'Tüy kadar hafif. Defans boşluğu yakalar.'),
  B('bt_inferno', 'epic', '#ff5a1f', '#ffe14d', '#3a0c06', [6, 10, 0, 0, 2], 'Inferno', 'Cehennem', 'Built for thunderous strikes on the run.', 'Koşarken gümbürtülü şutlar için yapıldı.'),
  B('bt_glacier', 'epic', '#9ae6ff', '#ffffff', '#2a5a7a', [3, 0, 6, 3, 8], 'Glacier', 'Buzul', 'Cool under pressure. Run all day.', 'Baskı altında soğukkanlı. Bütün gün koş.'),
  B('bt_viper', 'epic', '#1f8a5a', '#c6ff3a', '#0c2a1a', [5, 3, 3, 7, 2], 'Viper Bite', 'Engerek Isırığı', 'Snake-skin upper. Quick and nasty.', 'Yılan derisi. Hızlı ve sert.'),
  B('bt_golden', 'legendary', '#ffcc2a', '#ffffff', '#8a5a0c', [7, 9, 7, 5, 6], 'Golden Boot', 'Altın Ayakkabı', 'Worn only by the deadliest finishers.', 'Sadece en ölümcül golcülerin giydiği efsane.'),
  B('bt_cosmic', 'legendary', '#ff3fa4', '#3bd9ff', '#2a0c3a', [10, 6, 10, 2, 6], 'Cosmic Rush', 'Kozmik Hücum', 'Forged from a fallen star. Pure magic.', 'Düşen bir yıldızdan dövüldü. Saf sihir.'),
  B('bt_titan', 'legendary', '#1b1b22', '#ff3b30', '#ff3b30', [4, 8, 2, 12, 8], 'Titan Crusher', 'Titan Ezici', 'Heavy, red-studded war boots. Nobody gets past.', 'Ağır, kırmızı dişli savaş botu. Kimse geçemez.'),

  // ---- goal explosions
  I('gx_classic', 'goalfx', 'common', '#ffd23f', 'Confetti', 'Konfeti', 'Team-colour confetti burst.', 'Takım renklerinde konfeti patlaması.', true),
  I('gx_fireworks', 'goalfx', 'common', '#ff5a8a', 'Fireworks', 'Havai Fişek', 'Rockets launch and burst over the goal.', 'Kalenin üstünde patlayan roketler.'),
  I('gx_pixelrain', 'goalfx', 'common', '#5ff0a4', 'Pixel Rain', 'Piksel Yağmuru', 'A rainbow downpour of pixels.', 'Gökkuşağı renklerinde piksel yağmuru.'),
  I('gx_ice', 'goalfx', 'rare', '#8ad8ff', 'Deep Freeze', 'Derin Dondurucu', 'Ice shards and a snow storm.', 'Buz kırıkları ve kar fırtınası.'),
  I('gx_lightning', 'goalfx', 'rare', '#ffe14d', 'Thunderstrike', 'Yıldırım', 'Lightning bolts hammer the net.', 'Ağa yıldırımlar düşer.'),
  I('gx_supernova', 'goalfx', 'epic', '#ffffff', 'Supernova', 'Süpernova', 'A blinding blast with shockwave rings.', 'Şok halkalarıyla kör eden patlama.'),
  I('gx_dragon', 'goalfx', 'epic', '#ff5a1f', 'Dragon Fire', 'Ejder Ateşi', 'A spiral of fire rises from the goal.', 'Kaleden yükselen ateş sarmalı.'),
  I('gx_blackhole', 'goalfx', 'legendary', '#b04cff', 'Black Hole', 'Kara Delik', 'Everything is sucked in... then explodes.', 'Her şeyi içine çeker... sonra patlar.'),
  I('gx_goldrush', 'goalfx', 'legendary', '#ffcc2a', 'Gold Rush', 'Altına Hücum', 'A fountain of gold coins.', 'Altın para fıskiyesi.'),
  // ---- ball trails
  I('tr_basic', 'trail', 'common', '#ffffff', 'Streak', 'Çizgi', 'A simple white streak.', 'Sade beyaz iz.', true),
  I('tr_fire', 'trail', 'common', '#ff7a1f', 'Flames', 'Alev', 'The ball leaves fire behind.', 'Top arkasında ateş bırakır.'),
  I('tr_sparkle', 'trail', 'common', '#fff3a0', 'Sparkle', 'Pırıltı', 'Twinkling stars.', 'Parıldayan yıldızlar.'),
  I('tr_smoke', 'trail', 'common', '#8a8a9a', 'Smoke', 'Duman', 'A thick smoke trail.', 'Kalın duman izi.'),
  I('tr_rainbow', 'trail', 'rare', '#ff3fa4', 'Rainbow', 'Gökkuşağı', 'Every colour at once.', 'Tüm renkler bir arada.'),
  I('tr_electric', 'trail', 'rare', '#3bd9ff', 'Electric', 'Elektrik', 'Crackling sparks.', 'Çıtırdayan kıvılcımlar.'),
  I('tr_galaxy', 'trail', 'epic', '#8a5cff', 'Galaxy', 'Galaksi', 'Stars and nebula dust.', 'Yıldızlar ve nebula tozu.'),
  I('tr_gold', 'trail', 'legendary', '#ffcc2a', 'Midas', 'Midas', 'Pure gold.', 'Saf altın.'),
  // ---- powers (used when the RAGE meter is full)
  I('pw_fireball', 'power', 'common', '#ff7a1f', 'Fireball', 'Ateş Topu', 'Flaming shot that flattens everyone in its path.', 'Yolundaki herkesi deviren alevli şut.', true),
  I('pw_ice', 'power', 'rare', '#8ad8ff', 'Ice Shot', 'Buz Şutu', 'Freezes everyone it touches.', 'Dokunduğu herkesi dondurur.'),
  I('pw_banana', 'power', 'rare', '#ffe14d', 'Banana Shot', 'Falso Şutu', 'Bends wildly around defenders.', 'Savunmanın etrafından kıvrılır.'),
  I('pw_thunder', 'power', 'epic', '#3bd9ff', 'Thunder Shot', 'Şimşek Şutu', 'Lightning-fast, chains shocks to nearby players.', 'Şimşek hızında, yakındakilere zincirleme çarpar.'),
  I('pw_shockwave', 'power', 'epic', '#b04cff', 'Shockwave', 'Şok Dalgası', 'Slam the ground: knocks down all nearby rivals.', 'Yere vur: yakındaki tüm rakipleri devirir.'),
  I('pw_turbo', 'power', 'legendary', '#ff3b30', 'Turbo Rampage', 'Turbo Öfke', '4 seconds of unstoppable speed. Run them over!', '4 saniye durdurulamaz hız. Ezip geç!'),
];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const itemName = (i: Item) => i.name[settings.lang] ?? i.name.en;
export const itemDesc = (i: Item) => i.desc[settings.lang] ?? i.desc.en;
export const bootTotal = (b: BootBonus) => b.pace + b.power + b.skill + b.tackle + b.stamina;
export const POWER_ID = (id: string) => id.replace('pw_', '');
