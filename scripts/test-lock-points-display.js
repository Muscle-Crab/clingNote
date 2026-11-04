// Run: node scripts/test-lock-points-display.js  (Lock-in card points == server recount, not positional)
// Regression: the card showed "0/260 pts" next to "2 of 25 tasks complete": it paired lock.points[n] with the n-th task in the
// list, so tasks added above the locked ones after Start Day (or any reorder) moved the points onto unfinished tasks.
const assert = require('assert'); const core = require('../netlify/functions/lib/eightHourCore');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const T = (title, extra = {}) => ({ title, createdAt: `2026-11-04T0${title.length % 9}:00:00Z`, type: 'one-time', completed: false, ...extra });
const locked = [T('ZZTEST A', { id: 'a' }), T('ZZTEST B', { id: 'b' }), T('ZZTEST C', { id: 'c' })];
const lock = { dayKey: '2026-11-04', points: [100, 60, 100], ids: ['id:a', 'id:b', 'id:c'], indexes: [0, 1, 2], target: 260 };
t('tasks added above the locked ones: completing a locked task adds its points', () => {
  const list = [T('ZZTEST new 1'), T('ZZTEST new 2'), { ...locked[0], completed: true }, { ...locked[1], completed: true }, locked[2]];
  assert.deepStrictEqual(core.progressOf(lock, list), { earned: 160, done: 2, total: 5 });
});
t('reordered list: points follow the task id', () => {
  const list = [locked[2], { ...locked[0], completed: true }, locked[1]];
  assert.strictEqual(core.progressOf(lock, list).earned, 100);
});
t('index fallback when a task has no id', () => {
  const l = { ...lock, ids: [] }; const list = [{ ...locked[0], id: '', completed: true }, locked[1], locked[2]];
  assert.strictEqual(core.progressOf(l, list).earned, 100);
});
t('server view exposes ids/indexes and the card passes the whole lock', () => {
  const fs = require('fs'); const fn = fs.readFileSync(require.resolve('../netlify/functions/eight-hour-day.js'), 'utf8');
  assert(/const publicLock[\s\S]{0,600}ids: Array\.isArray\(l\.ids\)/.test(fn));
  // main (e54115c) passes ids/indexes explicitly; goal sessions use sessionGoal
  assert(/progressOf\(\{[^)]*ids: l\.ids[^)]*indexes: l\.indexes[^)]*\}, props\.tasks\)/.test(fs.readFileSync(require.resolve('../src/components/home/EightHourCard.vue'), 'utf8')));
});
console.log(`lock points display: ${n} passed`);
