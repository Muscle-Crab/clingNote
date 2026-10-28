// Shared appearance state (theme + text size), saved per device. Applied before the first render from main.js.
import { ref } from 'vue';
import { loadAppearance, saveAppearance, applyAppearance } from '@/utils/appearance';
import { isNativeIOS } from '@/utils/platform';
import { clingNative } from '@/native/clingNative';

const storage = () => (typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem() {} });
export const appearance = ref(loadAppearance(storage()));
export const appliedAppearance = ref({ theme: 'dark', zoom: 1 });

const env = () => ({
  document, native: isNativeIOS(),
  matchMedia: typeof window !== 'undefined' && window.matchMedia ? (q) => window.matchMedia(q) : null,
  setPageZoom: (z) => { clingNative.setPageZoom(z).catch?.(() => {}); },
});
export const reapplyAppearance = () => { if (typeof document === 'undefined') return null; appliedAppearance.value = applyAppearance(appearance.value, env()); return appliedAppearance.value; };

let started = false;
export const initAppearance = () => {
  if (started || typeof window === 'undefined') return; started = true;
  reapplyAppearance();
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq) { const on = () => { if (appearance.value.mode === 'system') reapplyAppearance(); }; if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on); }
  // iOS Dynamic Type can change in Settings while the app is in the background: re-measure when it comes back.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && appearance.value.text === 'system') reapplyAppearance(); });
};
export const setAppearance = (patch) => { appearance.value = saveAppearance(storage(), { ...appearance.value, ...patch }); return reapplyAppearance(); };
