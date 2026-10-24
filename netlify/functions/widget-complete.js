// POST /.netlify/functions/widget-complete   Authorization: Bearer <Firebase ID token>   Body: { taskId, day, done: true }
//
// Instant sync for the iOS 17 interactive widget (CompleteTaskIntent). The widget stores the tap in the App Group queue first, then calls this
// when online so the manager/boss view sees the completion right away. Ownership is structural: the uid comes ONLY from the verified token and
// the doc is weeklyRoutines/{uid}_{day}, so another user's task is simply "not found" (404). Writes exactly the fields HomeView's
// toggleTaskCompletion writes on the task (completed, completedAt, timerActive=false, timerStoppedAt) plus completedVia='widget' and
// widgetEffectsPending=true. Points, streak, boss sounds/notifications, the daily report and one-time-task removal depend on in-app state
// (discipline gate, 8-hour lock, credits), so the app runs its own completion path for that task once on next open (widgetQueue 'effects').
// Idempotent: an already-completed task returns 200 { already: true } and is not touched.
const { verifyUser } = require('./lib/notify');
const { getAdmin } = require('./lib/firebaseAdmin');
const { withCors } = require('./lib/cors');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const fail = (status, error) => Object.assign(new Error(error), { status });

// Must match src/utils/widgetSnapshot.js widgetTaskId (parity is unit-tested).
const widgetTaskId = (t) => {
  if (t && typeof t.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(t.id)) return t.id;
  const s = `${t?.createdAt || ''}|${t?.title || ''}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'k' + h.toString(36);
};

const rawHandler = async (event, _ctx, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const uid = await verifyUser(event.headers, deps.verify || ((t) => getAdmin().auth().verifyIdToken(t)));
    let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
    const { taskId, day, done } = body || {};
    if (typeof taskId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(taskId)) return json(400, { error: 'Bad taskId' });
    if (!DAYS.includes(day)) return json(400, { error: 'Bad day' });
    if (done !== true) return json(400, { error: 'Only completion is supported' });
    const db = deps.db || getAdmin().firestore();
    const nowIso = new Date(deps.now ? deps.now() : Date.now()).toISOString();
    const ref = db.doc(`weeklyRoutines/${uid}_${day}`);
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const tasks = snap.exists ? (snap.data().tasks || []) : [];
      const i = tasks.findIndex((t) => t && widgetTaskId(t) === taskId);
      if (i < 0) throw fail(404, 'Task not found');
      if (tasks[i].completed === true) return { ok: true, already: true };
      const next = tasks.slice();
      next[i] = { ...tasks[i], completed: true, completedAt: nowIso, timerActive: false, timerStoppedAt: nowIso, completedVia: 'widget', widgetEffectsPending: true };
      tx.update(ref, { tasks: next });
      return { ok: true, already: false, completedAt: nowIso };
    });
    return json(200, out);
  } catch (e) {
    return json(e.status || 500, { error: e.status ? e.message : 'Server error' });
  }
};

exports.handler = withCors(rawHandler);
exports._internal = { rawHandler, widgetTaskId };
