// Run: node scripts/test-streak.js
const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => {
const tmp = path.join(os.tmpdir(), 'streak-test.mjs'); fs.copyFileSync(path.join(__dirname, '../src/utils/streak.js'), tmp);
const { recordCompletion: rec, evaluateStreak: ev, localDateStr } = await import(tmp);
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
t('consecutive days', () => { let s = null; for (const d of ['2026-10-18', '2026-10-19', '2026-10-20']) s = rec(s, d); assert.equal(s.streak, 3); assert.equal(s.bestStreak, 3); });
t('same day twice counts once', () => { let s = rec(rec(null, '2026-10-20'), '2026-10-20'); assert.equal(s.streak, 1); });
t('gap resets to 1, best kept', () => { let s = rec(rec(rec(null, '2026-10-17'), '2026-10-18'), '2026-10-20'); assert.equal(s.streak, 1); assert.equal(s.bestStreak, 2); });
t('today not done yet = at risk, not broken', () => { const r = ev({ streak: 4, lastCompletionDate: '2026-10-20' }, '2026-10-21'); assert.equal(r.status, 'at-risk'); assert.equal(r.streak, 4); });
t('full missed day = broken -> 0', () => { const r = ev({ streak: 4, bestStreak: 4, lastCompletionDate: '2026-10-19' }, '2026-10-21'); assert.equal(r.status, 'broken'); assert.equal(r.streak, 0); assert.equal(r.bestStreak, 4); });
t('done today', () => assert.equal(ev({ streak: 1, lastCompletionDate: '2026-10-21' }, '2026-10-21').status, 'done'));
t('configurable gap 2 allows one skipped day', () => { assert.equal(rec({ streak: 2, lastCompletionDate: '2026-10-18' }, '2026-10-20', 2).streak, 3); assert.equal(ev({ streak: 2, lastCompletionDate: '2026-10-18' }, '2026-10-20', 2).status, 'at-risk'); });
t('month/DST boundary', () => { assert.equal(rec({ streak: 5, lastCompletionDate: '2026-10-31' }, '2026-11-01').streak, 6); assert.equal(rec({ streak: 5, lastCompletionDate: '2026-03-07' }, '2026-03-08').streak, 6); });
t('midnight edge uses local date', () => {
  process.env.TZ = 'America/New_York';
  const late = new Date('2026-10-21T03:59:00Z'), early = new Date('2026-10-21T04:01:00Z'); // 11:59 PM / 12:01 AM EDT
  assert.equal(localDateStr(late), '2026-10-20'); assert.equal(localDateStr(early), '2026-10-21');
  assert.equal(rec(rec(null, localDateStr(late)), localDateStr(early)).streak, 2);
});
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
