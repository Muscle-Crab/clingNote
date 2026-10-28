// JS side of the local iOS plugins ClingLock (Screen Time app lock) and ClingNative (calendar, geofence, Live Activity, Siri queue).
// Every call is a safe no-op on web / when the plugin is missing.
import { Capacitor, registerPlugin } from '@capacitor/core';
const avail = (n) => { try { return Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable(n); } catch (e) { return false; } };
const Lock = registerPlugin('ClingLock'); const Native = registerPlugin('ClingNative');
const safe = (name, plugin, fn, fallback) => async (...a) => { if (!avail(name)) return fallback; try { return await fn(plugin, ...a); } catch (e) { return { ...(typeof fallback === 'object' ? fallback : {}), error: String((e && e.message) || e) }; } };
export const lockAvailable = () => avail('ClingLock');
export const clingLock = {
  requestAuthorization: safe('ClingLock', Lock, (p) => p.requestAuthorization(), { status: 'unsupported' }),
  status: safe('ClingLock', Lock, (p) => p.status(), { authorization: 'unsupported', locked: false, selectionCount: 0 }),
  pickApps: safe('ClingLock', Lock, (p) => p.pickApps(), { saved: false }),
  startLock: safe('ClingLock', Lock, (p, untilMs, label = '') => p.startLock({ untilMs, label }), { locked: false }),
  stopLock: safe('ClingLock', Lock, (p) => p.stopLock(), { locked: false }),
};
export const nativeAvailable = () => avail('ClingNative');
export const clingNative = {
  calendarAccess: safe('ClingNative', Native, (p) => p.calendarAccess(), { granted: false }),
  busy: safe('ClingNative', Native, (p, fromMs, toMs) => p.busy({ fromMs, toMs }), { busy: [] }),
  addEvent: safe('ClingNative', Native, (p, ev) => p.addEvent(ev), { id: '' }),
  currentLocation: safe('ClingNative', Native, (p) => p.currentLocation(), null),
  addGeofence: safe('ClingNative', Native, (p, g) => p.addGeofence(g), { id: '' }),
  removeGeofence: safe('ClingNative', Native, (p, id) => p.removeGeofence({ id }), {}),
  startFocusActivity: safe('ClingNative', Native, (p, title, endsAtMs) => p.startFocusActivity({ title, endsAtMs }), { started: false }),
  endFocusActivity: safe('ClingNative', Native, (p) => p.endFocusActivity(), {}),
  takeIntents: safe('ClingNative', Native, (p) => p.takeIntents(), { items: [] }),
  // Two-way calendar sync (utils/calendarSync.js): one dedicated "ClingNote" calendar; events carry url clingnote://task/<key>.
  calSyncEnsure: safe('ClingNative', Native, (p, calendarId = '') => p.calSyncEnsure({ calendarId }), { calendarId: '' }),
  calSyncList: safe('ClingNative', Native, (p, calendarId, fromMs, toMs) => p.calSyncList({ calendarId, fromMs, toMs }), { events: [] }),
  calSyncUpsert: safe('ClingNative', Native, (p, ev) => p.calSyncUpsert(ev), { id: '' }),
  calSyncRemove: safe('ClingNative', Native, (p, id) => p.calSyncRemove({ id }), {}),
  // Siri "Start timer" queue (ClingIntents.StartTimerIntent), drained once like takeIntents.
  takeTimerIntents: safe('ClingNative', Native, (p) => p.takeTimerIntents(), { items: [] }),
  // Text size: WKWebView.pageZoom (whole-page zoom with reflow, like Safari's aA menu).
  setPageZoom: safe('ClingNative', Native, (p, zoom) => p.setPageZoom({ zoom }), {}),
};
