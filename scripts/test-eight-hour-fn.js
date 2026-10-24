// Tests netlify/functions/eight-hour-day.js with an in-memory Firestore, injected clock/token verifier/fetch. No network, no real key.
const assert = require('assert');
const { handler } = require('../netlify/functions/eight-hour-day');
const core = require('../netlify/functions/lib/eightHourCore');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; }; const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };
const TZ = 'America/New_York'; const at = (iso) => Date.parse(iso);

class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
const plain = (o) => o && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;
const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = plain(b[k]) && plain(o[k]) ? merge(o[k], b[k]) : b[k]; return o; };
const mkDb = (seed = {}) => {
  const store = { ...seed };
  const ref = (path) => ({ path, get: async () => ({ exists: path in store, data: () => store[path] }), set: async (d, opt) => { store[path] = opt && opt.merge && store[path] ? merge(store[path], d) : d; } });
  return { store, doc: ref, runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o) }) };
};
const verify = async (t) => { if (t !== 'good') throw new Error('bad'); return { uid: 'u1' }; };
const ev = (body, token = 'good') => ({ httpMethod: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) });
const T = (title, extra = {}) => ({ title, completed: false, createdAt: `2026-10-2${title.length}T00:00:00Z`, type: 'one-time', ...extra });
let clock = at('2026-10-23T10:00:00Z'); // 6:00 AM EDT
const call = async (db, body, extra = {}) => { const r = await handler(ev(body), {}, { verify, db, now: () => clock, ts: (ms) => new Ts(ms), serverTime: () => new Ts(clock), apiKey: undefined, ...extra }); return { code: r.statusCode, body: JSON.parse(r.body) }; };

