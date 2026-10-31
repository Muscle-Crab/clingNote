// B44 task extras (pure): category colour (work / home / health), several reminders per task (minutes before the start),
// a place with a map link and a "time to leave" reminder. Stored on the task / scheduled entry as
//   category: 'work'|'home'|'health', remindOffsets: [minutes...], location: 'free text', travelMin: n.
// Used by AddTaskModal / HomeView (create), TaskDetailModal (map link), schedNotify.js (the extra pings) and taskCategory.js (colour).
export const CATEGORIES = [
  { id: 'work', label: 'Work', icon: 'fa-briefcase', tone: 'purple' },
  { id: 'home', label: 'Home', icon: 'fa-home', tone: 'teal' },
  { id: 'health', label: 'Health', icon: 'fa-heartbeat', tone: 'green' },
];
export const categoryById = (id) => CATEGORIES.find((c) => c.id === String(id || '').toLowerCase()) || null;
export const normCategory = (id) => (categoryById(id) ? String(id).toLowerCase() : '');

export const REMINDER_PRESETS = [5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
export const MAX_REMINDERS = 3;
export const cleanOffsets = (arr) => [...new Set((Array.isArray(arr) ? arr : []).map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n > 0 && n <= 10080))]
  .sort((a, b) => b - a).slice(0, MAX_REMINDERS);
export const offsetLabel = (m) => {
  const n = Math.round(Number(m)) || 0;
  if (n % 10080 === 0) return n === 10080 ? '1 week' : `${n / 10080} weeks`;
  if (n % 1440 === 0) return n === 1440 ? '1 day' : `${n / 1440} days`;
  if (n % 60 === 0) return n === 60 ? '1 hr' : `${n / 60} hr`;
  return `${n} min`;
};
export const offsetsText = (arr) => cleanOffsets(arr).map((m) => `${offsetLabel(m)} before`).join(', ');

export const TRAVEL_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90];
export const cleanLocation = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120);
export const cleanTravel = (n, hasPlace = true) => { if (!hasPlace) return 0; const v = Math.round(Number(n)); return Number.isFinite(v) && v >= 1 ? Math.min(240, v) : 15; };
export const mapLink = (place) => { const p = cleanLocation(place); return p ? `https://maps.apple.com/?q=${encodeURIComponent(p)}` : ''; };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
// "HH:MM" start minus travel -> "HH:MM" (same day, clamped at 00:00); '' without a valid start
export const leaveAt = (start, travelMin) => { const m = /^(\d{2}):(\d{2})$/.exec(String(start || '')); if (!m) return ''; return hhmm(Math.max(0, +m[1] * 60 + +m[2] - (Math.round(Number(travelMin)) || 0))); };

// Fields to store, from the add-task form (empty ones are left out so old documents stay unchanged).
export const extrasFromForm = (f = {}) => {
  const out = {}; const c = normCategory(f.category); if (c) out.category = c;
  const o = cleanOffsets(f.remindOffsets); if (o.length) out.remindOffsets = o;
  const loc = cleanLocation(f.location); if (loc) { out.location = loc; out.travelMin = cleanTravel(f.travelMin); }
  return out;
};

// Extra notifications for one timed occurrence. baseKey: the plan key of the main reminder; whenMs: the task start.
// -> [{ key, at, title, body, kind }] ("N before" pings, then "Time to leave" at start - travel), only those still in the future.
export const extraPings = ({ baseKey, whenMs, task = {}, nowMs = Date.now() }) => {
  const out = []; const title = String(task.title || 'Task').slice(0, 120);
  for (const m of cleanOffsets(task.remindOffsets)) {
    const at = whenMs - m * 60000; if (at > nowMs) out.push({ key: `${baseKey}|-${m}`, at, title, body: `In ${offsetLabel(m)}`, kind: 'pre' });
  }
  const loc = cleanLocation(task.location);
  if (loc) { const t = cleanTravel(task.travelMin); const at = whenMs - t * 60000; if (at > nowMs) out.push({ key: `${baseKey}|leave`, at, title: `Time to leave: ${title}`, body: `${t} min to ${loc}`, kind: 'leave' }); }
  return out;
};
