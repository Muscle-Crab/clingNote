// The progress card must not show 0 for finished tasks just because the session baseline
// already includes them, or because a Screen Time penalty zeroed the coach total.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardAward, sessionAward, taskAward } from '../src/utils/pointsAward.js';
import { sessionGoal } from '../src/utils/sessionGoal.js';
import { completionPercentage } from '../src/utils/dayStats.js';

const pointsOf = () => 10;
const done = [
  { title: 'A', completed: true, completedAt: 1_000, points: 0 },
  { title: 'B', completed: 1, completedAt: 2_000, points: 0 },
];
assert.equal(taskAward(done[1], pointsOf), 0, 'taskAward ignores a non-boolean completed flag');
assert.equal(cardAward(done, pointsOf), 20, 'the card still counts both finished tasks from the chip');
assert.equal(sessionAward(cardAward(done, pointsOf), cardAward(done, pointsOf)), 0, 'a baseline taken after the work swallows the delta');
const inSession = sessionGoal(done, { n: 1, sessions: 1, startMs: 500, endMs: 5_000, goal: 260 }, pointsOf);
assert.equal(inSession.earned, 20, 'the lock strip counts the same work inside the session');

const routine = [...Array(24)].map(() => ({ completed: false })).concat(done);
assert.equal(completionPercentage(routine, 0, 1, 1), 8, '2 of 26 tasks is 8 percent');

const home = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
const bar = readFileSync(new URL('../src/components/home/ProgressBar.vue', import.meta.url), 'utf8');
assert.match(home, /:points="shownCardPts"/);
assert.match(home, /:today-points="sessionCardPts != null \? todayCardPts : null"/);
assert.match(home, /sessionGoal\(todayTasksForTarget\.value \|\| \[\]/);
assert.match(home, /cardAward\(isViewingToday\.value \? \(dayTasks\.value \|\| \[\]\) : \[\]/);
assert.match(bar, /class="pts-copy"/);
assert.match(bar, /white-space:\s*nowrap/);
console.log('progress card: session points follow the lock strip, 2 of 26 is 8%');
