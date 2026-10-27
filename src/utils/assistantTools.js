// ClingNote assistant: pure client-side tool validation (no Firebase here, unit-tested in scripts/test-assistant.js).
// Server: netlify/functions/ai.js task 'agent' (declarations in netlify/functions/lib/agentTools.js). Tools execute in HomeView
// through the SAME code paths as the UI (daily limit, lock rules, Firestore rules, notifications all still apply).
import { normalizeItems } from './voiceIntent';
import { estimateFor } from './taskEstimate';
import { clampHours } from './eightHour';
import { validateText, LIMITS } from './community';
import { repeatFields } from './assistantExtras';

// Never run without an explicit user confirm (tap or spoken yes). A model-supplied "confirmed" flag is ignored.
export const CONFIRM_TOOLS = new Set(['delete_task', 'complete_task', 'start_day', 'post_to_community', 'roll_unfinished', 'auto_schedule']);
export const BRAIN_DUMP_MIN = 3; // a create_tasks call with this many items is a brain dump: review card before saving
export const needsConfirm = (name, args = {}) => CONFIRM_TOOLS.has(name) || (name === 'create_tasks' && (args.items || []).length >= BRAIN_DUMP_MIN) || (name === 'app_lock' && args.action === 'emergency_unlock');
export const READ_TOOLS = new Set(['get_overview', 'navigate', 'get_stats', 'find_tasks', 'suggest_next', 'get_habits']);
export const PAGES = { home: '/home', upcoming: '/upcoming', rankings: '/rankings', community: '/community', discipline: '/discipline', pals: '/pals', about: '/about', support: '/support', paywall: '/paywall' };
export const SETTINGS = ['sounds', 'boss_voice', 'spoken_replies'];
export const MAX_CREATE = 15;
const okT = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const okD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// Dynamic task points: the model's value (or the user's spoken number) clamped to the app range 5..150; missing -> the existing estimator
// (taskEstimate.estimateFor: complexity x minutes), never a flat 10.
export const clampPoints = (n) => { const v = Math.round(Number(n)); return Number.isFinite(v) && v > 0 ? Math.min(150, Math.max(5, v)) : 0; };
export const clampComplexity = (n) => { const v = Math.round(Number(n)); return Number.isFinite(v) && v > 0 ? Math.min(5, Math.max(1, v)) : 0; };
export const pointsForItem = (it = {}) => {
  const ai = clampPoints(it.points);
  const est = estimateFor({ title: it.title || '', notes: it.notes || '', priority: it.priority || '', estimateMin: it.durationMin || it.estimateMin || 0 });
  return ai ? { points: ai, complexity: clampComplexity(it.complexity) || est.complexity, pointsSource: 'ai' } : { points: est.points, complexity: est.complexity, pointsSource: 'heuristic' };
};

