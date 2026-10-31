// Run: node scripts/test-calendar-sync.js  (two-way calendar sync planner + .ics import; pure, no device)
const path = require('path'); const fs = require('fs'); const os = require('os');
process.env.TZ = 'America/New_York';
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calsync-'));
for (const f of fs.readdirSync(path.join(__dirname, '../src/utils')).filter((x) => x.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(__dirname, '../src/utils', f), 'utf8').replace(/from '\.\/([\w]+)(?:\.js)?'/g, "from './$1.mjs'").replace(/from '@\/utils\/([\w]+)'/g, "from './$1.mjs'"));
const C = await import(path.join(dir, 'calendarSync.mjs')); const S = await import(path.join(dir, 'scheduling.mjs'));
const assert = require('assert'); let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const now = new Date(2026, 9, 22, 8, 0).getTime(); // Thu 22 Oct 2026 08:00 local
const weekDates = S.weekDates(new Date(now));
const sched = [
  S.buildScheduledEntry({ title: 'Dentist', estimateMin: 45 }, '2026-10-30', '09:30', 'a1'),
  S.buildScheduledEntry({ title: 'no time' }, '2026-10-30', '', 'a2'),
  S.buildScheduledEntry({ title: 'far away' }, '2027-03-01', '10:00', 'a3'),
  S.buildRecurringTemplate({ title: 'gym' }, '2026-10-19', { freq: 'weekly', days: [1] }, 'tpl'),
];
const dayLists = { Thu: [{ title: 'Write report', startTime: '14:00', createdAt: 'c1' }, { title: 'done', startTime: '10:00', completed: true, createdAt: 'c2' }, { title: 'untimed', createdAt: 'c3' }],
  Fri: [{ title: 'Call mom', startTime: '18:15', estimateMin: 20, createdAt: 'c4' }, { title: 'rep', type: 'recurring', startTime: '07:00', createdAt: 'c5' }],
  Sat: [{ title: 'Mat', scheduledId: 'm9', scheduledFor: '2026-10-24', startTime: '11:00', createdAt: 'c6' }] };
const localAll = () => C.buildLocalEvents({ scheduled: sched, dayLists, weekDates, nowMs: now }); const local = () => localAll().filter((e) => !e.done);

