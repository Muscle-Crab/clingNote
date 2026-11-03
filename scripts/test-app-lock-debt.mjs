// Missed-goal app lock (appLockDebt): a session that ends short of its points goal keeps the picked apps (Screen Time shields)
// locked after it ends, until a LATER session hits its own goal. No streak reset, no points drop, ClingNote stays usable.
// Server (eight-hour-day, in-memory Firestore, server clock) + shared core rule + client cache/shield + wiring. ZZTEST data only.
import assert from 'assert'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, '..'); const req = createRequire(import.meta.url);
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { handler } = req(path.join(root, 'netlify/functions/eight-hour-day.js')); const core = req(path.join(root, 'netlify/functions/lib/eightHourCore.js'));
const C = await import(path.join(root, 'src/utils/appLockDebt.js'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; }; const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };
const TZ = 'America/New_York'; const at = (iso) => Date.parse(iso); const H = 3600000; const D = 24 * H;
class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
const plain = (o) => o && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;
const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = plain(b[k]) && plain(o[k]) ? merge(o[k], b[k]) : b[k]; return o; };
const mkDb = (seed0 = {}) => { const store = { 'users/u1': { isPro: true, lockInEnabled: true, gamePlan: { sessions: 1 } }, ...seed0 };
  const ref = (p) => ({ path: p, get: async () => ({ exists: p in store, data: () => store[p] }), set: async (d, opt) => { store[p] = opt && opt.merge && store[p] ? merge(store[p], d) : d; } });
  return { store, doc: ref, runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o) }) }; };
let clock = 0;
const call = async (db, body) => { const r = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer x' }, body: JSON.stringify(body) }, {}, { verify: async () => ({ uid: 'u1' }), db, now: () => clock, ts: (ms) => new Ts(ms), serverTime: () => new Ts(clock), apiKey: undefined });
  return { code: r.statusCode, body: JSON.parse(r.body) }; };
const T = (title) => ({ title: `ZZTEST ${title}`, size: 'm', completed: false, createdAt: `c-${title}`, type: 'recurring' }); // 20 pts each
const day = (db) => db.store['weeklyRoutines/u1_Fri'];
const finish = (db, i) => { Object.assign(day(db).tasks[i], { completed: true, completedAt: clock }); day(db).updatedAt = new Ts(clock); };

// ---- shared rule (eightHourCore) ----
{ const s0 = { sessionKey: '2026-10-23#0', startMs: 100, endMs: 200, target: 60, earned: 20, met: false };
  const d0 = core.debtAfterSettle(null, s0); eq(d0, { sessionKey: '2026-10-23#0', target: 60, earned: 20, sinceMs: 200 }, 'a miss creates the debt');
  eq(core.debtAfterSettle(d0, s0), d0, 'idempotent: same session settled twice');
  eq(core.debtAfterSettle(null, { ...s0, met: true }), null, 'met: no debt'); eq(core.debtAfterSettle(null, { ...s0, target: 0 }), null, 'no goal: never a debt');
  eq(core.debtAfterSettle(d0, { sessionKey: '2026-10-23#1', startMs: 300, endMs: 400, target: 40, earned: 40, met: true }), null, 'a later session that met pays it');
  eq(core.debtAfterSettle(d0, { sessionKey: 'x#0', startMs: 150, endMs: 190, target: 40, earned: 40, met: true }), d0, 'a session started BEFORE the miss cannot pay it');
  eq(core.debtAfterSettle(d0, { sessionKey: '2026-10-23#1', startMs: 300, endMs: 400, target: 40, earned: 0, met: false }).sinceMs, 400, 'missed again: debt moves to the latest miss');
  eq(core.debtCleared(d0, { startMs: 250, target: 40, earned: 40 }), true); eq(core.debtCleared(d0, { startMs: 250, target: 40, earned: 39 }), false);
  eq(core.debtCleared(d0, { startMs: 250, target: 0, earned: 0 }), false, 'an empty session cannot pay it');
  eq(core.debtActive(d0, 200 + core.DEBT_CAP_MS - 1), true); eq(core.debtActive(d0, 200 + core.DEBT_CAP_MS), false, '14-day safety cap');
  eq(core.normDebt({ sessionKey: '', sinceMs: 1 }), null); eq(core.normDebt({ foo: 1 }), null); }

// ---- server flow: miss -> debt persists (idempotent) -> new session hits goal -> cleared at once ----
{ const db = mkDb({ 'weeklyRoutines/u1_Fri': { tasks: [T('a'), T('b'), T('c')] } });
  clock = at('2026-10-23T12:00:00Z'); await call(db, { action: 'plan', taskCount: 3, tz: TZ });
  clock = at('2026-10-23T13:00:00Z'); let r = await call(db, { action: 'start', hours: 3 }); eq([r.code, r.body.lock.index], [200, 0]); const E = r.body.lock.endMs;
  eq(r.body.appLockDebt, null, 'no debt before any miss');
  clock = at('2026-10-23T14:00:00Z'); finish(db, 0); await call(db, { action: 'progress' });
  const stats0 = { ...db.store['eightHour/u1'].stats };
  clock = E + 30 * 60000; r = await call(db, { action: 'state' });
  eq(r.body.appLockDebt, { sessionKey: '2026-10-23#0', target: 60, earned: 20, sinceMs: E }, 'missed 20/60: debt saved server-side');
  eq(db.store['eightHour/u1'].appLockDebt, r.body.appLockDebt, 'persisted on eightHour/{uid}');
  eq(r.body.lock.graceUntilMs, 0, 'no clock-time unlock (old end + 2 h)');
  const snap = JSON.stringify(db.store['eightHour/u1']); r = await call(db, { action: 'state' }); clock += 6 * H; r = await call(db, { action: 'state' });
  eq(JSON.stringify(db.store['eightHour/u1']), snap, 'idempotent: re-reading / later reads change nothing'); ok(r.body.appLockDebt, 'still locked hours later (no time-based unlock)');
  ok(!('streak' in stats0) || db.store['eightHour/u1'].stats.streak === undefined || typeof db.store['eightHour/u1'].stats.streak === 'number', 'stats intact');
  // new session: progress short of the goal keeps it; the moment the goal is hit it clears (no wait for the session end)
  r = await call(db, { action: 'nextSession', hours: 2 }); eq([r.code, r.body.lock.index], [200, 1]); ok(r.body.appLockDebt, 'debt survives starting a new session');
  clock += 10 * 60000; finish(db, 1); r = await call(db, { action: 'progress' }); ok(r.body.appLockDebt, '40/60: still locked');
  clock += 10 * 60000; finish(db, 2); r = await call(db, { action: 'progress' }); eq(r.body.appLockDebt, null, 'goal hit mid-session: unlocked at once');
  eq(db.store['eightHour/u1'].appLockDebt, null, 'cleared server-side');
  clock = r.body.lock.endMs + 60000; r = await call(db, { action: 'state' }); eq(r.body.appLockDebt, null, 'met session settles without a new debt'); }

