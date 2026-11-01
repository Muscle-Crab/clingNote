// Routine add-ons (pure): today's routine checklist, weekly completion, Skip today, completion log, repeat-after-completion math.
// Routines = scheduling v2 recurring templates in users/{uid}.scheduledTasks (see utils/scheduling.js). Occurrences live in the
// day list as one-time tasks (removed from the list when completed), so completions are logged on the template:
//   tpl.doneOn: ['YYYY-MM-DD']  calendar series -> the occurrence date; after-completion series -> the completion date.
// Skip today: calendar series -> date added to tpl.skip (occursOn() then ignores it); after-completion series -> nextDate = today + 1
//   (it stays due, just not today). Neither records a completion, so streak / points / daily counts are untouched.
import { isTemplate, isMaterialized, occursOn, addDaysStr, mondayOf, isValidDate, isAfterCompletion, clampEveryDays, instanceId, isFlexWeekly, flexTimes, flexDoneInWeek } from './scheduling.js';

export const DONE_KEEP_DAYS = 70;
const prune = (dates, todayStr) => [...new Set(dates || [])].filter((d) => isValidDate(d) && d >= addDaysStr(todayStr, -DONE_KEEP_DAYS)).sort();

// Next date for an after-completion series finished on `completedOn`: completedOn + N calendar days (local; DST/month safe).
export const nextAfter = (completedOn, everyDays) => addDaysStr(completedOn, clampEveryDays(everyDays));

// Record (done=true) or undo (done=false) a completion of day-list `task` (an occurrence with templateId).
export const markRoutineDone = (list, task, todayStr, done) => {
  const tplId = task?.templateId; if (!tplId) return list || [];
  const tpl = (list || []).find((e) => e && e.id === tplId && isTemplate(e)); if (!tpl) return list || [];
  if (!isAfterCompletion(tpl)) {
    const date = task.scheduledFor || todayStr;
    const doneOn = done ? prune([...(tpl.doneOn || []), date], todayStr) : (tpl.doneOn || []).filter((d) => d !== date);
    return list.map((e) => (e === tpl ? { ...e, doneOn } : e));
  }
  const occ = task.scheduledFor || tpl.nextDate || todayStr;
  if (done) {
    const next = nextAfter(todayStr, tpl.recurrence.everyDays);
    return list.map((e) => {
      if (e === tpl) return { ...e, doneOn: prune([...(e.doneOn || []), todayStr], todayStr), nextDate: next, lastNext: occ };
      if (e.templateId === tplId && e.id === instanceId(tplId, occ)) return { ...e, done: true };
      return e;
    });
  }
  // undo (same day): the occurrence is pending again; drop any not-yet-shown instance generated for the moved date
  return list.filter((e) => !(e.templateId === tplId && !isMaterialized(e) && e.scheduledDate !== occ)).map((e) => {
    if (e === tpl) return { ...e, doneOn: (e.doneOn || []).filter((d) => d !== todayStr), nextDate: occ, generated: (e.generated || []).filter((d) => d <= occ || d < todayStr) };
    if (e.templateId === tplId && e.id === instanceId(tplId, occ)) { const { done: _d, ...rest } = e; return rest; }
    return e;
  });
};

// Skip today for an occurrence (no completion, series continues).
export const skipRoutineToday = (list, task, todayStr) => {
  const tplId = task?.templateId; if (!tplId) return list || [];
  const tpl = (list || []).find((e) => e && e.id === tplId && isTemplate(e)); if (!tpl) return list || [];
  if (isAfterCompletion(tpl)) {
    const occ = task.scheduledFor || tpl.nextDate || todayStr;
    return list.map((e) => {
      if (e === tpl) return { ...e, nextDate: addDaysStr(todayStr, 1), doneOn: (e.doneOn || []).filter((d) => d !== todayStr) };
      if (e.templateId === tplId && e.id === instanceId(tplId, occ)) return { ...e, done: true, skipped: true };
      return e;
    });
  }
  const date = task.scheduledFor || todayStr;
  return list.map((e) => (e === tpl ? { ...e, skip: [...new Set([...(e.skip || []), date])].sort(), doneOn: (e.doneOn || []).filter((d) => d !== date) } : e));
};
export const canSkipToday = (task, list) => !!task?.templateId && !task.completed && (list || []).some((e) => e && e.id === task.templateId && isTemplate(e));

