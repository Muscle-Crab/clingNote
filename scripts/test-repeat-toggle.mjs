// Repeat fixes (Oct 27): undefined-safe repeat writes, the 🔁 one-tap toggle over both repeat models, stale reminder/date display.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { repeatState, legacyRepeating, legacyPattern, patternOf, onSchedule, offSchedule, toastFor } from '../src/utils/repeatToggle.js';
import { applyTaskSchedule, scheduleOfTask } from '../src/utils/schedEdit.js';
import { dropUndefined } from '../src/utils/firestoreSafe.js';
import { formatShortDate, isReminderPast, showReminder } from '../src/utils/dateTime.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const TODAY = '2026-10-27'; // a Tuesday
// Shape of the real user's tasks (read-only prod check): legacy 'recurring', no repeatDays, no status, string createdAt.
const legacy = { title: 'Shave', type: 'recurring', createdAt: '2025-06-01T10:00:00.000Z', completed: false, points: 15 };

t('dropUndefined removes undefined deeply and keeps null / Dates', () => {
  const d = new Date(0);
  assert.deepEqual(dropUndefined({ a: 1, status: undefined, r: { x: undefined, y: null }, l: [1, undefined, { z: undefined }], d }), { a: 1, r: { y: null }, l: [1, {}], d });
});
t('setTaskRepeat writes are undefined-safe and status defaults to todo (root cause of "Could not update the repeat setting")', () => {
  const src = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('const setTaskRepeat = async'), src.indexOf('const setTaskRepeat = async') + 4000);
  assert.match(fn, /tasks: next\.map\(dropUndefined\)/);
  assert.match(fn, /status: !base\.status \|\| base\.status === 'done' \? 'todo' : base\.status/);
  assert.match(fn, /isShutdown\(\)/);
  assert.match(fs.readFileSync(new URL('../src/firebaseConfig.js', import.meta.url), 'utf8'), /initializeFirestore\(app, \{ ignoreUndefinedProperties: true \}\)/);
});
t('repeatState: legacy and v2 both count as on; plain task is off', () => {
  assert.equal(legacyRepeating(legacy), true);
  assert.deepEqual(repeatState(legacy, [], TODAY), { on: true, model: 'legacy', label: 'Repeats daily' });
  assert.equal(repeatState({ ...legacy, type: 'one-time', repeatDays: [] }, [], TODAY).on, false);
  assert.equal(repeatState({ title: 'x', repeatDays: ['Mon', 'Wed'] }, [], TODAY).label, 'Repeats Mon Wed');
  const list = [{ id: 'T1', title: 'Run', recurrence: { freq: 'weekly', days: [1, 3] }, startDate: '2026-10-01' }];
  const occ = { title: 'Run', type: 'one-time', templateId: 'T1', createdAt: 'c' };
  assert.deepEqual(repeatState(occ, list, TODAY), { on: true, model: 'v2', label: 'Every Mon, Wed' });
  assert.equal(repeatState(occ, [{ ...list[0], stopped: true }], TODAY).on, false);
  assert.equal(repeatState(occ, [{ ...list[0], recurrence: { ...list[0].recurrence, until: '2026-10-26' } }], TODAY).on, false, 'series ended yesterday');
});
t('turn ON: last pattern or daily; weekly always includes today', () => {
  assert.equal(onSchedule({ title: 'a' }, TODAY).repeat, 'daily');
  const s = onSchedule({ title: 'a', lastRepeat: { repeat: 'weekly', days: [1, 3] } }, TODAY);
  assert.deepEqual([s.repeat, s.days], ['weekly', [1, 2, 3]]);
  assert.equal(onSchedule({ title: 'a', lastRepeat: { repeat: 'weekly', days: [] } }, TODAY).repeat, 'daily', 'invalid last pattern -> daily');
  assert.deepEqual(legacyPattern({ repeatDays: ['Mon', 'Fri'] }), { repeat: 'weekly', days: [1, 5] });
  assert.equal(toastFor(true, { repeat: 'daily', days: [] }), 'Repeats daily');
});
t('ON via v2 links today\'s task to a new series; the sheet then shows the same pattern', () => {
  const task = { title: 'Read', type: 'one-time', createdAt: 'c1', completed: false };
  const r = applyTaskSchedule({ list: [], task, sched: onSchedule(task, TODAY), dayDate: TODAY });
  assert.ok(!r.error && r.list.length === 1 && r.task.templateId === r.list[0].id);
  assert.equal(r.task.createdAt, 'c1', 'same day-list task (createdAt kept: lock rules stay happy)');
  assert.deepEqual(repeatState(r.task, r.list, TODAY).on, true);
  assert.equal(scheduleOfTask(r.task, r.list, TODAY).repeat, 'daily');
  // OFF: series ends today, today's task stays (plain), pattern remembered for the next ON
  const last = patternOf(r.task, r.list, TODAY);
  const off = applyTaskSchedule({ list: r.list, task: r.task, sched: offSchedule(TODAY), dayDate: TODAY });
  assert.ok(off.task && !off.task.templateId && off.task.title === 'Read');
  assert.equal(off.list[0].recurrence.until, TODAY);
  assert.equal(repeatState(off.task, off.list, TODAY).on, false);
  assert.deepEqual(last, { repeat: 'daily', days: [], dayOfMonth: '' });
});
t('reminder display: YYYY-MM-DD is a local date; past one-off reminders are hidden', () => {
  assert.equal(formatShortDate('2025-07-08'), 'Jul 8'); // was "Jul 7" (UTC parse) on US devices
  const now = new Date(2026, 9, 27, 9, 0);
  assert.equal(isReminderPast({ date: '2025-07-08', time: '21:29', repeat: '' }, now), true);
  assert.equal(showReminder({ date: '2025-07-08', time: '21:29', repeat: '' }, now), false);
  assert.equal(showReminder({ date: '2026-10-27', time: '21:29', repeat: '' }, now), true);
  assert.equal(showReminder({ date: '2025-07-08', time: '21:29', repeat: 'daily' }, now), true, 'repeating reminders stay');
});
t('TaskCard: 🔁 is a 44pt toggle button with aria-pressed / aria-label; chrome pill tucks away on scroll', () => {
  const card = fs.readFileSync(new URL('../src/components/home/TaskCard.vue', import.meta.url), 'utf8');
  assert.match(card, /class="task-repeat-toggle"[^>]*data-test="repeat-toggle"/);
  assert.match(card, /:aria-pressed=/); assert.match(card, /:aria-label="repeatInfo\.on/);
  assert.match(card, /\.task-repeat-toggle \{[^}]*width: 44px; height: 44px;/);
  const chrome = fs.readFileSync(new URL('../src/components/eighthour/EightHourChrome.vue', import.meta.url), 'utf8');
  assert.match(chrome, /'ehp--tucked': tucked/);
});
console.log(`repeat toggle: ${n} passed`);
