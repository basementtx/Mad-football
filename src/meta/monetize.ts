/**
 * Monetization hooks: rewarded ads and coin packs.
 *
 * Both go through a swappable provider so the store release only has to plug
 * in the real SDKs (e.g. AdMob rewarded ads and Google Play Billing / StoreKit
 * through Capacitor plugins) with `setAdProvider` / `setIapProvider`:
 *
 *   ads:  show(placement) resolves true only when the ad was watched to the end
 *   iap:  buy(productId) resolves 'ok' after the store confirmed the purchase
 *
 * Until then the ad provider is a built-in placeholder (a short in-game promo
 * with a countdown) and purchases report that the store is not live yet.
 */
import { addCoins } from './profile';

// ------------------------------------------------------------------ rewarded ads

export type AdPlacement = 'match_bonus' | 'market_refresh' | 'store_refresh' | 'free_coins';

/** how many rewarded ads of each kind a player can watch per day */
export const AD_DAILY: Record<AdPlacement, number> = { match_bonus: 20, market_refresh: 3, store_refresh: 3, free_coins: 5 };
/** coins for the free "watch an ad" pack in the coin shop */
export const FREE_AD_COINS = 750;

export interface AdProvider {
  show(placement: AdPlacement): Promise<boolean>;
}

const AKEY = 'mf.ads';
interface AdLog { day: string; used: Partial<Record<AdPlacement, number>> }
const today = () => new Date().toISOString().slice(0, 10);

function loadLog(): AdLog {
  try {
    const l = JSON.parse(localStorage.getItem(AKEY) || 'null') as AdLog | null;
    if (l && l.day === today()) return l;
  } catch {
    /* ignore */
  }
  return { day: today(), used: {} };
}
function saveLog(l: AdLog) {
  try {
    localStorage.setItem(AKEY, JSON.stringify(l));
  } catch {
    /* ignore */
  }
}

export function adsLeft(p: AdPlacement) {
  return Math.max(0, AD_DAILY[p] - (loadLog().used[p] ?? 0));
}

let adProvider: AdProvider | null = null;
let showing = false;
export const setAdProvider = (p: AdProvider) => { adProvider = p; };

/** Show a rewarded ad. Resolves true when the reward should be given. */
export async function watchAd(p: AdPlacement): Promise<boolean> {
  if (showing || adsLeft(p) <= 0) return false;
  showing = true;
  try {
    const ok = await (adProvider ?? placeholderAds).show(p);
    if (ok) {
      const l = loadLog();
      l.used[p] = (l.used[p] ?? 0) + 1;
      saveLog(l);
    }
    return ok;
  } finally {
    showing = false;
  }
}

/** Stand-in until the ad SDK is wired: a skippable-after-5s in-game promo. */
const placeholderAds: AdProvider = {
  show() {
    return new Promise((resolve) => {
      const tr = document.documentElement.lang === 'tr';
      const SECS = 5;
      const el = document.createElement('div');
      el.className = 'ad-layer';
      el.innerHTML = `<div class="ad-box">
          <div class="ad-top"><span class="ad-tag">${tr ? 'REKLAM' : 'AD'}</span><b class="ad-count">${SECS}</b><button class="ad-x" aria-label="close">×</button></div>
          <div class="ad-art"><div class="ad-rays"></div><div class="ad-logo">MAD<br>FOOTBALL</div><div class="ad-sub">${tr ? 'Kural yok. Hakem yok. Sadece futbol.' : 'No rules. No referee. Just football.'}</div></div>
          <div class="ad-bar"><i></i></div>
          <button class="ad-claim" disabled>${tr ? 'ÖDÜLÜ AL' : 'CLAIM REWARD'} ✓</button>
        </div>`;
      document.body.appendChild(el);
      const count = el.querySelector<HTMLElement>('.ad-count')!;
      const claim = el.querySelector<HTMLButtonElement>('.ad-claim')!;
      const bar = el.querySelector<HTMLElement>('.ad-bar i')!;
      requestAnimationFrame(() => { bar.style.transitionDuration = SECS + 's'; bar.style.transform = 'scaleX(1)'; });
      let left = SECS;
      const iv = setInterval(() => {
        left--;
        count.textContent = left > 0 ? String(left) : '✓';
        if (left <= 0) {
          clearInterval(iv);
          claim.disabled = false;
          el.classList.add('done');
        }
      }, 1000);
      const close = (ok: boolean) => {
        clearInterval(iv);
        el.classList.add('out');
        setTimeout(() => el.remove(), 250);
        resolve(ok);
      };
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      claim.addEventListener('click', (e) => { e.stopPropagation(); close(true); });
      // closing before the end forfeits the reward
      el.querySelector('.ad-x')!.addEventListener('click', (e) => { e.stopPropagation(); close(left <= 0); });
    });
  },
};

// ------------------------------------------------------------------ coin packs (in-app purchases)

export interface CoinPack {
  id: string;
  coins: number;
  /** extra coins shown as a "+x%" bonus */
  bonus: number;
  price: { tr: string; en: string };
  tag?: 'popular' | 'best';
  /** visual size of the coin pile (1..5) */
  pile: number;
}

export const COIN_PACKS: CoinPack[] = [
  { id: 'coins_1', coins: 5000, bonus: 0, price: { tr: '₺39,99', en: '$0.99' }, pile: 1 },
  { id: 'coins_2', coins: 12000, bonus: 10, price: { tr: '₺79,99', en: '$1.99' }, pile: 2 },
  { id: 'coins_3', coins: 32000, bonus: 20, price: { tr: '₺179,99', en: '$4.99' }, pile: 3, tag: 'popular' },
  { id: 'coins_4', coins: 70000, bonus: 35, price: { tr: '₺349,99', en: '$9.99' }, pile: 4 },
  { id: 'coins_5', coins: 160000, bonus: 50, price: { tr: '₺699,99', en: '$19.99' }, pile: 5, tag: 'best' },
];

export type BuyResult = 'ok' | 'cancelled' | 'unavailable';
export interface IapProvider {
  buy(productId: string): Promise<BuyResult>;
}
let iapProvider: IapProvider | null = null;
export const setIapProvider = (p: IapProvider) => { iapProvider = p; };
/** true once a real store is connected */
export const storeLive = () => !!iapProvider;

/** Buy a coin pack; coins are only added after the store confirms the payment. */
export async function buyPack(pack: CoinPack): Promise<BuyResult> {
  if (!iapProvider) return 'unavailable';
  const r = await iapProvider.buy(pack.id);
  if (r === 'ok') addCoins(Math.round(pack.coins * (1 + pack.bonus / 100)));
  return r;
}
