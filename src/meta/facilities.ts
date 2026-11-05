/**
 * Club facilities: five buildings with five levels each. Every level has a
 * real effect on your club matches, income or squad.
 */
import { profile, saveProfile, spendCoins, addCard } from './profile';
import { randomCard, seriesCard, CardData } from './cards';

export type FacId = 'stadium' | 'training' | 'fitness' | 'academy' | 'scouting';
export const FAC_MAX = 5;

export interface FacDef {
  id: FacId;
  icon: string;
  name: { tr: string; en: string };
  /** what one level does (shown with the current / next value) */
  effect: { tr: string; en: string };
  /** cost to reach level 2..5 */
  cost: number[];
}

export const FACILITIES: FacDef[] = [
  { id: 'stadium', icon: '🏟️', name: { tr: 'Stadyum', en: 'Stadium' }, effect: { tr: 'Maç geliri', en: 'Match income' }, cost: [3000, 8000, 18000, 40000] },
  { id: 'training', icon: '⚽', name: { tr: 'Antrenman Sahası', en: 'Training Ground' }, effect: { tr: 'Tüm oyuncu güçleri', en: 'All player ratings' }, cost: [4000, 10000, 22000, 45000] },
  { id: 'fitness', icon: '💪', name: { tr: 'Kondisyon Merkezi', en: 'Fitness Centre' }, effect: { tr: 'Daha az yorulma', en: 'Less tiredness' }, cost: [2500, 7000, 15000, 32000] },
  { id: 'academy', icon: '🎓', name: { tr: 'Altyapı Akademisi', en: 'Youth Academy' }, effect: { tr: 'Her gün yeni genç oyuncu', en: 'A new youngster every day' }, cost: [3500, 9000, 20000, 42000] },
  { id: 'scouting', icon: '🔭', name: { tr: 'Gözlemci Ağı', en: 'Scouting Network' }, effect: { tr: 'Transfer indirimi', en: 'Transfer discount' }, cost: [2000, 6000, 14000, 30000] },
];

export const facDef = (id: FacId) => FACILITIES.find((f) => f.id === id)!;
export const facLevel = (id: FacId) => Math.max(1, Math.min(FAC_MAX, profile.facilities?.[id] ?? 1));
export const upgradeCost = (id: FacId) => facDef(id).cost[facLevel(id) - 1] ?? 0;

export function upgradeFacility(id: FacId): boolean {
  const lv = facLevel(id);
  if (lv >= FAC_MAX) return false;
  if (!spendCoins(upgradeCost(id))) return false;
  profile.facilities = { ...(profile.facilities ?? {}), [id]: lv + 1 };
  saveProfile();
  return true;
}

// ------------------------------------------------------------------ effects (level 1 = none)

/** Match coin multiplier from the stadium. */
export const stadiumIncome = (lv = facLevel('stadium')) => 1 + (lv - 1) * 0.15;
/** Seats, just for show. */
export const stadiumSeats = (lv = facLevel('stadium')) => [4000, 9000, 18000, 32000, 55000][lv - 1];
/** Attribute multiplier for club players from the training ground. */
export const trainingBoost = (lv = facLevel('training')) => 1 + (lv - 1) * 0.012;
/** Stamina drain multiplier from the fitness centre. */
export const fitnessDrain = (lv = facLevel('fitness')) => 1 - (lv - 1) * 0.06;
/** Transfer-market price multiplier from the scouting network. */
export const scoutDiscount = (lv = facLevel('scouting')) => 1 - (lv - 1) * 0.03;
/** Hours between academy graduates. */
export const academyEvery = (lv = facLevel('academy')) => [24, 20, 16, 13, 10][lv - 1];

export function effectText(id: FacId, lv: number, tr: boolean) {
  switch (id) {
    case 'stadium': return `+${Math.round((stadiumIncome(lv) - 1) * 100)}% · ${stadiumSeats(lv).toLocaleString(tr ? 'tr-TR' : 'en-US')} ${tr ? 'koltuk' : 'seats'}`;
    case 'training': return `+${((trainingBoost(lv) - 1) * 100).toFixed(1)}%`;
    case 'fitness': return `-${Math.round((1 - fitnessDrain(lv)) * 100)}%`;
    case 'academy': return `${tr ? 'her' : 'every'} ${academyEvery(lv)}${tr ? ' saatte' : 'h'} · ${lv >= 4 ? (tr ? 'altın' : 'gold') : lv >= 2 ? (tr ? 'gümüş' : 'silver') : (tr ? 'bronz' : 'bronze')}+`;
    case 'scouting': return `-${Math.round((1 - scoutDiscount(lv)) * 100)}%`;
  }
}

// ------------------------------------------------------------------ academy

export function academyReadyIn(): number {
  const next = (profile.academyAt ?? 0) || 0;
  return Math.max(0, next - Date.now());
}

/** Collect the academy graduate when he is ready. Returns the new card. */
export function claimAcademy(): CardData | null {
  if (academyReadyIn() > 0 || profile.cards.length >= 20) return null;
  const lv = facLevel('academy');
  // better academies produce better players, sometimes a Future Star
  const fs = Math.random() < (lv - 1) * 0.05;
  const r = Math.random();
  const card = fs ? seriesCard('future') : randomCard(lv >= 4 ? (r < 0.4 ? 'gold' : 'silver') : lv >= 2 ? (r < 0.25 ? 'gold' : r < 0.8 ? 'silver' : 'bronze') : r < 0.3 ? 'silver' : 'bronze');
  addCard(card);
  profile.academyAt = Date.now() + academyEvery(lv) * 3600 * 1000;
  saveProfile();
  return card;
}
