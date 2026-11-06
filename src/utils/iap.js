import { fnUrl } from '@/config/api';
// RevenueCat (StoreKit) client for the iOS Capacitor build. Never imported eagerly on web: the SDK is loaded lazily and only when isNativeIOS().
// Entitlement truth lives server-side: after a purchase/restore we call /.netlify/functions/revenuecat-sync, which re-verifies with the
// RevenueCat REST API and writes isPro/plan/proExpiresAt with the Admin SDK. The client never writes those fields.
import { isNativeIOS } from '@/utils/platform';
import { RC_ENTITLEMENT, IAP_PRODUCTS, planIdForProduct } from '@/config/iap';
import { clearProCache, setRcPro, rcProActive, loadUserDoc } from '@/composables/usePro';
import { customerInfoOf } from '@/utils/customerInfo';
import { toRaw } from 'vue';

let mod = null; let configured = false; let currentUid = null;
const sdk = async () => mod || (mod = await import('@revenuecat/purchases-capacitor'));

export const iapAvailable = () => isNativeIOS() && !!process.env.VUE_APP_REVENUECAT_IOS_KEY;

// Trust RevenueCat's active entitlement directly on iOS (OR'd with the server flag in usePro).
export const entitlementActive = (ci) => !!ci?.entitlements?.active?.[RC_ENTITLEMENT];
export const entitlementPlan = (ci) => { const e = ci?.entitlements?.active?.[RC_ENTITLEMENT]; if (!e) return null; return planIdForProduct(e.productIdentifier) || (e.expirationDate ? 'pro' : 'lifetime'); };
const applyCustomerInfo = (payload) => { const ci = customerInfoOf(payload); if (!ci || !currentUid) return; setRcPro(currentUid, entitlementActive(ci), entitlementPlan(ci)); };
// Views call this on mount: log in (if the auth listener has not yet) and read customerInfo, so Pro shows without waiting for the server.
export async function ensureIapUser(user) { if (!iapAvailable() || !user?.uid) return false; try { await identifyIapUser(user); } catch (e) { /* logged */ } return rcProActiveFor(user.uid); }
const rcProActiveFor = (uid) => rcProActive(uid);
// Apps cannot cancel an IAP themselves: open Apple's subscription management.
export async function manageSubscriptions() {
  try { if (await initIap()) { const { Purchases } = await sdk(); await Purchases.showManageSubscriptions(); return true; } } catch (e) { /* fall back to the URL */ }
  window.location.href = 'itms-apps://apps.apple.com/account/subscriptions'; return false;
}
export async function refreshCustomerInfo() {
  if (!configured || !currentUid) return false;
  try { const { Purchases } = await sdk(); const { customerInfo } = await Purchases.getCustomerInfo(); applyCustomerInfo(customerInfo); return entitlementActive(customerInfo); }
  catch (e) { console.warn('RevenueCat customerInfo failed', e?.message || e); return false; }
}

let initPromise = null; // single in-flight configure(): the auth listener and the paywall can both call initIap() at start-up
export async function initIap() {
  if (!iapAvailable()) return false;
  if (configured) return true;
  if (!initPromise) initPromise = (async () => {
    const { Purchases } = await sdk();
    await Purchases.configure({ apiKey: process.env.VUE_APP_REVENUECAT_IOS_KEY });
    configured = true;
    // Callback-style plugin method: (options, callback). A single function argument is deprecated and dropped on some bridges, so Pro never updated after purchase.
    try { await Purchases.addCustomerInfoUpdateListener(null, (ci) => applyCustomerInfo(ci)); } catch (e) { /* listener unsupported: launch/login/purchase/restore still refresh */ }
    return true;
  })().catch((e) => { initPromise = null; throw e; });
  return initPromise;
}

// Called from the global Firebase auth listener. app_user_id === Firebase uid (never an email).
export async function identifyIapUser(user) {
  if (!(await initIap())) return;
  const { Purchases } = await sdk();
  try {
    if (user?.uid) { if (currentUid !== user.uid) { await Purchases.logIn({ appUserID: user.uid }); currentUid = user.uid; } }
    else if (currentUid) { await Purchases.logOut(); currentUid = null; setRcPro(null, false); }
  } catch (e) { console.warn('RevenueCat identify failed', e?.message || e); }
  if (user?.uid && currentUid === user.uid) {
    await refreshCustomerInfo(); // launch / after login
    try { await syncEntitlement(user); } catch (e) { console.warn('RevenueCat sync failed', e?.message || e); }
  }
}

