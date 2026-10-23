const { withCors } = require('./lib/cors');
// Stripe webhook: verifies signature, syncs Pro status to users/{uid}.
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, Firebase Admin creds (lib/firebaseAdmin.js).
const { getAdmin } = require('./lib/firebaseAdmin');

const ACTIVE = ['active', 'trialing', 'past_due'];
const planFromSub = (sub) => {
  const m = sub.metadata?.plan;
  if (m) return m;
  const price = sub.items?.data?.[0]?.price?.id;
  if (price === process.env.STRIPE_PRICE_YEARLY) return 'yearly';
  if (price === process.env.STRIPE_PRICE_MONTHLY) return 'monthly';
  return null;
};
const subEnd = (sub) => sub.current_period_end || sub.items?.data?.[0]?.current_period_end || sub.trial_end || null;

// Pure: stripe event -> { uid, update } or null
const buildUpdate = async (evt, stripe) => {
  const o = evt.data.object;
  if (evt.type === 'checkout.session.completed') {
    const uid = o.client_reference_id || o.metadata?.uid;
    if (!uid) return null;
    const plan = o.metadata?.plan || null;
    const update = { isPro: true, plan, stripeCustomerId: o.customer || null };
    if (o.mode === 'payment') update.proExpiresAt = null; // lifetime
    else if (o.subscription) {
      update.stripeSubscriptionId = o.subscription;
      const sub = stripe ? await stripe.subscriptions.retrieve(o.subscription) : null;
      const end = sub && subEnd(sub);
      update.proExpiresAt = end ? new Date(end * 1000) : null;
    }
    return { uid, update };
  }
  if (evt.type === 'customer.subscription.updated' || evt.type === 'customer.subscription.deleted' || evt.type === 'customer.subscription.created') {
    const uid = o.metadata?.uid;
    if (!uid) return null;
    const active = evt.type !== 'customer.subscription.deleted' && ACTIVE.includes(o.status);
    const end = subEnd(o);
    return { uid, update: { isPro: active, plan: active ? planFromSub(o) : null, proExpiresAt: end ? new Date(end * 1000) : null, stripeCustomerId: o.customer || null, stripeSubscriptionId: o.id, subscriptionStatus: o.status, cancelAtPeriodEnd: !!o.cancel_at_period_end && active } };
  }
  return null;
};

const handler = async (event, deps = {}) => {
  const stripe = deps.stripe || require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers?.['stripe-signature'];
  let evt;
  try {
    const raw = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
    evt = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: 'Bad signature' };
  }
  try {
    const r = await buildUpdate(evt, stripe);
    if (r) {
      const write = deps.write || (async (uid, data) => {
        const admin = getAdmin();
        await admin.firestore().collection('users').doc(uid).set({ ...data, ...(data.isPro ? { proSource: 'stripe' } : {}), proUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
      await write(r.uid, r.update);
      console.log(`Pro sync ${evt.type} uid=${r.uid} isPro=${r.update.isPro}`);
    }
  } catch (e) {
    console.error('Webhook handling failed:', e.message);
    return { statusCode: 500, body: 'Handler error' };
  }
  return { statusCode: 200, body: 'ok' };
};
exports.handler = withCors((event) => handler(event));
exports._handler = handler;
exports.buildUpdate = buildUpdate;
