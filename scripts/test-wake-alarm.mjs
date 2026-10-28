// Run: node scripts/test-wake-alarm.mjs  (wake-up alarm: daily choice prompt -> one-time alarm; Settings toggle; onboarding step; native wiring)
import assert from 'assert'; import fs from 'fs';
import * as W from '../src/utils/wakeAlarm.js';
const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const D = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0);
const on = (x = {}) => W.normalizeWake({ wakeAlarmEnabled: true, ...x });

t('defaults: OFF, 07:00, evening prompt 21:00, every day', () => {
  const s = W.normalizeWake(undefined);
  assert.equal(s.enabled, false); assert.equal(s.time, '07:00'); assert.equal(s.promptTime, '21:00'); assert.deepEqual(s.days, [0, 1, 2, 3, 4, 5, 6]); assert.equal(s.choice, null);
  assert.equal(W.WAKE_PROMPT_MODE, 'evening'); assert.equal(W.PROMPT_TIME_DEFAULTS.morning < W.DEFAULT_ALARM_TIME, true);
  assert.equal(W.normalizeWake({ wakeAlarmEnabled: 'yes', wakeAlarmTime: '25:00', wakeAlarmDays: [9, 1, 1] }).enabled, false);
  assert.deepEqual(W.normalizeWake({ wakeAlarmDays: [9, 1, 1, '3'] }).days, [1, 3]);
});
t('default alarm time = day start minus 30 min, else 7:00 AM', () => {
  assert.equal(W.defaultAlarmTime('06:30'), '06:00'); assert.equal(W.defaultAlarmTime('00:15'), '23:45'); assert.equal(W.defaultAlarmTime(''), '07:00'); assert.equal(W.defaultAlarmTime(undefined), '07:00');
});
t('off = no question, no prompt notifications', () => {
  assert.equal(W.currentQuestion(W.normalizeWake({}), D(2026, 10, 27, 22)), null); assert.deepEqual(W.promptSchedule(W.normalizeWake({})), []);
});
t('evening prompt asks about TOMORROW, open from 21:00 until the alarm', () => {
  const s = on();
  assert.equal(W.currentQuestion(s, D(2026, 10, 27, 20, 59)), null);
  assert.equal(W.currentQuestion(s, D(2026, 10, 27, 21)).date, '2026-10-28');
  assert.equal(W.currentQuestion(s, D(2026, 10, 28, 1)).date, '2026-10-28'); // still awake after midnight
  assert.equal(W.currentQuestion(s, D(2026, 10, 28, 7, 1)), null); // after the alarm time, before the next prompt
});
t('flip to a morning prompt: asks about TODAY', () => {
  const s = on({ wakeAlarmPromptTime: '06:00', wakeAlarmTime: '07:30' });
  assert.equal(W.currentQuestion(s, D(2026, 10, 27, 5, 59)), null); assert.equal(W.currentQuestion(s, D(2026, 10, 27, 6, 10)).date, '2026-10-27');
  assert.deepEqual(W.promptSchedule(s).find((p) => p.alarmDay === 2), { alarmDay: 2, weekday: 3, hour: 6, minute: 0 }); // Tue alarm -> asked Tue
});
t('evening prompt weekday = the day before the alarm day; disabled days are not asked', () => {
  const s = on({ wakeAlarmDays: [1] }); // Monday alarms only
  assert.deepEqual(W.promptSchedule(s), [{ alarmDay: 1, weekday: 1, hour: 21, minute: 0 }]); // asked Sunday (Capacitor weekday 1)
  assert.equal(W.currentQuestion(s, D(2026, 10, 25, 21, 30)).date, '2026-10-26'); // Sun evening -> Mon
  assert.equal(W.currentQuestion(s, D(2026, 10, 27, 21, 30)), null); // Tue evening -> Wed: not enabled
});
t('card shows until answered; "no" or "yes" for that date hides the question', () => {
  const now = D(2026, 10, 27, 21, 5);
  assert.equal(W.shouldShowPrompt(on(), now), true);
  assert.equal(W.shouldShowPrompt(on({ wakeAlarmChoice: { date: '2026-10-28', choice: 'no' } }), now), false);
  assert.equal(W.shouldShowPrompt(on({ wakeAlarmChoice: { date: '2026-10-27', choice: 'yes', time: '07:00' } }), now), true); // yesterday's answer
});
t('one-time alarm date for the chosen time; fallback burst one per minute', () => {
  assert.equal(+W.alarmDateFor('06:45', D(2026, 10, 27, 21)), +D(2026, 10, 28, 6, 45));
  assert.equal(+W.alarmDateFor('23:30', D(2026, 10, 27, 21)), +D(2026, 10, 27, 23, 30));
  const b = W.fallbackTimes(D(2026, 10, 28, 7)); assert.equal(b.length, W.FALLBACK_REPEATS); assert.equal(b[1] - b[0], 60000);
  assert.equal(W.fmt12('07:05'), '7:05 AM'); assert.equal(W.fmt12('00:00'), '12:00 AM'); assert.equal(W.fmt12('13:30'), '1:30 PM');
});
t('notification buttons: Set alarm (opens app) / Not today; ring: Snooze / Stop', () => {
  const p = W.WAKE_ACTION_TYPES.find((x) => x.id === W.WAKE_PROMPT_ACTION_TYPE).actions;
  assert.deepEqual(p.map((x) => x.title), ['Set alarm', 'Not today']); assert.equal(p[0].foreground, true);
  assert.deepEqual(W.WAKE_ACTION_TYPES.find((x) => x.id === W.WAKE_RING_ACTION_TYPE).actions.map((x) => x.id), ['wake_snooze', 'wake_stop']);
});