await t('buildLocalEvents: timed, open, in-window tasks only', () => {
  const ev = local(); const keys = ev.map((e) => e.key).sort();
  assert.strictEqual(ev.length, 4, keys.join());
  assert.ok(keys.includes('s-a1') && keys.includes('s-m9'));
  const d = ev.find((e) => e.key === 's-a1'); assert.strictEqual(d.endMs - d.startMs, 45 * 60000); assert.strictEqual(d.startMs, new Date(2026, 9, 30, 9, 30).getTime());
  const w = ev.find((e) => e.title === 'Write report'); assert.ok(w.key.startsWith('t-')); assert.strictEqual(w.startMs, new Date(2026, 9, 22, 14, 0).getTime()); assert.strictEqual(w.endMs - w.startMs, 30 * 60000);
  assert.strictEqual(ev.find((e) => e.title === 'Call mom').startMs, new Date(2026, 9, 23, 18, 15).getTime());
});
await t('first sync creates every event', () => {
  const p = C.planSync(local(), [], {}); assert.strictEqual(p.creates.length, 4); assert.strictEqual(p.updates.length + p.removes.length + p.pullCreates.length, 0);
});
const linked = () => { const links = {}; const remote = []; local().forEach((e, i) => { links[e.key] = { id: 'E' + i, sig: e.sig }; remote.push({ id: 'E' + i, title: e.title, startMs: e.startMs, endMs: e.endMs, url: C.EVENT_URL_PREFIX + e.key }); }); return { links, remote }; };
await t('steady state is a no-op', () => {
  const { links, remote } = linked(); const p = C.planSync(local(), remote, { links });
  assert.deepStrictEqual([p.creates.length, p.updates.length, p.removes.length, p.pullUpdates.length, p.pullCreates.length], [0, 0, 0, 0, 0]);
});
await t('local change pushes an update', () => {
  const { links, remote } = linked(); const loc = local(); loc[0] = { ...loc[0], startMs: loc[0].startMs + 3600000, endMs: loc[0].endMs + 3600000 }; loc[0].sig = C.sigOf(loc[0]);
  const p = C.planSync(loc, remote, { links }); assert.strictEqual(p.updates.length, 1); assert.strictEqual(p.links[loc[0].key].sig, loc[0].sig);
});
await t('calendar edit pulls back (and wins a conflict)', () => {
  const { links, remote } = linked(); const loc = local(); const k = 's-a1'; const i = loc.findIndex((e) => e.key === k);
  const r = remote.find((x) => x.id === links[k].id); r.startMs = new Date(2026, 9, 31, 16, 0).getTime(); r.endMs = r.startMs + 60 * 60000; r.title = 'Dentist (moved)';
  loc[i] = { ...loc[i], title: 'Dentist!' }; loc[i].sig = C.sigOf(loc[i]); // both changed
  const p = C.planSync(loc, remote, { links });
  assert.strictEqual(p.updates.length, 0); assert.strictEqual(p.pullUpdates.length, 1);
  assert.deepStrictEqual(p.pullUpdates[0].fields, { title: 'Dentist (moved)', date: '2026-10-31', time: '16:00', minutes: 60 });
});
await t('event deleted in Calendar is respected, then resumes when the task changes', () => {
  const { links, remote } = linked(); const k = 's-a1'; const rem = remote.filter((r) => r.id !== links[k].id);
  const p = C.planSync(local(), rem, { links }); assert.strictEqual(p.creates.length, 0); assert.ok(p.suppressed[k]); assert.ok(!p.links[k]);
  const p2 = C.planSync(local(), rem, { links: p.links, suppressed: p.suppressed }); assert.strictEqual(p2.creates.length, 0);
  const loc = local().map((e) => (e.key === k ? { ...e, title: 'Dentist v2', sig: C.sigOf({ ...e, title: 'Dentist v2' }) } : e));
  const p3 = C.planSync(loc, rem, { links: p.links, suppressed: p.suppressed }); assert.strictEqual(p3.creates.length, 1); assert.ok(!p3.suppressed[k]);
});
await t('task deleted in ClingNote removes its event; stray own events removed', () => {
  const { links, remote } = linked(); const loc = local().filter((e) => e.key !== 's-a1');
  remote.push({ id: 'ORPHAN', title: 'x', startMs: now, endMs: now + 1, url: C.EVENT_URL_PREFIX + 's-gone' });
  const p = C.planSync(loc, remote, { links }); assert.deepStrictEqual(p.removes.sort(), [links['s-a1'].id, 'ORPHAN'].sort());
});
await t('new event in the ClingNote calendar becomes a task; lost links re-attach by URL', () => {
  const { remote } = linked(); remote.push({ id: 'NEW', title: 'Haircut', startMs: new Date(2026, 9, 27, 13, 0).getTime(), endMs: new Date(2026, 9, 27, 13, 40).getTime(), notes: 'bring card' });
  const p = C.planSync(local(), remote, {}); // links lost
  assert.strictEqual(p.creates.length, 0); assert.strictEqual(Object.keys(p.links).length, 4);
  assert.deepStrictEqual(p.pullCreates, [{ id: 'NEW', fields: { title: 'Haircut', date: '2026-10-27', time: '13:00', minutes: 40, notes: 'bring card' } }]);
});
await t('applyPullUpdates edits scheduled + day tasks, pins day-task id, skips locked days', () => {
  const k = C.keyOfDayTask(dayLists.Thu[0]); const kf = C.keyOfDayTask(dayLists.Fri[0]);
  const pulls = [{ key: 's-a1', fields: { title: 'D2', date: '2026-11-02', time: '08:00', minutes: 50 } }, { key: k, fields: { title: 'Report v2', date: '2026-10-22', time: '15:00', minutes: 90 } }, { key: 's-m9', fields: { title: 'Mat', date: '2026-10-25', time: '12:00', minutes: 30 } }, { key: kf, fields: { title: 'x', date: '2026-10-23', time: '19:00', minutes: 30 } }];
  const r = C.applyPullUpdates(sched, dayLists, pulls, { lockedDays: ['Fri'] });
  const a1 = r.scheduled.find((e) => e.id === 'a1'); assert.deepStrictEqual([a1.title, a1.scheduledDate, a1.scheduledTime, a1.estimateMin], ['D2', '2026-11-02', '08:00', 50]);
  const w = r.dayLists.Thu[0]; assert.deepStrictEqual([w.title, w.startTime, w.estimateMin, w.dueDate], ['Report v2', '15:00', 90, '2026-10-22']);
  assert.strictEqual(C.keyOfDayTask(w), k, 'key stays stable after a retitle');
  assert.strictEqual(r.dayLists.Sat[0].scheduledFor, '2026-10-25');
  assert.deepStrictEqual(r.skipped, [kf]); assert.strictEqual(r.dayLists.Fri[0].title, 'Call mom');
  assert.deepStrictEqual([...r.changedDays].sort(), ['Sat', 'Thu']); assert.ok(r.scheduledChanged);
  assert.strictEqual(sched[0].title, 'Dentist', 'input not mutated');
});
await t('runCalendarSync end-to-end with fake device calendar', async () => {
  const cal = new Map(); let seq = 0; let saved = null; let data = { scheduled: sched.slice(), dayLists, weekDates };
  const io = { loadLocal: async () => data, list: async () => [...cal.values()], upsert: async (ev, id) => { id = id || 'EV' + (++seq); cal.set(id, { id, title: ev.title, startMs: ev.startMs, endMs: ev.endMs, url: C.EVENT_URL_PREFIX + ev.key }); return id; },
    remove: async (id) => cal.delete(id), saveLocal: async (x) => { saved = x; data = { ...data, scheduled: x.scheduled, dayLists: x.dayLists }; }, makeId: () => 'new1', lockedDays: () => [],
    buildEntry: (f, id) => S.buildScheduledEntry({ title: f.title, estimateMin: f.minutes }, f.date, f.time, id) };
  let r = await C.runCalendarSync(io, {}, now); assert.strictEqual(r.summary.pushed, 4); assert.strictEqual(cal.size, 4);
  r = await C.runCalendarSync(io, r.state, now); assert.deepStrictEqual(r.summary, { pushed: 0, updated: 0, removed: 0, pulled: 0, imported: 0, failed: 0, merged: 0, linked: 0 });
  const ev = cal.get(r.state.links['s-a1'].id); ev.startMs += 2 * 3600000; ev.endMs += 2 * 3600000; // moved in Calendar
  cal.set('USER1', { id: 'USER1', title: 'Yoga', startMs: new Date(2026, 9, 26, 7, 0).getTime(), endMs: new Date(2026, 9, 26, 8, 0).getTime() });
  r = await C.runCalendarSync(io, r.state, now); assert.strictEqual(r.summary.pulled, 1); assert.strictEqual(r.summary.imported, 1);
  assert.strictEqual(data.scheduled.find((e) => e.id === 'a1').scheduledTime, '11:30'); assert.ok(data.scheduled.find((e) => e.id === 'new1' && e.title === 'Yoga'));
  r = await C.runCalendarSync(io, r.state, now); assert.deepStrictEqual(r.summary, { pushed: 0, updated: 0, removed: 0, pulled: 0, imported: 0, failed: 0, merged: 0, linked: 0 }, 'converged');
  assert.ok(saved);
});
await t('runCalendarSync: failed save links nothing (retried next run)', async () => {
  const io = { loadLocal: async () => ({ scheduled: [], dayLists: {}, weekDates }), list: async () => [{ id: 'U', title: 'Yoga', startMs: now + 3600000, endMs: now + 7200000 }], upsert: async () => 'x', remove: async () => {},
    saveLocal: async () => { throw new Error('offline'); }, makeId: () => 'n', buildEntry: (f, id) => ({ id, ...f }) };
  const r = await C.runCalendarSync(io, { links: {} }, now); assert.ok(r.error); assert.deepStrictEqual(r.state, { links: {} });
});
await t('parseIcs: timed, UTC, all-day, folded lines, escapes, junk', () => {
  const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:1', 'SUMMARY:Team\\, sync', 'DTSTART;TZID=America/New_York:20261029T093000', 'DTEND;TZID=America/New_York:20261029T101500', 'DESCRIPTION:line1\\nline2', 'END:VEVENT',
    'BEGIN:VEVENT', 'SUMMARY:UTC one', 'DTSTART:20261030T140000Z', 'DURATION:PT1H', 'END:VEVENT',
    'BEGIN:VEVENT', 'SUMMARY:Holi', ' day', 'DTSTART;VALUE=DATE:20261101', 'END:VEVENT', 'BEGIN:VEVENT', 'DTSTART:20261101T100000', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const r = C.parseIcs(ics); assert.ok(r.ok); assert.strictEqual(r.skipped, 1);
  assert.deepStrictEqual(r.events.map((e) => [e.title, e.date, e.time, e.minutes]), [['Team, sync', '2026-10-29', '09:30', 45], ['UTC one', '2026-10-30', '10:00', 60], ['Holiday', '2026-11-01', '', 0]]);
  assert.strictEqual(r.events[0].notes, 'line1\nline2');
  assert.strictEqual(C.parseIcs('hello').ok, false);
});
await t('in-app rename keeps the link key (no duplicate event)', async () => {
  const a = { title: 'Old name', createdAt: '2026-10-22T10:00:00.000Z', startTime: '14:00' };
  assert.strictEqual(C.keyOfDayTask(a), C.keyOfDayTask({ ...a, title: 'New name' }));
});
console.log(`\n${n} calendar-sync tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
