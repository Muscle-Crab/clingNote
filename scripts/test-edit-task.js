// Edit-task tests: estimate chips, live timer adjust (incl. persistence through the patch layer), 8-hour lock, series patch,
// never-complete guard, rollover notice text + once-only, and UI wiring. ZZTEST data only.
// Run: node scripts/test-edit-task.js
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire');
const root = path.join(__dirname, '..'); const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL', name); throw e; } };
const E = sr.load('utils/taskEdit.js');
const R = sr.load('utils/rollover.js');
const { applyTaskPatch } = sr.load('utils/taskPatch.js');
const core = require('../netlify/functions/lib/eightHourCore.js');
const MIN = 60000; const now = Date.UTC(2026, 9, 24, 15, 0, 0);
const running = { title: 'ZZTEST run', createdAt: 'ZZTEST-1', estimateMin: 30, timerActive: true, timerStartedAt: new Date(now - 10 * MIN).toISOString(), timerEndTime: new Date(now + 20 * MIN).toISOString() };
const left = (p) => (new Date(p.timerEndTime).getTime() - now) / MIN;

t('chips', () => assert.deepStrictEqual(E.ESTIMATE_CHIPS, [15, 30, 45, 60, 90]));
t('cleanEstimate', () => { assert.strictEqual(E.cleanEstimate('25'), 25); assert.strictEqual(E.cleanEstimate(-3), 0); assert.strictEqual(E.cleanEstimate('x'), 0); assert.strictEqual(E.cleanEstimate(99999), 1440); });
t('timer +5/+10/+15/-5', () => { assert.strictEqual(left(E.adjustTimerPatch(running, 5, now)), 25); assert.strictEqual(left(E.adjustTimerPatch(running, 15, now)), 35); assert.strictEqual(left(E.adjustTimerPatch(running, -5, now)), 15); });
t('timer never below 1 min', () => assert.strictEqual(left(E.adjustTimerPatch({ ...running, timerEndTime: new Date(now + 2 * MIN).toISOString() }, -5, now)), 1));
t('set remaining', () => { const p = E.setRemainingPatch(running, 42, now); assert.strictEqual(left(p), 42); assert.strictEqual(p.timerDurationMinutes, 52); });
t('estimate change keeps elapsed', () => { assert.strictEqual(left(E.estimateTimerPatch(running, 60, now)), 50); assert.strictEqual(left(E.estimateTimerPatch(running, 5, now)), 1); });
t('estimate change w/o timer: no timer patch', () => assert.deepStrictEqual(E.estimateTimerPatch({ estimateMin: 30 }, 60, now), {}));
t('timer adjust persists via patch layer (reload reads the new end)', () => {
  const stored = [{ title: 'ZZTEST other', createdAt: 'ZZTEST-0' }, { ...running }];
  const out = applyTaskPatch(stored, running, 1, E.adjustTimerPatch(running, 10, now));
  assert.strictEqual(left(out[1]), 30); assert.strictEqual(out[1].timerActive, true); assert.strictEqual(out[1].completed, undefined);
});
t('timer fields are not 8-hour locked; title/estimate are', () => {
  assert.ok(!core.LOCKED_FIELDS.includes('timerEndTime') && !core.LOCKED_FIELDS.includes('timerDurationMinutes'));
  E.EDIT_LOCKED.forEach((f) => assert.ok(core.LOCKED_FIELDS.includes(f), f));
  assert.ok(E.isFieldLocked('title', true) && E.isFieldLocked('estimateMin', true) && !E.isFieldLocked('notes', true) && !E.isFieldLocked('title', false));
  const before = [{ ...running }]; const after = applyTaskPatch(before, running, 0, E.setRemainingPatch(running, 5, now));
  assert.ok(core.lockedChangeAllowed(before, after).ok);
});
t('never completes', () => { const p = E.safeEditPatch({ title: 'ZZTEST', completed: true, completedAt: 'x' }); assert.deepStrictEqual(p, { title: 'ZZTEST' }); });
t('series patch only copies edit fields', () => assert.deepStrictEqual(E.seriesPatch({ title: 'ZZTEST', estimateMin: 45, timerEndTime: 'x', completed: true, notes: 'n' }), { title: 'ZZTEST', estimateMin: 45, notes: 'n' }));

// rollover
t('rollover message', () => {
  assert.strictEqual(R.rolloverMessage(['ZZTEST Wash my car', 'ZZTEST Study for exam', 'ZZTEST Call mom']), '3 tasks moved from yesterday: ZZTEST Wash my car, ZZTEST Study for exam, ZZTEST Call mom');
  assert.strictEqual(R.rolloverMessage(['ZZTEST a']), '1 task moved from yesterday: ZZTEST a');
  assert.strictEqual(R.rolloverMessage(['a', 'b', 'c', 'd', 'e']), '5 tasks moved from yesterday: a, b, c +2 more');
  assert.strictEqual(R.rolloverMessage([]), '');
  assert.strictEqual(R.rolloverNotifBody(['ZZTEST a', 'ZZTEST b']), '2 tasks moved to tomorrow: ZZTEST a, ZZTEST b');
});
t('rollover shown once', () => {
  const mem = {}; const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const tasks = [{ title: 'ZZTEST a', rolledOverFor: '2026-10-23' }, { title: 'ZZTEST b', carriedFrom: '2026-10-23' }, { title: 'ZZTEST c' }, { title: 'ZZTEST done', carriedFrom: '2026-10-23', completed: true }];
  const p = R.pendingRollover(tasks, R.loadSeen(storage, 'ZZTEST'));
  assert.strictEqual(p.tasks.length, 2); assert.ok(p.message.startsWith('2 tasks moved from yesterday'));
  R.markSeen(storage, 'ZZTEST', p.ids);
  assert.strictEqual(R.pendingRollover(tasks, R.loadSeen(storage, 'ZZTEST')), null);
  assert.ok(R.pendingRollover([...tasks, { title: 'ZZTEST new', rolledOverFor: '2026-10-24' }], R.loadSeen(storage, 'ZZTEST')));
  assert.strictEqual(R.pendingRollover(tasks, R.loadSeen(storage, 'ZZTEST-other')).tasks.length, 2); // per user
});

// UI wiring (static)
const card = read('src/components/home/TaskCard.vue'); const home = read('src/views/HomeView.vue');
t('card: pencil, title tap, long-press, chips, timer adjust, lock hint', () => {
  ['data-test="edit-btn"', 'data-test="task-title-edit"', 'onPressStart', "data-test=\"timer-adjust\"", 'data-test="timer-set"', 'data-test="est-custom"', 'data-test="lock-hint"', 'data-test="edit-title"', 'data-test="edit-series"', ':disabled="dayLocked"']
    .forEach((s) => assert.ok(card.includes(s), s));
  assert.ok(!/estimateMin: Number\(\$event\.target\.value\) \|\| 0/.test(card), 'old raw estimate input removed');
});
t('home: handlers wired, rollover stamped + notified', () => {
  ['@edit="toggleExpanded(task)"', '@adjust-timer=', '@set-remaining=', 'editTask(realIndex(task)', 'rolledOverFor: getTodayId()', 'notifyRollover(picked', 'notifyRollover([task.title])', 'data-test="rollover-banner"', 'scheduleLocal(`rollover:']
    .forEach((s) => assert.ok(home.includes(s), s));
  assert.ok(!/editTask[\s\S]{0,1500}completed: true/.test(home.slice(home.indexOf('const editTask'), home.indexOf('const editTask') + 1500)));
});
console.log(`ok - test-edit-task: ${n} checks`);
