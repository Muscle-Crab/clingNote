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
  // Not wrapped in safe(): a schedule failure must reach the caller. Resolves { locked, monitor: 'ok' | 'failed: ...' }.
  startLock: async (untilMs, label = '') => {
    if (!avail('ClingLock')) return { locked: false, monitor: 'unavailable' };
    try { const r = await Lock.startLock({ untilMs, label }); if (r && r.monitor && r.monitor !== 'ok') console.warn('[clingLock] schedule failed', r.monitor); return { monitor: 'ok', ...r }; }
    catch (e) { const m = `failed: ${String((e && e.message) || e)}`; console.warn('[clingLock] startLock', m); return { locked: false, monitor: m }; }
  },
  stopLock: safe('ClingLock', Lock, (p) => p.stopLock(), { locked: false }),
  // Evening mode: a later lock-in block as its own DeviceActivity schedule (clingLockAt.<key>), so iOS raises the shield at startMs
  // even if ClingNote is closed. Resolves { monitor: 'ok' | 'failed: ...' | 'unavailable' }.
  scheduleLock: async ({ startMs, untilMs, key }) => {
    if (!avail('ClingLock')) return { monitor: 'unavailable' };
    try { const r = await Lock.scheduleLock({ startMs, untilMs, key: String(key) }); return { monitor: 'ok', ...r }; }
    catch (e) { return { monitor: `failed: ${String((e && e.message) || e)}` }; }
  },
  // per-app locks by user-confirmed label (src/utils/appLockNames.js resolves spoken names to these labels)
  labeledApps: safe('ClingLock', Lock, (p) => p.labeledApps(), { apps: [] }),
  pickNamedApps: safe('ClingLock', Lock, (p, suggest = []) => p.pickNamedApps({ suggest }), { saved: false, apps: [] }),
  lockApps: safe('ClingLock', Lock, (p, labels, untilMs = 0) => p.lockApps({ labels, untilMs }), { locked: [] }),
  unlockApps: safe('ClingLock', Lock, (p, labels = []) => p.unlockApps({ labels }), { unlocked: [] }),
  // per-task app unlock (src/utils/taskAppUnlock.js): pick apps a task needs; allow them while its timer runs; end re-locks
  pickTaskApps: safe('ClingLock', Lock, (p, taskId) => p.pickTaskApps({ taskId }), { saved: false, count: 0 }),
  taskApps: safe('ClingLock', Lock, (p, taskId = '') => p.taskApps({ taskId }), { count: 0, active: null }),
  allowTaskApps: safe('ClingLock', Lock, (p, taskId, untilMs) => p.allowTaskApps({ taskId, untilMs }), { allowed: 0 }),
  endTaskApps: safe('ClingLock', Lock, (p, taskId) => p.endTaskApps(taskId ? { taskId } : {}), { ended: false }),
  // Lock-end alert level: off | subtle | standard | loud (default) | maximum. Omit level to read.
  setLockEndAlert: safe('ClingLock', Lock, (p, level) => p.setLockEndAlert(level ? { level } : {}), { level: 'loud' }),
};
export const nativeAvailable = () => avail('ClingNative');
export const clingNative = {
  calendarAccess: safe('ClingNative', Native, (p) => p.calendarAccess(), { granted: false }),
  busy: safe('ClingNative', Native, (p, fromMs, toMs) => p.busy({ fromMs, toMs }), { busy: [] }),
  addEvent: safe('ClingNative', Native, (p, ev) => p.addEvent(ev), { id: '' }),
  currentLocation: safe('ClingNative', Native, (p) => p.currentLocation(), null),
  addGeofence: safe('ClingNative', Native, (p, g) => p.addGeofence(g), { id: '' }),
  removeGeofence: safe('ClingNative', Native, (p, id) => p.removeGeofence({ id }), {}),
  // Lock-screen focus Live Activity. state: src/utils/focusActions.js focusActivityState() (+ notifId of the timer notification).
  startFocusActivity: safe('ClingNative', Native, (p, title, endsAtMs, state = {}) => p.startFocusActivity({ ...state, title, endsAtMs }), { started: false }),
  updateFocusActivity: safe('ClingNative', Native, (p, state) => p.updateFocusActivity(state), { updated: 0 }),
  endFocusActivity: safe('ClingNative', Native, (p) => p.endFocusActivity(), {}),
  // Pause/Resume/Done taps on the Live Activity (FocusIntents.swift), read then acked by id after reconcile (no loss on a crash mid-apply).
  getFocusActions: safe('ClingNative', Native, (p) => p.getFocusActions(), { items: [] }),
  ackFocusActions: safe('ClingNative', Native, (p, ids) => p.ackFocusActions({ ids }), {}),
  getFocusFilter: safe('ClingNative', Native, (p) => p.getFocusFilter(), { items: [] }), // iOS Focus filter on/off events (ClingFocusFilter)
  ackFocusFilter: safe('ClingNative', Native, (p, ids) => p.ackFocusFilter({ ids }), {}),
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
