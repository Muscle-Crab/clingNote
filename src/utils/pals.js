// Client-side helpers for Manager & Pal (mirrors netlify/functions/lib/managerPal.js where both need the same rule).
export const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const NUDGE_PRESETS = [
  { id: 'ping', label: '👋 Ping', short: 'Ping' },
  { id: 'remind', label: '⏰ Remind', short: 'Remind' },
  { id: 'cheer', label: '💪 Cheer', short: 'Cheer' },
];
export const QUICK_DMS = ['How is it going?', 'Proud of you!', 'Call me when you can', "Don't forget to rest"];
export const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
export const otherMember = (pal, uid) => (pal.members || []).find((m) => m !== uid) || '';
export const tsMs = (v) => (v == null ? null : typeof v === 'number' ? v : v.toMillis ? v.toMillis() : v.seconds != null ? v.seconds * 1000 : Date.parse(v) || null);
export const isOverdue = (task, dayName, now = new Date()) => {
  if (!task || task.completed) return false;
  const r = task.reminder;
  if (r && r.date && r.time) { const [y, mo, d] = String(r.date).split('-').map(Number); const [h, mi] = String(r.time).split(':').map(Number); const dt = new Date(y, mo - 1, d, h, mi); if (!isNaN(dt) && dt < now) return true; }
  const today = WEEK.indexOf(DAYS[now.getDay()]); const di = WEEK.indexOf(dayName);
  return di >= 0 && di < today;
};
// Same projection/sort as the server: overdue first, then open, then done.
export const viewTasks = (dayDocs, now = new Date()) => {
  const out = [];
  for (const { day, tasks } of dayDocs) for (const t of tasks || []) if (t && t.title) out.push({ key: t.id || `${t.createdAt?.seconds ?? t.createdAt ?? ''}|${t.title}`, day, title: t.title, completed: !!t.completed, important: !!t.important, reminder: t.reminder || null, overdue: isOverdue(t, day, now) });
  const order = (x) => (x.overdue ? 0 : x.completed ? 2 : 1);
  return out.sort((a, b) => order(a) - order(b) || WEEK.indexOf(a.day) - WEEK.indexOf(b.day));
};
export const groupTasks = (tasks) => ({ overdue: tasks.filter((t) => t.overdue), open: tasks.filter((t) => !t.overdue && !t.completed), done: tasks.filter((t) => t.completed) });
export const timeAgo = (ms, now = Date.now()) => { if (!ms) return ''; const s = Math.max(0, Math.round((now - ms) / 1000)); if (s < 60) return 'now'; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`; };
export const managerLinkUrl = (origin, token) => `${origin}/m/${token}`;
