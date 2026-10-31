// App Tracking Transparency: ask once, after onboarding, on the first Home visit (never on cold launch / splash / welcome / onboarding).
// Native side: ClingNative.requestTracking -> InstallAttribution.requestTracking (iOS shows the system prompt at most once anyway).
// Denied/restricted/unavailable: nothing else changes (Firebase/TikTok keep running without IDFA). Never throws.
export const ATT_ASKED_KEY = 'cn.att.asked';
export const ATT_DELAY_MS = 1500;

export async function maybeAskTracking({ native, storage, delayMs = ATT_DELAY_MS, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  try {
    if (!native || !storage) return { asked: false, status: 'unavailable' };
    if (storage.getItem(ATT_ASKED_KEY)) return { asked: false, status: 'skipped' };
    const { status } = (await native.trackingStatus()) || {};
    if (status !== 'notDetermined') {
      if (status && status !== 'unavailable') storage.setItem(ATT_ASKED_KEY, status);
      return { asked: false, status: status || 'unavailable' };
    }
    if (delayMs) await wait(delayMs); // let Home render first
    storage.setItem(ATT_ASKED_KEY, 'pending');
    const res = (await native.requestTracking()) || {};
    storage.setItem(ATT_ASKED_KEY, res.status || 'unknown');
    return { asked: true, status: res.status || 'unknown' };
  } catch (e) {
    return { asked: false, status: 'error' };
  }
}
