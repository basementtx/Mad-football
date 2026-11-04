/**
 * Local notifications (Android): "your free crate is ready" and "new offers in
 * the Store". Scheduled whenever the app goes to the background, cancelled and
 * re-planned when it comes back, so they always match the real timers.
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import { settings } from './storage';
import { profile } from '../meta/profile';
import { store } from '../meta/cosmetics';

type CapWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };
const native = () => !!(window as CapWindow).Capacitor?.isNativePlatform?.();
const IDS = [101, 102];
let allowed: boolean | null = null;

async function permission() {
  if (allowed !== null) return allowed;
  try {
    let st = await LocalNotifications.checkPermissions();
    if (st.display === 'prompt' || st.display === 'prompt-with-rationale') st = await LocalNotifications.requestPermissions();
    allowed = st.display === 'granted';
  } catch {
    allowed = false;
  }
  return allowed;
}

async function cancelAll() {
  try {
    await LocalNotifications.cancel({ notifications: IDS.map((id) => ({ id })) });
  } catch {
    /* ignore */
  }
}

async function schedule() {
  if (!(await permission())) return;
  await cancelAll();
  const tr = settings.lang === 'tr';
  const now = Date.now();
  const list = [];
  if (profile.club && profile.freeCrateAt > now + 30_000) {
    list.push({
      id: IDS[0],
      title: tr ? 'Bedava sandığın hazır! 🎁' : 'Your free crate is ready! 🎁',
      body: tr ? 'Gel aç, içinde ne var bakalım.' : 'Come and open it - see what is inside.',
      schedule: { at: new Date(profile.freeCrateAt), allowWhileIdle: true },
    });
  }
  if (profile.club && store.at > now + 30_000) {
    list.push({
      id: IDS[1],
      title: tr ? 'Mağazada yeni fırsatlar! 🛒' : 'New deals in the Store! 🛒',
      body: tr ? 'Günün fırsatları yenilendi, flaş indirim seni bekliyor.' : 'Daily deals refreshed - a flash deal is waiting.',
      schedule: { at: new Date(store.at), allowWhileIdle: true },
    });
  }
  if (list.length) {
    try {
      await LocalNotifications.schedule({ notifications: list });
    } catch {
      /* ignore */
    }
  }
}

export function initNotifications() {
  if (!native()) return;
  // ask once early (on the first launch) so the reminders can work
  setTimeout(() => void permission(), 4000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void schedule();
    else void cancelAll();
  });
}
