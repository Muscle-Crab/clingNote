// Manager & Pal backend (admin SDK; Firestore rules keep these collections server-write-only).
// Public (manager, no account):   GET  ?token=...                          -> owner name, read-only tasks, chat
//                                  POST { token, action: 'setName'|'nudge'|'dm', ... }
// Signed in (Authorization: Bearer <Firebase ID token>):
//   POST { action: 'createManagerLink', name? } -> { token }   (rotates: any older link stops working)
//        'revokeManager' | 'reply' {text} | 'createPalCode' -> {code} | 'acceptPal' {code} | 'removePal' {palUid}
//   Manager accounts (optional; the no-account link keeps working):
//        'connectManager' {token} -> {ownerUid}            (signed-in user becomes a manager of the link's owner)
//        'managerView' {ownerUid} -> same shape as the public GET
//        'managerAct' {ownerUid, act:'nudge'|'dm', ...}     (same as the public nudge/dm)
//        'palTasks' {palUid} -> {tasks}   (pals; private tasks stripped)
//        'disconnectManager' {managerUid} (owner side) | {ownerUid} (manager leaves)
//   Safety (App Store 1.2):
//        'report' {scope:'manager'|'pal', messageId, ownerUid?, palUid?, reason?} -> stores reports/{id} for review
//        'block'  {managerUid} (owner blocks a connected manager; also turns off the link) | {ownerUid} (manager blocks the person)
//                 | {palUid} (removes the pal + chat). Blocked pairs can't reconnect by link or code.
//        public link: POST { token, action:'report', messageId, reason? }
//   blocks/{blockerUid}_{blockedUid} {blockerUid, blockedUid, createdAt}   reports/{id} {reporterUid|null, scope, messageId, text, ...}
//   managerConnections/{ownerUid}_{managerUid} {ownerUid, managerUid, ownerName, managerName, createdAt, writes}
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
  // The app keys day docs by short names (src/data.json days[].day: `${uid}_Mon`); full names (`${uid}_Monday`) are read as a legacy fallback.
  const ids = M.WEEK.flatMap((d) => [`${uid}_${d.slice(0, 3)}`, `${uid}_${d}`]);
  const [snaps, user] = await Promise.all([Promise.all(ids.map((id) => db.doc(`weeklyRoutines/${id}`).get())), db.doc(`users/${uid}`).get()]);
  const tasksOf = (s) => (s.exists ? s.data().tasks || [] : []);
  const week = M.viewTasks(M.WEEK.map((day, i) => ({ day, tasks: [...tasksOf(snaps[2 * i]), ...tasksOf(snaps[2 * i + 1])] })), now);
  // Scheduled / recurring tasks not yet in a day list (Public only; read-only projection, see lib/managerPal.js viewScheduled).
  const sched = user.exists ? M.viewScheduled((user.data().scheduledTasks || {}).tasks, now) : [];
  return [...week, ...sched];
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

