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
t('met before the end: banked lock ends AT the day end, not midnight (iOS lifts it with the app closed)', () => {
  const r = S.strictShield({ ...common, now: at(16) }); assert.equal(r.phase, 'ready'); assert.equal(r.untilMs, dayEnd);
  const b = S.strictShield({ ...common, claimedAt: at(15), now: at(16, 30) }); assert.equal(b.phase, 'relocked'); assert.equal(b.untilMs, dayEnd); });
t('all tasks done counts as met even under the 50-pt floor goal / a penalty', () => {
  const r = S.strictShield({ ...common, goal: 50, earned: 20, allDone: true, now: dayEnd + 60000 }); assert.equal(r.want, false); assert.notEqual(r.phase, 'missed');
  assert.equal(S.strictShield({ ...common, goal: 50, earned: 20, now: dayEnd + 60000 }).phase, 'missed'); }); // not all done: miss rule unchanged
t('missed rule unchanged: end + 2 h, then off', () => { assert.equal(S.strictShield({ ...common, earned: 10, now: dayEnd + H }).untilMs, dayEnd + 2 * H); assert.equal(S.strictShield({ ...common, earned: 10, now: dayEnd + 2 * H + 1000 }).want, false); });

// --- per-session goal (2 h missed lock): the comparison that triggered it wrongly
const gp = { dayStart: '09:00', closeHours: 8, sessions: 2 }; const ms = (h, m) => ({ seconds: at(h, m) / 1000 });
const tasks = [{ title: 'Morning email', section: 'morning', estimateMin: 45, completed: true, completedAt: ms(8, 30) }, // before the day started
  { title: 'Write report', section: 'afternoon', estimateMin: 45, completed: true, completedAt: ms(10, 0) }, // session-2 task finished in session 1
  { title: 'Call', section: 'afternoon', estimateMin: 20, completed: true }]; // no completedAt
t('tasks finished early / before the day / without completedAt count: both sessions met', () => {
  const l = SP.sessionsOf(gp, tasks, at(18)); assert.deepEqual(l.map((s) => s.met), [true, true], JSON.stringify(l));
  assert.equal(SP.graceLock(l, at(14)).want, false); assert.equal(SP.graceLock(l, at(18)).want, false); });
t('server settle agrees (eight-hour-day session grace): met -> no grace', () => { const l = SP.sessionsOf(gp, tasks, at(18));
  for (const s of l) { const r = srv.sessionGrace(tasks, { n: s.n, startMs: s.startMs, endMs: s.endMs }); assert.equal(r.met, true); assert.equal(r.untilMs, 0); } });
t('a task finished AFTER its session end still misses (rule kept)', () => { const late = [{ title: 'Late', section: 'morning', estimateMin: 45, completed: true, completedAt: ms(13, 30) }];
  const [s1] = SP.sessionsOf(gp, late, at(14)); assert.equal(s1.met, false); assert.equal(SP.graceLock([s1], at(14)).want, true); });
t('grace schedule cancelled once met even after the session end (cold start / widget)', () => { const [s1] = SP.sessionsOf(gp, tasks, at(14)); const g = SP.graceSchedule(s1, at(14)); assert.equal(g.want, false); assert(g.untilMs > at(14)); });

// --- cold start: native still says locked (until midnight, or a running grace block) -> the app stops it
t('cold start after the end: lockAction stops the leftover lock', () => {
  const r = S.strictShield({ ...common, running: false, now: dayEnd + 30 * 60000 });
  assert.equal(lockAction({ want: r.want, endMs: r.untilMs, st: { locked: true, until: S.endOfDay(dayEnd), monitoring: true }, now: dayEnd + 30 * 60000 }), 'stop');
  assert.equal(lockAction({ want: false, st: { locked: true, until: dayEnd + 2 * H, monitoring: false }, now: dayEnd + 30 * 60000 }), 'stop'); });
