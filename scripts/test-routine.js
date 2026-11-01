// Routine add-ons: repeat-after-completion date math (month/year/leap/DST), Skip today, completion log, today's checklist,
// weekly completion stats, per-series reminder time (notifications), SchedulePicker validation / schedule round-trip.
// Run: node scripts/test-routine.js   (DST cases are checked under America/New_York and Europe/London)
const assert = require('assert');
const { execFileSync } = require('child_process');
const { load } = require('./lib/srcRequire');
const S = load('utils/scheduling.js');
const R = load('utils/routine.js');
const N = load('utils/schedNotify.js');
const E = load('utils/schedEdit.js');
const I = load('utils/ics.js');
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };

if (!process.env.ROUTINE_TZ_CHILD) {
  for (const tz of ['America/New_York', 'Europe/London', 'Australia/Sydney']) {
    execFileSync(process.execPath, [__filename], { env: { ...process.env, TZ: tz, ROUTINE_TZ_CHILD: '1' }, stdio: 'inherit' });
  }
}
const tz = process.env.TZ || 'default';
const tpl = (o = {}) => S.buildRecurringTemplate({ title: o.title || 'Water plants', ...(o.fields || {}) }, o.start || '2026-10-26', o.rec || { freq: S.AFTER, everyDays: 3 }, o.id || 'tA');

t(`[${tz}] after-completion: completed Mon + 3 -> Thu, Wed + 3 -> Sat`, () => {
  assert.strictEqual(R.nextAfter('2026-10-26', 3), '2026-10-29'); // Mon -> Thu
  assert.strictEqual(R.nextAfter('2026-10-28', 3), '2026-10-31'); // Wed -> Sat
  assert.strictEqual(R.nextAfter('2026-10-26', 1), '2026-10-27');
});
t(`[${tz}] month / year / leap boundaries`, () => {
  assert.strictEqual(R.nextAfter('2026-01-30', 3), '2026-02-02');
  assert.strictEqual(R.nextAfter('2026-02-27', 3), '2026-03-02');
  assert.strictEqual(R.nextAfter('2028-02-27', 3), '2028-03-01'); // leap year: Feb 29 exists
  assert.strictEqual(R.nextAfter('2028-02-28', 1), '2028-02-29');
  assert.strictEqual(R.nextAfter('2026-12-30', 3), '2027-01-02');
  assert.strictEqual(R.nextAfter('2026-04-30', 30), '2026-05-30');
});
t(`[${tz}] DST transitions do not shift the date`, () => {
  assert.strictEqual(R.nextAfter('2026-03-07', 3), '2026-03-10'); // US spring forward Mar 8
  assert.strictEqual(R.nextAfter('2026-03-08', 1), '2026-03-09');
  assert.strictEqual(R.nextAfter('2026-10-31', 3), '2026-11-03'); // US fall back Nov 1
  assert.strictEqual(R.nextAfter('2026-03-28', 2), '2026-03-30'); // EU spring forward Mar 29
  assert.strictEqual(R.nextAfter('2026-10-24', 2), '2026-10-26'); // EU fall back Oct 25
  assert.strictEqual(R.nextAfter('2026-04-04', 1), '2026-04-05'); // AU DST end
});
t(`[${tz}] N is clamped 1..365, default 3`, () => {
  assert.strictEqual(S.clampEveryDays(''), 3); assert.strictEqual(S.clampEveryDays(0), 3); assert.strictEqual(S.clampEveryDays('7'), 7); assert.strictEqual(S.clampEveryDays(9999), 365);
});

if (process.env.ROUTINE_TZ_CHILD) return;

