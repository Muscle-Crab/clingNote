// Spoken utterance -> structured items [{ type: 'task'|'reminder'|'schedule', title, date, start, durationMin, remindAt }].
// Local, offline parser (the fallback, and the validator for the optional server-side AI interpreter).
// date = 'YYYY-MM-DD' (local), start = 'HH:MM' (24h) or '', durationMin = minutes (0 = none), remindAt = 'YYYY-MM-DDTHH:MM' or ''.
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (h, m) => `${pad(h)}:${pad(m)}`;
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fortyfive: 45, ninety: 90, couple: 2, few: 3 };
const num = (s) => { const t = String(s).toLowerCase(); return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NUM[t]; };
const NUMW = '(\\d+(?:\\.\\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty(?:-?five)?|ninety|couple(?: of)?|few)';
// Day parts -> [hour, minute, default block minutes]
const PARTS = { 'this morning': [9, 0, 180], morning: [9, 0, 180], 'after lunch': [13, 0, 120], lunch: [12, 0, 60], noon: [12, 0, 60], midday: [12, 0, 60], 'this afternoon': [15, 0, 180], afternoon: [15, 0, 180], 'after work': [17, 30, 120], 'this evening': [18, 0, 180], evening: [18, 0, 180], tonight: [20, 0, 120], night: [20, 0, 120], 'after dinner': [19, 30, 120], midnight: [0, 0, 60], 'before bed': [21, 30, 60], bedtime: [21, 30, 60] };

const take = (st, re, fn) => { const m = st.s.match(re); if (!m) return null; st.s = (st.s.slice(0, m.index) + ' ' + st.s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); return fn ? fn(m) : m; };

function parseDate(st, now) {
  const today = addDays(now, 0);
  let d = take(st, /\b(?:on\s+)?(?:the\s+)?day after tomorrow\b/i, () => addDays(today, 2)); if (d) return { d, explicit: true };
  d = take(st, /\b(?:on\s+)?(?:tomorrow|tmrw|tmr)\b/i, () => addDays(today, 1)); if (d) return { d, explicit: true };
  d = take(st, /\b(?:on\s+)?today\b/i, () => today); if (d) return { d, explicit: true };
  d = take(st, /\bin\s+(\d+|a|one|two|three|four|five|six|seven)\s+days?\b/i, (m) => addDays(today, num(m[1]))); if (d) return { d, explicit: true };
  d = take(st, /\bnext week\b/i, () => addDays(today, ((8 - today.getDay()) % 7) || 7)); if (d) return { d, explicit: true };
  d = take(st, new RegExp(`\\b(?:(next|this|on|coming)\\s+)?(${DAYS.join('|')}|mon|tues?|wed|thur?s?|fri|sat|sun)(?:day)?\\b`, 'i'), (m) => {
    const w = m[2].toLowerCase(); const idx = DAYS.findIndex((x) => x.startsWith(w.slice(0, 3)));
    let diff = (idx - today.getDay() + 7) % 7; const mod = (m[1] || '').toLowerCase();
    if (diff === 0 && mod !== 'this') diff = 7;
    return addDays(today, diff);
  }); if (d) return { d, explicit: true };
  return { d: today, explicit: false };
}

function parseDuration(st) {
  let r = take(st, new RegExp(`\\b(?:for\\s+)?${NUMW}\\s+and\\s+a\\s+half\\s+hours?\\b`, 'i'), (m) => Math.round((num(m[1].replace(/ of$/, '')) + 0.5) * 60)); if (r) return r;
  r = take(st, /\b(?:for\s+)?(?:a\s+)?half(?:\s+an)?\s+hour\b/i, () => 30); if (r) return r;
  r = take(st, /\b(?:for\s+)?(?:an?\s+|one\s+)?hour and a half\b/i, () => 90); if (r) return r;
  r = take(st, new RegExp(`\\b(?:for\\s+)?${NUMW}\\s*(?:hours?|hrs?|h)\\b(?:\\s+(?:and\\s+)?(\\d+)\\s*(?:minutes?|mins?))?`, 'i'), (m) => Math.round(num(m[1].replace(/ of$/, '')) * 60) + (Number(m[2]) || 0)); if (r) return r;
  r = take(st, new RegExp(`\\b(?:for\\s+)?${NUMW}\\s*(?:minutes?|mins?)\\b`, 'i'), (m) => Math.round(num(m[1]))); if (r) return r;
  return 0;
}

