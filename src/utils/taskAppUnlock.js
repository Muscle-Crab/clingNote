// Per-task app unlock (pure, unit-tested in scripts/test-task-app-unlock.mjs). A task can carry apps it needs (picked on the
// phone with the Screen Time picker; tokens live natively in the App Group, TaskAllow in ios/App/Shared/LockShared.swift).
// While that task's focus timer runs, those apps come off every ClingNote shield; they re-lock when the task is completed, the
// timer ends (also natively, via the DeviceActivity "clingTask" schedule, so it works when the app is killed), the timer is
// ended early or paused, or another task takes over. The app reconciles on every timer change, every 15 s tick and on launch.
import { widgetTaskId } from './widgetSnapshot.js';

const ms = (v) => { if (v == null || v === '') return 0; const n = typeof v === 'number' ? v : new Date(v).getTime(); return Number.isFinite(n) ? n : 0; };
export const MIN_WINDOW_MS = 60000; // native refuses windows shorter than a minute

// The allowance that SHOULD be live now. tasks: today's list; appCounts: {taskId: n apps picked}; gate: {refuse?: string}
// -> {taskId, untilMs, count} | null (+ reason when a task wanted apps but was refused)
export const desiredAllowance = (tasks = [], { appCounts = {}, now = Date.now(), gate = {} } = {}) => {
  const t = (tasks || []).find((x) => x && x.timerActive && ms(x.timerEndTime) && x.completed !== true);
  if (!t) return { want: null };
  const id = widgetTaskId(t); const count = Number(appCounts[id]) || 0;
  if (!count) return { want: null };
  if (ms(t.timerPausedAt)) return { want: null, reason: 'paused' };
  const untilMs = ms(t.timerEndTime);
  if (untilMs - now < MIN_WINDOW_MS) return { want: null, reason: 'ending' };
  if (gate && gate.refuse) return { want: null, reason: 'gate', message: gate.refuse };
  return { want: { taskId: id, untilMs, count } };
};

// current: native active allowance {taskId, untilMs} | null (from ClingLock.taskApps on launch / after each call).
// -> {cmd: 'allow'|'end'|null, taskId?, untilMs?, why}
export const planTaskUnlock = (current, tasks, opts = {}) => {
  const now = opts.now || Date.now(); const d = desiredAllowance(tasks, { ...opts, now });
  const live = current && current.taskId && ms(current.untilMs) > now ? current : null;
  if (!d.want) return live || (current && current.taskId) ? { cmd: 'end', taskId: current.taskId, why: d.reason || 'not running' } : { cmd: null, why: d.reason || 'idle' };
  if (live && live.taskId === d.want.taskId && Math.abs(ms(live.untilMs) - d.want.untilMs) < 1000) return { cmd: null, why: 'in sync' };
  return { cmd: 'allow', taskId: d.want.taskId, untilMs: d.want.untilMs, count: d.want.count, why: live ? 'switch/extend' : 'start' };
};

// One-line label for the task-sheet row (and the assistant). count: apps picked for this task; active: is it unlocked now.
export const taskAppsRowLabel = (count = 0, { active = false, untilMs = 0 } = {}) => {
  if (!count) return 'Apps this task needs: none';
  const n = `${count} app${count === 1 ? '' : 's'}`;
  if (!active) return `Apps this task needs: ${n} · unlocked while its timer runs`;
  const t = untilMs ? new Date(untilMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  return `${n} unlocked for this task${t ? ` until ${t}` : ''}`;
};