const viewPayload = async (db, uid, mName, now) => {
  const [name, tasks, chat] = await Promise.all([ownerName(db, uid), loadTasks(db, uid, now), loadChat(db, uid)]);
  return json(200, { ownerName: name, managerName: mName || '', tasks, chat: chat.map(({ read, ...c }) => c) });
};
const managerHandler = async (event, db, deps, now) => {
  const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
  const token = event.httpMethod === 'GET' ? (event.queryStringParameters || {}).token : body.token;
  const { uid, mref, manager } = await resolveToken(db, token);
  if (event.httpMethod === 'GET') return viewPayload(db, uid, manager.name, now);
  const { action } = body;
  if (action === 'report') {
    // Someone using the no-account link reports a message from the person.
    const { path, msg } = await managerChatMsg(db, uid, body.messageId);
    if (msg.from !== 'user') throw err(400, 'You can only report messages you received');
    return fileReport(db, now, { reporterUid: null, reporterKind: 'link', scope: 'manager', ownerUid: uid, path, messageId: body.messageId, text: msg.text || '', authorUid: uid, reason: body.reason, note: body.note });
  }
  if (action === 'setName') { const name = M.clipText(body.name, 40); if (!name) throw err(400, 'Name required'); await mref.set({ name }, { merge: true }); return json(200, { ok: true, managerName: name }); }
  return managerWrite(db, deps, now, uid, mref, manager.name, action, body);
};
const REASONS = ['spam', 'harassment', 'inappropriate', 'other'];
const blockRef = (db, a, b) => db.doc(`blocks/${a}_${b}`);
const isBlocked = async (db, a, b) => { const [x, y] = await Promise.all([blockRef(db, a, b).get(), blockRef(db, b, a).get()]); return x.exists || y.exists; };
const fileReport = async (db, now, r) => {
  // One report per reporter + message (re-reporting just updates the reason).
  const id = M.hashToken(`${r.reporterUid || 'link:' + r.ownerUid}|${r.path}`).slice(0, 40);
  await db.doc(`reports/${id}`).set({ ...r, reason: REASONS.includes(r.reason) ? r.reason : 'other', note: M.clipText(r.note, 500) || null, status: 'open', createdAt: now }, { merge: true });
  return json(200, { ok: true, reportId: id });
};
const managerChatMsg = async (db, ownerUid, messageId) => {
  messageId = String(messageId || ''); if (!/^[A-Za-z0-9_-]{1,128}$/.test(messageId)) throw err(404, 'Message not found');
  const path = `users/${ownerUid}/managerChat/${messageId}`; const m = await db.doc(path).get();
  if (!m.exists) throw err(404, 'Message not found');
  return { path, msg: m.data() };
};
const connRef = (db, ownerUid, managerUid) => db.doc(`managerConnections/${ownerUid}_${managerUid}`);
const resolveConn = async (db, ownerUid, managerUid) => {
  ownerUid = String(ownerUid || ''); if (!/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid)) throw err(404, 'Not connected');
  const ref = connRef(db, ownerUid, managerUid); const c = await ref.get();
  if (!c.exists) throw err(404, 'Not connected');
  return { ref, conn: c.data(), ownerUid };
};
const managerWrite = async (db, deps, now, uid, mref, managerName, action, body, managerUid = null) => {
  if (action !== 'nudge' && action !== 'dm') throw err(400, 'Bad action');
  await bumpWrites(db, mref, now);
  const mName = managerName || 'Your manager';
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
  const ref = await db.collection(`users/${uid}/managerChat`).add({ ...doc, ...(managerUid ? { managerUid } : {}), createdAt: now, read: false });
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
      const m = await mref.get();
      if (!m.exists) { const c = await db.collection('managerConnections').where('ownerUid', '==', uid).limit(1).get(); if (c.empty) throw err(409, 'No manager'); }
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
      if (await isBlocked(db, uid, other)) throw err(403, "You can't connect with this person");
      const id = M.pairId(uid, other);
      await db.doc(`pals/${id}`).set({ members: [uid, other].sort(), names: { [uid]: await ownerName(db, uid), [other]: inv.data().name || '' }, createdAt: now });
      await iref.delete();
      await push(deps, other, 'New pal', `${await ownerName(db, uid)} accepted your pal invite`);
      return json(200, { ok: true, pairId: id, palUid: other });
    }
    case 'connectManager': {
      const { uid: owner, manager } = await resolveToken(db, body.token);
      if (owner === uid) throw err(400, "That's your own link");
      if (await isBlocked(db, owner, uid)) throw err(403, "You can't connect with this person");
      // Name the manager by their own account (a brand-new account has a users doc but often no publicProfiles yet);
      // the owner's link label ("Mom") is only the last fallback, so several managers on one link stay distinguishable.
      const [oName, mName, mUser] = await Promise.all([ownerName(db, owner), ownerName(db, uid), db.doc(`users/${uid}`).get()]);
      const managerName = (mName !== 'Your person' && mName) || M.clipText(mUser.exists && mUser.data().name, 60) || manager.name || 'Manager';
      await connRef(db, owner, uid).set({ ownerUid: owner, managerUid: uid, ownerName: oName, managerName, createdAt: now, writes: { hour: 0, n: 0 } }, { merge: true });
      await push(deps, owner, 'Manager connected', `${managerName} is now connected as your manager`);
      return json(200, { ok: true, ownerUid: owner, ownerName: oName });
    }
    case 'managerView': {
      const { ownerUid, conn, ref } = await resolveConn(db, body.ownerUid, uid);
      await ref.set({ managerSeenAt: now }, { merge: true }); // clears this person's unread badge in Manager mode
      return viewPayload(db, ownerUid, conn.managerName, now);
    }
    case 'managerList': {
      // Manager mode home: everyone I manage with overdue + unread counts, overdue first.
      const q = await db.collection('managerConnections').where('managerUid', '==', uid).get();
      const people = await Promise.all(q.docs.map(async (d) => {
        const c = d.data(); const [tasks, chat] = await Promise.all([loadTasks(db, c.ownerUid, now), loadChat(db, c.ownerUid)]);
        const seen = M.tsMs(c.managerSeenAt);
        return { ownerUid: c.ownerUid, ownerName: c.ownerName || 'Your person', overdue: tasks.filter((t) => t.overdue).length, open: tasks.filter((t) => !t.completed).length,
          unread: chat.filter((m) => m.from === 'user' && m.at > seen).length };
      }));
      people.sort((a, b) => (b.overdue > 0) - (a.overdue > 0) || b.overdue - a.overdue || b.unread - a.unread || a.ownerName.localeCompare(b.ownerName));
      return json(200, { people });
    }
    case 'palTasks': {
      // Pals read each other's tasks only through here (admin SDK), so private tasks are stripped server-side.
      const other = String(body.palUid || ''); if (!other || other === uid) throw err(400, 'palUid required');
      const p = await db.doc(`pals/${M.pairId(uid, other)}`).get();
      if (!p.exists || !(p.data().members || []).includes(uid)) throw err(403, 'Not a pal');
      return json(200, { tasks: await loadTasks(db, other, now) });
    }
    case 'managerAct': {
      const { ownerUid, conn, ref } = await resolveConn(db, body.ownerUid, uid);
      return managerWrite(db, deps, now, ownerUid, ref, conn.managerName, body.act, body, uid);
    }
    case 'disconnectManager': {
      const ref = body.managerUid ? connRef(db, uid, String(body.managerUid)) : connRef(db, String(body.ownerUid || ''), uid);
      const c = await ref.get(); if (!c.exists) throw err(404, 'Not connected');
      await ref.delete();
      return json(200, { ok: true });
    }
    case 'removePal': {
      const other = String(body.palUid || ''); if (!other) throw err(400, 'palUid required');
      const pref = db.doc(`pals/${M.pairId(uid, other)}`); const p = await pref.get();
      if (!p.exists || !(p.data().members || []).includes(uid)) throw err(404, 'Not a pal');
      const msgs = await pref.collection('messages').limit(450).get();
      const batch = db.batch(); msgs.docs.forEach((d) => batch.delete(d.ref)); batch.delete(pref); await batch.commit();
      return json(200, { ok: true });
    }
    case 'report': {
      const scope = body.scope === 'pal' ? 'pal' : 'manager';
      if (scope === 'pal') {
        const other = String(body.palUid || ''); const pid = M.pairId(uid, other);
        const p = await db.doc(`pals/${pid}`).get(); if (!p.exists || !(p.data().members || []).includes(uid)) throw err(404, 'Not a pal');
        const mid = String(body.messageId || ''); if (!/^[A-Za-z0-9_-]{1,128}$/.test(mid)) throw err(404, 'Message not found');
        const path = `pals/${pid}/messages/${mid}`; const m = await db.doc(path).get();
        if (!m.exists) throw err(404, 'Message not found'); if (m.data().from !== other) throw err(400, 'You can only report messages you received');
        return fileReport(db, now, { reporterUid: uid, reporterKind: 'pal', scope, path, messageId: mid, text: m.data().text || '', authorUid: other, reason: body.reason, note: body.note });
      }
      if (body.ownerUid && body.ownerUid !== uid) { // a signed-in manager reports the person's message
        const { ownerUid } = await resolveConn(db, body.ownerUid, uid);
        const { path, msg } = await managerChatMsg(db, ownerUid, body.messageId);
        if (msg.from !== 'user') throw err(400, 'You can only report messages you received');
        return fileReport(db, now, { reporterUid: uid, reporterKind: 'manager', scope, ownerUid, path, messageId: body.messageId, text: msg.text || '', authorUid: ownerUid, reason: body.reason, note: body.note });
      }
      const { path, msg } = await managerChatMsg(db, uid, body.messageId); // the person reports a manager's nudge/message
      if (msg.from !== 'manager') throw err(400, 'You can only report messages you received');
      return fileReport(db, now, { reporterUid: uid, reporterKind: 'owner', scope, ownerUid: uid, path, messageId: body.messageId, text: msg.text || '', authorUid: msg.managerUid || null, authorKind: msg.managerUid ? 'account' : 'link', reason: body.reason, note: body.note });
    }
    case 'block': {
      let blocked;
      if (body.palUid) {
        blocked = String(body.palUid); if (!/^[A-Za-z0-9_-]{1,128}$/.test(blocked) || blocked === uid) throw err(400, 'Bad user');
        const pref = db.doc(`pals/${M.pairId(uid, blocked)}`); const p = await pref.get();
        if (p.exists && (p.data().members || []).includes(uid)) {
          const msgs = await pref.collection('messages').limit(450).get();
          const batch = db.batch(); msgs.docs.forEach((d) => batch.delete(d.ref)); batch.delete(pref); await batch.commit();
        }
      } else if (body.managerUid) { // the person blocks a connected manager: disconnect + turn off the shared link they used
        blocked = String(body.managerUid); if (!/^[A-Za-z0-9_-]{1,128}$/.test(blocked) || blocked === uid) throw err(400, 'Bad user');
        await connRef(db, uid, blocked).delete();
        const old = await mref.get();
        if (old.exists) { if (old.data().tokenHash) await db.doc(`managerLinks/${old.data().tokenHash}`).delete().catch(() => {}); await mref.delete(); }
      } else if (body.ownerUid) { // a manager blocks the person they managed
        blocked = String(body.ownerUid); if (!/^[A-Za-z0-9_-]{1,128}$/.test(blocked) || blocked === uid) throw err(400, 'Bad user');
        await connRef(db, blocked, uid).delete();
      } else throw err(400, 'Who to block?');
      await blockRef(db, uid, blocked).set({ blockerUid: uid, blockedUid: blocked, createdAt: now });
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
