// Points vault: the day's points are the only currency (never stats.coins, and the session goal is not reduced).
// A priced app opens when the day's points reach its price. Points are not spent. There is no Buy tap.
// Every 10 points still equals 5 min of shared app time for apps the threshold has opened.
// Pure logic (tests: scripts/test-points-vault.mjs). Native half: VaultAllow / UsageLog in ios/App/Shared/LockShared.swift.
import { matchReport, reportNote } from './usageSnapshot.js';

export const POINTS_PER_SLICE = 10; export const MIN_PER_SLICE = 5;
// Usage buckets (minutes), mirrored by UsageLog.thresholds (clingUsage threshold events). A day's value is the bucket's lower bound.
export const USAGE_THRESHOLDS = [10, 15, 30, 45, 60, 90, 120, 180, 240];
export const AVG_DAYS = 7; export const BASE_PRICE = 30; export const PTS_PER_MIN = 2; export const BOSS_MULT = 1.5; export const PRICE_CAP = 600;
export const NO_DATA_MIN = 60; export const PTS_PER_TASK = 20; // a medium task. NO_DATA_MIN is not a vault price.
export const round5 = (x) => Math.round(x / 5) * 5;
export const bucketMin = (m) => { const v = Number(m) || 0; let b = 0; USAGE_THRESHOLDS.forEach((t) => { if (v >= t) b = t; }); return b; };
// 7-day average of bucket lower bounds before today; null = no data for this app.
export const avgUsage = (days, appId, todayYmd, n = AVG_DAYS) => {
  const keys = Object.keys(days || {}).filter((d) => d < todayYmd).sort().slice(-n);
  if (!keys.some((d) => (days[d] || {})[appId] != null)) return null;
  return keys.reduce((s, d) => s + bucketMin((days[d] || {})[appId]), 0) / keys.length;
};
// round5(30 + 2 × minutes). A negative reading is not a price. Daily averages use this only when the minutes are already per day.
export const priceOf = (min) => {
  const n = Number(min);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(PRICE_CAP, round5(BASE_PRICE + PTS_PER_MIN * n));
};
export const tasksFor = (price) => Math.ceil((Number(price) || 0) / PTS_PER_TASK);
// Today's completion requirement caps every displayed price. 0 means no day target yet, so the formula cap (600) remains.
export const boundPrice = (price, priceCap) => {
  if (price == null) return null;
  const day = Number(priceCap);
  const cap = Number.isFinite(day) && day > 0 ? Math.min(PRICE_CAP, day) : PRICE_CAP;
  return Math.min(price, cap);
};
const periodDaysOf = (report) => {
  const n = Math.round(Number(report && report.period && report.period.days));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
// With a user report, only a unique selected label that matches one report row is priced.
// No period on the report: the price uses the minutes shown, with no division into a day.
// A stated period converts those minutes to a daily average first. Anything else is no reading.
// With no report, a price still comes from the on-device threshold average. No name guess and no 60-minute fill.
// The heaviest priced app (first on a tie) is ×1.5. Unpriced apps sort last and cannot unlock first.
export const priceApps = (apps, days, todayYmd, opts = null) => {
  const report = opts && opts.report;
  const priceCap = opts && opts.priceCap;
  const matched = report ? matchReport(apps, report) : new Map();
  const daysN = periodDaysOf(report);
  const rows = (apps || []).map((a, i) => ({ id: a && a.id != null ? String(a.id) : `ord:${i}`, label: a.label || 'App', ord: i, avg: avgUsage(days, a.id, todayYmd) }));
  rows.forEach((r) => {
    const snap = matched.get(r.id);
    r.thresholdMin = r.avg == null ? null : r.avg;
    r.noReading = false; r.needsPeriod = false;
    if (snap) {
      const observed = Math.max(0, Number(snap.minutes) || 0);
      const price = priceOf(daysN > 0 ? observed / daysN : observed);
      r.exact = true; r.source = 'report'; r.awaiting = price == null; r.noData = false; r.min = observed; r.price = price; r.needsPeriod = !daysN;
    } else if (report) {
      r.exact = false; r.source = ''; r.awaiting = true; r.noData = true; r.noReading = true; r.min = null; r.price = null;
    } else {
      const price = r.avg == null ? null : priceOf(r.avg);
      r.exact = false; r.source = r.avg == null ? '' : 'threshold'; r.awaiting = price == null; r.noData = r.awaiting; r.min = r.awaiting ? null : r.avg; r.price = price;
    }
  });
  rows.forEach((r) => { if (r.price != null) r.price = boundPrice(r.price, priceCap); });
  const measured = rows.filter((r) => !r.awaiting && r.price != null).sort((a, b) => (b.min || 0) - (a.min || 0) || String(a.id).localeCompare(String(b.id)));
  if (measured.length) { measured[0].boss = true; measured[0].price = boundPrice(round5(measured[0].price * BOSS_MULT), priceCap); }
  const rank = (r) => (r.price == null ? Number.POSITIVE_INFINITY : r.price);
  const usage = (r) => (r.min == null ? Number.POSITIVE_INFINITY : r.min);
  rows.sort((a, b) => (a.awaiting - b.awaiting) || (rank(a) - rank(b)) || (usage(a) - usage(b)) || String(a.label || '').localeCompare(String(b.label || '')) || String(a.id).localeCompare(String(b.id)));
  return rows.map((r) => ({ ...r, boss: !!r.boss, noReading: !!r.noReading, tasks: r.price == null ? null : tasksFor(r.price) }));
};
export const formatReportMinutes = (min) => {
  const n = Math.max(0, Math.round(Number(min) || 0)); const h = Math.floor(n / 60); const m = n % 60;
  if (h && m) return `${h}h ${m}m`; if (h) return `${h}h`; return `${m}m`;
};
export const timeEarnedMin = (points) => Math.floor(Math.max(0, Number(points) || 0) / POINTS_PER_SLICE) * MIN_PER_SLICE;
// Minutes used today from local windows [{ startMs, endMs }] (a running window counts up to now).
export const spentMin = (windows, nowMs) => (windows || []).reduce((s, w) => s + Math.max(0, Math.min(Number(w.endMs) || 0, nowMs) - (Number(w.startMs) || 0)), 0) / 60000;
export const liveWindow = (windows, nowMs) => (windows || []).find((w) => w.startMs <= nowMs && nowMs < w.endMs) || null;

// The whole vault for the Home line. Points only: no task-count gate. priced = an explicit list (tests).
// debt = a missed-goal lock is unpaid (no vault while it is).
// open = the day's points have reached that app's price, and a session or focus timer is running.
// Every priced app at or under the points opens. A higher price stays locked. Points are not spent.
// wait = the session-end delay ({ untilMs, text }): the vault stays shut until it runs out.
export const vaultView = ({ apps = [], days = {}, todayYmd = '', points = 0, priced = null, report = null, priceCap = 0, debt = false, windows = [], nowMs = Date.now(), wait = null, bought = [], accessOpen = false } = {}) => {
  const held = !!(wait && Number(wait.untilMs) > nowMs);
  const p = Math.max(0, Number(points) || 0);   const ids = new Set((apps || []).map((a) => a.id));
  const owned = new Set(bought || []);
  const icons = new Map((apps || []).filter((a) => a && a.icon).map((a) => [a.id, a.icon]));
  const base = priced && priced.length ? priced.filter((a) => ids.has(a.id)) : priceApps(apps, days, todayYmd, { ...(report ? { report } : {}), priceCap });
  const items = base.map((a) => {
    const price = boundPrice(a.price, priceCap);
    const awaiting = !!(a.awaiting || price == null);
    const passed = !awaiting && p >= price;
    const open = passed && !debt && !held && !!accessOpen;
    return { ...a, price, tasks: price == null ? null : tasksFor(price), awaiting, icon: a.icon || icons.get(a.id) || '', bought: owned.has(a.id), open, passed, buyable: false };
  });
  const openCount = items.filter((a) => a.open).length;
  const next = items.find((a) => !a.awaiting && a.price != null && p < a.price);
  const earned = timeEarnedMin(p); const used = Math.min(earned, spentMin(windows, nowMs));
  const leftMin = Math.max(0, Math.floor(earned - used));
  const live = liveWindow(windows, nowMs);
  const liveLeftMin = live ? Math.max(0, Math.ceil((live.endMs - nowMs) / 60000)) : 0;
  const canStart = !debt && !held && openCount > 0 && !live && leftMin >= 2;
  const boughtIds = items.filter((a) => a.open).map((a) => a.id);
  const awaiting = items.filter((a) => a.awaiting).length;
  return { items, debt, openCount, total: items.length, awaiting, nextPrice: next ? next.price : 0, points: p, earnedMin: earned, leftMin, live: !!live, liveLeftMin, canStart, boughtIds, reportNote: report ? reportNote(report) : '', text: held && items.length && !debt ? `🔒 Vault · ${wait.text || 'opens after the session delay'}` : rowText({ total: items.length, openCount, next, debt, live: !!live, liveLeftMin, points: p, awaiting, hasReport: !!report }), held };
};
// Onboarding vault step: weekly screen time, coarse (never fake precision), and a plain-words reason for the price.
export const weeklyText = (r) => {
  if (r && r.noReading) return 'No reading';
  if (!r || r.awaiting || r.min == null) return 'No Screen Time report yet';
  if (r.exact || r.source === 'report') return `${formatReportMinutes(r.min)} in the Screen Time report you sent`;
  const h = (Number(r.min) || 0) * 7 / 60; const v = h < 1 ? '<1 h/week' : `~${Math.round(h)} h/week`;
  return `${v} (threshold, not exact)`;
};
export const priceWhy = (r) => {
  if (r && r.noReading) return 'No reading in the Screen Time report you sent, so no price is set.';
  if (!r || r.awaiting || r.price == null) return 'Waiting for this app\'s Screen Time before a price is set.';
  const name = /^app$/i.test(String(r.label || '').trim()) || !r.label ? 'this app' : r.label; const t = tasksFor(r.price);
  if (r.exact || r.source === 'report') {
    const period = r.needsPeriod ? ' The report did not show its time period, so this uses those minutes and is not a daily average.' : '';
    return `The Screen Time report you sent shows ${formatReportMinutes(r.min)} for ${name}, so it costs ${r.price} points, about ${t} task${t === 1 ? '' : 's'}.${r.boss ? ' It is the highest in that report, so it is priced 1.5×.' : ''}${period}`;
  }
  const h = Math.max(1, Math.round((Number(r.min) || 0) * 7 / 60));
  return `Recorded thresholds average about ${h} hour${h === 1 ? '' : 's'} a week on ${name}, so it costs ${r.price} points, about ${t} task${t === 1 ? '' : 's'}.${r.boss ? ' It\'s your biggest time sink, so it\'s priced 1.5×.' : ''} This is a threshold, not an exact minute total.`;
};
export const costText = (price) => `${price} pts · ~${tasksFor(price)} tasks`;
export const rowText = ({ total, openCount, next, debt, live, liveLeftMin, points = 0, awaiting = 0, hasReport = false }) => {
  if (!total) return '🔒 Vault · pick apps to lock first';
  if (debt) return '🔒 Vault · closed until a session hits its goal';
  if (!next && awaiting === total) return hasReport ? '🔒 Vault · no reading for the selected apps' : '🔒 Vault · no Screen Time report yet';
  const icon = openCount ? '🔓' : '🔒';
  const need = next ? Math.max(0, next.price - (Number(points) || 0)) : 0;
  const tail = live ? ` · ${liveLeftMin} min left` : next ? ` · ${need} pts to go · next app at ${next.price} pts (~${tasksFor(next.price)} tasks)` : (openCount ? (openCount === total ? ' · all open' : ' · priced apps open') : ' · timer off');
  return `${icon} Vault · ${openCount} of ${total} open${tail}`;
};
export const unlockText = (label) => `Vault unlocked: ${label} 🎉`;
// Apps that just opened and haven't been celebrated today (once per app per day).
// One celebration for everything that opened at once (native shows real icons; this is the web / no-token fallback).
export const unlockTitle = (apps) => (apps.length === 1 ? unlockText(apps[0].label) : `Vault unlocked: ${apps.length} apps 🎉`);
export const unlockCelebration = (apps) => (apps && apps.length ? { kind: 'vault', title: unlockTitle(apps), sub: `${Math.max(...apps.map((a) => Number(a.price) || 0))} pts reached`,
  apps: apps.map((a) => ({ id: a.id, label: a.label || 'App', icon: a.icon || '' })), ms: 1800 } : null);
// Newly open since the last view, and not already celebrated. One list, so several apps share one popup.
export const freshUnlocks = (prevIds, items, seen) => {
  const before = new Set(prevIds || []); const done = new Set(seen || []);
  return (items || []).filter((a) => a && a.open && a.id && !before.has(a.id) && !done.has(a.id));
};
// After the native overlay (ClingLock.celebrateVault): apps it could not draw (no token / not presented) still get the web one.
export const webFallback = (apps, res) => (res && Number(res.shown) > 0 ? (apps || []).filter((a) => (res.missing || []).includes(a.id)) : apps || []);
export const newUnlocks = (view, seen) => (view ? view.items.filter((a) => a.open && !(seen || []).includes(a.id)) : []);
// Shield release for apps the user has bought (`open`). `already` = ids released earlier today, so Stop is not undone.
// liveUntil = a running app-time window. The native allowance refuses anything <= 1 min (DeviceActivity is backdated
// to 15 min), which used to leave the Screen Time shield up after the UI had already marked the app open.
export const releasePlan = ({ view, already = [], nowMs = 0, liveUntil = 0 } = {}) => {
  if (!view || view.debt || view.held) return null;
  const open = (view.items || []).filter((a) => a.open).map((a) => a.id);
  const seen = new Set(already || []);
  const fresh = open.filter((id) => !seen.has(id));
  if (!fresh.length) return null;
  const untilMs = liveUntil > nowMs + 60000 ? liveUntil : nowMs + Math.max(2, Math.floor(Number(view.leftMin) || 0)) * 60000;
  if (!(untilMs > nowMs + 60000)) return null;
  return { ids: open, fresh, untilMs };
};

// A task timer is running only while it is counting: not paused, not finished, end still ahead.
export const focusTimerRunning = (tasks, now = Date.now()) => (tasks || []).some((t) => {
  if (!t || t.completed === true || !t.timerActive || t.timerPausedAt) return false;
  const end = new Date(t.timerEndTime).getTime();
  return Number.isFinite(end) && end > now;
});
// Purchases belong to one lock-in session. A new session key drops them so those apps lock again until bought in this session.
// Same key (reload, timer pause) keeps them. An empty key is not a new session.
export const vaultSessionReset = ({ sessionKey = '', storedKey = '', bought = [] } = {}) => {
  const key = String(sessionKey || '');
  if (!key || key === String(storedKey || '')) return { reset: false, sessionKey: String(storedKey || ''), bought: bought || [] };
  return { reset: true, sessionKey: key, bought: [] };
};
// Vault holes stay open only while a session countdown or a focus timer is actually running.
// Paused, stopped, expired, not started, or a finished session all close them.
export const vaultAccessOpen = ({ focusRunning = false, focusPaused = false, sessionRunning = false, sessionEnded = false } = {}) => {
  if (sessionEnded || focusPaused) return false;
  return !!(focusRunning || sessionRunning);
};
export const focusPaused = (tasks) => (tasks || []).some((t) => t && t.timerActive && t.timerPausedAt && t.completed !== true);
// After the session ends short of its goal, keep the shield up. Goal met, breaks, and emergency unlock do not.
export const shieldBecauseTimerOff = ({ enabled = false, selectionCount = 0, accessOpen = false, unlockedToday = false, onBreak = false, goalMet = false, sessionEnded = false, now = 0 } = {}) => {
  if (!sessionEnded || accessOpen || !enabled || !(selectionCount > 0) || unlockedToday || onBreak || goalMet) return null;
  return { want: true, untilMs: now + 8 * 3600000 };
};
// While access is closed, a live vault allowance is revoked (apps re-shield). While it is open, bought apps stay released
// until the session or focus timer ends (accessUntil). The native call refuses a window <= 1 min, so the floor is 2 min.
export const vaultTimerPlan = ({ accessOpen = false, view, nativeLive = false, nativeIds = [], nowMs = 0, liveUntil = 0, accessUntil = 0 } = {}) => {
  const localLive = !!(view && view.live);
  const open = (view && view.items || []).filter((a) => a.open).map((a) => a.id);
  if (!accessOpen || !view || view.debt || view.held || !open.length) return (nativeLive || localLive) ? { action: 'close' } : { action: null };
  const floor = nowMs + 2 * 60000;
  const bank = nowMs + Math.max(2, Math.floor(Number(view.leftMin) || 0)) * 60000;
  const session = accessUntil > nowMs + 60000 ? accessUntil : 0;
  let untilMs = Math.max(floor, session || bank);
  if (liveUntil > untilMs) untilMs = liveUntil;
  if (!(untilMs > nowMs + 60000)) return (nativeLive || localLive) ? { action: 'close' } : { action: null };
  const ids = nativeIds || [];
  // A shorter live window must not re-shield a bought app while the session is still running.
  const same = nativeLive && open.length === ids.length && open.every((id) => ids.includes(id)) && !(session && liveUntil + 60000 < session);
  if (same) return { action: null };
  return { action: 'allow', ids: open, untilMs, fresh: open.filter((id) => !ids.includes(id)) };
};

// Start shared app time for every open app: the native window ends when the minutes run out (re-shields with the app closed).
export const startPlan = (view, nowMs) => (view && view.canStart ? { ids: view.items.filter((a) => a.open).map((a) => a.id), startMs: nowMs, untilMs: nowMs + view.leftMin * 60000 } : null);
// Stopping early keeps the rest: the window is cut to now.
export const stopWindows = (windows, nowMs) => (windows || []).map((w) => (w.startMs <= nowMs && nowMs < w.endMs ? { ...w, endMs: nowMs } : w));
