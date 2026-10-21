// Run: node scripts/test-ranking.js
const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rank-'));
for (const f of ['streak', 'ranking']) fs.writeFileSync(path.join(dir, `${f}.mjs`), fs.readFileSync(path.join(__dirname, `../src/utils/${f}.js`), 'utf8').replace("from './streak'", "from './streak.mjs'"));
const R = await import(path.join(dir, 'ranking.mjs'));
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const doN = (d, day, k, from = 0) => { for (let i = from; i < from + k; i++) d = R.applyMonthlyToggle(d, day, { key: `t${i}`, completed: true }); return d; };
t('counting: distinct, double-complete once', () => { let d = doN(null, '2026-10-20', 3); d = R.applyMonthlyToggle(d, '2026-10-20', { key: 't0', completed: true }); assert.equal(R.computeStats(d).count, 3); });
t('same recurring task on two days counts twice', () => { let d = doN(null, '2026-10-20', 1); d = doN(d, '2026-10-21', 1); assert.equal(R.computeStats(d).count, 2); });
t('uncheck removes points', () => { let d = doN(null, '2026-10-20', 2); d = R.applyMonthlyToggle(d, '2026-10-20', { key: 't1', completed: false }); assert.equal(R.computeStats(d).points, 10); });
t('pending excluded', () => { const d = R.applyMonthlyToggle(null, '2026-10-20', { key: 'x', completed: true, pending: true }); assert.equal(R.computeStats(d).count, 0); });
t('points math: 10/task + 25/streak day', () => { let d = doN(null, '2026-10-20', 5); d = doN(d, '2026-10-21', 4, 10); const s = R.computeStats(d); assert.equal(s.count, 9); assert.equal(s.streakDays, 1); assert.equal(s.points, 90 + 25); });
t('streak day bonus revoked when unchecked below 5', () => { let d = doN(null, '2026-10-20', 5); d = R.applyMonthlyToggle(d, '2026-10-20', { key: 't4', completed: false }); assert.equal(R.computeStats(d).points, 40); });
t('goal bonus +50 at goal, default goal 100', () => { let d = { ...doN(null, '2026-10-20', 3), goal: 3 }; let s = R.computeStats(d); assert.equal(s.points, 30 + 50); assert.ok(s.goalReached); assert.equal(R.computeStats(doN(null, '2026-10-20', 1)).goal, 100); });
t('tier thresholds', () => { assert.equal(R.tierFor(0).name, 'Bronze'); assert.equal(R.tierFor(499).name, 'Bronze'); assert.equal(R.tierFor(500).name, 'Silver'); assert.equal(R.tierFor(1000).name, 'Gold'); assert.equal(R.tierFor(2000).name, 'Platinum'); assert.equal(R.tierFor(3500).name, 'Diamond'); assert.equal(R.nextTier(680).name, 'Gold'); assert.equal(R.nextTier(680).need, 320); assert.equal(R.nextTier(4000), null); });
t('month rollover: new month starts at 0, goal kept', () => { let d = { ...doN(null, '2026-10-31', 5), goal: 80 }; d = R.applyMonthlyToggle(d, '2026-11-01', { key: 'a', completed: true }); assert.equal(d.month, '2026-11'); const s = R.computeStats(d); assert.equal(s.count, 1); assert.equal(s.goal, 80); });
t('year rollover keys', () => { assert.equal(R.prevMonthKey('2027-01'), '2026-12'); assert.equal(R.monthKey('2026-12-31'), '2026-12'); });
t('last-day lock', () => { assert.ok(R.isFinalDay('2026-10-31')); assert.ok(!R.isFinalDay('2026-10-30')); assert.ok(R.isFinalDay('2028-02-29')); assert.ok(R.isFinalDay('2027-02-28')); assert.ok(!R.isFinalDay('2028-02-28')); assert.ok(!R.isMonthFinal('2026-10', '2026-10-31')); assert.ok(R.isMonthFinal('2026-10', '2026-11-01'));
  process.env.TZ = 'America/New_York'; const loc = (iso) => { const x = new Date(iso); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  assert.equal(R.monthKey(loc('2026-11-01T03:59:00Z')), '2026-10'); assert.equal(R.monthKey(loc('2026-11-01T04:00:00Z')), '2026-11'); }); // 11:59 PM Oct 31 EDT vs 12:00 AM Nov 1
t('leaderboard: optIn only, sorted, anonymous, no emails', () => { const b = R.buildLeaderboard([{ uid: 'a', points: 100, displayName: 'Ann' }, { uid: 'b', points: 300, displayName: 'bob@x.com' }, { uid: 'c', points: 900, optIn: false }, { uid: 'me', points: 50, displayName: '' }], 'me'); assert.deepEqual(b.map((r) => r.uid), ['b', 'a', 'me']); assert.equal(b[0].displayName, 'Anonymous'); assert.equal(b[2].displayName, 'Anonymous'); assert.ok(b[2].me); assert.equal(b[2].rank, 3); });
t('awards: #1, top3, gold+', () => { const b = R.buildLeaderboard([{ uid: 'a', points: 1200 }, { uid: 'b', points: 300 }, { uid: 'c', points: 200 }, { uid: 'd', points: 100 }], 'a'); assert.deepEqual(R.monthlyAwards(b, 'a'), ['monthly-1', 'monthly-top3', 'monthly-gold']); assert.deepEqual(R.monthlyAwards(b, 'c'), ['monthly-top3']); assert.deepEqual(R.monthlyAwards(b, 'd'), []); });
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