const comp = rd('src/composables/useWakeAlarm.js');
t('composable: no recurring alarm, only a yes schedules one; off cancels everything', () => {
  assert.match(comp, /if \(!s\.enabled \|\| !s\.uid\) \{ await cancelAllWake\(\); return; \}/);
  assert.match(comp, /export async function acceptWake[\s\S]{0,600}clingAlarm\.scheduleOnce\(/);
  assert.equal((comp.match(/scheduleOnce\(/g) || []).length, 1);
  assert.match(comp, /interruptionLevel: 'timeSensitive'/); assert.match(comp, /sound: ALARM_SOUND/); assert.equal(W.ALARM_SOUND, 'cn_morning.caf');
  assert.match(comp, /lnCancel\(promptIds\(\)\); await cancelDeviceAlarm\(\); await clingAlarm\.cancelAll\(\)/);
});
t('notification actions go through the single notifTap listener (cold start safe)', () => {
  assert.match(rd('src/utils/notifTap.js'), /if \(onAction\) \{ try \{ onAction\(a\)/);
  assert.match(rd('src/main.js'), /onAction: \(a\) => wakeMod\.then\(\(w\) => w\.onWakeNotificationAction\(a\)\)/);
});
t('Settings: Wake-up alarm toggle in Profile > Preferences, iOS-only on web', () => {
  const p = rd('src/views/Profile.vue');
  assert.match(p, /data-test="wake-alarm-toggle"[^>]*:checked="wakeOk && wake\.enabled"[^>]*:disabled="!wakeOk/); assert.match(p, /iOS app only/);
  assert.match(p, /data-test="wake-alarm-time"/); assert.match(p, /data-test="wake-prompt-time"/);
});
t('Home: in-app wake-up alarm question as ONE compact row (no card) with an editable prefilled time', () => {
  const c = rd('src/components/home/WakeAlarmPrompt.vue');
  assert.match(c, /<b>Alarm<\/b> \{\{ shortDay \}\}\?/); assert.match(c, /Wake-up alarm/); assert.match(c, /type="time"/); assert.match(c, />Set</); assert.match(c, /aria-label="Not today"/);
  assert.doesNotMatch(c, /border-radius: 16px|wa-card/, 'no new card/box on Home');
  assert.match(rd('src/views/HomeView.vue'), /<WakeAlarmPrompt v-if="isViewingToday" \/>/);
});
t('onboarding: optional iOS step after schedule, before the paywall, exact copy, saves enabled + time', () => {
  const o = rd('src/views/OnboardingView.vue');
  assert.match(o, /'schedule', \.\.\.\(isNativeIOS\(\) \? \['alarm'\] : \[\]\), 'strictness'/);
  assert.match(o, /Want a <span>wake-up alarm\?<\/span>/);
  assert.match(o, /ClingNote can ask you each day if you want an alarm, and ring at your time even on silent\./);
  assert.match(o, /alarm: 'Yes, turn it on'/); assert.match(o, /data-test="ob-alarm-later"[^>]*>Not now</);
  assert.match(o, /saveUserFields\(u\.uid, \{ wakeAlarmEnabled: true, wakeAlarmTime: alarmTime\.value \}\)/); assert.match(o, /requestWakePermissions\(\)/);
  assert.match(o, /defaultAlarmTime\(\(cp && cp\.wakeTime\) \|\| eh\.plan\.value\?\.wakeTime\)/);
  assert.ok(!/Step [0-9]</.test(o), 'step numbers are computed (stepNo)');
});
t('native: AlarmKit plugin gated for older SDKs/iOS, registered, in the Xcode project; usage string + time-sensitive entitlement', () => {
  const sw = rd('ios/App/App/ClingAlarmPlugin.swift');
  assert.match(sw, /#if canImport\(AlarmKit\)/); assert.match(sw, /#available\(iOS 26\.0, \*\)/); assert.match(sw, /schedule: \.fixed\(date\)/); assert.match(sw, /secondaryButtonBehavior: \.countdown/);
  assert.match(rd('ios/App/App/ClingWidgetPlugin.swift'), /registerPluginInstance\(ClingAlarmPlugin\(\)\)/);
  const pbx = rd('ios/App/App.xcodeproj/project.pbxproj');
  for (const f of ['ClingAlarmPlugin.swift in Sources', 'WakeAlarmMetadata.swift in Sources', 'WakeAlarmLiveActivity.swift in Sources']) assert.ok(pbx.split(f).length >= 3, f);
  assert.match(rd('ios/App/App/Info.plist'), /<key>NSAlarmKitUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/);
  assert.match(rd('ios/App/App/App.entitlements'), /com\.apple\.developer\.usernotifications\.time-sensitive<\/key>\s*<true\/>/);
  assert.match(rd('ios/App/ClingNoteWidget/MatchupWidget.swift'), /if #available\(iOS 26\.0, \*\) \{ WakeAlarmLiveActivity\(\) \}/);
});
console.log(`\n${n} wake-alarm tests passed`);
