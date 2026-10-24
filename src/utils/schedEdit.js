// Scheduling v2: pure edit operations for scheduled / recurring tasks (see docs/scheduling-guide.md).
// Model: one-time entries + recurring templates live in users/{uid}.scheduledTasks; occurrences are materialized
// into the day list (weeklyRoutines) on their date, so each one is completed independently.
// Every function is pure: (list, task, ...) -> { list, task } where task === null means "remove it from the day list".
import { describeRecurrence, isValidDate, isValidTime, addDaysStr, buildScheduledEntry, buildRecurringTemplate, occursOn, instanceId, isTemplate, isMaterialized, makeScheduledId } from './scheduling.js';

export const REPEATS = ['never', 'daily', 'weekly', 'monthly'];
export const blankSchedule = (date = '') => ({ on: false, date, time: '', repeat: 'never', days: [], dayOfMonth: '', until: '' });

// Picker state for an existing task (from its own fields + its template, if any).
export const scheduleOfTask = (task, list, dayDate) => {
  if (!task) return blankSchedule(dayDate);
  const tpl = task.templateId ? (list || []).find((e) => e.id === task.templateId) : null;
  if (tpl?.recurrence) return { on: true, date: task.scheduledFor || dayDate, time: tpl.scheduledTime || task.time || '', repeat: tpl.recurrence.freq, days: [...(tpl.recurrence.days || [])], dayOfMonth: tpl.recurrence.dayOfMonth || '', until: tpl.recurrence.until || '' };
  if (task.scheduledFor) return { on: true, date: task.scheduledFor, time: isValidTime(task.time) ? task.time : '', repeat: 'never', days: [], dayOfMonth: '', until: '' };
  return blankSchedule(dayDate);
};
export const scheduleOfEntry = (e) => (e?.recurrence
  ? { on: true, date: e.startDate, time: e.scheduledTime || '', repeat: e.recurrence.freq, days: [...(e.recurrence.days || [])], dayOfMonth: e.recurrence.dayOfMonth || '', until: e.recurrence.until || '' }
  : { on: true, date: e?.scheduledDate || '', time: e?.scheduledTime || '', repeat: 'never', days: [], dayOfMonth: '', until: '' });

export const validateSchedule = (s, minDate) => {
  if (!s?.on) return '';
  if (!isValidDate(s.date)) return 'Pick a date.';
  if (minDate && s.date < minDate) return 'Pick today or a later date.';
  if (s.time && !isValidTime(s.time)) return 'Pick a valid time.';
  if (!REPEATS.includes(s.repeat)) return 'Pick how it repeats.';
  if (s.repeat === 'weekly' && !(s.days || []).length) return 'Pick at least one weekday.';
  if (s.repeat === 'monthly' && s.dayOfMonth && !(Number(s.dayOfMonth) >= 1 && Number(s.dayOfMonth) <= 31)) return 'Day of month must be 1–31.';
  if (s.repeat !== 'never' && s.until && (!isValidDate(s.until) || s.until < s.date)) return 'End date must be on or after the start date.';
  return '';
};
const recOf = (s) => ({ freq: s.repeat, days: s.days, dayOfMonth: s.dayOfMonth, until: s.until || '' });

// Strip every scheduling field from a day-list task (it becomes a plain task).
export const stripSchedule = (task) => {
  const { scheduledId, scheduledFor, templateId, reminder, repeatText, ...rest } = task || {};
  if (scheduledFor && rest.time && rest.time === reminder?.time) rest.time = '';
  if (scheduledFor && rest.dueDate === scheduledFor) rest.dueDate = '';
  return rest;
};
const fieldsOf = (task) => { const { completed, createdAt, scheduledId, scheduledFor, templateId, reminder, time, ...f } = stripSchedule(task); return f; };
const timed = (task, date, time) => ({ ...task, scheduledFor: date, dueDate: task.dueDate || date, time: time || '', ...(time ? { startTime: task.startTime || time, reminder: { date, time, repeat: '' } } : { reminder: undefined }) });
const clean = (o) => { const r = { ...o }; Object.keys(r).forEach((k) => r[k] === undefined && delete r[k]); return r; };

// "This and all future": the series ends the day before `fromDate`; unmaterialized instances from then on are removed.
export const stopFrom = (list, tplId, fromDate) => (list || []).flatMap((e) => {
  if (e.templateId === tplId && !isMaterialized(e) && e.scheduledDate >= fromDate) return [];
  if (e.id !== tplId || !isTemplate(e)) return [e];
  const until = addDaysStr(fromDate, -1);
  if (until < e.startDate) return [{ ...e, stopped: true, recurrence: { ...e.recurrence, until } }];
  return [{ ...e, recurrence: { ...e.recurrence, until } }];
});
// "Only this one" for an occurrence that is not in a day list yet.
export const skipOccurrence = (list, tplId, date) => (list || []).filter((e) => !(e.templateId === tplId && e.scheduledDate === date && !isMaterialized(e)))
  .map((e) => (e.id === tplId ? { ...e, skip: [...new Set([...(e.skip || []), date])].sort() } : e));

