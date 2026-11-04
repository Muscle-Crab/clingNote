import assert from 'assert';
import * as BI from '../src/utils/breakIndicator.js';
import * as G from '../src/utils/gamePlan.js';
const M = BI.indicatorMode;
assert.strictEqual(M({}), 'hidden');
assert.strictEqual(M({ available: true, n: 1, day: 'd' }), 'popup');
const seen = BI.collapse('d', 1);
assert.strictEqual(M({ available: true, n: 1, day: 'd', seen }), 'pill'); // dismissed/tapped -> collapsed pill
assert.strictEqual(M({ available: true, n: 2, day: 'd', seen }), 'popup'); // next break pops again
assert.strictEqual(M({ available: true, n: 1, day: 'e', seen }), 'popup'); // new day
assert.strictEqual(M({ available: false, n: 1, day: 'd', seen }), 'hidden');
assert.strictEqual(M({ running: true, available: false }), 'running');
assert.strictEqual(BI.fmtLeft(61000), '1:01'); assert.strictEqual(BI.fmtLeft(-5), '0:00');
// break lengths are points-only now: 10 / 20 / 30 (no performance scaling); the re-shield end = start + that length
{ const g = G.normPlan({ dayStart: '09:00' }); const now = new Date(2026, 10, 2, 9, 10).getTime(); G.setSessionWindow({ startMs: new Date(2026, 10, 2, 9).getTime(), endMs: new Date(2026, 10, 2, 17).getTime() });
  const lens = [[0, 50, 10], [1, 100, 20], [2, 150, 30], [5, 400, 30]].map(([taken, points, want]) => { const prog = { points, taken, goal: 100, earned: 0 }; const b = G.takeBreak(g, null, now, null, prog);
    return b && (b.endMs - b.startMs) / 60000 === want && G.breakEarned(g, b, now + 1000, prog); });
  assert.deepStrictEqual(lens, [true, true, true, true]); console.log('break lengths 10/20/30: ok'); }
