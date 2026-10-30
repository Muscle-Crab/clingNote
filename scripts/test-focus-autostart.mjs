// Run: node scripts/test-focus-autostart.mjs  (Focus mode auto-start + lock: src/utils/focusAutoStart.js + wiring)
import fs from 'fs'; import path from 'path'; import assert from 'assert'; import { fileURLToPath } from 'url';
import { dueAutoFocus, nextFocusIndex, reduceFilterEvents, lockedFocus, lockMessage, endEarlyPatch, focusShieldEnd, readAutoFocus, writeAutoFocus, firedKey, taskMinutes, toMin, AUTO_FOCUS_KEY } from '../src/utils/focusAutoStart.js';
import { classifyFocusAction, focusActivityState, focusContentSig } from '../src/utils/focusActions.js';
const here = path.dirname(fileURLToPath(import.meta.url)); const rd = (p) => fs.readFileSync(path.join(here, '..', p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const NOW = Date.UTC(2026, 9, 30, 14, 0, 0); const iso = (m) => new Date(m).toISOString();
// ZZTEST fixtures only
const tasks = () => [
  { id: 'ZZTEST_a', title: 'ZZTEST mail', startTime: '08:00' },
  { id: 'ZZTEST_b', title: 'ZZTEST write', startTime: '09:00', estimateMin: 45 },
  { id: 'ZZTEST_c', title: 'ZZTEST gym' },
];
t('toMin / taskMinutes', () => { assert.equal(toMin('09:05'), 545); assert.equal(toMin('x'), null); assert.equal(taskMinutes({ estimateMin: 45 }), 45); assert.equal(taskMinutes({}), 25); assert.equal(taskMinutes({ estimateMin: 999 }), 25); });
t('due at start time, within grace, latest wins', () => {
  const d = dueAutoFocus(tasks(), { nowMin: 9 * 60 + 2, dayKey: 'D' });
  assert.equal(d.index, 1); assert.equal(d.minutes, 45); assert.equal(d.key, firedKey('D', tasks()[1]));
  assert.equal(dueAutoFocus(tasks(), { nowMin: 8 * 60 + 10, dayKey: 'D' }).index, 0);
  assert.equal(dueAutoFocus(tasks(), { nowMin: 7 * 60 + 59 }), null, 'not before start');
  assert.equal(dueAutoFocus(tasks(), { nowMin: 9 * 60 + 16 }), null, 'past grace');
});
t('never twice, not while a timer runs, not for done tasks', () => {
  const d = dueAutoFocus(tasks(), { nowMin: 540, dayKey: 'D' });
  assert.equal(dueAutoFocus(tasks(), { nowMin: 541, dayKey: 'D', fired: [d.key] }), null);
  const run = tasks(); run[2] = { ...run[2], timerActive: true, timerEndTime: iso(NOW + 60000) };
  assert.equal(dueAutoFocus(run, { nowMin: 540 }), null);
  const done = tasks(); done[1].completed = true; assert.equal(dueAutoFocus(done, { nowMin: 540 }), null);
});
t('nextFocusIndex: earliest start, else first open', () => {
  assert.equal(nextFocusIndex(tasks()), 0);
  const x = tasks(); x[0].completed = true; assert.equal(nextFocusIndex(x), 1);
  assert.equal(nextFocusIndex([{ id: 'ZZTEST_z', completed: true }, { id: 'ZZTEST_y' }]), 1);
  assert.equal(nextFocusIndex([]), -1);
});
t('reduceFilterEvents: latest fresh wins, stale/applied ignored, all acked', () => {
  const q = [{ id: '1', kind: 'on', ts: NOW - 5000, minutes: 50 }, { id: '2', kind: 'off', ts: NOW - 3000 }, { id: '3', kind: 'on', ts: NOW - 1000, minutes: 30 }];
  let r = reduceFilterEvents(q, { now: NOW }); assert.equal(r.state, 'on'); assert.equal(r.minutes, 30); assert.deepEqual(r.ids, ['1', '2', '3']);
  r = reduceFilterEvents(q.slice(0, 2), { now: NOW }); assert.equal(r.state, 'off');
  assert.equal(reduceFilterEvents(q, { now: NOW, applied: ['1', '2', '3'] }).state, null);
  assert.equal(reduceFilterEvents([{ id: 'o', kind: 'on', ts: NOW - 13 * 3600e3 }], { now: NOW }).state, null, 'stale');
  assert.equal(reduceFilterEvents('junk', { now: NOW }).state, null);
});
t('lockedFocus / message / end early', () => {
  const x = tasks(); x[1] = { ...x[1], timerActive: true, timerEndTime: iso(NOW + 20 * 60000), focusLock: true };
  assert.equal(lockedFocus(x, NOW).id, 'ZZTEST_b'); assert.match(lockMessage(x[1], NOW), /20 more min/);
  assert.equal(lockedFocus(x, NOW + 21 * 60000), null, 'expired');
  x[1].focusLock = false; assert.equal(lockedFocus(x, NOW), null);
  const p = endEarlyPatch(NOW); assert.equal(p.timerActive, false); assert.equal(p.focusLock, false); assert.ok(p.focusEndedEarlyAt);
});
t('focusShieldEnd only with lock pref + selection + no day shield', () => {
  const lk = { timerEndTime: iso(NOW + 30 * 60000) };
  assert.equal(focusShieldEnd({ enabled: true, selectionCount: 2, locked: lk, now: NOW }), NOW + 30 * 60000);
  assert.equal(focusShieldEnd({ dayWant: true, enabled: true, selectionCount: 2, locked: lk, now: NOW }), 0);
  assert.equal(focusShieldEnd({ enabled: false, selectionCount: 2, locked: lk, now: NOW }), 0);
  assert.equal(focusShieldEnd({ enabled: true, selectionCount: 0, locked: lk, now: NOW }), 0);
});
t('pref storage', () => { const m = new Map(); const s = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  assert.equal(readAutoFocus(s), false); writeAutoFocus(s, true); assert.equal(m.get(AUTO_FOCUS_KEY), '1'); assert.equal(readAutoFocus(s), true); writeAutoFocus(s, false); assert.equal(readAutoFocus(s), false); });
t('lock-screen pause on a locked focus is refused; activity carries locked', () => {
  const x = { id: 'ZZTEST_b', title: 'ZZTEST write', timerActive: true, timerEndTime: iso(NOW + 60000), focusLock: true };
  assert.equal(classifyFocusAction({ kind: 'pause', taskId: 'ZZTEST_b', ts: NOW }, [x], { now: NOW }), 'locked');
  assert.equal(focusActivityState(x).locked, true);
  assert.notEqual(focusContentSig(focusActivityState({ ...x, focusLock: false })), focusContentSig(focusActivityState(x)));
});
t('wiring', () => {
  const home = rd('src/views/HomeView.vue');
  for (const s of ['autoStartFocus', 'drainFocusFilter', 'endFocusEarly', 'onBeforeRouteLeave', 'focusShieldEnd', '@end-focus']) assert.ok(home.includes(s), s);
  assert.ok(rd('src/components/home/TaskCard.vue').includes('focus-lock-btn'));
  assert.ok(rd('src/views/Profile.vue').includes('auto-focus-toggle'));
  const nat = rd('src/native/clingNative.js'); assert.ok(nat.includes('getFocusFilter') && nat.includes('ackFocusFilter'));
  const plug = rd('ios/App/App/ClingNativePlugin.swift'); assert.ok(plug.includes('name: "getFocusFilter"') && plug.includes('name: "ackFocusFilter"') && plug.includes('getBool("locked")'));
  const ci = rd('ios/App/App/ClingIntents.swift'); assert.ok(/struct ClingFocusFilter: SetFocusFilterIntent/.test(ci) && ci.includes('"focus.filter"'));
  assert.ok(/var locked: Bool\? = nil/.test(rd('ios/App/Shared/FocusActivityAttributes.swift')));
  assert.ok(rd('ios/App/ClingNoteWidget/FocusLiveActivity.swift').includes('state.locked'));
});
console.log(`\n${n} focus-autostart tests passed`);