(async () => {
  ok((await handler({ httpMethod: 'GET', headers: {} }, {}, {})).statusCode === 405, 'GET rejected');
  ok((await handler(ev({ action: 'state' }, null), {}, { verify, db: mkDb() })).statusCode === 401, 'no token');
  ok((await handler(ev({ action: 'state' }, 'bad'), {}, { verify, db: mkDb() })).statusCode === 401, 'bad token');
  eq((await call(mkDb(), { action: 'nope' })).code, 400);

  // fresh user: no plan => phase none; start refused until a plan exists
  let db = mkDb();
  let r = await call(db, { action: 'state' }); eq(r.body.phase, 'none');
  eq((await call(db, { action: 'start' })).code, 409);
  // plan validation
  eq((await call(db, { action: 'plan', wakeTime: '7am', taskCount: 3, tz: TZ })).code, 400);
  eq((await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 51, tz: TZ })).code, 400, 'over the 50/day safety max');
  eq((await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 0, tz: TZ })).code, 400);
  eq((await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 3, tz: 'Mars/Base' })).code, 400);
  r = await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 3, tz: TZ });
  eq([r.code, r.body.phase, r.body.plan.wakeTime, r.body.plan.taskCount], [200, 'before', '07:00', 3]);
  eq(r.body.window.wakeMs, at('2026-10-23T11:00:00Z'));
  // plan stays editable before the countdown
  r = await call(db, { action: 'plan', wakeTime: '06:30', taskCount: 4, tz: TZ }); eq([r.code, r.body.plan.taskCount], [200, 4]);
  eq((await call(db, { action: 'start' })).code, 409, 'cannot start before wake time');

  // wake time arrives; no tasks yet => no-tasks, countdown does not begin
  clock = at('2026-10-23T11:00:00Z');
  r = await call(db, { action: 'start' }); eq([r.code, r.body.code], [409, 'no-tasks']);
  eq((await call(db, { action: 'state' })).body.phase, 'ready');
  // wake time can no longer move once it has passed, count still can
  eq((await call(db, { action: 'plan', wakeTime: '13:00', taskCount: 3, tz: TZ })).code, 423, 'no dodging the start by moving wake time');
  eq((await call(db, { action: 'plan', wakeTime: '06:30', taskCount: 3, tz: TZ })).code, 200);

  // add tasks (client writes the day doc) and start
  clock = at('2026-10-23T11:20:00Z');
  db.store['weeklyRoutines/u1_Fri'] = { tasks: [T('Write the quarterly report', { completed: true, completedAt: '2026-10-22T20:00:00Z' }), T('Reply to Sam'), T('Workout', { estimateMin: 45 }), T('Future thing', { activeFrom: '2026-10-30' })] };
  r = await call(db, { action: 'start' });
  eq([r.code, r.body.phase], [200, 'running']);
  const L = r.body.lock;
  eq([L.startMs, L.endMs, L.taskCount, L.plannedCount, L.estimateSource, L.targetSource], [clock, clock + 8 * 3600e3, 3, 3, 'heuristic', 'heuristic']);
  ok(L.points.length === 3 && L.points.every((p) => p >= 5), 'points per task assigned');
  eq(L.totalPoints, L.points.reduce((a, b) => a + b, 0)); ok(L.target > 0 && L.target <= L.totalPoints, 'target within total');
  const day = db.store['weeklyRoutines/u1_Fri'].tasks;
  eq(day.length, 4, 'day doc keeps its size'); eq(day[0].completed, false, 'stale completion from yesterday reset'); eq(day[0].points, L.points[0]); eq(day[3].points, undefined, 'hidden recurring copy is not part of the day');
  ok(db.store['eightHour/u1'].lock.endAt instanceof Ts && db.store['eightHour/u1'].lock.startAt instanceof Ts, 'timestamps stored for rules');
  const frozen = JSON.stringify(db.store['eightHour/u1'].lock);

  // everything locked: plan edits, a second start, a different wake time all refused / no-ops; values unchanged
  clock += 3600e3;
  r = await call(db, { action: 'plan', wakeTime: '09:00', taskCount: 1, tz: TZ }); eq([r.code, r.body.code], [423, 'locked']);
  r = await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 5, tz: 'Asia/Tokyo' }); eq(r.code, 423);
  r = await call(db, { action: 'start' }); eq([r.code, r.body.lock.startMs], [200, L.startMs], 'start is idempotent and never resets the timer');
  eq(JSON.stringify(db.store['eightHour/u1'].lock), frozen, 'lock doc untouched');
  // device clock cannot matter: the server clock is the only input (client-sent "now"/startMs fields are ignored)
  r = await call(db, { action: 'start', now: 1, startMs: 1, endMs: 2 }); eq(r.body.lock.startMs, L.startMs);

  // progress counts locked tasks completed in the window (server time)
  db.store['weeklyRoutines/u1_Fri'].tasks[1].completed = true;
  r = await call(db, { action: 'progress' }); eq([r.body.lock.earned, r.body.lock.done], [L.points[1], 1]);
  db.store['weeklyRoutines/u1_Fri'].tasks[0].completed = true; db.store['weeklyRoutines/u1_Fri'].tasks[2].completed = true;
  r = await call(db, { action: 'progress' }); eq([r.body.lock.earned, r.body.lock.done], [L.totalPoints, 3]);
  db.store['weeklyRoutines/u1_Fri'].updatedAt = new Ts(clock);

  // a restart mid-window (state from scratch) returns the same window; remaining time derives from the stored start
  clock = L.startMs + 5 * 3600e3;
  r = await call(db, { action: 'state' }); eq([r.body.phase, r.body.window.endMs], ['running', L.endMs]);

  // window ends: settle once (goal met => streak 1), later calls do not re-settle
  clock = L.endMs + 1000;
  r = await call(db, { action: 'state' }); eq([r.body.phase, r.body.stats.streak, r.body.stats.lastResult, r.body.lock.settled], ['ended', 1, 'met', true]);
  eq(db.store[`eightHour/u1/history/2026-10-23`].met, true);
  r = await call(db, { action: 'state' }); eq(r.body.stats.streak, 1, 'settled once');
  eq((await call(db, { action: 'start' })).code, 409, 'no second window the same day');
  // plan opens again once the window is over (applies to tomorrow)
  r = await call(db, { action: 'plan', wakeTime: '06:00', taskCount: 2, tz: TZ }); eq([r.code, r.body.plan.wakeTime], [200, '06:00']);

  // next day, missed goal: one-time bump + notice that stays
  clock = at('2026-10-24T14:00:00Z'); // Sat 10:00 EDT
  db.store['weeklyRoutines/u1_Sat'] = { tasks: [T('Plan the month'), T('Call mom')] };
  r = await call(db, { action: 'start' }); eq(r.body.phase, 'running'); eq(r.body.lock.dayKey, '2026-10-24'); eq(r.body.stats.streak, 1);
  clock = r.body.lock.endMs + 5;
  r = await call(db, { action: 'state' }); eq([r.body.stats.streak, r.body.stats.targetLevel, r.body.stats.bumped, r.body.stats.lastResult], [0, 3, true, 'missed']); ok(/harder/i.test(r.body.stats.notice));
  // 'updatedAt' written after the window must not let late completions count
  db = mkDb({ 'eightHour/u1': { plan: { wakeTime: '07:00', tz: TZ, taskCount: 1 }, lock: { dayKey: '2026-10-25', dayName: 'Sun', tz: TZ, startMs: at('2026-10-25T12:00:00Z'), endMs: at('2026-10-25T20:00:00Z'), indexes: [0], points: [50], totalPoints: 50, target: 45, earned: 0, settled: false }, stats: {} },
    'weeklyRoutines/u1_Sun': { tasks: [T('Late', { completed: true })], updatedAt: new Ts(at('2026-10-25T20:30:00Z')) } });
  clock = at('2026-10-25T21:00:00Z'); r = await call(db, { action: 'state' }); eq([r.body.lock.earned, r.body.stats.lastResult], [0, 'missed'], 'writes after the end are not counted');
  db.store['weeklyRoutines/u1_Sun'].updatedAt = new Ts(at('2026-10-25T19:00:00Z'));
  db.store['eightHour/u1'].lock.settled = false; db.store['eightHour/u1'].stats = {};
  r = await call(db, { action: 'state' }); eq([r.body.lock.earned, r.body.stats.lastResult], [50, 'met'], 'in-window writes are counted even if progress was never called');

  // task count must equal the plan
  db = mkDb({ 'eightHour/u1': { plan: { wakeTime: '07:00', tz: TZ, taskCount: 3 } }, 'weeklyRoutines/u1_Fri': { tasks: [T('One task'), T('Two tasks')] } });
  clock = at('2026-10-23T12:00:00Z'); r = await call(db, { action: 'start' }); eq([r.code, r.body.code], [409, 'count-mismatch']);
  // too many tasks / users are isolated
  db = mkDb({ 'eightHour/u1': { plan: { wakeTime: '07:00', tz: TZ, taskCount: 50 } }, 'weeklyRoutines/u1_Fri': { tasks: Array.from({ length: 51 }, (_, n) => T('t'.repeat(n + 1))) } });
  clock = at('2026-10-23T12:00:00Z'); r = await call(db, { action: 'start' }); eq([r.code, r.body.code], [409, 'too-many']);

  // ── AI path (REQUIRES SERVER AI): mocked; heuristic otherwise ──
  const seed = () => mkDb({ 'eightHour/u1': { plan: { wakeTime: '07:00', tz: TZ, taskCount: 2 } }, 'users/u1': { aiConsent: true }, 'weeklyRoutines/u1_Fri': { tasks: [T('Alpha task'), T('Beta')] } });
  const mkFetch = (content, okRes = true) => { const calls = []; const f = async (url, o) => { calls.push({ url, o }); return { ok: okRes, json: async () => ({ choices: [{ message: { content } }] }) }; }; f.calls = calls; return f; };
  clock = at('2026-10-23T12:00:00Z');
  let f = mkFetch(JSON.stringify({ tasks: [{ n: 0, complexity: 5, minutes: 120 }, { n: 1, complexity: 99, minutes: -4 }], targetRatio: 1 }));
  db = seed(); r = await call(db, { action: 'start' }, { fetch: f, apiKey: 'test-key-not-real' });
  eq([r.body.lock.estimateSource, r.body.lock.targetSource], ['ai', 'ai']);
  eq(r.body.lock.points, [core.pointsFor(5, 120), core.pointsFor(5, 1)], 'AI numbers clamped and run through our formula');
  eq(r.body.lock.target, r.body.lock.totalPoints, 'AI may only tighten the target');
  ok(f.calls[0].url === 'https://api.openai.com/v1/chat/completions' && f.calls[0].o.headers.Authorization === 'Bearer test-key-not-real', 'uses the server env key');
  ok(!JSON.stringify(r.body).includes('test-key'), 'key never in a response');
  // AI wants an easier target => ignored
  f = mkFetch(JSON.stringify({ tasks: [], targetRatio: 0.1 })); db = seed(); r = await call(db, { action: 'start' }, { fetch: f, apiKey: 'k' });
  eq(r.body.lock.target, core.dailyTarget(r.body.lock.points.map((p) => ({ points: p })), {}).target, 'ratio floor');
  // no key / no consent / AI error / garbage => heuristic, still 200, no call when not allowed
  f = mkFetch('{}'); db = seed(); r = await call(db, { action: 'start' }, { fetch: f, apiKey: undefined }); eq([r.code, r.body.lock.estimateSource, f.calls.length], [200, 'heuristic', 0]);
  f = mkFetch('{}'); db = seed(); db.store['users/u1'] = { aiConsent: false }; r = await call(db, { action: 'start' }, { fetch: f, apiKey: 'k' }); eq([r.body.lock.estimateSource, f.calls.length], ['heuristic', 0], 'no consent => nothing sent');
  f = mkFetch('{}', false); db = seed(); r = await call(db, { action: 'start' }, { fetch: f, apiKey: 'k' }); eq([r.code, r.body.lock.estimateSource], [200, 'heuristic'], 'AI failure falls back');
  f = mkFetch('not json'); db = seed(); r = await call(db, { action: 'start' }, { fetch: f, apiKey: 'k' }); eq([r.code, r.body.lock.estimateSource], [200, 'heuristic'], 'garbage falls back');
  console.log(`eight-hour function: ${pass} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
