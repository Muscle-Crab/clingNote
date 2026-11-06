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

export const readSnapshot = (storage) => {
  try {
    const v = JSON.parse(storage.getItem(SNAPSHOT_KEY) || 'null');
    if (!v || !Array.isArray(v.rows)) return null;
    return { provenance: REPORT_PROVENANCE, period: null, adoptedAt: v.adoptedAt || '', rows: cleanRows(v.rows) };
  } catch (e) { return null; }
};

export const writeSnapshot = (storage, report) => {
  const next = { provenance: REPORT_PROVENANCE, period: null, adoptedAt: (report && report.adoptedAt) || '', rows: cleanRows(report && report.rows) };
  storage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
  return next;
};

export const adoptSentReport = (storage, adoptedAt = '') => readSnapshot(storage) || writeSnapshot(storage, sentReport(adoptedAt));

export const replaceSnapshot = (storage, rows, adoptedAt = '') => writeSnapshot(storage, { adoptedAt, rows });

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
  return `From ${REPORT_PROVENANCE}.${when} The report did not show its time period. Automatic thresholds stay separate and are not these minutes.`;
};