function parseTime(st) {
  let r = take(st, /\b(?:at|by|around|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?=\W|$)/i, (m) => { let h = Number(m[1]) % 12; if (/p/i.test(m[3])) h += 12; return { h, m: Number(m[2]) || 0 }; }); if (r && r.h < 24) return r;
  r = take(st, /\b(?:at|by|around|@)\s*(\d{1,2})(?::(\d{2}))?\s*(o'?clock)?(?:\s+in the\s+(morning|afternoon|evening))?\b/i, (m) => { let h = Number(m[1]); const part = (m[4] || '').toLowerCase();
    if (part === 'morning') { h %= 12; } else if (part) { if (h < 12) h += 12; } else if (h >= 1 && h <= 7) h += 12; return { h: h % 24, m: Number(m[2]) || 0 }; }); if (r) return r;
  r = take(st, /\b(\d{1,2}):(\d{2})\b/, (m) => { let h = Number(m[1]); if (h >= 1 && h <= 7) h += 12; return { h, m: Number(m[2]) }; }); if (r) return r;
  const keys = Object.keys(PARTS).sort((a, b) => b.length - a.length);
  r = take(st, new RegExp(`\\b(?:(?:in|for|during|at|by)\\s+)?(?:the\\s+)?(${keys.join('|')})\\b`, 'i'), (m) => { const p = PARTS[m[1].toLowerCase()]; return { h: p[0], m: p[1], part: m[1].toLowerCase(), block: p[2] }; });
  return r || null;
}

const STOP_LEAD = /^(?:please\s+|can you\s+|could you\s+|i (?:also |really |still |then )?(?:need|have|want|got) to\s+|i've got to\s+|i gotta\s+|i should\s+|i must\s+|i'?m (?:going to|gonna)\s+|i am going to\s+|i'?ll\s+|i will\s+|make sure (?:to|i)\s+|let's\s+|lets\s+|add(?:\s+a)?\s+task(?:\s+to)?\s+|add\s+|new task\s+|task(?:\s+to)?\s+|put\s+|um+\s+|uh+\s+|er+\s+|so\s+|okay\s+|ok\s+|also\s+|and\s+|then\s+|next\s+|after that\s+|like\s+|you know\s+|basically\s+|first(?:ly)?\s+|second(?:ly)?\s+|third(?:ly)?\s+|fourth\s+|finally\s+|lastly\s+|number (?:one|two|three|four|five|\d+)\s+|\d+[.)]\s*|i think\s+|i guess\s+|oh\s+|yeah\s+)+/i;
const FILLER = /\b(?:um+|uh+|erm|er|you know|i mean|kind of|sort of|like,)\b[,]?\s*/gi;
const cleanTitle = (s) => {
  let t = String(s || '').replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) t = t.replace(STOP_LEAD, '').trim();
  t = t.replace(/^(?:to|for|about|that i (?:need|have) to|that)\s+/i, '').replace(/\s+(?:at|on|for|by|from|in|the|and|to)$/i, '').replace(/\s+(?:at|on|for|by|from|in|the|and|to)$/i, '').replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, '');
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

