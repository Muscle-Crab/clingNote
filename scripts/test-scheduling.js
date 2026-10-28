// Run: node scripts/test-scheduling.js  (scheduled / recurring task visibility)
const path = require('path'); const fs = require('fs'); const os = require('os');
process.env.TZ = 'America/New_York';
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-'));
for (const f of fs.readdirSync(path.join(__dirname, '../src/utils')).filter((x) => x.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(__dirname, '../src/utils', f), 'utf8').replace(/from '\.\/(\w+)'/g, "from './$1.mjs'"));
const S = await import(path.join(dir, 'scheduling.mjs'));
const ST = await import(path.join(dir, 'streak.mjs'));
const R = await import(path.join(dir, 'ranking.mjs'));
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const mk = (title, date, id) => S.buildScheduledEntry({ title }, date, '', id);
const fri = mk('report', '2026-10-30', 'f'); // Fri Oct 30 2026 -> visible from Mon Oct 26
t('mondayOf / sundayOf', () => { assert.equal(S.mondayOf('2026-10-30'), '2026-10-26'); assert.equal(S.sundayOf('2026-10-30'), '2026-11-01'); assert.equal(S.mondayOf('2026-10-26'), '2026-10-26'); assert.equal(S.mondayOf('2026-11-01'), '2026-10-26'); });
t('hidden before its week (Sun Oct 25)', () => { assert.ok(!S.isScheduledVisible('2026-10-30', '2026-10-25')); assert.deepEqual(S.dueOf([fri], '2026-10-25'), []); assert.deepEqual(S.futureOf([fri], '2026-10-25').map((e) => e.id), ['f']); assert.equal(S.materializeDue({ scheduled: [fri], todayStr: '2026-10-25', todayTasks: [], nowIso: '2026-10-25T12:00:00Z' }).toAdd.length, 0); });
t('v2: visible on its date only (not the Monday before)', () => { assert.ok(!S.isScheduledVisible('2026-10-30', '2026-10-26')); assert.ok(!S.isScheduledVisible('2026-10-30', '2026-10-29')); assert.ok(S.isScheduledVisible('2026-10-30', '2026-10-30')); assert.deepEqual(S.dueOf([fri], '2026-10-30').map((e) => e.id), ['f']); assert.deepEqual(S.futureOf([fri], '2026-10-29').map((e) => e.id), ['f']); });
t('v2: Sunday- and Monday-dated tasks appear on their own day', () => { assert.ok(!S.isScheduledVisible('2026-11-01', '2026-10-31')); assert.ok(S.isScheduledVisible('2026-11-01', '2026-11-01')); assert.ok(S.isScheduledVisible('2026-10-26', '2026-10-26')); });
t('v2: missed date still materializes later (overdue)', () => { assert.deepEqual(S.dueOf([fri], '2026-11-02').map((e) => e.id), ['f']); });
t('materialized copy gets due badge + dueDate', () => { const r = S.materializeDue({ scheduled: [fri], todayStr: '2026-10-30', todayTasks: [], nowIso: '2026-10-30T12:00:00Z' }); const task = r.toAdd[0]; assert.equal(task.dueDate, '2026-10-30'); assert.equal(S.dueBadge(task, '2026-10-26'), 'Due Fri Oct 30'); assert.equal(S.dueBadge(task, '2026-10-30'), 'Due today'); assert.equal(S.dueBadge(task, '2026-10-31'), 'Overdue · Fri Oct 30'); assert.equal(r.scheduled[0].materializedDate, '2026-10-30'); });
t('roll forward through the week, stop after due date', () => { const e = { ...fri, materializedAt: 'x', materializedDate: '2026-10-26' }; assert.equal(S.rollForwardOf([e], '2026-10-27').length, 1); assert.equal(S.rollForwardOf([e], '2026-10-31').length, 0); assert.equal(S.rollForwardOf([{ ...e, done: true }], '2026-10-27').length, 0); });
t('excluded from streak/points before its week (visibility guard)', () => {
  const hidden = { title: 'x', scheduledFor: '2026-10-30', createdAt: 'c' };
  assert.ok(!S.isTaskVisibleOn(hidden, '2026-10-25')); assert.ok(S.isTaskVisibleOn(hidden, '2026-10-30')); assert.ok(S.isTaskVisibleOn({ title: 'normal' }, '2026-10-25'));
  // only visible tasks are fed into streak / ranking toggles
  let s = null; let d = null;
  for (const task of [hidden, { title: 'a', createdAt: '1' }]) { if (!S.isTaskVisibleOn(task, '2026-10-25')) continue; s = ST.applyTaskToggle(s, '2026-10-25', { key: task.createdAt, completed: true }); d = R.applyMonthlyToggle(d, '2026-10-25', { key: task.createdAt, completed: true }); }
  assert.equal(ST.todayCount(s, '2026-10-25'), 1); assert.equal(R.computeStats(d).points, 10);
});
const tue = S.buildRecurringTemplate({ title: 'Trash' }, '2026-10-20', { freq: 'weekly', days: [2] }, 'tpl');
t('every Tuesday: occurrences', () => { assert.deepEqual(S.nextOccurrences(tue, '2026-10-21', 3), ['2026-10-27', '2026-11-03', '2026-11-10']); assert.equal(S.describeRecurrence(tue.recurrence), 'Every Tue'); });
t('recurring: generate one instance for the current week, visible on its day', () => { const r = S.expandRecurring([tue], '2026-10-26'); assert.deepEqual(r.added.map((e) => e.id), ['tpl_2026-10-27']); assert.equal(r.added[0].scheduledDate, '2026-10-27'); assert.deepEqual(S.dueOf(r.list, '2026-10-26'), []); assert.deepEqual(S.dueOf(r.list, '2026-10-27').map((e) => e.id), ['tpl_2026-10-27']); assert.deepEqual(S.expandRecurring([tue], '2026-10-25').added.map((e) => e.id), ['tpl_2026-10-20']); /* this week's past occurrence -> overdue */ });
t('recurring: no duplicates on re-run / after materialize', () => {
  let r = S.expandRecurring([tue], '2026-10-26'); let r2 = S.expandRecurring(r.list, '2026-10-27'); assert.equal(r2.added.length, 0);
  const m = S.materializeDue({ scheduled: r.list, todayStr: '2026-10-27', todayTasks: [], nowIso: '2026-10-27T12:00:00Z' }); assert.equal(m.toAdd.length, 1);
  const pruned = m.scheduled.filter((e) => e.id !== 'tpl_2026-10-27'); // even if the instance entry was pruned, `generated` prevents re-creation
  assert.equal(S.expandRecurring(pruned, '2026-10-28').added.length, 0);
  assert.equal(S.materializeDue({ scheduled: m.scheduled, todayStr: '2026-10-27', todayTasks: m.toAdd, nowIso: '2026-10-27T12:00:00Z' }).toAdd.length, 0);
});
t('recurring: next week generates the next Tuesday only; instances independent', () => { let r = S.expandRecurring([tue], '2026-10-26'); r = S.expandRecurring(r.list, '2026-11-02'); assert.deepEqual(r.added.map((e) => e.id), ['tpl_2026-11-03']); const ids = r.list.filter((e) => e.templateId).map((e) => e.id); assert.deepEqual(ids, ['tpl_2026-10-27', 'tpl_2026-11-03']); });
t('stopped template generates nothing; templates never appear as tasks', () => { assert.equal(S.expandRecurring([{ ...tue, stopped: true }], '2026-10-26').added.length, 0); assert.deepEqual(S.dueOf([tue], '2026-10-26'), []); assert.deepEqual(S.futureOf([tue], '2026-10-01'), []); });
t('daily and monthly', () => { const dly = S.buildRecurringTemplate({ title: 'd' }, '2026-10-28', { freq: 'daily' }, 'd'); assert.deepEqual(S.expandRecurring([dly], '2026-10-27').added.map((e) => e.scheduledDate), ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']); const mo = S.buildRecurringTemplate({ title: 'm' }, '2026-01-31', { freq: 'monthly' }, 'm'); assert.deepEqual(S.nextOccurrences(mo, '2026-01-31', 2), ['2026-02-28', '2026-03-31']); });
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
