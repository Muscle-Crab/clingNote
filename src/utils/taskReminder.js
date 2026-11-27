// Values from the Add reminder sheet. iOS time inputs send HH:MM or HH:MM:SS.
// A past clock time is rejected only when the reminder does not repeat.
const parseLocal = (date, time) => {
  const [y, mo, d] = String(date).split('-').map(Number);
  const [h, mi] = String(time).split(':').map(Number);
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
};

export const normalizeDate = (date) => {
  const s = String(date || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

export const normalizeTime = (time) => {
  const m = String(time || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(am|pm))?$/i);
  if (!m) return '';
  let h = Number(m[1]);
  const mi = Number(m[2]);
  const ap = (m[3] || '').toLowerCase();
  if (mi > 59 || h > 23) return '';
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23) return '';
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
};

export const reminderCheck = ({ date, time, repeat } = {}, now = new Date()) => {
  const d = normalizeDate(date);
  const t = normalizeTime(time);
  if (!d || !t) return { ok: false, error: 'Enter a date and a time.' };
  const at = parseLocal(d, t);
  if (!at) return { ok: false, error: 'That date or time is not valid.' };
  const repeats = !!String(repeat || '').trim();
  if (!repeats && at.getTime() <= now.getTime()) return { ok: false, error: 'That time has already passed.' };
  return { ok: true, date: d, time: t, at };
};
