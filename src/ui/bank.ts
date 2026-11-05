/** Coin shop: coin packs (in-app purchases, wired at store release) and a free ad pack. */
import { settings, record } from '../engine/storage';
import { audio, vibrate } from '../engine/audio';
import { addCoins } from '../meta/profile';
import { COIN_PACKS, CoinPack, buyPack, watchAd, adsLeft, AD_DAILY, FREE_AD_COINS } from '../meta/monetize';
import { setScreen, bind, coinTag, coinsPill, toast, ui, MenuHandlers } from './common';
import { showHub } from './hub';
import { showShop } from './shop';
import { showMarket } from './market';
import { showLeague } from './league';
import { showSquad } from './club';

const L2 = (en: string, tr: string) => (settings.lang === 'tr' ? tr : en);
const fmt = (n: number) => n.toLocaleString(settings.lang === 'tr' ? 'tr-TR' : 'en-US');

/** Where "back" goes: the screen the shop was opened from. */
function backFor(h: MenuHandlers, from: string): () => void {
  if (from.includes('screen-shop')) return () => showShop(h);
  if (from.includes('screen-market')) return () => showMarket(h);
  if (from.includes('screen-league')) return () => showLeague(h);
  if (from.includes('screen-squad')) return () => showSquad(h);
  return () => showHub(h);
}

/** A pile of coins that grows with the pack. */
function pile(n: number) {
  const rows = [1, 2, 3, 4, 5].slice(0, n + 1).reverse();
  let html = '';
  rows.forEach((cnt, r) => {
    html += `<div class="bk-row" style="--r:${r}">`;
    for (let i = 0; i < cnt; i++) html += coinTag('bk-coin');
    html += '</div>';
  });
  return `<div class="bk-pile p${n}">${html}</div>`;
}

function packTile(p: CoinPack) {
  const total = Math.round(p.coins * (1 + p.bonus / 100));
  const tag = p.tag === 'best' ? L2('BEST VALUE', 'EN İYİ DEĞER') : p.tag === 'popular' ? L2('POPULAR', 'POPÜLER') : '';
  return `<button class="bk-pack ${p.tag ?? ''}" data-pack="${p.id}">
    ${tag ? `<span class="bk-ribbon">${tag}</span>` : ''}
    ${p.bonus ? `<span class="bk-bonus">+${p.bonus}%</span>` : ''}
    <div class="bk-glow"></div>
    ${pile(p.pile)}
    <b class="bk-amt">${fmt(total)}</b>
    ${p.bonus ? `<s class="bk-was">${fmt(p.coins)}</s>` : '<span class="bk-was">&nbsp;</span>'}
    <span class="bk-price">${settings.lang === 'tr' ? p.price.tr : p.price.en}</span>
  </button>`;
}

export function showBank(h: MenuHandlers, back?: () => void) {
  const from = ui().className;
  const goBack = back ?? backFor(h, from);
  const render = () => {
    const left = adsLeft('free_coins');
    setScreen(
      'screen-bank',
      `<div class="bank">
        <div class="panel-head">
          <button class="btn btn-ghost btn-sm" data-act="back">‹ ${L2('BACK', 'GERİ')}</button>
          <div class="panel-title">${L2('COIN SHOP', 'ALTIN MAĞAZASI')}</div>
          ${coinsPill()}
        </div>
        <div class="bk-grid">
          <button class="bk-pack bk-free ${left ? '' : 'used'}" data-act="free">
            <span class="bk-ribbon">${L2('FREE', 'ÜCRETSİZ')}</span>
            <div class="bk-glow"></div>
            <div class="bk-tv"><i></i><b>▶</b></div>
            <b class="bk-amt">+${fmt(FREE_AD_COINS)}</b>
            <span class="bk-was">${L2('today', 'bugün')} ${left}/${AD_DAILY.free_coins}</span>
            <span class="bk-price">${left ? L2('WATCH AD', 'REKLAM İZLE') : L2('COME BACK TOMORROW', 'YARIN GEL')}</span>
          </button>
          ${COIN_PACKS.map(packTile).join('')}
        </div>
        <div class="bk-note">${L2('Prices are examples; final prices come from the app store.', 'Fiyatlar örnektir; kesin fiyatlar uygulama mağazasından gelir.')}</div>
      </div>`,
    );
    bind('[data-act=back]', () => { audio.click(); goBack(); });
    bind('[data-act=free]', async () => {
      if (!adsLeft('free_coins')) { toast(L2('No more free coins today', 'Bugünlük ücretsiz altın bitti')); return; }
      audio.click();
      if (await watchAd('free_coins')) {
        addCoins(FREE_AD_COINS);
        audio.horn();
        vibrate([30, 30, 60]);
        toast(`+${fmt(FREE_AD_COINS)} ${L2('coins', 'altın')}!`);
        render();
      }
    });
    bind('[data-pack]', async (el) => {
      const p = COIN_PACKS.find((x) => x.id === el.dataset.pack)!;
      audio.click();
      const r = await buyPack(p);
      if (r === 'ok') {
        audio.horn();
        audio.cheer(0.6);
        vibrate([40, 30, 80]);
        toast(`+${fmt(Math.round(p.coins * (1 + p.bonus / 100)))} ${L2('coins', 'altın')}!`);
        render();
      } else if (r === 'unavailable') {
        toast(L2('Purchases open with the app store release', 'Satın alma, uygulama mağazası sürümüyle açılacak'));
      }
    });
  };
  render();
  void record;
}

/** Tapping a coin counter anywhere in the menus opens the coin shop. */
export function installBankShortcut(h: MenuHandlers) {
  ui().addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (ui().classList.contains('screen-bank')) return;
    if (t.closest('.coins-pill, .mk-wallet')) {
      e.stopPropagation();
      audio.click();
      showBank(h);
    }
  });
}
