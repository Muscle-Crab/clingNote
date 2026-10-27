// Wake-up alarm state + side effects (per account on users/{uid}; see src/utils/wakeAlarm.js for the rules).
// iOS 26+: one-time AlarmKit alarm (rings through silent mode / Focus). iOS < 26 or AlarmKit denied: a burst of
// time-sensitive local notifications with the cn_morning.caf clip (breaks through Focus, but NOT the silent switch).
import { ref } from 'vue';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeIOS } from '@/utils/platform';
import { loadUserDoc, clearProCache } from '@/composables/usePro';
import { saveUserFields } from '@/utils/userDoc';
import { notifId } from '@/utils/localNotify';
import { clingAlarm } from '@/native/clingAlarm';
import {
  normalizeWake, currentQuestion, alarmDateFor, promptSchedule, fallbackTimes, promptBody, dateKey, isHHMM, fmt12,
  WAKE_ACTION_TYPES, WAKE_PROMPT_ACTION_TYPE, WAKE_RING_ACTION_TYPE, WAKE_ACTIONS, ALARM_SOUND, SNOOZE_MINUTES, FALLBACK_REPEATS,
} from '@/utils/wakeAlarm';

export const wakeSupported = () => isNativeIOS();
export const wake = ref({ loaded: false, uid: null, ...normalizeWake(null), scheduled: null, alarmKit: false }); // alarmKit: real alarm possible (iOS 26+, not denied)

const LS = 'clingnote.wakeAlarm.v1'; // device-local: the one alarm currently set on THIS phone { uid, date, time, atMs, kind, id }
const readDevice = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } };
const writeDevice = (v) => { try { if (v) localStorage.setItem(LS, JSON.stringify(v)); else localStorage.removeItem(LS); } catch (e) { /* ignore */ } };
const promptIds = () => [0, 1, 2, 3, 4, 5, 6].map((d) => ({ id: notifId(`wakeprompt:${d}`) }));
const ringIds = () => Array.from({ length: FALLBACK_REPEATS }, (_, i) => ({ id: notifId(`wakering:${i}`) }));
const lnCancel = async (notifications) => { try { await LocalNotifications.cancel({ notifications }); } catch (e) { /* ignore */ } };

let actionTypesDone = false;
const ensureActionTypes = async () => { if (actionTypesDone) return; try { await LocalNotifications.registerActionTypes({ types: WAKE_ACTION_TYPES }); actionTypesDone = true; } catch (e) { /* ignore */ } };
const notifPermission = async (ask) => {
  try { let p = await LocalNotifications.checkPermissions(); if (ask && (p.display === 'prompt' || p.display === 'prompt-with-rationale')) p = await LocalNotifications.requestPermissions(); return p.display === 'granted'; } catch (e) { return false; }
};

// Permissions for the feature, asked when the user turns it on (Settings switch or onboarding "Yes, turn it on").
export async function requestWakePermissions() {
  if (!wakeSupported()) return { notifications: false, alarmKit: 'unsupported' };
  const notifications = await notifPermission(true);
  const a = await clingAlarm.availability();
  const r = a.alarmKit && a.authorization === 'notDetermined' ? await clingAlarm.requestAuthorization() : a;
  wake.value = { ...wake.value, alarmKit: !!r.alarmKit && r.authorization !== 'denied' };
  return { notifications, alarmKit: r.authorization || 'unsupported' };
}

async function cancelRing() { await lnCancel(ringIds()); }
async function cancelDeviceAlarm() {
  const d = readDevice();
  if (d && d.kind === 'alarmkit' && d.id) await clingAlarm.cancel(d.id);
  await cancelRing(); writeDevice(null); wake.value = { ...wake.value, scheduled: null };
}
// Everything off: prompts, the one-time alarm (AlarmKit + fallback), and any stray AlarmKit alarms of this app.
export async function cancelAllWake() {
  if (!wakeSupported()) return;
  await lnCancel(promptIds()); await cancelDeviceAlarm(); await clingAlarm.cancelAll();
}

async function schedulePrompts(ask = false) {
  await lnCancel(promptIds());
  const s = wake.value; const slots = promptSchedule(s);
  if (!slots.length || !(await notifPermission(ask))) return 0;
  await ensureActionTypes();
  try {
    await LocalNotifications.schedule({ notifications: slots.map((p) => ({
      id: notifId(`wakeprompt:${p.alarmDay}`), title: 'Want a wake-up alarm?', body: promptBody(s.time), actionTypeId: WAKE_PROMPT_ACTION_TYPE,
      extra: { route: '/home', type: 'wakeprompt' }, schedule: { on: { weekday: p.weekday, hour: p.hour, minute: p.minute }, allowWhileIdle: true },
    })) });
    return slots.length;
  } catch (e) { console.warn('wake prompt schedule failed', e); return 0; }
}

// Re-apply device state from the account settings (app start, sign-in, any settings change).
export async function syncWake({ ask = false } = {}) {
  if (!wakeSupported()) return;
  const s = wake.value; const dev = readDevice();
  if (!s.enabled || !s.uid) { await cancelAllWake(); return; }
  if (dev && dev.uid !== s.uid) await cancelDeviceAlarm(); // other account's alarm on this phone
  else if (dev && dev.atMs < Date.now() - 6 * 3600e3) writeDevice(null); // long past
  wake.value = { ...wake.value, scheduled: readDevice() };
  await schedulePrompts(ask);
}

export async function loadWake(uid, force = false) {
  const d = uid ? await loadUserDoc(force).catch(() => null) : null;
  const av = wakeSupported() ? await clingAlarm.availability() : { alarmKit: false };
  wake.value = { loaded: true, uid: uid || null, ...normalizeWake(d), scheduled: readDevice(), alarmKit: !!av.alarmKit && av.authorization !== 'denied' };
  await syncWake();
  return wake.value;
}

