// App Store rating prompt (Apple's native SKStoreReviewController via @capacitor-community/in-app-review).
// Guideline 5.6.3: never request a rating on first launch or during onboarding.
// The only automatic trigger is a later positive moment: a full 8-task session just completed,
// or the Boss vault app just unlocked. Never after a delay (no 2s home-load wait, no 2-hour cooldown).
// Never on the first launch day or the first app session. At most once per app version.
// No custom "Enjoying ClingNote?" / "do you like it?" gate (5.6.1 / 1.1.7).
// Web / Android: native request is a no-op. Every path is wrapped so it can never throw into the UI.
import { isNativeIOS } from '@/utils/platform';

export const APP_STORE_ID = '6826148686';
export const WRITE_REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
export const REVIEW_APP_VERSION = (typeof process !== 'undefined' && process.env && process.env.VUE_APP_VERSION) || '1.0';
export const REVIEW_REASONS = Object.freeze({ SESSION_COMPLETE: 'session_complete', BOSS_UNLOCK: 'boss_unlock' });
const REASONS = new Set(Object.values(REVIEW_REASONS));

const FIRST_LAUNCH_AT = 'cn_review_first_launch_at';
const LAUNCH_COUNT = 'cn_review_launch_count';
const LAUNCH_COUNTED = 'cn_review_launch_counted';
const doneKey = (uid, version) => `cn_review_requested_${uid}_${version}`;
const oldDoneKey = (uid) => `cn_review_requested_${uid}`;
const pendingKey = (uid) => `cn_review_pending_${uid}`;

const ls = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };
const ss = () => { try { return (typeof window !== 'undefined' && window.sessionStorage) ? window.sessionStorage : null; } catch (e) { return null; } };
const get = (k) => { try { return ls()?.getItem(k) || null; } catch (e) { return null; } };
const set = (k, v) => { try { ls()?.setItem(k, v); } catch (e) { /* storage blocked */ } };
const del = (k) => { try { ls()?.removeItem(k); } catch (e) { /* storage blocked */ } };

export const localDay = (ms = Date.now()) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const parseLaunchCount = () => {
  const n = parseInt(get(LAUNCH_COUNT) || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Stamp the first-launch time once and count this JS runtime as one app session.
// sessionStorage keeps a cold start from being counted twice while the WebView stays alive.
export function noteAppLaunch(now = Date.now()) {
  try {
    if (!get(FIRST_LAUNCH_AT)) set(FIRST_LAUNCH_AT, String(now));
    const sess = ss();
    if (sess && sess.getItem(LAUNCH_COUNTED)) return parseLaunchCount();
    try { sess?.setItem(LAUNCH_COUNTED, '1'); } catch (e) { /* session blocked */ }
    const n = parseLaunchCount() + 1;
    set(LAUNCH_COUNT, String(n));
    return n;
  } catch (e) { return parseLaunchCount(); }
}

export function firstLaunchAt() {
  const raw = get(FIRST_LAUNCH_AT);
  const n = raw != null ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function launchCount() { return parseLaunchCount(); }

const migrateLegacyDone = (uid, version) => {
  if (!uid || get(doneKey(uid, version))) return;
  // An older build stored an unversioned flag after the first-launch prompt. Keep that as "already asked" for 1.0 only.
  if (String(version) === '1.0' && get(oldDoneKey(uid))) set(doneKey(uid, version), get(oldDoneKey(uid)));
};

export const wasReviewRequested = (uid, version = REVIEW_APP_VERSION) => {
  if (!uid) return false;
  migrateLegacyDone(uid, version);
  return !!get(doneKey(uid, version));
};

// Pure eligibility. Callers must pass a positive-moment reason and onboardingComplete: true.
export function reviewEligibility(uid, { reason, onboardingComplete = false, now = Date.now(), version = REVIEW_APP_VERSION } = {}) {
  try {
    noteAppLaunch(now);
    if (uid) del(pendingKey(uid)); // leftover arm from the rejected first-launch prompt
    if (!uid) return { ok: false, why: 'no-uid' };
    if (onboardingComplete !== true) return { ok: false, why: 'onboarding' };
    if (!REASONS.has(reason)) return { ok: false, why: 'reason' };
    if (wasReviewRequested(uid, version)) return { ok: false, why: 'already' };
    const first = firstLaunchAt() || now;
    if (localDay(first) === localDay(now)) return { ok: false, why: 'first-day' };
    if (parseLaunchCount() < 2) return { ok: false, why: 'first-session' };
    return { ok: true, why: 'ok' };
  } catch (e) { return { ok: false, why: 'error' }; }
}

async function nativeRequest() {
  if (!isNativeIOS()) return false;
  const { InAppReview } = await import('@capacitor-community/in-app-review');
  await InAppReview.requestReview();
  return true;
}

// Returns true if this call fired the native prompt. Persists BEFORE calling Apple so it cannot re-fire from our side.
export async function maybeRequestReview(uid, { reason, onboardingComplete = false, now = Date.now(), version = REVIEW_APP_VERSION, request = nativeRequest } = {}) {
  try {
    const gate = reviewEligibility(uid, { reason, onboardingComplete, now, version });
    if (!gate.ok) return false;
    set(doneKey(uid, version), new Date(now).toISOString());
    try { if (typeof window !== 'undefined') window.dispatchEvent(new window.CustomEvent('cn:review-requested', { detail: { uid, version, reason } })); } catch (e) { /* old webview */ }
    try { await request(); } catch (e) { /* plugin missing / Apple declined: ignore */ }
    return true;
  } catch (e) { return false; }
}

// Settings row: opens the App Store write-review page (works on web too). User-initiated, not an automatic prompt.
export async function openWriteReview() {
  // iOS: itms-apps:// is handed to the App Store app by Capacitor's navigation delegate (the https page in SFSafariViewController can't write a review).
  try { if (isNativeIOS()) { window.location.href = WRITE_REVIEW_URL.replace(/^https:/, 'itms-apps:'); return true; }
    const { openExternal } = await import('@/utils/openExternal'); return await openExternal(WRITE_REVIEW_URL); }
  catch (e) { try { window.open(WRITE_REVIEW_URL, '_blank', 'noopener'); } catch (_) { /* ignore */ } }
}