// Edit an upcoming entry (Upcoming list). scope: 'this' | 'future' (templates/instances only).
export const editEntry = (list, id, fields, sched, scope = 'future', todayStr = '') => {
  const e = (list || []).find((x) => x.id === id);
  if (!e) return list || [];
  if (!sched.on) return isTemplate(e) ? stopFrom(list, id, todayStr || e.startDate) : (e.templateId ? skipOccurrence(list, e.templateId, e.scheduledDate) : list.filter((x) => x.id !== id));
  const base = { ...e, ...fields };
  if (e.templateId && scope === 'this') { // one occurrence: detach it into a one-time entry
    const one = buildScheduledEntry(fieldsOf(base), sched.date, sched.time);
    return [...skipOccurrence(list, e.templateId, e.scheduledDate), one];
  }
  const tplId = isTemplate(e) ? e.id : e.templateId;
  let next = tplId ? stopFrom(list, tplId, isTemplate(e) ? (todayStr && todayStr > e.startDate ? todayStr : e.startDate) : e.scheduledDate) : list.filter((x) => x.id !== id);
  if (tplId && isTemplate(e) && !(todayStr > e.startDate)) next = next.filter((x) => x.id !== tplId); // nothing happened yet: replace outright
  const { recurrence, generated, startDate, skip, stopped, templateId, scheduledDate, scheduledTime, ...f } = base;
  const ent = sched.repeat === 'never' ? buildScheduledEntry(f, sched.date, sched.time) : buildRecurringTemplate({ ...f, scheduledTime: sched.time }, sched.date, recOf(sched));
  return ent ? [...next, ent] : list;
};
export const deleteEntry = (list, id, scope = 'this') => {
  const e = (list || []).find((x) => x.id === id);
  if (!e) return list || [];
  if (isTemplate(e)) return stopFrom(list, id, e.startDate).filter((x) => x.id !== id || x.generated?.length);
  if (e.templateId) return scope === 'future' ? stopFrom(list, e.templateId, e.scheduledDate) : skipOccurrence(list, e.templateId, e.scheduledDate);
  return list.filter((x) => x.id !== id);
};

// Apply the picker to a task that is in the day list for `dayDate`.
// Returns { list, task, error }. task === null: remove from the day list (it moved to a future date / to its series).
export const applyTaskSchedule = ({ list, task, sched, scope = 'future', dayDate }) => {
  let next = [...(list || [])];
  const tplId = task.templateId;
  const err = validateSchedule(sched, sched.repeat === 'never' ? dayDate : null);
  if (err) return { list, task, error: err };
  // drop a one-time entry record for this task (materialized bookkeeping) when its schedule changes
  const dropOneTime = () => { if (task.scheduledId && !tplId) next = next.filter((e) => e.id !== task.scheduledId); };
  if (!sched.on) {
    if (tplId && scope === 'future') next = stopFrom(next, tplId, addDaysStr(dayDate, 1));
    dropOneTime();
    return { list: next, task: stripSchedule(task) };
  }
  if (sched.repeat === 'never') {
    if (tplId && scope === 'future') next = stopFrom(next, tplId, addDaysStr(dayDate, 1));
    dropOneTime();
    const plain = stripSchedule(task);
    if (sched.date === dayDate) return { list: next, task: clean(timed({ ...plain, scheduledId: makeScheduledId() }, dayDate, sched.time)) };
    const ent = buildScheduledEntry(fieldsOf(task), sched.date, sched.time);
    return { list: [...next, ent], task: null };
  }
  // recurring
  if (tplId && scope === 'this') { // only this occurrence's time can change; the rule needs "all future"
    return { list: next, task: clean(timed({ ...task }, task.scheduledFor || dayDate, sched.time)) };
  }
  const start = tplId ? (sched.date > dayDate ? sched.date : dayDate) : sched.date;
  if (tplId) next = stopFrom(next, tplId, dayDate);
  dropOneTime();
  const tpl = buildRecurringTemplate({ ...fieldsOf(task), scheduledTime: sched.time }, start, recOf(sched));
  if (!tpl) return { list, task, error: 'Could not build the repeat rule.' };
  if (start <= dayDate && occursOn(tpl, dayDate)) { // this task becomes today's occurrence of the new series
    tpl.generated = [dayDate];
    const linked = clean(timed({ ...stripSchedule(task), templateId: tpl.id, scheduledId: instanceId(tpl.id, dayDate), repeatText: describeRecurrence(tpl.recurrence) }, dayDate, sched.time));
    return { list: [...next, tpl], task: linked };
  }
  return { list: [...next, tpl], task: task.completed ? stripSchedule(task) : null };
};

// Delete a day-list task. scope 'future' on an occurrence also ends its series from that day.
export const deleteTaskScope = (list, task, scope, dayDate) => {
  if (task?.templateId && scope === 'future') return stopFrom(list, task.templateId, dayDate);
  if (task?.scheduledId && !task.templateId) return (list || []).filter((e) => e.id !== task.scheduledId);
  return list || [];
};