const save = async (fields) => { const uid = wake.value.uid; if (!uid) return; await saveUserFields(uid, fields); clearProCache(); };

export async function setWakeEnabled(on) {
  wake.value = { ...wake.value, enabled: !!on };
  await save({ wakeAlarmEnabled: !!on });
  if (on) await requestWakePermissions();
  await syncWake({ ask: !!on });
}
export async function setWakeTime(time) { if (!isHHMM(time)) return; wake.value = { ...wake.value, time }; await save({ wakeAlarmTime: time }); await syncWake(); }
export async function setWakePromptTime(promptTime) { if (!isHHMM(promptTime)) return; wake.value = { ...wake.value, promptTime }; await save({ wakeAlarmPromptTime: promptTime }); await syncWake(); }
export async function setWakeDays(days) { wake.value = { ...wake.value, days: normalizeWake({ wakeAlarmDays: days }).days }; await save({ wakeAlarmDays: wake.value.days }); await syncWake(); }

async function ringFallback(alarmAt) {
  await cancelRing();
  if (!(await notifPermission(true))) return false;
  await ensureActionTypes();
  const ids = ringIds();
  try {
    await LocalNotifications.schedule({ notifications: fallbackTimes(alarmAt).map((t, i) => ({
      id: ids[i].id, title: '⏰ Wake up', body: i ? `Still time to get up · ${fmt12(dateHHMM(alarmAt))}` : `It's ${fmt12(dateHHMM(alarmAt))}. Rise and shine.`,
      sound: ALARM_SOUND, interruptionLevel: 'timeSensitive', actionTypeId: WAKE_RING_ACTION_TYPE,
      extra: { route: '/home', type: 'wakering' }, schedule: { at: t, allowWhileIdle: true },
    })) });
    return true;
  } catch (e) { console.warn('wake fallback schedule failed', e); return false; }
}
const pad = (n) => String(n).padStart(2, '0');
const dateHHMM = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "Yes": schedule ONE one-time alarm at `time` for the open question (or the next occurrence of that time).
export async function acceptWake(time = wake.value.time, now = new Date()) {
  if (!wakeSupported() || !wake.value.enabled || !isHHMM(time)) return { ok: false };
  const alarmAt = alarmDateFor(time, now);
  await cancelDeviceAlarm();
  let kind = 'notif'; let id = '';
  const r = await clingAlarm.scheduleOnce({ atMs: alarmAt.getTime(), title: 'Wake up', snoozeMinutes: SNOOZE_MINUTES, sound: ALARM_SOUND });
  if (r && r.scheduled) { kind = 'alarmkit'; id = r.id; } else if (!(await ringFallback(alarmAt))) return { ok: false, reason: (r && r.reason) || 'denied' };
  const date = dateKey(alarmAt);
  const dev = { uid: wake.value.uid, date, time, atMs: alarmAt.getTime(), kind, id };
  writeDevice(dev);
  wake.value = { ...wake.value, time, choice: { date, choice: 'yes', time }, scheduled: dev };
  await save({ wakeAlarmTime: time, wakeAlarmChoice: { date, choice: 'yes', time } });
  await schedulePrompts(); // prompt text shows the last used time
  return { ok: true, kind, alarmAt };
}
// "Not today": answer the open question with no; nothing is scheduled.
export async function declineWake(now = new Date()) {
  const q = currentQuestion(wake.value, now); if (!q) return;
  wake.value = { ...wake.value, choice: { date: q.date, choice: 'no', time: '' } };
  await save({ wakeAlarmChoice: wake.value.choice });
}
// Undo a "yes" from the in-app card.
export async function cancelWakeAlarm() {
  const d = readDevice(); await cancelDeviceAlarm();
  if (d) { wake.value = { ...wake.value, choice: { date: d.date, choice: 'no', time: '' } }; await save({ wakeAlarmChoice: wake.value.choice }); }
}

// Notification buttons. Returns true when the action belonged to the wake-up alarm.
export async function handleWakeAction(a, now = new Date()) {
  const n = (a && a.notification) || {}; const type = n.actionTypeId || ''; const act = a && a.actionId;
  if (type === WAKE_PROMPT_ACTION_TYPE) {
    if (act === WAKE_ACTIONS.set) await acceptWake(wake.value.time, now);
    else if (act === WAKE_ACTIONS.skip) await declineWake(now);
    return true;
  }
  if (type === WAKE_RING_ACTION_TYPE) {
    await cancelRing(); // any interaction stops the remaining repeats
    if (act === WAKE_ACTIONS.snooze) await ringFallback(new Date(now.getTime() + SNOOZE_MINUTES * 60000));
    else writeDevice(null);
    return true;
  }
  return false;
}

// main.js: load per account on auth changes; notification buttons arrive via onWakeNotificationAction (from notifTap's
// listener, so a cold-start "Set alarm" tap is handled after the account has loaded).
let firstAuth = null; let ready = Promise.resolve();
export function installWakeAlarm({ onAuth }) {
  if (!wakeSupported()) return;
  let first; firstAuth = new Promise((r) => { first = r; }); ready = firstAuth;
  const signedOut = async () => { wake.value = { ...wake.value, loaded: true, uid: null, enabled: false, choice: null }; await cancelAllWake(); };
  onAuth((u) => { const p = (u ? loadWake(u.uid, true) : signedOut()).catch(() => {}); ready = p; p.then(first); });
}
export const onWakeNotificationAction = (a) => (firstAuth || Promise.resolve()).then(() => ready).then(() => handleWakeAction(a));
