// Client state for the 8-hour day. The SERVER decides everything (start, end, locked values); this module only
//  - fetches the state (eight-hour-day function), keeps a server-clock offset so a wrong device clock cannot move the countdown,
//  - derives phase / countdown / "Ends 3:00 PM" locally between fetches,
//  - caches the wake pick made BEFORE sign-up (onboarding) and saves it to the server right after sign-in,
//  - feeds the lock source used by the UI/data-layer guards (utils/eightHourLock.js).
import { reactive, computed, ref } from 'vue';
import { auth } from '@/firebaseConfig';
import { fnUrl } from '@/config/api';
import * as core from '@/utils/eightHour';
import { setLockSource } from '@/utils/eightHourLock';

const st = reactive({ loaded: false, loading: false, error: '', data: null, offset: 0, busy: false });
const tick = ref(Date.now());
let timer = null; let syncTimer = null; let visHooked = false;
const PLAN_KEY = 'clingnote.ehPlan.v1';

export const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };

// ── plan cached on the device before there is an account (written to the server after sign-up / sign-in) ──
export const readCachedPlan = () => { try { const p = JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); return p && core.parseWake(p.wakeTime) ? p : null; } catch (e) { return null; } };
export const cachePlan = (plan) => { try { localStorage.setItem(PLAN_KEY, JSON.stringify({ wakeTime: plan.wakeTime, taskCount: plan.taskCount, tz: plan.tz || deviceTz(), at: Date.now() })); } catch (e) { /* private mode */ } };
export const clearCachedPlan = () => { try { localStorage.removeItem(PLAN_KEY); } catch (e) { /* ignore */ } };

