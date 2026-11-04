/** Unlockable cosmetics and powers. */
import { settings } from '../engine/storage';

export type ItemType = 'goalfx' | 'trail' | 'power' | 'boots';
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
  /** football boots: colours and team-wide stat bonuses */
  boot?: BootSpec;
}

/** Bonus points (1 point = +1 card stat) given to every player of your team. */
export interface BootBonus {
  pace: number;
  power: number;
  skill: number;
  tackle: number;
  /** less stamina drain while sprinting */
  stamina: number;
}
export const BOOT_STATS = ['pace', 'power', 'skill', 'tackle', 'stamina'] as const;

export interface BootSpec {
  /** upper colour */
  main: string;
  /** stripe and sole */
  accent: string;
  bonus: BootBonus;
}

/** Boot shop prices by rarity (always available, no rotation). */
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
  id: string, rarity: ItemRarity, main: string, accent: string,
  [pace, power, skill, tackle, stamina]: [number, number, number, number, number],
  en: string, tr: string, den: string, dtr: string, starter = false,
): Item => ({ ...I(id, 'boots', rarity, main, en, tr, den, dtr, starter), boot: { main, accent, bonus: { pace, power, skill, tackle, stamina } } });

export const ITEMS: Item[] = [
  // ---- football boots (bonus: pace, power, skill, tackle, stamina)
  B('bt_classic', 'common', '#2a2a36', '#eef0f5', [0, 0, 0, 0, 0], 'Classic Black', 'Klasik Siyah', 'Old-school leather. Never lets you down.', 'Eski usul deri. Seni asla yarı yolda bırakmaz.', true),
  B('bt_street', 'common', '#f2f2f5', '#e8323c', [3, 0, 2, 0, 0], 'Street Runner', 'Sokak Koşucusu', 'Light and comfy, born on concrete pitches.', 'Hafif ve rahat, beton sahalarda doğdu.'),
  B('bt_turf', 'common', '#2fa84f', '#f5f0a0', [0, 2, 0, 3, 0], 'Turf Grinder', 'Çim Öğütücü', 'Extra studs for brutal grip.', 'Acımasız tutuş için ekstra krampon dişi.'),
  B('bt_vintage', 'common', '#e8e2d0', '#8a5a2a', [0, 0, 3, 0, 2], 'Vintage Cream', 'Vintage Krem', 'Hand-stitched classic. Smooth touch.', 'El dikimi klasik. Yumuşak dokunuş.'),
  B('bt_volt', 'rare', '#e6ff2a', '#16121e', [7, 0, 2, 0, 2], 'Volt Sprint', 'Volt Sprint', 'Neon speed boots. Leave them in the dust.', 'Neon hız kramponu. Rakipleri tozda bırak.'),
  B('bt_cobalt', 'rare', '#2a6cff', '#ffffff', [0, 7, 2, 0, 0], 'Cobalt Striker', 'Kobalt Golcü', 'Reinforced strike zone for rocket shots.', 'Füze şutlar için güçlendirilmiş vuruş bölgesi.'),
  B('bt_crimson', 'rare', '#d81f3a', '#ffd23f', [2, 0, 7, 0, 0], 'Crimson Control', 'Kızıl Kontrol', 'Grippy texture: the ball sticks to your feet.', 'Pürüzlü doku: top ayağına yapışır.'),
  B('bt_iron', 'rare', '#6a7284', '#ff9a1f', [0, 2, 0, 7, 2], 'Iron Tank', 'Demir Tank', 'Steel toe caps. Slide tackles hurt more.', 'Çelik burun. Kayarak müdahaleler daha çok acıtır.'),
  B('bt_phantom', 'epic', '#5a2a9a', '#3bd9ff', [8, 0, 8, 0, 3], 'Phantom Glide', 'Hayalet Süzülüş', 'Feather-light. Defenders grab thin air.', 'Tüy kadar hafif. Defans boşluğu yakalar.'),
  B('bt_inferno', 'epic', '#ff5a1f', '#ffe14d', [6, 10, 0, 0, 2], 'Inferno', 'Cehennem', 'Built for thunderous strikes on the run.', 'Koşarken gümbürtülü şutlar için yapıldı.'),
  B('bt_glacier', 'epic', '#9ae6ff', '#ffffff', [3, 0, 6, 3, 8], 'Glacier', 'Buzul', 'Cool under pressure. Run all day.', 'Baskı altında soğukkanlı. Bütün gün koş.'),
  B('bt_viper', 'epic', '#1f8a5a', '#c6ff3a', [5, 3, 3, 7, 2], 'Viper Bite', 'Engerek Isırığı', 'Snake-skin upper. Quick and nasty.', 'Yılan derisi. Hızlı ve sert.'),
  B('bt_golden', 'legendary', '#ffcc2a', '#ffffff', [7, 9, 7, 5, 6], 'Golden Boot', 'Altın Ayakkabı', 'Worn only by the deadliest finishers.', 'Sadece en ölümcül golcülerin giydiği efsane.'),
  B('bt_cosmic', 'legendary', '#ff3fa4', '#3bd9ff', [10, 6, 10, 2, 6], 'Cosmic Rush', 'Kozmik Hücum', 'Forged from a fallen star. Pure magic.', 'Düşen bir yıldızdan dövüldü. Saf sihir.'),
  B('bt_titan', 'legendary', '#1b1b22', '#ff3b30', [4, 8, 2, 12, 8], 'Titan Crusher', 'Titan Ezici', 'Heavy, red-studded war boots. Nobody gets past.', 'Ağır, kırmızı dişli savaş botu. Kimse geçemez.'),

  // ---- goal explosions
  I('gx_classic', 'goalfx', 'common', '#ffd23f', 'Confetti', 'Konfeti', 'Team-colour confetti burst.', 'Takım renklerinde konfeti patlaması.', true),
  I('gx_fireworks', 'goalfx', 'common', '#ff5a8a', 'Fireworks', 'Havai Fişek', 'Rockets launch and burst over the goal.', 'Kalenin üstünde patlayan roketler.'),
  I('gx_pixelrain', 'goalfx', 'common', '#5ff0a4', 'Pixel Rain', 'Piksel Yağmuru', 'A rainbow downpour of pixels.', 'Gökkuşağı renklerinde piksel yağmuru.'),
  I('gx_ice', 'goalfx', 'rare', '#8ad8ff', 'Deep Freeze', 'Derin Dondurucu', 'Ice shards and a snow storm.', 'Buz kırıkları ve kar fırtınası.'),
  I('gx_lightning', 'goalfx', 'rare', '#ffe14d', 'Thunderstrike', 'Yıldırım', 'Lightning bolts hammer the net.', 'Ağa yıldırımlar düşer.'),
  I('gx_supernova', 'goalfx', 'epic', '#ffffff', 'Supernova', 'Süpernova', 'A blinding blast with shockwave rings.', 'Şok halkalarıyla kör eden patlama.'),
  I('gx_dragon', 'goalfx', 'epic', '#ff5a1f', 'Dragon Fire', 'Ejder Ateşi', 'A spiral of fire rises from the goal.', 'Kaleden yükselen ateş sarmalı.'),
  I('gx_blackhole', 'goalfx', 'legendary', '#b04cff', 'Black Hole', 'Kara Delik', 'Everything is sucked in... then explodes.', 'Her şeyi içine çeker... sonra patlar.'),
  I('gx_sakura', 'goalfx', 'common', '#ffb3d1', 'Sakura Storm', 'Sakura Fırtınası', 'A storm of cherry blossom petals.', 'Kiraz çiçeği yaprakları fırtınası.'),
  I('gx_toxic', 'goalfx', 'common', '#7aff3a', 'Toxic Spill', 'Zehirli Sızıntı', 'Bubbling green goo everywhere.', 'Her yer fokurdayan yeşil sıvı.'),
  I('gx_hearts', 'goalfx', 'rare', '#ff3fa4', 'Love Bomb', 'Aşk Bombası', 'A burst of floating hearts.', 'Havada süzülen kalpler patlaması.'),
  I('gx_disco', 'goalfx', 'rare', '#3bd9ff', 'Disco Fever', 'Disko Ateşi', 'Strobing colour rings and stars.', 'Yanıp sönen renkli halkalar ve yıldızlar.'),
  I('gx_volcano', 'goalfx', 'epic', '#ff5a1f', 'Volcano', 'Volkan', 'The goal erupts with lava and rocks.', 'Kale lav ve kayalarla patlar.'),
  I('gx_tornado', 'goalfx', 'epic', '#c8d0e0', 'Tornado', 'Kasırga', 'A twister spins up out of the net.', 'Ağdan yükselen bir hortum.'),
  I('gx_meteor', 'goalfx', 'legendary', '#ff9a1f', 'Meteor Shower', 'Meteor Yağmuru', 'Flaming rocks crash down from the sky.', 'Gökten alevli kayalar yağar.'),
  I('gx_goldrush', 'goalfx', 'legendary', '#ffcc2a', 'Gold Rush', 'Altına Hücum', 'A fountain of gold coins.', 'Altın para fıskiyesi.'),
  // ---- ball trails
  I('tr_basic', 'trail', 'common', '#ffffff', 'Streak', 'Çizgi', 'A simple white streak.', 'Sade beyaz iz.', true),
  I('tr_fire', 'trail', 'common', '#ff7a1f', 'Flames', 'Alev', 'The ball leaves fire behind.', 'Top arkasında ateş bırakır.'),
  I('tr_sparkle', 'trail', 'common', '#fff3a0', 'Sparkle', 'Pırıltı', 'Twinkling stars.', 'Parıldayan yıldızlar.'),
  I('tr_smoke', 'trail', 'common', '#8a8a9a', 'Smoke', 'Duman', 'A thick smoke trail.', 'Kalın duman izi.'),
  I('tr_rainbow', 'trail', 'rare', '#ff3fa4', 'Rainbow', 'Gökkuşağı', 'Every colour at once.', 'Tüm renkler bir arada.'),
  I('tr_electric', 'trail', 'rare', '#3bd9ff', 'Electric', 'Elektrik', 'Crackling sparks.', 'Çıtırdayan kıvılcımlar.'),
  I('tr_galaxy', 'trail', 'epic', '#8a5cff', 'Galaxy', 'Galaksi', 'Stars and nebula dust.', 'Yıldızlar ve nebula tozu.'),
  I('tr_ice', 'trail', 'common', '#8ad8ff', 'Frost', 'Ayaz', 'Icy crystals and snowflakes.', 'Buz kristalleri ve kar taneleri.'),
  I('tr_bubbles', 'trail', 'common', '#bfe8ff', 'Bubbles', 'Baloncuk', 'A stream of soap bubbles.', 'Sabun köpüğü baloncukları.'),
  I('tr_sakura', 'trail', 'common', '#ffb3d1', 'Petals', 'Yapraklar', 'Cherry blossom petals.', 'Kiraz çiçeği yaprakları.'),
  I('tr_hearts', 'trail', 'rare', '#ff3fa4', 'Hearts', 'Kalpler', 'Little hearts float behind the ball.', 'Topun ardından küçük kalpler süzülür.'),
  I('tr_toxic', 'trail', 'rare', '#7aff3a', 'Toxic', 'Zehir', 'Bubbling green goo.', 'Fokurdayan yeşil sıvı.'),
  I('tr_neon', 'trail', 'epic', '#ff3fa4', 'Neon', 'Neon', 'Flickering pink and cyan light.', 'Pembe ve camgöbeği yanıp sönen ışık.'),
  I('tr_shadow', 'trail', 'epic', '#6a2aa8', 'Shadow', 'Gölge', 'Dark smoke and purple embers.', 'Kara duman ve mor köz.'),
  I('tr_comet', 'trail', 'legendary', '#3f8cff', 'Comet', 'Kuyruklu Yıldız', 'A blazing blue comet tail.', 'Alevli mavi kuyruklu yıldız izi.'),
  I('tr_gold', 'trail', 'legendary', '#ffcc2a', 'Midas', 'Midas', 'Pure gold.', 'Saf altın.'),
  // ---- special items: picked up from the mystery boxes on the pitch
  I('pw_fireball', 'power', 'common', '#ff7a1f', 'Fireball', 'Ateş Topu', 'Flaming shot that flattens everyone in its path.', 'Yolundaki herkesi deviren alevli şut.', true),
  I('pw_bomb', 'power', 'common', '#8a8aa6', 'Bomb', 'Bomba', 'Lob a bomb: it blows rivals off their feet.', 'Bomba fırlat: rakipleri havaya uçurur.', true),
  I('pw_rifle', 'power', 'common', '#ffd23f', 'Blaster', 'Tüfek', 'Three quick shots knock down whoever they hit.', 'Üç hızlı atış, değdiği rakibi yere serer.', true),
  I('pw_drink', 'power', 'common', '#5ff0a4', 'Energy Drink', 'Enerji İçeceği', 'Full stamina and endless sprint for 6 seconds.', '6 saniye tam kondisyon ve sınırsız depar.'),
  I('pw_teleport', 'power', 'rare', '#b04cff', 'Teleport', 'Işınlanma', 'Blink 7 metres where you aim, ball and all.', 'Nişan aldığın yere 7 metre ışınlan, topla birlikte.'),
  I('pw_shield', 'power', 'rare', '#3bd9ff', 'Force Field', 'Kalkan', '5 seconds of bubble: tackles bounce off, rivals get knocked back.', '5 saniye baloncuk: müdahaleler seker, rakipler geri savrulur.'),
  I('pw_quake', 'power', 'epic', '#d8a018', 'Earthquake', 'Deprem', 'Shake the whole pitch: every nearby rival falls over.', 'Tüm sahayı salla: yakındaki her rakip yere düşer.'),
  I('pw_meteor', 'power', 'legendary', '#ff9a1f', 'Meteor Shower', 'Meteor Yağmuru', 'Call three meteors down on your target.', 'Hedefine üç meteor yağdır.'),
  I('pw_magnet', 'power', 'rare', '#ff3b5a', 'Magnet Boots', 'Mıknatıs', 'The ball sticks to you for 6 seconds. Nobody can steal it.', '6 saniye top sana yapışır, kimse çalamaz.'),
  I('pw_ice', 'power', 'rare', '#8ad8ff', 'Ice Shot', 'Buz Şutu', 'Freezes everyone it touches.', 'Dokunduğu herkesi dondurur.'),
  I('pw_banana', 'power', 'rare', '#ffe14d', 'Banana Shot', 'Falso Şutu', 'Bends wildly around defenders.', 'Savunmanın etrafından kıvrılır.'),
  I('pw_thunder', 'power', 'epic', '#3bd9ff', 'Thunder Shot', 'Şimşek Şutu', 'Lightning-fast, chains shocks to nearby players.', 'Şimşek hızında, yakındakilere zincirleme çarpar.'),
  I('pw_shockwave', 'power', 'epic', '#b04cff', 'Shockwave', 'Şok Dalgası', 'Slam the ground: knocks down all nearby rivals.', 'Yere vur: yakındaki tüm rakipleri devirir.'),
  I('pw_turbo', 'power', 'legendary', '#ff3b30', 'Turbo Rampage', 'Turbo Öfke', '4 seconds of unstoppable speed. Run them over!', '4 saniye durdurulamaz hız. Ezip geç!'),
];

