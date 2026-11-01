// Web fallback for on-device notifications (timer done, reminders, timed tasks): Web Notifications API + in-tab timers.
const assert = require('assert');
const { load } = require('./lib/srcRequire');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const shown = []; let perm = 'default'; let asked = 0;
global.window = { focus() {}, location: { pathname: '/home', assign() {} } };
global.Notification = function (title, o) { shown.push({ title, ...o }); this.close = () => {}; };
global.Notification.requestPermission = async () => { asked++; perm = 'granted'; return perm; };
Object.defineProperty(global.Notification, 'permission', { get: () => perm });
window.Notification = global.Notification;
const N = load('utils/localNotify.js');
(async () => {
  // background type with no permission yet: no prompt, not scheduled
  ok((await N.scheduleLocal('sched:x', { title: 'a', body: 'b', at: new Date(Date.now() + 50), type: 'sched' })) === false && asked === 0, 'no unprompted permission ask');
  // timer is user-initiated: asks, schedules, fires
  ok(await N.scheduleTimerDone({ id: 'ZZTEST1', title: 'ZZTEST focus', timerEndTime: new Date(Date.now() + 60).toISOString() }), 'timer scheduled on web');
  ok(asked === 1 && N._webTimerCount() === 1, 'permission asked once');
  await new Promise((r) => setTimeout(r, 120));
  ok(shown.length === 1 && shown[0].title === 'Timer finished' && /ZZTEST focus/.test(shown[0].body), 'web notification fired');
  // cancel
  await N.scheduleLocal('rem:ZZTEST2', { title: 'r', body: 'x', at: new Date(Date.now() + 80), type: 'reminder' });
  await N.cancelLocal('rem:ZZTEST2'); await new Promise((r) => setTimeout(r, 120));
  ok(shown.length === 1 && N._webTimerCount() === 0, 'cancel clears the web timer');
  // past time / invalid: not scheduled
  ok((await N.scheduleLocal('timer:p', { title: 't', body: 'b', at: new Date(Date.now() - 1000), type: 'timer' })) === false, 'past time ignored');
  // repeating reminder: next occurrence
  const nx = N.nextOccurrence({ hour: 9, minute: 30, weekday: 2 }, new Date(2026, 9, 26, 10, 0)); // Mon 10:00 -> Mon 9:30 weekday 2 = Monday
  ok(nx.getDate() === 2 && nx.getMonth() === 10 && nx.getHours() === 9, 'weekly next occurrence (Mon Nov 2)');
  await N.scheduleReminder({ id: 'ZZTEST3', title: 'x' }, { date: '2026-10-27', time: '09:00', repeat: 'daily' }, 'ZZTEST daily');
  ok(N._webTimerCount() === 1, 'repeating reminder scheduled'); await N.cancelLocal('rem:ZZTEST3');
  // no Notification API (e.g. old Safari): safe false
  delete window.Notification;
  ok((await N.scheduleLocal('timer:q', { title: 't', body: 'b', at: new Date(Date.now() + 1000), type: 'timer' })) === false, 'no API -> false, no throw');
  console.log(`web-notify: ${pass} passed`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
