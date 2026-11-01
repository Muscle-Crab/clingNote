// Run: node scripts/test-sched-v2.js  (scheduling v2: edit ops, schedule switch, notification plan/cap)
const path = require('path'); const fs = require('fs'); const os = require('os');
process.env.TZ = 'America/New_York';
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schedv2-'));
for (const f of fs.readdirSync(path.join(__dirname, '../src/utils')).filter((x) => x.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(__dirname, '../src/utils', f), 'utf8').replace(/from '\.\/([\w-]+)\.js'/g, "from './$1.mjs'").replace(/from '@\/utils\/([\w-]+)'/g, "from './$1.mjs'"));
const S = await import(path.join(dir, 'scheduling.mjs'));
const E = await import(path.join(dir, 'schedEdit.mjs'));
const N = await import(path.join(dir, 'schedNotify.mjs'));
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const D = '2026-10-27'; // Tue
const plain = { title: 'Write', createdAt: 'c1', priority: 'low' };
const sch = (o) => ({ ...E.blankSchedule(D), on: true, date: D, ...o });

t('validate', () => {
  assert.equal(E.validateSchedule(sch({ date: '2026-10-26', repeat: 'never' }), D), 'Pick today or a later date.');
  assert.equal(E.validateSchedule(sch({ repeat: 'weekly', days: [] })), 'Pick at least one weekday.');
  assert.equal(E.validateSchedule(sch({ repeat: 'daily', until: '2026-10-01' })), 'End date must be on or after the start date.');
  assert.equal(E.validateSchedule(sch({ repeat: 'monthly', dayOfMonth: 40 })), 'Day of month must be 1–31.');
  assert.equal(E.validateSchedule({ on: false }), '');
});
t('switch on (today, time) keeps task in place with time + reminder', () => {
  const r = E.applyTaskSchedule({ list: [], task: plain, sched: sch({ time: '09:30' }), dayDate: D });
  assert.equal(r.task.scheduledFor, D); assert.equal(r.task.time, '09:30'); assert.deepEqual(r.task.reminder, { date: D, time: '09:30', repeat: '' }); assert.ok(r.task.scheduledId); assert.equal(r.list.length, 0);
  assert.equal(S.scheduleLabel(r.task), '⏰ 9:30 AM');
});
t('switch on (future date) moves task to an entry', () => {
  const r = E.applyTaskSchedule({ list: [], task: plain, sched: sch({ date: '2026-10-30', time: '08:00' }), dayDate: D });
  assert.equal(r.task, null); assert.equal(r.list[0].scheduledDate, '2026-10-30'); assert.equal(r.list[0].scheduledTime, '08:00'); assert.ok(!('createdAt' in r.list[0]));
});
t('switch off strips schedule and its record', () => {
  const on = E.applyTaskSchedule({ list: [], task: plain, sched: sch({ time: '09:30' }), dayDate: D }).task;
  const r = E.applyTaskSchedule({ list: [{ id: on.scheduledId, title: 'Write', scheduledDate: D, materializedAt: 'x' }], task: on, sched: { on: false }, dayDate: D });
  assert.ok(!r.task.scheduledFor && !r.task.reminder && !r.task.scheduledId); assert.equal(r.task.time, ''); assert.equal(r.list.length, 0); assert.equal(S.scheduleLabel(r.task), '');
});
t('one-time -> recurring links today as first occurrence', () => {
  const r = E.applyTaskSchedule({ list: [], task: plain, sched: sch({ repeat: 'weekly', days: [2, 4], time: '07:00' }), dayDate: D });
  const tpl = r.list[0]; assert.ok(tpl.recurrence); assert.deepEqual(tpl.generated, [D]);
  assert.equal(r.task.templateId, tpl.id); assert.equal(r.task.scheduledId, S.instanceId(tpl.id, D)); assert.equal(S.scheduleLabel(r.task), '🔁 Every Tue, Thu · 7:00 AM');
  assert.equal(S.expandRecurring(r.list, D).added.map((e) => e.scheduledDate).join(), '2026-10-29'); // no duplicate today
});
t('recurring not occurring today: task leaves the list, series takes over', () => {
  const r = E.applyTaskSchedule({ list: [], task: plain, sched: sch({ repeat: 'weekly', days: [5] }), dayDate: D });
  assert.equal(r.task, null); assert.equal(r.list.length, 1);
});
const mkSeries = () => { const r = E.applyTaskSchedule({ list: [], task: plain, sched: sch({ repeat: 'daily', time: '07:00' }), dayDate: D }); return { list: S.expandRecurring(r.list, D).list, task: r.task, tpl: r.list[0] }; };
t('occurrence: "this one" only changes its time; series intact', () => {
  const { list, task } = mkSeries();
  const r = E.applyTaskSchedule({ list, task, sched: sch({ repeat: 'daily', time: '10:00' }), scope: 'this', dayDate: D });
  assert.equal(r.task.time, '10:00'); assert.deepEqual(r.list, list);
});
t('occurrence: "all future" ends old series today, new series from today', () => {
  const { list, task, tpl } = mkSeries();
  const r = E.applyTaskSchedule({ list, task, sched: sch({ repeat: 'weekly', days: [2], time: '10:00' }), scope: 'future', dayDate: D });
  const old = r.list.find((e) => e.id === tpl.id); assert.ok(old.stopped || old.recurrence.until < D);
  assert.equal(r.list.filter((e) => e.templateId === tpl.id && !e.materializedAt).length, 0, 'old future instances removed');
  assert.notEqual(r.task.templateId, tpl.id); assert.equal(r.task.time, '10:00');
});
t('occurrence off: "this one" detaches, "all future" also stops series', () => {
  const { list, task, tpl } = mkSeries();
  const a = E.applyTaskSchedule({ list, task, sched: { on: false }, scope: 'this', dayDate: D }); assert.ok(!a.task.templateId); assert.deepEqual(a.list, list);
  const b = E.applyTaskSchedule({ list, task, sched: { on: false }, scope: 'future', dayDate: D }); assert.equal(b.list.find((e) => e.id === tpl.id).recurrence.until, D);
  assert.equal(S.expandRecurring(b.list, '2026-11-02').added.length, 0);
});
t('recurring -> one-time (today) stops series', () => {
  const { list, task, tpl } = mkSeries();
  const r = E.applyTaskSchedule({ list, task, sched: sch({ repeat: 'never', time: '12:00' }), scope: 'future', dayDate: D });
  assert.ok(!r.task.templateId); assert.equal(r.task.time, '12:00'); assert.equal(r.list.find((e) => e.id === tpl.id).recurrence.until, D);
});
t('delete occurrence: this vs future', () => {
  const { list, task, tpl } = mkSeries();
  assert.equal(E.deleteTaskScope(list, task, 'this', D), list);
  const f = E.deleteTaskScope(list, task, 'future', D); assert.equal(f.find((e) => e.id === tpl.id).stopped, true);
});
t('upcoming instance: skip one / end series / edit this one', () => {
  const { list, tpl } = mkSeries(); const inst = list.find((e) => e.templateId === tpl.id && e.scheduledDate === '2026-10-29');
  const sk = E.deleteEntry(list, inst.id, 'this'); assert.ok(!sk.find((e) => e.id === inst.id)); assert.ok(sk.find((e) => e.id === tpl.id).skip.includes('2026-10-29'));
  assert.ok(!S.occursOn(sk.find((e) => e.id === tpl.id), '2026-10-29'));
  const fu = E.deleteEntry(list, inst.id, 'future'); assert.equal(fu.find((e) => e.id === tpl.id).recurrence.until, '2026-10-28');
  const ed = E.editEntry(list, inst.id, {}, sch({ date: '2026-10-29', time: '15:00' }), 'this', D);
  assert.ok(ed.find((e) => !e.templateId && !e.recurrence && e.scheduledDate === '2026-10-29' && e.scheduledTime === '15:00'));
});
t('until + skip respected by occursOn; template keeps until', () => {
  const tpl = S.buildRecurringTemplate({ title: 'x' }, D, { freq: 'daily', until: '2026-10-29' }, 'u');
  assert.deepEqual(S.occurrencesBetween(tpl, D, '2026-11-05'), ['2026-10-27', '2026-10-28', '2026-10-29']);
});
t('scheduledOverdue: after time passes / end of day when no time', () => {
  const tk = { scheduledFor: D, time: '09:00' };
  assert.ok(!S.scheduledOverdue(tk, new Date(2026, 9, 27, 8, 59))); assert.ok(S.scheduledOverdue(tk, new Date(2026, 9, 27, 9, 0)));
  assert.ok(!S.scheduledOverdue({ scheduledFor: D }, new Date(2026, 9, 27, 23, 0))); assert.ok(S.scheduledOverdue({ scheduledFor: D }, new Date(2026, 9, 28, 0, 1)));
  assert.ok(!S.scheduledOverdue({ ...tk, completed: true }, new Date(2026, 10, 1)));
});
t('notification plan: future only, completed skipped, nearest first, capped', () => {
  const now = new Date(2026, 9, 27, 8, 0);
  const tpl = S.buildRecurringTemplate({ title: 'Meds', scheduledTime: '09:00' }, D, { freq: 'daily' }, 'm');
  const p = N.planNotifications({ list: [tpl], todayTasks: [], todayStr: D, now, budget: 48 });
  assert.equal(p.length, 36); assert.equal(p[0].key, 'sched:m_2026-10-27'); assert.ok(p[0].at < p[1].at);
  const many = Array.from({ length: 5 }, (_, i) => S.buildRecurringTemplate({ title: 'T' + i, scheduledTime: '09:0' + i }, D, { freq: 'daily' }, 't' + i));
  assert.equal(N.planNotifications({ list: many, todayStr: D, now }).length, N.SCHED_BUDGET); assert.ok(N.SCHED_BUDGET < N.IOS_PENDING_LIMIT);
  assert.equal(N.planNotifications({ list: many, todayStr: D, now, budget: 10 }).length, 10);
  const done = { scheduledId: 'm_2026-10-27', scheduledFor: D, time: '09:00', completed: true, title: 'Meds' };
  const tpl2 = { ...tpl, generated: [D] };
  assert.ok(!N.planNotifications({ list: [tpl2], todayTasks: [done], todayStr: D, now }).some((x) => x.key === 'sched:m_2026-10-27'));
  assert.ok(N.planNotifications({ list: [tpl2], todayTasks: [{ ...done, completed: false }], todayStr: D, now }).some((x) => x.key === 'sched:m_2026-10-27'));
  const late = N.planNotifications({ list: [S.buildScheduledEntry({ title: 'a' }, D, '07:00', 'a')], todayStr: D, now }); assert.equal(late.length, 0);
  assert.equal(N.planNotifications({ list: [{ ...tpl, stopped: true }], todayStr: D, now }).length, 0);
});
t('diffPlan cancels removed keys', () => { assert.deepEqual(N.diffPlan(['sched:a', 'sched:b'], [{ key: 'sched:b' }]).cancel, ['sched:a']); });
t('week-strip counts include template occurrences', () => { const tpl = S.buildRecurringTemplate({ title: 'x' }, D, { freq: 'weekly', days: [4] }, 'w'); assert.deepEqual(S.countsByDate([tpl], D), { '2026-10-29': 1 }); });
const M = require('../netlify/functions/lib/managerPal.js');
t('manager-pal: Public scheduled/recurring with times; private hidden; overdue after time', () => {
  const now = new Date(2026, 9, 27, 10, 0);
  const tpl = S.buildRecurringTemplate({ title: 'Gym', visibility: 'public', scheduledTime: '18:00' }, D, { freq: 'weekly', days: [2, 4] }, 'g');
  const priv = S.buildRecurringTemplate({ title: 'Secret', visibility: 'private', scheduledTime: '08:00' }, D, { freq: 'daily' }, 'p');
  const one = S.buildScheduledEntry({ title: 'Dentist' }, D, '09:00', 'o');
  const later = S.buildScheduledEntry({ title: 'Far' }, '2026-12-01', '', 'f');
  const v = M.viewScheduled([tpl, priv, one, later, { ...one, id: 'm', materializedAt: 'x' }], now);
  assert.deepEqual(v.map((x) => x.key), ['sched:o', 'sched:g_2026-10-27', 'sched:g_2026-10-29']);
  assert.equal(v[0].overdue, true); assert.equal(v[1].overdue, false); assert.deepEqual(v[1].scheduled, { date: D, time: '18:00', repeat: 'Every Tue, Thu' }); assert.equal(v[1].day, 'Tuesday');
  assert.ok(!JSON.stringify(v).includes('Secret'));
  const day = M.viewTasks([{ day: 'Tuesday', tasks: [{ id: 'x', title: 'Occ', scheduledFor: D, time: '09:30', reminder: { date: D, time: '09:30' }, templateId: 'g', repeatText: 'Every Tue' }] }], now);
  assert.equal(day[0].overdue, true); assert.deepEqual(day[0].scheduled, { date: D, time: '09:30', repeat: 'Every Tue' });
  for (const k of Object.keys(v[0])) assert.ok(['key', 'day', 'title', 'completed', 'important', 'reminder', 'overdue', 'upcoming', 'scheduled'].includes(k), k);
});
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
