// "Plan my day" (pure): fit today's open tasks into a window the USER picked (start time + number of hours).
// No defaults on purpose: planDay() refuses to run without both, so the UI can never silently pick them.
import { autoSchedule } from './autoSchedule';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toM = (s) => { const m = HHMM.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const toS = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const PLAN_HOUR_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10, 11, 12];
export const lengthOf = (t) => Number(t && t.estimateMin) || Number(t && t.minutes) || 30;
const isOpen = (t) => t && t.title && !t.completed && t.status !== 'wontdo' && t.status !== 'pending';

// -> { ok:false, error } | { ok:true, start, end, slots:[{task,start,end,changed}], unplaced:[task], spareMin }
export const planDay = (tasks = [], { start, hours, gapMin = 5, busy = [] } = {}) => {
  const s = toM(start);
  if (s == null) return { ok: false, error: 'Pick a start time first.' };
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0 || h > 16) return { ok: false, error: 'Pick how many hours first.' };
  const e = Math.min(24 * 60 - 1, s + Math.round(h * 60));
  const open = (tasks || []).filter(isOpen);
  if (!open.length) return { ok: false, error: 'No open tasks today to plan.' };
  // A time the user already set inside the window is kept as an anchor; anything outside it gets a new slot.
  const inWin = (t) => { const m = toM(t.startTime); return m != null && m >= s && m + lengthOf(t) <= e; };
  const prepared = open.map((t) => (inWin(t) ? t : { ...t, startTime: '', __orig: t }));
  const r = autoSchedule(prepared, busy, { nowMin: s, untilMin: e, gapMin });
  const back = (t) => t.__orig || t;
  const slots = [
    ...prepared.filter((t) => !t.__orig).map((t) => ({ task: t, start: t.startTime, end: toS(Math.min(1439, toM(t.startTime) + lengthOf(t))), changed: false })),
    ...r.plan.map((p) => ({ task: back(p.task), start: p.start, end: p.end, changed: back(p.task).startTime !== p.start })),
  ].sort((a, b) => toM(a.start) - toM(b.start));
  const used = slots.reduce((n, x) => n + lengthOf(x.task), 0);
  return { ok: true, start: toS(s), end: toS(e), slots, unplaced: r.unplaced.map(back), spareMin: Math.max(0, e - s - used) };
};

// Only the tasks whose start time actually changes are written on Confirm.
export const planChanges = (plan) => (plan && plan.ok ? plan.slots.filter((x) => x.changed).map((x) => ({ task: x.task, startTime: x.start })) : []);
export const fmtHours = (h) => (Number(h) % 1 ? `${Math.floor(h)}½` : String(h));
