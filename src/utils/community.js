// Community (feed + group chat): pure helpers only, no Firebase. Tested by scripts/test-community.js.
export const ADMIN_EMAIL = 'ds7513635@gmail.com';
export const LIMITS = { title: 120, text: 2000, comment: 500, chat: 1000, images: 4, imageMaxPx: 1600, imageBytes: 5 * 1024 * 1024, reason: 300, fanout: 500 };
export const EULA_VERSION = 1;
export const NOTIF_TYPES = ['follow', 'like', 'comment', 'share', 'post'];
export const DEFAULT_NOTIF_PREFS = { follow: true, like: true, comment: true, share: true, post: true };
export const SHARE_BASE = 'https://clingnot.netlify.app';

// ── Profanity filter: blocks on send. Matches whole words after leetspeak/punctuation folding so "class" or "assess" pass.
const BAD = ['fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch', 'bastard', 'asshole', 'cunt', 'dick', 'dickhead', 'pussy', 'cock', 'slut', 'whore', 'fag', 'faggot', 'nigger', 'nigga', 'retard', 'twat', 'wanker', 'kys', 'porn', 'rape', 'rapist'];
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
const fold = (s) => String(s || '').toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c]).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const words = (s) => fold(s).split(/[^a-z]+/).filter(Boolean);
export const findProfanity = (text) => {
  const w = words(text); const hits = new Set();
  for (const x of w) { const y = x.replace(/(.)\1{2,}/g, '$1$1'); if (BAD.includes(x) || BAD.includes(y) || BAD.includes(y.replace(/(.)\1+/g, '$1'))) hits.add(x); }
  // spaced-out letters: "f u c k"
  const joined = fold(text).replace(/[^a-z]/g, '');
  if (!hits.size && /(^|\s)([a-z][\s.*_-]){3,}[a-z]/.test(fold(text))) for (const b of BAD) if (b.length >= 4 && joined.includes(b)) hits.add(b);
  return [...hits];
};
export const isClean = (text) => findProfanity(text).length === 0;

// ── Validation shared by every composer (mirrors firestore.rules size limits).
export const validateText = (text, max, { allowEmpty = false } = {}) => {
  const t = String(text || '').trim();
  if (!t && !allowEmpty) return { ok: false, error: 'Write something first.' };
  if (t.length > max) return { ok: false, error: `Too long (max ${max} characters).` };
  if (!isClean(t)) return { ok: false, error: 'Please keep it respectful: that message contains language that is not allowed in Community.' };
  return { ok: true, text: t };
};

// ── Never show emails: display name, else "Member".
export const displayNameOf = (n) => (typeof n === 'string' && n.trim() && !n.includes('@') ? n.trim().slice(0, 40) : 'Member');
export const safeAvatar = (u) => (typeof u === 'string' && /^https:\/\//.test(u) && u.length <= 2048 ? u : '');

// ── Progress card built from today's stats.
export const milestoneFor = (streak) => {
  const s = Number(streak) || 0;
  // Streaks are capped at 5 days (utils/streak STREAK_CAP).
  if (s >= 5) return { stage: 'Unstoppable', icon: '🚀' };
  if (s >= 3) return { stage: 'On fire', icon: '🔥' };
  if (s >= 1) return { stage: 'Building', icon: '🌱' };
  return { stage: 'Starter', icon: '✨' };
};
export const buildProgressCard = ({ tasksDone = 0, points = 0, streak = 0 } = {}) => {
  const n = (v) => Math.max(0, Math.min(100000, Math.floor(Number(v) || 0)));
  const s = n(streak); const m = milestoneFor(s);
  return { tasksDone: n(tasksDone), points: n(points), streak: s, milestone: m.stage, icon: m.icon };
};
export const progressText = (card) => `${card.icon} Today I finished ${card.tasksDone} task${card.tasksDone === 1 ? '' : 's'}, I'm on a ${card.streak}-day streak with ${card.points} points this month (${card.milestone}).`;
export const isStatsCard = (c) => !!c && typeof c === 'object' && ['tasksDone', 'points', 'streak'].every((k) => Number.isInteger(c[k]) && c[k] >= 0) && typeof c.milestone === 'string';

// ── Blocks: hide content by/for blocked users (both directions are filtered client-side for the blocker).
export const filterBlocked = (items, blocked) => {
  const b = blocked instanceof Set ? blocked : new Set(blocked || []);
  return (items || []).filter((it) => it && !b.has(it.uid) && !b.has(it.from));
};

// ── Feed sorting. 'new' = newest first; 'liked' = most liked posted today (ties newest).
export const tsMs = (v) => (v == null ? 0 : typeof v === 'number' ? v : v.toMillis ? v.toMillis() : v.seconds != null ? v.seconds * 1000 : Date.parse(v) || 0);
export const sortFeed = (posts, mode = 'new', now = Date.now()) => {
  const list = [...(posts || [])];
  if (mode === 'liked') {
    const d = new Date(now); const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return list.filter((p) => tsMs(p.createdAt) >= start || !p.createdAt).sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0) || tsMs(b.createdAt) - tsMs(a.createdAt));
  }
  if (mode === 'foryou') { // engagement with time decay (Hacker-News style); brand-new posts still surface
    const score = (p) => ((p.likeCount || 0) + 2 * (p.commentCount || 0) + 1) / Math.pow((Math.max(0, now - (tsMs(p.createdAt) || now)) / 36e5) + 2, 1.5);
    return list.sort((a, b) => score(b) - score(a) || tsMs(b.createdAt) - tsMs(a.createdAt));
  }
  return list.sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
};
export const filterFollowing = (posts, following, me) => { const f = following instanceof Set ? following : new Set(following || []); return (posts || []).filter((p) => f.has(p.uid) || p.uid === me); };
// Chat page arrives newest-first from the query; render oldest at top, newest at the bottom.
export const chatOrder = (msgs) => [...(msgs || [])].sort((a, b) => tsMs(a.createdAt) - tsMs(b.createdAt));
export const mergeById = (a, b) => { const m = new Map(); for (const x of [...(a || []), ...(b || [])]) m.set(x.id, x); return [...m.values()]; };

