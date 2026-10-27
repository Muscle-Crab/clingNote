// Run: node scripts/test-task-transfer.js — task export (JSON/CSV) + validated, deduped JSON import (src/utils/taskTransfer.js, src/utils/fileSave.js).
const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => {
const cp = (f) => { const tmp = path.join(os.tmpdir(), `tt-${path.basename(f, '.js')}-${process.pid}.mjs`); fs.copyFileSync(path.join(__dirname, '../src/utils', f), tmp); return import(tmp); };
const X = await cp('taskTransfer.js'); const F = await cp('fileSave.js');
const assert = require('assert'); let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const now = new Date('2026-10-27T14:00:00Z');
const dayLists = {
  Mon: [{ title: 'Write report', createdAt: '2026-10-20T10:00:00.000Z', completed: false, type: 'one-time', importance: 'high', startTime: '09:00', estimateMin: 45, labels: ['Work'], notes: 'Q3, "final"', timerActive: true, timerEndTime: 'x', bossFight: true },
        { title: 'Gym', createdAt: '2026-10-01T10:00:00.000Z', completed: true, type: 'recurring', repeatDays: ['Mon', 'Wed'] }],
  Tue: [{ title: '=HYPERLINK("evil")', createdAt: '2026-10-21T10:00:00.000Z' }],
};
const scheduled = [{ id: 'sabc', title: 'Dentist', scheduledDate: '2026-11-05', scheduledTime: '15:30', estimateMin: 60 },
  { id: 'sold', title: 'Done thing', scheduledDate: '2026-10-01', scheduledTime: '', materializedAt: 'x' },
  { id: 'stpl', title: 'Water plants', scheduledDate: '2026-10-01', scheduledTime: '08:00', recurrence: { freq: 'weekly', days: [1, 4] }, startDate: '2026-10-01' }];
const exp = X.buildExport({ dayLists, scheduled, now });
await t('export shape', () => {
  assert.equal(exp.app, 'ClingNote'); assert.equal(exp.version, 1); assert.equal(exp.exportedAt, now.toISOString());
  assert.deepEqual(Object.keys(exp.days), X.DAY_NAMES); assert.equal(exp.days.Mon.length, 2); assert.equal(exp.days.Sun.length, 0);
  assert.equal(exp.scheduled.length, 2, 'materialized entries are left out (their task is in a day list)');
  assert.deepEqual(exp.scheduled[1].recurrence, { freq: 'weekly', days: [1, 4] });
});
await t('export strips runtime-only fields', () => { const m = exp.days.Mon[0]; assert.ok(!('timerActive' in m) && !('timerEndTime' in m) && !('bossFight' in m)); assert.equal(m.startTime, '09:00'); assert.deepEqual(m.labels, ['Work']); });
await t('CSV: header, quoting, formula guard, one row per task', () => {
  const csv = X.toCsv(exp); const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], X.CSV_COLUMNS.join(',')); assert.equal(lines.length, 1 + 3 + 2);
  assert.ok(csv.includes('"Q3, ""final"""')); assert.ok(csv.includes(`"'=HYPERLINK(""evil"")"`));
  assert.ok(lines.some((l) => l.startsWith('scheduled,Dentist,2026-11-05,15:30,no'))); assert.ok(lines.some((l) => l.startsWith('repeating,Water plants')));
  assert.ok(lines.some((l) => l.startsWith('Mon,Gym,,,yes,recurring')));
});
await t('round trip: export -> parse gives the same tasks', () => { const p = X.parseImport(JSON.stringify(exp)); assert.ok(p.ok); assert.equal(p.total, 5); assert.deepEqual(p.data.days.Mon, exp.days.Mon); assert.deepEqual(p.data.scheduled, exp.scheduled); });
await t('validation errors', () => {
  assert.match(X.parseImport('').error, /empty/); assert.match(X.parseImport('{oops').error, /valid JSON/);
  assert.match(X.parseImport('[1,2]').error, /ClingNote export/); assert.match(X.parseImport('{"app":"Todoist","days":{}}').error, /not a ClingNote/);
  assert.match(X.parseImport('{"app":"ClingNote","version":99,"days":{}}').error, /newer version/);
  assert.match(X.parseImport('{"app":"ClingNote","days":{"Mon":[{"title":""},{"nope":1}]}}').error, /No valid tasks/);
  assert.match(X.parseImport('{"app":"ClingNote","days":{"Mon":[]}}').error, /No tasks/);
  assert.match(X.parseImport(' '.repeat(2 * 1024 * 1024 + 1)).error, /too large/);
  const many = { app: 'ClingNote', days: { Mon: Array.from({ length: 2001 }, (_, i) => ({ title: `t${i}` })) } }; assert.match(X.parseImport(JSON.stringify(many)).error, /Too many/);
});
await t('field sanitising: types, lengths, bad dates/times, unknown keys', () => {
  const p = X.parseImport(JSON.stringify({ app: 'ClingNote', days: { Wed: [{ title: `  ${'x'.repeat(400)} `, startTime: '25:00', dueDate: '2026-13-45', estimateMin: 1e9, points: 'ten', importance: 'urgent!', labels: ['a', 5, ''], subtasks: [{ title: 'sub', done: 'yes' }, 'bad'], __proto__x: 1, uid: 'other', isPro: true }], Funday: [{ title: 'ignored' }] }, scheduled: [{ title: 'No date' }, { title: 'Ok', scheduledDate: '2026-11-01', scheduledTime: '7:00' }] }));
  assert.ok(p.ok); const w = p.data.days.Wed[0];
  assert.equal(w.title.length, 300); assert.ok(!w.startTime && !w.dueDate && !w.points && !w.importance && !('uid' in w) && !('isPro' in w));
  assert.equal(w.estimateMin, 1440); assert.deepEqual(w.labels, ['a']); assert.deepEqual(w.subtasks, [{ id: 'i0', title: 'sub', done: false }]);
  assert.equal(p.skipped, 1, 'scheduled entry without a date'); assert.equal(p.data.scheduled[0].scheduledTime, '', 'bad time dropped');
});
await t('BOM tolerated', () => assert.ok(X.parseImport(`\uFEFF${JSON.stringify(exp)}`).ok));
const parsed = X.parseImport(JSON.stringify(exp)).data;
await t('import into empty account: completed one-offs skipped, recurring kept open', () => {
  const r = X.planImport(parsed, {}, { now });
  assert.equal(r.days.Mon.length, 2); assert.equal(r.days.Mon[1].completed, false); assert.equal(r.days.Mon[1].title, 'Gym');
  assert.equal(r.scheduled.length, 2); assert.equal(r.counts.added, 5); assert.equal(r.counts.duplicates, 0);
  assert.equal(r.days.Mon[0].status, 'active'); assert.ok(!('id' in r.days.Mon[0]));
  const done = X.planImport({ days: { Mon: [{ title: 'x', completed: true, type: 'one-time' }] }, scheduled: [{ title: 'y', scheduledDate: '2026-11-01', scheduledTime: '', done: true }] }, {}, { now });
  assert.equal(done.counts.skippedDone, 2); assert.equal(done.counts.added, 0);
});
await t('re-importing the same file adds nothing (dedupe vs existing)', () => {
  const existing = { days: dayLists, scheduled };
  const r = X.planImport(parsed, existing, { now }); assert.equal(r.counts.added, 0); assert.equal(r.counts.duplicates, 5); assert.deepEqual(r.days, {}); assert.deepEqual(r.scheduled, []);
});
await t('dedupe by title+time+date (case/space-insensitive) and within the file', () => {
  const data = { days: { Fri: [{ title: 'Call  Mom', startTime: '18:00' }, { title: 'call mom', startTime: '18:00' }, { title: 'Call Mom', startTime: '19:00' }] },
    scheduled: [{ id: 'a1', title: 'Trip', scheduledDate: '2026-12-01', scheduledTime: '' }, { id: 'a2', title: 'trip', scheduledDate: '2026-12-01', scheduledTime: '' }, { id: 'sabc', title: 'Different', scheduledDate: '2026-12-02', scheduledTime: '' }] };
  const r = X.planImport(data, { days: { Fri: [{ title: 'CALL MOM', startTime: '19:00', createdAt: '2026-01-01T00:00:00Z' }] }, scheduled }, { now });
  assert.equal(r.days.Fri.length, 1); assert.equal(r.days.Fri[0].startTime, '18:00'); assert.equal(r.scheduled.length, 1, 'same id as existing = duplicate');
  assert.equal(r.counts.duplicates, 4);
});
await t('tasks without createdAt get distinct stamps (task identity is createdAt|title)', () => {
  const r = X.planImport({ days: { Sat: [{ title: 'A' }, { title: 'B' }] } }, {}, { now }); const [a, b] = r.days.Sat;
  assert.ok(a.createdAt && b.createdAt && a.createdAt !== b.createdAt); assert.ok(Date.parse(a.createdAt) < now.getTime());
});
await t('locked days are skipped', () => { const r = X.planImport(parsed, {}, { now, lockedDays: ['Mon'] }); assert.ok(!r.days.Mon); assert.equal(r.counts.skippedLocked, 2); });
await t('daily task limit: fresh tasks and scheduled dates', () => {
  const data = { days: { Sat: [{ title: 'A' }, { title: 'B' }, { title: 'C', createdAt: '2026-01-01T00:00:00Z' }] },
    scheduled: [{ title: 'S1', scheduledDate: '2026-11-01', scheduledTime: '' }, { title: 'S2', scheduledDate: '2026-11-01', scheduledTime: '' }, { title: 'T', scheduledDate: '2026-11-01', scheduledTime: '', recurrence: { freq: 'daily' } }] };
  const r = X.planImport(data, {}, { now, freshRoom: 1, scheduledRoom: () => 1 });
  assert.deepEqual(r.days.Sat.map((x) => x.title), ['A', 'C']); assert.deepEqual(r.scheduled.map((x) => x.title), ['S1', 'T']); assert.equal(r.counts.skippedLimit, 2);
});
await t('per-day and scheduled caps', () => {
  const big = Array.from({ length: 199 }, (_, i) => ({ title: `e${i}`, createdAt: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.${i}Z` }));
  const r = X.planImport({ days: { Sun: [{ title: 'n1', createdAt: '2026-02-01T00:00:00Z' }, { title: 'n2', createdAt: '2026-02-02T00:00:00Z' }] } }, { days: { Sun: big } }, { now });
  assert.equal(r.days.Sun.length, 1); assert.equal(r.counts.skippedFull, 1);
});
await t('generated / unsafe scheduled ids are replaced', () => { const r = X.planImport({ scheduled: [{ id: '', title: 'a', scheduledDate: '2026-11-01', scheduledTime: '' }, { id: '../../x y', title: 'b', scheduledDate: '2026-11-02', scheduledTime: '' }] }, {}, { now, makeId: (() => { let i = 0; return () => `gen${i++}`; })() }); assert.deepEqual(r.scheduled.map((e) => e.id), ['gen0', 'gen1']); });
await t('summary text', () => { assert.equal(X.importSummary({ added: 1, duplicates: 2, skippedDone: 0, skippedLocked: 1, skippedFull: 0, skippedLimit: 3 }, 1), 'Imported 1 task · 2 duplicates skipped · 1 skipped (locked day) · 3 over the daily task limit · 1 invalid.'); assert.equal(X.exportFileName('csv', now), 'clingnote-tasks-2026-10-27.csv'); });
await t('saveTextFile: web download, native share, cancel, no share', async () => {
  const clicked = []; const env = { document: { createElement: () => ({ click() { clicked.push(this.download); }, remove() {} }), body: { appendChild() {} } }, URL: { createObjectURL: () => 'blob:1', revokeObjectURL() {} }, Blob: function B() {}, File: function Fi(p, name) { this.name = name; } };
  assert.equal(await F.saveTextFile('x', 'a.json', 'application/json', { env }), 'downloaded'); assert.deepEqual(clicked, ['a.json']);
  const shared = []; const nav = { share: async (o) => { shared.push(o.files[0].name); }, canShare: () => true };
  assert.equal(await F.saveTextFile('x', 'b.csv', 'text/csv', { native: true, env: { ...env, navigator: nav } }), 'shared'); assert.deepEqual(shared, ['b.csv']);
  assert.equal(await F.saveTextFile('x', 'b.csv', 'text/csv', { native: true, env: { ...env, navigator: { share: async () => { const e = new Error('c'); e.name = 'AbortError'; throw e; } } } }), 'cancelled');
  assert.equal(await F.saveTextFile('x', 'b.csv', 'text/csv', { native: true, env: { ...env, navigator: {} } }), 'failed');
});
await t('readTextFile rejects big files', async () => { await assert.rejects(F.readTextFile({ size: 3e6 }), /too large/); assert.equal(await F.readTextFile({ size: 2, text: async () => 'hi' }), 'hi'); });
console.log(`\n${n} task-transfer tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