// Returns [{ id:'monthly'|'yearly'|'lifetime', pkg, priceString, trialEligible, trialText }] from the current RevenueCat offering.
export async function loadPlans() {
  if (!(await initIap())) return [];
  const { Purchases, INTRO_ELIGIBILITY_STATUS } = await sdk();
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings?.current?.availablePackages || [];
  let elig = {};
  try { elig = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: pkgs.map((p) => p.product.identifier) }); } catch (e) { /* unknown => show no trial */ }
  return pkgs.map((pkg) => {
    const id = planIdForProduct(pkg.product.identifier); if (!id) return null;
    const intro = pkg.product.introPrice;
    const eligible = !!intro && elig[pkg.product.identifier]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
    return { id, pkg, priceString: pkg.product.priceString, price: pkg.product.price, trialEligible: eligible, trialDays: eligible ? (intro.periodNumberOfUnits || 0) : 0 };
  }).filter(Boolean);
}

// Ask the server to re-verify with RevenueCat and update users/{uid}. Returns the server result ({isPro, plan, wrote}).
const pullEntitlement = async (user) => {
  const token = await user.getIdToken();
  const r = await fetch(fnUrl('revenuecat-sync'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Sync failed (${r.status})`);
  return data;
};
export async function syncEntitlement(user) {
  let data = await pullEntitlement(user);
  // Receipt can land in RevenueCat a moment after the sheet closes. One more lookup before we tell the app it is not Pro.
  if (data.isPro !== true && user?.uid && rcProActive(user.uid)) {
    await new Promise((res) => setTimeout(res, 700));
    try { const again = await pullEntitlement(user); if (again) data = again; } catch (e) { /* keep the first answer */ }
  }
  clearProCache();
  try { await loadUserDoc(true); } catch (e) { /* RevenueCat flag still unlocks the UI */ }
  return data;
}

export async function purchase(user, plan) {
  if (!user?.uid) return { ok: false, error: 'Sign in before purchasing.' };
  // logIn(Firebase uid) BEFORE the sheet. Otherwise the receipt is stored on an anonymous RevenueCat id and revenuecat-sync cannot see it.
  try { await identifyIapUser(user); } catch (e) { return { ok: false, error: 'Could not link this purchase to your account. Try again.' }; }
  if (currentUid !== user.uid) return { ok: false, error: 'Could not link this purchase to your account. Try again.' };
  const { Purchases } = await sdk();
  // The paywall keeps plans in a Vue ref(), so plan.pkg is a reactive Proxy; the Capacitor bridge cannot serialise a Proxy (native then rejects
  // 'Must provide aPackage parameter'), so hand the SDK the raw package object (a JSON round-trip would drop native fields).
  let active = false;
  try {
    const res = await Purchases.purchasePackage({ aPackage: toRaw(plan.pkg) });
    active = entitlementActive(customerInfoOf(res) || res?.customerInfo);
    if (user?.uid) setRcPro(user.uid, active, entitlementPlan(res?.customerInfo));
    if (!active) return { ok: false, error: 'Purchase is still processing. Pull to refresh in a moment.' };
  } catch (e) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: e?.message || 'Purchase failed.' };
  }
  try { await syncEntitlement(user); } catch (e) { return { ok: true, entitled: active, syncError: e?.message || 'Purchase succeeded, but Pro did not sync. Try Restore.' }; }
  return { ok: true, entitled: active };
}

export async function restore(user) {
  if (!user?.uid) return { ok: false, error: 'Sign in before restoring.' };
  if (!(await initIap())) return { ok: false, error: 'Purchases are unavailable right now.' };
  try { await identifyIapUser(user); } catch (e) { return { ok: false, error: 'Could not link purchases to your account. Try again.' }; }
  if (currentUid !== user.uid) return { ok: false, error: 'Could not link purchases to your account. Try again.' };
  const { Purchases } = await sdk();
  try {
    const restoredInfo = await Purchases.restorePurchases();
    const customerInfo = customerInfoOf(restoredInfo) || restoredInfo?.customerInfo;
    const active = entitlementActive(customerInfo);
    if (user?.uid) setRcPro(user.uid, active, entitlementPlan(customerInfo));
    try { await syncEntitlement(user); } catch (e) { return { ok: true, restored: active, entitled: active, syncError: e?.message || 'Restored on this phone, but Pro did not sync.' }; }
    return { ok: true, restored: active, entitled: active };
  } catch (e) { return { ok: false, error: e?.message || 'Restore failed.' }; }
}
export { IAP_PRODUCTS };
