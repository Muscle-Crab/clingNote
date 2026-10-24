// Manager & Pal backend (admin SDK; Firestore rules keep these collections server-write-only).
// Public (manager, no account):   GET  ?token=...                          -> owner name, read-only tasks, chat
//                                  POST { token, action: 'setName'|'nudge'|'dm', ... }
// Signed in (Authorization: Bearer <Firebase ID token>):
//   POST { action: 'createManagerLink', name? } -> { token }   (rotates: any older link stops working)
//        'revokeManager' | 'reply' {text} | 'createPalCode' -> {code} | 'acceptPal' {code} | 'removePal' {palUid}
// Data: managers/{uid} {tokenHash,name,createdAt,writes}  managerLinks/{sha256(token)} {uid}
//       users/{uid}/managerChat/{id} {kind:'nudge'|'dm', from:'manager'|'user', text, taskKey?, taskTitle?, createdAt, read}
//       palInvites/{CODE} {uid,name,expiresAt}  pals/{pairId} {members:[a,b], names:{}, createdAt}
const { getAdmin } = require('./lib/firebaseAdmin');
const { verifyUser, buildPayload, sendOneSignal } = require('./lib/notify');
const { withCors } = require('./lib/cors');
const M = require('./lib/managerPal');

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }, body: JSON.stringify(body) });
const err = (status, message) => Object.assign(new Error(message), { status });
const HOURLY_WRITE_CAP = 40;

const resolveToken = async (db, token) => {
  if (!M.validTokenShape(token)) throw err(404, 'Link not found');
  const h = M.hashToken(token);
  const link = await db.doc(`managerLinks/${h}`).get();
  if (!link.exists) throw err(404, 'Link not found');
  const uid = link.data().uid;
  const mref = db.doc(`managers/${uid}`);
  const m = await mref.get();
  if (!m.exists || m.data().tokenHash !== h) throw err(404, 'Link not found'); // revoked or rotated
  return { uid, mref, manager: m.data() };
};
const ownerName = async (db, uid) => { const p = await db.doc(`publicProfiles/${uid}`).get(); return (p.exists && M.clipText(p.data().name, 60)) || 'Your person'; };
const loadTasks = async (db, uid, now) => {
  const snaps = await Promise.all(M.WEEK.map((d) => db.doc(`weeklyRoutines/${uid}_${d}`).get()));
  return M.viewTasks(snaps.map((s, i) => ({ day: M.WEEK[i], tasks: s.exists ? s.data().tasks || [] : [] })), now);
};
const loadChat = async (db, uid) => {
  const q = await db.collection(`users/${uid}/managerChat`).orderBy('createdAt', 'desc').limit(60).get();
  return q.docs.map((d) => { const x = d.data(); return { id: d.id, kind: x.kind, from: x.from, text: x.text, taskKey: x.taskKey || null, taskTitle: x.taskTitle || null, at: M.tsMs(x.createdAt), read: !!x.read }; }).reverse();
};
const bumpWrites = async (db, mref, now) => {
  // Simple hourly cap per link so a leaked link cannot flood the inbox.
  return db.runTransaction(async (tx) => {
    const s = await tx.get(mref); const w = (s.data() && s.data().writes) || {}; const hour = Math.floor(now.getTime() / 3600000);
    const n = w.hour === hour ? w.n || 0 : 0;
    if (n >= HOURLY_WRITE_CAP) throw err(429, 'Too many messages, try again later');
    tx.set(mref, { writes: { hour, n: n + 1 } }, { merge: true });
  });
};
const push = async (deps, uid, title, message) => {
  try { const p = buildPayload({ appId: process.env.ONESIGNAL_APP_ID, uid, kind: 'self', title, message, url: 'https://clingnot.netlify.app/pals' }); await (deps.sendPush || sendOneSignal)(p); } catch (e) { /* push is best-effort */ }
};

