// B44 plain-word task entry ("gym tomorrow at 6", "pay rent friday 9am", "dentist nov 3 at 4:30pm").
// Local, on-device parser first (voiceIntent.parseClause + month-name / m/d dates); for Pro users with AI consent the caller passes
// `ask` (useAi.askAi through voiceInterpret.interpretSpeech, server-side key) and the AI result is used when it returns one item.
// Nothing is applied until the user taps the hint row in the add sheet.
import { parseClause, ymd } from './voiceIntent';
import { interpretSpeech } from './voiceInterpret';
import { formatScheduledDate, fmtTime, isValidDate, isValidTime } from './scheduling';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_WORDS = /\b(today|tonight|tomorrow|tmrw|tmr|next week|in\s+\S+\s+days?|(?:mon|tues|wednes|thurs|fri|satur|sun)days?|mon|tue|wed|thu|fri|sat|sun)\b/i;
// explicit calendar dates the clause parser does not know: "nov 3", "on November 3rd", "11/3"
const explicitDate = (text, now) => {
  let m = /\b(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(text);
  let mo; let d;
  if (m) { mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()); d = +m[2]; }
  else { m = /\b(?:on\s+)?(\d{1,2})\/(\d{1,2})\b/.exec(text); if (m) { mo = +m[1] - 1; d = +m[2]; } }
  if (!m || mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  let dt = new Date(now.getFullYear(), mo, d); if (dt.getMonth() !== mo) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (dt < today) dt = new Date(now.getFullYear() + 1, mo, d);
  return { date: ymd(dt), rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() };
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// -> { title, date, time, source } or null when the text names no date / time (plain titles are left alone)
export const localParse = (text, now = new Date()) => {
  const raw = String(text || '').replace(/\s+/g, ' ').trim(); if (raw.length < 3 || raw.length > 200) return null;
  const ex = explicitDate(raw, now); const c = parseClause(ex ? ex.rest : raw, now); if (!c || !c.title) return null;
  const date = ex ? ex.date : c.date; const time = isValidTime(c.start) ? c.start : '';
  const namedDay = !!ex || DATE_WORDS.test(raw);
  if (!time && !namedDay) return null;
  const title = cap(String(c.title).replace(/\s+(?:on|at|by)$/i, '').trim()); if (!title || title.toLowerCase() === raw.toLowerCase()) { if (!time && !ex) return null; }
  return { title: title || raw, date: isValidDate(date) ? date : ymd(now), time, source: 'local' };
};

// AI first when `ask` is given (single item only), local otherwise / on any failure.
export const parseEntry = async (text, { ask = null, now = new Date() } = {}) => {
  const local = localParse(text, now);
  if (!ask) return local;
  try {
    const { items, source } = await interpretSpeech(text, { ask, now, timeoutMs: 6000 });
    if (source === 'ai' && items.length === 1 && items[0].title) {
      const it = items[0]; const r = { title: cap(String(it.title).trim()).slice(0, 200), date: isValidDate(it.date) ? it.date : ymd(now), time: isValidTime(it.start) ? it.start : '', source: 'ai' };
      if (r.time || r.date !== ymd(now) || local) return r;
    }
  } catch (e) { /* local */ }
  return local;
};

export const hintText = (p, todayStr) => {
  if (!p) return '';
  const day = p.date === todayStr ? 'Today' : formatScheduledDate(p.date, todayStr);
  return `${day}${p.time ? ` · ${fmtTime(p.time)}` : ''} · “${p.title}”`;
};
