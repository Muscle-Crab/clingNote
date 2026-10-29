// Regression: completed one-time tasks (and repeat-series copies) stay in the Completed section all day and leave at the day rollover.
// Run: node scripts/test-completed-stay.js
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire');
const { pruneStaleDay, isStaleCompletion } = sr.load('utils/localDate.js');
const { countTasksForDay } = sr.load('utils/taskLimits.js');
const fn = require('../netlify/functions/eight-hour-day.js')._internal;
const thu = new Date(2026, 9, 29, 22, 0); const nextThu = new Date(2026, 10, 5, 0, 5); const fri = new Date(2026, 9, 30, 9, 0);
const done = (o) => ({ type: 'one-time', completed: true, completedAt: new Date(2026, 9, 29, 10, 52).toISOString(), createdAt: '2026-10-29T12:00:00.000Z', ...o });
const list = [done({ title: 'once' }), done({ title: 'bed', templateId: 'tpl', scheduledId: 'tpl_2026-10-29' }), { type: 'one-time', title: 'open', completed: false, createdAt: '2026-10-29T13:00:00.000Z' },
  { type: 'recurring', title: 'rec', completed: true, completedAt: new Date(2026, 9, 29, 9).toISOString() }];
// same day (Thu 10 PM): nothing pruned
assert.strictEqual(pruneStaleDay(list, 4, thu).length, 4);
// viewing Thursday's tab on Friday: still Thursday's list (its occurrence has not rolled over)
assert.strictEqual(pruneStaleDay(list, 4, fri).length, 4);
// next Thursday after midnight: completed one-time + series copy leave; unfinished stays; recurring stays (reset elsewhere)
const after = pruneStaleDay(list, 4, nextThu);
assert.deepStrictEqual(after.map((t) => t.title), ['open', 'rec']);
assert.ok(isStaleCompletion(after[1], 4, nextThu));
// 5/day limit: keeping done tasks in the list does not add new adds (same createdAt set as before completion); series copies never count
assert.strictEqual(countTasksForDay('2026-10-29', [list]), 2);
// server Start Day prune (plan tz): earlier-day completed one-time tasks are dropped, same-day ones kept
const s = fn.pruneStale(list, 'America/New_York', '2026-11-05');
assert.deepStrictEqual(s.map((t) => t.title), ['open', 'rec']);
assert.strictEqual(fn.pruneStale(list, 'America/New_York', '2026-10-29').length, 4);
// HomeView: completion never removes the task, all-done never filters, rollover uses pruneStaleDay
const hv = fs.readFileSync(path.join(__dirname, '../src/views/HomeView.vue'), 'utf8');
assert.ok(!hv.includes('tasks.splice(at, 1)'), 'completion must not splice the stored task');
assert.ok(!/isDoneOneTime/.test(hv), 'all-done must not remove completed one-time tasks');
assert.ok(hv.includes('selectedDayRoutine.value.splice(index, 1, task);'));
assert.ok(/pruneStaleDay\(list, dayIdx, now\)/.test(hv));
console.log('test-completed-stay: ok');
