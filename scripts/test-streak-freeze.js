// Run: node scripts/test-streak-freeze.js — streak freeze days (earn 1 per 7 counted days in a row, max 2, auto-cover a missed day).
const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => {
const tmp = path.join(os.tmpdir(), 'streak-freeze-test.mjs'); fs.copyFileSync(path.join(__dirname, '../src/utils/streak.js'), tmp);
const { recordCompletion: rec, evaluateStreak: ev, applyTaskToggle: tog, applyFreezes, missedDays, FREEZE_EVERY, FREEZE_MAX, addDaysLocal } = await import(tmp);
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const days = (from, k) => Array.from({ length: k }, (_, i) => addDaysLocal(from, i));
const run = (s, from, k) => { for (const d of days(from, k)) s = rec(s, d); return s; };
const doN = (s, day, k) => { for (let i = 0; i < k; i++) s = tog(s, day, { key: `t${i}`, completed: true }); return s; };
t('constants', () => { assert.equal(FREEZE_EVERY, 7); assert.equal(FREEZE_MAX, 2); });
t('6 days in a row: no freeze yet', () => { const s = run(null, '2026-10-01', 6); assert.equal(s.freezeBank, 0); assert.equal(s.freezeRun, 6); });
t('7 days in a row earns 1 freeze', () => { const s = run(null, '2026-10-01', 7); assert.equal(s.freezeBank, 1); assert.equal(s.freezeRun, 0); assert.equal(s.streak, 5); });
t('14 days earns 2, 21 days still capped at 2', () => { assert.equal(run(null, '2026-10-01', 14).freezeBank, 2); assert.equal(run(null, '2026-10-01', 21).freezeBank, 2); });
t('restart resets the run but keeps held freezes', () => { let s = run(null, '2026-10-01', 7); s = rec(s, '2026-10-12'); assert.equal(s.freezeRun, 1); assert.equal(s.freezeBank, 1, 'bank 1 cannot cover 4 missed days -> not used, kept'); assert.equal(s.streak, 1); });
t('missedDays lists the gap', () => { assert.deepEqual(missedDays({ streak: 3, lastCompletionDate: '2026-10-08' }, '2026-10-10'), ['2026-10-09']); assert.deepEqual(missedDays({ streak: 3, lastCompletionDate: '2026-10-09' }, '2026-10-10'), []); assert.deepEqual(missedDays({ streak: 0, lastCompletionDate: '2026-10-01' }, '2026-10-10'), []); });
t('freeze auto-covers one missed day (evaluate on open)', () => {
  const s = run(null, '2026-10-01', 7); // last counted 10-07, bank 1
  assert.equal(ev(s, '2026-10-09').status, 'broken');
  const fz = applyFreezes(s, '2026-10-09');
  assert.equal(fz.used, 1); assert.deepEqual(fz.dates, ['2026-10-08']);
  assert.equal(fz.state.freezeBank, 0); assert.equal(fz.state.lastCompletionDate, '2026-10-08'); assert.ok(fz.state.counted.includes('2026-10-08')); assert.deepEqual(fz.state.frozenDates, ['2026-10-08']);
  const e = ev(fz.state, '2026-10-09'); assert.equal(e.status, 'at-risk'); assert.equal(e.streak, 5);
});
t('frozen day holds but does not grow the streak', () => { let s = run(null, '2026-10-01', 3); s = { ...s, freezeBank: 1 }; const fz = applyFreezes(s, '2026-10-05'); assert.equal(fz.state.streak, 3); assert.equal(rec(fz.state, '2026-10-05').streak, 4); });
t('two missed days need two freezes', () => { const s = run(null, '2026-10-01', 14); const fz = applyFreezes(s, '2026-10-17'); assert.equal(fz.used, 2); assert.equal(fz.state.freezeBank, 0); assert.equal(fz.state.lastCompletionDate, '2026-10-16'); });
t('not enough freezes: nothing used, streak breaks', () => { const s = run(null, '2026-10-01', 7); const fz = applyFreezes(s, '2026-10-10'); assert.equal(fz.used, 0); assert.equal(fz.state.freezeBank, 1); assert.equal(ev(fz.state, '2026-10-10').status, 'broken'); });
t('three missed days never covered (max 2 held)', () => { const s = run(null, '2026-10-01', 21); assert.equal(applyFreezes(s, '2026-10-25').used, 0); });
t('recordCompletion covers the gap itself if open-time evaluation never ran', () => { let s = run(null, '2026-10-01', 7); s = rec(s, '2026-10-09'); assert.equal(s.streak, 5); assert.equal(s.freezeBank, 0); assert.ok(s.frozenDates.includes('2026-10-08')); assert.equal(s.freezeRun, 1); });
t('no double use: covering is idempotent', () => { const s = run(null, '2026-10-01', 14); const a = applyFreezes(s, '2026-10-16'); const b = applyFreezes(a.state, '2026-10-16'); assert.equal(a.used, 1); assert.equal(b.used, 0); assert.equal(b.state.freezeBank, 1); });
t('undo below minimum restores bank/run/frozen days', () => {
  let s = run(null, '2026-10-01', 7); // bank 1, last 10-07
  s = doN(s, '2026-10-09', 5); assert.equal(s.freezeBank, 0); assert.equal(s.lastCompletionDate, '2026-10-09');
  s = tog(s, '2026-10-09', { key: 't0', completed: false });
  assert.equal(s.lastCompletionDate, '2026-10-07'); assert.equal(s.freezeBank, 1); assert.deepEqual(s.frozenDates, []); assert.ok(!s.counted.includes('2026-10-09')); assert.ok(!s.counted.includes('2026-10-08'));
});
t('earning on the 7th day is undone by un-completing', () => { let s = run(null, '2026-10-01', 6); s = doN(s, '2026-10-07', 5); assert.equal(s.freezeBank, 1); s = tog(s, '2026-10-07', { key: 't1', completed: false }); assert.equal(s.freezeBank, 0); assert.equal(s.freezeRun, 6); });
t('legacy docs without freeze fields', () => { const s = rec({ streak: 2, bestStreak: 4, lastCompletionDate: '2026-10-01' }, '2026-10-02'); assert.equal(s.freezeBank, 0); assert.equal(s.freezeRun, 1); assert.deepEqual(s.frozenDates, []); });
t('bank clamps bad values', () => { assert.equal(ev({ freezeBank: 9 }, '2026-10-01').freezeBank, 2); assert.equal(ev({ freezeBank: -3 }, '2026-10-01').freezeBank, 0); assert.equal(ev({ freezeBank: 'x' }, '2026-10-01').freezeBank, 0); });
t('frozen dates list is bounded', () => { let s = { streak: 3, lastCompletionDate: '2026-01-01', freezeBank: 2, frozenDates: days('2025-01-01', 40) }; s = applyFreezes(s, '2026-01-03').state; assert.ok(s.frozenDates.length <= 30); assert.equal(s.frozenDates[s.frozenDates.length - 1], '2026-01-02'); });
t('DST/month boundary gap', () => { const s = { streak: 4, lastCompletionDate: '2026-10-31', freezeBank: 1 }; assert.deepEqual(applyFreezes(s, '2026-11-02').dates, ['2026-11-01']); assert.deepEqual(applyFreezes({ ...s, lastCompletionDate: '2026-03-07' }, '2026-03-09').dates, ['2026-03-08']); });
console.log(`\n${n} streak-freeze tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
