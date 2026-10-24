// Pure helpers for the Manager & Pal feature (shared by netlify/functions/manager-pal.js and its tests).
const crypto = require('crypto');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const NUDGE_PRESETS = { ping: 'is checking in on', remind: 'reminded you about', overdue: 'noticed this is overdue:', cheer: 'is cheering you on for' };

const newToken = () => crypto.randomBytes(32).toString('base64url'); // 256-bit, URL-safe
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const validTokenShape = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const newPalCode = () => { const b = crypto.randomBytes(8); let s = ''; for (let i = 0; i < 8; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length]; return s; };
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const clipText = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);

const taskKey = (t) => (t && (t.id || `${(t.createdAt && (t.createdAt.seconds ?? t.createdAt._seconds)) ?? t.createdAt ?? ''}|${t.title || ''}`)) || '';
const tsMs = (v) => (v == null ? null : typeof v === 'number' ? v : v.toMillis ? v.toMillis() : v._seconds != null ? v._seconds * 1000 : v.seconds != null ? v.seconds * 1000 : Date.parse(v) || null);

// Overdue = not done and (its reminder time passed, or it sits on an earlier day of this Mon-Sun week).
const isOverdue = (task, dayName, now = new Date()) => {
  if (!task || task.completed) return false;
  const r = task.reminder;
  if (r && r.date && r.time) { const [y, mo, d] = String(r.date).split('-').map(Number); const [h, mi] = String(r.time).split(':').map(Number); const dt = new Date(y, mo - 1, d, h, mi); if (!isNaN(dt) && dt < now) return true; }
  const today = WEEK.indexOf(DAYS[now.getDay()]); const di = WEEK.indexOf(dayName);
  return di >= 0 && di < today;
};
// Read-only, minimal task projection for viewers (no notes, images, links, internal timers).
const viewTasks = (dayDocs, now = new Date()) => {
  const out = [];
  for (const { day, tasks } of dayDocs) for (const t of tasks || []) {
    if (!t || !t.title || t.visibility === 'private') continue; // Private tasks (only you) never leave the server; missing = public
    out.push({ key: taskKey(t), day, title: clipText(t.title, 200), completed: !!t.completed, important: !!t.important,
      reminder: t.reminder && t.reminder.date ? { date: t.reminder.date, time: t.reminder.time || '' } : null, overdue: isOverdue(t, day, now) });
  }
  const order = (x) => (x.overdue ? 0 : x.completed ? 2 : 1);
  return out.sort((a, b) => order(a) - order(b) || WEEK.indexOf(a.day) - WEEK.indexOf(b.day));
};
const nudgeText = (managerName, preset, taskTitle) => `${managerName || 'Your manager'} ${NUDGE_PRESETS[preset] || NUDGE_PRESETS.ping} ${taskTitle ? `"${taskTitle}"` : 'your tasks'}`;

module.exports = { WEEK, NUDGE_PRESETS, newToken, hashToken, validTokenShape, newPalCode, normCode, pairId, clipText, taskKey, tsMs, isOverdue, viewTasks, nudgeText };
