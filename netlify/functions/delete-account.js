const { withCors } = require('./lib/cors');
// POST /.netlify/functions/delete-account   Authorization: Bearer <Firebase ID token>   body: { appleAuthorizationCode? }
// Deletes the CALLER's Firestore data, Storage files and Firebase Auth user (uid comes from the verified token, never the body).
// Requires a recent sign-in (auth_time <= 5 min) -> otherwise 401 {code:'reauth-required'} and the client re-authenticates and retries.
const { verifyUser } = require('./lib/notify');
const { getAdmin } = require('./lib/firebaseAdmin');
const { buildDeletionPlan, makeAdminIo, runPlan, revokeAppleToken, deleteOneSignalUser, deleteRevenueCatSubscriber } = require('./lib/accountDeletion');

const RECENT_SEC = 300;
const json = (statusCode, o) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });

const handler = async (event, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const h = event.headers || {}; const m = /^Bearer (.+)$/.exec(h.authorization || h.Authorization || '');
    if (!m) return json(401, { error: 'Missing token' });
    const verify = deps.verify || ((t) => getAdmin().auth().verifyIdToken(t));
    let decoded; try { decoded = await verify(m[1]); } catch (e) { return json(401, { error: 'Invalid token' }); }
    const uid = decoded.uid;
    const nowSec = Math.floor((deps.now ? deps.now.getTime() : Date.now()) / 1000);
    if (!decoded.auth_time || nowSec - decoded.auth_time > RECENT_SEC) return json(401, { code: 'reauth-required', error: 'Please sign in again to delete your account.' });

    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) { /* ignore */ }
    const io = deps.io || makeAdminIo(getAdmin(), process.env.FIREBASE_STORAGE_BUCKET || 'clingnote-463b4.appspot.com');
    const userDoc = io.readUser ? await io.readUser(uid).catch(() => null) : null;

    // 1. Apple token revocation (needs APPLE_* server env; reported, never blocks deletion)
    const apple = await revokeAppleToken(typeof body.appleAuthorizationCode === 'string' ? body.appleAuthorizationCode : '', { fetchImpl: deps.fetch || fetch, env: deps.env || process.env });

    // 2. Stripe subscription (web purchasers): cancel so billing stops. Best effort, only if configured and a sub id exists.
    let stripe = 'none';
    const subId = userDoc && (userDoc.stripeSubscriptionId || userDoc.subscriptionId);
    if (subId) {
      try {
        const s = deps.stripe || (process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null);
        if (s) { await (s.subscriptions.cancel ? s.subscriptions.cancel(subId) : s.subscriptions.del(subId)); stripe = 'cancelled'; } else stripe = 'skipped-not-configured';
      } catch (e) { stripe = 'failed'; }
    }

    // 3. Firestore + Storage, then the Auth user last (so a retry is still authenticated if data deletion failed midway)
    const failed = await runPlan(buildDeletionPlan(uid, deps.now || new Date()), io);
    if (failed.length) { console.error('[delete-account] incomplete', uid.slice(0, 6), failed.length); return json(500, { error: 'Could not delete all data. Please try again.', failed: failed.length }); }
    // 4. Processors that hold a profile for this uid (best effort: reported, never blocks). Skipped (and reported) when their env key is not set.
    const pf = { env: deps.env || process.env, fetchImpl: deps.fetch || fetch };
    const onesignal = await deleteOneSignalUser(uid, pf);
    const revenuecat = await deleteRevenueCatSubscriber(uid, pf);
    if (onesignal === 'failed' || revenuecat === 'failed') console.error('[delete-account] processor cleanup failed', uid.slice(0, 6), onesignal, revenuecat);
    await (deps.deleteAuth || ((u) => getAdmin().auth().deleteUser(u)))(uid);
    return json(200, { ok: true, apple, stripe, onesignal, revenuecat, iapNote: userDoc && userDoc.proSource === 'revenuecat' ? 'Apple subscriptions are not cancelled by deleting the account; manage them in Apple ID settings.' : undefined });
  } catch (e) {
    console.error('[delete-account]', e && e.message);
    return json(e.status || 500, { error: e.status ? e.message : 'Delete failed' });
  }
};
exports.handler = withCors((event) => handler(event));
exports._handler = handler;
