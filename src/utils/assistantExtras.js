// Assistant extras (pure, no imports): week stats, task search, "what next", snooze time, spoken repeat rules.
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const ptsOf = (t) => num(t && t.points);
const mins = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const pad = (n) => String(n).padStart(2, '0');

// week = [{ day:'Monday', tasks:[...] }] -> totals over the days given (the caller passes Monday..today)
export const weekStats = (week = [], { streak = 0, bestStreak = 0 } = {}) => {
  let planned = 0, done = 0, points = 0;
  const days = (week || []).map(({ day, tasks }) => {
    const list = (tasks || []).filter((t) => t && t.title && t.status !== 'pending');
    const d = list.filter((t) => t.completed); planned += list.length; done += d.length;
    const p = d.reduce((s, t) => s + ptsOf(t), 0); points += p;
    return { day, planned: list.length, done: d.length, points: p };
  });
  return { streak, bestStreak, planned, done, completionRate: planned ? Math.round((done / planned) * 100) : 0, pointsThisWeek: points, days };
};

// Natural-language search: words of the query (minus filler) must all appear in title/notes; optional weekday filter.
const STOP = new Set(['the', 'a', 'an', 'task', 'tasks', 'my', 'find', 'for', 'what', 'did', 'i', 'plan', 'planned', 'on', 'is', 'there', 'any', 'show', 'me', 'to', 'do']);
export const searchTasks = (week = [], scheduled = [], { query = '', day = '' } = {}) => {
  const words = String(query).toLowerCase().split(/[^a-z0-9äöüß]+/i).filter((w) => w && !STOP.has(w));
  const hit = (t) => { const hay = `${t.title || ''} ${t.notes || ''}`.toLowerCase(); return words.every((w) => hay.includes(w)); };
  const dayOk = (d) => !day || String(d).toLowerCase().startsWith(String(day).toLowerCase().slice(0, 3));
  const out = [];
  (week || []).forEach(({ day: d, tasks }) => { if (dayOk(d)) (tasks || []).forEach((t) => { if (t && t.title && hit(t)) out.push({ title: t.title, day: d, time: t.startTime || '', done: !!t.completed }); }); });
  (scheduled || []).forEach((e) => { if (e && e.title && !day && hit(e)) out.push({ title: e.title, date: e.scheduledDate || e.startDate || '', time: e.scheduledTime || '', repeat: (e.recurrence && e.recurrence.freq) || '' }); });
  return out.slice(0, 20);
};

// "What should I do next": overdue/soon start times first, then points per minute that fit the time left; running timer wins.
export const suggestNext = (tasks = [], { now = new Date(), minutesLeft = null } = {}) => {
  const nowM = now.getHours() * 60 + now.getMinutes();
  const open = (tasks || []).filter((t) => t && t.title && !t.completed && t.status !== 'wontdo' && t.status !== 'pending');
  const running = open.find((t) => t.timerActive); if (running) return { task: running, reason: 'its timer is running' };
  const score = (t) => {
    const len = num(t.estimateMin) || num(t.minutes) || 30; const s = mins(t.startTime);
    let v = (ptsOf(t) || 10) / len;
    if (s != null) { const d = s - nowM; v += d <= 0 ? 100 : d <= 60 ? 50 - d / 2 : 0; }
    if (t.priority === 'high') v += 20;
    if (minutesLeft != null && len > minutesLeft) v -= 60;
    return v;
  };
  const best = open.map((t) => ({ t, v: score(t) })).sort((a, b) => b.v - a.v)[0];
  if (!best) return { task: null, reason: 'nothing left today' };
  const s = mins(best.t.startTime);
  const reason = s != null && s - nowM <= 60 ? (s <= nowM ? 'it was due at ' : 'it is due at ') + best.t.startTime : best.t.priority === 'high' ? 'it is high priority' : 'best points for the time';
  return { task: best.t, reason };
};

// Snooze: new local { date, time } = now + minutes.
export const snoozeTo = (now = new Date(), minutes = 30) => {
  const t = new Date(now.getTime() + Math.max(1, Math.min(1440, Math.round(num(minutes) || 30))) * 60000);
  return { date: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`, time: `${pad(t.getHours())}:${pad(t.getMinutes())}`, nextDay: t.getDate() !== now.getDate() };
};

// Spoken repeat -> the existing recurrence fields (schedEdit: repeat + days 0..6).
const DAYN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const repeatFields = (repeat = '', days = []) => {
  const r = String(repeat || '').toLowerCase();
  if (!r || r === 'never') return null;
  if (r === 'weekdays') return { repeat: 'weekly', days: [1, 2, 3, 4, 5] };
  if (r === 'weekends') return { repeat: 'weekly', days: [0, 6] };
  if (r === 'daily' || r === 'monthly' || r === 'yearly') return { repeat: r, days: [] };
  if (r === 'weekly') { const ds = (days || []).map((d) => (typeof d === 'number' ? d : DAYN.indexOf(String(d).toLowerCase().slice(0, 3)))).filter((d) => d >= 0 && d <= 6); return { repeat: 'weekly', days: ds }; }
  return null;
};
