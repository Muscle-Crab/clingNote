// B44 wake-up auto-lock: pure helpers + wiring/source checks (server path is covered in scripts/e2e/b44-wake-lock.e2e.js).
import assert from 'node:assert/strict'; import fs from 'node:fs';
import { wakeLockMinutes, parseHM, wakeLockNote, wakeLockPlan, shouldReconcileWake, MIN_MINUTES } from '../src/utils/wakeLock.js';
let n = 0; const t = (name, f) => { f(); n++; console.log('ok  ' + name); };
const R = { enabled: true, lockInEnabled: true, native: true, authorized: true, selectionCount: 3, wakeTime: '07:00', hours: 8 };
const W = Date.UTC(2026, 9, 31, 11), H = 3600000;
t('minutes = day length, clamped 3-12h', () => { assert.equal(wakeLockMinutes(8), 480); assert.equal(wakeLockMinutes(1), 180); assert.equal(wakeLockMinutes(20), 720); assert.equal(MIN_MINUTES, 15); });
t('parseHM', () => { assert.deepEqual(parseHM('7:05'), { hour: 7, minute: 5 }); assert.equal(parseHM('24:00'), null); assert.equal(parseHM(''), null); });
t('notes', () => {
  assert.equal(wakeLockNote({ native: false }), 'iPhone app only.');
  assert.match(wakeLockNote({ native: true, authorized: false }), /Screen Time/);
  assert.match(wakeLockNote({ native: true, authorized: true, selectionCount: 0 }), /Pick the apps/);
  assert.match(wakeLockNote({ native: true, authorized: true, selectionCount: 1, wakeTime: '' }), /wake time/);
  assert.equal(wakeLockNote({ native: true, authorized: true, selectionCount: 1, wakeTime: '07:00' }), null);
});
// Start anytime: the wake-up auto-lock is removed. The plan always cancels (so an update clears a lock an older
// version scheduled on iOS) and Home never creates a session from the wake time.
t('plan always cancels (wake-up lock removed)', () => {
  assert.deepEqual(wakeLockPlan({ ...R, wakeMs: W }), { action: 'cancel', note: null });
  assert.equal(wakeLockPlan({ ...R, enabled: false }).action, 'cancel');
});
t('never reconciles a session from the wake time', () => {
  const b = { enabled: true, lockInToday: true, phase: 'ready', hasLock: false, wakeMs: W, hours: 8 };
  assert.equal(shouldReconcileWake({ ...b, nowMs: W + 40 * 60000 }), false);
});
const src = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
t('swift: shared WakeLock + plugin + monitor', () => {
  const sh = src('ios/App/Shared/LockShared.swift'), pl = src('ios/App/App/ClingLockPlugin.swift'), mo = src('ios/App/ClingLockMonitor/ClingLockMonitor.swift');
  assert.match(sh, /enum WakeLock/); assert.match(sh, /clingWakeLock/);
  for (const m of ['scheduleWakeLock', 'cancelWakeLock', 'setWakeSkip', 'wakeLockStatus']) assert.match(pl, new RegExp(`CAPPluginMethod\\(name: "${m}"`));
  assert.match(pl, /repeats: true/); assert.match(mo, /startWakeLock/); assert.match(mo, /Your lock-in started/);
});
t('server: autoWake is ignored, starts are always now', () => { const s = src('netlify/functions/eight-hour-day.js'); assert.doesNotMatch(s, /autoWake \? ph\.wakeMs/); });
t('wiring: settings row hidden', () => { const pf = src('src/views/Profile.vue'); assert.match(pf, /v-if="false" class="pf-row pf-row--divided" data-test="wake-lock-row"/); });
console.log(`wake-lock: ${n} ok`);
