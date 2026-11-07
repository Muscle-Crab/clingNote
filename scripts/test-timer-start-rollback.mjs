// startTimer must not leave a "running" card behind when the save is rejected (the next refresh then showed it stopped at once).
import assert from 'assert';
import fs from 'fs';
const hv = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
const fn = hv.slice(hv.indexOf('const startTimer = async'), hv.indexOf("sfx('timerStart')", hv.indexOf('const startTimer = async')));
assert.ok(/await mutateDay\(dayName/.test(fn), 'timer patches the stored task by identity');
assert.ok(/selectedDayRoutine\.value\[at\] = before/.test(fn), 'rolls back to the stored copy');
assert.ok(/lockMessage\(e\)/.test(fn) && /writeFailureMessage\(/.test(fn), 'tells the user the real write error');
assert.ok(!/Check your connection and try again/.test(fn), 'a rules rejection is not labeled as offline');
console.log('test-timer-start-rollback: ok');
