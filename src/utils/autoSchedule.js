// Auto-schedule (pure): place open tasks into free gaps between calendar busy blocks; reshuffle = re-run from "now".
const toM = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const toS = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
// busy: [{start:'HH:MM', end:'HH:MM'}]; returns [{start,end}] free gaps within [from, until]
export const freeSlots = (busy = [], fromMin = 8 * 60, untilMin = 22 * 60) => {
  const b = (busy || []).map((x) => [toM(x.start), toM(x.end)]).filter(([s, e]) => s != null && e != null && e > s).sort((x, y) => x[0] - y[0]);
  const out = []; let cur = fromMin;
  for (const [s, e] of b) { if (s > cur) out.push([cur, Math.min(s, untilMin)]); cur = Math.max(cur, e); if (cur >= untilMin) break; }
  if (cur < untilMin) out.push([cur, untilMin]);
  return out.filter(([s, e]) => e - s >= 5);
};
// tasks with a fixed startTime keep it (and block time); others go into gaps (high priority / more points first). gapMin between blocks.
export const autoSchedule = (tasks = [], busy = [], { nowMin = 8 * 60, untilMin = 22 * 60, gapMin = 5 } = {}) => {
  const open = (tasks || []).filter((t) => t && t.title && !t.completed && t.status !== 'wontdo' && t.status !== 'pending');
  const fixed = open.filter((t) => toM(t.startTime) != null && toM(t.startTime) >= nowMin);
  const len = (t) => Number(t.estimateMin) || Number(t.minutes) || 30;
  const allBusy = [...busy, ...fixed.map((t) => ({ start: t.startTime, end: toS(Math.min(1439, toM(t.startTime) + len(t))) }))];
  const slots = freeSlots(allBusy, Math.ceil(nowMin / 5) * 5, untilMin);
  const todo = open.filter((t) => !fixed.includes(t)).sort((a, b) => (b.priority === 'high') - (a.priority === 'high') || (Number(b.points) || 0) - (Number(a.points) || 0));
  const plan = []; const unplaced = [];
  for (const t of todo) {
    const i = slots.findIndex(([s, e]) => e - s >= len(t));
    if (i < 0) { unplaced.push(t); continue; }
    const [s, e] = slots[i]; plan.push({ task: t, start: toS(s), end: toS(s + len(t)) });
    const ns = s + len(t) + gapMin; if (e - ns >= 5) slots[i] = [ns, e]; else slots.splice(i, 1);
  }
  return { plan, unplaced };
};
