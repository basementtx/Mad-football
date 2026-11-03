/** Unlockable cosmetics and powers. */
import { settings } from '../engine/storage';

export type ItemType = 'goalfx' | 'trail' | 'power';
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
}

export const RARITY_COLOR: Record<ItemRarity, string> = {
  common: '#9aa6bd',
  rare: '#3f8cff',
  epic: '#b04cff',
  legendary: '#ff9a1f',
};

const I = (id: string, type: ItemType, rarity: ItemRarity, color: string, en: string, tr: string, den: string, dtr: string, starter = false): Item => ({
  id, type, rarity, color, name: { en, tr }, desc: { en: den, tr: dtr }, starter,
});

export const ITEMS: Item[] = [
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
export const POWER_ID = (id: string) => id.replace('pw_', '');
