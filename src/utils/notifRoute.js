// Notification tap -> in-app route. Pure (no imports) so it is unit-tested in node (scripts/test-notif-route.js).
// Works for every payload shape the app receives, INCLUDING payloads already sent by the live server (no deploy needed):
//   OneSignal native (iOS):  { launchURL, additionalData, title, body }      (manager-pal / daily-report / send-notification)
//   OneSignal web / FCM SW:  { url } or data.url                               (push-send, firebase-messaging-sw.js)
//   Capacitor local:         { extra: { route, type }, title }                 (reminders, timers, scheduled tasks, manager items)
export const MANAGER_ROUTE = '/pals?tab=manager';
export const PALS_ROUTE = '/pals?tab=pals';
export const HOME_ROUTE = '/home';

const OUR_HOSTS = /^(clingnot|clingnote)\.netlify\.app$|^(www\.)?clingnote\.com$|^localhost$/i;
// In-app paths a notification may open (anything else falls back to Home).
const ALLOWED = /^\/(home|pals|manage|upcoming|discipline|profile|onboarding|paywall)(\/|\?|$)/;

const TYPE_ROUTES = {
  manager: MANAGER_ROUTE, nudge: MANAGER_ROUTE, ping: MANAGER_ROUTE, dm: MANAGER_ROUTE, manager_message: MANAGER_ROUTE, manager_connected: MANAGER_ROUTE,
  pal: PALS_ROUTE, pal_accepted: PALS_ROUTE,
  reminder: HOME_ROUTE, timer: HOME_ROUTE, sched: HOME_ROUTE, scheduled: HOME_ROUTE, morning_report: HOME_ROUTE, report: HOME_ROUTE,
  eight_hour: HOME_ROUTE, deadline: HOME_ROUTE, boss: HOME_ROUTE, overdue: HOME_ROUTE, test: HOME_ROUTE,
};
// Titles the live server already sends (netlify/functions/manager-pal.js) -> more precise screen than its generic /pals url.
const TITLE_ROUTES = [
  [/^(nudge|ping|message) from /i, MANAGER_ROUTE], [/^(nudge|new message)$/i, MANAGER_ROUTE], [/^manager connected$/i, MANAGER_ROUTE],
  [/^new pal$/i, PALS_ROUTE],
];

// '/x', 'https://clingnot.netlify.app/x', 'clingnot://localhost/x' -> '/x' (only our own hosts); null otherwise.
export const toAppPath = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  let path = null;
  if (s.startsWith('/') && !s.startsWith('//')) path = s;
  else {
    try {
      const u = new URL(s);
      if (/^https?:$/.test(u.protocol)) { if (OUR_HOSTS.test(u.hostname)) path = u.pathname + u.search; }
      else if (/^(clingnot|clingnote|capacitor):$/i.test(u.protocol)) path = (u.hostname && u.hostname !== 'localhost' ? '/' + u.hostname : '') + u.pathname + u.search;
    } catch (e) { return null; }
  }
  if (!path) return null;
  if (path.startsWith('/pal/')) { const code = path.slice(5).split(/[/?]/)[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase(); return code ? `/pals?code=${code}&tab=pals` : PALS_ROUTE; }
  return ALLOWED.test(path) ? path : null;
};

export const resolveNotificationRoute = (n = {}) => {
  const data = { ...(n.additionalData || {}), ...(n.data || {}), ...(n.extra || {}) };
  const type = String(data.type || data.kind || '').toLowerCase();
  const explicit = toAppPath(data.route) || toAppPath(data.path);
  if (explicit) return explicit;
  if (TYPE_ROUTES[type]) return TYPE_ROUTES[type];
  const title = String(n.title || data.title || '').trim();
  for (const [re, r] of TITLE_ROUTES) if (re.test(title)) return r;
  const url = toAppPath(n.launchURL) || toAppPath(n.url) || toAppPath(data.url);
  if (url === '/pals') return MANAGER_ROUTE; // generic /pals from the server = manager pings/messages (its default tab)
  return url || HOME_ROUTE;
};
