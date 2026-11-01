// Regression: completing a one-time task (incl. repeat-series copies) on a locked 8-hour day must update in place, even while the
// 8-hour UI state is still loading (cold start from widget / Live Activity / notification). Run: node scripts/test-points-credit.js
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire');
const lockMod = sr.load('utils/eightHourLock.js');
const core = require('../netlify/functions/lib/eightHourCore.js');
const { completionKeepsInPlace, setLockSource, isDayLocked } = lockMod;
const now = 1793290000000;
setLockSource(() => ({ lock: { dayName: 'Thu', startMs: now - 3600e3, endMs: now + 3600e3 }, nowMs: now }));
// UI not ready yet (eh.running false), cached/server lock says Thu is locked -> keep in place
assert.strictEqual(completionKeepsInPlace({ uiLocked: false, sourceLocked: isDayLocked('Thu') }), true);
assert.strictEqual(completionKeepsInPlace({ uiLocked: true, sourceLocked: false }), true);
assert.strictEqual(completionKeepsInPlace({ uiLocked: false, sourceLocked: isDayLocked('Fri') }), false);
// Points are credited positionally from the lock; a removed slot would shift / drop credit
const tasks = [{ createdAt: 'a', completed: true }, { createdAt: 'b', completed: false }, { createdAt: 'c', templateId: 'x', type: 'one-time', completed: true }];
const lock = { dayKey: '2026-10-29', points: [35, 15, 60] };
assert.deepStrictEqual(core.progressOf(lock, tasks), { earned: 95, done: 2, total: 3 });
// HomeView wiring: the completion path uses the helper with the lock source, and restores the card when the write is rejected
const hv = fs.readFileSync(path.join(__dirname, '../src/views/HomeView.vue'), 'utf8');
assert.ok(/lockedToggle = completionKeepsInPlace\(\{ uiLocked: selectedDayLocked\.value, sourceLocked: isDayLocked\(/.test(hv));
assert.ok(hv.includes('write rejected: never lose the card'));
console.log('test-points-credit: ok');
