// RevenueCat webhook (Apple IAP). RevenueCat sends the value configured in the dashboard "Authorization header value" on every call.
// The payload is only a trigger: each affected uid is re-verified against the RevenueCat REST API before anything is written.
// Idempotent: re-processing the same event (RC retries reuse the event id) re-derives the same state. Sandbox events are honoured
// (App Review and TestFlight purchase in the sandbox).
// Env: REVENUECAT_WEBHOOK_SECRET, REVENUECAT_SECRET_KEY, Firebase Admin creds.
const { authOk, candidateUids, syncUid } = require('./lib/revenuecat');

const handler = async (event, deps = {}) => {
  if (event.httpMethod && event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!authOk(event.headers, process.env.REVENUECAT_WEBHOOK_SECRET)) return { statusCode: 401, body: 'Unauthorized' };
  let ev;
  try { ev = JSON.parse(event.body || '{}').event || {}; } catch (e) { return { statusCode: 400, body: 'Bad JSON' }; }
  if (ev.type === 'TEST') return { statusCode: 200, body: 'ok (test)' };
  const uids = candidateUids(ev);
  try {
    let n = 0;
    for (const uid of uids) { const r = await syncUid(uid, deps); if (r) { n++; console.log(`RC sync ${ev.type} uid=${uid} isPro=${r.isPro} wrote=${r.wrote} env=${ev.environment}`); } }
    return { statusCode: 200, body: JSON.stringify({ ok: true, synced: n }) };
  } catch (e) {
    console.error('RevenueCat webhook failed:', e.message);
    return { statusCode: 500, body: 'Handler error' }; // non-2xx => RevenueCat retries
  }
};
exports.handler = (event) => handler(event);
exports._handler = handler;
