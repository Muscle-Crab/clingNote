// Server-side render smoke test: renders each src/components/home component with sample props and checks the HTML.
// Catches runtime template errors (undefined props/helpers) without a browser. Run: node scripts/smoke-render.js
const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const { parse, compileScript } = require('@vue/compiler-sfc');
const src = path.join(__dirname, '..', 'src');

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('@/')) req = path.join(src, req.slice(2));
  return origResolve.call(this, req, ...rest);
};
const toCjs = (code, filename) => babel.transformSync(code, { filename, babelrc: false, configFile: false, presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' }, modules: 'commonjs' }]] }).code;
require.extensions['.vue'] = (mod, filename) => {
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'), { filename });
  const out = compileScript(descriptor, { id: 'smoke', inlineTemplate: true });
  mod._compile(toCjs(out.content, filename), filename);
};
for (const ext of ['.svg', '.png', '.jpg', '.mp3', '.css']) require.extensions[ext] = (mod, filename) => { mod.exports = filename; }; // assets: stub
const origJs = require.extensions['.js'];
require.extensions['.js'] = (mod, filename) => {
  if (filename.startsWith(src)) mod._compile(toCjs(fs.readFileSync(filename, 'utf8'), filename), filename);
  else origJs(mod, filename);
};

const pending = []; let failedAsync = false; // async test blocks register here; the runner awaits them before exiting
const { createSSRApp } = require('vue');
const { renderToString } = require('@vue/server-renderer');
const load = (n) => { const m = require(path.join(src, 'components/home', n + '.vue')); return m.default || m; };

const days = [{ day: 'Sun', date: '2026-10-11' }, { day: 'Mon', date: '2026-10-12' }];
const task = { title: 'Write report', createdAt: '2026-10-17T10:00:00Z', completed: false, important: true, priority: 'high', status: 'in-progress',
  dueDate: '2026-10-20', estimateMin: 30, startTime: '09:00', nextAction: 'Open doc', notes: 'n', labels: ['Work'],
  subtasks: [{ id: 'a', title: 'Outline', done: true }, { id: 'b', title: 'Draft', done: false }], autoCompleteParent: true,
  timerActive: true, timerEndTime: new Date(Date.now() + 90000).toISOString(), youtubeURL: 'https://youtu.be/abcdefghijk' };
const milestones = [{ percent: 0, position: 0, icon: 'a' }, { percent: 50, position: 50, icon: 'b' }, { percent: 100, position: 100, icon: 'c' }];
const cases = [
  ['DayTabs', { days, selectedIndex: 0 }, ['Sun']],
  ['ProgressBar', { percentage: 40, milestones }, ['40%']],
  ['StreakHeader', { streak: 4, motivationalMessage: 'Go', pointsAccumulated: 10, totalPoints: 30, daySession: { started: true, ended: false, startedAtText: '9:00 AM' } }, ['4', '20 pts']],
  ['TimeStatsBar', { stats: { totalDayTime: '1h', productiveTime: '2m', gapTime: '3m', completedTasks: 2, missedTasks: 1 } }, ['1h']],
  ['ShutdownPrompt', { suggest: true, open: true, done: [task], openTasks: [{ ...task, completed: false }], carry: { 'x': true } }, ['Shutdown', 'Write report', 'shutdown-cancel', 'Cancel']],
  ['WorkoutModal', { preferences: { goal: 'Lose Fat', equipment: 'None', maxPerDay: 3, duration: 20 } }, ['Customize Workout']],
  ['CelebrationOverlay', { streak: 3 }, ['All done']],
  ['TimerModal', { hours: 0, minutes: 5 }, ['Set Timer']],
  ['WontDoModal', { reason: '' }, ['Won']],
  ['TransferModal', { day: null, days, selectedDayIndex: 0 }, ['Mon', 'Oct 12']],
  ['AddTaskModal', { newTask: { title: '', status: 'in-progress', priority: 'low', selectedDays: [], reminder: {}, position: 0, labels: '', notes: '' }, repeatMode: 'weekly', showAdvanced: true, days, selectedDayRoutine: [task], error: 'oops', capWarning: true }, ['New task', 'role="dialog"', 'aria-modal="true"', 'oops', 'Status', 'In progress', 'Waiting']],
  ['YouTubeModal', { url: '' }, ['Attach video']],
  ['TaskDetailModal', { task, activeLabels: ['Work'] }, ['Write report', 'embed/abcdefghijk']],
  ['ImagePreview', { src: 'x.png' }, ['x.png']],
  ['ReminderModal', { reminder: { date: '', time: '', repeat: '' }, taskTitle: 'T1' }, ['T1']],
  ['VoiceModal', { transcript: 'hello' }, ['hello', 'Listening', 'role="dialog"'], ['not supported']],
  ['VoiceModal', { supported: false }, ['t supported', 'Close'], ['Listening']],
  ['VoiceModal', { error: 'Microphone access was blocked.' }, ['Microphone access was blocked.', 'role="alert"'], ['Speak your task']],
  ['LoadSummary', { load: { minutes: 90, count: 2, unestimated: 1, level: 'full', hint: 'Full day' }, expanded: false }, ['1h 30m', 'Full day']],
  ['TimeBlockSchedule', { schedule: { blocks: [{ task, start: 540, end: 570, conflict: true }], unscheduled: [] } }, ['9:00 AM', 'overlaps another']],
  ['IdleState', {}, ['Idle time']],
  ['WontDoList', { tasks: [{ title: 'Skip me', wontDoReason: 'busy' }] }, ['Skip me', 'busy']],
  ['FabButtons', { userId: 'u1', listening: true }, ['fab-add']],
  ['SubtaskList', { task }, ['Outline', '(1/2)']],
  ['TaskCard', { task, index: 0, isTodayTab: true, expanded: true, activeLabels: [], now: Date.now(), showNotification: true, transferNotification: 'moved' }, ['Write report', '1/2', 'Outline', 'task-expand', 'data-test="timer-ring"', 'moved', 'Saved', 'Add a subtask', 'Auto-complete task', 'Next action', 'Estimate (min)', 'chip--subtasks', 'Delete', 'task-chevron', 'aria-label="Show details"', 'aria-expanded="true"', 'task-chevron--open', 'aria-label="Delete task"', 'aria-label="Add reminder"', 'aria-label="Transfer to another day"', 'aria-label="Attach video"', 'aria-label="Attach file"', 'aria-label="Mark as won', 'aria-pressed="true"']],
  ['TaskListHeader', { completed: 1, total: 3, soundEnabled: true, showCompleted: false }, ['1/3', 'Sounds on', 'aria-pressed="true"', 'aria-label="Sounds"']],
  ['EmptyState', {}, ['Nothing here yet'], ['Add task']],
  ['EmptyState', { showAdd: true }, ['Nothing here yet', 'empty-add', 'Add task']],
  ['TaskListHeader', { completed: 0, total: 1, prefs: { sort: 'priority', filter: 'waiting' } }, ['aria-label="Sort and filter"', 'sort-btn--active']],
  ['ScheduledList', { todayStr: '2026-10-17', tasks: [{ id: 'a', title: 'Pay rent', scheduledDate: '2026-10-18', scheduledTime: '09:30' }, { id: 'b', title: 'Dentist', scheduledDate: '2026-10-25', scheduledTime: '' }] }, ['Scheduled', 'sched-count', '>2<', 'aria-expanded="false"']],
  ['TaskListHeader', { label: 'Monday', isToday: false, completed: 0, total: 2 }, ['Monday', '0/2'], ['Sort and filter', 'Show completed', 'Sounds']],
  ['DayTabs', { days: [{ day: 'Sat', date: '2026-10-17' }], selectedIndex: 0, scheduledCounts: { '2026-10-17': 2 } }, ['day-tab-dot', '2 scheduled', '>17<']],
  ['TaskCard', { task: { ...task, type: 'one-time' }, index: 0, isTodayTab: true, expanded: true, activeLabels: [], now: 0 }, ['Schedule for later', 'Schedule date']],
  ['TaskCard', { task: { ...task, type: 'recurring' }, index: 0, isTodayTab: true, expanded: true, activeLabels: [], now: 0 }, ['task-expand'], ['Schedule for later']],
  ['StartDayPrompt', {}, ['Start Day']],
  // collapsed card with subtasks: n/m chip stays visible, editor + subtask input are not rendered
  ['TaskCard', { task, index: 0, isTodayTab: true, expanded: false, activeLabels: [], now: 0 }, ['1/2', 'chip--subtasks', 'task-chevron', 'aria-label="Show details"', 'aria-expanded="false"'], ['task-expand', 'Add a subtask', 'task-chevron--open']],
  ['TaskCard', { task, index: 0, isTodayTab: true, dragDisabled: true, expanded: false, activeLabels: [], now: 0 }, ['drag-handle--disabled', 'Reordering is off']],
  ['TaskCard', { task, index: 0, isTodayTab: true, expanded: false, activeLabels: [], now: 0 }, ['Drag to reorder'], ['drag-handle--disabled']],
  ['TaskCard', { task: { title: 'Old task', completed: true }, index: 2, isTodayTab: true, expanded: false, activeLabels: [], now: 0 }, ['Old task', 'Complete']],
];
// subtask helpers (pure logic)
const assert = require('assert');
const st = require(path.join(src, 'utils/subtasks.js'));
(() => {
  let l = st.addSubtask(undefined, '  a ');
  assert.strictEqual(l.length, 1); assert.strictEqual(l[0].title, 'a'); assert.strictEqual(l[0].done, false);
  assert.strictEqual(st.addSubtask(l, '   ').length, 1, 'blank ignored');
  l = st.addSubtask(l, 'b'); const [a, b] = l;
  assert.notStrictEqual(a.id, b.id);
  assert.deepStrictEqual(st.subtaskProgress({ subtasks: st.toggleSubtask(l, a.id) }), { done: 1, total: 2 });
  assert.deepStrictEqual(st.subtaskProgress({}), { done: 0, total: 0 }, 'old tasks without subtasks');
  assert.strictEqual(st.renameSubtask(l, b.id, 'c')[1].title, 'c');
  assert.strictEqual(st.removeSubtask(l, a.id).length, 1);
  const all = l.map((x) => ({ ...x, done: true }));
  assert.strictEqual(st.shouldAutoComplete({ subtasks: all, autoCompleteParent: true }), true);
  assert.strictEqual(st.shouldAutoComplete({ subtasks: all }), false, 'default off');
  assert.strictEqual(st.shouldAutoComplete({ subtasks: all, autoCompleteParent: true, completed: true }), false);
  assert.strictEqual(st.shouldAutoComplete({ subtasks: [], autoCompleteParent: true }), false, 'needs >=1 subtask');
  assert.strictEqual(st.resetSubtasks({ subtasks: all }).subtasks.every((x) => !x.done), true);
  const tp = require(path.join(src, 'utils/taskPlanning.js'));
  assert.strictEqual(tp.activeCount([{ subtasks: all }, { completed: true }]), 1, 'subtasks do not count toward cap');
  console.log('ok   utils/subtasks');
})();
// rapid day switching can leave the routine undefined: every pure consumer must tolerate it
(() => {
  const ds = require(path.join(src, 'utils/dayStats.js'));
  const tp = require(path.join(src, 'utils/taskPlanning.js'));
  for (const bad of [undefined, null]) {
    assert.strictEqual(tp.loadSummary(bad).count, 0);
    assert.deepStrictEqual(tp.buildSchedule(bad).blocks, []);
    assert.strictEqual(ds.completionPercentage(bad, 0, new Date().getDay()), 0);
    assert.strictEqual(ds.computeTimeStats(undefined, bad, 0).completedTasks, 0);
    assert.strictEqual(ds.computeTimeStats({ startTime: Date.now() - 60000 }, bad, 1).completedTasks, 0);
  }
  console.log('ok   undefined-routine guards');
})();
// scheduled-task persistence: must live on the existing users/{uid} doc, merge-only, never a new collection
(() => {
  const code = fs.readFileSync(path.join(src, 'composables/useScheduledTasks.js'), 'utf8');
  assert.ok(/doc\(db, 'users', userId\)/.test(code), 'scheduled tasks use users/{uid}');
  assert.ok(!/'scheduledTasks'\s*,\s*userId/.test(code), 'no scheduledTasks collection');
  const sets = code.match(/setDoc\([^;]*;/g) || [];
  assert.ok(sets.filter((x) => x.includes('weeklyRoutines')).length === 1, 'one weeklyRoutines write');
  assert.ok(sets.filter((x) => !x.includes('weeklyRoutines')).every((x) => x.includes('merge: true')), 'users doc writes are merge-only');
  assert.ok(/scheduledTasks: _omit/.test(fs.readFileSync(path.join(src, 'views/Profile.vue'), 'utf8')), 'Profile does not write back stale scheduledTasks');
  console.log('ok   scheduled persistence location');
})();
// scheduling helpers (pure logic): materialization must be idempotent and never touch future/materialized entries
(() => {
  const sc = require(path.join(src, 'utils/scheduling.js'));
  const today = '2026-10-17', nowIso = '2026-10-17T12:00:00.000Z';
  assert.ok(sc.isValidDate('2026-02-28') && !sc.isValidDate('2026-02-30') && !sc.isValidDate('26-1-1') && !sc.isValidDate(undefined));
  assert.ok(sc.isValidTime('09:05') && !sc.isValidTime('9:5') && !sc.isValidTime('24:00'));
  assert.strictEqual(sc.buildScheduledEntry({ title: ' ' }, today, ''), null, 'blank title');
  assert.strictEqual(sc.buildScheduledEntry({ title: 'x' }, 'nope', ''), null, 'bad date');
  const mk = (title, date, time, id) => sc.buildScheduledEntry({ title, priority: 'high', labels: ['a'] }, date, time, id);
  const list = [mk('past', '2026-10-10', '', 'p'), mk('now', today, '08:30', 'n'), mk('later', '2026-10-19', '', 'l')] // Mon of next week (2026-10-17 is a Saturday);
  assert.deepStrictEqual(sc.dueOf(list, today).map((e) => e.id), ['p', 'n']);
  assert.deepStrictEqual(sc.futureOf(list, today).map((e) => e.id), ['l']);
  const r1 = sc.materializeDue({ scheduled: list, todayStr: today, todayTasks: [{ title: 'existing', createdAt: 'c' }], nowIso });
  assert.strictEqual(r1.toAdd.length, 2); assert.ok(r1.changed);
  const [tp, tn] = r1.toAdd;
  assert.strictEqual(tp.type, 'one-time'); assert.strictEqual(tp.completed, false); assert.strictEqual(tp.scheduledId, 'p'); assert.strictEqual(tp.priority, 'high');
  assert.strictEqual(tp.reminder, undefined, 'no time -> no reminder');
  assert.deepStrictEqual(tn.reminder, { date: today, time: '08:30', repeat: '' }); assert.strictEqual(tn.startTime, '08:30');
  assert.notStrictEqual(sc.toTodayTask(list[0], today, 'x').createdAt, undefined);
  assert.notStrictEqual(tp.createdAt, tn.createdAt, 'unique createdAt keeps taskKey unique');
  assert.strictEqual(r1.scheduled.find((e) => e.id === 'l').materializedAt, undefined, 'future untouched');
  assert.ok(r1.scheduled.filter((e) => e.id !== 'l').every((e) => e.materializedAt === nowIso));
  // second run on updated data adds nothing
  const r2 = sc.materializeDue({ scheduled: r1.scheduled, todayStr: today, todayTasks: r1.toAdd, nowIso });
  assert.strictEqual(r2.toAdd.length, 0); assert.strictEqual(r2.changed, false);
  // crash between writes: today's doc has the task but the entry is not marked -> not duplicated, gets marked
  const r3 = sc.materializeDue({ scheduled: list, todayStr: today, todayTasks: r1.toAdd, nowIso });
  assert.strictEqual(r3.toAdd.length, 0); assert.ok(r3.changed); assert.ok(r3.scheduled.filter((e) => e.id !== 'l').every(sc.isMaterialized));
  assert.strictEqual(sc.materializeDue({ scheduled: undefined, todayStr: today, todayTasks: undefined, nowIso }).toAdd.length, 0);
  // grouping, counts, edit, remove, prune
  const f = [mk('b', '2026-10-20', '14:00', '1'), mk('a', '2026-10-20', '09:00', '2'), mk('c', '2026-10-19', '', '3')];
  assert.deepStrictEqual(sc.futureOf(f, today).map((e) => e.id), ['3', '2', '1']);
  assert.deepStrictEqual(sc.groupByDate(sc.futureOf(f, today)).map((g) => [g.date, g.tasks.length]), [['2026-10-19', 1], ['2026-10-20', 2]]);
  assert.deepStrictEqual(sc.countsByDate(f, today), { '2026-10-19': 1, '2026-10-20': 2 });
  assert.strictEqual(sc.rescheduleEntry(f, '1', '2026-11-01', '07:00').find((e) => e.id === '1').scheduledDate, '2026-11-01');
  assert.strictEqual(sc.rescheduleEntry(f, '1', 'bad', '').find((e) => e.id === '1').scheduledDate, '2026-10-20', 'invalid date ignored');
  assert.strictEqual(sc.removeScheduled(f, '1').length, 2);
  const old = { ...mk('o', today, '', 'o'), materializedAt: '2026-01-01T00:00:00.000Z' };
  assert.strictEqual(sc.pruneMaterialized([old, ...f], nowIso).length, 3);
  assert.strictEqual(sc.countsByDate([old], today)['2026-10-17'], undefined, 'materialized not shown');
  assert.strictEqual(sc.formatScheduledDate('2026-10-18', today), 'Tomorrow');
  // week strip: real dates per tab index (Sat 2026-10-17 -> Sun 10-11 .. Sat 10-17), month/year rollover, dot lookup
  assert.deepStrictEqual(sc.weekDates(new Date(2026, 9, 17, 23, 30)), ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
  assert.deepStrictEqual(sc.weekDates(new Date(2026, 9, 11)).slice(0, 2), ['2026-10-11', '2026-10-12'], 'Sunday is index 0');
  assert.deepStrictEqual(sc.weekDates(new Date(2026, 11, 31)), ['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  const wd = sc.withWeekDates([{ day: 'Sun', date: '' }, { day: 'Mon', date: '' }, { day: 'Tue', date: '' }, { day: 'Wed', date: '' }, { day: 'Thu', date: '' }, { day: 'Fri', date: '' }, { day: 'Sat', date: '' }], new Date(2026, 9, 17));
  assert.strictEqual(wd[0].date, '2026-10-11'); assert.strictEqual(wd[0].day, 'Sun');
  const wc = sc.countsByDate([mk('x', '2026-10-17', '', 'x1'), mk('y', '2026-10-13', '', 'y1')], '2026-10-12');
  assert.ok(wd.filter((d) => wc[d.date]).map((d) => d.day).join() === 'Tue,Sat', 'dots on Tue and Sat');
  console.log('ok   utils/scheduling');
})();
// Today sort/filter helpers (pure logic)
(() => {
  const tv = require(path.join(src, 'utils/taskView.js'));
  const T = [
    { title: 'a', priority: 'low', status: 'waiting', startTime: '11:00' },
    { title: 'b', priority: 'high', startTime: '09:00' },
    { title: 'c', priority: 'medium', status: 'in-progress' },
    { title: 'd', priority: 'high', status: 'todo', startTime: '09:00', completed: true },
    { title: 'e' },
  ];
  const titles = (p) => tv.viewTasks(T, p).map((i) => i.task.title).join('');
  assert.strictEqual(titles({}), 'abcde', 'default = manual');
  assert.strictEqual(titles({ sort: 'bogus', filter: 'bogus' }), 'abcde', 'invalid prefs -> defaults');
  assert.strictEqual(titles(undefined), 'abcde');
  assert.strictEqual(titles({ sort: 'start' }), 'bdace', 'start time, missing last, stable');
  assert.strictEqual(titles({ sort: 'priority' }), 'bdcae', 'priority, stable, missing last');
  assert.strictEqual(titles({ sort: 'status' }), 'cbdea', 'status: in-progress, todo(default), waiting');
  assert.strictEqual(titles({ filter: 'todo' }), 'bde', 'filter keeps completed for Show completed, default status = todo');
  assert.strictEqual(titles({ filter: 'waiting', sort: 'priority' }), 'da');
  assert.deepStrictEqual(tv.viewTasks(T, { sort: 'priority' }).map((i) => i.index), [1, 3, 2, 0, 4], 'original indexes preserved');
  assert.strictEqual(T[0].title, 'a'); assert.strictEqual(T.length, 5, 'input not mutated');
  assert.deepStrictEqual(tv.viewTasks(undefined, {}), []); assert.deepStrictEqual(tv.viewTasks(null, { sort: 'start' }), []);
  assert.strictEqual(tv.visibleCount(tv.viewTasks(T, {}), false), 4); assert.strictEqual(tv.visibleCount(tv.viewTasks(T, {}), true), 5);
  assert.ok(tv.canReorder({}) && !tv.canReorder({ sort: 'start' }) && !tv.canReorder({ filter: 'todo' }));
  const k = (o, modal) => tv.shouldHandleShortcut({ key: 'n', target: { tagName: 'DIV' }, ...o }, modal);
  assert.ok(k({}, false)); assert.ok(!k({}, true), 'modal open');
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) assert.ok(!k({ target: { tagName: tag } }, false), tag);
  assert.ok(!k({ target: { tagName: 'DIV', isContentEditable: true } }, false));
  assert.ok(!k({ ctrlKey: true }, false) && !k({ metaKey: true }, false) && !k({ key: 'm' }, false) && !k({ repeat: true }, false));
  console.log('ok   utils/taskView');
})();
// quick successive inline edits must all persist (serialized read-modify-write per day doc)
pending.push((async () => {
  const tp = require(path.join(src, 'utils/taskPatch.js'));
  const store = { tasks: [{ createdAt: 'c1', title: 'A', status: 'todo', estimateMin: 0 }, { createdAt: 'c2', title: 'B' }] };
  const readWrite = async (patchFn) => { const snap = JSON.parse(JSON.stringify(store.tasks)); await new Promise((r) => setTimeout(r, 15)); store.tasks = patchFn(snap); };
  const enqueue = tp.createKeyedQueue();
  const patch = (patchObj) => enqueue('doc', () => readWrite((snap) => tp.applyTaskPatch(snap, { createdAt: 'c1', title: 'A' }, 0, patchObj)));
  await Promise.all([patch({ status: 'waiting' }), patch({ estimateMin: 45 }), patch({ nextAction: 'x' })]);
  assert.deepStrictEqual([store.tasks[0].status, store.tasks[0].estimateMin, store.tasks[0].nextAction], ['waiting', 45, 'x'], 'all quick edits persist');
  assert.strictEqual(store.tasks[1].title, 'B');
  // without the queue the second write would clobber the first (documents why the queue exists)
  store.tasks[0] = { createdAt: 'c1', title: 'A' };
  const raw = (o) => readWrite((snap) => tp.applyTaskPatch(snap, { createdAt: 'c1', title: 'A' }, 0, o));
  await Promise.all([raw({ status: 'waiting' }), raw({ estimateMin: 45 })]);
  assert.ok(!(store.tasks[0].status && store.tasks[0].estimateMin), 'unqueued writes race');
  // a failing job does not block the queue; different keys are independent
  const q = tp.createKeyedQueue(); const order = [];
  await Promise.allSettled([q('k', async () => { throw new Error('x'); }), q('k', async () => order.push(2))]);
  assert.deepStrictEqual(order, [2]);
  assert.strictEqual(tp.applyTaskPatch([{ title: 'z', createdAt: 'q' }], { title: 'nope' }, 5, {}), null, 'unknown task -> null');
  assert.strictEqual(tp.applyTaskPatch([{ title: 'z' }], { title: 'nope' }, 0, { a: 1 })[0].a, 1, 'index fallback');
  assert.ok(/createKeyedQueue/.test(fs.readFileSync(path.join(src, 'composables/useDayPersistence.js'), 'utf8')), 'patchStoredTask is queued');
  console.log('ok   utils/taskPatch (serialized inline edits)');
})().catch((e) => { console.log('FAIL taskPatch:', e.message); process.exitCode = 1; failedAsync = true; }));
// progress %, days left and hero heading are driven by explicit/reactive "today" inputs
(() => {
  const ds = require(path.join(src, 'utils/dayStats.js'));
  const r = [{ completed: true }, { completed: true }, { completed: true }, { completed: true }, {}, {}, {}];
  assert.strictEqual(ds.completionPercentage(r, 0, 6, 6), 57, '4 of 7 done on today is 57%, not 0');
  assert.strictEqual(ds.completionPercentage(r, 0, 5, 6), 0, 'non-today tab');
  assert.strictEqual(ds.completionPercentage(r, 0, 0, 0), 57, 'Sunday works too');
  assert.strictEqual(ds.completionPercentage(r, undefined, 2, 2), 57, 'missing wont-do count');
  assert.strictEqual(ds.completionPercentage([{ completed: true }, null], 0, 1, 1), 50, 'null entries tolerated');
  assert.strictEqual(ds.daysLeftInYearFrom(new Date(2026, 9, 18, 0, 3)), 74);
  assert.strictEqual(ds.daysLeftInYearFrom(new Date(2026, 9, 18, 0, 3)) - 1, ds.daysLeftInYearFrom(new Date(2026, 9, 19, 0, 3)), 'rolls over by one at midnight');
  assert.strictEqual(ds.heroTitleFor(0, 0), 'Make today count.');
  assert.strictEqual(ds.heroTitleFor(6, 0), 'Plan your Saturday'); assert.strictEqual(ds.heroTitleFor(1, 3), 'Looking back at Monday');
  const hv = fs.readFileSync(path.join(src, 'views/HomeView.vue'), 'utf8');
  assert.ok(/daysLeftInYearFrom\(new Date\(calendarNow\.value\)\)/.test(hv), 'days left is reactive');
  assert.ok(/<TimeStatsBar v-if="isViewingToday"/.test(hv), 'stats only on today');
  console.log('ok   progress / days-left / heading / stats-on-today');
})();
// responsive sidebar: matchMedia-driven, overlay below 768px, pushes page above
(() => {
  const nav = fs.readFileSync(path.join(src, 'components/nav.vue'), 'utf8');
  assert.ok(/matchMedia\('\(min-width: 768px\)'\)/.test(nav) && /addEventListener\('change', onMq\)/.test(nav), 'reacts to viewport changes');
  assert.ok(/@media \(min-width: 768px\)[\s\S]*sidebar-open #app \{ padding-left: 16rem/.test(nav), 'pushes content on wide screens only');
  console.log('ok   nav responsive sidebar');
})();
// voice: no recognition property access outside the support guard; modal opens independent of recognition
(() => {
  const hv = fs.readFileSync(path.join(src, 'views/HomeView.vue'), 'utf8');
  const guard = hv.slice(hv.indexOf('if (voiceSupported) {'), hv.indexOf('} else {\n  console.warn("Speech recognition not supported'));
  const outside = hv.replace(guard, '').match(/^recognition\.[a-zA-Z]+ ?=/gm);
  assert.strictEqual(outside, null, 'no top-level recognition.* assignments (crashed when unsupported)');
  assert.ok(/<VoiceModal v-if="voiceOpen"/.test(hv) && /voiceOpen\.value = true; \/\/ always show/.test(hv));
  console.log('ok   voice wiring');
})();
// voice -> task: transcript goes through a fresh form, failures are surfaced, interim-only results are not dropped (iOS)
(() => {
  const hv = fs.readFileSync(path.join(src, 'views/HomeView.vue'), 'utf8');
  assert.ok(/if \(r\.isFinal\) saveSpoken\(r\[0\]\.transcript\)/.test(hv) && /\.\.\.blankTask\(\), title/.test(hv), 'each final phrase saves via fresh blankTask (hands-free)');
  assert.ok(/recognition\.onend = \(\) => \{[\s\S]*?saveSpoken\(pendingVoiceText\)/.test(hv), 'onend saves transcript when no final flag arrived');
  assert.ok(/const ok = await addNewTask\(\)/.test(hv) && /if \(!ok\) \{[\s\S]*?voiceAddFailed = true;[\s\S]*?voiceError\.value = /.test(hv) && /if \(!voiceAddFailed\) voiceError\.value = ''/.test(hv), 'failed voice add is surfaced and survives a mic auto-restart, not silently dropped');
  const fn = hv.slice(hv.indexOf('const addNewTask = async'), hv.indexOf('const speakDailyReport'));
  assert.ok(!/^\s*return;\s*$/m.test(fn) && /lastAddPersist = trackWrite\(\(async/.test(fn) && /return false;/.test(fn), 'addNewTask reports success/failure (optimistic, rollback on error)');
  assert.ok(/event\.error === 'aborted'\) return/.test(hv), 'aborted (own stop) is not shown as an error');
  assert.ok(/recognition\.abort\(\)/.test(hv) && /InvalidStateError/.test(hv), 'start retries after InvalidStateError');
  assert.ok(/catch \(e\) \{\s*console\.error\('Voice task failed:'/.test(hv), 'voice save surfaces thrown errors');
  assert.ok(/selectedDayIndex\.value < 0/.test(fn), 'addNewTask guards unloaded day index');
  assert.ok(/microphone=\(self\)/.test(fs.readFileSync(path.join(__dirname, '..', 'netlify.toml'), 'utf8')), 'netlify allows microphone');
  console.log('ok   voice -> task');
})();
// Daily/multi-day copies: not shown on past days of this week, series lookup for delete-from-all, Add form defaults
(() => {
  const rp = require(path.join(src, 'utils/repeat.js'));
  const thu = new Date(2026, 9, 15, 10); // Thursday 2026-10-15 (index 4); week Sun 10-11 .. Sat 10-17
  assert.strictEqual(rp.activeFromForDay(4, thu), '', 'today: no limit');
  assert.strictEqual(rp.activeFromForDay(6, thu), '', 'future day this week: no limit');
  assert.strictEqual(rp.activeFromForDay(1, thu), '2026-10-19', 'Monday already passed -> next Monday');
  assert.strictEqual(rp.activeFromForDay(0, new Date(2026, 9, 18)), '', 'Sunday is today');
  assert.strictEqual(rp.activeFromForDay(5, new Date(2026, 11, 31)), '', 'Fri 2027-01-01 is ahead');
  assert.strictEqual(rp.activeFromForDay(0, new Date(2026, 11, 31)), '2027-01-03', 'year rollover next-week date');
  const t = { title: 'Stretch', createdAt: 'c', activeFrom: '2026-10-19' };
  assert.ok(rp.isHiddenOnDate(t, '2026-10-12') && !rp.isHiddenOnDate(t, '2026-10-19') && !rp.isHiddenOnDate({ title: 'x' }, '2026-10-12'));
  const by = { Mon: [{ title: 'Stretch', createdAt: 'c' }], Tue: [{ title: 'Stretch', createdAt: 'c' }, { title: 'Other', createdAt: 'd' }], Wed: [{ title: 'Stretch', createdAt: 'zzz' }], Sat: [] };
  assert.deepStrictEqual(rp.seriesDays(by, { title: 'Stretch', createdAt: 'c' }, 'Sat'), ['Mon', 'Tue']);
  assert.deepStrictEqual(rp.seriesDays(by, { title: 'Stretch' }, 'Sat'), [], 'legacy tasks without createdAt never match');
  assert.deepStrictEqual(rp.withoutSeries(by.Tue, t).map((x) => x.title), ['Other']);
  const hv = fs.readFileSync(path.join(src, 'views/HomeView.vue'), 'utf8');
  assert.ok(/type: 'one-time',\s*\n\s*dueDate/.test(hv.slice(hv.indexOf('const blankTask'))), 'Add form defaults to Just once');
  assert.ok(!/type: 'recurring',\s*\n?\s*dueDate/.test(hv), 'no other form reset reintroduces weekly default');
  console.log('ok   utils/repeat + add-form defaults');
})();
// schedule overlap: every task overlapping any other is flagged (not only the one before the next)
(() => {
  const tp = require(path.join(src, 'utils/taskPlanning.js'));
  const mk = (t, start, est) => ({ title: t, startTime: start, estimateMin: est });
  const c = (list) => tp.buildSchedule(list).blocks.map((b) => b.task.title + (b.conflict ? '!' : '')).join(',');
  assert.strictEqual(c([mk('long', '09:00', 180), mk('a', '09:30', 15), mk('b', '10:00', 15)]), 'long!,a!,b!', 'long task overlaps both later ones');
  assert.strictEqual(c([mk('a', '09:00', 30), mk('b', '09:30', 30), mk('c', '10:00', 30)]), 'a,b,c', 'back-to-back is not an overlap');
  assert.strictEqual(c([mk('a', '09:00', 60), mk('b', '09:30', 15), mk('c', '12:00', 30)]), 'a!,b!,c');
  assert.strictEqual(c([mk('a', '09:00', 0), mk('b', '09:00', 30)]), 'a,b', 'no estimate -> no end -> no overlap claim');
  assert.strictEqual(c([]), '');
  console.log('ok   schedule overlap flags');
})();
pending.push((async () => {
  const PF = require(path.join(src, 'components/ui/PasswordField.vue')).default;
  const html = await renderToString(createSSRApp(PF, { modelValue: 'secret', id: 'pw', required: true }));
  assert.ok(/type="password"/.test(html) && !/type="text"/.test(html), 'password hidden by default');
  assert.ok(/aria-label="Show password"/.test(html) && /data-test="password-toggle"/.test(html) && /aria-pressed="false"/.test(html), 'accessible Show password toggle');
  assert.ok(/type="button"/.test(html), 'toggle never submits the form');
  assert.ok(/width: 44px; height: 44px/.test(fs.readFileSync(path.join(src, 'components/ui/PasswordField.vue'), 'utf8')), '44px tap target');
  console.log('ok   PasswordField');
})().catch((e) => { console.log('FAIL PasswordField:', e.message); process.exitCode = 1; failedAsync = true; }));
(async () => {
  let failed = 0;
  const warn = console.warn; const warnings = [];
  console.warn = (...a) => warnings.push(a.join(' '));
  for (const [name, props, expects, forbidden = []] of cases) {
    try {
      const html = await renderToString(createSSRApp(load(name), props));
      const missing = expects.filter((e) => !html.includes(e)).concat(forbidden.filter((e) => html.includes(e)).map((e) => '!' + e));
      if (missing.length) { failed++; console.log(`FAIL ${name}: missing ${JSON.stringify(missing)}`); } else console.log(`ok   ${name}`);
    } catch (e) { failed++; console.log(`FAIL ${name}: ${String(e.message).slice(0, 300)}`); }
  }
  console.warn = warn;
  await Promise.all(pending);
  if (failedAsync) failed++;
  const real = warnings.filter((w) => !/router-link|resolve component/i.test(w));
  real.forEach((w) => console.log('warn:', w.split('\n')[0]));
  process.exit(failed ? 1 : 0);
})();
