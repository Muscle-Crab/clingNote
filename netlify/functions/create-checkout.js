// Stripe Checkout endpoint. Returns 501 {configured:false} unless PAYMENTS_ENABLED=true + Stripe env set.
// Env: PAYMENTS_ENABLED, STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, STRIPE_PRICE_LIFETIME,
//      Firebase Admin creds (see lib/firebaseAdmin.js) for ID-token verification.
const { getAdmin, hasCreds } = require('./lib/firebaseAdmin');

const PLANS = {
  monthly: { env: 'STRIPE_PRICE_MONTHLY', mode: 'subscription' },
  yearly: { env: 'STRIPE_PRICE_YEARLY', mode: 'subscription', trialDays: 3 },
  lifetime: { env: 'STRIPE_PRICE_LIFETIME', mode: 'payment' },
};
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const resolveUid = async (headers, body, verify) => {
  const h = headers?.authorization || headers?.Authorization || '';
  const m = /^Bearer (.+)$/.exec(h);
  if (verify || hasCreds()) {
    if (!m) throw Object.assign(new Error('Missing token'), { status: 401 });
    try { return (await (verify || ((t) => getAdmin().auth().verifyIdToken(t)))(m[1])).uid; } catch (e) { throw Object.assign(new Error('Invalid token'), { status: 401 }); }
  }
  // Fallback when no admin creds are configured: require uid in body (unverified).
  if (body.uid && /^[A-Za-z0-9_-]{6,128}$/.test(body.uid)) return body.uid;
  throw Object.assign(new Error('Missing uid'), { status: 401 });
};

const originOf = (event) => {
  const o = event.headers?.origin || event.headers?.Origin || '';
  const site = process.env.DEPLOY_PRIME_URL || process.env.URL || 'https://clingnot.netlify.app';
  if (/^https:\/\/([a-z0-9-]+--)?clingnot\.netlify\.app$/.test(o) || /^http:\/\/localhost(:\d+)?$/.test(o)) return o;
  return site;
};

const handler = async (event, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
  const plan = PLANS[body.planId];
  if (!plan) return json(400, { error: 'Unknown plan' });
  const price = process.env[plan.env];
  if (process.env.PAYMENTS_ENABLED !== 'true' || !process.env.STRIPE_SECRET_KEY || !price) return json(501, { configured: false, message: 'Payments coming soon' });
  let uid;
  try { uid = await resolveUid(event.headers, body, deps.verify); } catch (e) { return json(e.status || 401, { error: e.message }); }
  const stripe = deps.stripe || require('stripe')(process.env.STRIPE_SECRET_KEY);
  const origin = originOf(event);
  const meta = { uid, plan: body.planId };
  const params = {
    mode: plan.mode,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: uid,
    metadata: meta,
    success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?checkout=cancel`,
    allow_promotion_codes: true,
  };
  if (plan.mode === 'subscription') {
    params.subscription_data = { metadata: meta };
    if (plan.trialDays) params.subscription_data.trial_period_days = plan.trialDays;
  } else {
    params.payment_intent_data = { metadata: meta };
    params.customer_creation = 'always';
  }
  try {
    const session = await stripe.checkout.sessions.create(params);
    return json(200, { url: session.url, id: session.id });
  } catch (e) {
    console.error('Stripe checkout error:', e.message);
    return json(500, { error: 'Checkout failed' });
  }
};
exports.handler = (event) => handler(event);
exports._handler = handler;
