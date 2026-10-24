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
// Estimate numbers only (for the read-only chips); never notes.
const num = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : undefined; };
const estFields = (t) => { const o = {}; const e = num(t.estimateMin, 600), m = num(t.minutes, 600), p = num(t.points, 1000), c = num(t.complexity, 5);
  if (e) o.estimateMin = e; if (m) o.minutes = m; if (p) o.points = p; if (c) o.complexity = c; return o; };

// ── Manager award (bonus coins and/or a badge), once per member per day, only when the member qualifies ──
const AWARD_BONUSES = [10, 25, 50];
const AWARD_BADGES = { mvp: { name: 'MVP of the Day', icon: '🏆' }, sweep: { name: 'Clean Sweep', icon: '🧹' }, early: { name: 'Early Bird', icon: '🐦' }, beast: { name: 'Beast Mode', icon: '🦁' }, fire: { name: 'On Fire', icon: '🔥' } };
// todayTasks: the member's PUBLIC tasks for today (viewTasks output); lock: eightHour lock (server doc) or null; dayKey: member's local date.
const awardEligibility = ({ todayTasks, lock, dayKey }) => {
  const list = todayTasks || [];
  const allDone = list.length > 0 && list.every((t) => t.completed);
  const goalMet = !!(lock && lock.dayKey === dayKey && lock.target > 0 && (lock.earned || 0) >= lock.target);
  return { ok: allDone || goalMet, allDone, goalMet };
};
const parseAward = (body) => {
  const bonus = AWARD_BONUSES.includes(Number(body.bonus)) ? Number(body.bonus) : 0;
  const badge = AWARD_BADGES[body.badge] ? body.badge : '';
  if (!bonus && !badge) return null;
  return { bonus, badge, note: clipText(body.note, 80) || '' };
};
const awardText = (mName, a) => `${mName} sent you ${[a.bonus ? `a ${a.bonus}-coin bonus` : '', a.badge ? `the ${AWARD_BADGES[a.badge].icon} ${AWARD_BADGES[a.badge].name} badge` : ''].filter(Boolean).join(' and ')}${a.note ? `: “${a.note}”` : '!'}`;

const viewTasks = (dayDocs, now = new Date()) => {
  const out = [];
  for (const { day, tasks } of dayDocs) for (const t of tasks || []) {
    if (!t || !t.title || t.visibility === 'private') continue; // Private tasks (only you) never leave the server; missing = public
    out.push({ key: taskKey(t), day, title: clipText(t.title, 200), completed: !!t.completed, important: !!t.important, ...estFields(t),
      reminder: t.reminder && t.reminder.date ? { date: t.reminder.date, time: t.reminder.time || '' } : null, overdue: isOverdue(t, day, now),
      ...(t.scheduledFor ? { scheduled: { date: String(t.scheduledFor), time: validTime(t.time) ? t.time : '', repeat: clipText(t.repeatText || (t.templateId ? 'Repeats' : ''), 60) } } : {}) });
  }
  const order = (x) => (x.overdue ? 0 : x.completed ? 2 : 1);
  return out.sort((a, b) => order(a) - order(b) || WEEK.indexOf(a.day) - WEEK.indexOf(b.day));
};
// ── Scheduled / recurring (users/{uid}.scheduledTasks, written by the owner's app) ──
// Mirrors src/utils/scheduling.js occursOn. Viewers see the next 7 days of Public entries that are not in a day list yet.
const validDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const validTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const occursOn = (tpl, s) => {
  const r = tpl && tpl.recurrence;
  if (!r || !validDate(s) || (tpl.startDate && s < tpl.startDate) || (r.until && s > r.until) || (tpl.skip || []).includes(s)) return false;
  const d = pd(s);
  if (r.freq === 'daily') return true;
  if (r.freq === 'weekly') return (r.days || []).includes(d.getDay());
  if (r.freq === 'monthly') { const dom = Number(r.dayOfMonth) || pd(tpl.startDate || s).getDate(); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return d.getDate() === Math.min(dom, last); }
  return false;
};
const describe = (r) => (!r ? '' : r.freq === 'daily' ? 'Every day' : r.freq === 'weekly' ? `Every ${(r.days || []).map((d) => WD[d]).join(', ')}` : r.freq === 'monthly' ? `Monthly on day ${r.dayOfMonth}` : '');
const passed = (date, time, now) => { const [y, mo, d] = date.split('-').map(Number); const at = validTime(time) ? new Date(y, mo - 1, d, ...time.split(':').map(Number)) : new Date(y, mo - 1, d + 1); return now >= at; };
const viewScheduled = (entries, now = new Date(), days = 7) => {
  const today = ymd(now); const end = addDays(today, days - 1);
  const list = Array.isArray(entries) ? entries.slice(0, 500) : [];
  const ids = new Set(list.map((e) => e && e.id));
  const out = [];
  const push = (e, id, date, time, repeat) => out.push({ key: `sched:${id}`, day: DAYS[pd(date).getDay()], title: clipText(e.title, 200), completed: false, important: !!e.important,
    reminder: validTime(time) ? { date, time } : null, overdue: passed(date, time, now), upcoming: true, scheduled: { date, time: validTime(time) ? time : '', repeat } });
  for (const e of list) {
    if (!e || !e.title || e.visibility === 'private' || e.stopped) continue;
    if (e.recurrence) {
      const gen = new Set(e.generated || []);
      for (let d = today; d <= end; d = addDays(d, 1)) if (occursOn(e, d) && !gen.has(d) && !ids.has(`${e.id}_${d}`)) push(e, `${e.id}_${d}`, d, e.scheduledTime, describe(e.recurrence));
    } else if (!e.materializedAt && validDate(e.scheduledDate) && e.scheduledDate <= end) {
      push(e, e.id, e.scheduledDate, e.scheduledTime, clipText(e.repeatText || '', 60));
    }
  }
  return out.sort((a, b) => (a.scheduled.date + (a.scheduled.time || '99')).localeCompare(b.scheduled.date + (b.scheduled.time || '99')));
};
const nudgeText = (managerName, preset, taskTitle) => `${managerName || 'Your manager'} ${NUDGE_PRESETS[preset] || NUDGE_PRESETS.ping} ${taskTitle ? `"${taskTitle}"` : 'your tasks'}`;

module.exports = {
  AWARD_BONUSES, AWARD_BADGES, awardEligibility, parseAward, awardText, WEEK, NUDGE_PRESETS, newToken, hashToken, validTokenShape, newPalCode, normCode, pairId, clipText, taskKey, tsMs, isOverdue, viewTasks, viewScheduled, occursOn, nudgeText };
