// syncAppLock decision: no end push-back, restart only when needed, expired native lock always stopped.
import assert from 'node:assert/strict';
import { lockAction } from '../src/utils/appLock.js';
const now = 1_000_000_000_000, end = now + 30 * 60000;
assert.equal(lockAction({ want: true, endMs: end, st: {}, now }), 'start');
assert.equal(lockAction({ want: true, endMs: end, st: { locked: true, until: end, monitoring: true }, now }), 'none');
assert.equal(lockAction({ want: true, endMs: end, st: { locked: true, until: end, monitoring: false }, now }), 'start'); // schedule lost
assert.equal(lockAction({ want: true, endMs: end + 60000, st: { locked: true, until: end, monitoring: true }, now }), 'none'); // never later
assert.equal(lockAction({ want: true, endMs: end - 60000, st: { locked: true, until: end, monitoring: true }, now }), 'start'); // earlier is ok
assert.equal(lockAction({ want: true, endMs: end, st: { locked: true, until: now - 1, monitoring: true }, now }), 'stop'); // expired
assert.equal(lockAction({ want: false, st: { locked: true, until: end }, now }), 'stop');
assert.equal(lockAction({ want: false, st: {}, now }), 'none');
console.log('ok test-lock-action');
