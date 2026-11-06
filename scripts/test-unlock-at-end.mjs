// Unlock at the end (fix/unlock-at-end): all tasks finished, points met, time over -> every ClingNote shield off and the lock state
// unlocked, on a live tick and on a cold start. Pure policy + a small model of the native stores (.clingLock / .clingApps / scheduled blocks).
import assert from 'assert'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, '..'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unl-'));
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
fs.writeFileSync(path.join(dir, 'vue.mjs'), 'export const ref = (value) => ({ value });\n');
fs.writeFileSync(path.join(dir, 'gamePlan.js'), src('src/utils/gamePlan.js').replace("from 'vue'", "from './vue.mjs'"));
for (const f of ['taskSections', 'sessionGoal', 'aiEstimate', 'sessionPoints', 'dailyReport', 'strictDay', 'appLock']) fs.writeFileSync(path.join(dir, `${f}.js`), src(`src/utils/${f}.js`));
const S = await import(path.join(dir, 'strictDay.js')); const SP = await import(path.join(dir, 'sessionPoints.js'));
const { lockAction } = await import(path.join(dir, 'appLock.js'));
const srv = createRequire(import.meta.url)(path.join(root, 'netlify/functions/lib/sessionGrace.js'));
const GPm = await import(path.join(dir, 'gamePlan.js'));
let n = 0; const t = (name, fn) => { try { GPm.setSessionWindow({ startMs: new Date(2026, 10, 3, 9).getTime(), endMs: new Date(2026, 10, 3, 17).getTime() }); /* start anytime: a session the user started at 09:00 */ fn(); n++; console.log('ok ', name); } catch (e) { console.error('FAIL', name); throw e; } };
const H = 3600000; const at = (h, m = 0) => new Date(2026, 10, 3, h, m).getTime(); const dayEnd = at(17);
const common = { running: true, dayEndMs: dayEnd, selectionCount: 3, enabled: true, goal: 60, earned: 60, tasksDone: 3, goalAt: at(15) };

// --- strict / coach daily shield
t('met + time over: off (build 48 kept "ready" locked until midnight)', () => {
  for (const extra of [{}, { claimedAt: at(15, 10) }, { running: false }]) { const r = S.strictShield({ ...common, ...extra, now: dayEnd + 60000 }); assert.equal(r.want, false, JSON.stringify(extra)); assert.equal(r.phase, 'done'); } });
t('met before the end: 210/185 opens now, the shield does not wait for a tap', () => {
  const start = new Date(2026, 10, 6, 7, 4).getTime(); const end = new Date(2026, 10, 6, 13, 4).getTime();
  const now = end - (33 * 60 + 45) * 1000;
  const r = S.strictShield({ running: true, dayEndMs: end, now, selectionCount: 6, enabled: true, goal: 185, earned: 210, tasksDone: 15 });
  assert.ok(now > start && now < end); assert.equal(r.phase, 'open'); assert.equal(r.want, false);
  assert.equal(S.dayThresholdOpen({ earned: 210, required: 185 }), true);
  assert.equal(S.checklistMayRelock(r), false);
  assert.equal(S.strictShield({ running: true, dayEndMs: end, now, selectionCount: 6, enabled: true, goal: 185, earned: 184 }).phase, 'locked');
  assert.equal(lockAction({ want: r.want, endMs: r.untilMs, st: { locked: true, until: end, monitoring: true }, now }), 'stop'); });
