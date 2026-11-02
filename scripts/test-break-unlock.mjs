// Earned breaks: lift every shield for exactly the break, native re-lock at the end (DeviceActivity monitor, app closed),
// "Break's over" scheduled at start and cancelled on early end, background Take break action, points alert once per tier.
import assert from 'assert';
import fs from 'fs';
import { holdLockAction, applyTaken, alertTier, recapAt } from '../src/utils/breakUnlock.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok ', name); };
const rd = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const T0 = Date.UTC(2026, 10, 2, 15, 0);

t('JS holds the lock state while a native break is live (no stopLock that would erase the re-lock)', () => {
  assert.strictEqual(holdLockAction({ native: 'break', endMs: T0 + 60000 }, T0), true);
  assert.strictEqual(holdLockAction({ native: 'break', endMs: T0 - 1 }, T0), false);
  assert.strictEqual(holdLockAction({ native: true, endMs: T0 + 60000 }, T0), false); // old path
  assert.strictEqual(holdLockAction({ native: 'break', endMs: T0 + 60000, relocked: true }, T0), false);
  assert.strictEqual(holdLockAction(null, T0), false);
});
t('breaks taken from the notification while closed are booked once (used + history)', () => {
  const r = applyTaken({ day: ymd(T0), used: 10 }, [{ at: T0, min: 20, until: T0 + 20 * 60000, points: 100 }, { at: 0, min: 5 }], ymd(T0), ymd);
  assert.strictEqual(r.b.used, 30); assert.strictEqual(r.b.native, 'break'); assert.strictEqual(r.b.endMs, T0 + 20 * 60000);
  assert.deepStrictEqual(r.log, [{ at: T0, min: 20, points: 100 }]);
  assert.strictEqual(applyTaken({ used: 0 }, [], 'x', ymd).b.used, 0);
});
t('points alert fires once per tier per day', () => {
  assert.strictEqual(alertTier(null, 'd', 1), 1); assert.strictEqual(alertTier({ day: 'd', n: 1 }, 'd', 1), 0);
  assert.strictEqual(alertTier({ day: 'd', n: 1 }, 'd', 2), 2); assert.strictEqual(alertTier({ day: 'old', n: 3 }, 'd', 1), 1); assert.strictEqual(alertTier(null, 'd', 0), 0);
});
t('day-end recap fires at the earlier of the hard close and the last chosen session end', () => {
  assert.strictEqual(recapAt({ closeMs: 100, lastSessionEndMs: 80 }), 80); assert.strictEqual(recapAt({ closeMs: 100, lastSessionEndMs: 0 }), 100); assert.strictEqual(recapAt({ closeMs: 100, lastSessionEndMs: 120 }), 120); // evening session past the close: recap waits for it
});
t('native: break lifts BOTH stores, never changes lock state, monitor re-locks at intervalDidEnd', () => {
  const sh = rd('ios/App/Shared/LockShared.swift'); const mon = rd('ios/App/ClingLockMonitor/ClingLockMonitor.swift');
  assert(/static func apply\(now[^]*?if BreakState\.isLive\(now: now\) \{ store\.shield\.applications = nil; return \}/.test(sh), 'AppLocks.apply clears .clingApps during a break');
  assert(/enum LockIn \{[^]*?if BreakState\.isLive\(\) \{ store\.shield\.applications = nil; store\.shield\.applicationCategories = nil; store\.shield\.webDomains = nil; return \}/.test(sh), 'LockIn.shield clears .clingLock during a break');
  const begin = sh.slice(sh.indexOf('static func begin(')); assert(/startMonitoring\(\.clingBreak/.test(begin) && /clear\(\); return "monitor failed/.test(begin), 'no schedule = refuse (nothing would re-lock)');
  assert(!/stateKey/.test(sh.slice(sh.indexOf('enum BreakState'))), 'break never touches the lock state');
  assert(/scheduleEndNote\(untilMs: untilMs\)/.test(begin) && /Break's over/.test(sh), "Break's over scheduled at start");
  assert(/removePendingNotificationRequests\(withIdentifiers: \[endNoteId\]\)/.test(sh), 'cancelled on early end');
  assert(/activity == \.clingBreak[^]*?isRealEnd\(untilMs: BreakState\.until\(\)[^]*?BreakState\.end\(early: false\)/.test(mon), 'monitor re-locks at the real end only');
  assert(/static func end\(early: Bool\) \{\s*clear\(\); DeviceActivityCenter\(\)\.stopMonitoring\(\[\.clingBreak\]\)[^]*?TaskAllow\.reapply\(\)/.test(sh), 'end: clear, stop, re-shield both stores');
  assert(/if BreakState\.isLive\(\) \{ return \}/.test(mon), 'a block starting mid-break waits for the break end');
});
t('re-lock simulation: shields off for exactly the break, back on at the end (same apps)', () => {
  // Model of the Swift rules: shield(now) = live break ? none : the saved selection (lock-in) + locked per-app tokens.
  const until = T0 + 10 * 60000; const isLive = (now) => until > now; const isRealEnd = (u, now) => u > 0 && u <= now + 60000;
  const shield = (now, brk) => (brk && isLive(now) ? [] : ['instagram', 'tiktok', 'pubg']);
  assert.deepStrictEqual(shield(T0 + 1000, true), []);
  assert.deepStrictEqual(shield(until - 1000, true), []);
  assert(isRealEnd(until, until)); assert(!isRealEnd(until, T0)); // a restart artifact at start does not end the break
  assert.deepStrictEqual(shield(until, true), ['instagram', 'tiktok', 'pubg']);
  const startMs = Math.min(T0 - 60000, until - 15 * 60000); assert(until - startMs >= 15 * 60000 && startMs < T0); // iOS 15-min minimum, backdated
});
t('notification action: background Take break handled natively, forwards everything else to Capacitor', () => {
  const pl = rd('ios/App/App/ClingLockPlugin.swift'); const ad = rd('ios/App/App/AppDelegate.swift');
  assert(/UNNotificationAction\(identifier: BreakState\.takeAction, title: "Take break", options: \[\]\)/.test(pl), 'background (no .foreground)');
  assert(/f\.userNotificationCenter\?\(center, didReceive: response/.test(pl) && /willPresent: notification/.test(pl), 'forwards to the previous delegate');
  assert(/ClingBreakNotify\.install\(\)/.test(ad), 'installed at launch (background launch has no webview)');
  assert(/BreakState\.begin\(untilMs: now \+ Double\(m\) \* 60000/.test(pl) && /removeObject\(forKey: BreakState\.offerKey\)/.test(pl), 'one offer = one break');
  assert(/min\(m, 30, left\)/.test(pl), 'capped at 30 min and the close');
  for (const m of ['startBreak', 'endBreak', 'breakState', 'offerBreak']) { assert(pl.includes(`CAPPluginMethod(name: "${m}"`)); assert(rd('src/native/clingNative.js').includes(`${m}: safe('ClingLock'`)); }
});
t('Home wiring: Take break -> startBreak (no stopLock), end early -> endBreak, sync holds during a break, alert once per tier', () => {
  const h = rd('src/views/HomeView.vue');
  const tb = h.slice(h.indexOf('const gpTakeBreak'), h.indexOf('const gpHistory'));
  assert(/clingLock\.startBreak\(b\.endMs, b\.last\.min\)[^]*?if \(r && r\.started\) \{ gpBreakSave\(\{ \.\.\.b, native: 'break' \}\); return; \}/.test(tb));
  assert(/holdLockAction\(gpBreak\.value, Date\.now\(\)\)\) \{ hardLocked\.value = false; return; \}/.test(h));
  assert(/clingLock\.endBreak\(\)/.test(h)); assert(/clingLock\.offerBreak\(/.test(h)); assert(/alertTier\(stored, k, GP\.breakToAlert/.test(h));
  assert(!/gp:pace:\$\{k\}`, \{/.test(h), 'midday pacing note no longer scheduled');
  assert(/scheduleLocal\(`gp:close:\$\{k\}`, \{ title: 'Day done', body: `\$\{GP\.recapText/.test(h), 'existing close note extended with the recap');
});
console.log(`\nbreak unlock: ${n} ok`);
