// Pure helpers for task planning. All new task fields are optional so old tasks keep working.
export const ACTIVE_CAP = 3;
export const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'pending', label: 'Pending' },
];
// Pending = blocked on something external (task.pendingOn, e.g. 'Apple review'): no overdue/nag carry, no streak effect.
export const isPending = (t) => t?.status === 'pending';

export const taskKey = (t) => `${t?.createdAt || ''}|${t?.title || ''}`;
export const isActive = (t) => !t?.completed;
export const activeCount = (tasks) => (tasks || []).filter(isActive).length;

export const estimateOf = (t) => {
  const n = Number(t?.estimateMin);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const toMinutes = (hhmm) => {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const formatClock = (mins) => {
  const total = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
};

export const formatDuration = (mins) => {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

// Today's load from tasks that are not done yet.
export const loadSummary = (tasks) => {
  const open = (tasks || []).filter(isActive);
  const minutes = open.reduce((s, t) => s + estimateOf(t), 0);
  const unestimated = open.filter((t) => !estimateOf(t)).length;
  let level = 'ok';
  let hint = 'Realistic';
  if (minutes > 480) { level = 'over'; hint = 'Overloaded — consider moving something'; }
  else if (minutes > 360) { level = 'full'; hint = 'Full day'; }
  return { minutes, unestimated, level, hint, count: open.length };
};

// Time-blocked schedule: tasks with a start time ordered by it; end = start + estimate.
export const buildSchedule = (tasks) => {
  const blocks = [];
  const unscheduled = [];
  (tasks || []).forEach((t) => {
    const start = toMinutes(t.startTime);
    if (start === null) { unscheduled.push(t); return; }
    const dur = estimateOf(t);
    blocks.push({ task: t, start, end: dur ? start + dur : null, dur });
  });
  blocks.sort((a, b) => a.start - b.start);
  // flag every block that overlaps any other block (not just its immediate neighbour)
  blocks.forEach((b) => { b.conflict = false; });
  blocks.forEach((a, i) => {
    if (a.end === null) return;
    for (let j = i + 1; j < blocks.length && blocks[j].start < a.end; j++) { a.conflict = true; blocks[j].conflict = true; }
  });
  return { blocks, unscheduled };
};
