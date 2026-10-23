// Pro gating helpers for components. Reads users/{uid} once and caches per uid.
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { canUse } from '@/utils/pro';
import { isNativeIOS } from '@/utils/platform';

// iOS only: RevenueCat's active 'pro' entitlement (set by utils/iap.js from getCustomerInfo / purchase / restore / the update listener)
// is trusted directly and OR'd with the Firestore/server flag, so a purchase unlocks Pro even before revenuecat-sync/webhook land.
let rcPro = { uid: null, active: false };
export const setRcPro = (uid, active) => { const next = { uid: uid || null, active: !!uid && !!active }; if (next.uid !== rcPro.uid || next.active !== rcPro.active) { rcPro = next; clearProCache(); } };
export const rcProActive = (uid) => isNativeIOS() && rcPro.active && !!uid && rcPro.uid === uid;
export const withRcPro = (uid, data) => (rcProActive(uid) ? { ...(data || {}), isPro: true, proExpiresAt: null, proSource: 'revenuecat' } : data);

let cache = { uid: null, data: null, at: 0 };
export async function loadUserDoc(force = false) {
  const u = auth.currentUser; if (!u) return null;
  if (!force && cache.uid === u.uid && Date.now() - cache.at < 60000) return withRcPro(u.uid, cache.data);
  try { const s = await getDoc(doc(db, 'users', u.uid)); cache = { uid: u.uid, data: s.exists() ? s.data() : {}, at: Date.now() }; }
  catch (e) { console.error('pro check', e.message); return withRcPro(u.uid, cache.uid === u.uid ? cache.data : null); }
  return withRcPro(u.uid, cache.data);
}
export const clearProCache = () => { cache = { uid: null, data: null, at: 0 }; };
// Returns true if allowed; otherwise sends the user to the paywall and returns false.
export async function requirePro(router, feature) {
  const d = await loadUserDoc();
  if (canUse(d, feature)) return true;
  router.push({ path: '/paywall', query: { feature, from: router.currentRoute.value.fullPath } });
  return false;
}
