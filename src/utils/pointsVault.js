// Points vault: the day's points open apps one by one (cheapest = least used), and every 10 points buys 5 min of shared app time.
// Pure logic (tests: scripts/test-points-vault.mjs). Native half: VaultAllow / UsageLog in ios/App/Shared/LockShared.swift.
// Points only (never stats.coins). Spending app time never takes points or goal progress away: it is tracked as local time windows.

export const POINTS_PER_SLICE = 10; export const MIN_PER_SLICE = 5;
// Usage buckets (minutes), mirrored by UsageLog.thresholds (clingUsage threshold events). A day's value is the bucket's lower bound.
export const USAGE_THRESHOLDS = [10, 15, 30, 45, 60, 90, 120, 180, 240];
export const AVG_DAYS = 7; export const BASE_PRICE = 30; export const PTS_PER_MIN = 2; export const BOSS_MULT = 1.5; export const PRICE_CAP = 600;
export const NO_DATA_MIN = 60; export const PTS_PER_TASK = 20; // a medium task
export const round5 = (x) => Math.round(x / 5) * 5;
export const bucketMin = (m) => { const v = Number(m) || 0; let b = 0; USAGE_THRESHOLDS.forEach((t) => { if (v >= t) b = t; }); return b; };
// 7-day average of bucket lower bounds before today; null = no data for this app.
export const avgUsage = (days, appId, todayYmd, n = AVG_DAYS) => {
  const keys = Object.keys(days || {}).filter((d) => d < todayYmd).sort().slice(-n);
  if (!keys.some((d) => (days[d] || {})[appId] != null)) return null;
  return keys.reduce((s, d) => s + bucketMin((days[d] || {})[appId]), 0) / keys.length;
};
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
export const priceOf = (min) => Math.min(PRICE_CAP, round5(BASE_PRICE + PTS_PER_MIN * Math.max(0, Number(min) || 0)));
export const tasksFor = (price) => Math.ceil((Number(price) || 0) / PTS_PER_TASK);
// Prices from the user's own usage: no-data apps get the median of the others (60 min if none); the heaviest app (first on a tie)
// is the boss at round5(price x 1.5), capped. Sorted ascending by price, so apps open in that order as the day's points grow.
export const priceApps = (apps, days, todayYmd) => {
  const rows = (apps || []).map((a, i) => ({ id: a.id, label: a.label || 'App', ord: i, avg: avgUsage(days, a.id, todayYmd) }));
  const known = rows.filter((r) => r.avg != null).map((r) => r.avg); const fill = known.length ? median(known) : NO_DATA_MIN;
  rows.forEach((r) => { r.min = r.avg == null ? fill : r.avg; r.noData = r.avg == null; r.price = priceOf(r.min); });
  rows.sort((a, b) => b.min - a.min || a.ord - b.ord);
  if (rows.length) { rows[0].boss = true; rows[0].price = Math.min(PRICE_CAP, round5(rows[0].price * BOSS_MULT)); }
  rows.sort((a, b) => a.price - b.price || a.min - b.min || a.ord - b.ord);
  return rows.map((r) => ({ ...r, boss: !!r.boss, tasks: tasksFor(r.price) }));
};
export const timeEarnedMin = (points) => Math.floor(Math.max(0, Number(points) || 0) / POINTS_PER_SLICE) * MIN_PER_SLICE;
// Minutes used today from local windows [{ startMs, endMs }] (a running window counts up to now).
export const spentMin = (windows, nowMs) => (windows || []).reduce((s, w) => s + Math.max(0, Math.min(Number(w.endMs) || 0, nowMs) - (Number(w.startMs) || 0)), 0) / 60000;
export const liveWindow = (windows, nowMs) => (windows || []).find((w) => w.startMs <= nowMs && nowMs < w.endMs) || null;

// The whole vault for the Home line. debt = a missed-goal lock is unpaid (no vault while it is).
// The whole vault for the Home line. Points only: no task-count gate. priced = today's frozen prices (computed once per day).
// debt = a missed-goal lock is unpaid (no vault while it is).
export const vaultView = ({ apps = [], days = {}, todayYmd = '', points = 0, priced = null, debt = false, windows = [], nowMs = Date.now() } = {}) => {
  const p = Math.max(0, Number(points) || 0); const ids = new Set((apps || []).map((a) => a.id));
  const base = priced && priced.length ? priced.filter((a) => ids.has(a.id)) : priceApps(apps, days, todayYmd);
  const items = base.map((a) => ({ ...a, open: !debt && p >= a.price }));
  const openCount = items.filter((a) => a.open).length;
  const next = items.find((a) => !a.open);
  const earned = timeEarnedMin(p); const used = Math.min(earned, spentMin(windows, nowMs));
  const leftMin = Math.max(0, Math.floor(earned - used));
  const live = liveWindow(windows, nowMs);
  const liveLeftMin = live ? Math.max(0, Math.ceil((live.endMs - nowMs) / 60000)) : 0;
  const canStart = !debt && openCount > 0 && !live && leftMin >= 2;
  return { items, debt, openCount, total: items.length, nextPrice: next ? next.price : 0, points: p, earnedMin: earned, leftMin, live: !!live, liveLeftMin, canStart, text: rowText({ total: items.length, openCount, next, debt, live: !!live, liveLeftMin }) };
};
export const costText = (price) => `${price} pts · ~${tasksFor(price)} tasks`;
export const rowText = ({ total, openCount, next, debt, live, liveLeftMin }) => {
  if (!total) return '🔒 Vault · pick apps to lock first';
  if (debt) return '🔒 Vault · closed until a session hits its goal';
  const icon = openCount ? '🔓' : '🔒';
  const tail = live ? ` · ${liveLeftMin} min left` : next ? ` · next app at ${next.price} pts (~${tasksFor(next.price)} tasks)` : ' · all open';
  return `${icon} Vault · ${openCount} of ${total} open${tail}`;
};
export const unlockText = (label) => `Vault unlocked: ${label} 🎉`;
// Apps that just opened and haven't been celebrated today (once per app per day).
export const newUnlocks = (view, seen) => (view ? view.items.filter((a) => a.open && !(seen || []).includes(a.id)) : []);

// Start shared app time for every open app: the native window ends when the minutes run out (re-shields with the app closed).
export const startPlan = (view, nowMs) => (view && view.canStart ? { ids: view.items.filter((a) => a.open).map((a) => a.id), startMs: nowMs, untilMs: nowMs + view.leftMin * 60000 } : null);
// Stopping early keeps the rest: the window is cut to now.
export const stopWindows = (windows, nowMs) => (windows || []).map((w) => (w.startMs <= nowMs && nowMs < w.endMs ? { ...w, endMs: nowMs } : w));
