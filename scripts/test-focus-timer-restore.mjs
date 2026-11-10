// A focus timer keeps its wall-clock end across background and a cold launch, and Focus Mode
// stays up until the user closes it. Run: node scripts/test-focus-timer-restore.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pausePatch } from '../src/utils/focusActions.js';
import { focusClock, focusPhaseLabel } from '../src/utils/focusScreen.js';
import {
  clearFocusTimer, closeFocusScreen, mergeSavedTimer, readFocusTimer, recordFromTask, remainingMs,
  restoreFocusScreen, sessionRemainingMs, taskFromRecord, timerView, writeFocusTimer,
} from '../src/utils/focusTimerStore.js';

const M = 60000;
const start = Date.parse('2026-11-10T09:00:00Z');
const task = {
  id: 't1', title: 'Read', createdAt: 'c1', timerActive: true, timerDurationMinutes: 10,
  timerStartedAt: new Date(start).toISOString(),
  timerEndTime: new Date(start + 10 * M).toISOString(),
};
const memory = (seed) => {
  const box = { ...(seed || {}) };
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(box, k) ? box[k] : null),
    setItem: (k, v) => { box[k] = String(v); },
    removeItem: (k) => { delete box[k]; },
    dump: () => ({ ...box }),
  };
};

const store = memory();
writeFocusTimer(store, recordFromTask(task, { focusOpen: true, savedAt: start }));
const running = readFocusTimer(store);
const back = start + 5 * M;
assert.equal(remainingMs(running, back), 5 * M, 'start 10 min, away 5 min, 5 min left');
assert.equal(focusClock(taskFromRecord(running), back), '5:00');
assert.equal(restoreFocusScreen(running), true, 'restore after background');

const paused = { ...task, ...pausePatch(task, start + 2 * M) };
writeFocusTimer(store, recordFromTask(paused, { focusOpen: true, savedAt: start + 2 * M }));
assert.equal(remainingMs(readFocusTimer(store), start + 7 * M), 8 * M, 'paused, away 5 min, remaining unchanged');

const cold = memory(store.dump());
const revived = readFocusTimer(cold);
assert.equal(remainingMs(revived, start + 7 * M), 8 * M, 'cold relaunch keeps the paused remaining time');
assert.equal(restoreFocusScreen(revived), true, 'restore after cold relaunch');

writeFocusTimer(store, running);
const later = start + 12 * M;
assert.equal(timerView(running, later).ended, true, 'expired while away');
assert.equal(focusClock(taskFromRecord(running), later), '00:00');
assert.equal(focusPhaseLabel(taskFromRecord(running), later), "TIME'S UP");
assert.equal(restoreFocusScreen(running), true, 'no auto-dismiss at zero');

const merged = mergeSavedTimer([{ title: 'Read', createdAt: 'c1', completed: false }], running, later);
assert.equal(merged[0].timerEndTime, task.timerEndTime, 'a day refresh does not drop the saved end');
const endedEarly = mergeSavedTimer([{ title: 'Read', createdAt: 'c1', completed: false, focusEndedEarlyAt: new Date(later).toISOString(), timerActive: false }], running, later);
assert.equal(endedEarly[0].timerActive, false, 'ending the session is not put back by the saved timer');
assert.equal(restoreFocusScreen(readFocusTimer(store)), true, 'a day refresh does not close the screen');

closeFocusScreen(store);
assert.equal(restoreFocusScreen(readFocusTimer(store)), false, 'user close dismisses it');
assert.equal(readFocusTimer(store).focusOpen, false, 'user close clears the saved open screen');
clearFocusTimer(store);
assert.equal(readFocusTimer(store), null, 'Done clears the saved timer');

assert.equal(sessionRemainingMs(start + 10 * M, start + 5 * M), 5 * M, 'session timer uses the same wall-clock end');

const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
const watcher = home.slice(home.indexOf('const startCountdownWatcher'), home.indexOf('onMounted(', home.indexOf('const startCountdownWatcher')));
assert.doesNotMatch(watcher, /focusScreenKey\.value = ''/, 'the tick watcher does not dismiss Focus Mode');
assert.match(home, /const reopenFocusScreen = \(\) =>/);
assert.match(home, /reopenFocusScreen\(\)/);
assert.match(home, /App\.addListener\('resume', reopenFocusScreen\)/);
assert.match(home, /@close="dismissFocusScreen"/);
assert.match(home, /closeFocusScreen\(localStorage\)/);
assert.match(home, /stopFocusTimerRecord\(\)/);
assert.match(home, /withSavedTimer\(visibleTasks\(tasks\)\)/);
const hour = fs.readFileSync(new URL('../src/composables/useEightHour.js', import.meta.url), 'utf8');
assert.match(hour, /bindWallClock\(poke\)/);
assert.match(hour, /tick\.value = nowMs\(\)/);
assert.doesNotMatch(hour, /tick\.value\s*-=/);

console.log('focus timer restore: wall clock, background, cold launch, time\'s up, user close');
