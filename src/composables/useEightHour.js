// Client state for the 8-hour day. The SERVER decides everything (start, end, locked values); this module only
//  - fetches the state (eight-hour-day function), keeps a server-clock offset so a wrong device clock cannot move the countdown,
//  - derives phase / countdown / "Ends 3:00 PM" locally between fetches,
//  - caches the wake pick made BEFORE sign-up (onboarding) and saves it to the server right after sign-in,
//  - feeds the lock source used by the UI/data-layer guards (utils/eightHourLock.js).
import { reactive, computed, ref } from 'vue';
import { auth, db } from '@/firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { fnUrl } from '@/config/api';
import * as core from '@/utils/eightHour';
import { setLockSource } from '@/utils/eightHourLock';
import { readLock, writeLock, lockFor } from '@/utils/ehLockCache';
import { onAuthStateChanged } from 'firebase/auth';

const st = reactive({ uid: null, loaded: false, loading: false, error: '', data: null, offset: 0, busy: false });
const tick = ref(Date.now());
let timer = null; let syncTimer = null; let visHooked = false;
const PLAN_KEY = 'clingnote.ehPlan.v1';
const HOURS_KEY = 'clingnote.dayLengthHours.v1';
const PROMPT_KEY = 'clingnote.dayPromptSeen.v1';

// ── day length preference (3..12h, 0.5 steps, default 8): users/{uid}.dayLengthHours, localStorage fallback ──
const hoursPref = ref(core.clampHours((() => { try { return localStorage.getItem(HOURS_KEY); } catch (e) { return null; } })()));
export const dayLengthHours = () => hoursPref.value;
export const setDayLengthHours = async (h) => {
  const v = core.clampHours(h); hoursPref.value = v;
  try { localStorage.setItem(HOURS_KEY, String(v)); } catch (e) { /* ignore */ }
  const u = auth.currentUser;
  if (u) { try { await setDoc(doc(db, 'users', u.uid), { dayLengthHours: v }, { merge: true }); } catch (e) { /* offline: local value is used */ } }
  return v;
};
export const loadDayLengthHours = async () => {
  const u = auth.currentUser; if (!u) return hoursPref.value;
  try { const s = await getDoc(doc(db, 'users', u.uid)); const v = s.exists() && s.data().dayLengthHours; if (v != null) { hoursPref.value = core.clampHours(v); try { localStorage.setItem(HOURS_KEY, String(hoursPref.value)); } catch (e) { /* ignore */ } } } catch (e) { /* ignore */ }
  return hoursPref.value;
};
// Morning prompt bookkeeping: shown once per day key until the day is confirmed.
export const promptSeenFor = () => { try { return localStorage.getItem(PROMPT_KEY) || ''; } catch (e) { return ''; } };
export const markPromptSeen = (dayKey) => { try { localStorage.setItem(PROMPT_KEY, dayKey || ''); } catch (e) { /* ignore */ } };

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
const localState = (plan) => ({ now: Date.now(), plan: plan ? { wakeTime: plan.wakeTime, taskCount: plan.taskCount, tz: plan.tz || deviceTz() } : null, lock: localLockToday(plan), stats: core.defaultStats(), offline: true });
// Last started day, cached on the device so the hard stop survives a reload / app restart even when the server is unreachable.
const curUid = () => (auth.currentUser && auth.currentUser.uid) || null;
// Account switch / sign-out: drop the previous account's in-memory day so its lock can never shut the new account.
try { onAuthStateChanged(auth, (u) => { const id = u ? u.uid : null; if (id !== st.uid) { st.uid = id; st.data = null; st.loaded = false; st.error = ''; } }); } catch (e) { /* ignore */ }
// Offline: a day confirmed on THIS device (startNow with the function unreachable) is kept locally so countdown/shutdown still work.
const localLockToday = (plan) => { const l = readLastLock(); if (!l || !l.local) return null; const tz = (plan && plan.tz) || l.tz || deviceTz(); return l.dayKey === core.dayKeyIn(tz, Date.now()) ? l : null; };
export const readLastLock = () => readLock(curUid());
const cacheLock = (l) => writeLock(curUid(), l);
// The lock that decides the hard stop: the server's, else (offline / not loaded yet) the cached one. Never invents a lock.
export const shutLock = () => lockFor(st.data, st.uid, curUid()) || readLastLock();
const apply = (d) => { if (d && d.lock) cacheLock(d.lock); st.uid = curUid(); st.data = d; st.offset = d.now - Date.now(); st.loaded = true; st.error = ''; tick.value = Date.now() + st.offset; };

