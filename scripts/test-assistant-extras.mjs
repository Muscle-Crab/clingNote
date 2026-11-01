// Assistant extras: stats, search, next suggestion, snooze, recurring create, subtasks/search validation, ?ask query.
import assert from 'node:assert/strict';
import { weekStats, searchTasks, suggestNext, snoozeTo, repeatFields } from '../src/utils/assistantExtras.js';
import { parseAsk, askQuery } from '../src/utils/assistantFab.js';
let n = 0; const ok = (name, f) => { f(); n++; console.log('ok', name); };
const week = [
  { day: 'Monday', tasks: [{ title: 'Dentist appointment', completed: true, points: 20, startTime: '10:00' }, { title: 'Gym', completed: false, points: 30 }] },
  { day: 'Friday', tasks: [{ title: 'Report draft', completed: true, points: 50 }, { title: 'Pending thing', status: 'pending' }] },
];
ok('stats', () => { const s = weekStats(week, { streak: 4, bestStreak: 9 }); assert.equal(s.planned, 3); assert.equal(s.done, 2); assert.equal(s.completionRate, 67); assert.equal(s.pointsThisWeek, 70); assert.equal(s.streak, 4); });
ok('search words', () => { const r = searchTasks(week, [{ title: 'Dentist follow-up', scheduledDate: '2026-11-02' }], { query: 'find the dentist task' }); assert.equal(r.length, 2); });
ok('search day', () => { const r = searchTasks(week, [], { query: 'what did I plan', day: 'Friday' }); assert.deepEqual(r.map((x) => x.title), ['Report draft', 'Pending thing']); });
const now = new Date(2026, 9, 26, 17, 30);
ok('next: due soon wins', () => { const r = suggestNext([{ title: 'Big', points: 150, estimateMin: 60 }, { title: 'Store', points: 10, startTime: '18:00' }, { title: 'Done', completed: true }], { now }); assert.equal(r.task.title, 'Store'); });
ok('next: running timer', () => { assert.equal(suggestNext([{ title: 'A', startTime: '17:00' }, { title: 'B', timerActive: true }], { now }).task.title, 'B'); });
ok('next: empty', () => { assert.equal(suggestNext([], { now }).task, null); });
ok('next: fits time left', () => { assert.equal(suggestNext([{ title: 'Long', points: 100, estimateMin: 120 }, { title: 'Short', points: 20, estimateMin: 20 }], { now, minutesLeft: 30 }).task.title, 'Short'); });
ok('snooze', () => { assert.deepEqual(snoozeTo(now, 30), { date: '2026-10-26', time: '18:00', nextDay: false }); assert.equal(snoozeTo(new Date(2026, 9, 26, 23, 50), 30).nextDay, true); });
ok('repeat', () => { assert.deepEqual(repeatFields('weekdays'), { repeat: 'weekly', days: [1, 2, 3, 4, 5] }); assert.deepEqual(repeatFields('weekly', ['fri', 1]), { repeat: 'weekly', days: [5, 1] }); assert.equal(repeatFields(''), null); });
ok('ask query', () => { assert.deepEqual(parseAsk(askQuery(true)), { open: true, listen: true }); assert.deepEqual(parseAsk(askQuery(false)), { open: true, listen: false }); assert.equal(parseAsk({}).open, false); });
console.log(`${n} passed`);
