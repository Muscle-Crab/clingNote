// Delete any time, keep the list when a day read fails, and drop dead focus timers from the widget.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clearExpiredTimer, clearExpiredTimers, timerShownOnWidget, TIMER_OVERTIME_MS, TIMER_CONNECTION_TOAST, deleteFailureMessage, writeFailureMessage, appendTask, patchTimerOnList, identityCommit, dayReadFailure, tasksFromSnapshot, withoutTask, markTaskRemoved, visibleTasks, taskStillVisible, shorterList, sameLengthKeepsIdentity } from '../src/utils/dayList.js';
import { prepareVaultApps, isPlaceholderName } from '../src/utils/vaultNames.js';
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
  assert.ok(del.indexOf('await commitDayTasks') < del.indexOf('selectedDayRoutine.value = next'));
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

t('an active 7:04–1:04 session at 210/185 with a running timer still removes that task', () => {
  const start = Date.parse('2026-11-06T07:04:00');
  const end = Date.parse('2026-11-06T13:04:00');
  const now = end - (33 * 60 + 45) * 1000;
  assert.ok(now > start && now < end);
  assert.equal(210 >= 185, true);
  const tasks = Array.from({ length: 28 }, (_, i) => ({
    id: 't' + i, title: i === 3 ? 'Upgrade Etsy store' : 'Task ' + i, createdAt: 'c' + i, points: i === 3 ? 20 : 10,
    completed: i < 15, timerActive: i === 3, focusLock: i === 3, timerEndTime: new Date(now - 3600000).toISOString(),
  }));
  const sessionDone = tasks.filter((t) => t.completed).slice(0, 8);
  assert.equal(sessionDone.length, 8);
  assert.equal(tasks.filter((t) => t.completed).length, 15);
  const same = (t) => t.id === 't3';
  const shrunk = withoutTask(tasks, same);
  assert.equal(shorterList(tasks, shrunk), true);
  assert.equal(taskStillVisible(shrunk, same), false);
  const marked = markTaskRemoved(tasks, same);
  assert.equal(marked.length, 28);
  assert.equal(sameLengthKeepsIdentity(tasks, marked), true);
  assert.equal(marked[3].title, 'Upgrade Etsy store');
  assert.equal(marked[3].points, 20);
  assert.equal(marked[3].createdAt, 'c3');
  assert.equal(marked[3].timerActive, false);
  assert.equal(marked[3].focusLock, false);
  assert.equal(taskStillVisible(marked, same), false);
  assert.equal(visibleTasks(marked).some((t) => t.id === 't3'), false);
  assert.equal(buildWidgetSnapshot(marked, { now: new Date(now) }).tasks.some((t) => t.title === 'Upgrade Etsy store'), false);
  const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  const del = home.slice(home.indexOf('const deleteTask = async'), home.indexOf('const topIncompleteTaskIndex'));
  assert.equal(/blockIfShut\(|blockIfLocked\(/.test(del), false);
  assert.match(del, /markTaskRemoved/);
  assert.match(del, /taskStillVisible/);
  assert.equal(/strictGoal|gpGate|checklistDone/.test(del), false);
});

t('play starts the timer in place, and the connection sentence is only the offline error', () => {
  const live = [{ id: 'a', createdAt: 'a', points: 10, title: 'Call EZ pass', scheduledFor: '2026-11-07' }];
  const next = patchTimerOnList(live, (t) => t.id === 'a', { timerActive: true, timerStartedAt: 's', timerEndTime: 'e', timerDurationMinutes: 20, timerPausedAt: null, focusLock: false, timerPomo: null });
  assert.equal(next[0].createdAt, 'a');
  assert.equal(next[0].points, 10);
  assert.equal(next[0].scheduledFor, '2026-11-07');
  assert.equal(next[0].timerActive, true);
  assert.equal(patchTimerOnList(live, (t) => t.id === 'missing', { timerActive: true }), null);
  assert.equal(writeFailureMessage({ code: 'unavailable' }, 'Call EZ pass', 'start the timer for'), TIMER_CONNECTION_TOAST);
  assert.equal(TIMER_CONNECTION_TOAST, 'Could not start the timer. Check your connection and try again.');
  assert.notEqual(writeFailureMessage({ code: 'permission-denied' }, 'Call EZ pass', 'start the timer for'), TIMER_CONNECTION_TOAST);
  assert.match(writeFailureMessage({ code: 'invalid-argument' }, 'Call EZ pass', 'start the timer for'), /can't be stored/);
  const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  const start = home.slice(home.indexOf('const confirmDayStart'), home.indexOf('const todayTasksForTarget'));
  assert.match(start, /await fetchSelectedDayRoutine\(\)/);
  assert.match(start, /All done today/);
  assert.match(start, /beginSessionGate/);
  assert.match(home, /priceCap: sessionPriceCap/);
  assert.match(home, /Completed today/);
});

t('a recurring add appends behind existing tasks and names a rejected save', () => {
  const live = [{ id: 'keep', createdAt: 'a', points: 10, title: 'Make the bed' }];
  const copy = { id: 'new', createdAt: 'b', points: 5, title: 'Create Instagram video', type: 'recurring' };
  const next = appendTask(live, copy, (t) => t.createdAt === 'b');
  assert.equal(next[0].createdAt, 'a');
  assert.equal(next[0].points, 10);
  assert.equal(next.length, 2);
  assert.equal(appendTask(next, copy, (t) => t.createdAt === 'b').length, 2);
  assert.match(writeFailureMessage({ code: 'permission-denied' }, 'Create Instagram video'), /rejected the change/);
  assert.match(writeFailureMessage({ code: 'unavailable' }, 'Create Instagram video'), /connection/);
  assert.match(writeFailureMessage({ code: 'invalid-argument' }, 'Create Instagram video'), /can't be stored/);
  const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  const add = home.slice(home.indexOf('const addNewTask = async'), home.indexOf('let lastAddPersist'));
  assert.equal(add.includes('alert('), false);
  assert.match(add, /appendTask/);
  assert.match(add, /commitDayTasks/);
  assert.equal(add.includes('Could not save “'), false);
  assert.match(add, /newTask\.value = draft/);
  assert.match(add, /if \(!voiceOpen\.value\) \{ newTask\.value = draft; modalOpen\.value = true; \}/);
  const kept = [{ id: 'a', createdAt: 'a', points: 10, title: 'Keep' }];
  const added = identityCommit(kept, [...kept, { id: 'b', createdAt: 'b', points: 5, title: 'Check email' }]);
  assert.equal(added[0].createdAt, 'a');
  assert.equal(added[0].points, 10);
  assert.equal(added[1].title, 'Check email');
  const titled = identityCommit(kept, [{ id: 'a', createdAt: 'changed', points: 99, title: 'Renamed' }]);
  assert.equal(titled[0].title, 'Renamed');
  assert.equal(titled[0].createdAt, 'a');
  assert.equal(titled[0].points, 10);
  const hidden = identityCommit(kept, []);
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].removed, true);
  assert.equal(hidden[0].points, 10);
  const dozen = Array.from({ length: 12 }, (_, i) => ({ id: 't' + i, createdAt: 'c' + i, points: 10 + i, title: 'Task ' + i }));
  const renamed = identityCommit(dozen, dozen.map((t, i) => (i === 11 ? { ...t, title: 'Check email', points: 1 } : t)));
  assert.equal(renamed.length, 12);
  assert.equal(renamed[11].title, 'Check email');
  assert.equal(renamed[11].points, 21);
  assert.equal(renamed[0].createdAt, 'c0');
  const pointed = identityCommit(dozen, dozen.map((t, i) => (i === 3 ? { ...t, points: 5, title: 'Edited' } : t)), { keepPoints: false });
  assert.equal(pointed[3].points, 5);
  assert.equal(pointed[3].title, 'Edited');
  assert.equal(pointed[3].createdAt, 'c3');
  const voice = home.slice(home.indexOf('const confirmVoiceItems'), home.indexOf('const relistenVoice'));
  assert.match(voice, /finally \{ voiceBusy\.value = false; \}/);
});

t('six placeholder vault cards keep a saved name and drop one shared blocked icon', () => {
  assert.equal(isPlaceholderName('App'), true);
  assert.equal(isPlaceholderName('Instagram'), false);
  const blocked = 'data:image/png;base64,prohibited';
  const catalog = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, label: 'App', icon: blocked }));
  const named = [{ id: 'a', label: 'Instagram' }, { id: 'b', label: 'App' }, { id: 'c', label: 'TikTok' }];
  const mem = { bag: new Map(), getItem(k) { return this.bag.has(k) ? this.bag.get(k) : null; }, setItem(k, v) { this.bag.set(k, v); } };
  const apps = prepareVaultApps(mem, catalog, named);
  assert.equal(apps.find((a) => a.id === 'a').label, 'Instagram');
  assert.equal(apps.find((a) => a.id === 'c').label, 'TikTok');
  assert.equal(apps.find((a) => a.id === 'd').label, 'App');
  assert.ok(apps.every((a) => !a.icon));
  const again = prepareVaultApps(mem, catalog, []);
  assert.equal(again.find((a) => a.id === 'a').label, 'Instagram');
  assert.equal(again.find((a) => a.id === 'f').label, 'App');
  const distinct = prepareVaultApps(mem, [{ id: 'a', label: 'Instagram', icon: 'data:image/png;base64,ig' }, { id: 'b', label: 'TikTok', icon: 'data:image/png;base64,tt' }], []);
  assert.equal(distinct[0].icon, 'data:image/png;base64,ig');
  assert.equal(distinct[1].icon, 'data:image/png;base64,tt');
  const swift = fs.readFileSync(new URL('../ios/App/Shared/LockShared.swift', import.meta.url), 'utf8');
  const plug = fs.readFileSync(new URL('../ios/App/App/ClingLockPlugin.swift', import.meta.url), 'utf8');
  assert.match(swift, /func realName/);
  assert.match(swift, /lock\.vaultNames/);
  assert.match(plug, /getBool\("selection"\)/);
  assert.match(plug, /loadSelection\(\)\.applicationTokens/);
});

console.log(`day fixes: ${n} passed`);
