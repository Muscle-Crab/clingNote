// Tomorrow's planning window during the post-lock-in shutdown (pure + a tiny reactive state).
// While ClingNote is shut (the hard stop after a lock-in) the task screens stay closed, EXCEPT:
//   - completing tasks always works (any day, widget / notification / in-app), see eightHourLock.js;
//   - from the user's plan time (default 8:00 PM local, Settings > Lock-in > "Plan tomorrow at") until a HARD CLOSE at midnight,
//     the planning window opens Home on tomorrow's tab so tomorrow can be planned. It opens by itself once per evening (in the
//     foreground at that time, or on the next open that evening). At 00:00 it closes; tomorrow-planning is gone until the next day starts.
// If the shutdown begins after the plan time (late lock-in), the window opens as soon as the shutdown starts (same midnight close).
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

// -> { open, eveningKey, tomorrowDay } ; open only while shut AND local time in [planTime, 24:00).
export const planWindowState = ({ nowMs, shut, planTime, tz }) => {
  const t = planTimeOrDefault(planTime); const at = Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const lp = localParts(nowMs, tz);
  const open = !!shut && lp.min >= at; // the local day rolls over at midnight -> min resets -> hard close
  return { open, eveningKey: lp.ymd, tomorrowDay: WEEK[(lp.dow + 1) % 7], openTime: t };
};

// Auto-open at most once per evening.
export const shouldAutoOpen = ({ open, eveningKey, seenKey }) => !!open && seenKey !== eveningKey;

// Reactive UI state: active = the user is in the window right now (overlay hidden, Home on tomorrow's tab).
export const planWin = reactive({ active: false, eveningKey: '' });
export const readSeen = () => { try { return localStorage.getItem(PLAN_SEEN_KEY) || ''; } catch (e) { return ''; } };
export const markSeen = (k) => { try { localStorage.setItem(PLAN_SEEN_KEY, k); } catch (e) { /* ignore */ } };
