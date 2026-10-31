// Friend-approved early unlock (Coach mode game plan item 6). Pure helpers shared by the function and its tests.
const crypto = require('crypto');
const TTL_MS = 2 * 3600 * 1000; // a request link works for 2 hours
const MINUTES = [10, 20, 30];
const newToken = () => crypto.randomBytes(18).toString('base64url');
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const validTokenShape = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(t);
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const normMinutes = (m) => (MINUTES.includes(Number(m)) ? Number(m) : 20);
const tsMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : Number(v) || 0);
// Public view of a request (what the friend's page shows). Expired pending requests read as 'expired'.
const view = (r, nowMs) => {
  const status = r.status === 'pending' && tsMs(r.expiresAt) <= nowMs ? 'expired' : r.status;
  return { ownerName: clip(r.ownerName, 60) || 'Your friend', friendName: clip(r.friendName, 40), minutes: r.minutes, reason: clip(r.reason, 140), status, expiresAt: tsMs(r.expiresAt), decidedAt: tsMs(r.decidedAt) };
};
const canDecide = (r, nowMs) => !!r && r.status === 'pending' && tsMs(r.expiresAt) > nowMs;
module.exports = { TTL_MS, MINUTES, newToken, hashToken, validTokenShape, clip, normMinutes, view, canDecide, tsMs };
