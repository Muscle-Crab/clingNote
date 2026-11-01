// App Store rating prompt (Apple's native SKStoreReviewController via @capacitor-community/in-app-review).
// Asked ONCE per user per device, ~2s after the user lands on /home right after finishing onboarding + sign-up
// (onboarding's finish() runs when the embedded paywall closes, so the prompt always comes after the paywall).
// No custom "do you like it?" gate (Apple guideline 1.1.7 / 5.6.1 forbid gating the native prompt).
// Web / Android: no-op. Every path is wrapped so it can never throw into the UI.
import { isNativeIOS } from '@/utils/platform';

export const APP_STORE_ID = '6826148686';
export const WRITE_REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
export const REVIEW_DELAY_MS = 2000;
const pendingKey = (uid) => `cn_review_pending_${uid}`;
const doneKey = (uid) => `cn_review_requested_${uid}`;
const ls = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };
const get = (k) => { try { return ls()?.getItem(k) || null; } catch (e) { return null; } };
const set = (k, v) => { try { ls()?.setItem(k, v); } catch (e) { /* storage blocked */ } };
const del = (k) => { try { ls()?.removeItem(k); } catch (e) { /* storage blocked */ } };

export const wasReviewRequested = (uid) => !!uid && !!get(doneKey(uid));
// Called by onboarding finish(): arm the one-time prompt for the next /home landing (skipped if already asked, e.g. Replay onboarding).
export function markReviewPending(uid) { if (uid && !wasReviewRequested(uid)) set(pendingKey(uid), String(Date.now())); }

async function nativeRequest() {
  if (!isNativeIOS()) return false;
  const { InAppReview } = await import('@capacitor-community/in-app-review');
  await InAppReview.requestReview();
  return true;
}

// Called from HomeView onMounted. Returns true if it fired this time. Persists BEFORE calling Apple so it can never re-fire from our side.
export async function maybeRequestReview(uid, { delayMs = REVIEW_DELAY_MS, request = nativeRequest, wait = (ms) => new Promise((r) => setTimeout(r, ms)), stillOnHome = () => true } = {}) {
  try {
    if (!uid || wasReviewRequested(uid) || !get(pendingKey(uid))) return false;
    await wait(delayMs);
    if (!stillOnHome() || wasReviewRequested(uid)) return false; // navigated away: stays pending for the next landing
    set(doneKey(uid), new Date().toISOString()); del(pendingKey(uid));
    try { if (typeof window !== 'undefined') window.dispatchEvent(new window.CustomEvent('cn:review-requested', { detail: { uid } })); } catch (e) { /* old webview */ }
    try { await request(); } catch (e) { /* plugin missing / Apple declined: ignore */ }
    return true;
  } catch (e) { return false; }
}

// Settings row: opens the App Store write-review page (works on web too).
export async function openWriteReview() {
  // iOS: itms-apps:// is handed to the App Store app by Capacitor's navigation delegate (the https page in SFSafariViewController can't write a review).
  try { if (isNativeIOS()) { window.location.href = WRITE_REVIEW_URL.replace(/^https:/, 'itms-apps:'); return true; }
    const { openExternal } = await import('@/utils/openExternal'); return await openExternal(WRITE_REVIEW_URL); }
  catch (e) { try { window.open(WRITE_REVIEW_URL, '_blank', 'noopener'); } catch (_) { /* ignore */ } }
}
