/**
 * Self-update for the Android build.
 *
 * Every push builds a signed APK in GitHub Actions and publishes it as the
 * latest GitHub Release (tag `build-<n>`). The APK carries its own build number
 * (VITE_BUILD). On start-up and when the app comes back to the foreground, the
 * native app asks GitHub for the latest release; if it is newer, a banner offers
 * the new APK. Android then installs it over the old one (same signing key, so
 * progress and settings are kept).
 */
import { settings } from './storage';

const REPO = 'basementtx/Mad-football';
export const BUILD = Number(import.meta.env.VITE_BUILD ?? 0);

type CapWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };

function isNative() {
  return !!(window as CapWindow).Capacitor?.isNativePlatform?.();
}

let shown = false;
let lastCheck = 0;

export function initUpdater() {
  if (!isNative() || !BUILD) return;
  void check();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastCheck > 10 * 60 * 1000) void check();
  });
}

async function check() {
  lastCheck = Date.now();
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) return;
    const rel = (await r.json()) as { tag_name?: string; assets?: { name: string; browser_download_url: string }[] };
    const latest = Number(/(\d+)$/.exec(rel.tag_name ?? '')?.[1] ?? 0);
    const apk = rel.assets?.find((a) => a.name.endsWith('.apk'));
    if (latest > BUILD && apk) showBanner(latest, apk.browser_download_url);
  } catch {
    /* offline: try again later */
  }
}

function showBanner(latest: number, url: string) {
  if (shown) return;
  shown = true;
  const tr = settings.lang === 'tr';
  const el = document.createElement('div');
  el.id = 'update-banner';
  el.innerHTML = `
    <span>${tr ? 'Yeni sürüm hazır' : 'New version available'} <b>#${latest}</b> <small>(${tr ? 'şu an' : 'now'} #${BUILD})</small></span>
    <button class="upd-go">${tr ? 'GÜNCELLE' : 'UPDATE'}</button>
    <button class="upd-later">${tr ? 'Sonra' : 'Later'}</button>`;
  document.body.appendChild(el);
  el.querySelector('.upd-go')!.addEventListener('click', (e) => {
    e.stopPropagation();
    // Capacitor hands external URLs to the system browser, which downloads the APK.
    window.location.href = url;
  });
  el.querySelector('.upd-later')!.addEventListener('click', (e) => {
    e.stopPropagation();
    el.remove();
    shown = false;
  });
}