// ── Likes: optimistic toggle (server applies the same delta in a transaction).
export const toggleLikeState = (post, liked) => ({ liked: !liked, likeCount: Math.max(0, (post.likeCount || 0) + (liked ? -1 : 1)) });

// ── Client-side rate limiter (sliding window per action). Rules enforce shapes; this throttles spam.
export const RATE = { post: { max: 3, windowMs: 10 * 60 * 1000, minGapMs: 20000 }, chat: { max: 8, windowMs: 60 * 1000, minGapMs: 1500 }, comment: { max: 6, windowMs: 60 * 1000, minGapMs: 3000 }, report: { max: 10, windowMs: 60 * 60 * 1000, minGapMs: 0 } };
export const createRateLimiter = (cfg = RATE, store = null) => {
  const hist = (store && store.load && store.load()) || {};
  return {
    check(action, now = Date.now()) {
      const c = cfg[action]; if (!c) return { ok: true };
      const h = (hist[action] || []).filter((t) => now - t < c.windowMs);
      const last = h[h.length - 1];
      if (last != null && now - last < c.minGapMs) return { ok: false, waitMs: c.minGapMs - (now - last), error: 'Slow down a little.' };
      if (h.length >= c.max) return { ok: false, waitMs: c.windowMs - (now - h[0]), error: 'You are posting too fast. Try again in a bit.' };
      return { ok: true };
    },
    hit(action, now = Date.now()) {
      const c = cfg[action]; if (!c) return;
      hist[action] = [...(hist[action] || []).filter((t) => now - t < c.windowMs), now];
      if (store && store.save) store.save(hist);
    },
  };
};

// ── Image downscale target (keeps aspect, longest side <= max).
export const fitWithin = (w, h, max = LIMITS.imageMaxPx) => { const s = Math.min(1, max / Math.max(w, h || 1)); return { w: Math.round(w * s), h: Math.round(h * s) }; };

// ── Share
export const postLink = (id) => `${SHARE_BASE}/community?post=${String(id).replace(/[^A-Za-z0-9_-]/g, '')}`;
export const shareTextFor = (post) => { const t = (post.title || post.text || 'My progress').slice(0, 140); return `${t} — on ClingNote Community`; };

// ── Notifications
export const notifText = (type, name, extra = '') => {
  const n = displayNameOf(name);
  return ({ follow: `${n} started following you`, like: `${n} liked your post`, comment: `${n} commented: ${String(extra).slice(0, 80)}`, share: `${n} shared your post`, post: `${n} posted: ${String(extra).slice(0, 80)}` })[type] || '';
};
export const buildNotif = ({ type, from, fromName, to, postId = null, extra = '' }) => {
  if (!NOTIF_TYPES.includes(type) || !from || !to || from === to) return null;
  return { type, from, fromName: displayNameOf(fromName), postId: postId || null, text: notifText(type, fromName, extra).slice(0, 140), read: false };
};
export const fanoutTargets = (followerUids, me, cap = LIMITS.fanout) => [...new Set((followerUids || []).filter((u) => u && u !== me))].slice(0, cap);
export const visibleNotifs = (list, blocked, prefs = DEFAULT_NOTIF_PREFS) => filterBlocked(list, blocked).filter((n) => prefs[n.type] !== false);
export const unreadCount = (list) => (list || []).filter((n) => !n.read).length;
export const isAdminEmail = (email) => String(email || '').toLowerCase() === ADMIN_EMAIL;
export const followId = (from, to) => `${from}_${to}`;
