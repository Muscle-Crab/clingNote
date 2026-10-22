// Single source of truth for ClingNot plan pricing. Change prices here only.
// `stripePriceEnv` names the Netlify env var holding the Stripe Price ID (set when payments are turned on).
export const PLANS = [
  { id: 'monthly', label: 'Monthly', price: 2.99, period: 'mo', perMonth: 2.99, trialDays: 0, mode: 'subscription', stripePriceEnv: 'STRIPE_PRICE_MONTHLY' },
  { id: 'yearly', label: 'Yearly', price: 19.99, period: 'yr', perMonth: 1.67, trialDays: 3, badge: 'Save 44%', mode: 'subscription', stripePriceEnv: 'STRIPE_PRICE_YEARLY' },
  { id: 'lifetime', label: 'Lifetime', price: 39.99, period: 'once', perMonth: null, trialDays: 0, mode: 'payment', stripePriceEnv: 'STRIPE_PRICE_LIFETIME' },
];
export const DEFAULT_PLAN = 'yearly';
export const CURRENCY = 'USD';
export const fmt = (n) => `$${n.toFixed(2)}`;
export const planById = (id) => PLANS.find((p) => p.id === id);
