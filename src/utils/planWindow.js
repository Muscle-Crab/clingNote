// Planning the next session during the post-session shutdown (pure + a tiny reactive state).
// While ClingNote is shut (a session ended and no new one has started) the task screens stay behind the shutdown screen, EXCEPT:
//   - completing tasks always works (any day, widget / notification / in-app), see eightHourLock.js;
//   - "Plan next session" on the shutdown screen opens Home on the day the next session will run, any time (no clock window).
import { reactive } from 'vue';

export const PLAN_OPEN_DEFAULT = '20:00';
let planTime = PLAN_OPEN_DEFAULT; // the signed-in user's Settings value (users/{uid}.planOpenTime), mirrored by lockIn.js
export const setPlanTime = (t) => { planTime = planTimeOrDefault(t); };
export const getPlanTime = () => planTime;
export const PLAN_SEEN_KEY = 'clingnote.planWin.seen';
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const validPlanTime = (s) => HHMM.test(String(s || ''));
export const planTimeOrDefault = (s) => (validPlanTime(s) ? s : PLAN_OPEN_DEFAULT);
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // same short names as routine docs / lock.dayName

// Local wall clock of `ms` in `tz` -> { ymd, min (minutes since local midnight), dow }
export const localParts = (ms, tz) => {
  let p;
  try { p = new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(ms)); } catch (e) { p = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(ms)); }
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  return { ymd: `${g('year')}-${g('month')}-${g('day')}`, min: (Number(g('hour')) % 24) * 60 + Number(g('minute')), dow: WEEK.indexOf(g('weekday')) };
};

// -> { open, eveningKey, tomorrowDay }. State-based, no clock: planning the next session is open the whole time ClingNote is shut
// (after a session ends, until a new one starts). eveningKey = the ended session's key (one planning pass per session), tomorrowDay =
// the weekday the NEXT session runs on = today's local weekday (a new session starts the moment the user starts it).
// planTime is accepted for compatibility and ignored (the 8 PM-to-midnight window was removed).
export const planWindowState = ({ nowMs, shut, tz, key }) => {
  const lp = localParts(nowMs, tz);
  return { open: !!shut, eveningKey: key || lp.ymd, tomorrowDay: WEEK[lp.dow], openTime: '' };
};

// Auto-open at most once per evening.
export const shouldAutoOpen = ({ open, eveningKey, seenKey }) => !!open && seenKey !== eveningKey;

// Reactive UI state: active = the user is in the window right now (overlay hidden, Home on tomorrow's tab).
export const planWin = reactive({ active: false, eveningKey: '' });
export const readSeen = () => { try { return localStorage.getItem(PLAN_SEEN_KEY) || ''; } catch (e) { return ''; } };
export const markSeen = (k) => { try { localStorage.setItem(PLAN_SEEN_KEY, k); } catch (e) { /* ignore */ } };