export const nowMs = () => Date.now() + st.offset; // server time (offset measured at the last fetch)

// Evening mode: when a scheduled block's start passes, ask the server once (it starts the block at its fixed time).
let dueFor = '';
const dueCheck = () => {
  const l = shutLock(); const b = l && core.nextPending(l, nowMs());
  if (!b || nowMs() < b.startMs || !auth.currentUser) return;
  const k = core.sessionKey(b.dayKey, b.index); if (dueFor === k) return;
  dueFor = k; refresh().catch(() => {});
};
const ensureTimers = () => {
  if (!timer) timer = setInterval(() => { tick.value = nowMs(); dueCheck(); }, 1000);
  if (!syncTimer) syncTimer = setInterval(() => { if (auth.currentUser) refresh().catch(() => {}); }, 5 * 60 * 1000);
  if (!visHooked && typeof document !== 'undefined') { visHooked = true; document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && auth.currentUser) refresh().catch(() => {}); }); }
};

export const refresh = async () => {
  if (st.loading) return st.data;
  st.loading = true; const me = curUid();
  try { const d = await call('state'); if (curUid() === me) apply(d); } catch (e) {
    if (isUnavailable(e) && e.status !== 401) { apply(localState(readCachedPlan())); st.error = e.message || 'Offline'; }
    else st.error = e.message || 'Could not load your day';
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
// Starts the day NOW for `hours` (only called from the morning Confirm). End = confirm time + hours; frozen for the day.
export const startNow = async (hours, blocks) => {
  const h = core.clampHours(hours == null ? hoursPref.value : hours);
  st.busy = true;
  try { const d = await call('start', { hours: h, ...(Array.isArray(blocks) && blocks.length ? { blocks } : {}) }); apply(d); return d; }
  catch (e) {
    if (!isUnavailable(e) || e.status === 401) throw e;
    const plan = st.data?.plan || readCachedPlan(); const tz = plan?.tz || deviceTz(); const now = nowMs();
    const prev = localLockToday(plan); if (prev) return st.data; // already confirmed today: frozen
    const lock = { dayKey: core.dayKeyIn(tz, now), dayName: core.dayNameIn ? core.dayNameIn(tz, now) : '', startMs: now, endMs: now + core.hoursMs(h), hours: h, wakeTime: plan?.wakeTime, tz, local: true };
    cacheLock(lock); const d = { ...localState(plan), now }; d.lock = lock; apply(d); st.error = e.message; return d;
  } finally { st.busy = false; }
};
// Evening mode: fix later lock-in block(s) [{ time: 'HH:MM', hours }]. Server-only (no offline fallback: a schedule must be server-checked).
export const scheduleNext = async (blocks) => { st.busy = true; try { const d = await call('schedule', { blocks }); apply(d); return d; } finally { st.busy = false; } };
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
  const lockRaw = computed(() => lockFor(st.data, st.uid, curUid()) || (st.data?.offline ? st.data.lock : null));
  const phaseInfo = computed(() => {
    if (!st.data) return { phase: 'loading' };
    const lk = lockRaw.value && { startMs: lockRaw.value.startMs, endMs: lockRaw.value.endMs, dayKey: lockRaw.value.dayKey, index: lockRaw.value.index, pending: lockRaw.value.pending };
    return core.evaluatePhase({ wakeTime: plan.value?.wakeTime, tz: plan.value?.tz, nowMs: (tick.value, nowMs()), lock: lk, hours: hoursPref.value });
  });
  const phase = computed(() => phaseInfo.value.phase);
  const running = computed(() => phase.value === 'running');
  const lock = computed(() => (lockRaw.value && lockRaw.value.dayKey === phaseInfo.value.dayKey ? lockRaw.value : null));
  const remainingMs = computed(() => ((running.value || (phase.value === 'ready' && core.START_MODE === 'wake' && phaseInfo.value.endMs)) ? Math.max(0, phaseInfo.value.endMs - (tick.value, nowMs())) : 0));
  const countdown = computed(() => core.fmtCountdown(remainingMs.value));
  // "Ends 3:00 PM": real end while running/ended; otherwise now + the chosen hours (what it will be if you confirm now)
  const endsLabel = computed(() => {
    const tz = plan.value?.tz || deviceTz();
    if (lock.value && (running.value || phase.value === 'ended')) return core.fmtClock(lock.value.endMs, tz);
    if (phaseInfo.value.phase === 'before' || phaseInfo.value.phase === 'ready') return core.fmtClock((phaseInfo.value.startMs || phaseInfo.value.wakeMs) + core.hoursMs(hoursPref.value), tz);
    return '';
  });
  // "7:00 AM": the real (locked) start while running/ended; otherwise the planned wake time
  const startsLabel = computed(() => {
    const tz = plan.value?.tz || deviceTz();
    if (lock.value && (running.value || phase.value === 'ended')) return core.fmtClock(lock.value.startMs, tz);
    return plan.value ? core.fmtWakeLabel(plan.value.wakeTime) : '';
  });
  // Hours of TODAY's day: the confirmed (locked) value, else the preference.
  const dayHours = computed(() => core.clampHours(lock.value && lock.value.hours != null ? lock.value.hours : hoursPref.value));
  // 15 / 5 / 0: in-app end-of-day warning currently due
  const warning = computed(() => (running.value && lock.value ? core.warningDue(lock.value.endMs, (tick.value, nowMs())) : 0));
  const stats = computed(() => st.data?.stats || core.defaultStats());
  // Hard stop: today's started day has ended -> shut until the next wake time (survives reload via the cached lock).
  const shutdown = computed(() => {
    const l = shutLock(); const now = (tick.value, nowMs());
    if (!l || !core.isShut(l, now)) return null;
    const lastEnd = Math.max(l.endMs, ...core.pendingOf(l).map((b) => b.endMs));
    const until = core.shutUntilMs({ ...l, endMs: lastEnd });
    return { untilMs: until, untilLabel: core.fmtClock(until, l.tz || deviceTz()), earned: l.earned || 0, target: l.target || 0, done: l.done || 0, total: l.taskCount || 0, met: (l.target || 0) > 0 && (l.earned || 0) >= l.target };
  });
  // Next scheduled block (evening mode), shown as "Next 6:00 PM" while the app is open in the gap.
  const nextBlock = computed(() => {
    const l = lockRaw.value; const b = l && core.nextPending(l, (tick.value, nowMs())); if (!b) return null;
    const tz = plan.value?.tz || l.tz || deviceTz();
    return { ...b, startLabel: core.fmtClock(b.startMs, tz), endLabel: core.fmtClock(b.endMs, tz) };
  });
  const pendingBlocks = computed(() => core.pendingOf(lockRaw.value).filter((b) => b.endMs > (tick.value, nowMs())));
  return { st, dayHours, nextBlock, pendingBlocks, scheduleNext, warning, hoursPref, data, plan, lock, phase, phaseInfo, running, remainingMs, countdown, endsLabel, startsLabel, stats, shutdown, reward: computed(() => st.data?.reward || ''),
    refresh, savePlan, startNow, reportProgress, nowMs };
};

// UI/data-layer guards read the lock through this source (server-clock based, so changing the device clock does not unlock anything in the UI;
// the Firestore rules compare against request.time regardless).
setLockSource(() => { const l = shutLock(); return l ? { lock: l, nowMs: nowMs() } : null; });
