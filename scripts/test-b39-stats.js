// B39 Stats sheet: heatmap/rate/streak maths + Profile wiring (one row in the existing More card, no new box). Run: node scripts/test-b39-stats.js
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const { load } = require('./lib/srcRequire');
const S = load('utils/statsView.js');
const rd = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };
const today = '2026-10-30'; // Friday
t('grid: 12 Mon–Sun columns ending this week', () => {
  assert.strictEqual(S.gridStart(today), '2026-08-10');
  const r = S.buildStats({ todayStr: today });
  assert.strictEqual(r.weeks.length, 12); r.weeks.forEach((c) => assert.strictEqual(c.length, 7));
  assert.strictEqual(r.weeks[11][4].date, today); assert.ok(r.weeks[11][5].future && r.weeks[11][6].future && !r.weeks[11][4].future);
  assert.deepStrictEqual(S.monthKeysFor(today), ['2026-08', '2026-09', '2026-10']);
  assert.deepStrictEqual([r.total, r.active, r.rate, r.current, r.best], [0, 0, 0, 0, 0]);
});
t('counts from monthly done lists: dedupe, bad entries ignored, levels', () => {
  const c = S.countsFromMonthly([{ done: ['2026-10-29|a', '2026-10-29|b', '2026-10-29|a', 'junk', 5] }, null, { done: ['2026-09-01|x'] }]);
  assert.deepStrictEqual(c, { '2026-10-29': 2, '2026-09-01': 1 });
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 7, 8, 30].map(S.levelOf), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
});
t('rate from first active day; streak tolerates open today; best run', () => {
  const counts = { '2026-10-20': 3, '2026-10-21': 1, '2026-10-22': 2, '2026-10-26': 1, '2026-10-27': 1, '2026-10-28': 4, '2026-10-29': 9 };
  const r = S.buildStats({ todayStr: today, counts });
  assert.strictEqual(r.total, 21); assert.strictEqual(r.active, 7); assert.strictEqual(r.days, 11); assert.strictEqual(r.rate, 64);
  assert.strictEqual(r.current, 4); assert.strictEqual(r.best, 4);
  const r2 = S.buildStats({ todayStr: today, counts: { ...counts, [today]: 1 } }); assert.strictEqual(r2.current, 5);
  const r3 = S.buildStats({ todayStr: today, counts: { '2026-10-20': 1, '2026-10-21': 1, '2026-10-22': 1 } }); assert.strictEqual(r3.current, 0); assert.strictEqual(r3.best, 3);
  assert.strictEqual(r.weeks[11][3].level, 4);
});
t('streak counted days fill gaps; future/out-of-window ignored; moods 1–5 only', () => {
  const r = S.buildStats({ todayStr: today, counts: { '2026-11-02': 5, '2026-01-01': 5 }, counted: ['2026-10-29', 'bad'], moods: { '2026-10-29': 4, '2026-10-28': 9 } });
  assert.strictEqual(r.total, 1); assert.strictEqual(r.current, 1); assert.strictEqual(r.moodDays, 1);
  assert.strictEqual(r.weeks[11][3].mood, 4); assert.strictEqual(r.weeks[11][2].mood, 0);
  assert.strictEqual(S.buildStats({ todayStr: 'nope' }), null);
  assert.ok(/Thu, Oct 29: 0 done/.test(S.cellTitle({ date: '2026-10-29', count: 0, mood: 0 })));
});
t('Profile: one Stats row first in the existing More card, opens the sheet; no new section', () => {
  const p = rd('src/views/Profile.vue');
  assert.ok(/<h2 class="pf-section">More<\/h2>\s*<section class="pf-card pf-card--flush">\s*<button type="button" data-test="stats-row" class="pf-row" @click="openStats">/.test(p));
  assert.strictEqual((p.match(/data-test="stats-row"/g) || []).length, 1);
  assert.ok(p.includes('<StatsSheet v-if="statsOpen"'));
  assert.ok(p.includes("doc(db, 'monthlyStats', mk, 'private', uid)") && !/setDoc\([^)]*monthlyStats/.test(p.split('const openStats')[1].split('const fileInput')[0]), 'read-only');
  const sheet = rd('src/components/profile/StatsSheet.vue');
  ['stats-sheet', 'stats-heatmap', 'stats-rate', 'stats-streak', 'stats-close'].forEach((d) => assert.ok(sheet.includes(`data-test="${d}"`), d));
});
console.log(`test-b39-stats: ${n} passed`);
