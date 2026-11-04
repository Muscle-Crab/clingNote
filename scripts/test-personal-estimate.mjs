// Personalized estimates: topic keys, outliers, last-20 cap, w = n/(n+3) EWMA blend, convergence. Run: node scripts/test-personal-estimate.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const m = await import('../src/utils/personalEstimate.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
t('topic keys', () => { assert.equal(m.topicKey('Car inspection'), 'inspection'); assert.equal(m.topicKey('home inspection'), 'inspection');
  assert.equal(m.topicKey('Dentist appointment'), 'appointment'); assert.equal(m.topicKey('Clean the kitchen'), 'clean'); assert.equal(m.topicKey('Water the plants'), 'plant'); });
t('outliers ignored: <1 min or >4x estimate', () => { const h = {};
  assert.equal(m.recordActual(h, 'clean', 0.5, 20), h); assert.equal(m.recordActual(h, 'clean', 81, 20), h); assert.deepEqual(m.recordActual(h, 'clean', 80, 20), { clean: [80] }); });
t('keeps last 20 per key', () => { let h = {}; for (let i = 1; i <= 25; i++) h = m.recordActual(h, 'k', i, 30);
  assert.equal(h.k.length, 20); assert.equal(h.k[0], 6); assert.equal(h.k[19], 25); });
t('no history = AI/local estimate unchanged; weight n/(n+3)', () => { assert.equal(m.personalize(20, []), 20);
  assert.equal(m.personalize(20, [40]), 25); /* w=.25: 15+10 */ assert.equal(m.personalize(60, [120, 120, 120]), 90); /* w=.5 */ });
t('converges: always 25 min on a 20-min estimate drifts to 25', () => { let h = {}; const seen = [];
  for (let i = 0; i < 20; i++) { seen.push(m.personalize(20, h.x)); h = m.recordActual(h, 'x', 25, 20); }
  assert.equal(seen[0], 20); assert.equal(seen.at(-1), 25); for (let i = 1; i < seen.length; i++) assert(seen[i] >= seen[i - 1], 'monotone'); });
t('converges down too: 60-min estimate, user takes 40', () => { let h = {}; for (let i = 0; i < 20; i++) h = m.recordActual(h, 'x', 40, 60);
  assert.equal(m.personalize(60, h.x), 45); h = m.recordActual(h, 'x', 40, 60); assert(m.personalize(60, h.x) <= 45); });
t('EWMA tracks recent change', () => { const xs = [...Array(10).fill(20), ...Array(10).fill(40)]; assert(m.ewma(xs) > 38); });
t('estimator + HomeView wiring; penalty still uses timerDurationMinutes', () => {
  m.setEstimateHistory({ inspection: Array(20).fill(150) }); assert(m.personalFor('car inspection', 90) >= 140); m.setEstimateHistory({});
  const te = fs.readFileSync(new URL('../src/utils/taskEstimate.js', import.meta.url), 'utf8'); assert.match(te, /personalFor\(task\.title, auto\.minutes\)/); assert.match(te, /personalFor\(a0\.title, a0\.minutes\)/);
  const h = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  assert.match(h, /recordEstimateActual\(task, ringElapsedMs\(task, Date\.parse\(completedNow\)\) \/ 60000\)/); assert.match(h, /\[`estHistory\.\$\{key\}`\]/); assert.match(h, /setEstimateHistory\(userDocSnapshot\.data\(\)\.estHistory\)/);
  assert.match(h, /overtimeStamp\(ringDurationMs\(task\), ringOvertimeMs/); });
console.log(`${n} personal-estimate tests passed`);
