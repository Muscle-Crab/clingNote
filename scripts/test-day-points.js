// Day points are shown as earned/required everywhere: required = locked boss target, else the projected one.
const assert = require('assert');
const { load } = require('./lib/srcRequire');
const { dayPtsLabel, requiredPoints, previewDayTarget } = load('utils/dayTarget.js');
const { buildWidgetSnapshot } = load('utils/widgetSnapshot.js');
const { topAlert } = load('utils/pressure.js');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
ok(dayPtsLabel(40, 200) === '40/200 pts', 'label');
ok(dayPtsLabel(undefined, 12.4) === '0/12 pts', 'label safe');
const tasks = [{ title: 'Clean', points: 60, minutes: 90 }, { title: 'Email', points: 5, minutes: 5 }, { title: 'Run', points: 30, minutes: 40 }];
const proj = previewDayTarget(tasks, 8, {}).target;
ok(proj > 0 && requiredPoints({ tasks, hours: 8, stats: {} }) === proj, 'before start: projected target');
ok(requiredPoints({ lock: { target: 77 }, tasks, hours: 8 }) === 77, 'locked: boss target');
const snap = buildWidgetSnapshot([{ ...tasks[0], completed: true }, tasks[1]], { ptsTarget: 200 });
ok(snap.ptsTarget === 200 && snap.ptsDone === 60, 'widget payload carries earned + required');
ok(buildWidgetSnapshot(tasks).ptsTarget === 0, 'widget default 0 (Swift falls back to total)');
const now = Date.now(); const a = topAlert({ running: true, earned: 40, target: 200, startMs: now - 3600e3, endMs: now + 600e3, nowMs: now });
ok(a && a.text.includes('40/200 pts'), 'boss message shows earned/required: ' + (a && a.text));
console.log(`test-day-points: ${pass} passed`);
