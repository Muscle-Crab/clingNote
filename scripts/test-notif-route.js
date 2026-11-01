// Run: node scripts/test-notif-route.js  (every notification type -> in-app route; cold/warm start tap queue)
const assert = require('assert'); const { load } = require('./lib/srcRequire');
const R = load('utils/notifRoute.js'); const T = load('utils/notifTap.js');
let n = 0; const eq = (name, got, want) => { assert.equal(got, want, name); n++; };
const r = R.resolveNotificationRoute; const L = 'https://clingnot.netlify.app';
// Live server payloads as OneSignal native delivers them (launchURL + title), unchanged server:
eq('manager nudge/ping', r({ launchURL: `${L}/pals`, title: 'Nudge from Mom' }), '/pals?tab=manager');
eq('manager message', r({ launchURL: `${L}/pals`, title: 'Message from Mom' }), '/pals?tab=manager');
eq('manager connected', r({ launchURL: `${L}/pals`, title: 'Manager connected' }), '/pals?tab=manager');
eq('new pal accepted', r({ launchURL: `${L}/pals`, title: 'New pal' }), '/pals?tab=pals');
eq('unknown /pals title -> manager tab', r({ launchURL: `${L}/pals`, title: 'Something' }), '/pals?tab=manager');
eq('morning report (daily-report)', r({ launchURL: `${L}/home`, title: 'Good morning' }), '/home');
eq('send-notification reminder (no url)', r({ title: 'Task Reminder' }), '/home');
eq('PushSettings test (no url)', r({ title: 'ClingNote' }), '/home');
eq('web/FCM push-send url', r({ url: '/home' }), '/home');
eq('FCM data.url', r({ data: { url: '/upcoming' } }), '/upcoming');
// Local notifications (extra set by scheduleLocal):
eq('local manager item', r({ extra: { route: '/pals?tab=manager', type: 'manager' }, title: 'Nudge' }), '/pals?tab=manager');
eq('local manager item, old build w/o extra', r({ title: 'New message' }), '/pals?tab=manager');
eq('local reminder', r({ extra: { route: '/home', type: 'reminder' }, title: 'Task Reminder' }), '/home');
eq('local timer', r({ extra: { type: 'timer' }, title: 'Timer finished' }), '/home');
eq('local scheduled', r({ extra: { route: '/home', type: 'sched' } }), '/home');
eq('type only: ping', r({ additionalData: { type: 'ping' } }), '/pals?tab=manager');
eq('type only: eight_hour', r({ additionalData: { type: 'eight_hour' } }), '/home');
eq('type only: overdue/boss', r({ additionalData: { type: 'overdue' } }), '/home');
eq('explicit route wins', r({ additionalData: { route: '/manage/abc' }, title: 'Nudge from X' }), '/manage/abc');
eq('pal QR link', r({ launchURL: `${L}/pal/k7qm-4xrt` }), '/pals?code=K7QM4XRT&tab=pals');
eq('custom scheme', r({ launchURL: 'clingnot://localhost/pals' }), '/pals?tab=manager');
// Safety: foreign / malformed -> Home
eq('foreign host', r({ launchURL: 'https://evil.example/pals' }), '/home');
eq('protocol-relative', r({ url: '//evil.example/x' }), '/home');
eq('unknown path', r({ url: '/__admin' }), '/home');
eq('garbage', r({ launchURL: 12 }), '/home');
eq('empty', r(), '/home');
// Tap queue: cold start (tap before router/auth ready) then warm start.
(async () => {
  T._reset(); const pushed = []; let readyRes, authRes; const listeners = {};
  const router = { currentRoute: { value: { fullPath: '/home' } }, isReady: () => new Promise((res) => { readyRes = res; }), push: async (p) => { pushed.push(p); router.currentRoute.value.fullPath = p; } };
  const oneSignal = { Notifications: { addEventListener: (ev, cb) => { listeners['os:' + ev] = cb; } } };
  const localNotifications = { addListener: (ev, cb) => { listeners['ln:' + ev] = cb; } };
  T.installNotificationTaps({ router, authReady: new Promise((res) => { authRes = res; }), oneSignal, localNotifications });
  assert.ok(listeners['os:click'] && listeners['ln:localNotificationActionPerformed'], 'listeners registered');
  listeners['os:click']({ notification: { launchURL: `${L}/pals`, title: 'Nudge from Mom', additionalData: null } });
  await new Promise((s) => setTimeout(s, 5)); eq('cold start: nothing before ready', pushed.length, 0);
  readyRes(); await new Promise((s) => setTimeout(s, 5)); eq('still waiting for auth', pushed.length, 0);
  authRes(); await new Promise((s) => setTimeout(s, 5)); eq('cold start -> manager after ready', pushed[0], '/pals?tab=manager');
  listeners['ln:localNotificationActionPerformed']({ notification: { title: 'Timer finished', extra: { route: '/home', type: 'timer' } } });
  await new Promise((s) => setTimeout(s, 5)); eq('warm start local timer -> home', pushed[1], '/home');
  listeners['ln:localNotificationActionPerformed']({ notification: { title: 'Task Reminder', extra: { route: '/home' } } });
  await new Promise((s) => setTimeout(s, 5)); eq('already there: no duplicate push', pushed.length, 2);
  console.log(`notification routes: ${n} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
