const { withCors } = require('./lib/cors');
// Client-triggered entitlement refresh (after purchase / restore on iOS). Authenticated with the caller's Firebase ID token;
// the caller can only ever sync THEIR OWN uid, and the result comes from RevenueCat's REST API, never from the client.
const { verifyUser } = require('./lib/notify');
const { syncUid } = require('./lib/revenuecat');
const { getAdmin } = require('./lib/firebaseAdmin');

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const handler = async (event, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const uid = await verifyUser(event.headers, deps.verify || ((t) => getAdmin().auth().verifyIdToken(t)));
    const r = await syncUid(uid, deps);
    if (!r) return json(400, { error: 'Bad user id' });
    return json(200, { isPro: r.isPro, plan: r.plan, wrote: !!r.wrote });
  } catch (e) {
    return json(e.status || 500, { error: e.status ? e.message : 'Sync failed' });
  }
};
exports.handler = withCors((event) => handler(event));
exports._handler = handler;
