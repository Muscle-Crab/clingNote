const { withCors } = require('./lib/cors');
// POST /.netlify/functions/cancel-subscription   Authorization: Bearer <Firebase ID token>
// Cancels the CALLER's Stripe subscription at the end of the paid period (access stays until then; the stripe-webhook flips isPro off
// when Stripe sends customer.subscription.deleted). The uid comes from the verified token; a body userId is only accepted if it matches.
// Subscriptions bought through Apple (proSource 'revenuecat') are managed in Apple ID settings and are refused here.
// Env: STRIPE_SECRET_KEY, Firebase Admin creds (see lib/firebaseAdmin.js).
const { getAdmin } = require('./lib/firebaseAdmin');
const { verifyUser } = require('./lib/notify');

const json = (statusCode, o) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const fmt = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);

const handler = async (event, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
  let uid;
  try { uid = await verifyUser(event.headers, deps.verify); } catch (e) { return json(e.status || 401, { error: e.message }); }
  if (body.userId && body.userId !== uid) return json(403, { error: 'Not your subscription' });
  try {
    const readUser = deps.readUser || (async (id) => { const s = await getAdmin().firestore().collection('users').doc(id).get(); return s.exists ? s.data() : null; });
    const user = await readUser(uid);
    if (!user) return json(404, { error: 'User not found' });
    if (user.proSource === 'revenuecat') return json(400, { error: 'This subscription is managed by Apple. Cancel it in your Apple ID settings.', code: 'managed-by-apple' });
    const subId = user.stripeSubscriptionId || user.subscriptionId; // subscriptionId = legacy field name
    if (!subId) return json(400, { error: 'No active subscription found', code: 'no-subscription' });
    const stripe = deps.stripe || require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sub = await stripe.subscriptions.retrieve(subId);
    // Ownership: the subscription must have been created for this uid (checkout metadata) or belong to this user's Stripe customer.
    const ownsByMeta = sub.metadata && sub.metadata.uid === uid;
    const ownsByCustomer = !!user.stripeCustomerId && sub.customer === user.stripeCustomerId && !(sub.metadata && sub.metadata.uid && sub.metadata.uid !== uid);
    if (!ownsByMeta && !ownsByCustomer) { console.error(`cancel-subscription: ownership mismatch uid=${uid}`); return json(403, { error: 'Not your subscription' }); }
    if (sub.status === 'canceled') return json(200, { ok: true, status: 'canceled', cancelAtPeriodEnd: false, endsAt: null });
    const end = sub.current_period_end || sub.items?.data?.[0]?.current_period_end || null;
    if (sub.cancel_at_period_end) return json(200, { ok: true, status: sub.status, cancelAtPeriodEnd: true, endsAt: fmt(end), already: true });
    const upd = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    return json(200, { ok: true, status: upd.status, cancelAtPeriodEnd: true, endsAt: fmt(upd.current_period_end || upd.items?.data?.[0]?.current_period_end || end) });
  } catch (err) {
    console.error('Cancel error:', err.message);
    return json(500, { error: 'Could not cancel the subscription. Please try again.' });
  }
};
exports.handler = withCors((event) => handler(event));
exports._handler = handler;
