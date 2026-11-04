// Count-up timer: elapsed from 00:00, overtime past the set duration, never auto-stops; one local notification at the set duration.
// Run: node scripts/test-timer-countup.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { elapsedMs, overtimeMs, durationMs, fmtElapsed, hasRing } from '../src/utils/timerRing.js';
import { pausePatch, resumePatch, focusActivityState, focusContentSig } from '../src/utils/focusActions.js';
import { buildWidgetSnapshot } from '../src/utils/widgetSnapshot.js';

const M = 60000, S = Date.parse('2026-11-03T15:00:00Z'), iso = (n) => new Date(n).toISOString();
const task = { title: 'Write', createdAt: 1, timerActive: true, timerStartedAt: iso(S), timerEndTime: iso(S + 25 * M), timerDurationMinutes: 25 };
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('counts up from 00:00', () => {
  assert.equal(fmtElapsed(elapsedMs(task, S)), '00:00');
  assert.equal(fmtElapsed(elapsedMs(task, S + 999)), '00:00');
  assert.equal(fmtElapsed(elapsedMs(task, S + 61000)), '01:01');
  assert.equal(fmtElapsed(elapsedMs(task, S + 25 * M)), '25:00');
  assert.equal(fmtElapsed(3723000), '1:02:03');
  assert.equal(durationMs(task), 25 * M);
});
t('overtime keeps counting past the set duration', () => {
  assert.equal(overtimeMs(task, S + 24 * M), 0);
  assert.equal(fmtElapsed(overtimeMs(task, S + 28 * M + 12000)), '03:12');
  assert.equal(elapsedMs(task, S + 40 * M), 40 * M);
});
t('pause freezes elapsed (also in overtime) and resume excludes paused time', () => {
  const p = { ...task, ...pausePatch(task, S + 30 * M) }; // paused 5 min into overtime: no cap at the end
  assert.equal(elapsedMs(p, S + 90 * M), 30 * M);
  const r = { ...p, ...resumePatch(p, S + 50 * M) };
  assert.equal(elapsedMs(r, S + 51 * M), 31 * M);
  assert.equal(overtimeMs(r, S + 51 * M), 6 * M);
});
t('never auto-stops: ring stays for an active timer long past its end; watcher has no stop/carry path', () => {
  assert.equal(hasRing(task, S + 25 * M + 48 * 3600000), true);
  const hv = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  const w = hv.slice(hv.indexOf('const startCountdownWatcher'), hv.indexOf('onMounted(', hv.indexOf('const startCountdownWatcher')));
  assert.ok(w.length > 100);
  assert.doesNotMatch(w, /autoTransferTaskToTomorrow\(|timerActive:\s*false|timerEndTime:\s*null|completed:\s*true/);
});
t('Live Activity state carries durationSec / frozen elapsedSec for the lock-screen count-up', () => {
  const s = focusActivityState(task, { now: S + 3 * M });
  assert.equal(s.durationSec, 1500); assert.equal(s.elapsedSec, undefined);
  const p = focusActivityState({ ...task, ...pausePatch(task, S + 27 * M) }, { now: S + 40 * M });
  assert.equal(p.paused, true); assert.equal(p.elapsedSec, 27 * 60);
  const p2 = focusActivityState({ ...task, ...pausePatch(task, S + 28 * M) }, { now: S + 40 * M });
  assert.notEqual(focusContentSig(p), focusContentSig(p2)); // overtime pauses still update the lock screen
});
t('widget start = effective start (end - set duration), so pauses are excluded', () => {
  const r = { ...task, timerEndTime: iso(S + 35 * M) }; // resumed after a 10 min pause
  const f = buildWidgetSnapshot([r], { now: new Date(S) }).tasks[0];
  assert.equal(f.tS, S + 10 * M); assert.equal(f.tE, S + 35 * M);
});
t('Swift: lock screen / widget count up and never go stale', () => {
  const rd = (p) => fs.readFileSync(new URL(`../ios/App/${p}`, import.meta.url), 'utf8');
  const la = rd('ClingNoteWidget/FocusLiveActivity.swift'), w = rd('ClingNoteWidget/ClingNoteWidget.swift'), at = rd('Shared/FocusActivityAttributes.swift'), it = rd('Shared/FocusIntents.swift'), pl = rd('App/ClingNativePlugin.swift');
  assert.match(la, /Text\(state\.endsAt\.addingTimeInterval\(-TimeInterval\(d\)\), style: \.timer\)/);
  assert.match(w, /Text\(s, style: \.timer\)/); assert.doesNotMatch(w, /countsDown: true\)\.monospacedDigit/);
  assert.match(at, /var durationSec: Int\? = nil/); assert.match(at, /s\.durationSec != nil \? nil/);
  assert.match(it, /s\.elapsedSec = max/); assert.match(pl, /durationSec:/);
  assert.doesNotMatch(pl, /staleDate: state\.paused \? nil : state\.endsAt/);
});
t('one local notification at the set duration; cancelled on pause/complete; music keeps playing', () => {
  const ln = fs.readFileSync(new URL('../src/utils/localNotify.js', import.meta.url), 'utf8');
  assert.match(ln, /scheduleTimerDone = \(t\) => scheduleLocal\(timerKey\(t\), \{[^\n]*at: t\.timerEndTime/);
  assert.match(ln, /min reached/);
  assert.doesNotMatch(ln, /OneSignal/);
  const hv = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  assert.match(hv, /scheduleTimerDone\(/); assert.match(hv, /cancelLocal\(timerKey\(|cancelTaskNotifications\(/);
  const ad = fs.readFileSync(new URL('../ios/App/App/AppDelegate.swift', import.meta.url), 'utf8');
  assert.match(ad, /\.playback, mode: \.default, options: \[\.mixWithOthers\]/);
});
console.log(`${n} count-up timer tests passed`);
