// "What's next / roll a task" (pure): the boss picks your next task from today's open tasks by a weighted roll.
// Weight = points × due-time boost × locked-plan-order boost × energy fit. A running timer always wins (no roll).
// rand is injectable so tests are deterministic. Reroll passes the last pick in `exclude` so it never repeats back-to-back.
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const mins = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
export const keyOf = (t) => (t && (t.createdAt || t.id || t.title)) || '';
export const openToday = (tasks = []) => (tasks || []).filter((t) => t && t.title && !t.completed && t.status !== 'wontdo' && t.status !== 'pending');
const lenOf = (t) => num(t.estimateMin) || num(t.minutes) || 30;

// One task's weight. ctx: { nowM, locked, rank (0-based position among open tasks in plan order), total, energy }
export const rollWeight = (t, { nowM = 0, locked = false, rank = 0, total = 1, energy = '' } = {}) => {
  let w = Math.max(1, num(t.points) || 10);
  const s = mins(t.startTime);
  if (s != null) { const d = s - nowM; w *= d <= 0 ? 4 : d <= 60 ? 1 + (60 - d) / 20 : d <= 180 ? 1.2 : 0.7; } // overdue ×4, due within the hour up to ×4
  if (t.important || t.priority === 'high') w *= 1.5;
  if (locked && total > 1) w *= 1 + 3 * ((total - 1 - rank) / (total - 1)); // locked plan: first in order ×4 … last ×1
  const len = lenOf(t);
  if (energy === 'low') w *= len <= 25 ? 2 : len >= 60 ? 0.4 : 1;
  else if (energy === 'high') w *= len >= 45 || num(t.points) >= 50 ? 1.6 : 1;
  return Math.round(w * 100) / 100;
};

const reasonFor = (t, { nowM, locked, rank, energy }) => {
  const s = mins(t.startTime);
  if (s != null && s <= nowM) return `it was due at ${t.startTime}`;
  if (s != null && s - nowM <= 60) return `it is due at ${t.startTime}`;
  if (locked && rank === 0) return 'it is next in your locked plan';
  if (energy === 'low' && lenOf(t) <= 25) return 'it is short and your energy is low';
  return `${num(t.points) || 10} points`;
};

// -> { task, reason, weights:[{title,w}], left } or { task:null, reason, left:0 }
export const rollNext = (tasks = [], { now = new Date(), locked = false, energy = '', exclude = '' } = {}, rand = Math.random) => {
  const open = openToday(tasks);
  if (!open.length) return { task: null, reason: (tasks || []).some((t) => t && t.completed) ? 'all done' : 'no tasks', left: 0 };
  const running = open.find((t) => t.timerActive);
  if (running) return { task: running, reason: 'its timer is running', left: open.length, weights: [] };
  const nowM = now.getHours() * 60 + now.getMinutes(); const total = open.length;
  let pool = open.map((t, rank) => ({ t, rank, w: rollWeight(t, { nowM, locked, rank, total, energy }) }));
  if (exclude && pool.length > 1) pool = pool.filter((p) => keyOf(p.t) !== exclude);
  const sum = pool.reduce((s, p) => s + p.w, 0); let r = Math.min(0.999999, Math.max(0, Number(rand()) || 0)) * sum; let pick = pool[pool.length - 1];
  for (const p of pool) { if (r < p.w) { pick = p; break; } r -= p.w; }
  return { task: pick.t, reason: reasonFor(pick.t, { nowM, locked, rank: pick.rank, energy }), left: total, weights: pool.map((p) => ({ title: p.t.title, w: p.w })) };
};

// The one line the boss says (speech bubble + voice).
export const rollLine = (r) => {
  if (!r || !r.task) return r && r.reason === 'all done' ? 'All done for today. Nothing left to roll.' : 'No tasks today yet. Add one and tap me again.';
  return `Next: ${r.task.title}, ${r.reason}.`;
};
