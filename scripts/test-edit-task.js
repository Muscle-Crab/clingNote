// Edit-task tests: estimate chips, timer lock once started, 8-hour lock, series patch,
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

t('chips', () => assert.deepStrictEqual(E.ESTIMATE_CHIPS, [15, 30, 45, 60, 90]));
t('cleanEstimate', () => { assert.strictEqual(E.cleanEstimate('25'), 25); assert.strictEqual(E.cleanEstimate(-3), 0); assert.strictEqual(E.cleanEstimate('x'), 0); assert.strictEqual(E.cleanEstimate(99999), 1440); });
t('estimate locked once play pressed (running, paused, finished)', () => {
  assert.strictEqual(E.TIMER_LOCK_HINT, 'Timer locked once started');
  assert.ok(E.timerStarted(running));
  assert.ok(E.timerStarted({ ...running, timerActive: false })); // paused/finished
  assert.ok(!E.timerStarted({ title: 'ZZTEST fresh', estimateMin: 30 })); // before play: editable
});
t('live adjust removed', () => ['TIMER_STEPS', 'adjustTimerPatch', 'setRemainingPatch', 'estimateTimerPatch'].forEach((k) => assert.strictEqual(E[k], undefined, k)));
t('8-hour lock: edits allowed (title/estimate/notes), only points locked', () => {
  E.EDIT_LOCKED.forEach((f) => assert.ok(core.LOCKED_FIELDS.includes(f), f));
  assert.ok(!E.isFieldLocked('title', true) && !E.isFieldLocked('estimateMin', true) && !E.isFieldLocked('notes', true) && E.isFieldLocked('points', true));
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
t('card: pencil, title tap, long-press, chips, timer lock, lock hint', () => {
  ['data-test="edit-btn"', 'data-test="task-title-edit"', 'onPressStart', 'data-test="timer-lock-hint"', 'data-test="est-custom"', 'data-test="lock-hint"', 'data-test="edit-title"', 'data-test="edit-series"']
    .forEach((s) => assert.ok(card.includes(s), s));
  ['timer-adjust', 'timer-set', 'timer-adj-', 'adjust-timer', 'set-remaining'].forEach((k) => assert.ok(!card.includes(k), 'removed ' + k));
  assert.ok(!card.includes(':disabled="estLocked"') && !card.includes(':disabled="dayLocked"')); // lock-in no longer freezes name/estimate
  { const r = E.retimePatch({ timerActive: true, timerEndTime: new Date(600000).toISOString(), timerDurationMinutes: 10 }, 25, 0); assert.strictEqual(new Date(r.timerEndTime).getTime(), 600000 + 15 * 60000); assert.strictEqual(r.timerDurationMinutes, 25); }
  assert.ok(!/estimateMin: Number\(\$event\.target\.value\) \|\| 0/.test(card), 'old raw estimate input removed');
});
t('home: handlers wired, rollover stamped + notified', () => {
  ['@edit="toggleExpanded(task)"', 'if (timerStarted(task)) patch = { ...patch, ...retimePatch(task, patch.estimateMin) };', 'editTask(realIndex(task)', 'rolledOverFor: getTodayId()', 'notifyRollover(picked', 'notifyRollover([task.title])', 'data-test="rollover-banner"', 'scheduleLocal(`rollover:']
    .forEach((s) => assert.ok(home.includes(s), s));
  ['@adjust-timer=', '@set-remaining=', 'adjustRunningTimer'].forEach((k) => assert.ok(!home.includes(k), 'removed ' + k));
  assert.ok(!/editTask[\s\S]{0,1500}completed: true/.test(home.slice(home.indexOf('const editTask'), home.indexOf('const editTask') + 1500)));
});
console.log(`ok - test-edit-task: ${n} checks`);
