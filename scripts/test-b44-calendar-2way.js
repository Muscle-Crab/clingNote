// B44: two-way calendar sync gaps. Completions flow to Calendar as "✓ Title", per-field conflict merge, no duplicates on either side.
// Pure planner + orchestrator with a fake device calendar. Run: node scripts/test-b44-calendar-2way.js
const path = require('path'); const fs = require('fs'); const os = require('os');
process.env.TZ = 'America/New_York';
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calsync44-'));
for (const f of fs.readdirSync(path.join(__dirname, '../src/utils')).filter((x) => x.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(__dirname, '../src/utils', f), 'utf8').replace(/from '\.\/([\w]+)(\.js)?'/g, "from './$1.mjs'").replace(/from '@\/utils\/([\w]+)'/g, "from './$1.mjs'"));
const C = await import(path.join(dir, 'calendarSync.mjs')); const S = await import(path.join(dir, 'scheduling.mjs'));
const assert = require('assert'); let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const now = new Date(2026, 9, 22, 8, 0).getTime(); const weekDates = S.weekDates(new Date(now)); const H = 3600000;
const fakeCal = () => { const cal = new Map(); let seq = 0; return { cal,
  list: async () => [...cal.values()].map((e) => ({ ...e })),
  upsert: async (ev, id) => { id = id || 'EV' + (++seq); cal.set(id, { id, title: ev.title, startMs: ev.startMs, endMs: ev.endMs, url: C.EVENT_URL_PREFIX + ev.key }); return id; },
  remove: async (id) => { cal.delete(id); } }; };
const mkIo = (fc, data, locked = []) => { let ids = 0; return { ...fc, loadLocal: async () => data.v,
  saveLocal: async (x) => { data.v = { ...data.v, scheduled: x.scheduled, dayLists: x.dayLists }; }, makeId: () => 'imp' + (++ids), lockedDays: () => locked,
  buildEntry: (f, id) => S.buildScheduledEntry({ title: f.title, estimateMin: f.minutes }, f.date, f.time, id) }; };
const base = () => ({ v: { scheduled: [S.buildScheduledEntry({ title: 'Dentist', estimateMin: 45 }, '2026-10-30', '09:30', 'a1')],
  dayLists: { Thu: [{ id: 'w1', title: 'Write report', startTime: '14:00', createdAt: 'c1' }] }, weekDates } });

