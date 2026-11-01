// One-tap repeat toggle on task cards (the 🔁 icon). ClingNote has two repeat models:
//   legacy  - per-day copies in weeklyRoutines with task.repeatDays ['Mon',...] / type 'recurring' (old TaskCard popover)
//   v2      - recurring templates in users/{uid}.scheduledTasks; day-list occurrences carry templateId (SchedulePicker)
// The icon is ON when either applies. Turning ON always creates a v2 series (daily, or the task's last pattern);
// turning OFF stops the series after today (v2: stopFrom tomorrow; legacy: drop the other days' copies) and keeps today's task.
import { WEEKDAYS, describeRecurrence, isValidTime } from './scheduling.js';

export const legacyRepeating = (t) => !!t && ((t.repeatDays || []).length > 1 || (t.type === 'recurring' && !Array.isArray(t.repeatDays)));
const activeTemplate = (t, list, todayStr) => {
  if (!t?.templateId) return null;
  const tpl = (list || []).find((e) => e && e.id === t.templateId && e.recurrence);
  if (!tpl) return (list || []).length ? null : { recurrence: null }; // list not loaded yet: trust the occurrence
  if (tpl.stopped || (tpl.recurrence.until && todayStr && tpl.recurrence.until < todayStr)) return null;
  return tpl;
};

// Legacy repeatDays -> v2 pattern (undefined repeatDays on an old 'recurring' task = every day).
export const legacyPattern = (t) => {
  const r = Array.isArray(t?.repeatDays) ? t.repeatDays : null;
  if (!r || r.length >= 7) return { repeat: 'daily', days: [] };
  return { repeat: 'weekly', days: r.map((d) => WEEKDAYS.indexOf(d)).filter((i) => i >= 0).sort() };
};

const legacyLabel = (t) => {
  const r = t.repeatDays || [];
  if (!Array.isArray(t.repeatDays) || r.length === 7) return 'daily';
  if (r.length === 5 && ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every((d) => r.includes(d))) return 'weekdays';
  return WEEKDAYS.filter((d) => r.includes(d)).join(' ');
};

// { on, model: 'v2' | 'legacy' | null, label }
export const repeatState = (t, list, todayStr) => {
  const tpl = activeTemplate(t, list, todayStr);
  if (tpl) return { on: true, model: 'v2', label: (tpl.recurrence ? describeRecurrence(tpl.recurrence) : t.repeatText) || 'Repeats' };
  if (legacyRepeating(t)) return { on: true, model: 'legacy', label: `Repeats ${legacyLabel(t)}` };
  return { on: false, model: null, label: '' };
};

// Pattern to remember when turning OFF (saved on the task as lastRepeat, reused by the next ON).
export const patternOf = (t, list, todayStr) => {
  const s = repeatState(t, list, todayStr);
  if (s.model === 'legacy') return legacyPattern(t);
  if (s.model === 'v2') { const tpl = activeTemplate(t, list, todayStr); const r = tpl?.recurrence; if (r) return { repeat: r.freq, days: [...(r.days || [])], dayOfMonth: r.dayOfMonth || '' }; }
  return null;
};
const okPattern = (p) => p && ['daily', 'weekly', 'monthly'].includes(p.repeat) && (p.repeat !== 'weekly' || (p.days || []).length);

// SchedulePicker-shaped schedule for turning ON: last pattern if valid, else daily. Weekly always includes today.
export const onSchedule = (t, dayDate) => {
  const p = okPattern(t?.lastRepeat) ? t.lastRepeat : { repeat: 'daily', days: [] };
  const today = new Date(`${dayDate}T12:00:00`).getDay();
  const days = p.repeat === 'weekly' ? [...new Set([...(p.days || []).map(Number), today])].sort() : [];
  const time = isValidTime(t?.time) ? t.time : (isValidTime(t?.startTime) ? t.startTime : '');
  return { on: true, date: dayDate, time, repeat: p.repeat, days, dayOfMonth: p.repeat === 'monthly' ? (p.dayOfMonth || '') : '', until: '' };
};
export const offSchedule = (dayDate) => ({ on: false, date: dayDate, time: '', repeat: 'never', days: [], dayOfMonth: '', until: '' });
export const toastFor = (on, sched) => (on ? `Repeats ${describeRecurrence({ freq: sched.repeat, days: sched.days, dayOfMonth: sched.dayOfMonth }).replace(/^Every day$/, 'daily').replace(/^Every /, 'every ')}` : 'Repeat off · today’s task stays');
