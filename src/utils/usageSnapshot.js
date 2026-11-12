// The Screen Time report the user sent (Settings → Most Used). One local snapshot.
// The image does not show a date or a period, so these minutes are that report's totals.
// They are not a day, not a week, and not an Apple threshold. Nothing here is uploaded.

export const REPORT_PROVENANCE = 'the Screen Time report you sent';
export const SNAPSHOT_KEY = 'cn.vault.report.v1';

export const SENT_REPORT_ROWS = [
  { label: 'PUBG MOBILE', minutes: 1150 },
  { label: 'WhatsApp', minutes: 473 },
  { label: 'TikTok', minutes: 464 },
  { label: 'YouTube', minutes: 411 },
  { label: 'Grok Bot', minutes: 380 },
  { label: 'ClingNote', minutes: 342 },
  { label: 'Maps', minutes: 110 },
  { label: 'X', minutes: 86 },
  { label: 'Messages', minutes: 70 },
  { label: 'Camera', minutes: 57 },
  { label: 'Instagram', minutes: 54 },
  { label: 'Photos', minutes: 47 },
  { label: 'TestFlight', minutes: 45 },
  { label: 'ChatGPT', minutes: 37 },
];

export const normLabel = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const isPlaceholderLabel = (label) => { const k = normLabel(label); return !k || k === 'app'; };

export const sentReport = (adoptedAt = '') => ({
  provenance: REPORT_PROVENANCE,
  period: null,
  adoptedAt: adoptedAt || '',
  rows: SENT_REPORT_ROWS.map((r) => ({ label: r.label, minutes: r.minutes })),
});

const cleanRows = (rows) => (rows || []).filter((r) => r && !isPlaceholderLabel(r.label) && Number.isFinite(Number(r.minutes)) && Number(r.minutes) >= 0)
  .map((r) => ({ label: String(r.label).trim(), minutes: Number(r.minutes) }));

// A period is kept only when the owner states a day count. The supplied report has none.
export const periodOf = (report) => {
  const raw = report && (report.periodDays != null && report.periodDays !== '' ? report.periodDays : (report.period && report.period.days));
  const days = Math.round(Number(raw));
  if (!Number.isFinite(days) || days <= 0 || days > 366) return null;
  return { days, label: `${days} days` };
};

export const reportFromRecord = (raw, adoptedAt = '') => ({
  provenance: REPORT_PROVENANCE,
  period: periodOf(raw),
  adoptedAt: (raw && raw.adoptedAt) || adoptedAt || '',
  rows: cleanRows(raw && raw.rows),
});

export const readSnapshot = (storage) => {
  try {
    const v = JSON.parse(storage.getItem(SNAPSHOT_KEY) || 'null');
    if (!v || !Array.isArray(v.rows)) return null;
    const next = reportFromRecord(v);
    return next.rows.length ? next : null;
  } catch (e) { return null; }
};

export const writeSnapshot = (storage, report) => {
  const next = reportFromRecord(report, report && report.adoptedAt);
  storage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
  return next;
};

export const adoptSentReport = (storage, adoptedAt = '') => readSnapshot(storage) || writeSnapshot(storage, sentReport(adoptedAt));

export const replaceSnapshot = (storage, rows, adoptedAt = '') => writeSnapshot(storage, { adoptedAt, rows, period: null });

export const applyOwnerReport = (storage, parsed, adoptedAt = '') => writeSnapshot(storage, { adoptedAt, rows: parsed && parsed.rows, period: parsed && parsed.period, periodDays: parsed && parsed.period && parsed.period.days });

const fmtMin = (min) => {
  const n = Math.max(0, Math.round(Number(min) || 0)); const h = Math.floor(n / 60); const m = n % 60;
  if (h && m) return `${h}h ${m}m`; if (h) return `${h}h`; return `${m}m`;
};

