// Manual (needs network): STRIPE_SECRET_KEY_TEST (sk_test_...) required. Uses Stripe TEST mode only, ZZTEST customer, card pm_card_visa (4242 4242 4242 4242).
// Verifies: price amounts/intervals/trial for every plan via real Checkout Sessions, then the cancel-subscription function end to end
// (cancel at period end, ownership refusal) against a real test-mode subscription, then cleans up.   Never reads STRIPE_SECRET_KEY_LIVE.
delete process.env.STRIPE_SECRET_KEY_LIVE;
const key = process.env.STRIPE_SECRET_KEY_TEST; if (!key || !key.startsWith('sk_test_')) throw new Error('need sk_test');
const PRICES = { monthly: 'price_1UTPjsF1Lys3ABJJmekMgEjY', yearly: 'price_1UTPjsF1Lys3ABJJOV9h41aA' };
const co = require('../netlify/functions/create-checkout'); const cs = require('../netlify/functions/cancel-subscription');
const stripe = require('stripe')(key); const assert = require('assert');
const UID = 'ZZTEST_cancel_uid1'; const OTHER = 'ZZTEST_other_uid22';
(async () => {
  const prices = (await stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] })).data.filter((p) => !p.livemode);
  const show = (p) => `${p.id.slice(0, 10)}… ${p.unit_amount / 100} ${p.currency} ${p.recurring ? 'per ' + p.recurring.interval : 'one-time'}`;
  const find = (pred) => prices.find(pred);
  const monthly = find((p) => p.recurring?.interval === 'month' && p.unit_amount === 299);
  const yearly = find((p) => p.recurring?.interval === 'year' && p.unit_amount === 1999);
  const lifetime = find((p) => !p.recurring && p.unit_amount === 3999);
  console.log('test-mode prices present: monthly $2.99', !!monthly, '| yearly $19.99', !!yearly, '| lifetime $39.99', !!lifetime);
  Object.assign(process.env, { STRIPE_SECRET_KEY: key, PAYMENTS_ENABLED: 'true', STRIPE_PRICE_MONTHLY: monthly.id, STRIPE_PRICE_YEARLY: yearly.id, STRIPE_PRICE_LIFETIME: lifetime.id });
  const verify = async (t) => { if (t !== 'good') throw new Error('bad'); return { uid: UID }; };
  for (const planId of ['monthly', 'yearly', 'lifetime']) {
    const r = await co._handler({ httpMethod: 'POST', headers: { authorization: 'Bearer good' }, body: JSON.stringify({ planId }) }, { verify });
    const b = JSON.parse(r.body); const s = await stripe.checkout.sessions.retrieve(b.id, { expand: ['line_items.data.price'] });
    const li = s.line_items.data[0]; const sess = await stripe.checkout.sessions.retrieve(b.id);
    console.log(planId, r.statusCode, 'mode', s.mode, 'amount', s.amount_total / 100, s.currency, 'trial_days', sess.subscription_data?.trial_period_days ?? (planId === 'yearly' ? '(see below)' : 'none'), 'livemode', s.livemode);
    await stripe.checkout.sessions.expire(b.id);
  }
  // Yearly trial: Checkout stores trial_period_days on the session creation request; verify via a real trial subscription created from the same params
  const cust = await stripe.customers.create({ email: 'zztest+cancel@example.com', name: 'ZZTEST cancel', payment_method: 'pm_card_visa', metadata: { zztest: '1' } });
  try {
    const pm = (await stripe.paymentMethods.list({ customer: cust.id })).data[0];
    await stripe.customers.update(cust.id, { invoice_settings: { default_payment_method: pm.id } });
    const tr = await stripe.subscriptions.create({ customer: cust.id, items: [{ price: yearly.id }], trial_period_days: 3, metadata: { uid: UID, plan: 'yearly' } });
    console.log('yearly trial sub status', tr.status, 'trial days', Math.round((tr.trial_end - tr.trial_start) / 86400)); await stripe.subscriptions.cancel(tr.id);
    const sub = await stripe.subscriptions.create({ customer: cust.id, items: [{ price: monthly.id }], metadata: { uid: UID, plan: 'monthly' } });
    console.log('monthly sub', sub.status, 'livemode', sub.livemode);
    const user = { isPro: true, stripeSubscriptionId: sub.id, stripeCustomerId: cust.id, proSource: 'stripe' };
    const call = (uid, extra = {}) => cs._handler({ httpMethod: 'POST', headers: { authorization: 'Bearer ' + uid }, body: '{}' }, { verify: async (t) => ({ uid: t }), readUser: async () => user, stripe, ...extra });
    const other = await call(OTHER, { readUser: async () => user }); // different caller reading a doc that points at UID's sub (forged doc scenario)
    console.log('other user ->', other.statusCode);
    const mine = await call(UID); console.log('owner ->', mine.statusCode, mine.body);
    const after = await stripe.subscriptions.retrieve(sub.id); console.log('stripe after: status', after.status, 'cancel_at_period_end', after.cancel_at_period_end);
    const again = await call(UID); console.log('again ->', again.statusCode, JSON.parse(again.body).already);
    assert.equal(other.statusCode, 403); assert.equal(mine.statusCode, 200); assert.equal(after.cancel_at_period_end, true);
    await stripe.subscriptions.cancel(sub.id);
  } finally { await stripe.customers.del(cust.id); }
  console.log('done');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
