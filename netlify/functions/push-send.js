// POST /.netlify/functions/push-send   Authorization: Bearer <Firebase ID token>
// Body: { title?, body?, url? }  -> pushes to the CALLER's own registered devices only (never accepts tokens or a target uid).
const { getAdmin } = require('./lib/firebaseAdmin');
const { verifyUser } = require('./lib/notify');
const { sendToUser } = require('./lib/fcm');
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const rawHandler = async (event, ctx, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const verify = deps.verify || ((t) => getAdmin().auth().verifyIdToken(t));
    const uid = await verifyUser(event.headers, verify);
    let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
    const admin = deps.db ? null : getAdmin();
    const env = deps.db ? { db: deps.db, messaging: deps.messaging, FieldValue: deps.FieldValue } : { db: admin.firestore(), messaging: admin.messaging(), FieldValue: admin.firestore.FieldValue };
    const r = await sendToUser(env, uid, { title: body.title || 'CleanNote test', body: body.body || 'Push notifications are working 🎉', url: body.url || '/home', tag: 'test' });
    if (!r.tokens) return json(404, { error: 'No registered devices. Turn on notifications on this device first.' });
    return json(200, { ok: r.sent > 0, ...r });
  } catch (e) { console.error('push-send', e.message); return json(e.status || 500, { error: e.status ? e.message : 'Could not send' }); }
};
const { withCors } = require('./lib/cors');
exports.handler = withCors(rawHandler);
