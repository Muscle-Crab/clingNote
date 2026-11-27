// Pro gating helpers for components. Reads users/{uid} once and caches per uid.
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { canUse, isPro, accessPro } from '@/utils/pro';
import { isNativeIOS } from '@/utils/platform';
import { ref, watch } from 'vue';

// iOS only: RevenueCat's active 'pro' entitlement (set by utils/iap.js from getCustomerInfo / purchase / restore / the update listener)
// is trusted directly and OR'd with the Firestore/server flag, so a purchase unlocks Pro even before revenuecat-sync/webhook land.
// Reactive so views (Profile, task modal) update as soon as RevenueCat answers, even if they rendered first.
const rcPro = ref({ uid: null, active: false, plan: null });
export const setRcPro = (uid, active, plan = null) => { const next = { uid: uid || null, active: !!uid && !!active, plan: uid && active ? plan || null : null }; const cur = rcPro.value; if (next.uid !== cur.uid || next.active !== cur.active || next.plan !== cur.plan) { rcPro.value = next; clearProCache(); loadUserDoc().catch(() => {}); } };
export const rcProActive = (uid) => isNativeIOS() && rcPro.value.active && !!uid && rcPro.value.uid === uid;
// Merge RC into any users/{uid} doc snapshot: keeps a server plan (e.g. lifetime), else uses RC's plan.
export const withRcPro = (uid, data) => (rcProActive(uid) && !(data && data.isPro && data.plan === 'lifetime') ? { ...(data || {}), isPro: true, plan: rcPro.value.plan || (data && data.plan) || 'pro', proExpiresAt: null, proSource: 'revenuecat' } : data);

// Reactive "is Pro right now" for lock icons and tap gates (no await in click handlers). Updated by every loadUserDoc() and by RevenueCat.
export const proNow = ref(false);
const note = (d) => { const u = auth.currentUser; proNow.value = accessPro(d, u && rcProActive(u.uid)); return d; };
watch(rcPro, () => { const u = auth.currentUser; if (u && rcProActive(u.uid)) proNow.value = true; });
let cache = { uid: null, data: null, at: 0 };
export async function loadUserDoc(force = false) {
  const u = auth.currentUser; if (!u) return null;
  if (!force && cache.uid === u.uid && Date.now() - cache.at < 60000) return note(withRcPro(u.uid, cache.data));
  try { const s = await getDoc(doc(db, 'users', u.uid)); cache = { uid: u.uid, data: s.exists() ? s.data() : {}, at: Date.now() }; }
  catch (e) { console.error('pro check', e.message); return note(withRcPro(u.uid, cache.uid === u.uid ? cache.data : null)); }
  return note(withRcPro(u.uid, cache.data));
}
// Drop the Firestore snapshot only. An active RevenueCat entitlement stays Pro: syncEntitlement()
// runs on every sign-in and used to force proNow false, so Home locked Lock In while Profile still said Pro.
export const clearProCache = () => { cache = { uid: null, data: null, at: 0 }; const u = auth.currentUser; proNow.value = !!(u && rcProActive(u.uid)); };
const openPaywall = (router, feature) => router.push({ path: '/paywall', query: { feature, from: router.currentRoute.value.fullPath } });
// Returns true if allowed; otherwise sends the user to the paywall and returns false.
// On iOS, ask RevenueCat and mirror it to Firestore once before refusing — a paid phone can be ahead of users/{uid}.isPro.
export async function requirePro(router, feature) {
  const u0 = auth.currentUser;
  if (u0 && rcProActive(u0.uid)) proNow.value = true;
  let d = await loadUserDoc();
  if (canUse(d, feature)) return true;
  if (isNativeIOS() && auth.currentUser) {
    try {
      const iap = await import('@/utils/iap');
      await iap.ensureIapUser(auth.currentUser);
      d = await loadUserDoc(true);
      if (canUse(d, feature)) return true;
    } catch (e) { /* still not Pro */ }
  }
  openPaywall(router, feature);
  return false;
}
// Sync tap gate: true when Pro; otherwise opens the paywall sheet for `feature` and returns false.
export function gatePro(router, feature) {
  const u = auth.currentUser;
  if (u && rcProActive(u.uid)) proNow.value = true;
  if (canUse(proNow.value ? { isPro: true } : null, feature)) return true;
  openPaywall(router, feature); return false;
}
