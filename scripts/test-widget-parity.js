// Widget vs app: the widget snapshot must carry exactly the estimate/points the TaskCard chip shows (chipValues), incl. AI points and computed fallbacks.
const assert = require('assert');
const { load } = require('./lib/srcRequire');
const { chipValues, fmtMin } = load('utils/taskEstimate.js');
const { buildWidgetSnapshot, fmtEstimate } = load('utils/widgetSnapshot.js');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const tasks = [
  { title: 'Write report', createdAt: 1, estimateMin: 25, minutes: 60, points: 40, pointsSource: 'ai' }, // typed 25 vs stale stored 60 (the bug)
  { title: 'Gym', createdAt: 2 }, // nothing stored: the app computes; the widget used to show nothing
  { title: 'Emails', createdAt: 3, minutes: 15, points: 10 },
  { title: 'Deep work on thesis', createdAt: 4, estimateMin: 150 },
];
const s = buildWidgetSnapshot(tasks, { estimate: chipValues });
for (const t of tasks) {
  const row = s.tasks.find((r) => r.title === t.title); const c = chipValues(t);
  ok(row.est === c.minutes && row.pts === c.points, `${t.title}: widget ${row.est}m/${row.pts}p == app ${c.minutes}m/${c.points}p`);
  ok(fmtEstimate(row.est) === fmtMin(c.minutes), `${t.title}: same format`);
}
ok(s.estTotal === tasks.reduce((a, t) => a + chipValues(t).minutes, 0), 'totals use the app values');
console.log(`test-widget-parity: ${pass} passed`);
