import { fnUrl } from '@/config/api';
// RevenueCat (StoreKit) client for the iOS Capacitor build. Never imported eagerly on web: the SDK is loaded lazily and only when isNativeIOS().
// Entitlement truth lives server-side: after a purchase/restore we call /.netlify/functions/revenuecat-sync, which re-verifies with the
// RevenueCat REST API and writes isPro/plan/proExpiresAt with the Admin SDK. The client never writes those fields.
import { isNativeIOS } from '@/utils/platform';
import { RC_ENTITLEMENT, IAP_PRODUCTS, planIdForProduct } from '@/config/iap';
import { clearProCache } from '@/composables/usePro';
import { toRaw } from 'vue';

let mod = null; let configured = false; let currentUid = null;
const sdk = async () => mod || (mod = await import('@revenuecat/purchases-capacitor'));

export const iapAvailable = () => isNativeIOS() && !!process.env.VUE_APP_REVENUECAT_IOS_KEY;

let initPromise = null; // single in-flight configure(): the auth listener and the paywall can both call initIap() at start-up
export async function initIap() {
  if (!iapAvailable()) return false;
  if (configured) return true;
  if (!initPromise) initPromise = (async () => {
    const { Purchases } = await sdk();
    await Purchases.configure({ apiKey: process.env.VUE_APP_REVENUECAT_IOS_KEY });
    configured = true; return true;
  })().catch((e) => { initPromise = null; throw e; });
  return initPromise;
}

// Called from the global Firebase auth listener. app_user_id === Firebase uid (never an email).
export async function identifyIapUser(user) {
  if (!(await initIap())) return;
  const { Purchases } = await sdk();
  try {
    if (user?.uid) { if (currentUid !== user.uid) { await Purchases.logIn({ appUserID: user.uid }); currentUid = user.uid; } }
    else if (currentUid) { await Purchases.logOut(); currentUid = null; }
  } catch (e) { console.warn('RevenueCat identify failed', e?.message || e); }
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

// Ask the server to re-verify with RevenueCat and update users/{uid}. Returns the server result ({isPro, plan}).
export async function syncEntitlement(user) {
  const token = await user.getIdToken();
  const r = await fetch(fnUrl('revenuecat-sync'), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json().catch(() => ({}));
  clearProCache();
  if (!r.ok) throw new Error(data.error || `Sync failed (${r.status})`);
  return data;
}

export async function purchase(user, plan) {
  const { Purchases } = await sdk();
  // The paywall keeps plans in a Vue ref(), so plan.pkg is a reactive Proxy; the Capacitor bridge cannot serialise a Proxy (native then rejects
  // 'Must provide aPackage parameter'), so hand the SDK the raw package object (a JSON round-trip would drop native fields).
  try {
    const res = await Purchases.purchasePackage({ aPackage: toRaw(plan.pkg) });
    const active = !!res?.customerInfo?.entitlements?.active?.[RC_ENTITLEMENT];
    if (!active) return { ok: false, error: 'Purchase is still processing. Pull to refresh in a moment.' };
  } catch (e) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: e?.message || 'Purchase failed.' };
  }
  try { await syncEntitlement(user); } catch (e) { /* webhook will catch up; the purchase itself succeeded */ }
  return { ok: true };
}

export async function restore(user) {
  if (!(await initIap())) return { ok: false, error: 'Purchases are unavailable right now.' };
  const { Purchases } = await sdk();
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const active = !!customerInfo?.entitlements?.active?.[RC_ENTITLEMENT];
    try { await syncEntitlement(user); } catch (e) { /* ignore */ }
    return { ok: true, restored: active };
  } catch (e) { return { ok: false, error: e?.message || 'Restore failed.' }; }
}
export { IAP_PRODUCTS };
