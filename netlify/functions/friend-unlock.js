// Friend-approved early unlock (Coach mode). Records: unlockRequests/{sha256(token)} (server-only; Firestore rules deny clients).
// Early unlock with a friend is OPTIONAL (Settings → Coach mode → "Friend approval to unlock", default off); the function refuses requests while it is off.
// Signed in (Authorization: Bearer <Firebase ID token>):
//   POST { action:'request', friendName, minutes:10|20|30, reason? } -> { token, url, expiresAt }   (one pending request per user; a new one replaces it)
//   POST { action:'status', token }                                  -> { status, minutes, decidedAt }  (owner only)
// Public (the friend, no account, opens /friend-unlock.html?t=TOKEN on the Netlify site):
//   GET  ?token=...                          -> { ownerName, friendName, minutes, reason, status }
//   POST { token, action:'approve'|'deny' }  -> { status }    (once; pending + not expired only)
const { getAdmin } = require('./lib/firebaseAdmin');
const { assertPro } = require('./lib/requirePro');
const { verifyUser } = require('./lib/notify');
const { withCors } = require('./lib/cors');
const F = require('./lib/friendUnlock');

const SITE = process.env.PUBLIC_SITE_URL || 'https://clingnot.netlify.app';
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }, body: JSON.stringify(body) });
const err = (status, message) => Object.assign(new Error(message), { status });
const load = async (db, token) => {
  if (!F.validTokenShape(token)) throw err(404, 'Link not found');
  const ref = db.doc(`unlockRequests/${F.hashToken(token)}`); const s = await ref.get();
  if (!s.exists) throw err(404, 'Link not found');
  return { ref, r: s.data() };
};
const rawHandler = async (event = {}, ctx, deps = {}) => {
  try {
    const db = deps.db || getAdmin().firestore(); const now = deps.now ? deps.now() : Date.now();
    const method = String(event.httpMethod || 'GET').toUpperCase();
    if (method === 'GET') { const { r } = await load(db, (event.queryStringParameters || {}).token); return json(200, F.view(r, now)); }
    if (method !== 'POST') return json(405, { error: 'Method not allowed' });
    let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { throw err(400, 'Bad JSON'); }
    const action = body.action;
    if (action === 'approve' || action === 'deny') {
      const { ref } = await load(db, body.token);
      const status = await db.runTransaction(async (tx) => {
        const s = await tx.get(ref); const r = s.data();
        if (!F.canDecide(r, now)) return F.view(r, now).status;
        const st = action === 'approve' ? 'approved' : 'denied';
        tx.set(ref, { status: st, decidedAt: new Date(now) }, { merge: true }); return st;
      });
      return json(200, { status });
    }
    const uid = await verifyUser(event.headers || {}, deps.verify);
    if (action === 'request') {
      await assertPro(db, uid); // Paywall: app locking is Pro
      const friendName = F.clip(body.friendName, 40); if (!friendName) throw err(400, 'Pick a friend first');
      const u = await db.doc(`users/${uid}`).get();
      if (!(u.exists && u.data().gamePlan && u.data().gamePlan.friendUnlock === true)) throw err(403, 'Friend approval is off. Turn it on in Settings → Coach mode.'); // optional feature, default off
      const p = await db.doc(`publicProfiles/${uid}`).get();
      const ownerName = F.clip((p.exists && p.data().name) || (u.exists && u.data().name) || '', 60);
      const prev = u.exists && u.data().friendUnlock && u.data().friendUnlock.hash;
      if (prev) await db.doc(`unlockRequests/${prev}`).set({ status: 'replaced' }, { merge: true }).catch(() => {});
      const token = F.newToken(); const hash = F.hashToken(token); const expiresAt = now + F.TTL_MS;
      await db.doc(`unlockRequests/${hash}`).set({ uid, ownerName, friendName, minutes: F.normMinutes(body.minutes), reason: F.clip(body.reason, 140), status: 'pending', createdAt: new Date(now), expiresAt: new Date(expiresAt), decidedAt: null });
      await db.doc(`users/${uid}`).set({ friendUnlock: { hash, at: now } }, { merge: true });
      return json(200, { token, url: `${SITE}/friend-unlock.html?t=${token}`, expiresAt });
    }
    if (action === 'status') {
      const { r } = await load(db, body.token); if (r.uid !== uid) throw err(404, 'Link not found');
      const v = F.view(r, now); return json(200, { status: v.status, minutes: v.minutes, decidedAt: v.decidedAt });
    }
    throw err(400, 'Unknown action');
  } catch (e) { return json(e.status || 500, { error: e.status ? e.message : 'Error' }); }
};
exports.rawHandler = rawHandler;
exports.handler = withCors(rawHandler);
