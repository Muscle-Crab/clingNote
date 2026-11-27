// Ending a session by hand (End session on the goal-reached prompt, Give up on the countdown card, or Give up on the session-ended screen) opens the locked apps
// for the gap until the next session Start. The record is this device's: { key, day, reason }. It only matches the
// ended session it was written for, so a new Start (new startMs) or a new local day goes back to the normal shield rules.
// Natively the same release is the App Group GoalRelease flag (drops every shield, honored with the app killed,
// cleared by the next session Begin or local midnight). Scoring is untouched: the server records the early end as usual.
export const RELEASE_KEY = 'cn.session.released.v1';

export const releaseKeyOf = (lock) => (lock && Number(lock.startMs) > 0 ? `${lock.dayKey || ''}#${Number(lock.index) || 0}:${Number(lock.startMs)}` : '');

export const readRelease = (storage, day) => {
  try { const v = JSON.parse((storage && storage.getItem(RELEASE_KEY)) || 'null'); return v && v.key && v.day === day ? v : null; } catch (e) { return null; }
};

export const writeRelease = (storage, { key, day, reason = 'end' } = {}) => {
  if (!key || !day) return null;
  const v = { key, day, reason, at: Date.now() };
  try { storage.setItem(RELEASE_KEY, JSON.stringify(v)); } catch (e) { /* private mode: the native flag still holds */ }
  return v;
};

// True while the session this release was written for is the one shown and it is no longer running.
export const releasedFor = (rel, lock, running) => !!(rel && !running && lock && releaseKeyOf(lock) && releaseKeyOf(lock) === rel.key);