const call = async (action, body = {}) => {
  const u = auth.currentUser; if (!u) throw Object.assign(new Error('Not signed in'), { status: 401 });
  const r = await fetch(fnUrl('eight-hour-day'), { method: 'POST', headers: { Authorization: `Bearer ${await u.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
  const ct = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
  // A missing function (not deployed) comes back as Netlify's SPA index.html (GET) or "Bad request, missing form" (POST): not JSON.
  if (!/json/i.test(ct)) throw Object.assign(new Error('8-hour day service is unavailable'), { status: r.status, unavailable: true });
  const data = await r.json().catch(() => ({}));
  if (r.status === 404) throw Object.assign(new Error(data.error || '8-hour day service is unavailable'), { status: 404, unavailable: true });
  if (!r.ok) throw Object.assign(new Error(data.error || `Request failed (${r.status})`), { status: r.status, code: data.code });
  return data;
};
// Local fallback when the server function is unreachable/not deployed: plan only (from the device cache), never a lock
// (locks are server-authoritative), so the card can still show the plan / setup instead of a dead "Retry".
const isUnavailable = (e) => !!(e && (e.unavailable || e.name === 'TypeError' || /load failed|failed to fetch|network/i.test(e.message || '')));
const localState = (plan) => ({ now: Date.now(), plan: plan ? { wakeTime: plan.wakeTime, taskCount: plan.taskCount, tz: plan.tz || deviceTz() } : null, lock: null, stats: core.defaultStats(), offline: true });
// Last started day, cached on the device so the hard stop survives a reload / app restart even when the server is unreachable.
const LAST_LOCK_KEY = 'clingnote.ehLastLock.v1';
export const readLastLock = () => { try { const l = JSON.parse(localStorage.getItem(LAST_LOCK_KEY) || 'null'); return l && Number.isFinite(l.endMs) && l.dayKey ? l : null; } catch (e) { return null; } };
const cacheLock = (l) => { try { if (l && Number.isFinite(l.endMs)) localStorage.setItem(LAST_LOCK_KEY, JSON.stringify({ dayKey: l.dayKey, dayName: l.dayName, startMs: l.startMs, endMs: l.endMs, wakeTime: l.wakeTime, tz: l.tz, earned: l.earned || 0, target: l.target || 0, done: l.done || 0, taskCount: l.taskCount || 0, totalPoints: l.totalPoints || 0 })); } catch (e) { /* private mode */ } };
// The lock that decides the hard stop: the server's, else (offline / not loaded yet) the cached one. Never invents a lock.
export const shutLock = () => (st.data && st.data.lock) || readLastLock();
const apply = (d) => { if (d && d.lock) cacheLock(d.lock); st.data = d; st.offset = d.now - Date.now(); st.loaded = true; st.error = ''; tick.value = Date.now() + st.offset; };

export const nowMs = () => Date.now() + st.offset; // server time (offset measured at the last fetch)

const ensureTimers = () => {
  if (!timer) timer = setInterval(() => { tick.value = nowMs(); }, 1000);
  if (!syncTimer) syncTimer = setInterval(() => { if (auth.currentUser) refresh().catch(() => {}); }, 5 * 60 * 1000);
  if (!visHooked && typeof document !== 'undefined') { visHooked = true; document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && auth.currentUser) refresh().catch(() => {}); }); }
};

export const refresh = async () => {
  if (st.loading) return st.data;
  st.loading = true;
  try { apply(await call('state')); } catch (e) {
    if (isUnavailable(e) && e.status !== 401) { apply(localState(readCachedPlan())); st.error = e.message || 'Offline'; }
    else st.error = e.message || 'Could not load your 8-hour day';
  } finally { st.loading = false; }
  ensureTimers();
  return st.data;
};

export const savePlan = async ({ wakeTime, taskCount }) => {
  st.busy = true;
  const tz = st.data?.plan?.tz || deviceTz();
  try { const d = await call('plan', { wakeTime, taskCount, tz }); apply(d); clearCachedPlan(); return d; }
  catch (e) { if (!isUnavailable(e)) throw e; cachePlan({ wakeTime, taskCount, tz }); const d = localState(readCachedPlan()); apply(d); st.error = e.message; return d; } // synced on next successful refresh
  finally { st.busy = false; }
};
export const startNow = async () => { st.busy = true; try { const d = await call('start'); apply(d); return d; } finally { st.busy = false; } };
export const reportProgress = async () => { try { apply(await call('progress')); } catch (e) { /* server recounts at the end of the window anyway */ } };

// After sign-up / sign-in: fetch the server state and, if the account has no plan yet, save the wake time picked in onboarding.
// An existing plan on the server always wins (a second install must not overwrite a locked plan).
export const syncAfterAuth = async () => {
  await refresh();
  const cached = readCachedPlan();
  if (cached && st.loaded && !st.data?.plan) { try { await savePlan(cached); } catch (e) { st.error = e.message; return false; } }
  else if (cached && st.data?.plan && !st.data.offline) clearCachedPlan();
  return true;
};

export const useEightHour = () => {
  ensureTimers();
  const data = computed(() => st.data);
  const plan = computed(() => st.data?.plan || null);
  const lockRaw = computed(() => st.data?.lock || null);
  const phaseInfo = computed(() => {
    if (!st.data) return { phase: 'loading' };
    const lk = lockRaw.value && { startMs: lockRaw.value.startMs, endMs: lockRaw.value.endMs, dayKey: lockRaw.value.dayKey };
    return core.evaluatePhase({ wakeTime: plan.value?.wakeTime, tz: plan.value?.tz, nowMs: (tick.value, nowMs()), lock: lk });
  });
  const phase = computed(() => phaseInfo.value.phase);
  const running = computed(() => phase.value === 'running');
  const lock = computed(() => (lockRaw.value && lockRaw.value.dayKey === phaseInfo.value.dayKey ? lockRaw.value : null));
  const remainingMs = computed(() => (running.value ? Math.max(0, phaseInfo.value.endMs - (tick.value, nowMs())) : 0));
  const countdown = computed(() => core.fmtCountdown(remainingMs.value));
  // "Ends 3:00 PM": real end while running/ended; otherwise wake time + 8h (what it will be if the countdown starts at the wake time)
  const endsLabel = computed(() => {
    const tz = plan.value?.tz || deviceTz();
    if (lock.value && (running.value || phase.value === 'ended')) return core.fmtClock(lock.value.endMs, tz);
    if (phaseInfo.value.phase === 'before' || phaseInfo.value.phase === 'ready') return core.fmtClock((phaseInfo.value.startMs || phaseInfo.value.wakeMs) + core.WINDOW_MS, tz);
    return '';
  });
  // "7:00 AM": the real (locked) start while running/ended; otherwise the planned wake time
  const startsLabel = computed(() => {
    const tz = plan.value?.tz || deviceTz();
    if (lock.value && (running.value || phase.value === 'ended')) return core.fmtClock(lock.value.startMs, tz);
    return plan.value ? core.fmtWakeLabel(plan.value.wakeTime) : '';
  });
  const stats = computed(() => st.data?.stats || core.defaultStats());
  // Hard stop: today's started day has ended -> shut until the next wake time (survives reload via the cached lock).
  const shutdown = computed(() => {
    const l = shutLock(); const now = (tick.value, nowMs());
    if (!l || !core.isShut(l, now)) return null;
    const until = core.shutUntilMs(l);
    return { untilMs: until, untilLabel: core.fmtClock(until, l.tz || deviceTz()), earned: l.earned || 0, target: l.target || 0, done: l.done || 0, total: l.taskCount || 0, met: (l.target || 0) > 0 && (l.earned || 0) >= l.target };
  });
  return { st, data, plan, lock, phase, phaseInfo, running, remainingMs, countdown, endsLabel, startsLabel, stats, shutdown, reward: computed(() => st.data?.reward || ''),
    refresh, savePlan, startNow, reportProgress, nowMs };
};

// UI/data-layer guards read the lock through this source (server-clock based, so changing the device clock does not unlock anything in the UI;
// the Firestore rules compare against request.time regardless).
setLockSource(() => { const l = shutLock(); return l ? { lock: l, nowMs: nowMs() } : null; });
