// Run: node scripts/test-daily-report.js  (morning report builder + scheduled function with fakes)
const path = require('path'); const fs = require('fs'); const os = require('os'); const assert = require('assert');
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dr-'));
fs.copyFileSync(path.join(__dirname, '../src/utils/dailyReport.js'), path.join(dir, 'dailyReport.mjs'));
const D = await import(path.join(dir, 'dailyReport.mjs'));
let n = 0; const t = async (name, f) => { await f(); n++; console.log('ok -', name); };
await t('due once per local date at/after 8', () => { assert.ok(!D.reportDue('2026-10-21', 7, null)); assert.ok(D.reportDue('2026-10-21', 8, null)); assert.ok(!D.reportDue('2026-10-21', 9, '2026-10-21')); assert.ok(D.reportDue('2026-10-22', 8, '2026-10-21')); });
await t('local time zone parts', () => { const p = D.localParts(new Date('2026-10-21T12:30:00Z'), 'America/New_York'); assert.deepEqual(p, { date: '2026-10-21', hour: 8 }); assert.equal(D.localParts(new Date('2026-10-21T03:00:00Z'), 'America/New_York').date, '2026-10-20'); });
await t('recap contents', () => {
  const now = new Date('2026-10-21T12:30:00Z');
  const r = D.buildRecap({ today: '2026-10-21', now, streakDoc: { streak: 4, counted: ['2026-10-20'], lastDay: { date: '2026-10-20', count: 6 }, dayDate: '2026-10-21', dayDone: [] },
    yesterdayTasks: [{ title: 'Gym' }, { title: 'Done', completed: true }, { title: 'App', status: 'pending', pendingOn: 'Apple review', pendingSince: '2026-10-18T12:00:00Z' }],
    todayTasks: [{ title: 'low', priority: 'low' }, { title: 'imp', important: true }, { title: 'boss', boss: true }, { title: 'high', priority: 'high' }, { title: 'x', completed: true }] });
  assert.equal(r.done, 6); assert.ok(r.counted); assert.match(r.streakStatus, /4\/5 day streak alive/);
  assert.deepEqual(r.slipped, ['Gym']); assert.deepEqual(r.pending, [{ title: 'App', on: 'Apple review', days: 3 }]);
  assert.deepEqual(r.top3, ['boss', 'imp', 'high']); assert.match(r.text, /Yesterday: 6\/5 done ✅/);
});
await t('missed yesterday -> streak reset to 0/5 (cap 5)', () => { const r = D.buildRecap({ today: '2026-10-21', streakDoc: { streak: 4, counted: ['2026-10-19'], dayDate: '2026-10-20', dayDone: ['a', 'b'] } }); assert.equal(r.done, 2); assert.match(r.streakStatus, /reset to 0\/5/); assert.equal(r.streak, 0); });
await t('streak above cap is shown clamped to 5/5', () => { const r = D.buildRecap({ today: '2026-10-21', streakDoc: { streak: 9, counted: ['2026-10-20'], dayDate: '2026-10-20', dayDone: ['a','b','c','d','e'] } }); assert.equal(r.streak, 5); assert.match(r.streakStatus, /5\/5 day streak alive/); });
await t('scheduled function: sends once per user at 8 AM local, marks lastSent', async () => {
  process.env.ONESIGNAL_APP_ID = 'app';
  const sets = []; const sent = [];
  const userDoc = (id, mr) => ({ id, data: () => ({ morningReport: mr }), ref: { set: async (v) => sets.push([id, v]) } });
  const db = {
    collection: () => ({ where: () => ({ get: async () => ({ docs: [userDoc('u1', { enabled: true, timeZone: 'America/New_York' }), userDoc('u2', { enabled: true, timeZone: 'America/New_York', lastSent: '2026-10-21' }), userDoc('u3', { enabled: true, timeZone: 'America/Los_Angeles' })] }) }) }),
    doc: () => ({ get: async () => ({ exists: false }) }),
  };
  const mod = require(path.join(__dirname, '../netlify/functions/daily-report.js'));
  const res = await mod.runReports({ db, now: new Date('2026-10-21T12:30:00Z'), send: async (p) => { sent.push(p); } });
  assert.deepEqual(res.map((r) => r.uid), ['u1']); assert.deepEqual(sent[0].include_aliases, { external_id: ['u1'] }); assert.deepEqual(sets[0], ['u1', { morningReport: { lastSent: '2026-10-21' } }]);
});
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
