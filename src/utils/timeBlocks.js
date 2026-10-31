// B44 time blocking (pure). Settings on users/{uid}.timeBlocks = { start: 'HH:MM', end: 'HH:MM', days: [0..6], focusMin: 0|30..240 }.
// With calendar sync on, ClingNote writes (and owns) one "🎯 Focus time" block per working day in the first free gap of the working
// hours (device busy times + timed tasks avoided), and the running lock-in as a "🔒 Lock-in focus" block. Calendar edits to these
// are not pulled back; deleting one in Calendar is respected (calendarSync.js `owned`).
import { busyOnDate, nextFree } from './busyTimes';
import { fmtTime, isValidTime, addDaysStr } from './scheduling';

export const DEFAULT_BLOCKS = { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5], focusMin: 0 };
export const FOCUS_CHOICES = [0, 30, 60, 90, 120, 180, 240];
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const dms = (date) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
export const normBlocks = (b) => {
  const x = b && typeof b === 'object' ? b : {};
  let start = isValidTime(x.start) ? x.start : DEFAULT_BLOCKS.start; let end = isValidTime(x.end) ? x.end : DEFAULT_BLOCKS.end;
  if (toMin(end) <= toMin(start)) { start = DEFAULT_BLOCKS.start; end = DEFAULT_BLOCKS.end; }
  const days = Array.isArray(x.days) ? [...new Set(x.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : DEFAULT_BLOCKS.days;
  const f = Math.round(Number(x.focusMin)); const focusMin = FOCUS_CHOICES.includes(f) ? f : 0;
  return { start, end, days, focusMin };
};
export const durLabel = (m) => (m % 60 ? (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`) : `${m / 60}h`);
export const blocksSummary = (b) => { const n = normBlocks(b); return `Work ${fmtTime(n.start)}–${fmtTime(n.end)} · ${n.focusMin ? `Focus ${durLabel(n.focusMin)}/day` : 'no focus block'}`; };

// Focus blocks for the next `days` dates from fromDate. busy: device busy [{startMs,endMs}]; taken: ClingNote timed events [{startMs,endMs}].
export const focusBlocks = ({ settings, fromDate, days = 14, busy = [], taken = [], nowMs = Date.now() }) => {
  const n = normBlocks(settings); if (!n.focusMin) return [];
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDaysStr(fromDate, i); const d0 = dms(date);
    if (!n.days.includes(new Date(d0).getDay())) continue;
    const merged = busyOnDate([...busy, ...taken], date); // from the start of the working day (stable placement; not moved as time passes)
    const s = nextFree(merged, toMin(n.start), n.focusMin, toMin(n.end)); if (!s) continue;
    const startMs = d0 + toMin(s) * 60000; if (startMs + n.focusMin * 60000 <= nowMs) continue; // already over
    out.push({ key: `f-${date}`, title: '🎯 Focus time', startMs, endMs: startMs + n.focusMin * 60000, notes: 'Focus block from ClingNote (Settings → Calendar).' });
  }
  return out;
};
// The running lock-in (eightHourLock currentLock(): { startMs, endMs }) as one block, if it has not ended.
export const lockBlock = (lock, nowMs = Date.now()) => {
  if (!lock || !(Number(lock.endMs) > nowMs) || !(Number(lock.endMs) > Number(lock.startMs))) return null;
  const d = new Date(Number(lock.startMs)); const key = `l-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return { key, title: '🔒 Lock-in focus', startMs: Number(lock.startMs), endMs: Number(lock.endMs), notes: 'Lock-in from ClingNote.' };
};
