// POST /.netlify/functions/send-notification
// Headers: Authorization: Bearer <Firebase ID token>
// Body: { kind?: 'self'|'broadcast', title, message, sendAfter?: ISO, url? }
// 'self' always targets the caller's own devices (OneSignal external_id = uid). The REST key never leaves the server.
const { buildPayload, verifyUser, sendOneSignal } = require('./lib/notify');

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

exports.handler = async (event, ctx, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const uid = await verifyUser(event.headers, deps.verify);
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
    const payload = buildPayload({ ...body, uid, appId: process.env.ONESIGNAL_APP_ID }, { allowBroadcast: process.env.ONESIGNAL_ALLOW_BROADCAST === 'true' });
    const res = await sendOneSignal(payload, process.env.ONESIGNAL_REST_API_KEY, deps.fetch || fetch);
    return json(200, { ok: true, id: res.id });
  } catch (e) {
    return json(e.status || 500, { error: e.message });
  }
};