await t('completing a synced task updates its event to "✓ Title" (not deleted)', async () => {
  const fc = fakeCal(); const data = base(); const io = mkIo(fc, data);
  let r = await C.runCalendarSync(io, {}, now); assert.strictEqual(fc.cal.size, 2);
  data.v.dayLists = { Thu: [{ ...data.v.dayLists.Thu[0], completed: true }] };
  data.v.scheduled = [{ ...data.v.scheduled[0], done: true }];
  r = await C.runCalendarSync(io, r.state, now); assert.strictEqual(r.summary.updated, 2); assert.strictEqual(r.summary.removed, 0);
  assert.deepStrictEqual([...fc.cal.values()].map((e) => e.title).sort(), ['✓ Dentist', '✓ Write report']);
  r = await C.runCalendarSync(io, r.state, now); assert.strictEqual(r.summary.updated + r.summary.pushed + r.summary.removed, 0, 'steady');
});
await t('a task completed before it was ever synced is not added; deleting a ✓ event is respected', async () => {
  const fc = fakeCal(); const data = base(); data.v.dayLists.Thu.push({ id: 'x', title: 'Old', startTime: '09:00', completed: true, createdAt: 'c9' });
  let r = await C.runCalendarSync(mkIo(fc, data), {}, now); assert.strictEqual(fc.cal.size, 2);
  data.v.dayLists.Thu[0] = { ...data.v.dayLists.Thu[0], completed: true }; r = await C.runCalendarSync(mkIo(fc, data), r.state, now);
  const done = [...fc.cal.values()].find((e) => e.title === '✓ Write report'); fc.cal.delete(done.id);
  r = await C.runCalendarSync(mkIo(fc, data), r.state, now); r = await C.runCalendarSync(mkIo(fc, data), r.state, now);
  assert.ok(![...fc.cal.values()].some((e) => /Write report/.test(e.title)), 'not re-created');
});
await t('Calendar edits to a ✓ event are ignored and reverted; task untouched', async () => {
  const fc = fakeCal(); const data = base(); let r = await C.runCalendarSync(mkIo(fc, data), {}, now);
  data.v.scheduled = [{ ...data.v.scheduled[0], done: true }]; r = await C.runCalendarSync(mkIo(fc, data), r.state, now);
  const ev = [...fc.cal.values()].find((e) => e.title === '✓ Dentist'); ev.startMs += H; ev.endMs += H;
  r = await C.runCalendarSync(mkIo(fc, data), r.state, now); assert.strictEqual(r.summary.pulled, 0);
  assert.strictEqual(data.v.scheduled[0].scheduledTime, '09:30'); assert.strictEqual(fc.cal.get(ev.id).startMs, new Date(2026, 9, 30, 9, 30).getTime());
});
await t('conflict: title renamed in ClingNote + time moved in Calendar -> both kept, written to both sides', async () => {
  const fc = fakeCal(); const data = base(); let r = await C.runCalendarSync(mkIo(fc, data), {}, now);
  data.v.scheduled = [{ ...data.v.scheduled[0], title: 'Dentist (Dr. Lee)' }];
  const ev = fc.cal.get(r.state.links['s-a1'].id); ev.startMs += 2 * H; ev.endMs += 2 * H;
  r = await C.runCalendarSync(mkIo(fc, data), r.state, now); assert.strictEqual(r.summary.merged, 1);
  assert.strictEqual(data.v.scheduled[0].title, 'Dentist (Dr. Lee)'); assert.strictEqual(data.v.scheduled[0].scheduledTime, '11:30');
  assert.strictEqual(fc.cal.get(ev.id).title, 'Dentist (Dr. Lee)'); assert.strictEqual(fc.cal.get(ev.id).startMs, new Date(2026, 9, 30, 11, 30).getTime());
  r = await C.runCalendarSync(mkIo(fc, data), r.state, now); assert.strictEqual(r.summary.updated + r.summary.pulled, 0, 'converged');
});
await t('conflict on the same field: Calendar wins; length kept from the side that changed it', async () => {
  const fc = fakeCal(); const data = base(); let r = await C.runCalendarSync(mkIo(fc, data), {}, now);
  data.v.scheduled = [{ ...data.v.scheduled[0], scheduledTime: '10:00', estimateMin: 60 }];
  const ev = fc.cal.get(r.state.links['s-a1'].id); ev.startMs = new Date(2026, 9, 30, 13, 0).getTime(); ev.endMs = ev.startMs + 45 * 60000;
  r = await C.runCalendarSync(mkIo(fc, data), r.state, now);
  assert.strictEqual(data.v.scheduled[0].scheduledTime, '13:00'); assert.strictEqual(data.v.scheduled[0].estimateMin, 60);
  assert.strictEqual(fc.cal.get(ev.id).endMs - fc.cal.get(ev.id).startMs, 60 * 60000);
});
await t('no duplicates: identical unlinked event is linked, not imported; twin events import once; reruns stay stable', async () => {
  const fc = fakeCal(); const data = base();
  fc.cal.set('U1', { id: 'U1', title: 'write report', startMs: new Date(2026, 9, 22, 14, 0).getTime(), endMs: new Date(2026, 9, 22, 14, 30).getTime() });
  fc.cal.set('U2', { id: 'U2', title: 'Yoga', startMs: new Date(2026, 9, 26, 7, 0).getTime(), endMs: new Date(2026, 9, 26, 8, 0).getTime() });
  fc.cal.set('U3', { id: 'U3', title: 'Yoga', startMs: new Date(2026, 9, 26, 7, 0).getTime(), endMs: new Date(2026, 9, 26, 8, 0).getTime() });
  let r = await C.runCalendarSync(mkIo(fc, data), {}, now);
  assert.strictEqual(r.summary.linked, 1); assert.strictEqual(r.summary.imported, 1); assert.strictEqual(r.summary.pushed, 1, 'only Dentist pushed');
  assert.strictEqual(data.v.scheduled.filter((e) => e.title === 'Yoga').length, 1);
  for (let i = 0; i < 3; i++) r = await C.runCalendarSync(mkIo(fc, data), r.state, now);
  assert.strictEqual(data.v.scheduled.filter((e) => e.title === 'Yoga').length, 1); assert.strictEqual(fc.cal.size, 4);
  assert.strictEqual([...fc.cal.values()].filter((e) => /write report/i.test(e.title)).length, 1);
});
await t('new task in ClingNote and an edit in ClingNote flow to Calendar', async () => {
  const fc = fakeCal(); const data = base(); let r = await C.runCalendarSync(mkIo(fc, data), {}, now);
  data.v.scheduled = [...data.v.scheduled, S.buildScheduledEntry({ title: 'Gym' }, '2026-10-24', '18:00', 'g1')];
  data.v.dayLists = { Thu: [{ ...data.v.dayLists.Thu[0], startTime: '15:00' }] };
  r = await C.runCalendarSync(mkIo(fc, data), r.state, now); assert.strictEqual(r.summary.pushed, 1); assert.strictEqual(r.summary.updated, 1);
  assert.strictEqual([...fc.cal.values()].find((e) => e.title === 'Write report').startMs, new Date(2026, 9, 22, 15, 0).getTime());
});
await t('locked day: a merge that cannot be saved is not pushed (retried later)', async () => {
  const fc = fakeCal(); const data = base(); let r = await C.runCalendarSync(mkIo(fc, data), {}, now);
  data.v.dayLists = { Thu: [{ ...data.v.dayLists.Thu[0], title: 'Write report v2' }] };
  const ev = fc.cal.get(r.state.links[Object.keys(r.state.links).find((k) => k.startsWith('t-'))].id); ev.startMs += H; ev.endMs += H;
  r = await C.runCalendarSync(mkIo(fc, data, ['Thu']), r.state, now);
  assert.strictEqual(fc.cal.get(ev.id).title, 'Write report', 'calendar not overwritten while locked'); assert.strictEqual(data.v.dayLists.Thu[0].startTime, '14:00');
});
console.log(`\n${n} b44 calendar tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
