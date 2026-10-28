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
// Fallback only (pure tests / no estimator injected). Same precedence as the app chip (utils/taskEstimate.chipValues): the typed estimateMin
// wins over the stored/server-locked minutes. The app injects chipValues itself (widgetSync.js) so the widget shows exactly the card chip.
const storedChip = (t) => ({ minutes: num(t.estimateMin) || num(t.minutes), points: num(t.points) });
const timeOf = (t) => (typeof t.startTime === 'string' && /^\d{1,2}:\d{2}$/.test(t.startTime) ? t.startTime.padStart(5, '0') : '');

// "30m", "1h", "1h 15m" — same format as the card chip "30m · 15p".
export const fmtEstimate = (m) => { m = num(m); if (!m) return ''; const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${m}m`; };
export const chipText = (est, pts) => [fmtEstimate(est), num(pts) ? `${num(pts)}p` : ''].filter(Boolean).join(' · ');

// tasks: today's stored tasks (weeklyRoutines/{uid}_{Day}.tasks). The widget belongs to the owner, so full titles are kept
// (also for anonymous/private tasks — those flags only hide a task from managers/pals).
// lock: optional 8-hour lock { dayName, startMs, endMs }; written as lockStartMs/lockEndMs (0 = none) only when it is today's,
// still running, so older widgets/snapshots without these fields keep working (Swift decodes them as optional).
// estimate: (task) -> { minutes, points } as displayed on the card (HomeView TaskCard = chipValues). Written as est/pts, so the widget never recomputes.
export const buildWidgetSnapshot = (tasks, { now = new Date(), dayName = '', pendingIds = [], lock = null, estimate = storedChip, ptsTarget = 0 } = {}) => {
  const pending = new Set(pendingIds); // widget taps not yet applied by the app: keep them shown as done
  const list = (Array.isArray(tasks) ? tasks : []).filter((t) => t && typeof t.title === 'string' && t.title.trim());
  const chip = (t) => { try { const c = estimate(t) || {}; return { est: num(c.minutes), pts: num(c.points) }; } catch (e) { const c = storedChip(t); return { est: c.minutes, pts: c.points }; } };
  const rows = list.map((t, i) => ({
    id: widgetTaskId(t), title: t.title.trim().slice(0, 80), ...chip(t),
    done: t.completed === true || pending.has(widgetTaskId(t)), time: timeOf(t), ...timerFields(t), _run: !!(t.timerActive && t.completed !== true), _i: i,
  }));
  // Running timers first (same as the app list, utils/taskView.pinRunning), then open; open tasks with a start time by time, then the rest in list order; done last in list order.
  rows.sort((a, b) => (b._run - a._run) || (a.done - b.done) || (!a.done && ((!a.time - !b.time) || (a.time && b.time && a.time.localeCompare(b.time)))) || (a._i - b._i));
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
    ptsTotal: sum(rows, 'pts'), ptsDone: sum(rows.filter((r) => r.done), 'pts'), ptsTarget: Math.max(0, Math.round(Number(ptsTarget) || 0)), // boss day target (locked or projected); widget shows ptsDone/ptsTarget
    ...lockFields(lock, dayName, now),
    tasks: rows.slice(0, WIDGET_MAX_TASKS).map(({ _i, _run, ...r }) => r),
  };
};

// Task timer for the widget countdown ring (ms since epoch, 0 = none; Swift decodes as optional). Only a timer that is set.
function timerFields(t) {
  const ms = (v) => { const n = v ? new Date(v).getTime() : 0; return Number.isFinite(n) && n > 0 ? n : 0; };
  const tE = ms(t.timerEndTime);
  let tS = ms(t.timerStartedAt);
  if (!tS && tE && Number(t.timerDurationMinutes) > 0) tS = tE - Number(t.timerDurationMinutes) * 60000;
  return tE && tS && tE > tS && t.completed !== true ? { tS, tE, tP: ms(t.timerPausedAt) } : {};
}

function lockFields(lock, dayName, now) {
  const ms = now.getTime();
  const ok = lock && Number(lock.startMs) > 0 && Number(lock.endMs) > ms && (!dayName || !lock.dayName || lock.dayName === dayName);
  return { lockStartMs: ok ? Number(lock.startMs) : 0, lockEndMs: ok ? Number(lock.endMs) : 0 };
}

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
  if (parts[0] === 'add' || parts[0] === 'new') return '/home?new=1'; // widget "+" / Quick add widget: open the add-task sheet
  if (parts[0] === 'ask') return '/home?ask=1'; // open the robot assistant
  if (parts[0] === 'task') {
    const id = parts[1] || '';
    return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? `/home?task=${id}` : '/home';
  }
  return null;
};
