// B44 busy / free (pure). Input: device calendar busy blocks [{ startMs, endMs }] (ClingNative.busy: times only, no titles, the
// ClingNote calendar itself excluded). Used by SchedulePicker (one compact row: "Busy 9:00–10:00 AM · free 10:00 AM ↵"), the
// auto-scheduler and the time-blocking focus blocks.
import { fmtTime } from './scheduling';

const DAY = 86400000;
const toHm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const toMin = (s) => { const m = /^(\d{2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : null; };
const dayStart = (date) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

// Busy minutes of one local date, merged and sorted: [{ s, e }] in minutes from midnight.
export const busyOnDate = (busy, date) => {
  const d0 = dayStart(date); const d1 = d0 + DAY; const iv = [];
  for (const b of busy || []) {
    const s = Number(b && b.startMs); const e = Number(b && b.endMs); if (!(e > s) || e <= d0 || s >= d1) continue;
    iv.push({ s: Math.max(0, Math.round((s - d0) / 60000)), e: Math.min(1440, Math.round((e - d0) / 60000)) });
  }
  iv.sort((a, b) => a.s - b.s); const out = [];
  for (const x of iv) { const last = out[out.length - 1]; if (last && x.s <= last.e) last.e = Math.max(last.e, x.e); else out.push({ ...x }); }
  return out;
};
// The busy block that overlaps [start, start+minutes), or null
export const clashAt = (merged, start, minutes = 30) => { const s = toMin(start); if (s === null) return null; const e = s + Math.max(5, minutes); return (merged || []).find((b) => b.s < e && b.e > s) || null; };
// First free start >= from (minutes) that fits `minutes` before `until`; '' if none
export const nextFree = (merged, from, minutes = 30, until = 1440) => {
  let t = typeof from === 'string' ? toMin(from) : from; if (t === null) return '';
  for (const b of merged || []) { if (b.e <= t) continue; if (b.s >= t + minutes) break; t = Math.max(t, b.e); }
  return t + minutes <= until ? toHm(t) : '';
};
// Compact label for the picker row. -> { clash, text, suggest } ; text '' when the day has no busy time.
export const busySummary = (busy, date, time, minutes = 30) => {
  const m = busyOnDate(busy, date); if (!m.length) return { clash: false, text: '', suggest: '' };
  const c = clashAt(m, time, minutes);
  if (c) { const sug = nextFree(m, c.e, minutes); return { clash: true, text: `Busy ${fmtTime(toHm(c.s))}–${fmtTime(toHm(c.e))}${sug ? ` · free ${fmtTime(sug)}` : ''}`, suggest: sug }; }
  const parts = m.slice(0, 3).map((b) => `${fmtTime(toHm(b.s))}–${fmtTime(toHm(b.e))}`);
  return { clash: false, text: `Busy ${parts.join(', ')}${m.length > 3 ? ` +${m.length - 3}` : ''}`, suggest: '' };
};
// Strip segments for a tiny inline bar between from..until minutes: [{ left%, width% }]
export const busyStrip = (merged, from = 360, until = 1320) => (merged || []).filter((b) => b.e > from && b.s < until)
  .map((b) => ({ left: Math.round(((Math.max(b.s, from) - from) / (until - from)) * 1000) / 10, width: Math.round(((Math.min(b.e, until) - Math.max(b.s, from)) / (until - from)) * 1000) / 10 }));
// For autoSchedule / planDay: [{ start: 'HH:MM', end: 'HH:MM' }]
export const busyHm = (busy, date) => busyOnDate(busy, date).map((b) => ({ start: toHm(b.s), end: toHm(Math.min(b.e, 1439)) }));
