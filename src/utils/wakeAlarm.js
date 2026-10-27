// Wake-up alarm: pure logic (no imports -> unit-testable in node). Native side: src/native/clingAlarm.js, state: src/composables/useWakeAlarm.js.
// Design (per account, users/{uid}):
//   wakeAlarmEnabled: bool        global Settings toggle, default OFF. Off = no prompt, no alarm, everything scheduled is cancelled.
//   wakeAlarmTime: 'HH:MM'        last used alarm time (prefills the prompt; editable each time).
//   wakeAlarmPromptTime: 'HH:MM'  when the daily "Want a wake-up alarm?" choice is asked (notification + in-app card).
//   wakeAlarmDays: [0..6]         alarm weekdays the question is asked for (0 = Sunday). Default every day.
//   wakeAlarmChoice: { date, choice: 'yes'|'no', time }  the answer for one alarm date ('YYYY-MM-DD').
// There is NO recurring alarm: only a "yes" schedules a ONE-TIME alarm for that date.
//
// Which morning is the question about? Always the NEXT occurrence of the alarm time after the prompt fires:
//   prompt 21:00, alarm 07:00 -> asks in the evening about TOMORROW (default, matches the evening wrap-up/recap)
//   prompt 06:00, alarm 07:00 -> asks in the morning about TODAY
// To flip the default to a morning prompt change WAKE_PROMPT_MODE below (users can also change the prompt time in Settings).
export const WAKE_PROMPT_MODE = 'evening'; // 'evening' | 'morning'
export const PROMPT_TIME_DEFAULTS = { evening: '21:00', morning: '06:00' };
export const DEFAULT_PROMPT_TIME = PROMPT_TIME_DEFAULTS[WAKE_PROMPT_MODE] || '21:00';
export const DEFAULT_ALARM_TIME = '07:00';
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const SNOOZE_MINUTES = 9;
export const ALARM_SOUND = 'cn_morning.caf'; // Chris robot-coach clip in the app bundle
export const FALLBACK_REPEATS = 5; // iOS < 26: number of time-sensitive notifications, one per minute
export const WAKE_PROMPT_ACTION_TYPE = 'WAKE_PROMPT';
export const WAKE_RING_ACTION_TYPE = 'WAKE_RING';
export const WAKE_ACTIONS = { set: 'wake_set', skip: 'wake_skip', snooze: 'wake_snooze', stop: 'wake_stop' };
export const WAKE_ACTION_TYPES = [
  { id: WAKE_PROMPT_ACTION_TYPE, actions: [{ id: WAKE_ACTIONS.set, title: 'Set alarm', foreground: true }, { id: WAKE_ACTIONS.skip, title: 'Not today' }] },
  { id: WAKE_RING_ACTION_TYPE, actions: [{ id: WAKE_ACTIONS.snooze, title: `Snooze ${SNOOZE_MINUTES} min` }, { id: WAKE_ACTIONS.stop, title: 'Stop', destructive: true }] },
];

const pad = (n) => String(n).padStart(2, '0');
export const isHHMM = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
export const fromMin = (m) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmt12 = (hhmm) => { if (!isHHMM(hhmm)) return ''; const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };

// Default alarm time: the user's day start minus 30 min if known, else 7:00 AM.
export const defaultAlarmTime = (dayStart) => (isHHMM(dayStart) ? fromMin(toMin(dayStart) - 30) : DEFAULT_ALARM_TIME);

export const normalizeWake = (d) => {
  const x = d || {};
  const days = Array.isArray(x.wakeAlarmDays) ? [...new Set(x.wakeAlarmDays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : ALL_DAYS.slice();
  const c = x.wakeAlarmChoice;
  return {
    enabled: x.wakeAlarmEnabled === true,
    time: isHHMM(x.wakeAlarmTime) ? x.wakeAlarmTime : DEFAULT_ALARM_TIME,
    promptTime: isHHMM(x.wakeAlarmPromptTime) ? x.wakeAlarmPromptTime : DEFAULT_PROMPT_TIME,
    days,
    choice: c && typeof c.date === 'string' && (c.choice === 'yes' || c.choice === 'no') ? { date: c.date, choice: c.choice, time: isHHMM(c.time) ? c.time : '' } : null,
  };
};

const at = (base, dayOffset, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, h, m, 0, 0); };

// The prompt instance that belongs to an alarm on `alarmDay` (a Date at the alarm time): the last prompt time strictly before it.
export const promptFor = (alarmAt, promptTime) => { const p = at(alarmAt, 0, promptTime); return p < alarmAt ? p : at(alarmAt, -1, promptTime); };

// What should the user be asked right now? -> { alarmAt: Date, date: 'YYYY-MM-DD', promptAt: Date } or null.
// The question is open from its prompt time until the alarm time, if that weekday is enabled.
export const currentQuestion = (s, now = new Date()) => {
  if (!s || !s.enabled) return null;
  let alarmAt = at(now, 0, s.time);
  if (alarmAt <= now) alarmAt = at(now, 1, s.time);
  const promptAt = promptFor(alarmAt, s.promptTime);
  if (now < promptAt) return null;
  if (!s.days.includes(alarmAt.getDay())) return null;
  return { alarmAt, date: dateKey(alarmAt), promptAt };
};

// Should the in-app "Want a wake-up alarm?" card show? Only while a question is open and not answered yet.
export const shouldShowPrompt = (s, now = new Date()) => { const q = currentQuestion(s, now); return !!q && !(s.choice && s.choice.date === q.date); };

// One-time alarm Date for a chosen time, for the open question's day (if the chosen time already passed today, tomorrow).
export const alarmDateFor = (time, now = new Date()) => { let d = at(now, 0, time); if (d <= now) d = at(now, 1, time); return d; };

// Weekly prompt notifications for the enabled alarm days: [{ weekday (Capacitor 1=Sun..7=Sat), hour, minute, alarmDay }].
export const promptSchedule = (s) => {
  if (!s || !s.enabled) return [];
  const sameDay = toMin(s.promptTime) < toMin(s.time); // morning-style: asked on the alarm day itself
  const [hour, minute] = s.promptTime.split(':').map(Number);
  return s.days.map((d) => ({ alarmDay: d, weekday: ((sameDay ? d : d + 6) % 7) + 1, hour, minute }));
};

// iOS < 26 fallback: times of the burst of time-sensitive notifications (one per minute).
export const fallbackTimes = (alarmAt, n = FALLBACK_REPEATS) => Array.from({ length: n }, (_, i) => new Date(alarmAt.getTime() + i * 60000));

export const promptBody = (time) => `Tap "Set alarm" for ${fmt12(time)}, or open ClingNote to pick another time.`;
