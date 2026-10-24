// Day length (3h..12h, 0.5 steps, default 8): clamping, phase/end time, warnings, target scaling, and the server start(hours) path.
const assert = require('assert');
const core = require('../netlify/functions/lib/eightHourCore');
const { handler } = require('../netlify/functions/eight-hour-day');
let pass = 0; const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };
const H = 3600000, M = 60000; const at = (iso) => Date.parse(iso); const TZ = 'America/New_York';

// range
eq(core.DAY_HOURS, { min: 3, max: 12, step: 0.5, default: 8 });
// clamping
for (const [i, o] of [[8, 8], [3, 3], [12, 12], [2.9, 3], [1, 3], [0, 3], [-5, 3], [12.5, 12], [24, 12], [6.3, 6.5], [6.2, 6], [6.25, 6.5], [7.74, 7.5], ['6', 6], ['9.5', 9.5],
  [undefined, 8], [null, 8], ['', 8], ['abc', 8], [NaN, 8], [Infinity, 8]]) eq(core.clampHours(i), o, `clampHours(${i})`);
eq(core.hoursMs(6), 6 * H); eq(core.hoursMs(99), 12 * H); eq(core.hoursLabel(6.5), '6.5'); eq(core.hoursLabel(8), '8');
eq(core.WINDOW_MS, 8 * H); eq(core.WINDOW_MIN, 480);
// phase: confirm mode, end = now + hours
const now = at('2026-10-23T13:00:00Z'); // 9:00 AM EDT
let p = core.evaluatePhase({ wakeTime: '07:00', tz: TZ, nowMs: now, lock: null, hours: 6 });
eq([p.phase, p.startMs, p.endMs], ['ready', now, now + 6 * H]);
eq(core.evaluatePhase({ wakeTime: '07:00', tz: TZ, nowMs: now, lock: null, hours: 40 }).endMs, now + 12 * H, 'clamped to 12h');
eq(core.evaluatePhase({ wakeTime: '07:00', tz: TZ, nowMs: now, lock: null }).endMs, now + 8 * H, 'default 8h');
eq(core.START_MODE, 'confirm');
// warnings: 15 and 5 minutes before the end
const end = now + 6 * H;
eq(core.warningDue(end, end - 20 * M), 0); eq(core.warningDue(end, end - 15 * M), 15); eq(core.warningDue(end, end - 6 * M), 15);
eq(core.warningDue(end, end - 5 * M), 5); eq(core.warningDue(end, end - 1000), 5); eq(core.warningDue(end, end), 0); eq(core.WARN_MINUTES, [15, 5]);
// target slack scales with the span
const tasks = [{ points: 50, minutes: 300 }];
eq(core.dailyTarget(tasks, {}, 360).slackMin, 60); eq(core.dailyTarget(tasks, {}).slackMin, 180); eq(core.dailyTarget(tasks, {}, 360).tight, true);
// shutdown fallback scales (no wake time on the lock)
eq(core.shutUntilMs({ dayKey: '2026-10-23', endMs: 1000, hours: 6 }), 1000 + 18 * H);

// server: start with hours
class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
const plain = (o) => o && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;
const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = plain(b[k]) && plain(o[k]) ? merge(o[k], b[k]) : b[k]; return o; };
const mkDb = () => { const store = {}; const ref = (path) => ({ path, get: async () => ({ exists: path in store, data: () => store[path] }), set: async (d, opt) => { store[path] = opt && opt.merge && store[path] ? merge(store[path], d) : d; } });
  return { store, doc: ref, runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o) }) }; };
const verify = async () => ({ uid: 'u1' });
const call = (db, body, clock) => handler({ httpMethod: 'POST', headers: { authorization: 'Bearer x' }, body: JSON.stringify(body) }, {}, { verify, db, now: () => clock, ts: (ms) => new Ts(ms), serverTime: () => new Ts(clock), apiKey: undefined }).then((r) => ({ code: r.statusCode, body: JSON.parse(r.body) }));
(async () => {
  for (const [sent, want] of [[6, 6], [2, 3], [20, 12], [6.3, 6.5], [undefined, 8]]) {
    const db = mkDb();
    await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 1, tz: TZ }, now);
    db.store['weeklyRoutines/u1_Fri'] = { tasks: [{ title: 'ZZTEST a', completed: false, createdAt: 'x', type: 'one-time' }] };
    const r = await call(db, { action: 'start', hours: sent }, now);
    eq([r.code, r.body.phase, r.body.lock.hours, r.body.lock.startMs, r.body.lock.endMs], [200, 'running', want, now, now + want * H], `start hours=${sent}`);
    // confirmed hours are frozen: a second start with other hours is a no-op
    const r2 = await call(db, { action: 'start', hours: 3 }, now + M);
    eq(r2.body.lock.endMs, now + want * H);
    // after the end: ended + shut
    const r3 = await call(db, { action: 'state' }, now + want * H + 1000);
    eq(r3.body.phase, 'ended');
  }
  console.log(`day length: ${pass} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
