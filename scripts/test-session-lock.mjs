// fix/session-lock: per-session app lock. 5..12 h sessions, apps picked per session (pre-filled with the last-used selection),
// shield up at Begin, AI/fallback points goal frozen at Begin, unlock only when post-Start points reach the goal, missed goal = debt hold.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const core = require('../netlify/functions/lib/eightHourCore.js');
const { handler } = require('../netlify/functions/eight-hour-day.js');
const SG = await import('../src/utils/sessionGoal.js');
const SA = await import('../src/utils/sessionApps.js');
const EH = await import('../src/utils/eightHour.js');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
const at = (iso) => Date.parse(iso); const TZ = 'America/New_York'; const H = 3600000;
const plain = (o) => o && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;
const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = plain(b[k]) && plain(o[k]) ? merge(o[k], b[k]) : b[k]; return o; };
const mkDb = (seed0 = {}) => { const store = { 'users/u1': { isPro: true, lockInEnabled: true, gamePlan: { sessions: 1 } }, ...seed0 };
  const ref = (p) => ({ path: p, get: async () => ({ exists: p in store, data: () => store[p] }), set: async (d, opt) => { store[p] = opt && opt.merge && store[p] ? merge(store[p], d) : d; } });
  return { store, doc: ref, runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o) }) }; };
let clock = 0;
const call = async (db, body, extra = {}) => { const r = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer x' }, body: JSON.stringify(body) }, {}, { verify: async () => ({ uid: 'u1' }), db, now: () => clock, ts: (ms) => new Ts(ms), serverTime: () => new Ts(clock), apiKey: undefined, ...extra });
  return { code: r.statusCode, body: JSON.parse(r.body) }; };
const T = (title, extra = {}) => ({ title: `ZZTEST ${title}`, size: 'm', completed: false, createdAt: 1, type: 'recurring', ...extra }); // 20 pts each
const day = (db) => db.store['weeklyRoutines/u1_Fri'];
const finish = (db, i) => { Object.assign(day(db).tasks[i], { completed: true, completedAt: clock }); day(db).updatedAt = new Ts(clock); };

await t('session hours: whole hours 5..12 only (client + server rule)', () => {
  assert.deepEqual(core.SESSION_HOURS, { min: 5, max: 12, step: 1 });
  for (const h of [5, 8, 12]) assert.equal(core.validSessionHours(h), true);
  for (const h of [4, 13, 6.5, 0, null, undefined, NaN, 'x']) assert.equal(core.validSessionHours(h), false, String(h));
  assert.deepEqual(EH.SESSION_HOUR_OPTIONS.map((o) => (typeof o === 'object' ? o.value : o)), [5, 6, 7, 8, 9, 10, 11, 12]);
});

await t('goal: deterministic fallback from tasks-before + hours, clamped (20..open points, step 5)', () => {
  assert.equal(core.fallbackGoal({ tasksBefore: 4, hours: 6, totalPoints: 500 }), 80);
  assert.equal(core.fallbackGoal({ tasksBefore: 4, hours: 6, totalPoints: 50 }), 50, 'never more than what is open');
  assert.equal(core.clampGoal(1, 500), core.GOAL_MIN); assert.equal(core.clampGoal(99999, 10000), core.GOAL_MAX); assert.equal(core.clampGoal(33, 500), 35);
  assert.ok(core.fallbackGoal({ tasksBefore: 8, hours: 8, totalPoints: 900 }) > core.fallbackGoal({ tasksBefore: 4, hours: 8, totalPoints: 900 }), 'more tasks => higher goal');
  assert.ok(core.fallbackGoal({ tasksBefore: 4, hours: 12, totalPoints: 900 }) > core.fallbackGoal({ tasksBefore: 4, hours: 5, totalPoints: 900 }), 'longer => higher goal');
});