// Least-used first, so the editor matches the order apps open. No bundle ids.
export const formatOwnerReport = (report) => {
  if (!report || !Array.isArray(report.rows) || !report.rows.length) return '';
  const rows = cleanRows(report.rows).slice().sort((a, b) => a.minutes - b.minutes || a.label.localeCompare(b.label));
  const head = report.period && report.period.days ? `period: ${report.period.days} days\n` : '';
  return head + rows.map((r) => `${r.label} ${fmtMin(r.minutes)}`).join('\n');
};

const lineMinutes = (line) => {
  const hm = line.match(/^(.+?)\s+(\d+)\s*h(?:ours?)?(?:\s*(\d+)\s*m(?:in(?:utes?)?)?)?$/i);
  if (hm) return { label: hm[1], minutes: Number(hm[2]) * 60 + (hm[3] ? Number(hm[3]) : 0) };
  const mn = line.match(/^(.+?)\s+(\d+)\s*m(?:in(?:utes?)?)?$/i);
  if (mn) return { label: mn[1], minutes: Number(mn[2]) };
  const bare = line.match(/^(.+?)\s*[:=]\s*(\d+)\s*$/);
  if (bare) return { label: bare[1], minutes: Number(bare[2]) };
  return null;
};

// Owner paste. A "period: N days" line is optional. Missing period does not block the list and does not invent a day.
export const parseOwnerReport = (text) => {
  let period = null; let skipped = 0; const rows = [];
  String(text || '').split(/\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || /^no reading$/i.test(line)) return;
    const per = line.match(/^(?:period|days)\s*[:=]\s*(\d+)\s*(?:days?)?$/i);
    if (per) { const days = Number(per[1]); period = days > 0 && days <= 366 ? { days, label: `${days} days` } : null; return; }
    const hit = lineMinutes(line);
    if (!hit || isPlaceholderLabel(hit.label) || !Number.isFinite(hit.minutes) || hit.minutes < 0) { skipped += 1; return; }
    rows.push({ label: hit.label.trim(), minutes: hit.minutes });
  });
  const by = new Map();
  cleanRows(rows).forEach((r) => by.set(normLabel(r.label), r));
  const clean = [...by.values()];
  if (!clean.length) return { ok: false, period, rows: [], error: 'No app times in that report. Use a line like “ChatGPT 37m”.' };
  return { ok: true, period, rows: clean, error: skipped ? `Skipped ${skipped} line${skipped === 1 ? '' : 's'} that were not an app time.` : '' };
};

// Unique label on both sides only. A repeated label matches nothing, so two shields never share one row.
export const matchReport = (apps, report) => {
  const selected = new Map();
  (apps || []).forEach((a) => {
    if (!a || isPlaceholderLabel(a.label)) return;
    const k = normLabel(a.label);
    const list = selected.get(k) || [];
    list.push(a);
    selected.set(k, list);
  });
  const reported = new Map();
  cleanRows(report && report.rows).forEach((r) => {
    const k = normLabel(r.label);
    const list = reported.get(k) || [];
    list.push(r);
    reported.set(k, list);
  });
  const hit = new Map();
  selected.forEach((list, k) => {
    const rows = reported.get(k) || [];
    if (list.length !== 1 || rows.length !== 1) return;
    hit.set(list[0].id, { minutes: rows[0].minutes, label: rows[0].label, exact: true, source: 'report' });
  });
  return hit;
};

export const reportNote = (report) => {
  const when = report && report.adoptedAt && !Number.isNaN(new Date(report.adoptedAt).getTime()) ? ` Saved ${String(report.adoptedAt).slice(0, 10)}.` : '';
  const period = report && report.period && report.period.days
    ? ` The report covers ${report.period.days} days, so a price uses that daily average.`
    : ' The report did not show its time period, so a price uses the minutes shown and is not a daily average.';
  return `From ${REPORT_PROVENANCE}.${when}${period} Automatic thresholds stay separate and are not these minutes. This phone cannot read the Screen Time report on its own.`;
};
