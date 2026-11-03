// Focus sessions (1 or 2 per day): the afternoon session starts from the shutdown via action nextSession; no midday/third slot.
const assert = require('assert');
const { handler, _internal } = require('../netlify/functions/eight-hour-day');
const core = require('../netlify/functions/lib/eightHourCore');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; }; const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };
const TZ = 'America/New_York'; const at = (iso) => Date.parse(iso); const H = 3600000;
class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
const plain = (o) => o && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;
const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = plain(b[k]) && plain(o[k]) ? merge(o[k], b[k]) : b[k]; return o; };
const mkDb = (seed0 = {}) => { const store = { 'users/u1': { isPro: true, lockInEnabled: true }, ...seed0 };
  const ref = (path) => ({ path, get: async () => ({ exists: path in store, data: () => store[path] }), set: async (d, opt) => { store[path] = opt && opt.merge && store[path] ? merge(store[path], d) : d; } });
  return { store, doc: ref, runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o) }) };
};
const verify = async () => ({ uid: 'u1' });
let clock = 0;
const call = async (db, body) => { const r = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer x' }, body: JSON.stringify(body) }, {}, { verify, db, now: () => clock, ts: (ms) => new Ts(ms), serverTime: () => new Ts(clock), apiKey: undefined }); return { code: r.statusCode, body: JSON.parse(r.body) }; };
const T = (title, extra = {}) => ({ title, completed: false, createdAt: `c-${title}`, type: 'recurring', ...extra });
const tasks = () => ({ tasks: [T('Write report'), T('Gym'), T('Email'), T('Read'), T('Plan week')] });
const lockOf = (db) => db.store['eightHour/u1'].lock;

(async () => {
  eq(core.MAX_BLOCKS_PER_DAY, 2, 'evening-mode blocks per request (unchanged)');
  // Start anytime: no clock gate, no hard close, no session cap. Only a running / scheduled session blocks a new one.
  const L = { dayKey: '2026-10-23', wakeTime: '07:00', tz: TZ, startMs: at('2026-10-23T13:00:00Z'), endMs: at('2026-10-23T15:00:00Z'), hours: 2, index: 0, session: { done: 8 } }; // 8+ tasks: no cooldown
  const gp = { dayStart: '09:00', closeHours: 8 };
  eq(core.sessionCloseMs(L, gp), L.endMs, 'no fixed hard close: the session itself is the window');
  eq(core.nextDayStartMs(L, gp), 0, 'no next-day start time');
  eq(core.nextSessionState({ lock: L, sessions: 2, gamePlan: gp, nowMs: at('2026-10-23T14:00:00Z') }).reason, 'running');
  for (const iso of ['2026-10-23T16:00:00Z', '2026-10-23T23:00:00Z', '2026-10-24T10:40:00Z']) eq(core.nextSessionState({ lock: L, sessions: 2, gamePlan: gp, nowMs: at(iso) }).ok, true, iso);
  eq(core.nextSessionState({ lock: { ...L, session: { done: 3 } }, sessions: 2, gamePlan: gp, nowMs: at('2026-10-23T16:00:00Z') }).reason, 'cooldown', '3 of 8 tasks: 2h wait');
  eq(core.nextSessionState({ lock: L, sessions: 1, gamePlan: gp, nowMs: at('2026-10-23T16:00:00Z') }).ok, true, 'sessions = 1 does not cap');
  eq(core.nextSessionState({ lock: { ...L, index: 5 }, sessions: 2, gamePlan: gp, nowMs: at('2026-10-23T16:00:00Z') }).ok, true, 'no session cap');

  const db = mkDb({ 'weeklyRoutines/u1_Fri': tasks() }); db.store['users/u1'].gamePlan = { dayStart: '09:00', closeHours: 8, sessions: 2 };
  clock = at('2026-10-23T12:00:00Z'); await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 5, tz: TZ });
  clock = at('2026-10-23T13:00:00Z'); let r = await call(db, { action: 'start', hours: 5 });
  eq([r.code, r.body.lock.index], [200, 0]);
  eq((await call(db, { action: 'nextSession' })).body.code, 'running', 'not while session 1 runs');
  db.store['weeklyRoutines/u1_Fri'].tasks[0].completed = true; db.store['weeklyRoutines/u1_Fri'].updatedAt = new Ts(at('2026-10-23T14:00:00Z'));
  clock = at('2026-10-23T18:00:00Z');
  r = await call(db, { action: 'state' });
  ok(core.isShut(r.body.lock, clock), 'session end shows the shutdown screen');
  eq(r.body.session.canStart, false, '1 of 8 tasks: next session waits'); eq((await call(db, { action: 'nextSession', hours: 8 })).body.code, 'cooldown', 'server rejects Start during the wait');
  clock = at('2026-10-23T20:00:00Z'); r = await call(db, { action: 'state' }); eq(r.body.session.canStart, true, 'shutdown offers Start new session once the 2h wait ends');
  r = await call(db, { action: 'nextSession', hours: 5 });
  eq([r.code, r.body.phase, r.body.lock.index, r.body.lock.startMs, r.body.lock.endMs], [200, 'running', 1, clock, at('2026-10-24T01:00:00Z')], 'next session runs now for its hours');
  eq(r.body.lock.taskCount, 4, 'only open tasks are locked; the done one stays done');
  ok(db.store['weeklyRoutines/u1_Fri'].tasks[0].completed === true, 'completion kept');
  ok(db.store['eightHour/u1'].sessions['2026-10-23#0'], 'session 1 archived');
  eq(lockOf(db).endAt.ms, at('2026-10-24T01:00:00Z'), 'rules see the new block end');
  clock = at('2026-10-24T03:30:00Z'); r = await call(db, { action: 'state' });
  ok(core.isShut(r.body.lock, clock) && r.body.session.canStart === true, 'after session 2: Start new session again');
  eq(lockOf(db).shutUntil.ms, lockOf(db).endAt.ms, 'rules shutUntil = session end (day doc writable between sessions)');
  r = await call(db, { action: 'nextSession', hours: 5 }); eq([r.code, r.body.lock.index], [200, 2], 'a third session is allowed');

  // Overnight: a late session runs its full length (no cut at a wake / day-start time); the next day starts fresh at index 0.
  const sat = () => ({ tasks: [T('Sat A'), T('Sat B'), T('Sat C'), T('Sat D'), T('Sat E')] });
  const db2 = mkDb({ 'weeklyRoutines/u1_Fri': tasks(), 'weeklyRoutines/u1_Sat': sat() }); db2.store['users/u1'].gamePlan = { dayStart: '07:00', closeHours: 8, sessions: 2 };
  clock = at('2026-10-23T10:00:00Z'); await call(db2, { action: 'plan', wakeTime: '07:00', taskCount: 5, tz: TZ });
  clock = at('2026-10-23T11:00:00Z'); r = await call(db2, { action: 'start', hours: 5 });
  clock = at('2026-10-24T01:00:00Z');
  r = await call(db2, { action: 'state' }); eq(r.body.session.canStart, true);
  r = await call(db2, { action: 'nextSession', hours: 12 });
  eq([r.code, r.body.lock.index, r.body.lock.endMs], [200, 1, at('2026-10-24T13:00:00Z')], 'runs its full 12h overnight');
  db2.store['weeklyRoutines/u1_Fri'].tasks[1].completed = true; db2.store['weeklyRoutines/u1_Fri'].updatedAt = new Ts(at('2026-10-24T02:00:00Z'));
  clock = at('2026-10-24T11:00:00Z'); r = await call(db2, { action: 'state' }); eq([r.body.phase, r.body.lock.index], ['running', 1], 'still running at 7 AM (no wake cut)');
  clock = at('2026-10-24T13:00:00Z'); r = await call(db2, { action: 'state' });
  const hist = Object.keys(db2.store).filter((k) => k.startsWith('eightHour/u1/history/')).map((k) => db2.store[k]).find((h) => h.dayKey === '2026-10-23' && h.index === 1);
  ok(hist && hist.earned > 0, 'overnight session settled with its points credited');
  eq([r.body.phase, r.body.lock.settled], ['ready', true]);
  r = await call(db2, { action: 'start', hours: 5 }); eq(r.body.code, 'cooldown', 'the 2h wait applies to any session, across midnight too');
  clock += core.SESSION_COOLDOWN_MS; r = await call(db2, { action: 'start', hours: 5 });
  eq([r.body.lock.dayKey, r.body.lock.index, r.body.lock.startMs], ['2026-10-24', 0, clock], 'new day starts now as session 0');
  console.log(`focus sessions: ${pass} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