t('after-completion template: stored in scheduling v2 (recurrence.freq + everyDays, nextDate), occurs only on nextDate', () => {
  const a = tpl();
  assert.deepStrictEqual(a.recurrence, { freq: 'afterCompletion', everyDays: 3 });
  assert.strictEqual(a.nextDate, '2026-10-26');
  assert.ok(S.occursOn(a, '2026-10-26')); assert.ok(!S.occursOn(a, '2026-10-29'));
  assert.strictEqual(S.describeRecurrence(a.recurrence), 'Every 3 days after done');
  assert.strictEqual(S.describeRecurrence({ freq: S.AFTER, everyDays: 1 }), 'Every day after done');
});
t('completing: next = completion date + N (not the calendar); instance marked done; undo restores', () => {
  const a = tpl();
  let l = S.expandRecurring([a], '2026-10-26').list;
  assert.ok(l.some((e) => e.id === 'tA_2026-10-26'));
  const task = { title: 'Water plants', templateId: 'tA', scheduledFor: '2026-10-26', type: 'one-time' };
  // completed late, on Wed (it stayed until done): next is Sat, not Thu
  const done = R.markRoutineDone(l, task, '2026-10-28', true);
  const t2 = done.find((e) => e.id === 'tA');
  assert.strictEqual(t2.nextDate, '2026-10-31'); assert.deepStrictEqual(t2.doneOn, ['2026-10-28']); assert.strictEqual(t2.lastNext, '2026-10-26');
  assert.strictEqual(done.find((e) => e.id === 'tA_2026-10-26').done, true);
  const exp = S.expandRecurring(done, '2026-10-28').list;
  assert.ok(exp.some((e) => e.id === 'tA_2026-10-31'), 'next occurrence generated for Sat');
  const undo = R.markRoutineDone(exp, task, '2026-10-28', false);
  const t3 = undo.find((e) => e.id === 'tA');
  assert.strictEqual(t3.nextDate, '2026-10-26'); assert.deepStrictEqual(t3.doneOn, []);
  assert.ok(!undo.some((e) => e.id === 'tA_2026-10-31')); assert.ok(!undo.find((e) => e.id === 'tA_2026-10-26').done);
});
t('uncompleted after-completion occurrence rolls forward (stays until done)', () => {
  const a = tpl();
  const inst = { ...S.expandRecurring([a], '2026-10-26').list.find((e) => e.id === 'tA_2026-10-26'), materializedAt: '2026-10-26T08:00:00Z', materializedDate: '2026-10-26' };
  const l = [a, inst];
  assert.deepStrictEqual(S.rollAfterOf(l, '2026-10-26').length, 0);
  assert.deepStrictEqual(S.rollAfterOf(l, '2026-10-28').map((e) => e.id), ['tA_2026-10-26']);
  assert.deepStrictEqual(S.rollAfterOf(l.map((e) => (e.id === 'tA_2026-10-26' ? { ...e, done: true } : e)), '2026-10-28'), []);
});
t('calendar series: completion logs the occurrence date; Skip today adds to skip, no completion', () => {
  const d = S.buildRecurringTemplate({ title: 'Stretch' }, '2026-10-26', { freq: 'daily' }, 'tD');
  const task = { title: 'Stretch', templateId: 'tD', scheduledFor: '2026-10-27' };
  const l1 = R.markRoutineDone([d], task, '2026-10-27', true);
  assert.deepStrictEqual(l1[0].doneOn, ['2026-10-27']);
  assert.deepStrictEqual(R.markRoutineDone(l1, task, '2026-10-27', false)[0].doneOn, []);
  const sk = R.skipRoutineToday(l1, task, '2026-10-27')[0];
  assert.deepStrictEqual(sk.skip, ['2026-10-27']); assert.deepStrictEqual(sk.doneOn, []); assert.ok(!sk.stopped);
  assert.ok(!S.occursOn(sk, '2026-10-27')); assert.ok(S.occursOn(sk, '2026-10-28'), 'series continues tomorrow');
  assert.ok(R.canSkipToday(task, [d])); assert.ok(!R.canSkipToday({ ...task, completed: true }, [d])); assert.ok(!R.canSkipToday({ title: 'x' }, [d]));
});
t('after-completion Skip today: pushed to tomorrow (+1), no completion recorded', () => {
  const a = tpl({ start: '2026-10-27' });
  const l = S.expandRecurring([a], '2026-10-27').list;
  const out = R.skipRoutineToday(l, { templateId: 'tA', scheduledFor: '2026-10-27' }, '2026-10-27');
  const x = out.find((e) => e.id === 'tA');
  assert.strictEqual(x.nextDate, '2026-10-28'); assert.deepStrictEqual(x.doneOn || [], []);
  assert.ok(out.find((e) => e.id === 'tA_2026-10-27').done);
  assert.ok(S.expandRecurring(out, '2026-10-27').list.some((e) => e.id === 'tA_2026-10-28'));
});
t('doneOn is pruned to ~70 days', () => {
  const d = { ...S.buildRecurringTemplate({ title: 'S' }, '2026-01-01', { freq: 'daily' }, 'tD'), doneOn: ['2026-01-02', '2026-10-01'] };
  assert.deepStrictEqual(R.markRoutineDone([d], { templateId: 'tD', scheduledFor: '2026-10-27' }, '2026-10-27', true)[0].doneOn, ['2026-10-01', '2026-10-27']);
});
t("today's checklist: routines due today with their task; done from doneOn or task.completed", () => {
  const d = { ...S.buildRecurringTemplate({ title: 'Stretch' }, '2026-10-26', { freq: 'daily' }, 'tD'), doneOn: ['2026-10-27'] };
  const w = S.buildRecurringTemplate({ title: 'Gym' }, '2026-10-26', { freq: 'weekly', days: [1, 3] }, 'tW'); // Mon, Wed
  const a = tpl({ start: '2026-10-25' }); // overdue since Sun -> still due today
  const j = S.buildRecurringTemplate({ title: 'Journal' }, '2026-10-26', { freq: 'daily' }, 'tJ');
  const day = [{ title: 'Journal', templateId: 'tJ', scheduledFor: '2026-10-27' }, { title: 'Water plants', templateId: 'tA', scheduledFor: '2026-10-27' }, { title: 'one-off' }];
  const items = R.routineToday([d, w, a, j], day, '2026-10-27');
  assert.deepStrictEqual(items.map((i) => [i.title, i.done, !!i.task]), [['Stretch', true, false], ['Water plants', false, true], ['Journal', false, true]]);
  const both = R.routineToday([j], [{ title: 'Journal', templateId: 'tJ', scheduledFor: '2026-10-26' }, { title: 'Journal', templateId: 'tJ', scheduledFor: '2026-10-27' }], '2026-10-27');
  assert.strictEqual(both[0].task.scheduledFor, '2026-10-27', "the chip toggles today's copy, not an overdue one");
});
t('weekly completion: X of Y + per-day states Mon–Sun', () => {
  const d = { ...S.buildRecurringTemplate({ title: 'Stretch' }, '2026-10-26', { freq: 'daily' }, 'tD'), doneOn: ['2026-10-26'] };
  const w = S.buildRecurringTemplate({ title: 'Gym' }, '2026-10-19', { freq: 'weekly', days: [1, 3] }, 'tW');
  const a = { ...tpl({ start: '2026-10-20' }), doneOn: ['2026-10-26'], nextDate: '2026-10-29' };
  const wk = R.routineWeek([d, w, a], '2026-10-27'); // Tue
  assert.deepStrictEqual(wk.days.map((x) => x.label).join(''), 'MTWTFSS');
  assert.deepStrictEqual(wk.days.map((x) => x.total), [3, 1, 2, 2, 1, 1, 1]);
  assert.deepStrictEqual(wk.days.map((x) => x.state), ['part', 'open', 'future', 'future', 'future', 'future', 'future']);
  assert.strictEqual(wk.done, 2); assert.strictEqual(wk.total, 11); assert.strictEqual(wk.label, 'This week: 2 of 11 routine tasks done');
  assert.strictEqual(R.routineWeek([], '2026-10-27').label, 'This week: 0 of 0 routine tasks done');
  const skipped = R.routineWeek([{ ...d, skip: ['2026-10-28'] }], '2026-10-27');
  assert.strictEqual(skipped.days[2].total, 0, 'skipped day is not counted as missed');
});
t('per-series reminder time: one routine ping per repeat day (cn_task kind), replaces the time ping, skips done days', () => {
  const now = new Date(2026, 9, 27, 6, 0); // Tue 06:00 local
  const w = { ...S.buildRecurringTemplate({ title: 'Vitamins', scheduledTime: '09:00', remindAt: '07:30' }, '2026-10-26', { freq: 'weekly', days: [2, 4] }, 'tV') };
  assert.strictEqual(w.remindAt, '07:30');
  const plan = N.planNotifications({ list: [w], todayTasks: [{ title: 'Vitamins', templateId: 'tV', scheduledId: 'tV_2026-10-27', scheduledFor: '2026-10-27', time: '09:00' }], todayStr: '2026-10-27', now, horizonDays: 7 });
  assert.deepStrictEqual(plan.map((p) => p.key), ['routine:tV_2026-10-27', 'routine:tV_2026-10-29', 'routine:tV_2026-11-03']);
  assert.ok(plan.every((p) => p.kind === 'routine' && p.at.getHours() === 7 && p.at.getMinutes() === 30));
  const done = N.planNotifications({ list: [{ ...w, doneOn: ['2026-10-27'] }], todayStr: '2026-10-27', now, horizonDays: 3 });
  assert.deepStrictEqual(done.map((p) => p.key), ['routine:tV_2026-10-29']);
  const noRemind = N.planNotifications({ list: [{ ...w, remindAt: undefined }], todayStr: '2026-10-27', now, horizonDays: 3 });
  assert.ok(noRemind.every((p) => p.key.startsWith('sched:')), 'no reminder time -> unchanged behavior');
  const a = { ...tpl({ fields: { remindAt: '20:00' } }), nextDate: '2026-10-25' };
  assert.deepStrictEqual(N.planNotifications({ list: [a], todayStr: '2026-10-27', now }).map((p) => p.key), ['routine:tA_2026-10-27'], 'overdue after-series: ping today');
  assert.strictEqual(load('utils/notifSound.js').soundKind('routine', 'routine:tV_2026-10-27'), 'task'); // -> cn_task.caf
});
t('picker schedule: validation + round-trip of everyDays / remindAt; remind-only edit keeps history', () => {
  const b = E.blankSchedule('2026-10-27');
  assert.strictEqual(b.everyDays, 3); assert.strictEqual(b.remindAt, '');
  assert.ok(E.REPEATS.includes('afterCompletion'));
  assert.strictEqual(E.validateSchedule({ ...b, on: true, repeat: 'afterCompletion', everyDays: 0 }, '2026-10-27'), 'Repeat every 1–365 days after you finish.');
  assert.strictEqual(E.validateSchedule({ ...b, on: true, repeat: 'afterCompletion', everyDays: 4 }, '2026-10-27'), '');
  assert.strictEqual(E.validateSchedule({ ...b, on: true, repeat: 'daily', remindAt: '25:00' }, '2026-10-27'), 'Pick a valid reminder time.');
  const a = { ...tpl({ fields: { remindAt: '08:00' } }), recurrence: { freq: S.AFTER, everyDays: 5 }, doneOn: ['2026-10-20'] };
  const sc = E.scheduleOfEntry(a);
  assert.strictEqual(sc.everyDays, 5); assert.strictEqual(sc.remindAt, '08:00'); assert.strictEqual(sc.repeat, 'afterCompletion');
  const d = { ...S.buildRecurringTemplate({ title: 'Stretch' }, '2026-10-26', { freq: 'daily' }, 'tD'), doneOn: ['2026-10-26'] };
  const task = { title: 'Stretch', templateId: 'tD', scheduledId: 'tD_2026-10-27', scheduledFor: '2026-10-27' };
  const s0 = E.scheduleOfTask(task, [d], '2026-10-27');
  const res = E.applyTaskSchedule({ list: [d], task, sched: { ...s0, remindAt: '06:45' }, scope: 'future', dayDate: '2026-10-27' });
  const d2 = res.list.find((e) => e.id === 'tD');
  assert.strictEqual(d2.remindAt, '06:45'); assert.deepStrictEqual(d2.doneOn, ['2026-10-26']); assert.strictEqual(res.task, task);
  const off = E.applyTaskSchedule({ list: res.list, task, sched: { ...s0, remindAt: '' }, scope: 'future', dayDate: '2026-10-27' });
  assert.ok(!('remindAt' in off.list.find((e) => e.id === 'tD')));
});
t('calendar feed: after-completion series exports only its next due date (no RRULE)', () => {
  const ev = I.feedEvents([{ ...tpl(), nextDate: '2026-10-29' }]);
  assert.strictEqual(ev.length, 1); assert.strictEqual(ev[0].date, '2026-10-29'); assert.ok(!ev[0].rrule);
});
console.log(`routine: ${n} passed`);
