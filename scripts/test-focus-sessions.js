// Focus sessions (1 or 2 per day): the afternoon session starts from the shutdown via action nextSession; no midday/third slot.
const assert = require('assert');
const { handler, _internal } = require('../netlify/functions/eight-hour-day');
const core = require('../netlify/functions/lib/eightHourCore');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; }; const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };
const TZ = 'America/New_York'; const at = (iso) => Date.parse(iso); const H = 3600000;
class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
const plain = (o) => o && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;
const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = plain(b[k]) && plain(o[k]) ? merge(o[k], b[k]) : b[k]; return o; };
const mkDb = (seed0 = {}) => { const store = { 'users/u1': { lockInEnabled: true }, ...seed0 };
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
  eq(core.MAX_BLOCKS_PER_DAY, 2, 'morning + afternoon only');
  const L = { dayKey: '2026-10-23', wakeTime: '07:00', tz: TZ, startMs: at('2026-10-23T13:00:00Z'), endMs: at('2026-10-23T15:00:00Z'), hours: 2, index: 0 };
  const gp = { dayStart: '09:00', closeHours: 8 }; // close 17:00 EDT = 21:00Z
  eq(core.sessionCloseMs(L, gp), at('2026-10-23T21:00:00Z'));
  eq(core.nextSessionState({ lock: L, sessions: 2, gamePlan: gp, nowMs: at('2026-10-23T14:00:00Z') }).reason, 'running');
  eq(core.nextSessionState({ lock: L, sessions: 2, gamePlan: gp, nowMs: at('2026-10-23T16:00:00Z') }).ok, true);
  eq(core.nextSessionState({ lock: L, sessions: 1, gamePlan: gp, nowMs: at('2026-10-23T16:00:00Z') }).reason, 'done', 'sessions = 1: the day is done');
  eq(core.nextSessionState({ lock: { ...L, index: 1 }, sessions: 2, gamePlan: gp, nowMs: at('2026-10-23T16:00:00Z') }).reason, 'done', 'after session 2 nothing more');
  // The evening (second) session is not bound to the hard close: it can start or keep running until the NEXT day start (wake).
  eq(core.nextDayStartMs(L, gp), at('2026-10-24T11:00:00Z'), 'next day start = earlier of tomorrow wake 07:00 and day start 09:00');
  eq(core.nextSessionState({ lock: L, sessions: 2, gamePlan: gp, nowMs: at('2026-10-23T23:00:00Z') }).ok, true, 'after the hard close session 2 can still start');
  eq(core.nextSessionState({ lock: L, sessions: 2, gamePlan: gp, nowMs: at('2026-10-24T10:40:00Z') }).reason, 'closed', 'under 30 min to the next day start');

  const db = mkDb({ 'weeklyRoutines/u1_Fri': tasks() }); db.store['users/u1'].gamePlan = { dayStart: '09:00', closeHours: 8, sessions: 2 };
  clock = at('2026-10-23T12:00:00Z'); await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 5, tz: TZ });
  clock = at('2026-10-23T13:00:00Z'); let r = await call(db, { action: 'start', hours: 2 });
  eq([r.code, r.body.lock.index], [200, 0]);
  eq((await call(db, { action: 'nextSession' })).body.code, 'running', 'not while session 1 runs');
  db.store['weeklyRoutines/u1_Fri'].tasks[0].completed = true; db.store['weeklyRoutines/u1_Fri'].updatedAt = new Ts(at('2026-10-23T14:00:00Z'));
  clock = at('2026-10-23T16:00:00Z'); // noon EDT: session 1 ended -> shutdown
  r = await call(db, { action: 'state' });
  ok(core.isShut(r.body.lock, clock), 'session 1 end shuts the app (unchanged)');
  eq([r.body.session.canStart, r.body.session.done, r.body.session.of], [true, 1, 2], 'shutdown offers session 2');
  r = await call(db, { action: 'nextSession', hours: 8 });
  eq([r.code, r.body.phase, r.body.lock.index, r.body.lock.endMs], [200, 'running', 1, at('2026-10-24T00:00:00Z')], 'session 2 runs now for its hours (not cut at the hard close)');
  eq(r.body.lock.taskCount, 4, 'only open tasks are locked; the done one stays done');
  ok(db.store['weeklyRoutines/u1_Fri'].tasks[0].completed === true, 'completion kept');
  ok(db.store['eightHour/u1'].sessions['2026-10-23#0'], 'session 1 archived');
  eq(lockOf(db).endAt.ms, at('2026-10-24T00:00:00Z'), 'rules see the new block end');
  eq((await call(db, { action: 'nextSession' })).code, 409, 'no third session');
  clock = at('2026-10-24T00:30:00Z'); r = await call(db, { action: 'state' });
  ok(core.isShut(r.body.lock, clock) && r.body.session.canStart === false && r.body.session.done === 2, 'after session 2: shut, 2 of 2, nothing more');
  eq((await call(db, { action: 'nextSession' })).body.code, 'done');

  // Wake-up rollover: session 2 started after the hard close runs until the next day start, settles (points credited), the new
  // day's morning block begins at/after it (no overlap), and the native lock end is that next day start.
  const sat = () => ({ tasks: [T('Sat A'), T('Sat B'), T('Sat C'), T('Sat D'), T('Sat E')] });
  const db2 = mkDb({ 'weeklyRoutines/u1_Fri': tasks(), 'weeklyRoutines/u1_Sat': sat() }); db2.store['users/u1'].gamePlan = { dayStart: '07:00', closeHours: 8, sessions: 2 };
  clock = at('2026-10-23T10:00:00Z'); await call(db2, { action: 'plan', wakeTime: '07:00', taskCount: 5, tz: TZ });
  clock = at('2026-10-23T11:00:00Z'); r = await call(db2, { action: 'start', hours: 3 });
  clock = at('2026-10-24T01:00:00Z'); // 9 PM EDT: past the 3 PM hard close, session 2 not done yet
  r = await call(db2, { action: 'state' }); eq(r.body.session.canStart, true, 'unfinished evening session can still start after the close');
  r = await call(db2, { action: 'nextSession', hours: 12 });
  eq([r.code, r.body.lock.index, r.body.lock.endMs], [200, 1, at('2026-10-24T11:00:00Z')], 'runs overnight, ends exactly at the next day start (7 AM)');
  eq(lockOf(db2).endAt.ms, at('2026-10-24T11:00:00Z'), 'rules + native lock end = next day start');
  db2.store['weeklyRoutines/u1_Fri'].tasks[1].completed = true; db2.store['weeklyRoutines/u1_Fri'].updatedAt = new Ts(at('2026-10-24T02:00:00Z'));
  clock = at('2026-10-24T06:00:00Z'); r = await call(db2, { action: 'state' }); eq([r.body.phase, r.body.lock.index], ['running', 1], 'still running at 2 AM (no midnight cut)');
  clock = at('2026-10-24T11:00:00Z'); r = await call(db2, { action: 'state' });
  const hist = Object.keys(db2.store).filter((k) => k.startsWith('eightHour/u1/history/')).map((k) => db2.store[k]).find((h) => h.dayKey === '2026-10-23' && h.index === 1);
  ok(hist && hist.earned > 0, 'evening session settled with its points credited');
  eq([r.body.phase, r.body.lock.settled], ['ready', true], 'at wake the evening session is over and the new day is ready');
  r = await call(db2, { action: 'start', hours: 3 });
  eq([r.body.lock.dayKey, r.body.lock.index], ['2026-10-24', 0], 'new day starts normally with its morning block');
  ok(r.body.lock.startMs >= at('2026-10-24T11:00:00Z'), 'no morning block overlapping the evening session');

  const db1 = mkDb({ 'weeklyRoutines/u1_Fri': tasks() }); db1.store['users/u1'].gamePlan = { dayStart: '09:00', sessions: 1 };
  clock = at('2026-10-23T12:00:00Z'); await call(db1, { action: 'plan', wakeTime: '07:00', taskCount: 5, tz: TZ });
  clock = at('2026-10-23T13:00:00Z'); await call(db1, { action: 'start', hours: 2 });
  clock = at('2026-10-23T16:00:00Z'); r = await call(db1, { action: 'state' });
  eq(r.body.session.canStart, false, 'sessions = 1: no session 2'); eq((await call(db1, { action: 'nextSession' })).body.code, 'done');
  console.log(`focus sessions: ${pass} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
