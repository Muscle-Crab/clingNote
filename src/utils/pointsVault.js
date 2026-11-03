// Points vault: the day's points open apps one by one (cheapest = least used), and every 10 points buys 5 min of shared app time.
// Pure logic (tests: scripts/test-points-vault.mjs). Native half: VaultAllow / UsageLog in ios/App/Shared/LockShared.swift.
// Points only (never stats.coins). Spending app time never takes points or goal progress away: it is tracked as local time windows.

export const VAULT_PRICES = [30, 60, 100, 150, 220];
export const VAULT_GATE_TASKS = 3;
export const POINTS_PER_SLICE = 10; export const MIN_PER_SLICE = 5;
export const USAGE_THRESHOLDS = [15, 30, 60, 120, 240]; // minutes, mirrored by UsageLog.thresholds (clingUsage threshold events)
export const AVG_DAYS = 7;
const ABS_TIER_MAX = [15, 30, 60, 120]; // avg min/day below these -> tier 0..3, else 4

// Average minutes/day over the last AVG_DAYS observed days before today. days = { 'yyyy-MM-dd': { appId: minutes } } (an observed day
// without the app = under 15 min = 0). No data for the app in that window (never reached 15 min, just added, or no observed day)
// -> null: priced as a heavy app, by design (unknown is never cheap).
export const avgUsage = (days, appId, todayYmd, n = AVG_DAYS) => {
  const keys = Object.keys(days || {}).filter((d) => d < todayYmd).sort().slice(-n);
  if (!keys.some((d) => (days[d] || {})[appId] != null)) return null;
  return keys.reduce((s, d) => s + (Number((days[d] || {})[appId]) || 0), 0) / keys.length;
};
export const absTier = (avg) => { if (avg == null) return VAULT_PRICES.length - 1; const i = ABS_TIER_MAX.findIndex((m) => avg < m); return i < 0 ? VAULT_PRICES.length - 1 : i; };

// Prices: apps ranked by usage (least used first, no data = heaviest), rank spread over the 5 tiers so the heaviest is always the last
// price; an app is never cheaper than its own usage tier. Both tiers grow along the ranking, so prices never go down along the list.
export const priceApps = (apps, days, todayYmd) => {
  const rows = (apps || []).map((a) => ({ id: a.id, label: a.label || 'App', avg: avgUsage(days, a.id, todayYmd) }));
  rows.sort((a, b) => (a.avg == null ? Infinity : a.avg) - (b.avg == null ? Infinity : b.avg) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const n = rows.length, top = VAULT_PRICES.length - 1;
  return rows.map((r, i) => { const rank = n <= 1 ? 0 : Math.round((i * top) / (n - 1)); const tier = Math.max(rank, absTier(r.avg)); return { ...r, tier, price: VAULT_PRICES[tier] }; });
};

export const gateOf = (tasksDone, need = VAULT_GATE_TASKS) => { const d = Math.max(0, Number(tasksDone) || 0); return { met: d >= need, left: Math.max(0, need - d) }; };
export const timeEarnedMin = (points) => Math.floor(Math.max(0, Number(points) || 0) / POINTS_PER_SLICE) * MIN_PER_SLICE;
// Minutes used today from local windows [{ startMs, endMs }] (a running window counts up to now).
export const spentMin = (windows, nowMs) => (windows || []).reduce((s, w) => s + Math.max(0, Math.min(Number(w.endMs) || 0, nowMs) - (Number(w.startMs) || 0)), 0) / 60000;
export const liveWindow = (windows, nowMs) => (windows || []).find((w) => w.startMs <= nowMs && nowMs < w.endMs) || null;

// The whole vault for the Home line. debt = a missed-goal lock is unpaid (no vault while it is).
export const vaultView = ({ apps = [], days = {}, todayYmd = '', points = 0, tasksDone = 0, debt = false, windows = [], nowMs = Date.now() } = {}) => {
  const gate = gateOf(tasksDone); const p = Math.max(0, Number(points) || 0);
  const items = priceApps(apps, days, todayYmd).map((a) => ({ ...a, open: gate.met && !debt && p >= a.price }));
  const openCount = items.filter((a) => a.open).length;
  const next = items.find((a) => !a.open);
  const earned = timeEarnedMin(p); const used = Math.min(earned, spentMin(windows, nowMs));
  const leftMin = Math.max(0, Math.floor(earned - used));
  const live = liveWindow(windows, nowMs);
  const liveLeftMin = live ? Math.max(0, Math.ceil((live.endMs - nowMs) / 60000)) : 0;
  const canStart = !debt && gate.met && openCount > 0 && !live && leftMin >= 2;
  return { items, gate, debt, openCount, total: items.length, nextPrice: next ? next.price : 0, points: p, earnedMin: earned, leftMin, live: !!live, liveLeftMin, canStart, text: rowText({ total: items.length, openCount, next, gate, debt, live: !!live, liveLeftMin }) };
};

export const rowText = ({ total, openCount, next, gate, debt, live, liveLeftMin }) => {
  if (!total) return '🔒 Vault · pick apps to lock first';
  if (debt) return '🔒 Vault · closed until a session hits its goal';
  if (!gate.met) return `🔒 Vault · finish ${gate.left} more task${gate.left === 1 ? '' : 's'} to open`;
  const icon = openCount ? '🔓' : '🔒';
  const tail = live ? ` · ${liveLeftMin} min left` : next ? ` · next at ${next.price} pts` : ' · all open';
  return `${icon} Vault · ${openCount} of ${total} open${tail}`;
};
export const gateLine = (gate) => (gate.met ? '' : `Finish ${gate.left} more task${gate.left === 1 ? '' : 's'} to open the vault.`);

// Start shared app time for every open app: the native window ends when the minutes run out (re-shields with the app closed).
export const startPlan = (view, nowMs) => (view && view.canStart ? { ids: view.items.filter((a) => a.open).map((a) => a.id), startMs: nowMs, untilMs: nowMs + view.leftMin * 60000 } : null);
// Stopping early keeps the rest: the window is cut to now.
export const stopWindows = (windows, nowMs) => (windows || []).map((w) => (w.startMs <= nowMs && nowMs < w.endMs ? { ...w, endMs: nowMs } : w));