// Compact context for the model: tasks get short refs ("t1"...) mapped back to the real task by key on the client.
export const taskKeyOf = (t) => (t && t.id) || `${t && t.createdAt}|${t && t.title}`;
export const buildContext = ({ tasks = [], now = new Date(), tz = '', pro = false, limit = null, streak = 0, points = 0, target = null, hours = 8, lock = null, upcoming = [], settings = {}, route = '/home' } = {}) => {
  const refs = {};
  const list = (tasks || []).slice(0, 50).map((t, i) => {
    const ref = `t${i + 1}`; refs[ref] = taskKeyOf(t);
    return { ref, title: String(t.title || '').slice(0, 120), done: !!t.completed, start: t.startTime || '', minutes: Number(t.estimateMin || t.minutes) || 0, points: Number(t.points) || 0, boss: !!t.boss, timer: !!t.timerActive, priority: t.priority || '' };
  });
  const p = (n) => String(n).padStart(2, '0');
  return { refs, context: { now: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`, tz, pro: !!pro,
    limit, streak, pointsToday: points, bossTarget: target, hoursToday: hours, lock, tasks: list,
    upcoming: (upcoming || []).slice(0, 15).map((e) => ({ title: String(e.title || '').slice(0, 80), date: e.scheduledDate || e.date || '', time: e.scheduledTime || e.time || '' })), settings, route } };
};

// -> { ok, args } | { ok:false, error } . refs: { t1: key }, tasksByKey: Map(key -> task)
export const validateCall = (name, args = {}, { refs = {}, tasksByKey = new Map(), today = '', limitRemaining = null } = {}) => {
  const a = args && typeof args === 'object' ? args : {};
  const task = () => { const k = refs[String(a.ref || '')]; return k && tasksByKey.has(k) ? tasksByKey.get(k) : null; };
  const needTask = () => { const t = task(); return t ? { ok: true, task: t } : { ok: false, error: `Unknown task ref "${a.ref}". Use get_overview.` }; };
  switch (name) {
    case 'create_tasks': {
      const raw = (Array.isArray(a.items) ? a.items : []).slice(0, MAX_CREATE);
      const items = normalizeItems(raw).map((it, i) => ({ ...it, ...pointsForItem({ ...raw[i], ...it }), priority: raw[i] && raw[i].priority === 'high' ? 'high' : '' }))
        .map((it, i) => { const rep = raw[i] && repeatFields(raw[i].repeat, raw[i].days); return rep ? { ...it, type: 'schedule', date: it.date || today, start: it.start || '09:00', repeat: rep.repeat, days: rep.days.length ? rep.days : undefined } : it; });
      if (!items.length) return { ok: false, error: 'No valid items.' };
      const counted = items.filter((x) => x.type !== 'reminder').length;
      if (limitRemaining != null && counted > limitRemaining) return { ok: false, error: `Daily limit: only ${Math.max(0, limitRemaining)} more task(s) today (5/day on free and Pro).`, limit: true };
      return { ok: true, args: { items } };
    }
    case 'edit_task': {
      const r = needTask(); if (!r.ok) return r;
      const patch = {};
      if (typeof a.title === 'string' && a.title.trim()) patch.title = a.title.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 140);
      if (a.durationMin != null) { const m = Math.round(Number(a.durationMin)); if (m > 0 && m <= 600) patch.estimateMin = m; }
      if (a.start != null) { if (a.start === '' || okT(a.start)) patch.startTime = a.start; }
      if (typeof a.notes === 'string') patch.notes = a.notes.slice(0, 1000);
      if (a.priority === 'high' || a.priority === '') patch.priority = a.priority;
      const pts = clampPoints(a.points); if (pts) { patch.points = pts; patch.pointsSource = 'ai'; }
      const cx = clampComplexity(a.complexity); if (cx) patch.complexity = cx;
      if (!Object.keys(patch).length) return { ok: false, error: 'Nothing to change.' };
      return { ok: true, args: { task: r.task, patch } };
    }
    case 'reschedule_task': {
      const r = needTask(); if (!r.ok) return r;
      if (a.date && !okD(a.date)) return { ok: false, error: 'Bad date.' };
      if (a.time && !okT(a.time)) return { ok: false, error: 'Bad time.' };
      if (a.date && today && a.date < today) return { ok: false, error: 'Date is in the past.' };
      if (!a.date && !a.time) return { ok: false, error: 'Give a date or time.' };
      return { ok: true, args: { task: r.task, date: a.date && a.date !== today ? a.date : '', time: a.time || '' } };
    }
    case 'delete_task': case 'complete_task': { const r = needTask(); if (!r.ok) return r; if (name === 'complete_task' && r.task.completed) return { ok: false, error: 'Already done.' }; return { ok: true, args: { task: r.task } }; }
    case 'start_timer': { const r = needTask(); if (!r.ok) return r; const m = Math.round(Number(a.minutes)) || Number(r.task.estimateMin) || Number(r.task.minutes) || 25; return { ok: true, args: { task: r.task, minutes: Math.min(600, Math.max(1, m)) } }; }
    case 'set_boss_checkin': { const r = needTask(); if (!r.ok) return r; return { ok: true, args: { task: r.task, on: !!a.on } }; }
    case 'start_day': case 'set_day_hours': { const h = Number(a.hours); if (!Number.isFinite(h) || h <= 0) return { ok: false, error: 'Ask the user how many hours.' }; return { ok: true, args: { hours: clampHours(h) } }; }
    case 'set_setting': return SETTINGS.includes(a.setting) ? { ok: true, args: { setting: a.setting, on: !!a.on } } : { ok: false, error: 'Unknown setting.' };
    case 'navigate': return PAGES[a.page] ? { ok: true, args: { path: PAGES[a.page] } } : { ok: false, error: 'Unknown page.' };
    case 'get_overview': case 'get_stats': case 'suggest_next': case 'get_habits': case 'roll_unfinished': return { ok: true, args: {} };
    case 'auto_schedule': return { ok: true, args: { writeCalendar: !!a.write_calendar } };
    case 'add_habit': case 'log_habit': { const n = String(a.name || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 60); return n ? { ok: true, args: { name: n, done: a.done !== false } } : { ok: false, error: 'Which habit?' }; }
    case 'place_reminder': {
      const title = String(a.title || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120); const place = String(a.place || '').trim().slice(0, 40).toLowerCase();
      if (!title || !place) return { ok: false, error: 'Need a task and a place.' };
      return { ok: true, args: { title, place, saveHere: !!a.save_here } };
    }
    case 'app_lock': return ['status', 'pick_apps', 'emergency_unlock', 'turn_off'].includes(a.action) ? { ok: true, args: { action: a.action } } : { ok: false, error: 'Unknown action.' };
    case 'find_tasks': { const q = String(a.query || '').slice(0, 80).trim(); const d = String(a.day || '').slice(0, 12).trim(); return q || d ? { ok: true, args: { query: q, day: d } } : { ok: false, error: 'Say what to look for.' }; }
    case 'snooze_task': { const r = needTask(); if (!r.ok) return r; const m = Math.round(Number(a.minutes)); if (!(m > 0 && m <= 1440)) return { ok: false, error: 'Minutes 1..1440.' }; return { ok: true, args: { task: r.task, minutes: m } }; }
    case 'add_subtasks': { const r = needTask(); if (!r.ok) return r; const items = (Array.isArray(a.items) ? a.items : []).map((x) => String(x || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 100)).filter(Boolean).slice(0, 12); return items.length ? { ok: true, args: { task: r.task, items } } : { ok: false, error: 'No subtasks.' }; }
    case 'post_to_community': {
      const text = String(a.text || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim();
      const v = validateText(text, LIMITS.text);
      if (!v.ok) return { ok: false, error: v.error };
      return { ok: true, args: { text: v.text, includeStats: !!a.include_stats } };
    }
    default: return { ok: false, error: `Unknown tool ${name}.` };
  }
};

// Human-readable draft for the confirm card.
export const describeCall = (name, args = {}) => {
  const t = args.task ? `"${args.task.title}"` : '';
  switch (name) {
    case 'delete_task': return `Delete ${t}?`;
    case 'complete_task': return `Mark ${t} as done?`;
    case 'start_day': return `Start today's lock-in for ${args.hours} hours (ends ${args.hours}h from now)?`;
    case 'create_tasks': return `Add these ${(args.items || []).length} tasks?\n\n${(args.items || []).map((it, i) => `${i + 1}. ${it.title}${it.start ? ` at ${it.start}` : ''}${it.date ? ` (${it.date})` : ''}${it.points ? ` · ${it.points} pts` : ''}`).join('\n')}\n\nSay yes, or tell me what to change.`;
    case 'roll_unfinished': return 'Move all of today\'s unfinished tasks to tomorrow?';
    case 'auto_schedule': return `Put today's open tasks into your free time${args.writeCalendar ? ' and add them to your calendar' : ''}?`;
    case 'app_lock': return `Emergency unlock your blocked apps? It costs points, and your robot will remember.`;
    case 'post_to_community': return `Post to ClingNote Community:\n\n${args.text}${args.includeStats ? '\n\n(+ today\'s progress card)' : ''}`;
    default: return name;
  }
};
// Spoken "yes"/"no" for a pending confirm.
export const spokenConfirm = (text) => {
  const s = String(text || '').toLowerCase().replace(/[^a-z' ]/g, ' ').trim();
  if (/^(yes|yeah|yep|yup|sure|ok|okay|confirm|do it|go ahead|post it|delete it|please do|absolutely)\b/.test(s)) return 'yes';
  if (/^(no|nope|nah|cancel|stop|don't|do not|never mind|nevermind)\b/.test(s)) return 'no';
  return null;
};
// Spoken replies: first ~2 sentences.
export const ttsText = (t, max = 2) => (String(t || '').replace(/[*_#`>]/g, '').match(/[^.!?]+[.!?]*/g) || []).slice(0, max).map((x) => x.trim()).join(' ').trim();
