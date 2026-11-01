// Pro gating helpers for components. Reads users/{uid} once and caches per uid.
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { canUse } from '@/utils/pro';
import { isNativeIOS } from '@/utils/platform';
import { ref } from 'vue';

// iOS only: RevenueCat's active 'pro' entitlement (set by utils/iap.js from getCustomerInfo / purchase / restore / the update listener)
// is trusted directly and OR'd with the Firestore/server flag, so a purchase unlocks Pro even before revenuecat-sync/webhook land.
// Reactive so views (Profile, task modal) update as soon as RevenueCat answers, even if they rendered first.
const rcPro = ref({ uid: null, active: false, plan: null });
export const setRcPro = (uid, active, plan = null) => { const next = { uid: uid || null, active: !!uid && !!active, plan: uid && active ? plan || null : null }; const cur = rcPro.value; if (next.uid !== cur.uid || next.active !== cur.active || next.plan !== cur.plan) { rcPro.value = next; clearProCache(); } };
export const rcProActive = (uid) => isNativeIOS() && rcPro.value.active && !!uid && rcPro.value.uid === uid;
// Merge RC into any users/{uid} doc snapshot: keeps a server plan (e.g. lifetime), else uses RC's plan.
export const withRcPro = (uid, data) => (rcProActive(uid) && !(data && data.isPro && data.plan === 'lifetime') ? { ...(data || {}), isPro: true, plan: rcPro.value.plan || (data && data.plan) || 'pro', proExpiresAt: null, proSource: 'revenuecat' } : data);

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
