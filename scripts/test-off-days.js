// Run: node scripts/test-off-days.js — planned days off ("I'm off") bridge the streak without growing it or using a freeze.
const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => {
const tmp = path.join(os.tmpdir(), 'streak-off-test.mjs'); fs.copyFileSync(path.join(__dirname, '../src/utils/streak.js'), tmp);
const { recordCompletion: rec, evaluateStreak: ev, addOffDates, bridgeOffDays, missedDays } = await import(tmp);
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const base = { streak: 3, bestStreak: 3, lastCompletionDate: '2026-10-08', freezeBank: 1 };
t('off day keeps the streak', () => { const s = { ...base, offDates: ['2026-10-09'] }; assert.equal(ev(s, '2026-10-10').status, 'at-risk'); assert.equal(ev(s, '2026-10-10').streak, 3); });
t('without off day it breaks', () => { assert.equal(ev(base, '2026-10-10').status, 'broken'); });
t('range of off days', () => { const s = { ...base, offDates: ['2026-10-09', '2026-10-10', '2026-10-11'] }; assert.deepEqual(missedDays(s, '2026-10-12'), []); });
t('off days do not use the freeze bank or grow the streak', () => { const s = rec({ ...base, offDates: ['2026-10-09'] }, '2026-10-10'); assert.equal(s.freezeBank, 1); assert.equal(s.streak, 4); assert(!s.counted.includes('2026-10-09')); });
t('today off is still open', () => { const s = bridgeOffDays({ ...base, offDates: ['2026-10-09'] }, '2026-10-09'); assert.equal(s.lastCompletionDate, '2026-10-08'); });
t('addOffDates dedupes and sorts', () => { assert.deepEqual(addOffDates({ offDates: ['2026-10-10'] }, ['2026-10-09', '2026-10-10']), ['2026-10-09', '2026-10-10']); });
console.log(`\n${n} off-day tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
