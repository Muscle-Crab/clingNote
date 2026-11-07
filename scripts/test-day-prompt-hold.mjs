// A running session must not be replaced by the hours dialog after a transient signed-out blip or one failed refresh.
import assert from 'assert';
import fs from 'fs';
import { runningLock, authKeepsDay, shouldKeepServerDay, closeDayPrompt, autoOpenDayPrompt } from '../src/utils/dayPrompt.js';
import core from '../netlify/functions/lib/eightHourCore.js';

const now = Date.parse('2026-11-06T12:05:00Z');
const dayKey = '2026-11-06';
const lock = { dayKey, startMs: now - 60 * 1000, endMs: now + 6 * 3600 * 1000, local: false, hours: 6, target: 185 };
const serverDay = { offline: false, plan: { tz: 'America/New_York', wakeTime: '07:00', taskCount: 8 }, lock };
const ask = (over) => autoOpenDayPrompt({ phase: 'ready', running: false, hasLock: false, scheduled: false, dayKey, promptSeen: '', open: false, signedIn: true, lockIn: true, today: true, ...over });

assert.equal(runningLock(lock, now), lock, 'server cache still inside its window is the active session');
const localLock = { ...lock, local: true };
assert.equal(runningLock(localLock, now), localLock, 'a locally started session still inside its window is kept too');
assert.equal(runningLock({ ...lock, endMs: now - 1 }, now), null, 'an ended session is not revived as running');
assert.equal(core.evaluatePhase({ tz: 'America/New_York', nowMs: now, lock }).phase, 'running');

assert.equal(shouldKeepServerDay(true, serverDay), true, 'one failed refresh keeps the loaded server day');
assert.equal(shouldKeepServerDay(false, null), false, 'cold start with nothing loaded may use the cache');
assert.equal(shouldKeepServerDay(true, { offline: true, plan: serverDay.plan, lock: null }), false);

assert.equal(authKeepsDay('user-a', null, true), true, 'null auth flicker keeps the loaded day');
assert.equal(authKeepsDay('user-a', 'user-a', true), true, 'same user after restore keeps it');
assert.equal(authKeepsDay('user-a', 'user-b', true), false, 'a different account still drops the day');
assert.equal(authKeepsDay(null, 'user-a', false), false);
assert.equal(authKeepsDay('user-a', null, false), false, 'signed out with no day does not hold');

const openOverRunning = ask({ phase: 'running', running: true, hasLock: true });
assert.equal(openOverRunning, false, 'do not open the hours dialog over a running session');
assert.equal(closeDayPrompt({ phase: 'running', running: true }), true, 'a running session closes a stale dialog');
assert.equal(ask({ hasLock: true, phase: 'ready' }), false, 'a lock still in memory is not "no session"');
assert.equal(ask({}), true, 'ready, no lock, not yet asked: the morning prompt can show');

// Repro: session was running, a no-lock fallback would have looked "ready", then the real lock returns.
const dropped = { phase: 'ready', running: false, hasLock: false };
assert.equal(ask(dropped), true, 'the bug shape: ready and no lock would open the dialog');
const restored = { phase: 'running', running: true, hasLock: true };
assert.equal(ask(restored), false);
assert.equal(closeDayPrompt(restored), true, 'after the lock returns, dayPromptOpen must close');
assert.equal(closeDayPrompt({ phase: 'ready', running: false }), false, 'an ended/ready day does not force-close a manual prompt');

const eh = fs.readFileSync(new URL('../src/composables/useEightHour.js', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
assert.ok(/authKeepsDay\(st\.uid/.test(eh) && /shouldKeepServerDay\(st\.loaded, st\.data\)/.test(eh) && /runningLock\(l, now\)/.test(eh));
assert.ok(/if \(await reconcileWakeLock\(\)\) return;/.test(home) && /if \(!autoOpenDayPrompt\(dayPromptState\(\)\)\) return;/.test(home));
assert.ok(/if \(closeDayPrompt\(dayPromptState\(\)\)\) dayPromptOpen\.value = false/.test(home));

console.log('day-prompt hold: ok');
