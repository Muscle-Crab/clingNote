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
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || `Request failed (${r.status})`), { status: r.status, code: data.code });
  return data;
};
const apply = (d) => { st.data = d; st.offset = d.now - Date.now(); st.loaded = true; st.error = ''; tick.value = Date.now() + st.offset; };

export const nowMs = () => Date.now() + st.offset; // server time (offset measured at the last fetch)

const ensureTimers = () => {
  if (!timer) timer = setInterval(() => { tick.value = nowMs(); }, 1000);
  if (!syncTimer) syncTimer = setInterval(() => { if (auth.currentUser) refresh().catch(() => {}); }, 5 * 60 * 1000);
  if (!visHooked && typeof document !== 'undefined') { visHooked = true; document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && auth.currentUser) refresh().catch(() => {}); }); }
};

export const refresh = async () => {
  if (st.loading) return st.data;
  st.loading = true;
  try { apply(await call('state')); } catch (e) { st.error = e.message || 'Could not load your 8-hour day'; } finally { st.loading = false; }
  ensureTimers();
  return st.data;
};

export const savePlan = async ({ wakeTime, taskCount }) => {
  st.busy = true;
  try { const d = await call('plan', { wakeTime, taskCount, tz: st.data?.plan?.tz || deviceTz() }); apply(d); clearCachedPlan(); return d; } finally { st.busy = false; }
};
export const startNow = async () => { st.busy = true; try { const d = await call('start'); apply(d); return d; } finally { st.busy = false; } };
export const reportProgress = async () => { try { apply(await call('progress')); } catch (e) { /* server recounts at the end of the window anyway */ } };

// After sign-up / sign-in: fetch the server state and, if the account has no plan yet, save the wake time picked in onboarding.
// An existing plan on the server always wins (a second install must not overwrite a locked plan).
export const syncAfterAuth = async () => {
  await refresh();
  const cached = readCachedPlan();
  if (cached && st.loaded && !st.data?.plan) { try { await savePlan(cached); } catch (e) { st.error = e.message; return false; } }
  else if (cached && st.data?.plan) clearCachedPlan();
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
    return core.evaluatePhase({ wakeTime: plan.value?.wakeTime, tz: plan.value?.tz, nowMs: tick.value, lock: lk });
  });
  const phase = computed(() => phaseInfo.value.phase);
  const running = computed(() => phase.value === 'running');
  const lock = computed(() => (lockRaw.value && lockRaw.value.dayKey === phaseInfo.value.dayKey ? lockRaw.value : null));
  const remainingMs = computed(() => (running.value ? Math.max(0, phaseInfo.value.endMs - tick.value) : 0));
  const countdown = computed(() => core.fmtCountdown(remainingMs.value));
  // "Ends 3:00 PM": real end while running/ended; otherwise wake time + 8h (what it will be if the countdown starts at the wake time)
  const endsLabel = computed(() => {
    const tz = plan.value?.tz || deviceTz();
    if (lock.value && (running.value || phase.value === 'ended')) return core.fmtClock(lock.value.endMs, tz);
    if (phaseInfo.value.phase === 'before' || phaseInfo.value.phase === 'ready') return core.fmtClock((phaseInfo.value.startMs || phaseInfo.value.wakeMs) + core.WINDOW_MS, tz);
    return '';
  });
  const stats = computed(() => st.data?.stats || core.defaultStats());
  return { st, data, plan, lock, phase, phaseInfo, running, remainingMs, countdown, endsLabel, stats, reward: computed(() => st.data?.reward || ''),
    refresh, savePlan, startNow, reportProgress, nowMs };
};

// UI/data-layer guards read the lock through this source (server-clock based, so changing the device clock does not unlock anything in the UI;
// the Firestore rules compare against request.time regardless).
setLockSource(() => (st.data && st.data.lock ? { lock: st.data.lock, nowMs: nowMs() } : null));
