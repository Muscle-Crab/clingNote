// What the Focus Mode screen shows. The clock is the task timer already stored on the task
// (timerEndTime / timerPausedAt). This file does not start, pause, or save a timer.
import { ringRemainingMs, ringFraction, fmtRemaining, durationMs, elapsedMs } from './timerRing.js';
import { isPomo } from './pomodoro.js';
import { subtasksOf } from './subtasks.js';

export const focusDateLabel = (d = new Date()) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

export const focusCountdown = (task, now = Date.now()) => fmtRemaining(ringRemainingMs(task, now));

export const focusRingFraction = (task, now = Date.now()) => ringFraction(task, now);

export const focusSubtitle = (task) => {
  const mins = Math.round(Number(task && task.timerDurationMinutes) || 0);
  const phase = task && task.timerPomo && task.timerPomo.phase;
  const kind = phase === 'break' ? 'Break' : 'Focus';
  return mins > 0 ? `${kind} for ${mins} min · Deep work session` : 'Deep work session';
};

// Pomodoro uses its own round count. A Coach focus block uses that block's n/of.
// A plain timer is one session, and the bar is how far the stored duration has run.
export const focusSessionCard = (task, { now = Date.now(), coach = null } = {}) => {
  const dur = durationMs(task);
  const slice = dur > 0 ? Math.min(1, elapsedMs(task, now) / dur) : 0;
  if (isPomo(task)) {
    const p = task.timerPomo;
    const n = Number(p.round) || 1;
    const of = Math.max(1, Number(p.rounds) || 1);
    const doneBefore = p.phase === 'break' ? n : Math.max(0, n - 1);
    return { n, of, percent: Math.min(100, Math.round(((doneBefore + slice) / of) * 100)), label: `${n} of ${of} focus sessions` };
  }
  if (coach && Number(coach.of) > 1 && Number(coach.n) > 0) {
    const n = Number(coach.n);
    const of = Number(coach.of);
    return { n, of, percent: Math.min(100, Math.round((((n - 1) + slice) / of) * 100)), label: `${n} of ${of} focus sessions` };
  }
  return { n: 1, of: 1, percent: Math.round(slice * 100), label: '1 of 1 focus sessions' };
};

// Checklist only when the task already has subtasks. Otherwise the card is omitted.
export const focusSteps = (task) => {
  const items = subtasksOf(task).filter((s) => s && String(s.title || '').trim());
  if (!items.length) return null;
  return { left: items.filter((s) => !s.done).length, items };
};
