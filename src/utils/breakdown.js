// "Break it down" (task card ⋯ menu): pure helpers. The server returns [{ title, minutes }]; here each step is re-checked, scored with the
// app's own estimator (estimateFor -> minutes + points, same as any new task) and turned into subtasks { id, title, done, minutes, points }.
import { estimateFor } from './taskEstimate';

const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 80);
const mins = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(120, n) : 0; };

// Server/model steps -> at most 6 unique, non-empty steps, each scored. Steps that just repeat the parent title are dropped.
export const scoreSteps = (steps, parentTitle = '') => {
  const seen = new Set([clean(parentTitle).toLowerCase()]);
  return (Array.isArray(steps) ? steps : []).map((s) => ({ title: clean(typeof s === 'string' ? s : s && s.title), minutes: mins(s && s.minutes) }))
    .filter((s) => s.title && !seen.has(s.title.toLowerCase()) && seen.add(s.title.toLowerCase())).slice(0, 6)
    .map((s) => { const e = estimateFor({ title: s.title, estimateMin: s.minutes || undefined }); return { title: s.title, minutes: s.minutes || e.minutes, points: e.points }; });
};

export const totals = (steps) => (steps || []).reduce((t, s) => ({ minutes: t.minutes + (s.minutes || 0), points: t.points + (s.points || 0) }), { minutes: 0, points: 0 });

const makeId = (i) => `s${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 6)}`;
// Appends the chosen steps to the task's existing subtasks (new array; existing subtasks untouched; titles already there are skipped).
export const appendSteps = (existing, steps) => {
  const list = Array.isArray(existing) ? [...existing] : [];
  const have = new Set(list.map((s) => String(s && s.title || '').toLowerCase()));
  (steps || []).forEach((s, i) => { if (s && s.title && !have.has(s.title.toLowerCase())) { have.add(s.title.toLowerCase()); list.push({ id: makeId(i), title: s.title, done: false, minutes: s.minutes, points: s.points }); } });
  return list;
};

// Error -> one calm sentence for the sheet (never a raw server message or stack).
export const breakdownError = (e) => {
  const st = e && e.status;
  if (st === 'consent-declined') return 'AI is off until you allow it. Nothing was sent.';
  if (st === 429) return (e && e.message && /Free plan/.test(e.message)) ? e.message : 'Daily AI limit reached. Try again tomorrow.';
  if (st === 401) return 'Sign in again to use AI.';
  if (st === 400) return 'Give the task a name first.';
  if (st === 500 && e && /not configured/i.test(e.message || '')) return "AI isn't available right now. Nothing was changed.";
  if (e && /Not signed in/.test(e.message || '')) return 'Sign in to use AI.';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return "You're offline. Try again when you're connected.";
  return "Couldn't break this down right now. Try again in a moment.";
};

// B44: the list is often re-read while the AI is thinking (snapshot / save), so the task object captured at open may be stale.
// -> index of the same task in the current list: identity first, then id, then createdAt+title; -1 if it is gone.
export const findTaskIndex = (list, task) => {
  const l = Array.isArray(list) ? list : []; if (!task) return -1;
  let i = l.indexOf(task); if (i >= 0) return i;
  if (task.id) { i = l.findIndex((t) => t && t.id === task.id); if (i >= 0) return i; }
  if (task.createdAt) i = l.findIndex((t) => t && t.createdAt === task.createdAt && t.title === task.title);
  return i;
};
