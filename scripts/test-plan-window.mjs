// Completing and planning during shutdown (between sessions; no clock window): pure policy tests
import assert from 'assert'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, '..'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planwin-'));
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
fs.writeFileSync(path.join(dir, 'vue.mjs'), 'export const reactive = (o) => o;\n');
fs.writeFileSync(path.join(dir, 'planWindow.mjs'), src('src/utils/planWindow.js').replace("from 'vue'", "from './vue.mjs'"));
fs.writeFileSync(path.join(dir, 'eightHour.mjs'), src('src/utils/eightHour.js').replace("'../../netlify/functions/lib/eightHourCore.js'", JSON.stringify(path.join(root, 'netlify/functions/lib/eightHourCore.js'))));
fs.writeFileSync(path.join(dir, 'eightHourLock.mjs'), src('src/utils/eightHourLock.js').replace("'./eightHour'", "'./eightHour.mjs'").replace("'./planWindow'", "'./planWindow.mjs'"));
fs.writeFileSync(path.join(dir, 'eightHourChrome.mjs'), src('src/utils/eightHourChrome.js'));
fs.writeFileSync(path.join(dir, 'localDate.mjs'), src('src/utils/localDate.js'));
const D = await import(path.join(dir, 'localDate.mjs'));
const P = await import(path.join(dir, 'planWindow.mjs')); const L = await import(path.join(dir, 'eightHourLock.mjs')); const C = await import(path.join(dir, 'eightHourChrome.mjs'));
let n = 0; const t = (name, fn) => { try { fn(); n++; console.log('ok ', name); } catch (e) { console.error('FAIL', name); throw e; } };
const TZ = 'America/New_York';
const ny = (d, h, m) => Date.UTC(2026, 9, d, h + 4, m); // Oct 2026 = EDT (UTC-4)
// Friday Oct 30: lock-in 07:00-15:00, shut until Saturday 07:00.
const lock = { dayName: 'Fri', dayKey: '2026-10-30', tz: TZ, wakeTime: '07:00', hours: 8, startMs: ny(30, 7, 0), endMs: ny(30, 15, 0) };
let now = 0; L.setLockSource(() => ({ lock, nowMs: now }));
const at = (d, h, m) => { now = ny(d, h, m); };
const st = (d, h, m, planTime) => P.planWindowState({ nowMs: ny(d, h, m), shut: true, planTime, tz: TZ });

t('default plan time is 8:00 PM', () => { assert.equal(P.PLAN_OPEN_DEFAULT, '20:00'); assert.equal(P.planTimeOrDefault('bad'), '20:00'); assert.equal(P.planTimeOrDefault('18:30'), '18:30'); });
// Start anytime: no 8 PM window and no midnight close. While shut (a session ended, no new one yet) planning is open.
t('no clock window: open any time while shut', () => { for (const [d, h, m] of [[30, 15, 1], [30, 19, 59], [30, 20, 0], [31, 0, 0], [31, 6, 59]]) assert.equal(st(d, h, m).open, true); });
t('plan time is ignored', () => { assert.equal(st(30, 16, 0, '18:30').open, true); });
t('not shut -> never "open"', () => assert.equal(P.planWindowState({ nowMs: ny(30, 21, 0), shut: false, tz: TZ }).open, false));
t('planning targets the current day (the next session), keyed per session', () => { const s = P.planWindowState({ nowMs: ny(30, 16, 0), shut: true, tz: TZ, key: 'k1' }); assert.equal(s.tomorrowDay, 'Fri'); assert.equal(s.eveningKey, 'k1'); });
t('planning never auto-opens', () => { const ch = src('src/components/eighthour/EightHourChrome.vue'); assert.ok(!ch.includes('shouldAutoOpen') && !ch.includes('planwin:')); });