// "in 2 hours", "In 2h", "in 90 min", "in half an hour", "in an hour and a half", "in 2 and a half hours", "in 1 hour 15 minutes",
// "in a couple of hours" -> minutes from now (0 = none). Used by the local parser and to backfill a model item that dropped the time.
const REL_UNIT_H = '(?:hours?|hrs?|h)'; const REL_UNIT_M = '(?:minutes?|mins?|m)';
export const relativeMinutes = (text) => {
  const t = ` ${String(text || '').toLowerCase().replace(/\s+/g, ' ')} `;
  let m = t.match(/\b(?:in|after)\s+(?:a\s+|one\s+)?half(?:\s+an?)?\s+hour\b/); if (m) return { min: 30, match: m[0] };
  m = t.match(/\b(?:in|after)\s+(?:an?|one)\s+hour\s+and\s+a\s+half\b/); if (m) return { min: 90, match: m[0] };
  m = t.match(new RegExp(`\\b(?:in|after)\\s+${NUMW}\\s+and\\s+a\\s+half\\s+${REL_UNIT_H}\\b`)); if (m && num(m[1].replace(/ of$/, '')) != null) return { min: Math.round((num(m[1].replace(/ of$/, '')) + 0.5) * 60), match: m[0] };
  m = t.match(new RegExp(`\\b(?:in|after)\\s+${NUMW}\\s*${REL_UNIT_H}(?:\\s+(?:and\\s+)?(\\d+)\\s*${REL_UNIT_M})?\\b`)); if (m && num(m[1].replace(/ of$/, '')) != null) return { min: Math.round(num(m[1].replace(/ of$/, '')) * 60) + (Number(m[2]) || 0), match: m[0] };
  m = t.match(new RegExp(`\\b(?:in|after)\\s+${NUMW}\\s*${REL_UNIT_M}\\b`)); if (m && num(m[1].replace(/ of$/, '')) != null) return { min: Math.round(num(m[1].replace(/ of$/, ''))), match: m[0] };
  return null;
};
// now + N minutes -> { date: 'YYYY-MM-DD', start: 'HH:MM' } (crosses midnight correctly).
export const relativeSlot = (min, now = new Date()) => { const t = new Date(now.getTime() + min * 60000); return { date: ymd(t), start: hm(t.getHours(), t.getMinutes()) }; };