t('before the end: an old midnight lock is shortened to the day end (start, not none)', () => {
  const r = S.strictShield({ ...common, now: at(16) }); assert.equal(lockAction({ want: r.want, endMs: r.untilMs, st: { locked: true, until: S.endOfDay(at(16)), monitoring: true }, now: at(16) }), 'start'); });

// --- model of the native stores: every named store is cleared and status unlocked at the end
const isRealEnd = (u, now) => u > 0 && u <= now + 90000; // LockEndAlertGate.isRealEnd
const mkNative = () => ({ stores: { clingLock: null, clingApps: null }, st: { locked: false, until: 0 }, sched: {}, acts: new Set() });
const startLock = (N, until) => { N.stores.clingLock = 'shield'; N.st = { locked: true, until }; N.acts.add('clingLock'); };
const stopLock = (N, now) => { N.stores.clingLock = null; N.st = { locked: false, until: 0 }; N.acts.delete('clingLock'); for (const k of Object.keys(N.sched)) if (N.sched[k][0] <= now) { delete N.sched[k]; N.acts.delete(k); } };
const blockStart = (N, k) => { N.st = { locked: true, until: Math.max(N.sched[k][1], N.st.until) }; N.stores.clingLock = 'shield'; };
const cancelScheduled = (N, k, now) => { const e = N.sched[k]; delete N.sched[k]; N.acts.delete(k); if (e && e[0] <= now && now < e[1] && N.st.until <= e[1] + 60000) { N.st = { locked: false, until: 0 }; N.stores.clingLock = null; } };
const lockEnd = (N, now) => { if (!isRealEnd(N.st.until, now)) return; N.stores.clingLock = null; N.stores.clingApps = null; N.acts.delete('clingLock'); N.st = { locked: false, until: 0 }; };
t('native: day lock ends at the day end -> monitor clears .clingLock + .clingApps, status unlocked', () => {
  const N = mkNative(); const r = S.strictShield({ ...common, now: at(16) }); startLock(N, r.untilMs); lockEnd(N, dayEnd);
  assert.deepEqual([N.stores.clingLock, N.stores.clingApps, N.st.locked], [null, null, false]); });
t('native: running 2 h grace block cancelled when met -> shield lifted (was left up: entry gone, intervalDidEnd saw 0)', () => {
  const N = mkNative(); N.sched.grace = [at(13), at(15)]; N.acts.add('grace'); blockStart(N, 'grace'); cancelScheduled(N, 'grace', at(13, 30));
  assert.deepEqual([N.stores.clingLock, N.st.locked, N.acts.size], [null, false, 0]); });
t('native: cold start sync stops a leftover midnight lock', () => { const N = mkNative(); startLock(N, S.endOfDay(dayEnd)); const now = dayEnd + 60000;
  const r = S.strictShield({ ...common, running: false, now }); if (lockAction({ want: r.want, endMs: r.untilMs, st: { ...N.st, monitoring: true }, now }) === 'stop') stopLock(N, now);
  assert.deepEqual([N.stores.clingLock, N.st.locked, N.acts.size], [null, false, 0]); });

// --- wiring (HomeView / plugin) so the pure rules are actually used
const hv = src('src/views/HomeView.vue'); const pl = src('ios/App/App/ClingLockPlugin.swift');
t('wiring: allDone passed, per-session claim, grace/eight-hour miss skipped when all done, cancel after end, native cancel lifts', () => {
  assert(/strictShield\(\{[^\n]*allDone/.test(hv)); assert(hv.includes('claimedAtBy')); assert(hv.includes('grace.want && free && !allTasksDone.value'));
  assert(hv.includes('ehs.missed && !allTasksDone.value')); assert(hv.includes('s.met && g.untilMs > Date.now()'));
  assert(/func cancelScheduledLock[\s\S]{0,1400}clearShield\(\)/.test(pl)); });
console.log(`unlock-at-end: ${n} passed`);
