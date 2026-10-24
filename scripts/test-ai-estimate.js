// Auto task-time estimate: local estimator (title hints + dictionary), wiring into taskEstimate, AI override hook, play-starts-countdown wiring.
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire');
const ai = sr.load('utils/aiEstimate.js'); const est = sr.load('utils/taskEstimate.js');
let pass = 0; const ok = (v, m) => { assert.ok(v, m); pass++; };
const m = (title, extra = {}) => est.estimateFor({ title, ...extra }).minutes;
const near = (title, want, tol = 0) => { const got = m(title); ok(Math.abs(got - want) <= tol, `${title}: got ${got}, want ~${want}`); };
near('clean kitchen', 30); near('Clean the kitchen', 30);
near('take out trash', 5); near('do laundry', 60); near('grocery shopping', 60);
near('go to the gym', 60); near('go for a run', 30); near('call mom', 15);
near('reply to emails', 20); near('study for exam', 120); near('write report', 90);
near('read 20 min', 20); near('workout 1h', 60); near('project 1.5 hours', 90); near('focus 1h30', 90);
near('quick tidy', 10); near('deep clean the whole house', 180);
ok(m('asdf qwerty') % 5 === 0 && m('asdf qwerty') > 0, 'fallback rounds to 5');
for (const t of ['clean kitchen', 'call mom', 'pay rent', 'xyz']) ok(m(t) % 5 === 0, `5-min step ${t}`);
// typed override still wins; existing stored estimates untouched
ok(est.estimateFor({ title: 'clean kitchen', estimateMin: 45 }).minutes === 45, 'typed override');
ok(est.chipValues({ title: 'clean kitchen', minutes: 40, points: 9 }).minutes === 40, 'stored minutes kept');
ok(est.estimateFor({ title: 'clean kitchen' }).estimateSource === 'local', 'source local');
// AI override hook
ok(ai.applyAiEstimate({ title: 'x', minutes: 25 }, 42).minutes === 40, 'ai override rounds');
ok(ai.applyAiEstimate({ title: 'x', estimateMin: 10 }, 42).estimateMin === 10, 'ai never beats user');
// UI wiring
const home = fs.readFileSync(path.join(sr.src, 'views/HomeView.vue'), 'utf8');
const add = fs.readFileSync(path.join(sr.src, 'components/home/AddTaskModal.vue'), 'utf8');
ok(!/nt-est/.test(add), 'no estimate picker in add-task');
ok(/const openTaskTimerModal = async[\s\S]{0,400}await startTimer\(\)/.test(home), 'play starts countdown directly');
ok((home.match(/estimateFor\(/g) || []).length >= 2, 'estimate at creation (normal + scheduled)');
console.log(`test-ai-estimate: ${pass} passed`);
for (const t of ['clean kitchen', 'take out trash', 'do laundry', 'grocery shopping', 'go to the gym', 'call mom', 'reply to emails', 'study for exam', 'write report', 'walk the dog', 'read 20 min', 'meal prep']) console.log(`  ${t} -> ${m(t)} min`);
