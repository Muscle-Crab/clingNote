// Day and session points. The stored `points` field is the slot value frozen by the day rules
// (createdAt and points do not change on an existing slot while that weekday is frozen).
// The award is the completion: completed, completedAt, and the overtime stamp. A new session
// shows 0 until a completion after its baseline. That 0 is the session delta, not a wiped day.
import { overtimePoints } from './sessionGoal.js';

export const frozenPoints = (t) => {
  const n = Number(t && t.points);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

// pointsOf(task) is the card value (chip or size). A missing or zero stored field uses that
// for display only. This function does not write a new points value.
export const taskAward = (t, pointsOf = frozenPoints) => {
  if (!t || t.completed !== true || t.removed === true) return 0;
  const stored = frozenPoints(t);
  const full = stored > 0 ? stored : Math.max(0, Math.round(Number(pointsOf(t)) || 0));
  return overtimePoints(full, t);
};

export const dayAward = (tasks, pointsOf) => (tasks || []).reduce((n, t) => n + taskAward(t, pointsOf), 0);

// baseline is the day award at a successful session start. Equal totals show 0 for this session.
export const sessionAward = (dayTotal, baseline) => Math.max(0, Math.round((Number(dayTotal) || 0) - (Number(baseline) || 0)));
