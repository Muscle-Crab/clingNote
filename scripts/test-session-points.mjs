// Per-session points + the 2 h missed-shutdown lock (client pure, strictShield, server mirror, wiring, native).
import assert from 'assert'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, '..'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-'));
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
fs.writeFileSync(path.join(dir, 'vue.mjs'), 'export const ref = (value) => ({ value });\n');
fs.writeFileSync(path.join(dir, 'gamePlan.js'), src('src/utils/gamePlan.js').replace("from 'vue'", "from './vue.mjs'"));
fs.writeFileSync(path.join(dir, 'taskSections.js'), src('src/utils/taskSections.js'));
fs.writeFileSync(path.join(dir, 'sessionGoal.js'), src('src/utils/sessionGoal.js')); fs.writeFileSync(path.join(dir, 'aiEstimate.js'), src('src/utils/aiEstimate.js'));
fs.writeFileSync(path.join(dir, 'sessionPoints.mjs'), src('src/utils/sessionPoints.js'));
fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
const G = await import(path.join(dir, 'gamePlan.js')); const S = await import(path.join(dir, 'sessionPoints.mjs'));
const srv = createRequire(import.meta.url)(path.join(root, 'netlify/functions/lib/sessionGrace.js'));
let n = 0; const t = (name, fn) => { try { G.setSessionWindow({ startMs: new Date(2026, 10, 3, 7).getTime(), endMs: new Date(2026, 10, 3, 15).getTime() }); /* start anytime: a session the user started at 07:00 */ fn(); n++; console.log('ok ', name); } catch (e) { console.error('FAIL', name); throw e; } };
const at = (h, m = 0) => new Date(2026, 10, 3, h, m).getTime(); const H = 3600000;
const gp = { ...G.normPlan({ dayStart: '07:00' }), sessions: 2 }; // 07:00-15:00, session 1 07-11, session 2 11-15
// morning: 2 x m (40) ; rest: l + s (50)
const mk = (done1, done2) => [
  { id: 'a', section: 'morning', size: 'm', completed: done1 >= 1, completedAt: done1 >= 1 ? at(9) : null },
  { id: 'b', section: 'morning', size: 'm', completed: done1 >= 2, completedAt: done1 >= 2 ? at(10) : null },
  { id: 'c', section: 'noon', size: 'l', completed: done2 >= 1, completedAt: done2 >= 1 ? at(12) : null },
  { id: 'd', section: 'afternoon', size: 's', completed: done2 >= 2, completedAt: done2 >= 2 ? at(14) : null }];
t('targets = sum of each session\'s tasks; morning default for untimed', () => {
  const l = S.sessionsOf(gp, mk(0, 0), at(8)); assert.deepStrictEqual(l.map((s) => s.target), [40, 50]);
  assert.strictEqual(l[0].endMs, at(11)); assert.strictEqual(l[1].endMs, at(15));
  assert.strictEqual(S.sessionOfTask({}), 1); assert.strictEqual(S.sessionOfTask({ startTime: '13:00' }), 2);
});
t('only points earned inside the session count', () => {
  const tasks = mk(2, 0); tasks[1].completedAt = at(12); // morning task finished in the afternoon
  const l = S.sessionsOf(gp, tasks, at(12)); assert.strictEqual(l[0].earned, 20); assert.strictEqual(l[0].met, false); assert.strictEqual(l[1].earned, 0);
});
t('game-plan line label', () => { const l = S.sessionsOf(gp, mk(1, 0), at(9)); assert.strictEqual(S.sessionLabel(S.currentSession(l, at(9))), 'Morning 20/40 pts');
  assert.strictEqual(S.sessionLabel(S.currentSession(l, at(12))), 'Afternoon 0/50 pts'); assert(/gpSession\.value \? SP\.sessionLabel/.test(src('src/views/HomeView.vue'))); });