// Templates that count as a routine on `date` (occurs, or finished that day for after-completion series).
const routineOn = (tpl, date, todayStr) => {
  if (isAfterCompletion(tpl)) {
    if ((tpl.doneOn || []).includes(date)) return { due: true, done: true };
    const pending = tpl.nextDate && !tpl.stopped ? (tpl.nextDate < todayStr ? todayStr : tpl.nextDate) : '';
    return { due: pending === date, done: false };
  }
  if (isFlexWeekly(tpl)) { // flexible N×/week: a done day counts; an undone past day is never a 'miss' (any day works)
    if ((tpl.doneOn || []).includes(date) && occursOn(tpl, date)) return { due: true, done: true };
    if (date < todayStr || tpl.stopped) return { due: false, done: false };
    return { due: occursOn(tpl, date), done: false };
  }
  if (!occursOn(tpl, date)) return { due: false, done: false };
  return { due: true, done: (tpl.doneOn || []).includes(date) };
};

// Per-series streak that never breaks on a day the series isn't required:
//   flexible N×/week -> consecutive Mon–Sun weeks with >= N completions (the current week adds once met, never breaks while open);
//   calendar series  -> consecutive required dates done (non-occurring / skipped days are ignored; today open doesn't break);
//   after-completion -> number of completions in the kept log that were on time is not tracked here, so: completions count.
export const routineStreak = (tpl, todayStr) => {
  if (!tpl || !isTemplate(tpl) || !isValidDate(todayStr)) return { streak: 0, unit: 'day' };
  const done = new Set(tpl.doneOn || []);
  const floor = addDaysStr(todayStr, -DONE_KEEP_DAYS);
  const start = tpl.startDate && tpl.startDate > floor ? tpl.startDate : floor;
  if (isFlexWeekly(tpl)) {
    const n = flexTimes(tpl); let wk = mondayOf(todayStr); let streak = 0;
    if (flexDoneInWeek(tpl, todayStr) >= n) streak++;
    for (wk = addDaysStr(wk, -7); addDaysStr(wk, 6) >= start; wk = addDaysStr(wk, -7)) { if (flexDoneInWeek(tpl, wk) >= n) streak++; else break; }
    return { streak, unit: 'week' };
  }
  if (isAfterCompletion(tpl)) return { streak: done.size, unit: 'time' };
  let streak = 0;
  for (let d = todayStr; d >= start; d = addDaysStr(d, -1)) {
    if (!occursOn(tpl, d)) continue; // not required that day: neither counts nor breaks
    if (done.has(d)) streak++; else if (d === todayStr) continue; else break;
  }
  return { streak, unit: 'day' };
};

// Today's checklist: [{ id, title, done, task }]. `task` = its open copy in today's list (tap toggles it), or null.
export const routineToday = (list, dayTasks, todayStr) => (list || []).filter(isTemplate).flatMap((tpl) => {
  const r = routineOn(tpl, todayStr, todayStr); if (!r.due) return [];
  // today's copy first; else the latest overdue copy still in the list (an after-completion task stays until done)
  const mine = (dayTasks || []).filter((t) => t && t.templateId === tpl.id && (!t.scheduledFor || t.scheduledFor <= todayStr));
  const task = mine.find((t) => t.scheduledFor === todayStr) || mine.sort((x, y) => String(y.scheduledFor || '').localeCompare(String(x.scheduledFor || '')))[0] || null;
  const flex = isFlexWeekly(tpl) ? { done: flexDoneInWeek(tpl, todayStr), n: flexTimes(tpl) } : null;
  return [{ id: tpl.id, title: tpl.title, done: r.done || !!task?.completed, task, flex, streak: routineStreak(tpl, todayStr).streak }];
});

// This week (Mon–Sun containing todayStr): per-day { date, label, total, done, state } + totals.
// state: 'none' (no routine), 'done', 'part', 'miss' (past day, nothing done), 'open' (today, not all done), 'future'.
export const routineWeek = (list, todayStr) => {
  const tpls = (list || []).filter(isTemplate); const mon = mondayOf(todayStr);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysStr(mon, i); let total = 0; let done = 0;
    tpls.forEach((t) => { const r = routineOn(t, date, todayStr); if (r.due) { total++; if (r.done) done++; } });
    const state = !total ? 'none' : done === total ? 'done' : date > todayStr ? 'future' : done ? 'part' : date === todayStr ? 'open' : 'miss';
    return { date, label: 'MTWTFSS'[i], total, done, state };
  });
  const total = days.reduce((a, d) => a + d.total, 0); const done = days.reduce((a, d) => a + d.done, 0);
  return { days, total, done, label: `This week: ${done} of ${total} routine task${total === 1 ? '' : 's'} done` };
};
