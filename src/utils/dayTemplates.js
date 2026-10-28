// Reusable day templates (pure). Save today's task set (optionally with start times) under a name; "Apply" adds the
// template's tasks to today, skipping any task whose title is already on today's list. Storage lives in useDayTemplates.js.
export const MAX_TEMPLATES = 10;
export const MAX_TEMPLATE_ITEMS = 20;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const normTitle = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

// tasks: today's list. -> { ok:true, template } | { ok:false, error }
export const makeTemplate = (name, tasks = [], { withTimes = false, now = Date.now() } = {}) => {
  const n = cleanName(name);
  if (!n) return { ok: false, error: 'Give the template a name.' };
  const seen = new Set(); const items = [];
  for (const t of tasks || []) {
    if (!t || !t.title || t.status === 'wontdo') continue;
    const k = normTitle(t.title); if (!k || seen.has(k)) continue; seen.add(k);
    const it = { title: String(t.title).trim().slice(0, 140) };
    if (withTimes && HHMM.test(String(t.startTime || ''))) it.start = t.startTime;
    const m = Math.round(Number(t.estimateMin) || 0); if (m > 0 && m <= 600) it.durationMin = m;
    if (t.priority === 'high') it.priority = 'high';
    const p = Math.round(Number(t.points) || 0); if (p > 0) it.points = p;
    items.push(it);
    if (items.length >= MAX_TEMPLATE_ITEMS) break;
  }
  if (!items.length) return { ok: false, error: 'There are no tasks today to save.' };
  return { ok: true, template: { id: `t${now.toString(36)}`, name: n, withTimes: !!withTimes, items, savedAt: now } };
};

// Same name (case-insensitive) replaces the old one; newest first; capped.
export const upsertTemplate = (list = [], tpl) => {
  const k = normTitle(tpl.name);
  return [tpl, ...(Array.isArray(list) ? list : []).filter((x) => x && normTitle(x.name) !== k)].slice(0, MAX_TEMPLATES);
};
export const removeTemplate = (list = [], id) => (Array.isArray(list) ? list : []).filter((x) => x && x.id !== id);

// Sanitize whatever came back from storage.
export const cleanTemplates = (raw) => (Array.isArray(raw) ? raw : []).filter((x) => x && typeof x.name === 'string' && Array.isArray(x.items))
  .slice(0, MAX_TEMPLATES).map((x) => ({ id: String(x.id || `t${normTitle(x.name)}`), name: cleanName(x.name), withTimes: !!x.withTimes, savedAt: Number(x.savedAt) || 0,
    items: x.items.filter((i) => i && i.title).slice(0, MAX_TEMPLATE_ITEMS).map((i) => ({ title: String(i.title).slice(0, 140),
      ...(HHMM.test(String(i.start || '')) ? { start: i.start } : {}), ...(Number(i.durationMin) > 0 ? { durationMin: Math.round(Number(i.durationMin)) } : {}),
      ...(i.priority === 'high' ? { priority: 'high' } : {}), ...(Number(i.points) > 0 ? { points: Math.round(Number(i.points)) } : {}) })) }));

// -> { toAdd: [item], skipped: [title] } ; existing = today's tasks (any status counts as "already there").
export const applyTemplate = (tpl, existing = []) => {
  const have = new Set((existing || []).filter((t) => t && t.title).map((t) => normTitle(t.title)));
  const toAdd = []; const skipped = [];
  for (const it of (tpl && tpl.items) || []) {
    const k = normTitle(it.title); if (!k) continue;
    if (have.has(k)) { skipped.push(it.title); continue; }
    have.add(k); toAdd.push({ ...it });
  }
  return { toAdd, skipped };
};

export const applySummary = ({ added = 0, skipped = 0, blocked = 0 } = {}) => {
  const p = [];
  p.push(added ? `Added ${added} task${added === 1 ? '' : 's'}` : 'Nothing new added');
  if (skipped) p.push(`${skipped} already on today`);
  if (blocked) p.push(`${blocked} not added (daily limit)`);
  return p.join(' · ');
};
