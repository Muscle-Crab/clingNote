// Regression (build 36): stop+restart of the .clingLock schedule (startLock on every open / minute tick) makes iOS call
// intervalDidEnd; the extension must not treat that as the lock ending (no alert, no shield clear, no stopMonitoring).
import assert from 'assert';
import fs from 'fs';
const ext = fs.readFileSync(new URL('../ios/App/ClingLockMonitor/ClingLockMonitor.swift', import.meta.url), 'utf8');
const plug = fs.readFileSync(new URL('../ios/App/App/ClingLockPlugin.swift', import.meta.url), 'utf8');
const SLACK = Number(ext.match(/static let endSlackMs: Double = ([\d_]+)/)[1].replace(/_/g, ''));
const isRealEnd = (u, now) => u > 0 && u <= now + SLACK;
const now = 1793330000000;
assert.equal(isRealEnd(now + 3 * 3600e3, now), false, 'restart mid-lock is not an end');
assert.equal(isRealEnd(now + 30e3, now), true, 'minute-truncated real end (fires < 60 s early) counts');
assert.equal(isRealEnd(now - 5e3, now), true);
assert.equal(isRealEnd(0, now), false, 'stopped by the app: no alert');
// gate must run before notify / stopMonitoring in both branches
const body = ext.slice(ext.indexOf('override func intervalDidEnd'), ext.indexOf('private func notifyLockEnded'));
const firstGate = body.indexOf('isRealEnd'); const secondGate = body.indexOf('isRealEnd', firstGate + 1);
assert(firstGate > 0 && firstGate < body.indexOf('stopMonitoring([activity])'), 'per-app branch gated');
assert(secondGate > 0 && secondGate < body.indexOf('stopMonitoring([.clingLock])'), 'clingLock branch gated');
// app writes state before stopping/restarting, so the extension reads the intended end
const stopLock = plug.slice(plug.indexOf('func stopLock'), plug.indexOf('func setLockEndAlert'));
assert(stopLock.indexOf('stateKey') < stopLock.indexOf('stopMonitoring'), 'stopLock saves state before stopMonitoring');
const startLock = plug.slice(plug.indexOf('func startLock'), plug.indexOf('func stopLock'));
assert(startLock.indexOf('stateKey') < startLock.indexOf('stopMonitoring'), 'startLock saves state before restart');
const lockApps = plug.slice(plug.indexOf('func lockApps'), plug.indexOf('func unlockApps'));
assert(lockApps.indexOf('saveLocked') < lockApps.indexOf('stopMonitoring'), 'lockApps saves ends before restart');
const unlockApps = plug.slice(plug.indexOf('func unlockApps'), plug.indexOf('static func applyShield'));
assert(unlockApps.indexOf('saveLocked') < unlockApps.indexOf('stopMonitoring'), 'unlockApps saves before stop');
console.log('test-lock-restart-noalert: ok');
