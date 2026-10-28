// Run: node scripts/test-agenda.js  (native calendar: tasks land on the right dates with the right completion state)
const path = require('path'); const fs = require('fs'); const os = require('os');
process.env.TZ = 'America/New_York';
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-'));
for (const f of fs.readdirSync(path.join(__dirname, '../src/utils')).filter((x) => x.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(__dirname, '../src/utils', f), 'utf8').replace(/from '\.\/([\w]+)'/g, "from './$1.mjs'").replace(/from '@\/utils\/([\w]+)'/g, "from './$1.mjs'"));
const A = await import(path.join(dir, 'agenda.mjs')); const S = await import(path.join(dir, 'scheduling.mjs'));
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const today = '2026-10-22'; // Thu
const from = '2026-10-18'; const to = '2026-11-14';
const sched = [
  S.buildScheduledEntry({ title: 'future one-off' }, '2026-11-03', '09:30', 'a1'),
  S.buildRecurringTemplate({ title: 'weekly gym' }, '2026-10-19', { freq: 'weekly', days: [1, 4] }, 'tpl1'),
];
const dayLists = { Thu: [{ title: 'write', completed: true, createdAt: 'x' }, { title: 'sched-mat', scheduledId: 'm1', scheduledFor: '2026-10-23', completed: false }], Fri: [{ title: 'daily rep', type: 'recurring', repeatDays: ['Fri', 'Sat'], completed: true, createdAt: 'y' }] };
const ag = A.agendaForRange({ scheduled: sched, dayLists, today, from, to });
t('one-off appears on its date', () => { const i = ag['2026-11-03']; assert.equal(i.length, 1); assert.equal(i[0].title, 'future one-off'); assert.equal(i[0].time, '09:30'); assert.equal(i[0].done, false); });
t('recurring template on its weekdays only (Mon/Thu), from today', () => { assert.ok(ag['2026-10-26'].some((x) => x.title === 'weekly gym' && x.recurring)); assert.ok(ag['2026-11-05'].some((x) => x.title === 'weekly gym')); assert.ok(!ag['2026-10-27'].some((x) => x.title === 'weekly gym')); assert.ok(!ag['2026-10-19'].some((x) => x.title === 'weekly gym')); assert.ok(ag['2026-10-22'].some((x) => x.title === 'weekly gym')); });
t('today list task shows with completion state', () => assert.equal(ag['2026-10-22'].find((x) => x.title === 'write').done, true));
t('materialized scheduled task sits on its scheduled date', () => { assert.ok(!ag['2026-10-22'].some((x) => x.title === 'sched-mat')); assert.equal(ag['2026-10-23'].find((x) => x.title === 'sched-mat').done, false); });
t('recurring list task: real state this week, undone in later weeks', () => { assert.equal(ag['2026-10-23'].find((x) => x.title === 'daily rep').done, true); assert.equal(ag['2026-10-30'].find((x) => x.title === 'daily rep').done, false); assert.ok(ag['2026-10-30'].find((x) => x.title === 'daily rep').recurring); });
t('one-off list tasks do not leak into future weeks', () => assert.ok(!ag['2026-10-29'].some((x) => x.title === 'write')));
t('generated instance is not duplicated by its template', () => {
  const inst = { ...S.buildScheduledEntry({ title: 'weekly gym' }, '2026-10-26', '', 'tpl1_2026-10-26'), templateId: 'tpl1' };
  const a2 = A.agendaForRange({ scheduled: [...sched, inst], dayLists, today, from, to });
  assert.equal(a2['2026-10-26'].filter((x) => x.title === 'weekly gym').length, 1);
});
t('completed instance shows done on its day (from the list task)', () => {
  const dl = { ...dayLists, Mon: [{ title: 'weekly gym', scheduledId: 'tpl1_2026-10-19', scheduledFor: '2026-10-19', completed: true }] };
  const a3 = A.agendaForRange({ scheduled: sched, dayLists: dl, today, from, to });
  assert.equal(a3['2026-10-19'].find((x) => x.title === 'weekly gym').done, true);
});
t('week helpers', () => { assert.equal(A.weekStartOf('2026-10-22'), '2026-10-18'); assert.equal(A.dowOf('2026-10-22'), 4); });
t('upcoming: only dated tasks after today; no undated routine tasks, no repeats', () => {
  const dl = { Thu: [{ title: 'undated thu', createdAt: 1 }], Fri: [{ title: 'undated fri', createdAt: 2 }, { title: 'due sat', createdAt: 3, dueDate: '2026-10-24' }], Wed: [{ title: 'daily rep', repeatDays: [0, 1, 2, 3, 4, 5, 6] }] };
  const sc = [S.buildScheduledEntry({ title: 'dentist' }, '2026-10-23', '', 'd1'), S.buildScheduledEntry({ title: 'old' }, '2026-10-21', '', 'o1')];
  const u = A.datedFutureOnly(A.agendaForRange({ scheduled: sc, dayLists: dl, today: '2026-10-22', from: '2026-10-18', to: '2026-10-24' }), '2026-10-22');
  const all = Object.values(u).flat().map((x) => x.title).sort();
  assert.deepEqual(all, ['dentist', 'due sat']);
  assert.ok(u['2026-10-22'].length === 0 && u['2026-10-21'].length === 0, 'today and past empty');
  const v = require('fs').readFileSync(require('path').join(__dirname, '../src/views/UpcomingView.vue'), 'utf8');
  assert.ok(/const agenda = computed\(\(\) => datedFutureOnly\(agendaForRange\(/.test(v), 'UpcomingView applies the filter');
});
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
