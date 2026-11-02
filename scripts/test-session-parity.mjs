// Server/app parity for the per-session goal: the same fixtures go through the app path (src/utils/sessionPoints.js sessionsOf/
// sessionPoints) and the server path (netlify/functions/lib/sessionGrace.js, what eight-hour-day settles with). Targets, earned and
// met must match exactly, including the old 160-vs-app mismatch case (server summed the block's locked eight-hour points).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as SP from '../src/utils/sessionPoints.js';
import * as SG from '../src/utils/sessionGoal.js';
const require = createRequire(import.meta.url);
const { sessionGrace } = require('../netlify/functions/lib/sessionGrace.js');
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const day = Date.UTC(2026, 10, 2, 12); const H = 3600000;
const w1 = { n: 1, startMs: day, endMs: day + 4 * H }; const w2 = { n: 2, startMs: day + 4 * H, endMs: day + 8 * H };
const at = (h) => day + h * H;
const both = (tasks, sessions = 2) => [w1, w2].slice(0, sessions === 1 ? 1 : 2).map((w) => {
  const win = sessions === 1 ? { ...w, endMs: w2.endMs } : w;
  const app = SP.sessionPoints(tasks, win, { sessions, estMinutes: () => 999 }); // the app's extra opts must not change the answer
  const srv = sessionGrace(tasks, { ...win, sessions });
  assert.equal(srv.target, app.target, `target s${w.n}`); assert.equal(srv.earned, app.earned, `earned s${w.n}`); assert.equal(srv.met, app.met, `met s${w.n}`);
  return app;
});
const F = {
  // The 160 case: eight-hour locked points (40 each, 4 morning tasks) used to give the server 160; size rules give 4 x M 20 = 80.
  mismatch160: [1, 2, 3, 4].map((i) => ({ id: `m${i}`, title: `Write report ${i}`, section: 'morning', points: 40, minutes: 60, completed: i <= 2, completedAt: at(1) }))
    .concat([{ id: 'a1', title: 'Call bank', section: 'afternoon', points: 40, minutes: 60 }]),
  sizes: [{ id: 's', size: 's', section: 'morning', completed: true, completedAt: at(0.5) }, { id: 'l', size: 'l', startTime: '09:00', completed: true, completedAt: at(3.9) },
    { id: 'n', size: 'm', section: 'noon', completed: true, completedAt: at(5) }, { id: 'p', size: 'l', startTime: '16:00' }],
  outsideWindow: [{ id: 'x', size: 'm', section: 'morning', completed: true, completedAt: at(4.5) }, { id: 'y', size: 'm', section: 'afternoon', completed: true, completedAt: at(1) }],
  skippedAndPending: [{ id: 'a', size: 'l', status: 'wontdo' }, { id: 'b', size: 'l', status: 'pending' }, { id: 'c', estimateMin: 20, completed: true, completedAt: { seconds: at(1) / 1000 } }],
  titleEstimate: [{ id: 'e', title: 'Gym 90 min', completed: true, completedAt: new Date(at(2)).toISOString() }, { id: 'f', title: 'Groceries', section: 'noon' }],
  empty: [],
};
t('160 mismatch case: server == app, target 80 not 160', () => { const [s1, s2] = both(F.mismatch160); assert.equal(s1.target, 80); assert.equal(s1.earned, 40); assert.equal(s2.target, 20);
  assert.equal(F.mismatch160.filter((x) => x.section === 'morning').reduce((a, x) => a + x.points, 0), 160, 'old server sum'); });
t('sizes + start-time sections', () => { const [s1, s2] = both(F.sizes); assert.deepEqual([s1.target, s1.earned, s2.target, s2.earned], [50, 50, 60, 20]); });
t('completions outside the session window do not count', () => { const [s1, s2] = both(F.outsideWindow); assert.equal(s1.earned, 0); assert.equal(s2.earned, 0); });
t('wontdo/pending excluded, Firestore {seconds} time', () => { const [s1] = both(F.skippedAndPending); assert.equal(s1.target, 10); assert.equal(s1.earned, 10); });
t('title estimate fallback identical', () => { const [s1, s2] = both(F.titleEstimate); assert.equal(s1.target, SG.taskPoints(F.titleEstimate[0])); assert.ok(s2.target > 0); });
t('empty day', () => { const [s1, s2] = both(F.empty); assert.equal(s1.target + s2.target, 0); });
t('1 session = all tasks', () => { for (const f of Object.values(F)) both(f, 1); const [s] = both(F.sizes, 1); assert.equal(s.target, 110); });
t('server grace: missed -> end + 2h, met -> 0', () => { assert.equal(sessionGrace(F.sizes, { ...w2, sessions: 2 }).untilMs, w2.endMs + 2 * H); assert.equal(sessionGrace(F.sizes, { ...w1, sessions: 2 }).untilMs, 0); });
import { readFileSync } from 'node:fs';
t('server requires src/utils/sessionGoal.js; gamePlan/sessionPoints import it', () => {
  assert.match(readFileSync('netlify/functions/lib/sessionGrace.js', 'utf8'), /require\('..\/..\/..\/src\/utils\/sessionGoal.js'\)/);
  assert.match(readFileSync('src/utils/sessionPoints.js', 'utf8'), /from '.\/sessionGoal.js'/); assert.match(readFileSync('src/utils/gamePlan.js', 'utf8'), /from '.\/sessionGoal.js'/);
  assert.match(readFileSync('netlify/functions/eight-hour-day.js', 'utf8'), /sessionGrace\(countable\(pruneStale/); });
console.log(`\nsession parity: ${n} ok`);
