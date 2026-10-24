// Streak tiers / badges / Perfect Day -> one combined "Share to Community?" pop-up (src/components/AchievementPrompt.vue).
// Data: the app's existing streaks/{uid} doc (read-only here), monthly stats, and the private users/{uid}/community/prefs.ach
// (mirrored to localStorage so prompts are still shown once while the community rules are not deployed).
import { reactive } from 'vue';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import * as C from '@/composables/useCommunity';
import { loadMyMonth } from '@/composables/useMonthlyStats';
import { getPublicProfile } from '@/composables/usePublicProfile';
import { monthKey } from '@/utils/ranking';
import { localDateStr, evaluateStreak, todayCount } from '@/utils/streak';
import { EULA_VERSION, LIMITS, validateText, createRateLimiter, displayNameOf, safeAvatar } from '@/utils/community';
import { extendRun, mergeMonthCount, sumMonths, bumpPerfect, earnedBadges, newStreakTiers, pendingAchievements, hasPending, achievementKeys, achievementTitle, achievementCard, publicCommunityProfile, knownBadges } from '@/utils/badges';

export const ach = reactive({ open: false, pending: null, title: '', card: null, needEula: false, eulaTick: false, busy: false, error: '', toast: null });
const lsKey = (uid) => `cm.ach.${uid}`;
const lsGet = (uid) => { try { return JSON.parse(localStorage.getItem(lsKey(uid)) || '{}'); } catch (e) { return {}; } };
const lsSet = (uid, v) => { try { localStorage.setItem(lsKey(uid), JSON.stringify(v)); } catch (e) { /* ignore */ } };
export const limiter = createRateLimiter(undefined, { load: () => { try { return JSON.parse(localStorage.getItem('cm.rate') || '{}'); } catch (e) { return {}; } }, save: (x) => localStorage.setItem('cm.rate', JSON.stringify(x)) });

// Merge two persisted states (server prefs.ach + local mirror) without losing progress or shown keys.
export const mergeAch = (a = {}, b = {}) => ({
  perfectDays: Math.max(a.perfectDays || 0, b.perfectDays || 0), lastPerfect: [a.lastPerfect, b.lastPerfect].filter(Boolean).sort().pop() || null,
  run: ((a.run && a.run.last) || '') >= ((b.run && b.run.last) || '') ? (a.run || b.run || null) : b.run,
  bestRun: Math.max(a.bestRun || 0, b.bestRun || 0), monthCounts: { ...(b.monthCounts || {}), ...(a.monthCounts || {}) },
  shown: [...new Set([...(a.shown || []), ...(b.shown || [])])].slice(-300), badges: knownBadges([...(a.badges || []), ...(b.badges || [])]),
  autoPostDate: [a.autoPostDate, b.autoPostDate].filter(Boolean).sort().pop() || null,
});

