// Scheduling v2: which reminders should be pending right now. iOS allows 64 pending local notifications per app;
// scheduled tasks get at most SCHED_BUDGET of them (nearest first), the rest is left for manual reminders and timers.
// One-shot `at` triggers per occurrence (not repeating triggers) so end dates, skips and edits are exact.
import { isValidDate, isValidTime, isTemplate, isMaterialized, occurrencesBetween, addDaysStr, instanceId, fmtTime, isAfterCompletion } from './scheduling.js';
import { extraPings } from './taskExtras.js';
export const routineKey = (tplId, date) => `routine:${instanceId(tplId, date)}`;

export const IOS_PENDING_LIMIT = 64;
export const SCHED_BUDGET = 48;
const at = (date, time) => { const [y, mo, d] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number); return new Date(y, mo - 1, d, h, mi, 0, 0); };
export const schedKey = (id) => `sched:${id}`;
// Plain day tasks with a start time ("go to the store at 6 PM"): one ping today at that time. Key = the task's stable identity.
export const timeKey = (t) => `time:${t.id || `${t.createdAt?.seconds ?? t.createdAt ?? ''}|${t.title || ''}`}`;

// list = users.scheduledTasks; todayTasks = today's day list (materialized occurrences); budget may be reduced by other pending ones.
export const planNotifications = ({ list = [], todayTasks = [], todayStr, now = new Date(), budget = SCHED_BUDGET, horizonDays = 35 }) => {
  const out = new Map();
  // B44: extra "N before" reminders (task.remindOffsets) and a "Time to leave" ping (task.location + travelMin) per timed occurrence
  const extras = (baseKey, when, task) => { if (task) for (const x of extraPings({ baseKey, whenMs: when.getTime(), task, nowMs: now.getTime() })) if (!out.has(x.key)) out.set(x.key, { ...x, at: new Date(x.at) }); };
  const add = (id, date, time, title, task = null) => {
    if (!isValidDate(date) || !isValidTime(time)) return;
    const when = at(date, time);
    if (when.getTime() <= now.getTime() || out.has(id)) return;
    out.set(id, { key: schedKey(id), at: when, title: 'Task Reminder', body: `${title || 'Task'} at ${fmtTime(time)}` });
    extras(schedKey(id), when, task);
  };
  const seen = new Set();
  // Per-series daily reminder time (tpl.remindAt) replaces the series' time-based ping; one 'routine:' ping per repeat day (sound: cn_task).
  const remindOf = new Map((list || []).filter((e) => isTemplate(e) && isValidTime(e.remindAt)).map((e) => [e.id, e]));
  (todayTasks || []).forEach((t) => {
    if (!t?.scheduledFor || !t.scheduledId) return;
    seen.add(t.scheduledId);
    if (t.templateId && remindOf.has(t.templateId)) return;
    if (!t.completed && t.status !== 'wontdo') add(t.scheduledId, t.scheduledFor, t.time, t.title, t);
  });
  // timed day tasks (today only; completed / won't-do / deleted / time cleared drop out of the plan -> cancelled by diffPlan)
  (todayTasks || []).forEach((t) => {
    if (!t || t.scheduledFor || t.completed || t.status === 'wontdo' || t.status === 'pending' || !isValidTime(t.startTime)) return;
    const k = timeKey(t); const when = at(todayStr, t.startTime);
    if (!isValidDate(todayStr) || when.getTime() <= now.getTime() || out.has(k)) return;
    out.set(k, { key: k, at: when, title: 'ClingNote', body: `${t.title || 'Task'} at ${fmtTime(t.startTime)}`, kind: 'time' });
    extras(k, when, t);
  });
  const items = list || [];
  const ids = new Set(items.map((e) => e?.id));
  items.forEach((e) => {
    if (!e || isTemplate(e) || seen.has(e.id) || isMaterialized(e) || (e.templateId && remindOf.has(e.templateId))) return;
    add(e.id, e.scheduledDate, e.scheduledTime, e.title, e);
  });
  remindOf.forEach((tpl) => {
    if (tpl.stopped) return;
    const done = new Set(tpl.doneOn || []);
    const dates = isAfterCompletion(tpl) ? (tpl.nextDate ? [tpl.nextDate < todayStr ? todayStr : tpl.nextDate] : []) : occurrencesBetween(tpl, todayStr, addDaysStr(todayStr, horizonDays), 120);
    dates.forEach((d) => {
      if (done.has(d) || !isValidDate(d)) return; // finished (or, after-completion, finished today) -> no ping
      const when = at(d, tpl.remindAt); const k = routineKey(tpl.id, d);
      if (when.getTime() <= now.getTime() || out.has(k)) return;
      out.set(k, { key: k, at: when, title: 'Routine', body: `${tpl.title || 'Routine task'} · tap to check it off`, kind: 'routine' });
    });
  });
  items.filter((e) => isTemplate(e) && !e.stopped && isValidTime(e.scheduledTime) && !remindOf.has(e.id)).forEach((tpl) => {
    const gen = new Set(tpl.generated || []);
    occurrencesBetween(tpl, todayStr, addDaysStr(todayStr, horizonDays), 120).forEach((d) => {
      const id = instanceId(tpl.id, d);
      if (seen.has(id) || ids.has(id) || gen.has(d)) return; // handled by the materialized task / instance entry
      add(id, d, tpl.scheduledTime, tpl.title, tpl);
    });
  });
  return [...out.values()].sort((a, b) => a.at - b.at).slice(0, Math.max(0, budget));
};

// Given previously-scheduled keys and the new plan: what to cancel, what to (re)schedule.
export const diffPlan = (prevKeys, plan) => {
  const keep = new Set(plan.map((p) => p.key));
  return { cancel: (prevKeys || []).filter((k) => !keep.has(k)), schedule: plan };
};
