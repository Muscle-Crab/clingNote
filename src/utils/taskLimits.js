// Counts tasks created/scheduled for a calendar day (YYYY-MM-DD, local time) for the daily limit in config/pricing.js.
// - weekly-routine tasks count on the local date of their createdAt (multi-day copies of one add count once);
//   tasks materialized from a schedule (scheduledId) are skipped here because they count on their scheduled date.
// - scheduled one-off entries count on their scheduledDate. Recurring templates AND the per-date occurrences generated from them
//   (templateId set, e.g. 'abc_2026-10-29') are not counted: repeats never use up the daily limit.
import { dailyTaskLimit } from '../config/pricing.js';

const localDay = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA'); };

export const countTasksForDay = (dayKey, weeklyLists = [], scheduled = []) => {
  const seen = new Set();
  for (const list of weeklyLists) for (const t of list || []) {
    if (!t || t.scheduledId || !t.createdAt || localDay(t.createdAt) !== dayKey) continue;
    seen.add(`${t.createdAt}|${t.title}`);
  }
  const sched = (scheduled || []).filter((e) => e && !e.recurrence && !e.repeat && !e.isTemplate && !e.templateId && e.scheduledDate === dayKey).length;
  return seen.size + sched;
};

// -> { ok, count, limit }
export const checkDailyLimit = (pro, dayKey, weeklyLists, scheduled, adding = 1) => {
  const limit = dailyTaskLimit(pro);
  const count = countTasksForDay(dayKey, weeklyLists, scheduled);
  return { ok: count + adding <= limit, count, limit };
};
