// Community streaks, awards and badges: ONE config + pure logic (no Firebase). Tested by scripts/test-community.js.
// Streak source = the app's own streaks/{uid} doc (src/utils/streak.js). Its `streak` is display-capped at STREAK_CAP (5),
// so multi-week tiers use the uncapped run of consecutive counted days, derived from the same doc's `counted` dates (extendRun).
import { ALLOWED_GAP_DAYS, dayDiff } from '@/utils/streak';

export const STREAK_TIERS = [3, 7, 14, 30, 100];

// rank: higher = more prestigious (used to pick the top 1-3 next to a name).
export const BADGES = [
  { id: 'perfect-1', icon: '✅', name: 'Perfect Day', desc: 'Finished every task in a day', rank: 10, test: (c) => c.perfectDays >= 1 },
  { id: 'perfect-10', icon: '🌟', name: '10 Perfect Days', desc: 'Ten days with every task done', rank: 40, test: (c) => c.perfectDays >= 10 },
  { id: 'perfect-30', icon: '💎', name: '30 Perfect Days', desc: 'Thirty days with every task done', rank: 70, test: (c) => c.perfectDays >= 30 },
  { id: 'streak-3', icon: '🔥', name: '3-Day Streak', desc: '3 days in a row', rank: 20, test: (c) => c.bestRun >= 3 },
  { id: 'streak-7', icon: '⚡', name: '7-Day Streak', desc: 'A full week in a row', rank: 35, test: (c) => c.bestRun >= 7 },
  { id: 'streak-14', icon: '🚀', name: '14-Day Streak', desc: 'Two weeks in a row', rank: 50, test: (c) => c.bestRun >= 14 },
  { id: 'streak-30', icon: '🏆', name: '30-Day Streak', desc: 'A month in a row', rank: 80, test: (c) => c.bestRun >= 30 },
  { id: 'streak-100', icon: '👑', name: '100-Day Streak', desc: '100 days in a row', rank: 100, test: (c) => c.bestRun >= 100 },
  { id: 'first-post', icon: '📣', name: 'First Post', desc: 'Shared progress with the community', rank: 5, test: (c) => c.posts >= 1 },
  { id: 'posts-10', icon: '🗣️', name: 'Regular', desc: '10 community posts', rank: 25, test: (c) => c.posts >= 10 },
  { id: 'tasks-100', icon: '💯', name: '100 Tasks', desc: '100 tasks completed', rank: 30, test: (c) => c.tasksTotal >= 100 },
  { id: 'tasks-500', icon: '🏅', name: '500 Tasks', desc: '500 tasks completed', rank: 60, test: (c) => c.tasksTotal >= 500 },
  { id: 'tasks-1000', icon: '🎖️', name: '1000 Tasks', desc: '1000 tasks completed', rank: 90, test: (c) => c.tasksTotal >= 1000 },
];
export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));
export const badgeInfo = (id) => BADGE_BY_ID[id] || null;
export const knownBadges = (ids) => [...new Set((ids || []).filter((id) => BADGE_BY_ID[id]))];

const n0 = (v) => Math.max(0, Math.floor(Number(v) || 0));
export const normCtx = (c = {}) => ({ perfectDays: n0(c.perfectDays), bestRun: Math.max(n0(c.bestRun), n0(c.run)), run: n0(c.run), posts: n0(c.posts), tasksTotal: n0(c.tasksTotal) });
export const earnedBadges = (ctx) => { const c = normCtx(ctx); return BADGES.filter((b) => b.test(c)).map((b) => b.id); };
export const newBadges = (ctx, have) => { const h = new Set(have || []); return earnedBadges(ctx).filter((id) => !h.has(id)); };
export const topBadges = (ids, n = 3) => knownBadges(ids).sort((a, b) => BADGE_BY_ID[b].rank - BADGE_BY_ID[a].rank).slice(0, n);

// Highest tier reached by a run, and tiers newly crossed vs. those already prompted.
export const streakTier = (run) => STREAK_TIERS.filter((t) => n0(run) >= t).pop() || 0;
export const newStreakTiers = (run, shown) => { const s = new Set((shown || []).map(Number)); return STREAK_TIERS.filter((t) => n0(run) >= t && !s.has(t)); };