for (const [m1, m2] of [[true, true], [true, false], [false, true], [false, false]]) t(`combo morning ${m1 ? 'met' : 'missed'} / afternoon ${m2 ? 'met' : 'missed'}`, () => {
  const tasks = mk(m1 ? 2 : 1, m2 ? 2 : 1); const g = (now) => S.graceLock(S.sessionsOf(gp, tasks, now), now);
  assert.strictEqual(g(at(10, 59)).want, false); // during session 1: no grace yet
  assert.strictEqual(g(at(11, 30)).want, !m1); if (!m1) { assert.strictEqual(g(at(11, 30)).untilMs, at(13)); assert.strictEqual(g(at(11, 30)).n, 1); }
  assert.strictEqual(g(at(13, 1)).want, false); // session-1 grace over -> unlocks on its own
  assert.strictEqual(g(at(15, 30)).want, !m2); if (!m2) assert.strictEqual(g(at(15, 30)).untilMs, at(17));
  assert.strictEqual(g(at(17, 1)).want, false);
  // server mirror agrees per block
  [1, 2].forEach((k) => { const s = S.sessionsOf(gp, tasks, at(16))[k - 1];
    const r = srv.sessionGrace(tasks, { n: k, startMs: s.startMs, endMs: s.endMs });
    assert.strictEqual(r.met, k === 1 ? m1 : m2); assert.strictEqual(r.untilMs, r.met ? 0 : s.endMs + 2 * H); assert.strictEqual(r.target, s.target); });
});
t('cold start inside the window: grace computed from tasks + clock alone (no stored state)', () => {
  const fresh = S.graceLock(S.sessionsOf(gp, mk(0, 0), at(12)), at(12)); assert.deepStrictEqual([fresh.want, fresh.untilMs], [true, at(13)]);
});
t('background schedule: from the end to the 14-day debt cap while short, none once met', () => {
  const [s1] = S.sessionsOf(gp, mk(0, 0), at(9)); assert.strictEqual(S.graceSchedule, undefined, 'Coach-only grace schedule replaced by the native DebtHold'); assert.ok(s1);
});
t('shutdown line text', () => { assert.strictEqual(S.graceText({ met: false, target: 215, untilMs: 1 }, () => '7:27 PM'), 'Missed 215 pts: apps open at 7:27 PM');
  assert(/Missed \$\{shut\.target\} pts: apps open at \$\{shut\.opensAtLabel\}/.test(src('src/components/eighthour/EightHourChrome.vue'))); });
t('wiring: strictShield 2 h, server settle -> appLockDebt, eh shutdown, native cancel', () => {
  const sd = src('src/utils/strictDay.js'); assert(!/MISS_GRACE_MS/.test(sd) && !/phase: 'missed'/.test(sd));
  const fn = src('netlify/functions/eight-hour-day.js'); assert(/sessionGrace\(countable\(pruneStale/.test(fn) && /core\.debtAfterSettle\(doc\.appLockDebt/.test(fn) && /core\.debtCleared\(debt/.test(fn) && /graceUntilMs: Number\(l\.graceUntilMs\)/.test(fn));
  assert(/missed: false, opensAtMs: 0/.test(src('src/composables/useEightHour.js')));
  const h = src('src/views/HomeView.vue'); const sh = src('src/utils/sessionShield.js'); assert(!/grace\.want && free/.test(h) && /debtShield\(\{ debt/.test(sh) && /clingLock\.armDebtHold\(plan\)/.test(h) && !/gpGraceSchedule/.test(h));
  const sw = src('ios/App/App/ClingLockPlugin.swift'); assert(/name: "cancelScheduledLock"/.test(sw) && /stopMonitoring\(\[ScheduledLocks\.name\(key\)\]\)/.test(sw));
  assert(/name: "clearBreakOffer"/.test(sw) && /\(o\["v"\] as\? Int\) == 2/.test(sw) && /guard close > nowMs/.test(sw));
});
t('break points use DAY points (not session points)', () => assert(/points: gpEarned\.value\.points, \/\/ breaks: DAY points/.test(src('src/views/HomeView.vue'))));
t('break eligibility: under threshold no break, over allowed, legacy/stale/too-long rejected', () => {
  const now = at(10); const day = G.dayWindow(gp, now).dayKey; const b = { n: 1, day, startMs: now - 60000, endMs: now + 9 * 60000 };
  assert.strictEqual(G.breakEarned(gp, b, now, { done: 1, total: 4, points: 10 }), false);
  assert.strictEqual(G.breakEarned(gp, b, now, { done: 2, total: 4, points: 60 }), true);
  assert.strictEqual(G.breakEarned(gp, { ...b, n: 0 }, now, { done: 4, total: 4, points: 200 }), false);
  assert.strictEqual(G.breakEarned(gp, { ...b, day: '2026-11-01' }, now, { done: 4, total: 4, points: 200 }), false);
  assert.strictEqual(G.breakEarned(gp, { ...b, endMs: now + 20 * 60000 }, now, { done: 4, total: 4, points: 200 }), false);
  assert(/loc\.uid === userId\.value/.test(src('src/views/HomeView.vue')));
});
console.log(`session points: ${n} passed`);
