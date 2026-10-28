// Custom notification sounds: short robot-coach clips (ElevenLabs "Chris", same voice as the in-app robot) bundled in
// the iOS App target as ios/App/App/cn_*.caf (linear PCM, <= 3 s; iOS needs < 30 s). Shared by local notifications
// (utils/localNotify.js -> LocalNotifications `sound`) and server pushes (netlify/functions -> OneSignal `ios_sound`).
// Mute: the robot-voice toggle (useVoiceover, localStorage 'clingnote.voMuted.v1'; mirrored to userSettings/{uid}.notifVoice
// for the server). Muted -> no custom sound, so iOS plays its default alert sound. Alerts themselves are not suppressed.
export const NOTIF_SOUNDS = Object.freeze({ task: 'cn_task.caf', morning: 'cn_morning.caf', evening: 'cn_evening.caf' });
export const VOICE_MUTE_KEY = 'clingnote.voMuted.v1';

const MORNING = new Set(['morning', 'briefing', 'report', 'daily-report']);
const EVENING = new Set(['evening', 'recap', 'dayend', 'rollover']);
const DEFAULT_ONLY = new Set(['community']); // the clips do not fit these: keep the iOS default sound

// Which clip a notification gets: 'task' | 'morning' | 'evening' | null (iOS default). type wins, then the key prefix.
export const soundKind = (type, key) => {
  const t = String(type || String(key || '').split(':')[0] || '').toLowerCase();
  if (DEFAULT_ONLY.has(t)) return null;
  if (MORNING.has(t)) return 'morning';
  if (EVENING.has(t)) return 'evening';
  return 'task'; // reminder, rem, time, sched, scheduled, repeat, timer, mgr, ...
};

// File name for the `sound` field, or undefined (= iOS default) when the robot voice is muted or the type has no clip.
export const notifSound = (type, key, { muted = false } = {}) => {
  if (muted) return undefined;
  const k = soundKind(type, key);
  return k ? NOTIF_SOUNDS[k] : undefined;
};

export const voiceMutedNow = (store = (typeof window !== 'undefined' ? window.localStorage : null)) => {
  try { return !!store && store.getItem(VOICE_MUTE_KEY) === '1'; } catch (e) { return false; }
};
