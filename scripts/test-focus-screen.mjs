// Focus Mode is a view of the task timer that play already starts. It does not keep its own clock.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { focusCountdown, focusRingFraction, focusSessionCard, focusSteps, focusSubtitle } from '../src/utils/focusScreen.js';

const start = Date.parse('2026-11-09T12:00:00Z');
const task = {
  id: 't1', title: 'Write project report', timerActive: true,
  timerStartedAt: new Date(start).toISOString(),
  timerEndTime: new Date(start + 25 * 60000).toISOString(),
  timerDurationMinutes: 25,
};
const now = start + 2 * 1000;

assert.equal(focusCountdown(task, now), '24:58');
assert.ok(focusRingFraction(task, now) > 0.99);
assert.equal(focusSubtitle(task), 'Focus for 25 min · Deep work session');
assert.deepEqual(focusSessionCard(task, { now: start }), { n: 1, of: 1, percent: 0, label: '1 of 1 focus sessions' });
assert.equal(focusSteps(task), null, 'no subtasks hides the checklist');
assert.equal(focusSteps({ subtasks: [{ id: 'a', title: 'Outline', done: true }, { id: 'b', title: 'Draft', done: false }] }).left, 1);

const paused = { ...task, timerPausedAt: new Date(now).toISOString() };
assert.equal(focusCountdown(paused, start + 10 * 60000), '24:58', 'pause freezes the same end timestamp');

const pomo = { ...task, timerPomo: { work: 25, brk: 5, rounds: 4, round: 1, phase: 'work' }, timerDurationMinutes: 25 };
const card = focusSessionCard(pomo, { now: start + 6.25 * 60000 });
assert.equal(card.label, '1 of 4 focus sessions');
assert.equal(card.percent, 6);

const coach = focusSessionCard(task, { now: start, coach: { n: 1, of: 2 } });
assert.equal(coach.label, '1 of 2 focus sessions');

const home = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../src/components/home/FocusMode.vue', import.meta.url), 'utf8');
assert.match(home, /if \(!opts\.lock && focusModeOn\.value\) focusScreenKey\.value = taskKey\(task\)/);
assert.match(home, /focusModeOn\.value \|\| !confirmStartOn\(localStorage, userId\.value\)\) return launchTimer\(index, mins\)/);
assert.match(screen, /set-mode/);
assert.match(home, /focusScreenPause[\s\S]{0,240}pausePatch/);
assert.match(home, /focusScreenResume[\s\S]{0,240}resumePatch/);
assert.match(home, /focusScreenEnd[\s\S]{0,700}endEarlyPatch/);
assert.match(home, /toggleSubtask\(subtasksOf/);
assert.doesNotMatch(screen, /np-anchor|UIBackgroundModes|new Audio\(/);
assert.match(screen, /focusCountdown\(props\.task/);
assert.match(screen, /import RobotAvatar from '@\/components\/home\/RobotAvatar\.vue'/);
assert.match(screen, /data-test="focus-robot"/);
assert.doesNotMatch(screen, /fm-leaf/);
assert.match(screen, /data-test="focus-done"/);
assert.match(screen, /fm-act--pause/);
assert.match(screen, /fm-act--done/);
assert.match(screen, /paused \? 'resume' : 'pause'/);
assert.doesNotMatch(screen, /data-test="focus-end"/);
assert.doesNotMatch(screen, /data-test="focus-play"/);
assert.match(home, /@done="focusScreenComplete"/);
assert.match(home, /const focusScreenComplete = async \(\) => \{[\s\S]{0,900}toggleTaskCompletion\(i\)/);
assert.match(home, /if \(ok === false\) \{ focusDoneError\.value = 'Could not save this task\. It is still open\.'/);
assert.match(screen, /\.fm \{ position: fixed; z-index: 200; inset: 0;/);
assert.match(screen, /background: linear-gradient\(180deg, #060e20, #060c1c 28%, #050a18\)/);
assert.doesNotMatch(screen, /rgba\(6, 14, 32/);
assert.doesNotMatch(screen, /bottom: calc\(64px \+ env\(safe-area-inset-bottom\)\)/);
assert.match(screen, /<Teleport to="body">/);
assert.match(home, /if \(focusDoneBusy\.value\) return list\.find/);
console.log('focus screen: countdown, pause, steps, and the existing timer writes');
