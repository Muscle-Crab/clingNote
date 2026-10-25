// Stripe subscription cancel must not revoke lifetime / Apple Pro or a different subscription's Pro.
const assert = require('assert');
const { decideStripeWrite: d } = require('../netlify/functions/stripe-webhook');
const off = { isPro: false, plan: null, proExpiresAt: null, stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', subscriptionStatus: 'canceled', cancelAtPeriodEnd: false };
assert.deepStrictEqual(d({ isPro: true, plan: 'monthly', proSource: 'stripe', stripeSubscriptionId: 'sub_1' }, off), off);
assert.deepStrictEqual(d(null, off), off);
assert.strictEqual(d({ isPro: true, plan: 'lifetime', proSource: 'stripe', stripeSubscriptionId: 'sub_1' }, off).isPro, undefined);
assert.strictEqual(d({ isPro: true, plan: 'yearly', proSource: 'revenuecat' }, off).isPro, undefined);
assert.strictEqual(d({ isPro: true, plan: 'monthly', proSource: 'stripe', stripeSubscriptionId: 'sub_2' }, off), null);
const on = { ...off, isPro: true, plan: 'monthly' };
assert.deepStrictEqual(d({ isPro: true, plan: 'lifetime' }, on), on);
console.log('stripe-webhook revoke guard: ok');
