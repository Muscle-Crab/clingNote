// Tasks with a running timer are listed first in the app (any sort/filter) and in the widget; several keep their relative order.
const assert = require('assert');
const { load } = require('./lib/srcRequire');
const { viewTasks, hasRunningTimer } = load('utils/taskView.js');
const { buildWidgetSnapshot } = load('utils/widgetSnapshot.js');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const end = new Date(Date.now() + 600000).toISOString(), start = new Date().toISOString();
const tasks = [
  { title: 'A', createdAt: 1, priority: 'high', startTime: '08:00' },
  { title: 'B', createdAt: 2, timerActive: true, timerStartedAt: start, timerEndTime: end, startTime: '18:00' },
  { title: 'C', createdAt: 3, priority: 'high', startTime: '07:00' },
  { title: 'D', createdAt: 4, timerActive: true, timerStartedAt: start, timerEndTime: end, timerPausedAt: start },
  { title: 'E', createdAt: 5, timerActive: true, completed: true },
];
const titles = (items) => items.map((i) => i.task.title).join('');
for (const sort of ['manual', 'start', 'priority', 'status']) {
  const v = viewTasks(tasks, { sort, filter: 'all' });
  ok(titles(v).startsWith('BD'), `${sort}: running first, relative order kept (${titles(v)})`);
  ok(v.find((i) => i.task.title === 'B').index === 1, `${sort}: original index kept for handlers`);
}
ok(titles(viewTasks(tasks, { sort: 'start', filter: 'all' })) === 'BDCAE', 'rest still sorted by start');
ok(!hasRunningTimer(tasks[4]) && !hasRunningTimer({}) && hasRunningTimer(tasks[1]), 'completed task is not pinned');
const w = buildWidgetSnapshot(tasks, { now: new Date() }).tasks.map((r) => r.title).join('');
ok(w.startsWith('BD') && w.endsWith('E'), `widget: running first (${w})`);
ok(!('_run' in buildWidgetSnapshot(tasks).tasks[0]), 'no internal field leaks to the widget');

// Drag reorder: sortOrder-based (array positions untouched, so it works on a locked day) and coexists with pinned running timers.
{
  const { applyManualOrder } = load('utils/taskView.js');
  const key = (t) => `${t.createdAt}|${t.title}`;
  const base = [{ title: 'A', createdAt: 1 }, { title: 'B', createdAt: 2 }, { title: 'C', createdAt: 3 }, { title: 'D', createdAt: 4, timerActive: true }];
  const shown = viewTasks(base, { sort: 'manual', filter: 'all' }).map((i) => i.task);
  ok(shown.map((t) => t.title).join('') === 'DABC', 'running pinned before drag');
  const moved = [shown[0], shown[3], shown[1], shown[2]]; // drag C above A
  const next = applyManualOrder(base, moved.map(key), key);
  ok(next.map((t) => t.createdAt).join() === '1,2,3,4', 'positions (locked slot identity) unchanged');
  ok(titles(viewTasks(next, { sort: 'manual', filter: 'all' })) === 'DCAB', 'drag order shown, running still first');
  const stopped = next.map((t) => ({ ...t, timerActive: false }));
  ok(titles(viewTasks(stopped, { sort: 'manual', filter: 'all' })) === 'DCAB', 'order persists after the timer stops');
  ok(titles(viewTasks([...next, { title: 'E', createdAt: 5 }], { sort: 'manual', filter: 'all' })).endsWith('E'), 'new task appends at the end');
  ok(titles(viewTasks(next, { sort: 'start', filter: 'all' })).startsWith('D'), 'other sorts unaffected');
  console.log('test-running-first: drag reorder ok');
}
console.log(`test-running-first: ${pass} passed`);
