// RevenueCat -> Firestore entitlement mirror (iOS In-App Purchases).
// Source of truth = RevenueCat REST API (GET /v1/subscribers/{app_user_id}, secret key). Webhook payloads are only a *trigger*:
// we never trust their contents, we re-fetch the subscriber and derive isPro/plan/proExpiresAt from the `pro` entitlement.
// app_user_id === Firebase uid. Env: REVENUECAT_SECRET_KEY (sk_...), REVENUECAT_WEBHOOK_SECRET (Authorization header value).
const crypto = require('crypto');
const { isProDoc } = require('./requirePro');

const ENTITLEMENT = 'pro';
const PRODUCT_PLAN = { clingnote_pro_monthly: 'monthly', clingnote_pro_yearly: 'yearly', clingnote_pro_lifetime: 'lifetime' };
const UID_RE = /^[A-Za-z0-9]{6,128}$/; // Firebase uids; rejects "$RCAnonymousID:..." and anything path-like

const planFor = (productId, hasExpiry) => {
  if (PRODUCT_PLAN[productId]) return PRODUCT_PLAN[productId];
  const p = String(productId || '').toLowerCase();
  if (p.includes('lifetime') || !hasExpiry) return 'lifetime';
  if (p.includes('year') || p.includes('annual')) return 'yearly';
  if (p.includes('month')) return 'monthly';
  return 'pro';
};

// Pure: RevenueCat v1 `subscriber` object -> Firestore fields. A missing/expired entitlement => isPro:false.
const entitlementUpdate = (subscriber, now = new Date()) => {
  const ent = subscriber?.entitlements?.[ENTITLEMENT];
  if (!ent) return { isPro: false, plan: null, proExpiresAt: null };
  const exp = ent.expires_date ? new Date(ent.expires_date) : null; // null => non-expiring (lifetime)
  const grace = ent.grace_period_expires_date ? new Date(ent.grace_period_expires_date) : null; // billing retry: keep access
  const end = grace && (!exp || grace > exp) ? grace : exp;
  const active = !end || end > now;
  const sub = subscriber.subscriptions?.[ent.product_identifier] || {};
  return {
    isPro: active,
    plan: active ? planFor(ent.product_identifier, !!exp) : null,
    proExpiresAt: active ? (end || null) : end, // lifetime: null
    proSource: 'revenuecat',
    iapProductId: ent.product_identifier || null,
    iapStore: sub.store || null,
    iapEnvironment: sub.is_sandbox ? 'sandbox' : 'production',
  };
};

// Pure: given the current users/{uid} doc and RC's verdict, decide what (if anything) to write. Stripe (web) and Apple coexist.
const decideWrite = (current, update, now = new Date()) => {
  const cur = current || {};
  if (update.isPro) {
    // Don't downgrade a currently-valid Stripe/other Pro that lasts at least as long as the Apple one.
    if (cur.proSource !== 'revenuecat' && isProDoc(cur, now)) {
      const curEnd = cur.plan === 'lifetime' ? Infinity : cur.proExpiresAt ? new Date(cur.proExpiresAt.toDate ? cur.proExpiresAt.toDate() : cur.proExpiresAt).getTime() : Infinity;
      const newEnd = update.proExpiresAt ? update.proExpiresAt.getTime() : Infinity;
      if (curEnd >= newEnd) return null;
    }
    return update;
  }
  // RC says not Pro: only revoke what RC itself granted. Never touch Stripe-sourced Pro.
  if (cur.proSource === 'revenuecat' && cur.isPro === true) return { isPro: false, plan: null, proExpiresAt: update.proExpiresAt || null, proSource: 'revenuecat', iapEnvironment: cur.iapEnvironment || null };
  return null;
};

const fetchSubscriber = async (uid, { fetch: f = fetch, key = process.env.REVENUECAT_SECRET_KEY } = {}) => {
  if (!key) throw Object.assign(new Error('Server not configured'), { status: 500 });
  const r = await f(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
  if (!r.ok) throw Object.assign(new Error(`RevenueCat lookup failed (${r.status})`), { status: 502 });
  const data = await r.json();
  return data.subscriber || {};
};

const defaultIo = () => {
  const { getAdmin } = require('./firebaseAdmin');
  const admin = getAdmin(); const col = admin.firestore().collection('users');
  return {
    read: async (uid) => { const s = await col.doc(uid).get(); return s.exists ? s.data() : null; },
    write: async (uid, data) => { await col.doc(uid).set({ ...data, proUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); },
  };
};

// Verify with RevenueCat and mirror into users/{uid}. Never creates a user doc. Returns { uid, isPro, plan, wrote }.
const syncUid = async (uid, deps = {}) => {
  if (!UID_RE.test(uid || '')) return null;
  const io = deps.io || defaultIo();
  const current = await io.read(uid);
  if (!current) return null;
  const subscriber = await fetchSubscriber(uid, deps);
  const update = entitlementUpdate(subscriber, deps.now || new Date());
  const toWrite = decideWrite(current, update, deps.now || new Date());
  if (toWrite) await io.write(uid, toWrite);
  const eff = toWrite || current;
  return { uid, isPro: toWrite ? toWrite.isPro : isProDoc(current, deps.now || new Date()), plan: eff.plan || null, wrote: !!toWrite };
};

const safeEqual = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const authOk = (headers, secret) => {
  if (!secret) return false;
  const h = headers?.authorization || headers?.Authorization || '';
  return safeEqual(h, `Bearer ${secret}`) || safeEqual(h, secret);
};
// Every app_user_id this event could concern (aliases + transfers), de-duplicated.
const candidateUids = (ev = {}) => [...new Set([ev.app_user_id, ev.original_app_user_id, ...(ev.aliases || []), ...(ev.transferred_from || []), ...(ev.transferred_to || [])].filter((x) => typeof x === 'string' && UID_RE.test(x)))];

module.exports = { ENTITLEMENT, entitlementUpdate, decideWrite, fetchSubscriber, syncUid, authOk, candidateUids, planFor };
