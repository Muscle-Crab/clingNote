// Lock-screen focus timer (iOS 17+ Live Activity buttons): Pause / Resume / Done taps are App Intents that run outside the web view,
// so they persist {id, kind, taskId, ts} in the App Group ("focus.pending", ios/App/Shared/FocusIntents.swift). The app reconciles them
// here on launch / foreground through its OWN paths (Done -> the widget completer -> toggleTaskCompletion, the same as tapping the check
// in-app), so points are awarded once. Pure (only widgetSnapshot), unit-tested in node: scripts/test-focus-actions.mjs.
import { widgetTaskId } from './widgetSnapshot.js';

export const FOCUS_MAX_AGE_MS = 12 * 3600 * 1000; // an action older than this (or from the future) is ignored
export const APPLIED_KEEP = 200;
const KINDS = ['pause', 'resume', 'done'];
const ms = (v) => { if (v == null || v === '') return 0; const n = typeof v === 'number' ? v : new Date(v).getTime(); return Number.isFinite(n) ? n : 0; };

export const actionId = (a) => (a && a.id ? String(a.id) : `${a && a.kind}:${a && a.taskId}@${a && a.ts}`);

// -> 'invalid' | 'duplicate' | 'stale' | 'missing' | 'already-done' | 'noop' | 'locked' | 'pause' | 'resume' | 'done'
export const classifyFocusAction = (a, tasks, { now = Date.now(), applied = [] } = {}) => {
  if (!a || !KINDS.includes(a.kind) || typeof a.taskId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(a.taskId)) return 'invalid';
  if ((applied || []).includes(actionId(a))) return 'duplicate';
  const ts = Number(a.ts) || 0;
  if (!ts || now - ts > FOCUS_MAX_AGE_MS || ts > now + 60000) return 'stale';
  const t = (tasks || []).find((x) => x && widgetTaskId(x) === a.taskId);
  if (!t) return 'missing';
  if (t.completed === true) return a.kind === 'done' ? 'already-done' : 'noop';
  if (a.kind === 'done') return 'done';
  if (a.kind === 'pause' && t.focusLock === true) return 'locked'; // auto-started focus can't be paused (only Done / end early in-app)
  // pause/resume only act on the timer session they were tapped in: an action from before this timer started is stale
  const started = ms(t.timerStartedAt);
  if (started && ts < started - 1000) return 'stale';
  if (!t.timerActive || !ms(t.timerEndTime)) return 'noop';
  if (a.kind === 'pause') return ms(t.timerPausedAt) ? 'noop' : 'pause';
  return ms(t.timerPausedAt) ? 'resume' : 'noop';
};

// Patches use the TAP time, so the frozen remaining time matches what the Live Activity showed.
export const pausePatch = (t, ts) => {
  const end = ms(t && t.timerEndTime); const at = Math.min(Number(ts) || Date.now(), end || Infinity);
  return { timerPausedAt: new Date(at).toISOString() };
};
export const resumePatch = (t, ts) => {
  const p = ms(t && t.timerPausedAt), end = ms(t && t.timerEndTime), at = Number(ts) || Date.now();
  return { timerPausedAt: null, timerEndTime: new Date(end + Math.max(0, at - p)).toISOString() };
};
export const remainingMs = (t, now = Date.now()) => {
  const end = ms(t && t.timerEndTime); const p = ms(t && t.timerPausedAt);
  return Math.max(0, end - (p || now));
};

// queue: native entries; getTasks(): today's live list (re-read after each apply); apply: { pause(taskId, ts), resume(taskId, ts), done(taskId) }
// each resolving true on success (false/throw keeps the entry for the next foreground). applied: ids already applied (persisted by the app).
// Returns { acked: [id], kept: [id], results: [{id, taskId, kind, action, ok}], applied: [id] }.
export const reconcileFocusActions = async ({ queue, getTasks, apply = {}, applied = [], now = Date.now() }) => {
  const acked = [], kept = [], results = []; const done = new Set(); let appliedOut = [...(applied || [])];
  const list = (Array.isArray(queue) ? queue : []).slice().sort((x, y) => (Number(x && x.ts) || 0) - (Number(y && y.ts) || 0));
  for (const a of list) {
    const id = actionId(a);
    let action = classifyFocusAction(a, await getTasks(), { now, applied: appliedOut });
    if (action === 'done' && done.has(a.taskId)) action = 'duplicate';
    if (action === 'pause' || action === 'resume' || action === 'done') {
      let ok = false;
      try { ok = (await (apply[action] ? apply[action](a.taskId, Number(a.ts)) : false)) === true; } catch (e) { ok = false; }
      if (ok) { acked.push(id); appliedOut.push(id); if (action === 'done') done.add(a.taskId); } else kept.push(id);
      results.push({ id, taskId: a.taskId, kind: a.kind, action, ok });
    } else { acked.push(id); results.push({ id, taskId: a && a.taskId, kind: a && a.kind, action, ok: true }); }
  }
  if (appliedOut.length > APPLIED_KEEP) appliedOut = appliedOut.slice(-APPLIED_KEEP);
  return { acked, kept, results, applied: appliedOut };
};

// Live Activity content for the running (or paused) focus task. dayEndMs: end of the 8-hour day (0 = none).
export const focusActivityState = (t, { ptsDone = 0, ptsTarget = 0, dayEndMs = 0, appsUnlocked = 0, now = Date.now() } = {}) => {
  if (!t || !t.timerActive || !ms(t.timerEndTime) || t.completed === true) return null;
  const paused = !!ms(t.timerPausedAt);
  return {
    taskId: widgetTaskId(t), title: String(t.title || 'Focus').slice(0, 80),
    endsAtMs: paused ? now + remainingMs(t, now) : ms(t.timerEndTime), paused, locked: t.focusLock === true, remainingSec: Math.round(remainingMs(t, now) / 1000),
    ptsDone: Math.max(0, Math.round(Number(ptsDone) || 0)), ptsTarget: Math.max(0, Math.round(Number(ptsTarget) || 0)),
    dayEndsAtMs: dayEndMs > now ? Math.round(dayEndMs) : 0,
    ...(appsUnlocked > 0 ? { appsUnlocked: Math.round(appsUnlocked) } : {}),
  };
};
// identity of the activity (a new one is requested when it changes) and of its content (an update is pushed when it changes)
export const focusActivityKey = (s) => (s ? `${s.taskId}` : '');
export const focusContentSig = (s) => (s ? `${s.paused ? `p${s.remainingSec}` : s.endsAtMs}${s.locked ? 'L' : ''}${s.appsUnlocked ? `U${s.appsUnlocked}` : ''}|${s.ptsDone}/${s.ptsTarget}|${s.dayEndsAtMs}` : '');
