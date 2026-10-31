// Run: node scripts/test-b44-calendar-plus.mjs — B44 calendar features (pure): repeating-task occurrences in the device calendar
// with single-day skip / move, owned focus + lock-in blocks, busy times, working hours, task extras + their notifications, plain-word entry.
import assert from 'assert'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
process.env.TZ = 'America/New_York';
const here = path.dirname(fileURLToPath(import.meta.url)); const src = path.join(here, '../src/utils');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b44cal-'));
for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(src, f), 'utf8').replace(/from '\.\/([\w]+)(?:\.js)?'/g, "from './$1.mjs'").replace(/from '@\/utils\/([\w]+)'/g, "from './$1.mjs'"));
const I = (n) => import(path.join(dir, n + '.mjs'));
const C = await I('calendarSync'); const S = await I('scheduling'); const B = await I('busyTimes'); const T = await I('timeBlocks'); const X = await I('taskExtras'); const N = await I('schedNotify'); const P = await I('nlEntry'); const K = await I('taskCategory');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const now = new Date(2026, 9, 26, 8, 0).getTime(); // Mon 26 Oct 2026 08:00
const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();

// ---- 2) repeating tasks in the device calendar
const tpl = S.buildRecurringTemplate({ title: 'Standup', scheduledTime: '09:00', estimateMin: 15 }, '2026-10-26', { freq: 'weekly', days: [1, 3, 5] }, 'T1');
const local = (sched, extra = {}) => C.buildLocalEvents({ scheduled: sched, dayLists: {}, weekDates: S.weekDates(new Date(now)), nowMs: now, ...extra });
await t('repeat: every occurrence in the window is an event (Mon/Wed/Fri 09:00, 15 min)', () => {
  const ev = local([tpl]).filter((e) => e.src.kind === 'occ');
  assert.ok(ev.length >= 24, String(ev.length)); const first = ev.find((e) => e.key === `s-${S.instanceId('T1', '2026-10-26')}`);
  assert.strictEqual(first.startMs, at(26, 9)); assert.strictEqual(first.endMs - first.startMs, 15 * 60000);
  assert.ok(ev.every((e) => [1, 3, 5].includes(new Date(e.startMs).getDay())));
});
await t('repeat: stopped / flex / untimed templates are not pushed', () => {
  assert.strictEqual(local([{ ...tpl, stopped: true }]).length, 0);
  assert.strictEqual(local([{ ...tpl, scheduledTime: '' }]).length, 0);
});
await t('repeat: done day shows ✓, a skipped day is gone', () => {
  const ev = local([{ ...tpl, doneOn: ['2026-10-26'], skip: ['2026-10-28'] }]);
  assert.ok(ev.find((e) => e.key === `s-${S.instanceId('T1', '2026-10-26')}`).done);
  assert.ok(!ev.some((e) => e.key === `s-${S.instanceId('T1', '2026-10-28')}`));
});
const linkAll = (loc) => { const links = {}; const remote = loc.filter((e) => !e.done).map((e, i) => { links[e.key] = { id: 'E' + i, sig: e.sig }; return { id: 'E' + i, title: e.title, startMs: e.startMs, endMs: e.endMs, url: C.EVENT_URL_PREFIX + e.key }; }); return { links, remote }; };
await t('repeat: deleting ONE occurrence in Calendar skips only that day', () => {
  const loc = local([tpl]); const { links, remote } = linkAll(loc); const k = `s-${S.instanceId('T1', '2026-10-28')}`;
  const p = C.planSync(loc, remote.filter((r) => r.id !== links[k].id), { links });
  assert.deepStrictEqual(p.pullSkips, [{ key: k, tplId: 'T1', date: '2026-10-28' }]); assert.strictEqual(p.creates.length, 0); assert.strictEqual(p.removes.length, 0);
  const after = C.applySkips([tpl], p.pullSkips); const ev = local(after);
  assert.ok(!ev.some((e) => e.key === k)); assert.ok(ev.some((e) => e.key === `s-${S.instanceId('T1', '2026-10-30')}`), 'other days stay');
});
await t('repeat: moving ONE occurrence in Calendar makes an instance for that day only', () => {
  const loc = local([tpl]); const { links, remote } = linkAll(loc); const k = `s-${S.instanceId('T1', '2026-10-28')}`;
  const r = remote.find((x) => x.id === links[k].id); r.startMs = at(28, 11); r.endMs = at(28, 11, 15);
  const p = C.planSync(loc, remote, { links }); assert.strictEqual(p.pullUpdates.length, 1);
  const res = C.applyPullUpdates([tpl], {}, p.pullUpdates); const inst = res.scheduled.find((e) => e.id === k.slice(2));
  assert.ok(inst && inst.templateId === 'T1' && inst.scheduledDate === '2026-10-28' && inst.scheduledTime === '11:00' && inst.movedFrom === '2026-10-28');
  assert.ok(!inst.recurrence, 'instance is not a template');
  const ev = local(res.scheduled); const moved = ev.find((e) => e.key === k); assert.strictEqual(moved.startMs, at(28, 11));
  assert.strictEqual(ev.find((e) => e.key === `s-${S.instanceId('T1', '2026-10-30')}`).startMs, at(30, 9), 'series unchanged');
});
// ---- 4) owned focus / lock-in blocks
await t('blocks: focus + lock-in are owned events; edits in Calendar are reverted, deletes respected', () => {
  const blocks = [{ key: 'f-2026-10-27', title: '🎯 Focus time', startMs: at(27, 9), endMs: at(27, 10, 30) }];
  const loc = local([], { blocks }); const b = loc.find((e) => e.key === 'f-2026-10-27'); assert.ok(b.owned);
  const { links, remote } = linkAll(loc); remote[0].startMs += 3600000; remote[0].endMs += 3600000;
  const p = C.planSync(loc, remote, { links }); assert.strictEqual(p.pullUpdates.length, 0); assert.strictEqual(p.updates.length, 1);
  const p2 = C.planSync(loc, [], { links }); assert.strictEqual(p2.creates.length, 0); assert.ok(p2.suppressed['f-2026-10-27']);
});
await t('timeBlocks: focus placed after busy, inside working hours, Mon–Fri only, stable key', () => {
  const busy = [{ startMs: at(27, 9), endMs: at(27, 10) }];
  const f = T.focusBlocks({ settings: { start: '09:00', end: '17:00', focusMin: 90 }, fromDate: '2026-10-26', days: 7, busy, nowMs: now });
  assert.strictEqual(f.length, 5); const tue = f.find((x) => x.key === 'f-2026-10-27'); assert.strictEqual(tue.startMs, at(27, 10)); assert.strictEqual(tue.endMs - tue.startMs, 90 * 60000);
  assert.strictEqual(T.focusBlocks({ settings: { focusMin: 0 }, fromDate: '2026-10-26', nowMs: now }).length, 0);
  assert.strictEqual(T.focusBlocks({ settings: { start: '09:00', end: '10:00', focusMin: 120 }, fromDate: '2026-10-26', days: 1, nowMs: now }).length, 0, 'does not fit');
});
await t('timeBlocks: lock-in block, normalisation, labels', () => {
  const l = T.lockBlock({ startMs: at(26, 9), endMs: at(26, 17) }, now); assert.strictEqual(l.key, 'l-20261026'); assert.ok(/Lock-in/.test(l.title));
  assert.strictEqual(T.lockBlock({ startMs: at(25, 9), endMs: at(25, 17) }, now), null);
  assert.deepStrictEqual(T.normBlocks({ start: '18:00', end: '09:00', focusMin: 7 }), { ...T.DEFAULT_BLOCKS });
  assert.strictEqual(T.durLabel(90), '1h 30m'); assert.ok(/8:30 AM.*4:30 PM.*1h 30m/.test(T.blocksSummary({ start: '08:30', end: '16:30', focusMin: 90 })));
});
// ---- 3) busy times
await t('busy: merge, clash, next free, summary (times only)', () => {
  const busy = [{ startMs: at(26, 9), endMs: at(26, 10) }, { startMs: at(26, 9, 30), endMs: at(26, 9, 45) }, { startMs: at(26, 14), endMs: at(26, 15, 30) }, { startMs: at(27, 9), endMs: at(27, 10) }];
  assert.deepStrictEqual(B.busyOnDate(busy, '2026-10-26'), [{ s: 540, e: 600 }, { s: 840, e: 930 }]);
  const s = B.busySummary(busy, '2026-10-26', '09:30', 30); assert.ok(s.clash && s.suggest === '10:00' && /Busy 9:00 AM–10:00 AM · free 10:00 AM/.test(s.text), s.text);
  assert.strictEqual(B.busySummary(busy, '2026-10-26', '13:45', 30).suggest, '15:30');
  const free = B.busySummary(busy, '2026-10-26', '11:00', 30); assert.ok(!free.clash && /Busy/.test(free.text));
  assert.strictEqual(B.busySummary([], '2026-10-26', '09:30').text, '');
});
// ---- 5) multiple reminders + 7) time to leave
await t('extras: form -> stored fields, labels, map link, leave time', () => {
  assert.deepStrictEqual(X.extrasFromForm({ category: 'Health', remindOffsets: [10, 1440, 10, -3], location: '  12 Oak St ', travelMin: '20' }), { category: 'health', remindOffsets: [1440, 10], location: '12 Oak St', travelMin: 20 });
  assert.deepStrictEqual(X.extrasFromForm({ category: 'nope', remindOffsets: [], location: '' }), {});
  assert.strictEqual(X.offsetsText([60, 10]), '1 hr before, 10 min before');
  assert.strictEqual(X.mapLink('12 Oak St, Springfield'), 'https://maps.apple.com/?q=12%20Oak%20St%2C%20Springfield');
  assert.strictEqual(X.leaveAt('16:00', 15), '15:45'); assert.strictEqual(X.leaveAt('', 15), '');
});
await t('notifications: N-before pings + time-to-leave for timed tasks, scheduled entries and repeats', () => {
  const task = { title: 'Dentist', createdAt: 1, startTime: '16:00', remindOffsets: [60, 10], location: '12 Oak St', travelMin: 15 };
  const plan = N.planNotifications({ list: [], todayTasks: [task], todayStr: '2026-10-26', now: new Date(now) });
  const ks = plan.map((p) => p.key); const base = N.timeKey(task);
  assert.ok(ks.includes(base) && ks.includes(`${base}|-60`) && ks.includes(`${base}|-10`) && ks.includes(`${base}|leave`), ks.join());
  const leave = plan.find((p) => p.key === `${base}|leave`); assert.strictEqual(leave.at.getTime ? leave.at.getTime() : leave.at, at(26, 15, 45));
  const e = S.buildScheduledEntry({ title: 'Gym', remindOffsets: [1440] }, '2026-10-28', '18:00', 'G1');
  const p2 = N.planNotifications({ list: [e], todayTasks: [], todayStr: '2026-10-26', now: new Date(now) });
  assert.ok(p2.some((p) => /\|-1440$/.test(p.key)), p2.map((p) => p.key).join());
  const rep = S.buildRecurringTemplate({ title: 'Run', scheduledTime: '07:00', remindOffsets: [30] }, '2026-10-27', { freq: 'daily' }, 'R1');
  const p3 = N.planNotifications({ list: [rep], todayTasks: [], todayStr: '2026-10-26', now: new Date(now) });
  assert.ok(p3.filter((p) => /\|-30$/.test(p.key)).length >= 2, p3.map((p) => p.key).join());
  assert.ok(N.planNotifications({ list: [], todayTasks: [{ ...task, startTime: '08:05' }], todayStr: '2026-10-26', now: new Date(now) }).every((p) => +new Date(p.at) > now), 'no past pings');
});
// ---- 6) colour by category
await t('category: explicit work / home / health wins over keyword guesses', () => {
  assert.strictEqual(K.categoryOf({ title: 'Pay rent', category: 'health' }).tone, 'green');
  assert.strictEqual(K.categoryOf({ title: 'Gym', category: 'work' }).tone, 'purple');
  assert.strictEqual(K.categoryOf({ title: 'Laundry', category: 'home' }).label, 'Home');
  assert.strictEqual(K.categoryOf({ title: 'Pay rent' }).tone, 'red', 'old behaviour without a category');
});
// ---- 8) plain-word entry
const nowD = new Date(2026, 9, 31, 8, 0);
await t('plain words: local parser', () => {
  assert.deepStrictEqual(P.localParse('gym tomorrow at 6', nowD), { title: 'Gym', date: '2026-11-01', time: '18:00', source: 'local' });
  const r = P.localParse('pay rent friday 9am', nowD); assert.strictEqual(r.date, '2026-11-06'); assert.strictEqual(r.time, '09:00'); assert.strictEqual(r.title, 'Pay rent');
  const d = P.localParse('dentist on nov 3 at 4:30pm', nowD); assert.deepStrictEqual([d.title, d.date, d.time], ['Dentist', '2026-11-03', '16:30']);
  assert.strictEqual(P.localParse('buy milk', nowD), null); assert.strictEqual(P.localParse('Gym', nowD), null);
  assert.ok(/Tomorrow · 6:00 PM/.test(P.hintText(P.localParse('gym tomorrow at 6', nowD), '2026-10-31')));
});
await t('plain words: AI first when allowed, local fallback on failure', async () => {
  const ask = async () => ({ content: JSON.stringify({ items: [{ type: 'schedule', title: 'Gym session', date: '2026-11-01', start: '18:30' }] }) });
  const a = await P.parseEntry('gym tomorrow at 6:30 in the evening', { ask, now: nowD }); assert.strictEqual(a.source, 'ai'); assert.strictEqual(a.time, '18:30');
  const b = await P.parseEntry('gym tomorrow at 6', { ask: async () => { throw new Error('offline'); }, now: nowD }); assert.strictEqual(b.source, 'local'); assert.strictEqual(b.time, '18:00');
  const c = await P.parseEntry('gym tomorrow at 6', { now: nowD }); assert.strictEqual(c.source, 'local');
});
fs.rmSync(dir, { recursive: true, force: true });
console.log(`b44 calendar+ unit: ${n} passed`);
