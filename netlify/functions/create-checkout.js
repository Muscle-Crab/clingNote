// Provider-agnostic checkout endpoint. Payments are PARKED: returns 501 "not configured" until enabled.
//
// TODO (Stripe Checkout) to turn on payments:
//  1. Set Netlify env: PAYMENTS_ENABLED=true, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//     STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY (recurring prices), STRIPE_PRICE_LIFETIME (one-time price).
//  2. Verify the Firebase ID token from the Authorization header (firebase-admin auth().verifyIdToken) -> uid.
//  3. monthly/yearly: stripe.checkout.sessions.create({ mode: 'subscription', line_items: [{ price, quantity: 1 }],
//       subscription_data: { trial_period_days: plan.trialDays || undefined, metadata: { uid, planId } },
//       client_reference_id: uid, metadata: { uid, planId }, success_url, cancel_url })
//     lifetime: mode: 'payment' with STRIPE_PRICE_LIFETIME.
//  4. Webhook (stripe-webhook.js): on checkout.session.completed / customer.subscription.updated|deleted,
//     set users/{uid} { isPro, plan, proExpiresAt, stripeCustomerId } via firebase-admin.
const PLAN_IDS = ['monthly', 'yearly', 'lifetime'];
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let planId;
  try { ({ planId } = JSON.parse(event.body || '{}')); } catch (e) { return json(400, { error: 'Bad JSON' }); }
  if (!PLAN_IDS.includes(planId)) return json(400, { error: 'Unknown plan' });
  if (process.env.PAYMENTS_ENABLED !== 'true') return json(501, { configured: false, message: 'Payments coming soon' });
  // TODO: implement provider call (see steps above) and return { url: session.url }
  return json(501, { configured: false, message: 'Payments coming soon' });
};
