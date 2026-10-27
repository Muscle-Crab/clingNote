// JS side of the local iOS plugin ClingAlarm (ios/App/App/ClingAlarmPlugin.swift): one-time AlarmKit wake-up alarms (iOS 26+).
// Every call is a safe no-op on web / older app builds without the plugin.
import { Capacitor, registerPlugin } from '@capacitor/core';
const avail = () => { try { return Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('ClingAlarm'); } catch (e) { return false; } };
const Alarm = registerPlugin('ClingAlarm');
const safe = (fn, fallback) => async (...a) => { if (!avail()) return fallback; try { return await fn(...a); } catch (e) { return { ...fallback, error: String((e && e.message) || e) }; } };
export const alarmPluginAvailable = avail;
export const clingAlarm = {
  availability: safe(() => Alarm.availability(), { alarmKit: false, authorization: 'unsupported' }),
  requestAuthorization: safe(() => Alarm.requestAuthorization(), { alarmKit: false, authorization: 'unsupported' }),
  scheduleOnce: safe((o) => Alarm.scheduleOnce(o), { scheduled: false, reason: 'unsupported' }),
  cancel: safe((id) => Alarm.cancel({ id }), {}),
  cancelAll: safe(() => Alarm.cancelAll(), { cancelled: 0 }),
  stop: safe((id) => Alarm.stop({ id }), {}),
  snooze: safe((id) => Alarm.snooze({ id }), {}),
  list: safe(() => Alarm.list(), { alarms: [] }),
};
