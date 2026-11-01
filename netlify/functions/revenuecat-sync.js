const { withCors } = require('./lib/cors');
// Client-triggered entitlement refresh (after purchase / restore on iOS). Authenticated with the caller's Firebase ID token;
// the caller can only ever sync THEIR OWN uid, and the result comes from RevenueCat's REST API, never from the client.
const { verifyUser } = require('./lib/notify');
const { syncUid } = require('./lib/revenuecat');
const { getAdmin } = require('./lib/firebaseAdmin');

const handler = async (event, deps = {}) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const uid = await verifyUser(event.headers, deps.verify || ((t) => getAdmin().auth().verifyIdToken(t)));
    const r = await syncUid(uid, deps);
    if (!r) return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
    return { statusCode: 200, body: JSON.stringify({ isPro: r.isPro, plan: r.plan }) };
  } catch (e) {
    return { statusCode: e.status || 500, body: JSON.stringify({ error: e.status ? e.message : 'Sync failed' }) };
  }
};
exports.handler = withCors((event) => handler(event));
exports._handler = handler;