t('second session at 210/185 starts the native shield; returning does not unlock it', () => {
  const end = new Date(2026, 10, 6, 19, 4).getTime(); const now = end - 2 * 3600000;
  const mem = { bag: new Map(), getItem(k) { return this.bag.has(k) ? this.bag.get(k) : null; }, setItem(k, v) { this.bag.set(k, v); } };
  const first = { dayKey: '2026-11-06', index: 0, startMs: new Date(2026, 10, 6, 7, 4).getTime() };
  assert.equal(S.noteSessionBase(mem, first, 0), 0);
  const opened = S.sessionShieldDecision({ running: true, now, endMs: end, selectionCount: 6, dayEarned: 210, dayRequired: 185, earnedAtStart: 0 });
  assert.equal(opened.phase, 'open'); assert.equal(opened.want, false);
  assert.equal(lockAction({ want: opened.want, endMs: opened.untilMs, st: { locked: true, until: end, monitoring: true }, now }), 'stop');
  const second = { dayKey: '2026-11-06', index: 1, startMs: now - 60000 };
  assert.equal(S.noteSessionBase(mem, second, 210), 210);
  assert.equal(S.noteSessionBase(mem, second, 210), 210);
  const relock = S.sessionShieldDecision({ running: true, now, endMs: end, selectionCount: 6, dayEarned: 210, dayRequired: 185, earnedAtStart: 210 });
  assert.equal(relock.want, true); assert.equal(relock.phase, 'locked'); assert.equal(relock.untilMs, end);
  assert.equal(lockAction({ want: relock.want, endMs: relock.untilMs, st: { locked: false, until: 0, monitoring: false }, now }), 'start');
  assert.equal(lockAction({ want: relock.want, endMs: relock.untilMs, st: { locked: true, until: end, monitoring: true }, now }), 'none');
  const low = S.sessionShieldDecision({ running: true, now, endMs: end, selectionCount: 6, dayEarned: 100, dayRequired: 185, earnedAtStart: 0 });
  assert.equal(low.want, true); assert.equal(lockAction({ want: low.want, endMs: low.untilMs, st: { locked: false, until: 0 }, now }), 'start');
  const earnedOwn = S.sessionShieldDecision({ running: true, now, endMs: end, selectionCount: 6, dayEarned: 400, dayRequired: 185, earnedAtStart: 210 });
  assert.equal(earnedOwn.want, false); assert.equal(earnedOwn.phase, 'open');
});
t('all tasks done counts as met even under the 50-pt floor goal / a penalty', () => {
  const r = S.strictShield({ ...common, goal: 50, earned: 20, allDone: true, now: dayEnd + 60000 }); assert.equal(r.want, false); assert.notEqual(r.phase, 'missed');
  assert.equal(S.strictShield({ ...common, goal: 50, earned: 20, now: dayEnd + 60000 }).want, false); }); // not all done: no timed strict lock (appLockDebt holds it)
t('no strict 2 h missed lock: off right after the end', () => { assert.equal(S.strictShield({ ...common, earned: 10, now: dayEnd + H }).want, false); assert.equal(S.strictShield({ ...common, earned: 10, now: dayEnd - H }).untilMs, dayEnd); });

// --- per-session goal (2 h missed lock): the comparison that triggered it wrongly
const gp = { dayStart: '09:00', closeHours: 8, sessions: 2 }; const ms = (h, m) => ({ seconds: at(h, m) / 1000 });
const tasks = [{ title: 'Morning email', section: 'morning', estimateMin: 45, completed: true, completedAt: ms(8, 30) }, // before the day started
  { title: 'Write report', section: 'afternoon', estimateMin: 45, completed: true, completedAt: ms(10, 0) }, // session-2 task finished in session 1
  { title: 'Call', section: 'afternoon', estimateMin: 20, completed: true }]; // no completedAt
t('fix/session-lock: a completion before the session start does NOT count (session 1 missed); in-window ones do', () => {
  const l = SP.sessionsOf(gp, tasks, at(18)); assert.deepEqual(l.map((s) => s.met), [false, true], JSON.stringify(l));
  assert.equal(SP.graceLock(l, at(14)).want, true, 'missed session 1 stays locked'); assert.equal(SP.graceLock(l, at(18)).want, false); });
t('server settle agrees (eight-hour-day session grace)', () => { const l = SP.sessionsOf(gp, tasks, at(18));
  for (const s of l) { const r = srv.sessionGrace(tasks, { n: s.n, startMs: s.sinceMs, endMs: s.endMs }); assert.equal(r.met, s.met); assert.equal(r.earned, s.earned); } });
t('a task finished AFTER its session end still misses (rule kept)', () => { const late = [{ title: 'Late', section: 'morning', estimateMin: 45, completed: true, completedAt: ms(13, 30) }];
  const [s1] = SP.sessionsOf(gp, late, at(14)); assert.equal(s1.met, false); assert.equal(SP.graceLock([s1], at(14)).want, true); });
t('met session (cold start / widget): no Coach grace schedule any more, native DebtHold plan instead', () => { const [s1] = SP.sessionsOf(gp, tasks, at(14)); assert(s1); assert.equal(SP.graceSchedule, undefined); });