// Uncapped consecutive-day run. `counted` = sorted-or-not local dates the streak logic counted (last 62 kept).
// prev = { len, last } persisted from earlier syncs so runs longer than the 62-day window keep growing.
export const extendRun = (prev, counted, today, gap = ALLOWED_GAP_DAYS) => {
  const days = [...new Set(counted || [])].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!days.length) return { len: 0, last: null };
  const last = days[days.length - 1];
  if (today && dayDiff(last, today) > gap) return { len: 0, last }; // broken: the newest counted day is too old
  let len = 1; let i = days.length - 1;
  while (i > 0 && dayDiff(days[i - 1], days[i]) <= gap && dayDiff(days[i - 1], days[i]) > 0) { len++; i--; }
  const start = days[i];
  const p = prev && prev.last && prev.len ? prev : null;
  const joins = p && p.last < start && i === 0 && dayDiff(p.last, start) > 0 && dayDiff(p.last, start) <= gap; // run older than the 62-day window
  if (joins) len = n0(p.len) + len;
  else if (p && p.last >= start && p.last <= last) { // the earlier run is part of this chain: add the days after it
    const after = days.filter((d) => d > p.last).length;
    len = Math.max(len, n0(p.len) + after);
  }
  return { len, last };
};

// Monthly task counts -> lifetime total (map is { 'YYYY-MM': count }, keep the max seen per month).
export const mergeMonthCount = (map, mk, count) => ({ ...(map || {}), [mk]: Math.max(n0((map || {})[mk]), n0(count)) });
export const sumMonths = (map) => Object.values(map || {}).reduce((a, v) => a + n0(v), 0);

// One perfect day per local date.
export const bumpPerfect = (state, today) => (state && state.lastPerfect === today ? { ...state } : { perfectDays: n0(state && state.perfectDays) + 1, lastPerfect: today });

// Achievement keys (persisted once shown) and the combined prompt.
export const achievementKeys = ({ perfectDate = null, tiers = [], badges = [] }) => [
  ...(perfectDate ? [`perfect:${perfectDate}`] : []), ...tiers.map((t) => `tier:${t}`), ...badges.map((b) => `badge:${b}`),
];
export const pendingAchievements = ({ perfectDate = null, tiers = [], badges = [] }, shownKeys) => {
  const s = new Set(shownKeys || []);
  return {
    perfectDate: perfectDate && !s.has(`perfect:${perfectDate}`) ? perfectDate : null,
    tiers: tiers.filter((t) => !s.has(`tier:${t}`)),
    badges: badges.filter((b) => !s.has(`badge:${b}`) && !(b.startsWith('streak-') && tiers.includes(Number(b.slice(7))))), // tier prompt already covers its streak badge
  };
};
export const hasPending = (p) => !!(p && (p.perfectDate || (p.tiers && p.tiers.length) || (p.badges && p.badges.length)));

// Title for the one-tap post (and the pop-up headline).
export const achievementTitle = ({ perfectDate, tasksDone = 0, tiers = [], badges = [] }) => {
  const parts = [];
  if (perfectDate) parts.push(tasksDone > 0 ? `Finished all ${tasksDone} task${tasksDone === 1 ? '' : 's'} today 🎉` : 'Perfect day: every task done 🎉');
  const t = Math.max(0, ...tiers);
  if (t) parts.push(`${t}-day streak 🔥`);
  const b = topBadges(badges.filter((id) => !id.startsWith('streak-') || !t), 2).map((id) => `${BADGE_BY_ID[id].icon} ${BADGE_BY_ID[id].name}`);
  if (b.length) parts.push(`New badge${b.length > 1 ? 's' : ''}: ${b.join(', ')}`);
  return (parts.join(' · ') || 'New achievement 🎉').slice(0, 120);
};
// Stats card for the post: progress card + uncapped streak + up to 3 badges earned now.
export const achievementCard = (card, { run = 0, badges = [] } = {}) => {
  const out = { ...card, streak: Math.max(n0(card && card.streak), n0(run)) };
  const b = topBadges(badges, 3); if (b.length) out.badges = b;
  return out;
};
// Display-safe public profile (communityProfiles/{uid}).
export const publicCommunityProfile = ({ name, avatar, run, bestRun, badges }) => ({
  name: String(name || 'Member').slice(0, 40), avatar: String(avatar || ''), streak: n0(run), bestStreak: Math.max(n0(bestRun), n0(run)), badges: knownBadges(badges).slice(0, BADGES.length),
});