export function parseClause(text, now = new Date()) {
  const st = { s: ` ${String(text || '').trim().replace(FILLER, ' ').replace(/^(?:(?:also|and|then|plus|so|okay|ok|um+|uh+|next|after that|afterwards|first(?:ly)?|second(?:ly)?|third(?:ly)?|fourth|finally|lastly|number \w+),?:?\s+)+/i, '')} ` };
  let kind = ''; let weak = '';
  if (take(st, /^\s*(?:please\s+)?(?:remind me(?:\s+to|\s+about|\s+that)?|set (?:a|an) reminder(?:\s+to|\s+for)?|reminder(?:\s+to)?|don'?t let me forget(?:\s+to)?|don'?t forget(?:\s+to)?)\b/i)) kind = 'reminder';
  else if (take(st, /^\s*(?:please\s+)?(?:schedule|block(?:\s+out|\s+off)?|set aside|carve out)\b/i)) kind = 'schedule';
  else { const w = take(st, /^\s*(?:please\s+)?(book|reserve|plan)\b/i, (m) => m[1]); if (w) { kind = 'schedule'; weak = w; } }
  const date = parseDate(st, now);
  const relM = relativeMinutes(st.s);
  const rel = relM && relM.min > 0 ? (take(st, new RegExp(relM.match.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')), { rel: relM.min }) : null;
  const dur = parseDuration(st);
  const time = rel || parseTime(st);
  // "block the evening for the essay": a day part names the block itself
  let title = st.s;
  if (kind === 'schedule' || dur) title = title.replace(/^\s*(?:time|some time)\s+/i, '');
  title = cleanTitle(title);
  // "book flights" / "plan the trip" with no time, length or day is a plain task, not a calendar block
  if (weak && !dur && !time && !date.explicit) { kind = ''; title = cleanTitle(`${weak} ${st.s}`); }
  let start = ''; let durationMin = dur; let d = date.d; let remindAt = '';
  if (time && time.rel != null) { const t = new Date(now.getTime() + time.rel * 60000); d = addDays(t, 0); start = hm(t.getHours(), t.getMinutes()); if (!kind) kind = 'reminder'; }
  else if (time) { start = hm(time.h, time.m); if (time.block && kind === 'schedule' && !durationMin) durationMin = time.block; }
  // Without an explicit date, a time already past today means tomorrow.
  if (start && !date.explicit && !(time && time.rel != null)) { const [h, m] = start.split(':').map(Number); if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) d = addDays(now, 1); }
  if (!kind) {
    if (durationMin && (start || date.explicit)) kind = 'schedule';
    // "go to the store at 6 PM": a timed TASK (startTime set; the phone pings at that time). Another day -> scheduled task.
    // Only an explicit "remind me ..." (kind set above) stays a plain reminder.
    else if (start && !durationMin) kind = ymdEq(d, now) ? 'task' : 'schedule';
    else if (date.explicit && !ymdEq(d, now)) kind = 'schedule';
    else kind = 'task';
  }
  if (kind === 'reminder') { if (!start) { const t = new Date(now.getTime() + 60 * 60000); start = hm(t.getHours(), 0); d = date.explicit ? d : (t.getHours() < now.getHours() ? addDays(now, 1) : d); if (date.explicit) start = '09:00'; } remindAt = `${ymd(d)}T${start}`; }
  if (kind === 'schedule' && !start) start = '09:00';
  return { type: kind, title: title || (kind === 'reminder' ? 'Reminder' : ''), date: ymd(d), start, durationMin: durationMin || 0, remindAt };
}
const ymdEq = (a, b) => ymd(a) === ymd(b);

// Split one utterance (or a long multi-part explanation) into clauses at an intent boundary:
// "and then", "after that", "then", "next", "also", "plus", numbered "first/second/finally", sentences, ";" and commas.
const INTENT = "(?:remind me|schedule|block|book|set a reminder|add|also|then|next|plus|after that|i (?:also |then )?(?:need|have|want|got) to|i(?:'?m| am) (?:going to|gonna)|i (?:should|must)|don'?t (?:let me )?forget|make sure)";
const SEQ = '(?:and then|after that|afterwards|and also|and next|then|next|also|plus|first(?:ly)?|second(?:ly)?|third(?:ly)?|fourth|finally|lastly|number (?:one|two|three|four|five|six))';
export const MAX_ITEMS = 15;
export function splitClauses(text) {
  const raw = String(text || '').replace(/\s+/g, ' ')
    .replace(new RegExp(`(?<!\\bi)(?:^|[\\s,;.])(?:and\\s+)?${SEQ}\\b(?!\\s+(?:week|month|year|time|weekend|mon|tue|wed|thu|fri|sat|sun)\\w*)[,:]?`, 'gi'), (m) => ` ; ${m.replace(/^[\s,;.]+/, '')}`)
    .split(new RegExp(`\\s*(?:[;.!?]+\\s+|[;.!?]+$|;+|,?\\s+and\\s+(?=${INTENT}\\b)|,\\s*(?=${INTENT}\\b))\\s*`, 'i'));
  const out = [];
  for (let c of raw) {
    c = c.trim(); if (!c) continue;
    // remaining commas: split only when both sides are clauses of 2+ words (keeps "milk, eggs" lists and "at 5, for an hour")
    const parts = c.split(/\s*,\s*/); let cur = parts[0];
    const wc = (x) => x.split(/\s+/).filter(Boolean).length;
    if (parts.length > 1 && parts.slice(1).every((p, i, a) => wc(p) <= (i === a.length - 1 ? 4 : 2)) && / and /i.test(parts[parts.length - 1]) && wc(parts[parts.length - 1]) <= 4) { out.push(c); continue; } // "milk, eggs and bread" list
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i]; const words = (x) => x.replace(/^(?:and|then|also)\s+/i, '').split(/\s+/).filter(Boolean).length;
      if (words(cur) >= 2 && words(p) >= 2 && !/^(?:at|on|for|by|in|from|around|tomorrow|today|tonight|this|next|and)\b/i.test(p) && !/^\d/.test(p)) { out.push(cur); cur = p; } else cur = `${cur}, ${p}`;
    }
    out.push(cur);
  }
  return out.map((s) => s.trim()).filter((s) => !new RegExp(`^(?:and\\s+)?${SEQ}[\\s,.]*$`, 'i').test(s)).filter((s) => cleanTitle(s.replace(FILLER, ' ')).replace(/\W/g, '').length >= 2).slice(0, MAX_ITEMS);
}

