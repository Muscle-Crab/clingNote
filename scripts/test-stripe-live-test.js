// Manual: STRIPE_SECRET_KEY_TEST required. Uses Stripe TEST mode only.
const key = process.env.STRIPE_SECRET_KEY_TEST; if (!key || !key.startsWith('sk_test_')) throw new Error('need sk_test');
Object.assign(process.env, { STRIPE_SECRET_KEY: key, PAYMENTS_ENABLED: 'true', STRIPE_PRICE_MONTHLY: 'price_1UTPjsF1Lys3ABJJmekMgEjY', STRIPE_PRICE_YEARLY: 'price_1UTPjsF1Lys3ABJJOV9h41aA', STRIPE_PRICE_LIFETIME: 'price_1UTPjsF1Lys3ABJJ5cESiudE', STRIPE_WEBHOOK_SECRET: 'whsec_localtest' });
delete process.env.FIREBASE_SERVICE_ACCOUNT; delete process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64; delete process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE;
const stripe = require('stripe')(key);
const co = require('../netlify/functions/create-checkout');
const wh = require('../netlify/functions/stripe-webhook');
const UID = 'ZZTEST_paywall_uid1';
(async () => {
  const verify = async (t) => { if (t !== 'good') throw new Error('bad'); return { uid: UID }; };
  for (const planId of ['monthly', 'yearly', 'lifetime']) {
    const r = await co._handler({ httpMethod: 'POST', headers: { authorization: 'Bearer good', origin: 'https://deploy-preview-2--clingnot.netlify.app' }, body: JSON.stringify({ planId }) }, { verify });
    const b = JSON.parse(r.body);
    const s = await stripe.checkout.sessions.retrieve(b.id, { expand: ['line_items'] });
    console.log(planId, r.statusCode, /^https:\/\/checkout\.stripe\.com\//.test(b.url), s.mode, s.client_reference_id, JSON.stringify(s.metadata), s.livemode, s.success_url);
    await stripe.checkout.sessions.expire(b.id);
  }
  const bad = await co._handler({ httpMethod: 'POST', headers: { authorization: 'Bearer nope' }, body: '{"planId":"monthly"}' }, { verify });
  console.log('bad token ->', bad.statusCode);
  // Real test subscription w/ pm_card_visa on ZZTEST customer
  const cust = await stripe.customers.create({ email: 'zztest+paywall@example.com', name: 'ZZTEST paywall', payment_method: 'pm_card_visa', invoice_settings: { default_payment_method: undefined }, metadata: { uid: UID } });
  const pm = (await stripe.paymentMethods.list({ customer: cust.id })).data[0];
  await stripe.customers.update(cust.id, { invoice_settings: { default_payment_method: pm.id } });
  const sub = await stripe.subscriptions.create({ customer: cust.id, items: [{ price: process.env.STRIPE_PRICE_MONTHLY }], metadata: { uid: UID, plan: 'monthly' } });
  console.log('sub', sub.id, sub.status, sub.livemode);
  const writes = [];
  const send = async (type, object) => {
    const payload = JSON.stringify({ id: 'evt_local', object: 'event', type, data: { object } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_localtest' });
    return wh._handler({ headers: { 'stripe-signature': header }, body: payload }, { stripe, write: async (u, d) => writes.push([type, u, d]) });
  };
  console.log('session.completed', (await send('checkout.session.completed', { mode: 'subscription', client_reference_id: UID, metadata: { uid: UID, plan: 'monthly' }, customer: cust.id, subscription: sub.id })).statusCode);
  console.log('sub.updated', (await send('customer.subscription.updated', sub)).statusCode);
  const del = await stripe.subscriptions.cancel(sub.id);
  console.log('sub.deleted', (await send('customer.subscription.deleted', del)).statusCode);
  const badSig = await wh._handler({ headers: { 'stripe-signature': 't=1,v1=bad' }, body: '{}' }, { stripe });
  console.log('bad sig ->', badSig.statusCode);
  writes.forEach((w) => console.log(JSON.stringify(w)));
  await stripe.customers.del(cust.id);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