await t('unlock only when post-Start points reach the goal; early completions never count', () => {
  const s = 1000, e = 1000 + 5 * H; const pts = SG.taskPoints({ size: 'm' });
  const tasks = [{ size: 'm', completed: true, completedAt: 500 }, { size: 'm', completed: true, completedAt: 2000 }, { size: 'm' }];
  const g = SG.sessionGoal(tasks, { n: 1, sessions: 1, startMs: s, endMs: e, goal: 2 * pts });
  assert.deepEqual([g.earned, g.done, g.met], [pts, 1, false], 'task done before Start ignored');
  tasks[2] = { size: 'm', completed: true, completedAt: 3000 };
  assert.equal(SG.sessionGoal(tasks, { n: 1, sessions: 1, startMs: s, endMs: e, goal: 2 * pts }).met, true, 'met exactly at the goal');
  tasks[2] = { size: 'm', completed: true, completedAt: e + 1 };
  assert.equal(SG.sessionGoal(tasks, { n: 1, sessions: 1, startMs: s, endMs: e, goal: 2 * pts }).met, false, 'after the end does not count');
  assert.equal(core.sessionMet({ target: 40, earned: 39 }), false); assert.equal(core.sessionMet({ target: 40, earned: 40 }), true);
});

await t('server: Begin stores apps + frozen goal; met session 1, then session 2 locks again with its own goal', async () => {
  const db = mkDb({ 'weeklyRoutines/u1_Fri': { tasks: [T('a'), T('b'), T('c'), T('d'), T('e'), T('f')] } });
  clock = at('2026-10-23T12:00:00Z'); await call(db, { action: 'plan', taskCount: 6, tz: TZ });
  clock = at('2026-10-23T13:00:00Z');
  let r = await call(db, { action: 'start', hours: 5, apps: { apps: 3, categories: 1, sites: 0, junk: 'x' } });
  assert.equal(r.code, 200); assert.deepEqual(r.body.lock.apps, { apps: 3, categories: 1, sites: 0 }, 'per-session selection stored (counts only)');
  const g1 = r.body.lock.goal; assert.equal(g1.key, '2026-10-23#0'); assert.equal(g1.source, 'fallback'); assert.equal(g1.hours, 5); assert.equal(g1.tasksBefore, 6);
  assert.equal(r.body.lock.target, core.fallbackGoal({ tasksBefore: 6, hours: 5, totalPoints: 120 }));
  const need = Math.ceil(r.body.lock.target / 20);
  for (let i = 0; i < need; i++) { clock += 10 * 60000; finish(db, i); r = await call(db, { action: 'progress' }); }
  clock = r.body.lock.endMs + 60000; r = await call(db, { action: 'state' }); assert.equal(r.body.appLockDebt, null, 'met: no debt');
  r = await call(db, { action: 'nextSession', hours: 6, apps: { apps: 1 } });
  // Session-end delay rule: the points goal was met and no important task was left open -> no wait (even with fewer than TASKS_PER_SESSION tasks).
  assert.notEqual(r.code, 409, 'goal met, 0 important missed -> no cooldown');
  assert.deepEqual([r.code, r.body.phase, r.body.lock.index], [200, 'running', 1], 'second session runs (locked) right away');
  assert.equal(r.body.lock.goal.key, '2026-10-23#1'); assert.equal(r.body.lock.goal.frozenMs, clock); assert.deepEqual(r.body.lock.apps, { apps: 1, categories: 0, sites: 0 });
  assert.equal(r.body.lock.earned, 0, 'session 1 completions do not count for session 2');
  assert.ok(r.body.lock.target <= (6 - need) * 20, 'goal clamped to what is still open');
});

await t('server: missed goal => debt hold until a LATER session meets its goal', async () => {
  const db = mkDb({ 'weeklyRoutines/u1_Fri': { tasks: 'abcdefghijklmn'.split('').map((c) => T(c)) } });
  clock = at('2026-10-23T12:00:00Z'); await call(db, { action: 'plan', taskCount: 14, tz: TZ });
  clock = at('2026-10-23T13:00:00Z'); let r = await call(db, { action: 'start', hours: 5 });
  clock = r.body.lock.endMs + 60000; r = await call(db, { action: 'state' }); assert.equal(r.body.appLockDebt.sessionKey, '2026-10-23#0');
  clock += 3 * H; r = await call(db, { action: 'state' }); assert.ok(r.body.appLockDebt, 'no time-based unlock');
  r = await call(db, { action: 'nextSession', hours: 5 }); const tgt = r.body.lock.target; assert.ok(r.body.appLockDebt);
  let i = 0; while ((i + 1) * 20 < tgt) { clock += 60000; finish(db, i++); r = await call(db, { action: 'progress' }); assert.ok(r.body.appLockDebt, 'short of the goal: still held'); }
  clock += 60000; finish(db, i++); r = await call(db, { action: 'progress' });
  while (i < core.TASKS_PER_SESSION) { assert.ok(r.body.appLockDebt, 'goal met but fewer than 8 tasks: still held'); clock += 60000; finish(db, i++); r = await call(db, { action: 'progress' }); }
  assert.equal(r.body.appLockDebt, null, 'later session met goal AND 8 tasks: released');
});

