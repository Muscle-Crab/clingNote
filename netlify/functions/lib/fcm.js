// Reusable FCM sender: pushes a data message to ONE user's own registered web tokens (users/{uid}.fcmTokens) and
// removes tokens FCM reports as dead. Callers must pass an already-authenticated uid; this never accepts tokens from a request.
const BAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const safePath = (u) => (typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') ? clip(u, 200) : '/home');

const sendToUser = async ({ db, messaging, FieldValue }, uid, n = {}) => {
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  const tokens = [...new Set(((snap.exists && snap.data().fcmTokens) || []).filter((t) => typeof t === 'string' && t))].slice(-10);
  if (!tokens.length) return { sent: 0, failed: 0, removed: 0, tokens: 0 };
  const data = { title: clip(n.title || 'ClingNot', 80), body: clip(n.body || '', 240), url: safePath(n.url), tag: clip(n.tag || 'clingnot', 40) };
  const res = await messaging.sendEachForMulticast({ tokens, data, webpush: { headers: { Urgency: 'high', TTL: '3600' } } });
  const dead = []; const errors = [];
  res.responses.forEach((r, i) => { if (r.success) return; const c = (r.error && r.error.code) || 'unknown'; if (!errors.includes(c)) errors.push(c); if (BAD.has(c)) dead.push(tokens[i]); });
  if (dead.length) await ref.update({ fcmTokens: FieldValue.arrayRemove(...dead) });
  return { sent: res.successCount, failed: res.failureCount, removed: dead.length, tokens: tokens.length, errors };
};

module.exports = { sendToUser, safePath, BAD };
