// Earned breaks on iOS (mirror of BreakState in ios/App/Shared/LockShared.swift and ClingBreakNotify in ClingLockPlugin.swift).
// A break lifts EVERY ClingNote shield (lock-in + per-app locks) for exactly its length WITHOUT changing the lock state; the
// DeviceActivity "clingBreak" schedule ends at the break end and ClingLockMonitor.intervalDidEnd re-applies the same shields, so
// the re-lock happens with the app closed. Pure helpers here; HomeView wires them.

// While a native break is live the app must not stop or restart the lock (stopping would erase what the monitor restores).
export const holdLockAction = (b, nowMs = Date.now()) => !!(b && b.native === 'break' && Number(b.endMs) > nowMs && !b.relocked);

// Breaks started from the notification's background "Take break" action while the app was closed: book them once on the next
// open (used minutes + history). taken: [{ at, min, until, points }] drained from native.
export const applyTaken = (b, taken, dayKey, ymdOf) => {
  let cur = { ...b }; const log = [];
  for (const t of Array.isArray(taken) ? taken : []) {
    const at = Number(t && t.at) || 0; const min = Math.round(Number(t && t.min) || 0); if (!(at > 0 && min > 0)) continue;
    log.push({ at, min, points: Math.round(Number(t.points) || 0) });
    if (ymdOf(at) !== dayKey) continue;
    cur = { ...cur, day: dayKey, used: (Number(cur.used) || 0) + min, startMs: at, endMs: Number(t.until) || at + min * 60000, native: 'break', relocked: false, prior: null };
  }
  return { b: cur, log };
};

// Points alert: once per tier per day (localStorage value { day, n }). Returns the tier to announce now, or 0.
export const alertTier = (stored, dayKey, tier) => { const n = stored && stored.day === dayKey ? Number(stored.n) || 0 : 0; return tier > n ? tier : 0; };

// When the day-end recap fires: the earlier of the hard close and the end of the last chosen session (if it is already known).
// The last session may end after the hard close (an evening session runs until the next day start): the recap waits for it.
export const recapAt = ({ closeMs, lastSessionEndMs = 0 }) => (lastSessionEndMs > 0 ? lastSessionEndMs : closeMs);
