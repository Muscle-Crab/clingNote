// B39: flexible "N times a week, any day" habits (recurrence { freq:'weekly', days:[0..6], timesPerWeek:N }).
// Shows each day until N completions that Mon–Sun week, then hides; streaks never break on non-required days;
// existing repeat values keep their exact meaning. Run: node scripts/test-b39-flexweek.js
const assert = require('assert');
const { load } = require('./lib/srcRequire');
const S = load('utils/scheduling.js');
const R = load('utils/routine.js');
const E = load('utils/schedEdit.js');
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };
const MON = '2026-10-26'; // Monday
const d = (i) => S.addDaysStr(MON, i);
const flex = (N = 3, extra = {}) => ({ ...S.buildRecurringTemplate({ title: 'Gym' }, '2026-10-01', { freq: 'xweek', timesPerWeek: N }, 'tF'), ...extra });

t('build: xweek -> weekly all days + timesPerWeek', () => {
  const tp = flex(3);
  assert.deepStrictEqual(tp.recurrence, { freq: 'weekly', days: [0, 1, 2, 3, 4, 5, 6], timesPerWeek: 3 });
  assert.strictEqual(S.isFlexWeekly(tp), true);
  assert.strictEqual(S.buildRecurringTemplate({ title: 'x' }, MON, { freq: 'xweek', timesPerWeek: 9 }), null);
  assert.strictEqual(S.buildRecurringTemplate({ title: 'x' }, MON, { freq: 'weekly', days: [1], timesPerWeek: 7 }).recurrence.timesPerWeek, undefined);
});
t('clamp N to 1..6', () => { [1, 2, 6].forEach((v) => assert.strictEqual(S.clampTimesPerWeek(v), v)); [0, 7, -1, 2.5, 'x', null, undefined, NaN].forEach((v) => assert.strictEqual(S.clampTimesPerWeek(v), 0)); });
t('describe', () => {
  assert.strictEqual(S.describeRecurrence(flex(3).recurrence), '3× a week, any day');
  assert.strictEqual(S.describeRecurrence(flex(1).recurrence), 'Once a week, any day');
});
t('occurs every day until N done, then hides for the rest of the week', () => {
  const tp = flex(3, { doneOn: [] });
  for (let i = 0; i < 7; i++) assert.ok(S.occursOn(tp, d(i)));
  const done3 = flex(3, { doneOn: [d(0), d(2), d(3)] });
  [0, 2, 3].forEach((i) => assert.ok(S.occursOn(done3, d(i)), `done day ${i} still shows`));
  [1, 4, 5, 6].forEach((i) => assert.ok(!S.occursOn(done3, d(i)), `hidden day ${i}`));
  const done2 = flex(3, { doneOn: [d(0), d(1)] });
  assert.ok(S.occursOn(done2, d(4)));
});
t('new week resets the count', () => { const tp = flex(2, { doneOn: [d(0), d(1)] }); assert.ok(!S.occursOn(tp, d(6))); assert.ok(S.occursOn(tp, d(7))); });
t('skip / until / startDate still respected', () => {
  assert.ok(!S.occursOn(flex(3, { skip: [d(1)] }), d(1)));
  const u = flex(3); u.recurrence.until = d(2); assert.ok(!S.occursOn(u, d(3)));
  assert.ok(!S.occursOn(flex(3, { startDate: d(3) }), d(2)));
});
t('legacy repeat values unchanged (migration safety)', () => {
  const w = S.buildRecurringTemplate({ title: 'a' }, MON, { freq: 'weekly', days: [1, 3] }, 'w');
  assert.deepStrictEqual(w.recurrence, { freq: 'weekly', days: [1, 3] });
  assert.ok(S.occursOn(w, d(0)) && !S.occursOn(w, d(1)) && S.occursOn(w, d(2)));
  assert.strictEqual(S.describeRecurrence(w.recurrence), 'Every Mon, Wed');
  const bad = { ...w, recurrence: { ...w.recurrence, timesPerWeek: 0 } }; assert.ok(!S.isFlexWeekly(bad)); assert.ok(!S.occursOn(bad, d(1)));
  const daily = { ...w, recurrence: { freq: 'daily', timesPerWeek: 3 } }; assert.ok(!S.isFlexWeekly(daily)); assert.ok(S.occursOn(daily, d(1)));
  // a stored weekly-all-days rule from an old build still means every day
  const all = { ...w, recurrence: { freq: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] }, doneOn: [d(0), d(1), d(2)] }; assert.ok(S.occursOn(all, d(4)));
});
t('expand: flex only generates today, never later days', () => {
  const { added } = S.expandRecurring([flex(3)], d(2));
  assert.deepStrictEqual(added.map((a) => a.scheduledDate), [d(2)]);
  assert.strictEqual(added[0].repeatText, '3× a week, any day');
  const { added: none } = S.expandRecurring([flex(2, { doneOn: [d(0), d(1)] })], d(2));
  assert.strictEqual(none.length, 0);
});
t('materialize: drops a flex instance once N reached or from a past day', () => {
  const tp = flex(2, { doneOn: [d(0), d(1)] });
  const inst = { id: S.instanceId('tF', d(2)), templateId: 'tF', title: 'Gym', scheduledDate: d(2) };
  const r = S.materializeDue({ scheduled: [tp, inst], todayStr: d(2), todayTasks: [], nowIso: '2026-10-28T12:00:00Z' });
  assert.strictEqual(r.toAdd.length, 0); assert.ok(r.scheduled[1].flexHidden);
  const tp2 = flex(3, { doneOn: [] }); const old = { ...inst, id: S.instanceId('tF', d(1)), scheduledDate: d(1) };
  const r2 = S.materializeDue({ scheduled: [tp2, old, inst], todayStr: d(2), todayTasks: [], nowIso: '2026-10-28T12:00:00Z' });
  assert.deepStrictEqual(r2.toAdd.map((x) => x.scheduledId), [inst.id]);
});
t('routineToday shows progress, hides after N', () => {
  const a = R.routineToday([flex(3, { doneOn: [d(0)] })], [], d(2));
  assert.strictEqual(a.length, 1); assert.deepStrictEqual(a[0].flex, { done: 1, n: 3 });
  assert.strictEqual(R.routineToday([flex(2, { doneOn: [d(0), d(1)] })], [], d(2)).length, 0);
  const today = R.routineToday([flex(2, { doneOn: [d(0), d(2)] })], [], d(2)); assert.strictEqual(today.length, 1); assert.ok(today[0].done);
});
t('routineWeek: undone flex days are never a miss', () => {
  const w = R.routineWeek([flex(3, { doneOn: [d(1)] })], d(4));
  assert.ok(!w.days.some((x) => x.state === 'miss'), JSON.stringify(w.days.map((x) => x.state)));
  assert.strictEqual(w.days[1].state, 'done');
  assert.strictEqual(w.days[0].state, 'none');
});
t('markRoutineDone feeds the weekly count', () => {
  let list = [flex(2)];
  list = R.markRoutineDone(list, { templateId: 'tF', scheduledFor: d(0) }, d(0), true);
  list = R.markRoutineDone(list, { templateId: 'tF', scheduledFor: d(3) }, d(3), true);
  assert.ok(!S.occursOn(list[0], d(4)));
  list = R.markRoutineDone(list, { templateId: 'tF', scheduledFor: d(3) }, d(3), false);
  assert.ok(S.occursOn(list[0], d(4)));
});
t('flex streak counts met weeks; open week never breaks it', () => {
  const doneOn = [d(-14), d(-13), d(-7), d(-3)]; // two weeks met (N=2), this week 0 so far
  assert.deepStrictEqual(R.routineStreak(flex(2, { doneOn }), d(2)), { streak: 2, unit: 'week' });
  assert.strictEqual(R.routineStreak(flex(2, { doneOn: [...doneOn, d(0), d(1)] }), d(2)).streak, 3);
  assert.strictEqual(R.routineStreak(flex(2, { doneOn: [d(-14), d(-13), d(-3)] }), d(2)).streak, 0); // last week missed
});
t('calendar streak ignores non-required days and an open today', () => {
  const w = { ...S.buildRecurringTemplate({ title: 'a' }, '2026-10-01', { freq: 'weekly', days: [1, 3, 5] }, 'w'), doneOn: [d(-7), d(-5), d(-3), d(0)] };
  assert.strictEqual(R.routineStreak(w, d(2)).streak, 4); // Wed today open: Mon + last Fri/Wed/Mon
  assert.strictEqual(R.routineStreak({ ...w, doneOn: [d(-7), d(-3), d(0)] }, d(2)).streak, 2); // missed last Wed breaks
  assert.strictEqual(R.routineStreak({ ...w, doneOn: [d(-7), d(-5), d(-3), d(0), d(2)] }, d(3)).streak, 5); // Thu not required: neither counts nor breaks
});
t('schedEdit round trip + validation + sameRule', () => {
  const s = { ...E.blankSchedule(MON), on: true, repeat: 'xweek', timesPerWeek: 4 };
  assert.strictEqual(E.validateSchedule(s, MON), '');
  assert.ok(E.validateSchedule({ ...s, timesPerWeek: 7 }, MON));
  assert.deepStrictEqual(E.recOf(s), { freq: 'weekly', days: [0, 1, 2, 3, 4, 5, 6], timesPerWeek: 4, until: '' });
  const tp = S.buildRecurringTemplate({ title: 'Gym' }, MON, E.recOf(s), 'tF');
  const back = E.scheduleOfEntry(tp); assert.strictEqual(back.repeat, 'xweek'); assert.strictEqual(back.timesPerWeek, 4);
  assert.ok(E.sameRule(tp, back)); assert.ok(!E.sameRule(tp, { ...back, timesPerWeek: 3 }));
  const w = S.buildRecurringTemplate({ title: 'a' }, MON, { freq: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] }, 'w');
  assert.strictEqual(E.scheduleOfEntry(w).repeat, 'weekly'); assert.ok(!E.sameRule(w, back));
});
console.log(`test-b39-flexweek: ${n} passed`);
