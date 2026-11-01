// POST /.netlify/functions/community-notify   Authorization: Bearer <Firebase ID token>
// Body: { postId }  -> background push for a NEW community post: fans out to the author's followers (capped at 500),
// skipping followers who blocked the author or turned the 'post' notification type off, and pushes via the existing
// FCM sender (lib/fcm.js, users/{uid}.fcmTokens). The in-app inbox entries are written client-side; this adds device push.
// PREPARED ONLY: not called by the client yet. Production step: deploy with the site + wire a call after createPost.
// Native iOS push additionally needs APNs/FCM native tokens (see lib/nativePush / docs); no new keys are added here.
const { getAdmin } = require('./lib/firebaseAdmin');
const { verifyUser } = require('./lib/notify');
const { sendToUser } = require('./lib/fcm');
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const CAP = 500;

const fanout = async ({ db }, authorUid, cap = CAP) => {
  const fs = await db.collection('follows').where('to', '==', authorUid).limit(cap).get();
  const out = [];
  for (const d of fs.docs) {
    const to = d.data().from; if (!to || to === authorUid) continue;
    const [blk, prefs] = await Promise.all([db.doc(`users/${to}/blocks/${authorUid}`).get(), db.doc(`users/${to}/community/prefs`).get()]);
    if (blk.exists) continue;
    if (prefs.exists && prefs.data().notif && prefs.data().notif.post === false) continue;
    out.push(to);
  }
  return out;
};

const rawHandler = async (event, ctx, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const verify = deps.verify || ((t) => getAdmin().auth().verifyIdToken(t));
    const uid = await verifyUser(event.headers, verify);
    let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
    const postId = typeof body.postId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(body.postId) ? body.postId : null;
    if (!postId) return json(400, { error: 'postId required' });
    const admin = deps.db ? null : getAdmin();
    const env = deps.db ? { db: deps.db, messaging: deps.messaging, FieldValue: deps.FieldValue } : { db: admin.firestore(), messaging: admin.messaging(), FieldValue: admin.firestore.FieldValue };
    const post = await env.db.doc(`communityPosts/${postId}`).get();
    if (!post.exists || post.data().uid !== uid) return json(403, { error: 'Not your post' });
    const p = post.data(); const name = (typeof p.name === 'string' && !p.name.includes('@') && p.name) || 'Someone';
    const targets = await fanout(env, uid);
    let sent = 0;
    for (const to of targets) { try { const r = await sendToUser(env, to, { title: 'ClingNote Community', body: `${name} posted: ${String(p.title || p.text || 'new progress').slice(0, 80)}`, url: `/community?post=${postId}`, tag: 'community' }); sent += r.sent || 0; } catch (e) { /* skip one bad recipient */ } }
    return json(200, { ok: true, recipients: targets.length, sent });
  } catch (e) { console.error('community-notify', e.message); return json(e.status || 500, { error: e.status ? e.message : 'Could not notify' }); }
};
const { withCors } = require('./lib/cors');
exports.handler = withCors(rawHandler);
exports.rawHandler = rawHandler;
exports.fanout = fanout;
