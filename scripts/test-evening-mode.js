// Evening mode (scheduled + split lock-in blocks): core helpers and netlify/functions/eight-hour-day.js with an in-memory Firestore.
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
  // ── core ──
  eq(core.sessionKey('2026-10-23', 2), '2026-10-23#2'); eq(core.blockIndex({}), 0, 'old single-lock docs are block 0'); eq(core.blockIndex({ index: 1 }), 1);
  eq([core.clampBlockHours(0.2), core.clampBlockHours(3.3), core.clampBlockHours(20), core.clampBlockHours('x')], [1, 3.5, 12, null]);
  const now0 = at('2026-10-23T21:00:00Z'); // 5 PM EDT
  eq(core.nextAt('18:00', TZ, now0), at('2026-10-23T22:00:00Z')); eq(core.nextAt('16:00', TZ, now0), at('2026-10-24T20:00:00Z'), 'a passed time = tomorrow');
  let pb = core.planBlocks({ requests: [{ time: '18:00', hours: 3 }], tz: TZ, nowMs: now0, existing: [{ startMs: at('2026-10-23T11:00:00Z'), endMs: at('2026-10-23T21:00:00Z'), dayKey: '2026-10-23', index: 0 }] });
  eq([pb.ok, pb.blocks[0].index, pb.blocks[0].dayKey, pb.blocks[0].endMs - pb.blocks[0].startMs], [true, 1, '2026-10-23', 3 * H]);
  eq(core.planBlocks({ requests: [{ time: '17:03', hours: 1 }], tz: TZ, nowMs: now0 }).ok, false, '17:03 tomorrow is past the 18h horizon');
  eq(core.planBlocks({ requests: [{ time: '18:00', hours: 3 }, { time: '20:00', hours: 1 }], tz: TZ, nowMs: now0 }).error, 'That overlaps another lock-in block.');
  eq(core.planBlocks({ requests: [{ time: '18:00', hours: 1 }, { time: '19:00', hours: 1 }, { time: '20:00', hours: 1 }, { time: '21:00', hours: 1 }], tz: TZ, nowMs: now0 }).error, 'At most 3 lock-in blocks per day.');
  const L0 = { dayKey: '2026-10-23', wakeTime: '07:00', tz: TZ, startMs: at('2026-10-23T11:00:00Z'), endMs: at('2026-10-23T21:00:00Z'), hours: 10 };
  const Lp = { ...L0, pending: [{ dayKey: '2026-10-23', index: 1, startMs: at('2026-10-23T23:00:00Z'), endMs: at('2026-10-24T02:00:00Z'), hours: 3 }] };
  eq(core.isShut(L0, now0 + 1000), true, 'single lock: shut after the end (unchanged)');
  eq(core.isShut(Lp, now0 + 1000), false, 'a pending block keeps the gap open');
  eq(core.isShut(Lp, at('2026-10-24T02:00:01Z')), true, 'shut after the last block');
  eq(core.rulesShutUntilMs(Lp), Lp.endMs, 'rules see no hard stop while a block is pending'); eq(core.rulesShutUntilMs(L0), core.shutUntilMs(L0));
  let ph = core.evaluatePhase({ wakeTime: '07:00', tz: TZ, nowMs: now0 + 1000, lock: Lp }); eq([ph.phase, ph.nextStartMs], ['gap', Lp.pending[0].startMs]);
  ph = core.evaluatePhase({ wakeTime: '07:00', tz: TZ, nowMs: Lp.pending[0].startMs + 60000, lock: Lp }); eq([ph.phase, ph.scheduled, ph.index, ph.startMs], ['ready', true, 1, Lp.pending[0].startMs]);
  // phaseOf now passes hours (bug fix): the 'ready' window uses the frozen/default day length, not a hard-coded 8h
  const ready = _internal.phaseOf({ plan: { wakeTime: '07:00', tz: TZ }, dayLengthHours: 4 }, at('2026-10-23T12:00:00Z'));
  eq([ready.phase, ready.endMs - ready.startMs], ['ready', 4 * H]);
  eq(_internal.phaseOf({ plan: { wakeTime: '07:00', tz: TZ }, lock: { hours: 6, dayKey: '2026-10-22', startMs: 1, endMs: 2 } }, at('2026-10-23T12:00:00Z')).endMs - at('2026-10-23T12:00:00Z'), 6 * H);

  // ── option 2: split a day (7 AM-5 PM + 7-10 PM) ──
  let db = mkDb({ 'weeklyRoutines/u1_Fri': tasks() });
  clock = at('2026-10-23T10:00:00Z'); await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 5, tz: TZ });
  clock = at('2026-10-23T11:00:00Z');
  eq((await call(db, { action: 'start', hours: 10, blocks: [{ time: '15:00', hours: 3 }] })).body.code, 'bad-blocks', 'a split block cannot overlap the main block');
  eq((await call(db, { action: 'start', hours: 10, blocks: [{ time: '06:00', hours: 3 }] })).code, 400, 'split blocks are today only');
  let r = await call(db, { action: 'start', hours: 10, blocks: [{ time: '19:00', hours: 3 }] });
  eq([r.code, r.body.phase, r.body.lock.index, r.body.lock.pending.length, r.body.lock.pending[0].index], [200, 'running', 0, 1, 1]);
  eq(lockOf(db).shutUntil.ms, at('2026-10-23T21:00:00Z'), 'rules shutUntil = endMs while the evening block is pending');
  eq((await call(db, { action: 'schedule', blocks: [{ time: '16:00', hours: 1 }] })).code, 400, 'no block inside the running one (no shortening by stacking)');
  // complete 2 tasks in the main block
  db.store['weeklyRoutines/u1_Fri'].tasks[0].completed = true; db.store['weeklyRoutines/u1_Fri'].tasks[1].completed = true; db.store['weeklyRoutines/u1_Fri'].updatedAt = new Ts(at('2026-10-23T15:00:00Z'));
  clock = at('2026-10-23T22:00:00Z'); // 6 PM: gap
  r = await call(db, { action: 'state' });
  eq([r.body.phase, r.body.window.nextStartMs, !!r.body.lock], ['gap', at('2026-10-23T23:00:00Z'), true]);
  ok(!core.isShut(r.body.lock, clock), 'app is open in the gap');
  eq(r.body.stats.lastDay, '2026-10-23', 'block 0 settled the streak once');
  const streakAfter0 = r.body.stats.streak;
  // 7:20 PM: the evening block starts by itself at its FIXED start, locking only open tasks and keeping completions
  clock = at('2026-10-23T23:20:00Z');
  r = await call(db, { action: 'state' });
  eq([r.body.phase, r.body.lock.index, r.body.lock.startMs, r.body.lock.endMs, r.body.lock.taskCount, r.body.lock.scheduled], ['running', 1, at('2026-10-23T23:00:00Z'), at('2026-10-24T02:00:00Z'), 3, true]);
  eq(db.store['weeklyRoutines/u1_Fri'].tasks.filter((t) => t.completed).length, 2, 'completions kept');
  ok(db.store['eightHour/u1'].sessions['2026-10-23#0'], 'block 0 archived under day#index');
  eq(lockOf(db).shutUntil.ms, core.shutUntilMs(lockOf(db)), 'last block: normal hard stop to the next wake');
  eq((await call(db, { action: 'start', hours: 3 })).body.phase, 'running', 'no restart during a block');
  eq((await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 5, tz: TZ })).code, 423, 'plan locked while the evening block runs');
  clock = at('2026-10-24T02:00:05Z');
  r = await call(db, { action: 'state' });
  eq([r.body.stats.streak, r.body.phase], [streakAfter0, 'ended'], 'later blocks never touch the streak');
  ok(core.isShut(r.body.lock, clock), 'shut after the last block');
  ok(db.store['eightHour/u1/history/2026-10-23#1'] && db.store['eightHour/u1/history/2026-10-23#1'].streakCounted === false, 'history-only row for block 1');

  // ── option 1: day over -> schedule the next lock-in ──
  db = mkDb({ 'weeklyRoutines/u1_Sat': tasks(), 'eightHour/u1': { plan: { wakeTime: '07:00', tz: TZ, taskCount: 5 },
    lock: { dayKey: '2026-10-24', dayName: 'Sat', tz: TZ, wakeTime: '07:00', hours: 8, startMs: at('2026-10-24T11:00:00Z'), endMs: at('2026-10-24T19:00:00Z'), indexes: [0], points: [50], totalPoints: 50, target: 45, earned: 50, settled: false, taskCount: 1 }, stats: {} } }); // legacy single-lock doc (no index)
  clock = at('2026-10-24T20:00:00Z'); // 4 PM, shut
  r = await call(db, { action: 'state' }); ok(core.isShut(r.body.lock, clock), 'legacy lock still shuts');
  eq((await call(db, { action: 'schedule', blocks: [{ time: '16:02', hours: 3 }] })).code, 400, 'needs 5 minutes of lead (16:02 rolls to tomorrow, past 18h)');
  eq((await call(db, { action: 'schedule', blocks: [{ time: '08:00', hours: 3 }] })).body.code, 'bad-blocks', 'while shut, a block after the next wake (7 AM) is refused');
  eq((await call(db, { action: 'schedule', blocks: [{ time: '18:00', hours: 3 }] })).code, 200);
  r = await call(db, { action: 'state' });
  eq([r.body.phase, r.body.lock.pending.length, r.body.lock.pending[0].index], ['gap', 1, 1]); ok(!core.isShut(r.body.lock, clock), 'task screens open until 6 PM');
  eq(lockOf(db).shutUntil.ms, lockOf(db).endMs, 'rules shutUntil reopened');
  eq((await call(db, { action: 'schedule', blocks: [{ time: '19:00', hours: 1 }] })).code, 400, 'cannot overlap / shorten a scheduled block');
  eq((await call(db, { action: 'cancel' })).code, 400, 'there is no cancel');
  // started late (first call at 6:45 PM): fixed 6-9 PM
  clock = at('2026-10-24T22:45:00Z');
  r = await call(db, { action: 'progress' });
  eq([r.body.phase, r.body.lock.startMs, r.body.lock.endMs], ['running', at('2026-10-24T22:00:00Z'), at('2026-10-25T01:00:00Z')]);
  eq((await call(db, { action: 'schedule', blocks: [{ time: '20:00', hours: 2 }] })).code, 400, 'no overlap with the running block');

  // block never seen until after its end: archived as missed, hard stop from the last end
  db = mkDb({ 'eightHour/u1': { plan: { wakeTime: '07:00', tz: TZ, taskCount: 5 }, lock: { dayKey: '2026-10-24', dayName: 'Sat', tz: TZ, wakeTime: '07:00', hours: 8, startMs: at('2026-10-24T11:00:00Z'), endMs: at('2026-10-24T19:00:00Z'), points: [], settled: true,
    pending: [{ dayKey: '2026-10-24', index: 1, startMs: at('2026-10-24T22:00:00Z'), endMs: at('2026-10-25T01:00:00Z'), hours: 3 }] } } });
  clock = at('2026-10-25T02:00:00Z'); r = await call(db, { action: 'state' });
  eq(r.body.lock.pending.length, 0); ok(db.store['eightHour/u1/history/2026-10-24#1'].missedStart, 'missed block recorded');
  ok(core.isShut(r.body.lock, clock) && lockOf(db).shutUntil.ms > clock, 'shut until the next wake');

  // fresh user (no lock yet): schedule tonight -> placeholder lock carries the schedule, block 0 of its day
  db = mkDb({ 'weeklyRoutines/u1_Fri': tasks(), 'eightHour/u1': { plan: { wakeTime: '07:00', tz: TZ, taskCount: 5 } } });
  clock = at('2026-10-23T21:00:00Z');
  r = await call(db, { action: 'schedule', blocks: [{ time: '18:00', hours: 2 }] }); eq([r.code, r.body.phase, r.body.lock.pending[0].index], [200, 'gap', 0]);
  clock = at('2026-10-23T22:00:30Z'); r = await call(db, { action: 'state' });
  eq([r.body.phase, r.body.lock.index, r.body.lock.taskCount], ['running', 0, 5]); eq(lockOf(db).placeholder, false);
  // lock-in off: nothing can be scheduled
  db = mkDb({ 'users/u1': {}, 'eightHour/u1': { plan: { wakeTime: '07:00', tz: TZ, taskCount: 5 } } });
  eq((await call(db, { action: 'schedule', blocks: [{ time: '18:00', hours: 2 }] })).code, 403);
  // pill: the gap between blocks reads as "Next <time>", not as shut
  const chrome = require('./lib/srcRequire').load('utils/eightHourChrome.js');
  const pg = chrome.pillState({ phase: 'gap', hasPlan: true, nextLabel: '6:00 PM' });
  eq([pg.kind, pg.main], ['before', 'Next 6:00 PM']);
  // native wiring present: plugin method registered, monitor handles the prefix, JS wrapper exists
  const fs = require('fs'); const rd = (f) => fs.readFileSync(require('path').join(__dirname, '..', f), 'utf8');
  ok(rd('ios/App/App/ClingLockPlugin.swift').includes('CAPPluginMethod(name: "scheduleLock"'));
  ok(rd('ios/App/ClingLockMonitor/ClingLockMonitor.swift').includes('ScheduledLocks.key(of: activity)'));
  ok(rd('src/native/clingNative.js').includes('Lock.scheduleLock('));
  console.log(`evening mode: ${pass} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
