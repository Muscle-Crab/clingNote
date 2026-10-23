// Native calendar/agenda model: which tasks fall on which date (pure; no Firestore).
// Sources: the 7 weekday lists (weeklyRoutines Sun..Sat), the scheduled list (users/{uid}.scheduledTasks), and recurring templates.
import { isValidDate, addDaysStr, isTemplate, isMaterialized, occursOn, instanceId, WEEKDAYS } from './scheduling';

export const dowOf = (s) => new Date(`${s}T12:00:00`).getDay();
export const weekStartOf = (s) => addDaysStr(s, -dowOf(s)); // Sunday-first, like the Home tabs
export const datesBetween = (from, to) => { const out = []; for (let d = from; d <= to && out.length < 400; d = addDaysStr(d, 1)) out.push(d); return out; };

const byTime = (a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : a.time ? -1 : b.time ? 1 : 0);

// dayLists: { Sun: task[], ... Sat: task[] }. Returns { 'YYYY-MM-DD': [{ key, title, time, done, recurring, kind }] } for every date in from..to.
export const agendaForRange = ({ scheduled = [], dayLists = {}, today, from, to }) => {
  const out = Object.fromEntries(datesBetween(from, to).map((d) => [d, []]));
  const add = (date, item) => { if (out[date]) out[date].push(item); };
  const weekStart = weekStartOf(today); const weekEnd = addDaysStr(weekStart, 6);
  const have = new Set(); // scheduled entry ids already represented
  const placed = new Set();

  // 1) Tasks in the weekday lists
  for (const name of WEEKDAYS) {
    for (const t of dayLists[name] || []) {
      if (!t || !t.title) continue;
      if (t.scheduledId) have.add(t.scheduledId);
    }
  }
  for (const d of datesBetween(from, to)) {
    const name = WEEKDAYS[dowOf(d)];
    const inWeek = d >= weekStart && d <= weekEnd;
    for (const t of dayLists[name] || []) {
      if (!t || !t.title) continue;
      const recurring = (t.repeatDays || []).length > 1 || t.type === 'recurring';
      const time = t.startTime || t.time || (t.reminder && t.reminder.time) || '';
      if (t.scheduledId) { // materialized scheduled task: lives on its scheduled date, with the task's own completion state
        const date = isValidDate(t.scheduledFor) ? t.scheduledFor : d;
        const k = `s-${t.scheduledId}`;
        if (placed.has(k)) continue;
        if (date >= from && date <= to) { placed.add(k); add(date, { key: k, title: t.title, time, done: !!t.completed, recurring: !!t.templateId, kind: 'scheduled' }); }
        continue;
      }
      if (recurring) { add(d, { key: `r-${name}-${t.createdAt || ''}-${t.title}`, title: t.title, time, done: inWeek ? !!t.completed : false, recurring: true, kind: 'repeat' }); continue; }
      if (!inWeek) continue; // one-off list tasks belong to the current week only
      if (isValidDate(t.dueDate) && t.dueDate !== d) { // dated task: show on its date
        const k = `t-${t.createdAt || ''}-${t.title}`;
        if (!placed.has(k)) { placed.add(k); add(t.dueDate, { key: k, title: t.title, time, done: !!t.completed, recurring: false, kind: 'due' }); }
        continue;
      }
      add(d, { key: `t-${name}-${t.createdAt || ''}-${t.title}`, title: t.title, time, done: !!t.completed, recurring: false, kind: 'task' });
    }
  }

  // 2) Scheduled entries that are not in a weekday list yet (their week has not started)
  for (const e of scheduled || []) {
    if (!e || !e.title) continue;
    have.add(e.id);
    if (isTemplate(e) || isMaterialized(e)) continue;
    if (!isValidDate(e.scheduledDate)) continue;
    if (placed.has(`s-${e.id}`)) continue;
    placed.add(`s-${e.id}`);
    add(e.scheduledDate, { key: `s-${e.id}`, title: e.title, time: e.scheduledTime || '', done: !!e.done, recurring: !!e.templateId, kind: 'scheduled' });
  }

  // 3) Recurring templates: every occurrence from today on that has no generated instance yet
  for (const tpl of scheduled || []) {
    if (!tpl || !isTemplate(tpl) || tpl.stopped) continue;
    for (const d of datesBetween(from > today ? from : today, to)) {
      if (!occursOn(tpl, d)) continue;
      const id = instanceId(tpl.id, d);
      if (have.has(id) || placed.has(`s-${id}`)) continue;
      add(d, { key: `tpl-${id}`, title: tpl.title, time: tpl.scheduledTime || '', done: false, recurring: true, kind: 'repeat' });
    }
  }

  for (const d of Object.keys(out)) out[d].sort(byTime);
  return out;
};
