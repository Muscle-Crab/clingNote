// Siri / Shortcuts intents beyond "Add task" (ios/App/App/ClingIntents.swift). Pure so the JS half is unit-tested (scripts/test-siri-intents.js).
// - "Complete <task> in ClingNote": Swift marks it done in the widget snapshot and appends {taskId, day, ts} to "widget.pending", which the app
//   already drains through toggleTaskCompletion (same path as the interactive widget). Nothing new on the JS side.
// - "What's next in ClingNote": Swift answers from the widget snapshot ("widget.today"); whatsNext() below is the same rule, kept in sync
//   by test so the app and Siri agree on what "next" means.
// - "Start a timer in ClingNote": Swift queues {taskId, minutes, ts} in "intent.timer" and opens the app; HomeView drains it with
//   pickTimerIntent() and starts the timer through its normal startTimer().
import { widgetTaskId } from './widgetSnapshot';

export const TIMER_DEFAULT_MIN = 25;
export const TIMER_MAX_MIN = 240;
export const TIMER_STALE_MS = 10 * 60 * 1000; // a request older than this is dropped (the user has moved on)
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const tm = (t) => (typeof t.time === 'string' && HHMM.test(t.time.padStart(5, '0')) ? t.time.padStart(5, '0') : '');

// snapshot: buildWidgetSnapshot() output. Next = first open task with a start time at/after now (else the earliest timed open one),
// else the first open task in list order. -> { id, title, time } | null
export const whatsNext = (snapshot, now = new Date()) => {
  const open = ((snapshot && snapshot.tasks) || []).filter((t) => t && !t.done && t.title);
  if (!open.length) return null;
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const timed = open.filter((t) => tm(t)).sort((a, b) => tm(a).localeCompare(tm(b)));
  const pick = timed.find((t) => tm(t) >= hm) || open.find((t) => !tm(t)) || timed[0];
  return { id: pick.id, title: pick.title, time: tm(pick) };
};
export const whatsNextPhrase = (snapshot, now = new Date()) => {
  const n = whatsNext(snapshot, now);
  if (!n) return (snapshot && snapshot.total) ? 'You are done for today. Nice work.' : 'Nothing planned for today yet.';
  const left = ((snapshot && snapshot.tasks) || []).filter((t) => !t.done).length;
  return `Next: ${n.title}${n.time ? ` at ${n.time}` : ''}. ${left} task${left === 1 ? '' : 's'} left today.`;
};

const clampMin = (m) => { const n = Math.round(Number(m)); return Number.isFinite(n) && n > 0 ? Math.min(n, TIMER_MAX_MIN) : 0; };
// items: drained "intent.timer" queue; tasks: today's stored list (the one startTimer indexes into).
// Latest fresh request wins. -> { index, minutes, title } | { error } | null (nothing to do)
export const pickTimerIntent = (items, tasks, nowMs = Date.now()) => {
  const fresh = (Array.isArray(items) ? items : []).filter((it) => it && typeof it === 'object' && nowMs - (Number(it.ts) || 0) <= TIMER_STALE_MS && (Number(it.ts) || 0) <= nowMs + 60000);
  if (!fresh.length) return null;
  const it = fresh.sort((a, b) => Number(a.ts) - Number(b.ts))[fresh.length - 1];
  const list = Array.isArray(tasks) ? tasks : [];
  const openIdx = list.map((t, i) => [t, i]).filter(([t]) => t && t.title && t.completed !== true);
  let hit;
  if (it.taskId) {
    hit = list.map((t, i) => [t, i]).find(([t]) => t && widgetTaskId(t) === String(it.taskId));
    if (!hit) return { error: 'That task is no longer on today\'s list.' };
    if (hit[0].completed === true) return { error: `“${hit[0].title}” is already done.` };
  } else {
    const snap = { tasks: openIdx.map(([t, i]) => ({ id: String(i), title: t.title, time: t.startTime || '', done: false })) };
    const n = whatsNext(snap, new Date(nowMs)); if (!n) return { error: 'No open task to time today.' };
    hit = [list[Number(n.id)], Number(n.id)];
  }
  if (hit[0].timerActive) return { error: `A timer is already running for “${hit[0].title}”.` };
  const minutes = clampMin(it.minutes) || clampMin(hit[0].estimateMin) || TIMER_DEFAULT_MIN;
  return { index: hit[1], minutes, title: hit[0].title };
};