await t('server: bad hours refused (start + nextSession)', async () => {
  const db = mkDb({ 'weeklyRoutines/u1_Fri': { tasks: [T('a'), T('b'), T('c'), T('d')] } });
  clock = at('2026-10-23T12:00:00Z'); await call(db, { action: 'plan', taskCount: 4, tz: TZ });
  for (const h of [2, 4, 13, 7.5]) { const r = await call(db, { action: 'start', hours: h }); assert.deepEqual([r.code, r.body.code], [400, 'bad-hours'], `start ${h}`); }
  const r = await call(db, { action: 'nextSession', hours: 3 }); assert.deepEqual([r.code, r.body.code], [400, 'bad-hours'], 'nextSession uses the same rule');
});

await t('last-used apps: picker seed + what Begin records', () => {
  assert.equal(SA.LAST_USED_KEY, 'lock.selection.lastUsed'); assert.equal(SA.SELECTION_KEY, 'lock.selection');
  const last = { apps: 2 }, glob = { apps: 5 };
  assert.deepEqual(SA.pickerSeed({ lastUsed: last, global: glob }), { from: 'lastUsed', selection: last });
  assert.deepEqual(SA.pickerSeed({ global: glob }), { from: 'global', selection: glob });
  assert.equal(SA.pickerSeed({}).from, 'empty');
  const chosen = { apps: 7 }; assert.deepEqual(SA.beginSelection({ chosen, lastUsed: last, global: glob }), { global: chosen, lastUsed: chosen }, 'chosen at Begin becomes last-used');
  assert.equal(SA.sessionApps({ apps: 0 }), null); assert.equal(SA.appsLabel({ apps: 1, categories: 2 }), '1 app, 2 categories');
});

await t('native wiring (static): App Group keys, seeded picker, lastUsed written at Begin', () => {
  const shared = src('ios/App/Shared/LockShared.swift'), plug = src('ios/App/App/ClingLockPlugin.swift');
  assert.match(shared, /lastUsedSelectionKey = "lock\.selection\.lastUsed"/); assert.match(shared, /selectionKey = "lock\.selection"/);
  assert.match(plug, /forSession \? Self\.sessionSeedSelection\(\) : Self\.loadSelection\(\)/);
  assert.match(plug, /sessionBegin[\s\S]{0,200}forKey: LockShared\.lastUsedSelectionKey/);
  const js = src('src/native/clingNative.js'); assert.match(js, /sessionBegin/);
});

await t('app wiring (static): per-session claim key, shield at Begin, stale lock relocks in the same sync', () => {
  const h = src('src/views/HomeView.vue');
  assert.match(h, /const strictSessionKey = \(ss\) => \{[^\n]*`\$\{l\.dayKey\}#\$\{Number\(l\.index\) \|\| 0\}`[^\n]*`\$\{base\}s\$\{ss\.n\}`/, 'claim key carries the session index');
  assert.match(h, /claimedAtBy: \{ \.\.\.by, \[sk\]: Date\.now\(\) \}/, 'a claim in session 1 cannot satisfy session 2');
  assert.match(h, /if \(opts\.lock\) await startHardLock\(\{ sessionBegin: true \}\)/, 'shield applied at Begin');
  assert.match(h, /await clingLock\.stopLock\(\); clingLock\.labeledApps\(\); st = await clingLock\.status\(\); \}/, 'stale lock cleared, status refreshed, sync continues (no return)');
  assert.match(h, /pickApps\(\{ session: true \}\)/, 'session picker');
});

console.log(`session lock: ${n} ok`);
