// node scripts/test-widget-complete-fn.js — widget-complete function with injected verify/db (no network, no Firebase).
const assert = require('assert');
const { rawHandler, widgetTaskId } = require('../netlify/functions/widget-complete.js')._internal;
const sr = require('./lib/srcRequire');
const snap = sr.load('utils/widgetSnapshot.js');

const makeDb = (docs) => ({
  writes: 0,
  doc(path) { return { path }; },
  async runTransaction(fn) {
    const db = this;
    return fn({ get: async (ref) => ({ exists: ref.path in docs, data: () => docs[ref.path] }), update: (ref, v) => { db.writes++; docs[ref.path] = { ...docs[ref.path], ...v }; } });
  },
});
const verify = async (t) => { if (t === 'tokA') return { uid: 'A' }; if (t === 'tokB') return { uid: 'B' }; throw new Error('bad'); };
const ev = (body, tok) => ({ httpMethod: 'POST', headers: tok ? { authorization: `Bearer ${tok}` } : {}, body: JSON.stringify(body) });

(async () => {
  for (const t of [{ id: 'abc_1' }, { createdAt: '2026-10-24T10:00:00Z', title: 'ZZTEST write' }, { createdAt: 5, title: 'é ü' }, {}]) assert.strictEqual(widgetTaskId(t), snap.widgetTaskId(t));
  const task = { createdAt: '2026-10-24T10:00:00Z', title: 'ZZTEST write', points: 15 };
  const id = widgetTaskId(task);
  const docs = { 'weeklyRoutines/A_Sat': { tasks: [{ title: 'other', createdAt: 'x' }, task] } };
  const db = makeDb(docs); const deps = { verify, db, now: () => Date.parse('2026-10-24T12:00:00Z') };
  let r = await rawHandler(ev({ taskId: id, day: 'Sat', done: true }), {}, deps);
  assert.strictEqual(r.statusCode, 401);
  r = await rawHandler(ev({ taskId: id, day: 'Sat', done: true }, 'nope'), {}, deps);
  assert.strictEqual(r.statusCode, 401);
  r = await rawHandler(ev({ taskId: id, day: 'Sat', done: true }, 'tokB'), {}, deps); // wrong owner
  assert.strictEqual(r.statusCode, 404);
  r = await rawHandler(ev({ taskId: id, day: 'Funday', done: true }, 'tokA'), {}, deps); assert.strictEqual(r.statusCode, 400);
  r = await rawHandler(ev({ taskId: id, day: 'Sat', done: false }, 'tokA'), {}, deps); assert.strictEqual(r.statusCode, 400);
  r = await rawHandler(ev({ taskId: 'a/b', day: 'Sat', done: true }, 'tokA'), {}, deps); assert.strictEqual(r.statusCode, 400);
  r = await rawHandler({ httpMethod: 'GET', headers: {} }, {}, deps); assert.strictEqual(r.statusCode, 405);
  r = await rawHandler(ev({ taskId: id, day: 'Sat', done: true }, 'tokA'), {}, deps);
  assert.strictEqual(r.statusCode, 200); assert.strictEqual(JSON.parse(r.body).already, false);
  const t = docs['weeklyRoutines/A_Sat'].tasks[1];
  assert.deepStrictEqual([t.completed, t.timerActive, t.completedVia, t.widgetEffectsPending, t.completedAt, t.points], [true, false, 'widget', true, '2026-10-24T12:00:00.000Z', 15]);
  assert.strictEqual(docs['weeklyRoutines/A_Sat'].tasks[0].completed, undefined);
  r = await rawHandler(ev({ taskId: id, day: 'Sat', done: true }, 'tokA'), {}, deps); // idempotent
  assert.strictEqual(r.statusCode, 200); assert.strictEqual(JSON.parse(r.body).already, true); assert.strictEqual(db.writes, 1);
  console.log('widget-complete fn: all tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
