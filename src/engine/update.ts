/**
 * Self-update for the Android build.
 *
 * Every push builds a signed APK in GitHub Actions and publishes it as the
 * latest GitHub Release (tag `build-<n>`); the APK knows its own build number
 * (VITE_BUILD). On start-up and whenever the app returns to the foreground we
 * ask GitHub for the latest release. If it is newer, the native side
 * (MainActivity → window.MFNative) downloads the APK in the background and, once
 * it is ready, a banner offers a one-tap install. Android always asks the user
 * to confirm an install for apps outside the Play Store; everything else is
 * automatic. Same signing key every build, so saves and settings are kept.
 */
import { settings } from './storage';

const REPO = 'basementtx/Mad-football';
export const BUILD = Number(import.meta.env.VITE_BUILD ?? 0);

interface NativeUpdater {
  download(url: string): void;
  install(): boolean;
}
type UpdWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
  MFNative?: NativeUpdater;
  __mfUpdate?: (state: string, value: number) => void;
};
const w = window as UpdWindow;

const isNative = () => !!w.Capacitor?.isNativePlatform?.();
const tr = () => settings.lang === 'tr';

let lastCheck = 0;
let target = 0;
let phase: 'idle' | 'downloading' | 'ready' | 'error' = 'idle';
let banner: HTMLElement | null = null;

/** The Google Play build is updated by the Play Store only (Play policy): no self-update there. */
const PLAY_STORE = import.meta.env.VITE_STORE === 'play';

export function initUpdater() {
  if (PLAY_STORE || !isNative() || !BUILD) return;
  w.__mfUpdate = onNative;
  void check();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastCheck > 5 * 60 * 1000) void check();
  });
  setInterval(() => { if (!document.hidden) void check(); }, 30 * 60 * 1000);
}

async function check() {
  if (phase === 'downloading' || phase === 'ready') return;
  lastCheck = Date.now();
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) return;
    const rel = (await r.json()) as { tag_name?: string; assets?: { name: string; browser_download_url: string }[] };
    const latest = Number(/(\d+)$/.exec(rel.tag_name ?? '')?.[1] ?? 0);
    const apk = rel.assets?.find((a) => a.name.endsWith('.apk'));
    if (latest <= BUILD || !apk) return;
    target = latest;
    if (w.MFNative) {
      phase = 'downloading';
      render(0);
      w.MFNative.download(apk.browser_download_url);
    } else {
      // older shell without the native downloader: hand the APK to the browser
      showFallback(apk.browser_download_url);
    }
  } catch {
    /* offline: try again later */
  }
}

/** Progress / result callbacks from MainActivity. */
function onNative(state: string, value: number) {
  if (state === 'progress') render(value);
  else if (state === 'ready') {
    phase = 'ready';
    render(1);
  } else if (state === 'error') {
    phase = 'error';
    render(0);
    // retry on the next foreground / interval check
    setTimeout(() => { phase = 'idle'; banner?.remove(); banner = null; }, 6000);
  }
}

function ensureBanner() {
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.addEventListener('click', () => banner?.classList.remove('min'));
    document.body.appendChild(banner);
  }
  return banner;
}

function render(p: number) {
  const el = ensureBanner();
  const T = tr();
  const bar = el.querySelector<HTMLElement>('.upd-bar > i');
  if (phase === 'downloading' && bar) {
    bar.style.width = `${Math.round(p * 100)}%`;
    return;
  }
  el.className = phase;
  if (phase === 'downloading') {
    el.innerHTML = `<span>${T ? 'Güncelleme indiriliyor' : 'Downloading update'} <b>#${target}</b></span><i class="upd-bar"><i style="width:${Math.round(p * 100)}%"></i></i>`;
  } else if (phase === 'ready') {
    el.innerHTML = `<span>${T ? 'Yeni sürüm hazır' : 'Update ready'} <b>#${target}</b> <small>(${T ? 'şu an' : 'now'} #${BUILD})</small></span>
      <button class="upd-go">${T ? 'YÜKLE' : 'INSTALL'}</button>
      <button class="upd-later">${T ? 'Sonra' : 'Later'}</button>`;
    el.querySelector('.upd-go')!.addEventListener('click', (e) => {
      e.stopPropagation();
      const ok = w.MFNative?.install();
      if (ok === false) {
        el.querySelector('span')!.innerHTML = T
          ? 'Ayarlardan <b>bu kaynaktan yüklemeye izin ver</b>, sonra tekrar YÜKLE’ye bas'
          : 'Allow <b>install unknown apps</b> in Settings, then tap INSTALL again';
      }
    });
    el.querySelector('.upd-later')!.addEventListener('click', (e) => {
      e.stopPropagation();
      el.classList.add('min');
    });
  } else if (phase === 'error') {
    el.innerHTML = `<span>${T ? 'Güncelleme indirilemedi, sonra tekrar denenecek' : 'Update download failed, will retry later'}</span>`;
  }
}

function showFallback(url: string) {
  phase = 'ready';
  const el = ensureBanner();
  const T = tr();
  el.className = 'ready';
  el.innerHTML = `<span>${T ? 'Yeni sürüm hazır' : 'New version available'} <b>#${target}</b></span>
    <button class="upd-go">${T ? 'GÜNCELLE' : 'UPDATE'}</button>`;
  el.querySelector('.upd-go')!.addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = url;
  });
}
