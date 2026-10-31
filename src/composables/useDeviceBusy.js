// B44: read-only busy times from the user's other device calendars (EventKit through ClingNative.busy; times only, no titles,
// the ClingNote calendar excluded). Only read once the user has turned Calendar sync on (that is when iOS calendar access was
// granted), so the picker never triggers a permission prompt. Emulator/e2e builds can inject window.__CN_TEST_BUSY__.
import { ref } from 'vue';
import { clingNative, nativeAvailable } from '@/native/clingNative';
import { loadSyncState } from '@/composables/useCalendarSync';

const cache = new Map(); const TTL = 60000;
export const deviceBusy = ref([]);
export const busyAvailable = (uid) => {
  if (process.env.VUE_APP_FIREBASE_EMULATORS === '1' && typeof window !== 'undefined' && Array.isArray(window.__CN_TEST_BUSY__)) return true;
  return !!uid && nativeAvailable() && !!loadSyncState(uid).enabled;
};
// [{ startMs, endMs }] for [fromMs, toMs)
export const loadDeviceBusy = async (uid, fromMs, toMs) => {
  if (process.env.VUE_APP_FIREBASE_EMULATORS === '1' && typeof window !== 'undefined' && Array.isArray(window.__CN_TEST_BUSY__)) return window.__CN_TEST_BUSY__.filter((b) => b.endMs > fromMs && b.startMs < toMs);
  if (!busyAvailable(uid)) return [];
  const k = `${uid}|${Math.floor(fromMs / TTL)}|${Math.floor(toMs / TTL)}`; const c = cache.get(k); if (c && Date.now() - c.at < TTL) return c.v;
  try { const r = await clingNative.busy(fromMs, toMs, loadSyncState(uid).calendarId || ''); const v = (r && r.busy) || []; cache.set(k, { at: Date.now(), v }); return v; } catch (e) { return []; }
};