let ctx = null; let running = null; let wantPerfect = false;
// Called by the all-done celebration and on streak doc changes. Returns the pending achievements (or null).
export async function syncAchievements({ perfect = false } = {}) {
  wantPerfect = wantPerfect || perfect;
  if (running) return running.then(() => (wantPerfect ? syncAchievements({}) : null));
  const u = auth.currentUser; if (!u) return null;
  const isPerfect = wantPerfect; wantPerfect = false;
  running = (async () => {
    const uid = u.uid; const today = localDateStr();
    let prefs = {}; try { prefs = await C.loadPrefs(uid); } catch (e) { /* rules not deployed */ }
    const st = mergeAch(prefs.ach || {}, lsGet(uid));
    let sd = {}; try { const s = await getDoc(doc(db, 'streaks', uid)); sd = s.exists() ? s.data() : {}; } catch (e) { /* ignore */ }
    const ev = evaluateStreak(sd, today);
    let run = extendRun(st.run, sd.counted, today); if (ev.status === 'broken' || ev.status === 'none') run = { ...run, len: Math.min(run.len, ev.streak) };
    const bestRun = Math.max(st.bestRun || 0, run.len, Number(sd.bestStreak) || 0);
    let monthCounts = st.monthCounts || {};
    try { const m = await loadMyMonth(uid, monthKey()); monthCounts = mergeMonthCount(monthCounts, monthKey(), m && m.stats && m.stats.count); } catch (e) { /* ignore */ }
    const pf = isPerfect ? bumpPerfect(st, today) : { perfectDays: st.perfectDays || 0, lastPerfect: st.lastPerfect || null };
    let posts = 0; try { posts = await C.myPostCount(uid); } catch (e) { posts = (st.badges || []).includes('first-post') ? 1 : 0; }
    const c = { perfectDays: pf.perfectDays, run: run.len, bestRun, posts, tasksTotal: sumMonths(monthCounts) };
    const earned = earnedBadges(c); const fresh = earned.filter((id) => !(st.badges || []).includes(id));
    const raw = { perfectDate: isPerfect ? today : null, tiers: newStreakTiers(run.len, (st.shown || []).filter((k) => k.startsWith('tier:')).map((k) => Number(k.slice(5)))), badges: fresh };
    const pending = pendingAchievements(raw, st.shown);
    const next = { ...st, ...pf, run, bestRun, monthCounts, badges: knownBadges([...(st.badges || []), ...earned]), shown: [...new Set([...(st.shown || []), ...achievementKeys(pending)])].slice(-300) };
    lsSet(uid, next);
    try { await C.savePrefs(uid, { ach: next }); } catch (e) { /* rules not deployed */ }
    let name = displayNameOf(u.displayName); let avatar = safeAvatar(u.photoURL);
    try { const p = await getPublicProfile(uid); if (p) { name = displayNameOf(p.name || u.displayName); avatar = safeAvatar(p.avatarURL || u.photoURL); } } catch (e) { /* ignore */ }
    try { await C.saveCommunityProfile(uid, publicCommunityProfile({ name, avatar, run: run.len, bestRun, badges: next.badges })); } catch (e) { /* rules not deployed */ }
    ctx = { uid, name, avatar, run: run.len, tasksDone: todayCount(sd, today), eulaOk: Number(prefs.eulaVersion) >= EULA_VERSION || localStorage.getItem(`cm.eula.${uid}`) === String(EULA_VERSION), autoPostDate: next.autoPostDate };
    if (!hasPending(pending)) return null;
    if (pending.perfectDate && next.autoPostDate === today) pending.perfectDate = null; // already auto-posted today
    if (!hasPending(pending)) return null;
    const card = achievementCard(await C.loadTodayStats(uid), { run: run.len, badges: [...pending.badges, ...pending.tiers.map((t) => `streak-${t}`)] });
    Object.assign(ach, { open: true, pending, card, title: achievementTitle({ ...pending, tasksDone: card.tasksDone || ctx.tasksDone }), needEula: false, eulaTick: false, error: '', busy: false });
    return pending;
  })();
  try { return await running; } finally { running = null; }
}

export const dismiss = () => { ach.open = false; ach.pending = null; };

// One tap: post now (EULA first if needed). Respects the post rate limit, the profanity filter and one auto-post per day.
export async function shareAchievement() {
  if (!ctx || !ach.pending || ach.busy) return;
  if (!ctx.eulaOk) {
    if (!ach.needEula) { ach.needEula = true; return; }
    if (!ach.eulaTick) { ach.error = 'Please accept the community terms first.'; return; }
    localStorage.setItem(`cm.eula.${ctx.uid}`, String(EULA_VERSION)); ctx.eulaOk = true;
    try { await C.savePrefs(ctx.uid, { eulaVersion: EULA_VERSION, eulaAcceptedAt: new Date().toISOString() }); } catch (e) { /* ignore */ }
  }
  const today = localDateStr();
  if (ach.pending.perfectDate && ctx.autoPostDate === today && !ach.pending.tiers.length && !ach.pending.badges.length) { ach.error = 'Already shared today.'; return; }
  const r = limiter.check('post'); if (!r.ok) { ach.error = r.error; return; }
  const t = validateText(ach.title, LIMITS.title); if (!t.ok) { ach.error = t.error; return; }
  ach.busy = true; ach.error = '';
  try {
    const me = { uid: ctx.uid, name: ctx.name, avatar: ctx.avatar };
    const id = await C.createPost(me, { title: t.text, text: '', images: [], stats: ach.card });
    limiter.hit('post');
    if (ach.pending.perfectDate) { ctx.autoPostDate = today; const s = { ...lsGet(ctx.uid), autoPostDate: today }; lsSet(ctx.uid, s); try { await C.savePrefs(ctx.uid, { ach: s }); } catch (e) { /* ignore */ } }
    C.notifyFollowers(me, id, t.text).catch(() => {});
    dismiss(); ach.toast = { text: 'Shared to Community 🎉', postId: id }; setTimeout(() => { if (ach.toast && ach.toast.postId === id) ach.toast = null; }, 6000);
  } catch (e) { console.warn(e); ach.error = 'Could not post. Please try again.'; } finally { ach.busy = false; }
}
