// Transfer a task to another weekday tab (HomeView TransferModal).
// Moving a task is not the free daily creation cap. Pro can hold any number of tasks, so a move is not refused for length.
export const MAX_TASKS_PER_DAY = Infinity;
// next tab after the current one (wraps), never the current tab itself
export const defaultTransferDay = (current, count) => (count < 2 ? null : (current < 0 ? 0 : (current + 1) % count));
export const transferFits = (targetLen, max = MAX_TASKS_PER_DAY) => targetLen + 1 <= max;
// createdAt may be an ISO string on the card and a Firestore Timestamp in the day doc. Same instant must still match.
export const createdStamp = (v) => {
  if (v == null || v === '') return '';
  if (typeof v === 'object' && typeof v.toMillis === 'function') return String(v.toMillis());
  if (typeof v === 'object' && Number.isFinite(Number(v.seconds))) return String(Math.round(Number(v.seconds) * 1000 + (Number(v.nanoseconds) || 0) / 1e6));
  const n = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(n) ? String(n) : String(v);
};
export const moveKey = (t) => (!t ? '' : (t.id != null && t.id !== '' ? `id:${t.id}` : `${createdStamp(t.createdAt)}|${t.title || ''}`));
// The moved copy keeps its identity and recurrence. A running timer does not follow it to the next day.
export const movedTask = (t) => (!t ? t : { ...t, timerActive: false, timerStartedAt: null, timerEndTime: null, timerPausedAt: null, timerStoppedAt: null, focusLock: false, timerPomo: null });
// remove = drop the source slot. tomb = same length, same createdAt and points, hidden, because a shorter list is rejected while the day is locked.
export const planMove = (src, dst, key, mode = 'remove') => {
  const from = src || []; const to = dst || [];
  const i = from.findIndex((t) => moveKey(t) === key);
  if (i < 0) return { ok: false, reason: 'missing' };
  const raw = from[i];
  const task = movedTask(raw);
  const nextDst = to.some((t) => moveKey(t) === key) ? to.slice() : [...to, task];
  const nextSrc = mode === 'tomb'
    ? from.map((t, idx) => (idx === i ? { ...t, removed: true, timerActive: false, timerEndTime: null, timerPausedAt: null, timerStoppedAt: null, focusLock: false } : t))
    : [...from.slice(0, i), ...from.slice(i + 1)];
  return { ok: true, raw, nextSrc, nextDst };
};
// Only a real transport failure is "check your connection". A rules rejection is not the network.
export const transferFailure = (e) => {
  const code = String((e && e.code) || '').replace(/^firestore\//, '');
  const msg = String((e && e.message) || '');
  if (code === 'permission-denied') return 'Couldn\'t move the task. This day can\'t be edited right now.';
  if (code === 'unavailable' || code === 'deadline-exceeded' || /client is offline|network|failed to fetch/i.test(msg)) return 'Couldn\'t move the task. Check your connection and try again.';
  return 'Couldn\'t move the task. Try again.';
};
