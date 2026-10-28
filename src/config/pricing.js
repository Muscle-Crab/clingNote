// Single source of truth for ClingNote plan pricing. Change prices here only.
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

// Daily task-creation limits (tasks created or scheduled for one calendar day). Change here only.
export const TASK_LIMITS = { free: 5, pro: 5 }; // 5 tasks/day for free and Pro
// Free and Pro share the same 50/day safety max, so Pro does not sell a higher daily limit.
export const PRO_RAISES_LIMIT = TASK_LIMITS.pro > TASK_LIMITS.free;
export const dailyTaskLimit = (pro) => (pro ? TASK_LIMITS.pro : TASK_LIMITS.free);
