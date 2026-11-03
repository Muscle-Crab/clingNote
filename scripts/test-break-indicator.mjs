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
// performance-scaled minutes
const f = G.breakMinutesFor;
assert.strictEqual(f(0, 100), 15); assert.strictEqual(f(49, 100), 15); assert.strictEqual(f(50, 100), 20); assert.strictEqual(f(99, 100), 20);
assert.strictEqual(f(100, 100), 25); assert.strictEqual(f(149, 100), 25); assert.strictEqual(f(150, 100), 30); assert.strictEqual(f(400, 100), 30);
assert.strictEqual(f(10, 0), 20);
console.log('break indicator + perf minutes: ok');
// takeBreak uses the scaled length when the session goal is known; re-shield end = start + scaled minutes
{ const g = G.normPlan({ dayStart: '09:00' }); const now = new Date(2026, 10, 2, 9, 10).getTime(); G.setSessionWindow({ startMs: new Date(2026, 10, 2, 9).getTime(), endMs: new Date(2026, 10, 2, 17).getTime() });
  const base = { done: 10, total: 20, points: 100 };
  const lens = [[40, 15], [60, 20], [100, 25], [160, 30]].map(([e, want]) => { const b = G.takeBreak(g, null, now, null, { ...base, goal: 100, earned: e });
    return b && (b.endMs - b.startMs) / 60000 === want && G.breakEarned(g, b, now + 1000, base); });
  assert.deepStrictEqual(lens, [true, true, true, true]); console.log('scaled break lengths 15/20/25/30: ok'); }
