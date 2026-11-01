// Wake-up auto-lock (B44). users/{uid}.wakeAutoLock === true (Settings > Lock-in > "Lock at wake-up", needs Lock-in on).
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
export const wakeLockPlan = ({ enabled, lockInEnabled, native, authorized, selectionCount, wakeTime, hours, wakeMs, blocks = [] }) => {
  const note = wakeLockNote({ native, authorized, selectionCount, wakeTime });
  if (!enabled || !lockInEnabled || note) return { action: 'cancel', note: enabled && lockInEnabled ? note : null };
  const hm = parseHM(wakeTime); let minutes = wakeLockMinutes(hours);
  if (Number.isFinite(wakeMs)) {
    const end = wakeMs + minutes * 60000;
    const clash = (blocks || []).filter((b) => b && b.startMs < end && b.endMs > wakeMs).map((b) => b.startMs).sort((a, b) => a - b)[0];
    if (clash != null) minutes = Math.floor((clash - wakeMs) / 60000);
  }
  if (minutes < MIN_MINUTES) return { action: 'cancel', note: 'An evening lock-in starts right after wake-up, so the wake-up lock is off today.' };
  return { action: 'schedule', hour: hm.hour, minute: hm.minute, minutes, note: null };
};

// On app open: create the server lock for a wake-up lock that already started (start = wake time). Only in the 'ready' phase
// (wake time passed, no lock yet), lock-in on and not skipped today, and while today's window is still open.
export const shouldReconcileWake = ({ enabled, lockInToday, phase, hasLock, wakeMs, nowMs, hours }) =>
  !!enabled && !!lockInToday && phase === 'ready' && !hasLock && Number.isFinite(wakeMs) && nowMs >= wakeMs && nowMs < wakeMs + wakeLockMinutes(hours) * 60000;
