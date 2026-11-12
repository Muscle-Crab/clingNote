// Guideline 1.2 helpers for Community and other user-posted content. Pure: no Firebase.
import { isClean } from './community.js';
import { SUPPORT_EMAIL } from '../config/support.js';

export const UGC_MIN_AGE = 18;
export const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const CONTACT_EMAIL = SUPPORT_EMAIL;
export const CONTACT_LINE = `Report inappropriate activity: ${SUPPORT_EMAIL}. Reports are reviewed within 24 hours.`;

// null = age was never stored. false = under 18. true = 18 or older.
export const ageAllowsUgc = (age) => {
  if (age === null || age === undefined || age === '') return null;
  const n = Number(age);
  if (!Number.isFinite(n)) return null;
  return n >= UGC_MIN_AGE;
};

// Stored age wins. A typed age under 18 cannot be clicked past. No age yet needs an explicit 18+ confirm.
export const ugcAgeDecision = ({ age, confirmed = false } = {}) => {
  const known = ageAllowsUgc(age);
  if (known === false) return { ok: false, reason: 'under' };
  if (known === true) return { ok: true, reason: 'age' };
  if (confirmed) return { ok: true, reason: 'confirmed' };
  return { ok: false, reason: 'need-confirm' };
};

const normWords = (words) => [...new Set((Array.isArray(words) ? words : String(words || '').split(/[,\n]/))
  .map((w) => String(w || '').trim().toLowerCase()).filter((w) => w.length >= 2))].slice(0, 40);

// Hide a post, comment, chat line, or profile blurb that fails the profanity list or the viewer's own filter words.
export const contentVisible = (item, extraWords = []) => {
  if (!item) return false;
  const text = [item.text, item.title, item.topic, item.message, item.name].filter((s) => typeof s === 'string' && s).join('\n');
  if (text && !isClean(text)) return false;
  const extra = normWords(extraWords);
  if (!extra.length || !text) return true;
  const fold = text.toLowerCase();
  return !extra.some((w) => fold.includes(w));
};

export const filterVisible = (items, extraWords = []) => (items || []).filter((it) => contentVisible(it, extraWords));

const msOf = (v) => (v == null ? 0 : typeof v === 'number' ? v : v.toMillis ? v.toMillis() : v.seconds != null ? v.seconds * 1000 : Date.parse(v) || 0);

// Developer action is due 24 hours after the report. overdue means that window has passed.
export const reportDeadline = (createdAt, now = Date.now()) => {
  const t = msOf(createdAt);
  return t > 0 ? t + REPORT_WINDOW_MS : 0;
};
export const reportOverdue = (createdAt, now = Date.now()) => {
  const due = reportDeadline(createdAt, now);
  return due > 0 && now >= due;
};

// Every open objectionable-content report is remove-the-content plus eject-the-author, inside 24 hours.
export const moderationPlan = (report) => {
  const type = report && report.targetType;
  return {
    remove: type === 'post' || type === 'comment' || type === 'chat',
    eject: !!(report && report.targetUid),
    withinHours: 24,
  };
};