const tasks = [{ id: 'a', title: 'A', points: 10, completed: false, createdAt: 1 }];
const done = [{ ...tasks[0], completed: true, completedAt: 5 }];
t('guards: completion works while shut on any day, any time', () => {
  for (const [d, h, m] of [[30, 16, 0], [30, 21, 0], [31, 0, 0], [31, 6, 59]]) {
    at(d, h, m); assert.equal(L.isShutdown(), true);
    for (const day of ['Fri', 'Sat', 'Mon']) {
      L.assertPatchAllowed(day, { completed: true, completedAt: now });
      L.assertTasksChangeAllowed(day, tasks, done, 'complete');
    }
  }
});
t('guards: planning allowed on every day while shut, any time', () => {
  for (const [d, h, m] of [[30, 15, 30], [30, 23, 59], [31, 3, 0]]) {
    at(d, h, m); assert.equal(L.isShutdown(), true);
    for (const day of ['Fri', 'Sat', 'Mon']) { assert.equal(L.canPlanDay(day), true); L.assertPatchAllowed(day, { title: 'x' }); L.assertDayUnlocked(day); L.assertTasksChangeAllowed(day, tasks, [...tasks, { id: 'b', title: 'B' }], 'add'); }
    L.assertNotShut();
  }
});
t('shut message has no "come back tomorrow"', () => { assert.ok(!/tomorrow/i.test(L.SHUT_MESSAGE)); assert.ok(/Start a new session/.test(L.shutMessage())); });
t('guards: shut day completes in place', () => { at(30, 21, 0); assert.equal(L.shutDayName(), 'Fri'); assert.equal(L.completionKeepsInPlace({ shutLocked: true }), true); assert.equal(L.completionKeepsInPlace({}), false); });
t('shut is state-based: still shut the next morning (no wake time), ends when a new session starts', () => { at(31, 7, 0); assert.equal(L.isShutdown(), true); const l2 = { ...lock, startMs: ny(31, 7, 0), endMs: ny(31, 15, 0), dayKey: '2026-10-31', dayName: 'Sat' }; L.setLockSource(() => ({ lock: l2, nowMs: now })); assert.equal(L.isShutdown(), false); L.setLockSource(() => ({ lock, nowMs: now })); });
t('completionOnlyChange: only completion fields may differ', () => {
  assert.equal(L.completionOnlyChange(tasks, done), true);
  assert.equal(L.completionOnlyChange(tasks, [{ ...tasks[0], points: 50 }]), false);
  assert.equal(L.completionOnlyChange(tasks, []), false);
  assert.equal(L.completionOnlyPatch({ completed: true, timerActive: false }), true); assert.equal(L.completionOnlyPatch({ points: 5 }), false);
});
t('pill: no planning state any more', () => { assert.equal(C.pillState({ shut: true, planning: true }).main, 'Shut'); assert.equal(C.pillState({ shut: true, untilLabel: '7 AM' }).main, 'Shut'); });
t('rules: shut day frozen except in-place, other days writable', () => {
  const r = src('firestore.rules'); assert.ok(/function dayFrozen\(lk, dayName\)[\s\S]*?shutUntil/.test(r));
  assert.ok((r.match(/!dayFrozen\(eightHourLock\(/g) || []).length >= 2); assert.ok(/lockedDayUnchanged\(\)/.test(r));
});
t('wiring: settings row + chrome + home', () => {
  const pf = src('src/views/Profile.vue'); assert.ok(pf.includes('v-if="false" class="pf-row pf-row--divided" data-test="plan-time-row"'), 'plan time row hidden');
  const ch = src('src/components/eighthour/EightHourChrome.vue'); assert.ok(!ch.includes('eh-plan-open') && !ch.includes('Plan next session') && !ch.includes('eh-sched-open') && ch.includes('Start next session'));
  assert.ok(/startNextSession\(sch\.hours\)/.test(ch) && /SESSION_HOUR_OPTIONS/.test(ch) && !/HOUR_OPTIONS\.filter/.test(ch) && !/type="time"|type="date"/.test(ch), 'only whole hours 5..12, starts now');
  assert.ok(/requirePro\(router, 'lockIn'\)/.test(ch) && /openLockPaywall\(/.test(ch), 'Start next session opens the paywall when Pro is required');
  const hv = src('src/views/HomeView.vue'); assert.ok(hv.includes('canPlanDay') && !hv.includes('goTomorrowTab') && !hv.includes('planWin'));
  assert.ok(!/const toggleTaskCompletion[\s\S]{0,400}blockIfShut\(/.test(hv), 'completion must not be blocked by shutdown');
});
t('early completion of tomorrow is kept at the rollover (completedFor), old ones still reset', () => {
  const fri = new Date(2026, 9, 30, 21, 0), sat = new Date(2026, 9, 31, 9, 0), nextSat = new Date(2026, 10, 7, 9, 0);
  const early = { completed: true, completedAt: fri.toISOString(), completedFor: '2026-10-31' };
  assert.equal(D.isStaleCompletion(early, 6, fri), false); assert.equal(D.isStaleCompletion(early, 6, sat), false);
  assert.equal(D.isStaleCompletion(early, 6, nextSat), true);
  assert.equal(D.isStaleCompletion({ completed: true, completedAt: fri.toISOString() }, 6, sat), true, 'without completedFor a Friday completion is stale on Saturday');
  assert.ok(L.COMPLETION_FIELDS.includes('completedFor'));
});
t('wiring: no planning window, tomorrow tab is not opened from the shutdown screen', () => {
  const hv = src('src/views/HomeView.vue'); assert.ok(!hv.includes('planningTomorrowTab') && hv.includes('task.completedFor =') && /keepEarly\(task\) \? task/.test(hv));
});
console.log(`\n${n} plan-window tests passed`);
