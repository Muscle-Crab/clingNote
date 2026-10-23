// POST   /.netlify/functions/calendar-token  Authorization: Bearer <ID token>  -> { token }  (Pro only; rotates the feed token)
// DELETE /.netlify/functions/calendar-token  -> revokes the caller's token (any signed-in user)
const crypto = require('crypto');
const { getAdmin } = require('./lib/firebaseAdmin');
const { requirePro } = require('./lib/requirePro');
const { verifyUser } = require('./lib/notify');
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const rawHandler = async (event, ctx, deps = {}) => {
  try {
    const verify = deps.verify || ((t) => getAdmin().auth().verifyIdToken(t));
    let uid;
    if (event.httpMethod === 'POST') uid = await requirePro(event, { verify, db: deps.db });
    else if (event.httpMethod === 'DELETE') uid = await verifyUser(event.headers, verify);
    else return json(405, { error: 'Method not allowed' });
    const db = deps.db || getAdmin().firestore();
    const settings = db.doc(`userSettings/${uid}`);
    const s = await settings.get();
    const old = (s.exists && s.data().icsToken) || '';
    let token = '';
    if (event.httpMethod === 'POST') {
      token = crypto.randomBytes(24).toString('hex');
      await db.doc(`icsTokens/${token}`).set({ uid, createdAt: new Date() });
    }
    await settings.set({ icsToken: token }, { merge: true });
    if (old && /^[a-f0-9]{48}$/.test(old)) await db.doc(`icsTokens/${old}`).delete().catch(() => {});
    return json(200, { token });
  } catch (e) { return json(e.status || 500, { error: e.status ? e.message : 'Error' }); }
};
const { withCors } = require('./lib/cors');
exports.handler = withCors(rawHandler);
