// Run: node scripts/test-streak.js
const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => {
const tmp = path.join(os.tmpdir(), 'streak-test.mjs'); fs.copyFileSync(path.join(__dirname, '../src/utils/streak.js'), tmp);
const { recordCompletion: rec, evaluateStreak: ev, applyTaskToggle: tog, localDateStr, DAILY_STREAK_MIN } = await import(tmp);
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const doN = (s, day, k, extra = {}) => { for (let i = 0; i < k; i++) s = tog(s, day, { key: `t${i}`, completed: true, ...extra }); return s; };
t('min is 5', () => assert.equal(DAILY_STREAK_MIN, 5));
t('5 done counts', () => { const s = doN(null, '2026-10-20', 5); assert.equal(s.streak, 1); assert.equal(ev(s, '2026-10-20').status, 'done'); });
t('4 done does not count; today shows at-risk 4/5', () => { const s = doN({ streak: 3, lastCompletionDate: '2026-10-19' }, '2026-10-20', 4); assert.equal(s.streak, 3); const r = ev(s, '2026-10-20'); assert.equal(r.status, 'at-risk'); assert.equal(r.progress, 4); });
t('4 done breaks after the day ends', () => { const s = doN({ streak: 3, bestStreak: 3, lastCompletionDate: '2026-10-19' }, '2026-10-20', 4); const r = ev(s, '2026-10-21'); assert.equal(r.status, 'broken'); assert.equal(r.streak, 0); assert.equal(r.bestStreak, 3); assert.equal(r.progress, 0); });
t('same task twice counts once', () => { let s = null; for (let i = 0; i < 6; i++) s = tog(s, '2026-10-20', { key: 'same', completed: true }); assert.equal(s.dayDone.length, 1); assert.equal(s.streak, 0); });
t('uncheck drops below 5 undoes today', () => { let s = doN({ streak: 2, bestStreak: 2, lastCompletionDate: '2026-10-19' }, '2026-10-20', 5); assert.equal(s.streak, 3); s = tog(s, '2026-10-20', { key: 't0', completed: false }); assert.equal(s.streak, 2); assert.equal(s.bestStreak, 2); assert.equal(s.lastCompletionDate, '2026-10-19'); assert.equal(ev(s, '2026-10-20').status, 'at-risk'); s = tog(s, '2026-10-20', { key: 't9', completed: true }); assert.equal(s.streak, 3); });
t('pending excluded', () => { let s = doN(null, '2026-10-20', 4); s = doN(s, '2026-10-20', 9, { pending: true }); assert.equal(s.dayDone.length, 4); assert.equal(s.streak, 0); });
t('yesterday counts carry over not into today', () => { let s = doN(null, '2026-10-20', 5); s = doN(s, '2026-10-21', 5); assert.equal(s.streak, 2); assert.equal(s.bestStreak, 2); });
t('gap resets to 1, best kept', () => { let s = rec(rec(rec(null, '2026-10-17'), '2026-10-18'), '2026-10-20'); assert.equal(s.streak, 1); assert.equal(s.bestStreak, 2); });
t('configurable gap 2 allows one skipped day', () => { assert.equal(rec({ streak: 2, lastCompletionDate: '2026-10-18' }, '2026-10-20', 2).streak, 3); assert.equal(ev({ streak: 2, lastCompletionDate: '2026-10-18' }, '2026-10-20', 2).status, 'at-risk'); });
t('month/DST boundary', () => { assert.equal(rec({ streak: 5, lastCompletionDate: '2026-10-31' }, '2026-11-01').streak, 6); assert.equal(rec({ streak: 5, lastCompletionDate: '2026-03-07' }, '2026-03-08').streak, 6); });
t('midnight edge uses local date', () => {
  process.env.TZ = 'America/New_York';
  const late = localDateStr(new Date('2026-10-21T03:59:00Z')), early = localDateStr(new Date('2026-10-21T04:01:00Z')); // 11:59 PM / 12:01 AM EDT
  assert.equal(late, '2026-10-20'); assert.equal(early, '2026-10-21');
  let s = doN(null, late, 3); s = doN(s, early, 2); assert.equal(s.streak, 0); assert.equal(s.dayDone.length, 2);
});
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
