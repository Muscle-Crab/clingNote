// Home-screen widget (iOS WidgetKit) data + deep links. Pure (no imports) so it is unit-tested in node (scripts/test-widget.js).
// The web layer writes buildWidgetSnapshot(todayTasks) as JSON to the App Group (UserDefaults suite group.app.clingnote.ios, key
// "widget.today") through the local ClingWidget Capacitor plugin; the Swift widget (ios/App/ClingNoteWidget) only reads it.
// Tapping a task opens clingnote://task/<id>, which parseWidgetLink() turns into /home?task=<id> (HomeView card is highlighted).
export const WIDGET_SCHEMA = 1;
export const WIDGET_MAX_TASKS = 12; // large widget shows ~8; a few spare so done-filtering on device still fills it
export const WIDGET_SCHEME = 'clingnote';

// Same identity HomeView uses for cards (data-reorder-key = taskKey(task) in utils/taskPlanning.js).
export const taskRefKey = (t) => `${t?.createdAt || ''}|${t?.title || ''}`;

// Short stable id: an explicit task.id if the task has one, else FNV-1a of the card key (URL-safe, 8 base36 chars max).
export const widgetTaskId = (t) => {
  if (t && typeof t.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(t.id)) return t.id;
  const s = taskRefKey(t);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'k' + h.toString(36);
};

const num = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
const minutesOf = (t) => num(t.minutes) || num(t.estimateMin);
const timeOf = (t) => (typeof t.startTime === 'string' && /^\d{1,2}:\d{2}$/.test(t.startTime) ? t.startTime.padStart(5, '0') : '');

// "30m", "1h", "1h 15m" — same format as the card chip "30m · 15p".
export const fmtEstimate = (m) => { m = num(m); if (!m) return ''; const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${m}m`; };
export const chipText = (est, pts) => [fmtEstimate(est), num(pts) ? `${num(pts)}p` : ''].filter(Boolean).join(' · ');

// tasks: today's stored tasks (weeklyRoutines/{uid}_{Day}.tasks). The widget belongs to the owner, so full titles are kept
// (also for anonymous/private tasks — those flags only hide a task from managers/pals).
export const buildWidgetSnapshot = (tasks, { now = new Date(), dayName = '' } = {}) => {
  const list = (Array.isArray(tasks) ? tasks : []).filter((t) => t && typeof t.title === 'string' && t.title.trim());
  const rows = list.map((t, i) => ({
    id: widgetTaskId(t), title: t.title.trim().slice(0, 80), est: minutesOf(t), pts: num(t.points),
    done: t.completed === true, time: timeOf(t), _i: i,
  }));
  // Open first; open tasks with a start time by time, then the rest in list order; done last in list order.
  rows.sort((a, b) => (a.done - b.done) || (!a.done && ((!a.time - !b.time) || (a.time && b.time && a.time.localeCompare(b.time)))) || (a._i - b._i));
  const done = rows.filter((r) => r.done).length;
  const sum = (arr, k) => arr.reduce((s, r) => s + r[k], 0);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    v: WIDGET_SCHEMA,
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    day: dayName,
    updatedAt: now.getTime(),
    total: rows.length, done,
    estTotal: sum(rows, 'est'), estLeft: sum(rows.filter((r) => !r.done), 'est'),
    ptsTotal: sum(rows, 'pts'), ptsDone: sum(rows.filter((r) => r.done), 'pts'),
    tasks: rows.slice(0, WIDGET_MAX_TASKS).map(({ _i, ...r }) => r),
  };
};

// Map widget id -> HomeView card key, so a deep link can find the card in the DOM.
export const widgetKeyMap = (tasks) => {
  const m = {};
  (Array.isArray(tasks) ? tasks : []).forEach((t) => { if (t && t.title) m[widgetTaskId(t)] = taskRefKey(t); });
  return m;
};

export const widgetTaskUrl = (id) => `${WIDGET_SCHEME}://task/${String(id).replace(/[^A-Za-z0-9_-]/g, '')}`;

// clingnote://task/<id> -> '/home?task=<id>'; clingnote://home or clingnote:// -> '/home'; anything else -> null.
export const parseWidgetLink = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  let u;
  try { u = new URL(raw.trim()); } catch (e) { return null; }
  if (u.protocol.toLowerCase() !== WIDGET_SCHEME + ':') return null;
  const parts = [u.hostname, ...u.pathname.split('/')].filter(Boolean); // no decoding: ids are [A-Za-z0-9_-], anything encoded is rejected
  if (!parts.length || parts[0] === 'home' || parts[0] === 'today') return '/home';
  if (parts[0] === 'task') {
    const id = parts[1] || '';
    return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? `/home?task=${id}` : '/home';
  }
  return null;
};
