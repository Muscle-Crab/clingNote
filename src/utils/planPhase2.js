// Plan phase 2 (pure helpers): self-replanning day, holiday range, boss alarm time, growing scene, hard-lock unlock.
export const AUTO_REPLAN_BEHIND = 15; // minutes behind before the day replans itself
export const AUTO_REPLAN_GAP_MS = 45 * 60000; // at most once per 45 min (and never right after an Undo)
export const shouldAutoReplan = ({ behind = 0, started = false, enabled = true, lastAt = 0, undoneAt = 0, now = Date.now(), busy = false } = {}) =>
  !!(enabled && started && !busy && behind >= AUTO_REPLAN_BEHIND && now - (Number(lastAt) || 0) >= AUTO_REPLAN_GAP_MS && now - (Number(undoneAt) || 0) >= AUTO_REPLAN_GAP_MS);

// Holiday: inclusive YYYY-MM-DD range -> list (max 31 days, never in the past).
export const MAX_OFF_DAYS = 31;
export const offRange = (from, to, today) => {
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || ''); if (!ok(from)) return [];
  const p = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let a = p(from); const b = ok(to) ? p(to) : a; if (b < a) return [];
  if (ok(today) && a < p(today)) a = p(today);
  const out = []; for (let d = new Date(a); d <= b && out.length < MAX_OFF_DAYS; d.setDate(d.getDate() + 1)) out.push(f(d));
  return out;
};
export const isOffDay = (offDates, day) => Array.isArray(offDates) && offDates.includes(day);
export const offLine = (days) => (days.length <= 1 ? 'Day off. Your streak is safe. Rest well.' : `${days.length} days off. Your streak is safe until you're back.`);

// Boss alarm: ring at the task's start time if it's still ahead today, else in `fallbackMin` minutes.
export const alarmAtFor = (task, now = new Date(), fallbackMin = 30) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((task && task.startTime) || '');
  if (m) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2]); if (d.getTime() > now.getTime() + 60000) return d; }
  return new Date(now.getTime() + fallbackMin * 60000);
};
export const alarmLine = (task, at) => `Alarm set for ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}: ${task.title}. It rings until you start.`;

// Growing scene: grows with today's points when there is a points target, else with task progress (whichever is further).
export const growPct = (percentage = 0, points = 0, target = 0) => {
  const byTasks = Math.max(0, Number(percentage) || 0);
  const byPts = target > 0 ? (Math.max(0, Number(points) || 0) / target) * 100 : 0;
  return Math.min(100, Math.max(byTasks, byPts));
};

// Hard-to-undo lock: unlocking needs the exact word typed (not a tap), and costs points.
export const UNLOCK_WORD = 'UNLOCK';
export const unlockAccepted = (typed) => String(typed || '').trim().toUpperCase() === UNLOCK_WORD;
