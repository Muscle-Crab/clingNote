// Done-today must count the same finished tasks as the daily progress, and the shield must
// open from the pair printed on the points card. A baseline taken after the work stays closed
// on the old delta, which is why 264/260 could leave the apps shielded.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { todayDoneKeys, recheckDay, evaluateStreak, DAILY_STREAK_MIN } from '../src/utils/streak.js';
import { sessionUnlock } from '../src/utils/strictDay.js';
import { shouldShield } from '../src/utils/appLock.js';

const key = (t) => t.id;
const done = (id, extra = {}) => ({ id, completed: true, ...extra });
const tasks = [
  done('early', { completedAt: '2026-11-09T12:00:00Z' }),
  done('stamp', { completedAt: { seconds: 1762690000 } }),
  done('flag'),
  ...Array.from({ length: 10 }, (_, i) => done('t' + i, { completedAt: '2026-11-09T17:00:00Z' })),
  { id: 'open', completed: false },
  { id: 'pend', completed: true, status: 'pending' },
];
const keys = todayDoneKeys(tasks, key);
assert.equal(keys.length, 13, '13 finished tasks, including ones before a legacy start and a timestamp object');
assert.ok(!keys.includes('open') && !keys.includes('pend'));

const today = '2026-11-09';
const counted = recheckDay({ streak: 0, dayDone: [] }, today, { keys, drop: ['open', 'pend'], gate: true });
assert.equal(counted.dayDone.length, 13);
assert.equal(evaluateStreak(counted, today).progress, 13);
assert.equal(counted.streak, 1, 'eight or more finished tasks count the day');
assert.ok(counted.dayDone.length >= DAILY_STREAK_MIN);

assert.equal(sessionUnlock({ dayEarned: 447, earnedAtStart: 447, sessionRequired: 260 }), false, 'a late baseline swallows the session');
assert.equal(sessionUnlock({ sessionEarned: 264, sessionRequired: 260 }), true, 'the card pair 264/260 opens');
assert.equal(shouldShield({ enabled: true, running: true, endMs: Date.now() + 3600000, selectionCount: 3, earned: 264, required: 260, openTasks: 1 }), false);

const home = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
assert.match(home, /const card = shieldFromCard\(\)/);
assert.match(home, /endedGoalMet\(eh\.lock\.value/);
assert.match(home, /decideShield\(\{/);
assert.match(home, /todayDoneKeys\(tasks, taskKey\)/);
assert.doesNotMatch(home, /completedAfterStart\(task\)/);
console.log('streak and shield: done today follows the list, 264/260 opens the apps');
