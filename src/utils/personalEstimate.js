// Personalized estimates: each completed timed task records its actual minutes under a topic key ('car inspection' -> 'inspection');
// new estimates blend the AI/local topic estimate with an EWMA of the user's actual times: w = n/(n+3), round5.
// Stored per user on users/{uid}.estHistory = { [key]: [minutes, ...] } (last 20; outliers ignored). The overtime penalty is untouched:
// it still uses the time confirmed at start (timerDurationMinutes).
import { round5 } from './aiEstimate.js';

export const MAX_ENTRIES = 20;
export const ALPHA = 0.3; // EWMA weight of the newest entry
const TOPICS = [
  ['inspection', /\b(inspect(ion)?s?|audit|walk-?through|site visit)\b/], ['moving', /\b(mov(e|ing)|pack(ing)? (up|boxes))\b/],
  ['interview', /\binterview/], ['appointment', /\b(doctor|dentist|appointment|checkup|vet|dmv|passport)\b/],
  ['assemble', /\bassembl/], ['workout', /\b(gym|workout|run|jog|exercise|yoga|lift)\b/], ['email', /\b(e-?mails?|inbox)\b/],
  ['clean', /\b(clean|tidy|vacuum|mop|dust|declutter)\w*/], ['laundry', /\b(laundry|fold (the )?clothes)\b/], ['dishes', /\bdish(es)?\b/],
  ['cook', /\b(cook|meal prep|bake|dinner|lunch|breakfast)\w*/], ['groceries', /\b(grocer(y|ies)|shopping)\b/], ['study', /\b(study|homework|revise|exam)\w*/],
  ['read', /\bread(ing)?\b/], ['write', /\b(write|writing|essay|report|draft)\b/], ['call', /\b(call|phone)\b/], ['meeting', /\bmeeting\b/],
  ['code', /\b(code|coding|program(ming)?|debug|deploy)\b/], ['budget', /\b(budget|bills?|taxes?|invoice)\b/],
];
const STOP = new Set(['the', 'a', 'an', 'my', 'to', 'for', 'of', 'and', 'with', 'on', 'in', 'at', 'up', 'do', 'go', 'get', 'finish', 'start', 'some', 'new', 'old', 'quick', 'big']);
// Topic key: known keyword family, else the last meaningful word (singular), else ''.
export const topicKey = (title = '') => {
  const t = ` ${String(title).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')} `;
  for (const [k, re] of TOPICS) if (re.test(t)) return k;
  const w = t.split(/\s+/).filter((x) => x.length > 2 && !STOP.has(x) && !/^\d+$/.test(x)).pop() || '';
  return w.replace(/(?<=[^s])s$/, '').slice(0, 40);
};
// Outlier rule: under 1 min, or more than 4x the estimate, is ignored.
export const isOutlier = (actualMin, estMin) => !(actualMin >= 1) || (Number(estMin) > 0 && actualMin > 4 * Number(estMin));
// History map -> new map with the entry appended (last 20), or the same map when ignored.
export const recordActual = (hist = {}, key, actualMin, estMin) => {
  const a = Math.round(Number(actualMin) * 10) / 10;
  if (!key || !Number.isFinite(a) || isOutlier(a, estMin)) return hist;
  return { ...hist, [key]: [...(Array.isArray(hist[key]) ? hist[key] : []), a].slice(-MAX_ENTRIES) };
};
export const ewma = (xs = []) => xs.reduce((m, x, i) => (i === 0 ? x : ALPHA * x + (1 - ALPHA) * m), 0);
export const personalize = (baseMin, entries = []) => {
  const xs = (entries || []).filter((x) => Number(x) > 0); const n = xs.length;
  if (!n || !(baseMin > 0)) return baseMin;
  const w = n / (n + 3); return round5((1 - w) * baseMin + w * ewma(xs));
};
// Signed-in user's history (loaded from users/{uid}.estHistory by HomeView); estimators read it through personalFor().
let HIST = {};
export const setEstimateHistory = (h) => { HIST = h && typeof h === 'object' ? h : {}; };
export const estimateHistory = () => HIST;
export const personalFor = (title, baseMin) => personalize(baseMin, HIST[topicKey(title)]);
