// Decisions for the "how many hours today" dialog. A running session must never be treated as "no session".

// A cached lock is still this session until endMs, whether the server wrote it (local:false) or the phone did (local:true).
export const runningLock = (lock, now) => {
  if (!lock || !Number.isFinite(lock.startMs) || !Number.isFinite(lock.endMs)) return null;
  return now >= lock.startMs && now < lock.endMs ? lock : null;
};

// Same account, or a brief signed-out flicker while a day is already loaded: keep it. A different uid drops it.
export const authKeepsDay = (prevUid, nextUid, hasDay) => {
  if ((nextUid || null) === (prevUid || null)) return true;
  return !nextUid && !!prevUid && !!hasDay;
};

// One failed refresh must not replace a server day with the empty offline fallback.
export const shouldKeepServerDay = (loaded, data) => !!(loaded && data && !data.offline);

// Close the hours dialog as soon as a session is actually running. Do not open it over that session.
export const closeDayPrompt = ({ phase, running }) => !!(running || phase === 'running');

// Automatic first prompt only. A running lock, an ended lock still in memory, or a day already asked stays closed.
export const autoOpenDayPrompt = ({ phase, running, hasLock, scheduled, dayKey, promptSeen, open, signedIn, lockIn, today }) => {
  if (!signedIn || !lockIn || !today || open) return false;
  if (closeDayPrompt({ phase, running }) || hasLock || scheduled || phase !== 'ready') return false;
  if (!dayKey || promptSeen === dayKey) return false;
  return true;
};
