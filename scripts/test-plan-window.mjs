// Completing during shutdown + tomorrow's planning window (default 8 PM, hard close at midnight): pure policy tests
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
t('boundary 7:59 PM closed', () => assert.equal(st(30, 19, 59).open, false));
t('boundary 8:00 PM open, tomorrow = Sat', () => { const s = st(30, 20, 0); assert.equal(s.open, true); assert.equal(s.tomorrowDay, 'Sat'); assert.equal(s.eveningKey, '2026-10-30'); });
t('boundary 11:59 PM open', () => assert.equal(st(30, 23, 59).open, true));
t('boundary 12:00 AM hard close', () => assert.equal(st(31, 0, 0).open, false));
t('custom open time 18:30', () => { assert.equal(st(30, 18, 29, '18:30').open, false); assert.equal(st(30, 18, 30, '18:30').open, true); assert.equal(st(31, 0, 0, '18:30').open, false); });
t('not shut -> never "open"', () => assert.equal(P.planWindowState({ nowMs: ny(30, 21, 0), shut: false, tz: TZ }).open, false));
t('auto-opens at most once per evening', () => {
  assert.equal(P.shouldAutoOpen({ open: true, eveningKey: '2026-10-30', seenKey: '' }), true);
  assert.equal(P.shouldAutoOpen({ open: true, eveningKey: '2026-10-30', seenKey: '2026-10-30' }), false);
  assert.equal(P.shouldAutoOpen({ open: true, eveningKey: '2026-10-31', seenKey: '2026-10-30' }), true);
  assert.equal(P.shouldAutoOpen({ open: false, eveningKey: '2026-10-30', seenKey: '' }), false);
});

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
t('guards: planning blocked before 8 PM', () => { at(30, 19, 59); assert.throws(() => L.assertPatchAllowed('Sat', { title: 'x' }), /up/); assert.throws(() => L.assertDayUnlocked('Sat')); assert.equal(L.canPlanDay('Sat'), false); });
t('guards: tomorrow plannable 8 PM..11:59 PM, other days not', () => {
  for (const [h, m] of [[20, 0], [23, 59]]) {
    at(30, h, m); assert.equal(L.canPlanDay('Sat'), true); L.assertPatchAllowed('Sat', { title: 'x' }); L.assertDayUnlocked('Sat');
    L.assertTasksChangeAllowed('Sat', tasks, [...tasks, { id: 'b', title: 'B' }], 'add'); L.assertNotShut();
    assert.throws(() => L.assertPatchAllowed('Fri', { title: 'x' })); assert.throws(() => L.assertTasksChangeAllowed('Mon', tasks, [], 'delete'));
  }
});
t('guards: midnight closes planning, completion still works', () => { at(31, 0, 0); assert.equal(L.planWindowOpen(), false); assert.throws(() => L.assertPatchAllowed('Sat', { title: 'x' })); assert.throws(() => L.assertNotShut()); L.assertPatchAllowed('Sat', { completed: true }); });
t('guards: shut day completes in place', () => { at(30, 21, 0); assert.equal(L.shutDayName(), 'Fri'); assert.equal(L.completionKeepsInPlace({ shutLocked: true }), true); assert.equal(L.completionKeepsInPlace({}), false); });
t('after wake time everything opens again', () => { at(31, 7, 0); assert.equal(L.isShutdown(), false); L.assertPatchAllowed('Fri', { title: 'x' }); });
t('completionOnlyChange: only completion fields may differ', () => {
  assert.equal(L.completionOnlyChange(tasks, done), true);
  assert.equal(L.completionOnlyChange(tasks, [{ ...tasks[0], points: 50 }]), false);
  assert.equal(L.completionOnlyChange(tasks, []), false);
  assert.equal(L.completionOnlyPatch({ completed: true, timerActive: false }), true); assert.equal(L.completionOnlyPatch({ points: 5 }), false);
});
t('pill: planning state', () => { const p = C.pillState({ shut: true, planning: true }); assert.equal(p.main, 'Planning tomorrow'); assert.equal(C.pillState({ shut: true, untilLabel: '7 AM' }).main, 'Shut'); });
t('rules: shut day frozen except in-place, other days writable', () => {
  const r = src('firestore.rules'); assert.ok(/function eightHourShutDay\(uid, dayName\)/.test(r));
  assert.ok((r.match(/!eightHourShutDay\(/g) || []).length >= 3); assert.ok(/lockedDayUnchanged\(\)/.test(r));
});
t('wiring: settings row + chrome + home', () => {
  const pf = src('src/views/Profile.vue'); assert.ok(pf.includes('data-test="plan-time"') && pf.includes('setPlanOpenTime'));
  const ch = src('src/components/eighthour/EightHourChrome.vue'); assert.ok(ch.includes('eh-plan-open') && ch.includes('shouldAutoOpen') && ch.includes('planwin:'));
  const hv = src('src/views/HomeView.vue'); assert.ok(hv.includes('canPlanDay') && hv.includes('goTomorrowTab'));
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
t('wiring: tomorrow tab gets the done check only in the planning window', () => {
  const tc = src('src/components/home/TaskCard.vue'); assert.ok(tc.includes('v-if="isTodayTab || canComplete"'));
  const hv = src('src/views/HomeView.vue'); assert.ok(hv.includes(':can-complete="planningTomorrowTab"') && hv.includes('task.completedFor =') && /keepEarly\(task\) \? task/.test(hv));
});
console.log(`\n${n} plan-window tests passed`);
