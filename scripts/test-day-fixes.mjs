// Delete any time, keep the list when a day read fails, and drop dead focus timers from the widget.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clearExpiredTimer, clearExpiredTimers, timerShownOnWidget, TIMER_OVERTIME_MS, deleteFailureMessage, dayReadFailure, tasksFromSnapshot, withoutTask } from '../src/utils/dayList.js';
import { buildWidgetSnapshot } from '../src/utils/widgetSnapshot.js';
import { hasRing } from '../src/utils/timerRing.js';

let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const now = Date.parse('2026-11-06T15:35:00Z');
const same = (t, id) => t && t.id === id;

t('delete errors name permission and offline, and the list is unchanged until the write', () => {
  assert.match(deleteFailureMessage({ code: 'permission-denied' }), /rejected the change/);
  assert.match(deleteFailureMessage({ code: 'unavailable' }), /connection/);
  assert.match(deleteFailureMessage({ message: 'client is offline' }), /connection/);
  const local = [{ id: 'a', title: 'Keep' }, { id: 'b', title: 'Gone' }];
  assert.deepEqual(withoutTask(local, (t) => same(t, 'b')), [{ id: 'a', title: 'Keep' }]);
  assert.deepEqual(tasksFromSnapshot(local, [{ id: 'a' }], true), local);
  assert.deepEqual(tasksFromSnapshot(local, [{ id: 'a' }], false), [{ id: 'a' }]);
});

t('a failed day read keeps a cached list and says so; an empty first read says it could not load', () => {
  assert.match(dayReadFailure({ code: 'unavailable' }, true), /Showing the last list/);
  assert.match(dayReadFailure({ code: 'unavailable' }, false), /Couldn't load/);
  assert.match(dayReadFailure({ message: 'boom' }, false), /Try again/);
});

t('an inactive timer that ended 163h ago is not a widget timer and is cleared', () => {
  const end = new Date(now - 163 * 3600000);
  const task = { id: 'wash', title: 'Wash', completed: false, timerActive: false, timerDurationMinutes: 20, timerEndTime: end.toISOString(), timerStartedAt: new Date(end.getTime() - 20 * 60000).toISOString(), estimateMin: 20, points: 10 };
  assert.equal(timerShownOnWidget(task, now), false);
  assert.equal(hasRing(task, now), false);
  const row = buildWidgetSnapshot([task], { now: new Date(now) }).tasks[0];
  assert.equal(row.tE, undefined);
  assert.equal(row.est, 20);
  const cleared = clearExpiredTimer(task, now);
  assert.equal(cleared.timerActive, false);
  assert.equal(cleared.timerEndTime, null);
  assert.equal(cleared.title, 'Wash');
});

t('a timer running inside today\'s window is kept, including a short overtime', () => {
  const end = now + 20 * 60000;
  const live = { id: 'sword', title: 'Return sword kit', completed: false, timerActive: true, timerDurationMinutes: 35, timerEndTime: new Date(end).toISOString(), timerStartedAt: new Date(now - 17 * 1000).toISOString() };
  assert.equal(timerShownOnWidget(live, now), true);
  assert.equal(buildWidgetSnapshot([live], { now: new Date(now) }).tasks[0].tE, end);
  assert.equal(clearExpiredTimer(live, now), live);
  const over = { ...live, timerEndTime: new Date(now - 30 * 60000).toISOString() };
  assert.equal(timerShownOnWidget(over, now), true);
  const dead = { ...live, timerEndTime: new Date(now - TIMER_OVERTIME_MS - 1000).toISOString() };
  assert.equal(timerShownOnWidget(dead, now), false);
  assert.equal(clearExpiredTimers([dead], now)[0].timerActive, false);
});

t('a stuck timerActive that ended 163h ago is cleared and stays off the widget', () => {
  const end = new Date(now - 163 * 3600000);
  const task = { id: 'wash', title: 'Wash', completed: false, timerActive: true, focusLock: true, timerDurationMinutes: 20, timerEndTime: end.toISOString(), timerStartedAt: new Date(end.getTime() - 20 * 60000).toISOString() };
  assert.equal(timerShownOnWidget(task, now), false);
  assert.equal(buildWidgetSnapshot([task], { now: new Date(now) }).tasks[0].tE, undefined);
  const cleared = clearExpiredTimer(task, now);
  assert.equal(cleared.timerActive, false);
  assert.equal(cleared.timerEndTime, null);
  assert.equal(cleared.focusLock, true);
  assert.equal(cleared.title, 'Wash');
});

t('HomeView deletes only after the write, and a failed day read does not blank the list', () => {
  const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  const del = home.slice(home.indexOf('const deleteTask = async'), home.indexOf('const topIncompleteTaskIndex'));
  assert.equal(del.includes('blockIfShut('), false);
  assert.equal(del.includes('blockIfLocked('), false);
  assert.ok(del.indexOf('await mutateDay') < del.indexOf('selectedDayRoutine.value = next'));
  assert.match(del, /deleteFailureMessage/);
  const fetch = home.slice(home.indexOf('const fetchSelectedDayRoutine'), home.indexOf('const days = data.days'));
  const failed = fetch.slice(fetch.indexOf('Error fetching tasks'));
  assert.equal(failed.includes('selectedDayRoutine.value = []'), false);
  assert.match(failed, /dayReadFailure/);
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const upd = rules.slice(rules.indexOf('match /weeklyRoutines/{routineId}'));
  assert.match(upd, /allow update: if isAuthenticated\(\) && request\.auth\.uid == routineId\.split\('_'\)\[0\];/);
  assert.match(upd, /allow delete: if isAuthenticated\(\) && request\.auth\.uid == routineId\.split\('_'\)\[0\] && !dayFrozen/);
});

t('a paused timer inside the overtime window stays; a paused timer from months ago is cleared', () => {
  const paused = { title: 'Call Hubert', completed: false, timerActive: false, timerPausedAt: new Date(now - 10 * 60000).toISOString(), timerDurationMinutes: 10, timerEndTime: new Date(now + 5 * 60000).toISOString() };
  assert.equal(timerShownOnWidget(paused, now), true);
  const ancient = { ...paused, timerEndTime: new Date(now - 2179 * 3600000).toISOString(), timerPausedAt: new Date(now - 2179 * 3600000).toISOString() };
  assert.equal(timerShownOnWidget(ancient, now), false);
  assert.equal(clearExpiredTimer(ancient, now).timerPausedAt, null);
});

console.log(`day fixes: ${n} passed`);
