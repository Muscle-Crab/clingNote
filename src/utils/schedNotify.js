// Scheduling v2: which reminders should be pending right now. iOS allows 64 pending local notifications per app;
// scheduled tasks get at most SCHED_BUDGET of them (nearest first), the rest is left for manual reminders and timers.
// One-shot `at` triggers per occurrence (not repeating triggers) so end dates, skips and edits are exact.
import { isValidDate, isValidTime, isTemplate, isMaterialized, occurrencesBetween, addDaysStr, instanceId, fmtTime } from './scheduling.js';

export const IOS_PENDING_LIMIT = 64;
export const SCHED_BUDGET = 48;
const at = (date, time) => { const [y, mo, d] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number); return new Date(y, mo - 1, d, h, mi, 0, 0); };
export const schedKey = (id) => `sched:${id}`;

// list = users.scheduledTasks; todayTasks = today's day list (materialized occurrences); budget may be reduced by other pending ones.
export const planNotifications = ({ list = [], todayTasks = [], todayStr, now = new Date(), budget = SCHED_BUDGET, horizonDays = 35 }) => {
  const out = new Map();
  const add = (id, date, time, title) => {
    if (!isValidDate(date) || !isValidTime(time)) return;
    const when = at(date, time);
    if (when.getTime() <= now.getTime() || out.has(id)) return;
    out.set(id, { key: schedKey(id), at: when, title: 'Task Reminder', body: `${title || 'Task'} at ${fmtTime(time)}` });
  };
  const seen = new Set();
  (todayTasks || []).forEach((t) => {
    if (!t?.scheduledFor || !t.scheduledId) return;
    seen.add(t.scheduledId);
    if (!t.completed && t.status !== 'wontdo') add(t.scheduledId, t.scheduledFor, t.time, t.title);
  });
  const items = list || [];
  const ids = new Set(items.map((e) => e?.id));
  items.forEach((e) => {
    if (!e || isTemplate(e) || seen.has(e.id) || isMaterialized(e)) return;
    add(e.id, e.scheduledDate, e.scheduledTime, e.title);
  });
  items.filter((e) => isTemplate(e) && !e.stopped && isValidTime(e.scheduledTime)).forEach((tpl) => {
    const gen = new Set(tpl.generated || []);
    occurrencesBetween(tpl, todayStr, addDaysStr(todayStr, horizonDays), 120).forEach((d) => {
      const id = instanceId(tpl.id, d);
      if (seen.has(id) || ids.has(id) || gen.has(d)) return; // handled by the materialized task / instance entry
      add(id, d, tpl.scheduledTime, tpl.title);
    });
  });
  return [...out.values()].sort((a, b) => a.at - b.at).slice(0, Math.max(0, budget));
};

// Given previously-scheduled keys and the new plan: what to cancel, what to (re)schedule.
export const diffPlan = (prevKeys, plan) => {
  const keep = new Set(plan.map((p) => p.key));
  return { cancel: (prevKeys || []).filter((k) => !keep.has(k)), schedule: plan };
};