/** Item tiers ("skins"): duplicates of an owned item upgrade its look. */
export const MAX_TIER = 5;
/** copies needed to go from tier n to n+1 (index 0 = tier 1 -> 2), by item value */
export const TIER_NEED: Record<ItemRarity, number[]> = {
  common: [2, 3, 4, 5],
  rare: [1, 2, 3, 4],
  epic: [1, 2, 2, 3],
  legendary: [1, 1, 2, 2],
};
export const TIER_NAME = {
  en: ['Standard', 'Chrome', 'Gold', 'Neon', 'Prism'],
  tr: ['Standart', 'Krom', 'Altın', 'Neon', 'Prizma'],
};
export const TIER_COLOR = ['#9aa6bd', '#dfe8f5', '#ffcc2a', '#ff3fa4', '#5ff0a4'];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const RAINBOW = ['#ff3b30', '#ff9a1f', '#ffe14d', '#5ff0a4', '#3bd9ff', '#b04cff', '#ff3fa4'];

/** Extra effect colours for an item's tier (null = standard look). */
export function tierColors(tier: number, time = 0): string[] | null {
  switch (tier) {
    case 2: return ['#ffffff', '#dfe8f5', '#9aa6bd'];
    case 3: return ['#fff2a8', '#ffcc2a', '#c88a00'];
    case 4: return ['#ff3fa4', '#3bd9ff', '#b04cff'];
    case 5: {
      const i = Math.floor(time * 12);
      return [RAINBOW[i % 7], RAINBOW[(i + 2) % 7], RAINBOW[(i + 4) % 7]];
    }
  }
  return null;
}
export const tierName = (tier: number) => (TIER_NAME[settings.lang] ?? TIER_NAME.en)[clampTier(tier) - 1];
const clampTier = (t: number) => Math.max(1, Math.min(MAX_TIER, Math.round(t)));

/** Shot powers need the ball; the rest work anywhere. */
export const SHOT_POWERS = ['fireball', 'ice', 'banana', 'thunder'];
export const LOADOUT_MIN = 3;
export const LOADOUT_MAX = 5;

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const itemName = (i: Item) => i.name[settings.lang] ?? i.name.en;
export const itemDesc = (i: Item) => i.desc[settings.lang] ?? i.desc.en;
export const POWER_ID = (id: string) => id.replace('pw_', '');
