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
// Distinct, realistic buckets for similar titles (rule-order / precedence guards)
const table = { 'wash my car': 50, 'wash the car': 50, 'wash a car': 50, 'clean my car': 50, 'car wash': 15, 'drive-through car wash': 15,
  'get gas': 10, 'fill up the tank': 10, 'refuel': 10, 'vacuum car': 30, 'vacuum my car': 30, 'clean car interior': 45, 'oil change': 90,
  'wash clothes': 60, 'wash dishes': 15, 'wash hair': 20, 'take a shower': 15, 'mow the lawn': 50, 'mow lawn': 50, 'rake leaves': 60, 'clean gutters': 90,
  'doctor appointment': 60, 'haircut': 45, 'dentist': 60, 'pay bills': 15, 'pay electric bill': 5, 'pay rent': 5,
  'pick up kids': 30, 'help kids with homework': 45, 'bath the kids': 30, 'walk the dog': 30, 'take cat to vet': 60, 'groom the dog': 45,
  'fix leaky faucet': 45, 'paint the bedroom': 240, 'change light bulb': 10, 'cook dinner': 45, 'make pasta': 30, 'make a sandwich': 10,
  'grill burgers': 45, 'team meeting': 45, 'standup': 15, '1:1 with manager': 30, 'clean bedroom': 30, 'tidy desk': 20, 'return package': 20,
  'bake cookies': 60, 'walk': 30, 'vacuum': 20 };
for (const [t, want] of Object.entries(table)) near(t, want);
const distinct = (a, b) => ok(m(a) !== m(b), `${a} (${m(a)}) must differ from ${b} (${m(b)})`);
distinct('wash my car', 'get gas'); distinct('car wash', 'get gas'); distinct('wash my car', 'car wash');
distinct('clean my car', 'tidy desk'); distinct('vacuum car', 'vacuum'); distinct('clean car interior', 'vacuum car');
distinct('wash clothes', 'wash dishes'); distinct('wash dishes', 'wash my car'); distinct('wash hair', 'wash my car'); distinct('wash hair', 'wash clothes');
distinct('mow the lawn', 'water the plants'); distinct('haircut', 'doctor appointment'); distinct('standup', 'team meeting');
distinct('pay bills', 'pay rent'); distinct('make a sandwich', 'cook dinner'); distinct('groom the dog', 'feed the dog');
// size multipliers and title durations still apply on new rules
near('quick car wash', 10); near('wash my car 2h', 120); near('thoroughly wash my car', 75);
console.log(`test-ai-estimate: ${pass} passed`);
for (const t of ['clean kitchen', 'take out trash', 'do laundry', 'grocery shopping', 'go to the gym', 'call mom', 'reply to emails', 'study for exam', 'write report', 'walk the dog', 'read 20 min', 'meal prep']) console.log(`  ${t} -> ${m(t)} min`);
