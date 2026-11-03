// Wake-up auto-lock (B44) - REMOVED, see wakeLockPlan below. Kept for reference: users/{uid}.wakeAutoLock === true (Settings > Lock-in > "Lock at wake-up", needs Lock-in on).
// Native: ONE daily repeating DeviceActivity at the plan wake time for the day length (ClingLock.scheduleWakeLock; monitor extension
// raises the shield + posts "Your lock-in started" even when ClingNote is closed). Server: on the next app open the day's lock is
// created with start = the scheduled wake time (eight-hour-day start { autoWake: true }), so streak / anti-cheat see one window.
// Pure helpers, no I/O (scripts/test-b44-wake-lock.mjs).
export const MIN_MINUTES = 15;
const clampH = (h) => { const n = Number(h); if (!Number.isFinite(n)) return 8; return Math.min(12, Math.max(3, Math.round(n * 2) / 2)); };
export const wakeLockMinutes = (hours) => Math.max(MIN_MINUTES, Math.round(clampH(hours) * 60));
export const parseHM = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); if (!m) return null; const hour = +m[1], minute = +m[2]; return hour < 24 && minute < 60 ? { hour, minute } : null; };

// Gentle note for the settings row (null = ready).
export const wakeLockNote = ({ native, authorized, selectionCount, wakeTime }) => {
  if (!native) return 'iPhone app only.';
  if (!authorized) return 'Allow Screen Time for ClingNote first (Lock-in > pick apps).';
  if (!(selectionCount > 0)) return 'Pick the apps to lock first.';
  if (!parseHM(wakeTime)) return 'Set your wake time first.';
  return null;
};

// What the app should hand to iOS. blocks = today's pending evening-mode blocks [{startMs,endMs}], wakeMs = today's wake instant.
// The wake window is trimmed so it ends before the first evening block that would overlap it (no double lock); under 15 min -> cancel.
// REMOVED (sessions start only when the user starts them, never at a clock time): always cancel, so an update also
// removes a wake-up lock an older version scheduled on iOS. The settings row is hidden.
export const wakeLockPlan = () => ({ action: 'cancel', note: null });

// Removed with the wake-up lock: never create a session from the wake time.
export const shouldReconcileWake = () => false;
