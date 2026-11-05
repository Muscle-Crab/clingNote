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

// Daily task-creation limit for free accounts only (tasks created or scheduled for one calendar day).
// Pro has no daily cap. A numeric Pro cap (5, then 50) blocked the voice Review sheet:
// "Instagram post: Daily limit reached: 5 tasks per day on Pro."
export const TASK_LIMITS = { free: 5 };
// Kept false so no screen advertises a Pro tasks-per-day number. Pro is not capped.
export const PRO_RAISES_LIMIT = false;
/** null means unlimited. */
export const dailyTaskLimit = (pro) => (pro ? null : TASK_LIMITS.free);
/** True when `count` existing tasks already fill the free daily cap. Pro is never full. */
export const dailyLimitFull = (pro, count) => { const limit = dailyTaskLimit(pro); return limit != null && count >= limit; };
/** Adds still allowed today. Infinity for Pro. */
export const dailyLimitRoom = (pro, count) => { const limit = dailyTaskLimit(pro); return limit == null ? Infinity : Math.max(0, limit - count); };