const managerHandler = async (event, db, deps, now) => {
  const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
  const token = event.httpMethod === 'GET' ? (event.queryStringParameters || {}).token : body.token;
  const { uid, mref, manager } = await resolveToken(db, token);
  if (event.httpMethod === 'GET') {
    const [name, tasks, chat] = await Promise.all([ownerName(db, uid), loadTasks(db, uid, now), loadChat(db, uid)]);
    return json(200, { ownerName: name, managerName: manager.name || '', tasks, chat: chat.map(({ read, ...c }) => c) });
  }
  const { action } = body;
  if (action === 'setName') { const name = M.clipText(body.name, 40); if (!name) throw err(400, 'Name required'); await mref.set({ name }, { merge: true }); return json(200, { ok: true, managerName: name }); }
  if (action !== 'nudge' && action !== 'dm') throw err(400, 'Bad action');
  await bumpWrites(db, mref, now);
  const mName = manager.name || 'Your manager';
  let doc;
  if (action === 'nudge') {
    const preset = M.NUDGE_PRESETS[body.preset] ? body.preset : 'ping';
    const tasks = await loadTasks(db, uid, now);
    const t = body.taskKey ? tasks.find((x) => x.key === body.taskKey) : null;
    if (body.taskKey && !t) throw err(404, 'Task not found');
    doc = { kind: 'nudge', from: 'manager', preset, taskKey: t ? t.key : null, taskTitle: t ? t.title : null, text: M.nudgeText(mName, preset, t && t.title) };
  } else {
    const text = M.clipText(body.text, 1000); if (!text) throw err(400, 'Empty message');
    doc = { kind: 'dm', from: 'manager', text };
  }
  const ref = await db.collection(`users/${uid}/managerChat`).add({ ...doc, createdAt: now, read: false });
  await push(deps, uid, action === 'nudge' ? `Nudge from ${mName}` : `Message from ${mName}`, doc.text);
  return json(200, { ok: true, id: ref.id, at: now.getTime() });
};

const userHandler = async (event, db, deps, now, uid) => {
  const body = JSON.parse(event.body || '{}');
  const mref = db.doc(`managers/${uid}`);
  switch (body.action) {
    case 'createManagerLink': {
      const old = await mref.get(); const token = M.newToken(); const h = M.hashToken(token);
      await db.doc(`managerLinks/${h}`).set({ uid, createdAt: now });
      await mref.set({ tokenHash: h, name: M.clipText(body.name, 40) || (old.exists && old.data().name) || '', createdAt: now, writes: { hour: 0, n: 0 } });
      if (old.exists && old.data().tokenHash) await db.doc(`managerLinks/${old.data().tokenHash}`).delete().catch(() => {});
      return json(200, { token });
    }
    case 'revokeManager': {
      const old = await mref.get();
      if (old.exists && old.data().tokenHash) await db.doc(`managerLinks/${old.data().tokenHash}`).delete().catch(() => {});
      await mref.delete();
      return json(200, { ok: true });
    }
    case 'reply': {
      const text = M.clipText(body.text, 1000); if (!text) throw err(400, 'Empty message');
      const m = await mref.get(); if (!m.exists) throw err(409, 'No manager link');
      const ref = await db.collection(`users/${uid}/managerChat`).add({ kind: 'dm', from: 'user', text, createdAt: now, read: true });
      return json(200, { ok: true, id: ref.id, at: now.getTime() });
    }
    case 'createPalCode': {
      const code = M.newPalCode();
      await db.doc(`palInvites/${code}`).set({ uid, name: await ownerName(db, uid), createdAt: now, expiresAt: new Date(now.getTime() + 7 * 86400000) });
      return json(200, { code });
    }
    case 'acceptPal': {
      const code = M.normCode(body.code); if (code.length !== 8) throw err(400, 'Invalid code');
      const iref = db.doc(`palInvites/${code}`); const inv = await iref.get();
      if (!inv.exists || M.tsMs(inv.data().expiresAt) < now.getTime()) throw err(404, 'Code not found or expired');
      const other = inv.data().uid; if (other === uid) throw err(400, "That's your own code");
      const id = M.pairId(uid, other);
      await db.doc(`pals/${id}`).set({ members: [uid, other].sort(), names: { [uid]: await ownerName(db, uid), [other]: inv.data().name || '' }, createdAt: now });
      await iref.delete();
      await push(deps, other, 'New pal', `${await ownerName(db, uid)} accepted your pal invite`);
      return json(200, { ok: true, pairId: id, palUid: other });
    }
    case 'removePal': {
      const other = String(body.palUid || ''); if (!other) throw err(400, 'palUid required');
      const pref = db.doc(`pals/${M.pairId(uid, other)}`); const p = await pref.get();
      if (!p.exists || !(p.data().members || []).includes(uid)) throw err(404, 'Not a pal');
      const msgs = await pref.collection('messages').limit(450).get();
      const batch = db.batch(); msgs.docs.forEach((d) => batch.delete(d.ref)); batch.delete(pref); await batch.commit();
      return json(200, { ok: true });
    }
    default: throw err(400, 'Bad action');
  }
};

const rawHandler = async (event, ctx, deps = {}) => {
  try {
    const db = deps.db || getAdmin().firestore();
    const now = deps.now ? deps.now() : new Date();
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const hasAuth = /^Bearer /.test((event.headers || {}).authorization || (event.headers || {}).Authorization || '');
    if (!hasAuth) return await managerHandler(event, db, deps, now);
    const uid = await verifyUser(event.headers, deps.verify);
    return await userHandler(event, db, deps, now, uid);
  } catch (e) { return json(e.status || 500, { error: e.status ? e.message : 'Error' }); }
};
exports.rawHandler = rawHandler;
exports.handler = withCors(rawHandler);
