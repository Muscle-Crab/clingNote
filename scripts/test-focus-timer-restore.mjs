// A focus timer keeps its wall-clock end across background and a cold launch, and Focus Mode
// stays up until the user closes it. Run: node scripts/test-focus-timer-restore.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pausePatch } from '../src/utils/focusActions.js';
import { focusClock, focusPhaseLabel } from '../src/utils/focusScreen.js';
import {
  clearFocusTimer, closeFocusScreen, mergeSavedTimer, pickTimerRecord, readFocusTimer, readout, recordFromTask, remainingMs,
  restoreFocusScreen, resumeSavedPlay, sessionRemainingMs, taskFromRecord, timerView, writeFocusTimer,
} from '../src/utils/focusTimerStore.js';
import { fmtRemaining, ringRemainingMs } from '../src/utils/timerRing.js';
import { buildWidgetSnapshot } from '../src/utils/widgetSnapshot.js';
import { focusActivityState } from '../src/utils/focusActions.js';

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

// 50-minute timer, 10 minutes in. A cold launch must not show the 30-minute estimate.
const endMs = start + 50 * M;
const stamped = {
  id: 't1', title: 'Read', estimateMin: 30, timerActive: true, timerDurationMinutes: 50,
  createdAt: { seconds: Math.floor(start / 1000), nanoseconds: 0 },
  timerStartedAt: { seconds: Math.floor(start / 1000), nanoseconds: 0 },
  timerEndTime: { seconds: Math.floor(endMs / 1000), nanoseconds: 0 },
};
const mid = start + 10 * M;
assert.equal(readout(stamped, mid).remaining, 40 * M, 'a Firestore end is the remaining time');
assert.notEqual(readout(stamped, mid).remaining, 30 * M, 'cold relaunch does not reset to 30');
assert.equal(fmtRemaining(ringRemainingMs(stamped, mid)), '40:00');
assert.equal(fmtRemaining(readout(stamped, mid).remaining), fmtRemaining(ringRemainingMs(stamped, mid)), 'card ring and model match');

const modelTask = { id: 't1', title: 'Read', createdAt: 'c1', timerActive: true, timerDurationMinutes: 50, estimateMin: 30, timerStartedAt: new Date(start).toISOString(), timerEndTime: new Date(endMs).toISOString() };
const coldStore = memory();
const model = writeFocusTimer(coldStore, recordFromTask(modelTask, { focusOpen: true, savedAt: start }));
const wiped = memory();
const revivedModel = pickTimerRecord(null, JSON.stringify(model));
assert.equal(revivedModel.timerEndTime, model.timerEndTime, 'cold relaunch reads the backup when localStorage is empty');
const reloaded = mergeSavedTimer([{ id: 't1', title: 'Read', createdAt: 'c1', estimateMin: 30, completed: false }], revivedModel, mid);
assert.equal(readout(reloaded[0], mid).remaining, readout(revivedModel, mid).remaining, 'model and card match after a list reload');
assert.equal(readout(reloaded[0], mid).end, readout(revivedModel, mid).end);
assert.equal(fmtRemaining(readout(reloaded[0], mid).remaining), '40:00');
const pausedCard = { ...reloaded[0], ...pausePatch(reloaded[0], mid) };
const pausedModel = recordFromTask(pausedCard, { focusOpen: true, savedAt: mid });
assert.equal(readout(pausedCard, mid + 15 * M).remaining, readout(pausedModel, mid + 15 * M).remaining, 'model and card match while paused');
assert.equal(readout(pausedCard, mid + 15 * M).remaining, 40 * M);
const widget = buildWidgetSnapshot([reloaded[0]], { now: new Date(mid) }).tasks[0];
assert.equal(widget.tE, readout(revivedModel, mid).end, 'widget uses the saved end');
const live = focusActivityState(reloaded[0], { now: mid });
assert.equal(live.endsAtMs, readout(revivedModel, mid).end, 'Live Activity uses the saved end');
assert.equal(focusClock(reloaded[0], mid), fmtRemaining(readout(revivedModel, mid).remaining), 'Focus Mode shows the card clock');

// Leave Focus Mode, then press play: the card and Focus Mode keep the same remaining time.
const playing = { id: 't1', title: 'Read', createdAt: 'c1', timerActive: true, timerDurationMinutes: 50, timerStartedAt: new Date(start).toISOString(), timerEndTime: new Date(endMs).toISOString() };
const leftOpen = recordFromTask(playing, { focusOpen: true, savedAt: start });
const leftStore = memory();
writeFocusTimer(leftStore, leftOpen);
const closed = closeFocusScreen(leftStore);
assert.equal(closed.focusOpen, false, 'Back only closes the screen');
assert.equal(closed.timerEndTime, playing.timerEndTime, 'Back keeps the saved end');
const again = resumeSavedPlay(playing, closed, mid);
assert.ok(again, 'play reopens the started timer');
assert.equal(again.timerEndTime, playing.timerEndTime, 'play does not write a new end');
assert.equal(again.timerStartedAt, playing.timerStartedAt, 'play does not restart from zero');
assert.equal(readout(again, mid).remaining, readout(playing, mid).remaining, 'card and Focus Mode keep the same remaining time');
assert.equal(fmtRemaining(readout(again, mid).remaining), '40:00');
assert.notEqual(readout(again, mid).remaining, 0);
const pausedPlay = { ...playing, ...pausePatch(playing, mid) };
const pausedAgain = resumeSavedPlay(pausedPlay, recordFromTask(pausedPlay, { focusOpen: false }), mid + 15 * M);
assert.equal(pausedAgain.timerEndTime, pausedPlay.timerEndTime, 'play does not unpause or move the end');
assert.equal(pausedAgain.timerPausedAt, pausedPlay.timerPausedAt);
assert.equal(readout(pausedAgain, mid + 15 * M).remaining, 40 * M, 'play after pause keeps the frozen time');
const upTask = { ...playing, timerEndTime: new Date(start).toISOString() };
const up = resumeSavedPlay(upTask, null, mid);
assert.ok(up, 'time\'s up still reopens');
assert.equal(up.timerEndTime, upTask.timerEndTime, 'time\'s up is not replaced with a new clock');
assert.equal(readout(up, mid).remaining, 0);
assert.equal(resumeSavedPlay({ ...playing, completed: true }, closed, mid), null, 'Done does not bring the timer back');
assert.equal(resumeSavedPlay({ ...playing, focusEndedEarlyAt: new Date(mid).toISOString(), timerActive: false, timerEndTime: null }, closed, mid), null, 'End session does not bring the timer back');
const fm = fs.readFileSync(new URL('../src/components/home/FocusMode.vue', import.meta.url), 'utf8');
const card = fs.readFileSync(new URL('../src/components/home/TaskCard.vue', import.meta.url), 'utf8');
assert.doesNotMatch(fm, /Restart|Start again|Reset timer/);
assert.doesNotMatch(card, /Restart|Start again|Reset timer/);
assert.match(fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8'), /resumeSavedPlay\(before0, savedFocusTimer\(\)/);

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