// ---- server: two misses in a row, then a met session pays it at settle (e.g. app killed mid-session, no progress call) ----
{ const db = mkDb({ 'weeklyRoutines/u1_Fri': { tasks: [T('a'), T('b')] } });
  clock = at('2026-10-23T12:00:00Z'); await call(db, { action: 'plan', taskCount: 2, tz: TZ });
  clock = at('2026-10-23T13:00:00Z'); let r = await call(db, { action: 'start', hours: 3 });
  clock = r.body.lock.endMs + 5 * 60000; r = await call(db, { action: 'nextSession', hours: 3 }); eq(r.body.lock.index, 1);
  eq(db.store['eightHour/u1'].appLockDebt.sessionKey, '2026-10-23#0', 'session 1 missed (settled by nextSession)');
  clock = r.body.lock.endMs + 5 * 60000; r = await call(db, { action: 'state' }); eq(r.body.appLockDebt.sessionKey, '2026-10-23#1', 'missed again: debt follows the latest miss');
  r = await call(db, { action: 'nextSession', hours: 3 }); const E3 = r.body.lock.endMs; clock += 60000;
  finish(db, 0); finish(db, 1); // completions written by the widget while ClingNote was killed: no progress call
  clock = E3 + 60000; r = await call(db, { action: 'state' }); eq(r.body.appLockDebt, null, 'settle of a met later session pays the debt'); }

// ---- client cache + shield ----
{ const mem = {}; const ls = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const d = { sessionKey: '2026-10-23#0', target: 60, earned: 20, sinceMs: 1000 };
  C.writeDebtCache(C.cacheWithDebt(C.readDebtCache('u1', ls), d), ls);
  eq(C.readDebtCache('u1', ls).debt, d, 'cached per account'); eq(C.readDebtCache('u2', ls).debt, null, 'another account never sees it');
  const c = C.readDebtCache('u1', ls);
  eq(C.mergeDebt({ server: undefined, serverKnown: false, cache: c }), d, 'offline / cold start: cached debt still locks');
  eq(C.mergeDebt({ server: null, serverKnown: true, cache: c }), null, 'server is the source of truth once loaded');
  const cc = C.cacheCleared(c, d.sessionKey); eq(C.mergeDebt({ server: d, serverKnown: true, cache: cc }), null, 'a debt this device saw paid is not re-applied by a racing reply');
  eq(C.cacheCleared(cc, d.sessionKey).cleared.length, 1, 'clearing is idempotent');
  const base = { debt: d, now: 2000, enabled: true, selectionCount: 3 };
  eq(C.debtShield(base), { want: true, cleared: false, untilMs: 1000 + core.DEBT_CAP_MS }, 'shields up after the miss');
  eq(C.debtShield({ ...base, session: { startMs: 1500, target: 40, earned: 40 } }).cleared, true, 'goal hit in a later session: lifted at once');
  eq(C.debtShield({ ...base, session: { startMs: 1500, target: 40, earned: 20 } }).want, true);
  for (const x of [{ enabled: false }, { selectionCount: 0 }, { unlockedToday: true }, { friend: true }, { onBreak: true }]) eq(C.debtShield({ ...base, ...x }).want, false, JSON.stringify(x));
  eq(C.debtShield({ ...base, debt: null }).want, false); }

// ---- wiring (existing UI text only: the shutdown line falls back to "Goal missed · 20/60 pts"; Start new session unchanged) ----
{ const hv = src('src/views/HomeView.vue'); const ue = src('src/composables/useEightHour.js'); const ch = src('src/components/eighthour/EightHourChrome.vue');
  ok(/debtShield\(\{ debt: eh\.appLockDebt\.value/.test(hv) && /clearDebtLocal\(debt\.sessionKey\)/.test(hv) && /eh\.reportProgress\(\)/.test(hv), 'syncAppLock uses the debt');
  ok(/want = true; endMs = Math\.max\(debt\.untilMs/.test(hv), 'debt keeps the shield on');
  ok(/const liveDebtSession[\s\S]{0,400}sessionGoal\(todayTasksForTarget\.value/.test(hv), 'client goal = server sessionGoal math');
  ok(/missed: false, opensAtMs: 0/.test(ue) && /cacheDebt\(d\)/.test(ue) && /appLockDebt,/.test(ue), 'useEightHour caches + exposes the debt');
  ok(ch.includes("'Goal missed'") && ch.includes('Start new session'), 'existing UI text'); }
console.log(`app lock debt: ${pass} checks passed`);