// --- cold start: native still says locked (until midnight, or a running grace block) -> the app stops it
t('cold start after the end: lockAction stops the leftover lock', () => {
  const r = S.strictShield({ ...common, running: false, now: dayEnd + 30 * 60000 });
  assert.equal(lockAction({ want: r.want, endMs: r.untilMs, st: { locked: true, until: S.endOfDay(dayEnd), monitoring: true }, now: dayEnd + 30 * 60000 }), 'stop');
  assert.equal(lockAction({ want: false, st: { locked: true, until: dayEnd + 2 * H, monitoring: false }, now: dayEnd + 30 * 60000 }), 'stop'); });
t('before the end, goal met: an existing shield is stopped', () => {
  const r = S.strictShield({ ...common, now: at(16) }); assert.equal(r.phase, 'open'); assert.equal(r.want, false);
  assert.equal(lockAction({ want: r.want, endMs: r.untilMs, st: { locked: true, until: S.endOfDay(at(16)), monitoring: true }, now: at(16) }), 'stop'); });

// --- model of the native stores: every named store is cleared and status unlocked at the end
const isRealEnd = (u, now) => u > 0 && u <= now + 90000; // LockEndAlertGate.isRealEnd
const mkNative = () => ({ stores: { clingLock: null, clingApps: null }, st: { locked: false, until: 0 }, sched: {}, acts: new Set() });
const startLock = (N, until) => { N.stores.clingLock = 'shield'; N.st = { locked: true, until }; N.acts.add('clingLock'); };
const stopLock = (N, now) => { N.stores.clingLock = null; N.st = { locked: false, until: 0 }; N.acts.delete('clingLock'); for (const k of Object.keys(N.sched)) if (N.sched[k][0] <= now) { delete N.sched[k]; N.acts.delete(k); } };
const blockStart = (N, k) => { N.st = { locked: true, until: Math.max(N.sched[k][1], N.st.until) }; N.stores.clingLock = 'shield'; };
const cancelScheduled = (N, k, now) => { const e = N.sched[k]; delete N.sched[k]; N.acts.delete(k); if (e && e[0] <= now && now < e[1] && N.st.until <= e[1] + 60000) { N.st = { locked: false, until: 0 }; N.stores.clingLock = null; } };
const lockEnd = (N, now) => { if (!isRealEnd(N.st.until, now)) return; N.stores.clingLock = null; N.stores.clingApps = null; N.acts.delete('clingLock'); N.st = { locked: false, until: 0 }; };
t('native: goal met before the end -> sync stops the shield', () => {
  const N = mkNative(); startLock(N, dayEnd); const now = at(16); const r = S.strictShield({ ...common, now });
  if (lockAction({ want: r.want, endMs: r.untilMs, st: { ...N.st, monitoring: true }, now }) === 'stop') stopLock(N, now);
  assert.deepEqual([N.stores.clingLock, N.st.locked], [null, false]); });
t('native: running 2 h grace block cancelled when met -> shield lifted (was left up: entry gone, intervalDidEnd saw 0)', () => {
  const N = mkNative(); N.sched.grace = [at(13), at(15)]; N.acts.add('grace'); blockStart(N, 'grace'); cancelScheduled(N, 'grace', at(13, 30));
  assert.deepEqual([N.stores.clingLock, N.st.locked, N.acts.size], [null, false, 0]); });
t('native: cold start sync stops a leftover midnight lock', () => { const N = mkNative(); startLock(N, S.endOfDay(dayEnd)); const now = dayEnd + 60000;
  const r = S.strictShield({ ...common, running: false, now }); if (lockAction({ want: r.want, endMs: r.untilMs, st: { ...N.st, monitoring: true }, now }) === 'stop') stopLock(N, now);
  assert.deepEqual([N.stores.clingLock, N.st.locked, N.acts.size], [null, false, 0]); });

// --- wiring (HomeView / plugin) so the pure rules are actually used
const hv = src('src/views/HomeView.vue'); const pl = src('ios/App/App/ClingLockPlugin.swift');
t('wiring: allDone passed, per-session claim, missed-goal lock via appLockDebt (no 2 h grace), cancel after end, native cancel lifts', () => {
  assert(/strictShield\(\{[^\n]*allDone/.test(hv)); assert(hv.includes('claimedAtBy')); assert(!hv.includes('grace.want && free')); assert(!hv.includes('ehs.missed'));
  assert(hv.includes('debtShield({ debt: eh.appLockDebt.value')); assert(hv.includes('debtHoldPlan({ debt: eh.appLockDebt.value'));
  assert(/func cancelScheduledLock[\s\S]{0,1400}clearShield\(\)/.test(pl)); });
console.log(`unlock-at-end: ${n} passed`);
