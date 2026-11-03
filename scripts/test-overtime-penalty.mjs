// Overtime penalty: earned = round(points x max(0.5, 1 - overtime/duration)); same on app (sessionGoal/gamePlan) and server (eightHourCore).
// Run: node scripts/test-overtime-penalty.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { overtimePoints, overtimeInfo, overtimeStamp, overtimeText, sessionGoal } from '../src/utils/sessionGoal.js';
const core = createRequire(import.meta.url)('../netlify/functions/lib/eightHourCore.js');
const M = 60000; let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const done = (durMin, tookMin) => ({ completed: true, ...overtimeStamp(durMin * M, Math.max(0, tookMin - durMin) * M) });

t('20 min / 10 pts / finished at 26 min -> 7', () => { const x = done(20, 26); assert.equal(overtimePoints(10, x), 7); assert.equal(core.overtimePoints(10, x), 7); });
t('on time / early / no timer -> full points', () => { assert.equal(overtimePoints(10, done(20, 20)), 10); assert.equal(overtimePoints(10, done(20, 5)), 10);
  assert.equal(overtimePoints(10, { completed: true }), 10); assert.equal(overtimePoints(10, { completed: true, ...overtimeStamp(0) }), 10); });
t('floor 50%', () => { assert.equal(overtimePoints(10, done(20, 200)), 5); assert.equal(overtimePoints(40, done(20, 40)), 20); });
t('app == server for a sweep', () => { for (const p of [10, 20, 40]) for (const took of [0, 21, 24, 29, 33, 45, 90]) { const x = done(20, took); assert.equal(overtimePoints(p, x), core.overtimePoints(p, x)); } });
t('penalty info + explicit copy', () => { const i = overtimeInfo(10, done(20, 26)); assert.deepEqual(i, { full: 10, earned: 7, lost: 3, overMin: 6, durMin: 20 });
  assert.equal(overtimeText(i), 'Overtime penalty: \u22123 pts. You went 6 min over the 20 min timer, so you earned 7 of 10.'); });
t('session earned uses the penalised points; un-complete removes exactly that', () => {
  const a = { title: 'A', size: 's', ...done(20, 26) }, b = { title: 'B', size: 's', completed: true };
  assert.equal(sessionGoal([a, b], { sessions: 1, n: 1, endMs: Infinity }).earned, 17);
  const un = { ...a, completed: false, ...overtimeStamp(0) }; assert.equal(sessionGoal([un, b], { sessions: 1, n: 1, endMs: Infinity }).earned, 10);
  const lock = { dayKey: 'x', points: [10, 10], ids: null }; // server progressOf on the same tasks
  assert.equal(core.overtimePoints(10, a) + core.overtimePoints(10, b), 17); });
t('wiring: server, client, celebration, warning', () => {
  const r = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert.match(r('netlify/functions/eight-hour-day.js'), /earned \+= overtimePoints\(p, t\)/);
  assert.match(r('netlify/functions/lib/eightHourCore.js'), /earned \+= overtimePoints\(p, t\)/);
  assert.match(r('src/utils/gamePlan.js'), /overtimePoints\(sizePoints/);
  const h = r('src/views/HomeView.vue'); assert.match(h, /overtimeStamp\(ringDurationMs\(task\)/); assert.match(h, /warnHaptic\(\)/); assert.match(h, /overtimeStamp\(0\)\); \/\/ un-complete/);
  const c = r('src/components/home/PointsCelebration.vue'); assert.match(c, /Overtime penalty: −\{\{ item\.penalty\.lost \}\} pts/); assert.match(c, /<s v-if="item\.penalty"/);
  assert.match(r('src/utils/localNotify.js'), /You're over time, you're now losing points\./); assert.match(r('src/components/home/TimerRing.vue'), /timer-ring-warn/); });
console.log(`${n} overtime-penalty tests passed`);