export function parseUtterance(text, now = new Date()) {
  return splitClauses(text).map((c) => parseClause(c, now)).filter((it) => it.title);
}

// Any model/user time -> 'HH:MM' 24h or '': accepts '15:00', '9:05', '3pm', '5 PM', '3:30 p.m.', '12am'.
export const toHHMM = (s) => {
  const t = String(s == null ? '' : s).trim().toLowerCase().replace(/\./g, '');
  let m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)$/);
  if (m) { const h = Number(m[1]); const mi = Number(m[2] || 0); if (h < 1 || h > 12 || mi > 59) return ''; return hm((h % 12) + (m[3][0] === 'p' ? 12 : 0), mi); }
  m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) { const h = Number(m[1]); const mi = Number(m[2]); return h < 24 && mi < 60 ? hm(h, mi) : ''; }
  return '';
};
// The user's words name a day other than today ("tomorrow", "Friday", "in 3 days"): an item with no date must not silently become today.
export const namesOtherDay = (text) => /\b(?:tomorrow|tmrw|tmr|next week|in\s+(?:\d+|a|one|two|three|four|five|six|seven)\s+days?|(?:mon|tues|wednes|thurs|fri|satur|sun)days?)\b/i.test(String(text || ''));
// Validate / normalise items from any interpreter (AI or local) before they reach the confirm sheet.
export function normalizeItems(items, now = new Date(), { userText = '' } = {}) {
  if (!Array.isArray(items)) return [];
  const strictDate = namesOtherDay(userText);
  // "in 2 hours": a single item the model left without a time gets now + N (it was once saved with no time at all).
  const relU = relativeMinutes(userText); const relFill = relU && relU.min > 0 && items.length === 1 ? relativeSlot(relU.min, now) : null;
  const okD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  return items.slice(0, MAX_ITEMS).map((x0) => {
    let x = x0;
    const title = String((x && x.title) || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 140);
    if (relFill && x && !toHHMM(x.start) && !/^\d{4}-\d{2}-\d{2}T/.test(String(x.remindAt || ''))) {
      x = { ...x, date: relFill.date, start: relFill.start, ...(x.type === 'reminder' ? { remindAt: `${relFill.date}T${relFill.start}` } : {}) };
      if (x.type !== 'reminder' && relFill.date !== ymd(now)) x = { ...x, type: 'schedule' }; // lands tomorrow
    }
    const type = ['task', 'reminder', 'schedule'].includes(x && x.type) ? x.type : 'task';
    if (strictDate && !okD(x.date) && !/^\d{4}-\d{2}-\d{2}T/.test(String(x.remindAt || ''))) return { title, missingDate: true };
    const date = okD(x.date) ? x.date : ymd(now);
    const start = toHHMM(x.start);
    const durationMin = Math.max(0, Math.min(24 * 60, Math.round(Number(x.durationMin) || 0)));
    const ra = String(x.remindAt || '').match(/^(\d{4}-\d{2}-\d{2})[T ](.+)$/); const raT = ra ? toHHMM(ra[2]) : '';
    let remindAt = ra && raT ? `${ra[1]}T${raT}` : '';
    if (type === 'reminder' && !remindAt) remindAt = `${date}T${start || '09:00'}`;
    const st2 = start || (type === 'reminder' ? remindAt.slice(11) : type === 'schedule' ? '09:00' : '');
    const section = ['morning', 'noon', 'afternoon'].includes(x.section) ? x.section : ''; // optional Home section; an explicit start time wins when saved
    return { type, title, date: type === 'reminder' ? remindAt.slice(0, 10) : date, start: st2, durationMin, remindAt: type === 'reminder' ? remindAt : '', ...(section ? { section } : {}) };
  }).filter((x) => x.title);
}
