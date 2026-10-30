// Sergeant long-press menu (plan phase 1): hold the robot face -> What's next · Replan · I'm off · Make critical.
// Same actions as saying them to the assistant; each maps onto existing logic (suggestNext, autoSchedule, streak offDates,
// task.important). Pure helpers only; HomeView wires them.
export const SERGEANT_ACTIONS = [
  { id: 'next', label: "What's next", icon: '👉', hint: 'Robot rolls one task · Start or Reroll' },
  { id: 'replan', label: 'Replan', icon: '🔄', hint: 'Fit the rest of today' },
  { id: 'off', label: "I'm off today", icon: '🏖️', hint: 'Streak stays safe' },
  { id: 'critical', label: 'Make critical', icon: '❗', hint: 'Mark the next task' },
];
export const HOLD_MS = 550;

// Replan: snapshot open tasks' start times so one Undo puts them back. plan = autoSchedule().plan ([{ task, start }]).
export const replanMoves = (plan = []) => (plan || []).filter((p) => p && p.task && (p.task.startTime || '') !== p.start)
  .map((p) => ({ key: p.task.createdAt || p.task.title, title: p.task.title, from: p.task.startTime || '', to: p.start }));
export const replanLine = (moves, behindMin = 0) => {
  const n = moves.length;
  if (!n) return 'Your plan still fits. Nothing to move.';
  const lead = behindMin >= 5 ? `${behindMin} min behind. ` : '';
  return `${lead}Moved ${n} task${n === 1 ? '' : 's'}.`;
};
// How far behind: the earliest open task whose start time has already passed (0 when on time).
export const behindMinutes = (tasks = [], now = new Date()) => {
  const nowM = now.getHours() * 60 + now.getMinutes(); let worst = 0;
  for (const t of tasks || []) {
    if (!t || t.completed || t.status === 'wontdo' || !/^\d{1,2}:\d{2}$/.test(t.startTime || '')) continue;
    const [h, m] = t.startTime.split(':').map(Number); worst = Math.max(worst, nowM - (h * 60 + m));
  }
  return Math.max(0, worst);
};
export const nextLine = (r) => (r && r.task ? `Do this next: ${r.task.title}.` : 'Nothing left today. Good work.');
export const criticalLine = (task, already) => (!task ? 'No open task to mark.' : already ? `${task.title} is already critical.` : `${task.title} is now critical.`);
