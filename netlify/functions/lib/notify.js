// Shared server-side helpers for OneSignal + Firebase auth. Secrets only come from env vars; never sent to the client.
//   ONESIGNAL_REST_API_KEY, ONESIGNAL_APP_ID, GOOGLE_APPLICATION_CREDENTIALS_BASE (base64 service-account JSON)
//   ONESIGNAL_ALLOW_BROADCAST=true  (optional; enables legacy "send to All" community notifications)
const MAX_LEN = { title: 80, message: 300 };
const clip = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

// Custom iOS sound (bundled robot-coach clip, see src/utils/notifSound.js). Only our own bundled file names pass.
const IOS_SOUNDS = new Set(['cn_task.caf', 'cn_morning.caf', 'cn_evening.caf']);
const iosSound = (s) => (IOS_SOUNDS.has(s) ? s : undefined);

const authHeader = (key) => (String(key).startsWith('os_v2_') ? `Key ${key}` : `Basic ${key}`);

// Build the OneSignal payload. kind 'self' targets ONLY the caller (external_id = Firebase uid; the client calls OneSignal.login(uid)).
const buildPayload = ({ appId, uid, kind = 'self', title, message, sendAfter, url, sound }, { allowBroadcast = false } = {}) => {
  if (!appId) throw Object.assign(new Error('Server not configured'), { status: 500 });
  const body = { app_id: appId, headings: { en: clip(title, MAX_LEN.title) || 'ClingNote' }, contents: { en: clip(message, MAX_LEN.message) } };
  if (!body.contents.en) throw Object.assign(new Error('Empty message'), { status: 400 });
  if (kind === 'self') {
    if (!uid) throw Object.assign(new Error('No user'), { status: 401 });
    body.include_aliases = { external_id: [uid] };
    body.target_channel = 'push';
  } else if (kind === 'broadcast') {
    if (!allowBroadcast) throw Object.assign(new Error('Broadcast disabled'), { status: 403 });
    body.included_segments = ['Subscribed Users'];
  } else throw Object.assign(new Error('Bad kind'), { status: 400 });
  if (sendAfter) {
    const t = new Date(sendAfter);
    if (Number.isNaN(t.getTime())) throw Object.assign(new Error('Bad sendAfter'), { status: 400 });
    if (t.getTime() > Date.now() + 30 * 86400000) throw Object.assign(new Error('sendAfter too far'), { status: 400 });
    if (t.getTime() > Date.now()) body.send_after = t.toISOString();
  }
  if (url && /^https:\/\/clingnot\.netlify\.app\//.test(url)) body.url = url;
  if (iosSound(sound)) body.ios_sound = sound; // OneSignal -> APNs aps.sound
  return body;
};

// Same init helper as every other function (accepts FIREBASE_SERVICE_ACCOUNT, GOOGLE_APPLICATION_CREDENTIALS_BASE64 and _BASE).
const { getAdmin } = require('./firebaseAdmin');

// Verify "Authorization: Bearer <Firebase ID token>" -> uid (throws 401).
const verifyUser = async (headers, verify = (t) => getAdmin().auth().verifyIdToken(t)) => {
  const h = headers?.authorization || headers?.Authorization || '';
  const m = /^Bearer (.+)$/.exec(h);
  if (!m) throw Object.assign(new Error('Missing token'), { status: 401 });
  try { return (await verify(m[1])).uid; } catch (e) { throw Object.assign(new Error('Invalid token'), { status: 401 }); }
};

const sendOneSignal = async (payload, key = process.env.ONESIGNAL_REST_API_KEY, fetchImpl = fetch) => {
  if (!key) throw Object.assign(new Error('Server not configured'), { status: 500 });
  const r = await fetchImpl('https://api.onesignal.com/notifications', {
    method: 'POST', headers: { Authorization: authHeader(key), 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('OneSignal error'), { status: 502, detail: data?.errors });
  return { id: data.id || null };
};

module.exports = { iosSound, IOS_SOUNDS, buildPayload, verifyUser, sendOneSignal, authHeader, getAdmin, clip };
