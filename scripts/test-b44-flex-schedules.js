// B44: flexible habit schedules. Fixed "every N days" repeat (interval), weekday / N×-week / every-N habits in the assistant
// habit tracker, and streaks that only count required days. Run: node scripts/test-b44-flex-schedules.js
const assert = require('assert');
const { load } = require('./lib/srcRequire');
const S = load('utils/scheduling.js'); const R = load('utils/routine.js'); const E = load('utils/schedEdit.js'); const H = load('utils/habits.js');
const I = load('utils/ics.js'); const T = load('utils/assistantTools.js');
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };
const MON = '2026-10-26'; const d = (i) => S.addDaysStr(MON, i);

t('interval: build, occurs every N days from start, describe', () => {
  const tp = S.buildRecurringTemplate({ title: 'Water plants' }, MON, { freq: 'interval', everyDays: 3 }, 'tI');
  assert.deepStrictEqual(tp.recurrence, { freq: 'interval', everyDays: 3 });
  assert.deepStrictEqual(S.occurrencesBetween(tp, MON, d(10)), [d(0), d(3), d(6), d(9)]);
  assert.strictEqual(S.occursOn(tp, d(-3)), false);
  assert.strictEqual(S.describeRecurrence(tp.recurrence), 'Every 3 days');
  assert.strictEqual(I.rruleFor(tp.recurrence), 'FREQ=DAILY;INTERVAL=3');
});
t('interval: does not move when completed late (unlike after-done)', () => {
  const tp = { ...S.buildRecurringTemplate({ title: 'x' }, MON, { freq: 'interval', everyDays: 2 }, 'tI'), doneOn: [d(1)] };
  assert.ok(S.occursOn(tp, d(2)) && S.occursOn(tp, d(4)) && !S.occursOn(tp, d(3)));
});
t('interval: expandRecurring generates this week only', () => {
  const tp = S.buildRecurringTemplate({ title: 'x' }, MON, { freq: 'interval', everyDays: 2 }, 'tI');
  const r = S.expandRecurring([tp], d(0)); assert.deepStrictEqual(r.added.map((e) => e.scheduledDate), [d(0), d(2), d(4), d(6)]);
});
t('interval: routine streak skips off days, breaks on a missed due day', () => {
  const base = S.buildRecurringTemplate({ title: 'x' }, MON, { freq: 'interval', everyDays: 3 }, 'tI');
  assert.strictEqual(R.routineStreak({ ...base, doneOn: [d(0), d(3), d(6)] }, d(7)).streak, 3);
  assert.strictEqual(R.routineStreak({ ...base, doneOn: [d(0), d(6)] }, d(7)).streak, 1);
  assert.strictEqual(R.routineStreak({ ...base, doneOn: [d(0), d(3)] }, d(6)).streak, 2, 'today still open never breaks');
});
t('picker: validate, recOf, sameRule for interval', () => {
  const s = { ...E.blankSchedule(MON), on: true, repeat: 'interval', everyDays: 4 };
  assert.strictEqual(E.validateSchedule(s), '');
  assert.match(E.validateSchedule({ ...s, everyDays: 1 }), /2–365/);
  const tp = S.buildRecurringTemplate({ title: 'x' }, MON, E.recOf(s), 'tI');
  assert.deepStrictEqual(tp.recurrence, { freq: 'interval', everyDays: 4 });
  assert.strictEqual(E.sameRule(tp, s), true); assert.strictEqual(E.sameRule(tp, { ...s, everyDays: 5 }), false);
  assert.strictEqual(E.scheduleOfEntry(tp).repeat, 'interval');
});
t('existing repeat values unchanged', () => {
  const after = S.buildRecurringTemplate({ title: 'x' }, MON, { freq: 'afterCompletion', everyDays: 3 }, 'a');
  assert.strictEqual(after.recurrence.freq, 'afterCompletion'); assert.strictEqual(after.nextDate, MON);
  const wk = S.buildRecurringTemplate({ title: 'x' }, MON, { freq: 'weekly', days: [1, 3] }, 'w');
  assert.deepStrictEqual(wk.recurrence, { freq: 'weekly', days: [1, 3] });
});
t('habits: no schedule = old daily streak', () => {
  const r = H.habitStreak([d(0), d(1), d(2)], d(2)); assert.strictEqual(r.streak, 3); assert.strictEqual(r.best, 3);
  assert.strictEqual(H.habitStreak([d(0), d(1)], d(2)).streak, 2);
});
t('habits: weekdays schedule ignores off days', () => {
  const sc = { days: [1, 3, 5] }; // Mon Wed Fri
  assert.strictEqual(H.habitStreak([d(0), d(2), d(4)], d(6), sc).streak, 3);
  assert.strictEqual(H.habitStreak([d(0), d(4)], d(6), sc).streak, 1, 'missed Wed breaks');
  assert.strictEqual(H.habitStreak([d(0), d(2)], d(3), sc).dueToday, false);
});
t('habits: N× a week counts weeks', () => {
  const sc = { timesPerWeek: 2 };
  const r = H.habitStreak([d(-7), d(-5), d(1), d(5)], d(6), sc); assert.strictEqual(r.unit, 'week'); assert.strictEqual(r.streak, 2); assert.strictEqual(r.weekDone, 2);
  assert.strictEqual(H.habitStreak([d(-7), d(-5), d(1)], d(3), sc).streak, 1, 'open week never breaks');
  assert.strictEqual(H.habitStreak([d(-14), d(-13), d(1), d(2)], d(3), sc).streak, 1, 'a missed week breaks');
});
t('habits: every N days', () => {
  const sc = { everyDays: 2, start: d(0) };
  assert.strictEqual(H.habitStreak([d(0), d(2), d(4)], d(5), sc).streak, 3);
  assert.strictEqual(H.habitStreak([d(0), d(4)], d(5), sc).streak, 1);
});
t('habits: add with schedule, re-add updates schedule, summary text', () => {
  let l = H.addHabit([], 'Run', { timesPerWeek: 3 }); assert.deepStrictEqual(l[0].schedule, { timesPerWeek: 3 });
  l = H.addHabit(l, 'run', { days: [1, 4] }); assert.strictEqual(l.length, 1); assert.deepStrictEqual(l[0].schedule, { days: [1, 4] });
  assert.strictEqual(H.habitSummary(l, d(0))[0].schedule, 'Every Mon, Thu');
  assert.strictEqual(H.addHabit([], 'Read', { timesPerWeek: 9 })[0].schedule, undefined, 'bad values -> daily');
  assert.strictEqual(H.cleanSchedule({ days: [0, 1, 2, 3, 4, 5, 6] }), null, 'all 7 days = daily');
});
t('assistant add_habit passes the schedule through', () => {
  const r = T.validateCall('add_habit', { name: 'Gym', timesPerWeek: 3 }); assert.ok(r.ok); assert.strictEqual(r.args.schedule.timesPerWeek, 3);
  const l = T.validateCall('log_habit', { name: 'Gym' }); assert.strictEqual(l.args.schedule, undefined);
});
console.log(`\n${n} passed`);
