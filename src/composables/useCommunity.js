// Community data layer (Firestore). Pure logic lives in @/utils/community.
import { auth, db } from '@/firebaseConfig';
import { collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp, runTransaction, writeBatch, getCountFromServer, increment } from 'firebase/firestore';
import { LIMITS, EULA_VERSION, fitWithin, buildNotif, fanoutTargets, followId, buildProgressCard, validateText } from '@/utils/community';
import { ugcAgeDecision, moderationPlan } from '@/utils/communitySafety';
import { loadMyMonth } from '@/composables/useMonthlyStats';
import { monthKey } from '@/utils/ranking';
import { localDateStr, todayCount, capStreak } from '@/utils/streak';

export const PAGE = 20;
const postsCol = () => collection(db, 'communityPosts');
const chatCol = () => collection(db, 'communityChat');

// ── Prefs (EULA acceptance + notification toggles): users/{uid}/community/prefs
const prefsRef = (uid) => doc(db, 'users', uid, 'community', 'prefs');
export const loadPrefs = async (uid) => { const s = await getDoc(prefsRef(uid)); return s.exists() ? s.data() : {}; };
export const savePrefs = (uid, patch) => setDoc(prefsRef(uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
const banRef = (uid) => doc(db, 'communityBans', uid);
export const loadUgcAccess = async (uid) => {
  let age = null; let confirmed = false;
  try { const s = await getDoc(doc(db, 'users', uid)); if (s.exists()) { const d = s.data() || {}; age = d.age; confirmed = d.ugcAge18 === true; } } catch (e) { /* ignore */ }
  try { if (localStorage.getItem(`cm.age18.${uid}`) === '1') confirmed = true; } catch (e) { /* ignore */ }
  return ugcAgeDecision({ age, confirmed });
};
export const confirmUgcAge = async (uid) => {
  try { localStorage.setItem(`cm.age18.${uid}`, '1'); } catch (e) { /* ignore */ }
  try { await setDoc(doc(db, 'users', uid), { ugcAge18: true, ugcAgeConfirmedAt: serverTimestamp() }, { merge: true }); } catch (e) { /* offline: the local confirm still holds on this device */ }
};
// Age 18+, the no-tolerance EULA, and a ban all block a new post, comment, or chat line.
export const communityPostGate = async (uid) => {
  const age = await loadUgcAccess(uid);
  if (!age.ok) return { ok: false, code: age.reason, error: age.reason === 'under' ? 'Community is for adults 18 and older.' : 'Confirm you are 18 or older on the Community page before posting.' };
  try { const b = await getDoc(banRef(uid)); if (b.exists()) return { ok: false, code: 'banned', error: 'This account is suspended from Community.' }; } catch (e) { /* ban rules not deployed yet */ }
  let prefs = {};
  try { prefs = await loadPrefs(uid); } catch (e) { /* ignore */ }
  const eula = Number(prefs.eulaVersion) >= EULA_VERSION || (typeof localStorage !== 'undefined' && localStorage.getItem(`cm.eula.${uid}`) === String(EULA_VERSION));
  if (!eula) return { ok: false, code: 'eula', error: 'Accept the Community terms before posting. There is no tolerance for objectionable content or abusive users.' };
  return { ok: true };
};
const gateOrThrow = async (uid) => { const g = await communityPostGate(uid); if (!g.ok) throw Object.assign(new Error(g.error), { code: g.code }); };

// ── Feed
export const watchFeed = (cb, n = PAGE) => onSnapshot(query(postsCol(), orderBy('createdAt', 'desc'), limit(n)), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })), s.docs[s.docs.length - 1] || null), (e) => cb(null, null, e));
export const morePosts = async (cursor, n = PAGE) => { const s = await getDocs(query(postsCol(), orderBy('createdAt', 'desc'), startAfter(cursor), limit(n))); return { items: s.docs.map((d) => ({ id: d.id, ...d.data() })), cursor: s.docs[s.docs.length - 1] || null }; };
export const getPost = async (id) => { const s = await getDoc(doc(db, 'communityPosts', id)); return s.exists() ? { id, ...s.data() } : null; };
export const createPost = async (me, { text, stats }) => {
  await gateOrThrow(me.uid);
  const v = validateText(text, LIMITS.text); if (!v.ok) throw Object.assign(new Error(v.error), { code: 'filter' });
  const r = await addDoc(postsCol(), { uid: me.uid, name: me.name, avatar: me.avatar || '', text: v.text, images: [] /* photos removed; field kept for rules compatibility */, stats: stats || null, likeCount: 0, commentCount: 0, createdAt: serverTimestamp() });
  return r.id;
};
export const deletePost = (id) => deleteDoc(doc(db, 'communityPosts', id));

// Likes: one doc per user + counter, changed together in a transaction (rules check the pair with existsAfter).
export const myLike = async (postId, uid) => (await getDoc(doc(db, 'communityPosts', postId, 'likes', uid))).exists();
export const toggleLike = (postId, uid) => runTransaction(db, async (tx) => {
  const lr = doc(db, 'communityPosts', postId, 'likes', uid); const pr = doc(db, 'communityPosts', postId);
  const [ls, ps] = [await tx.get(lr), await tx.get(pr)];
  if (!ps.exists()) throw new Error('Post was removed');
  if (ls.exists()) { tx.delete(lr); tx.update(pr, { likeCount: increment(-1) }); return false; }
  tx.set(lr, { uid, createdAt: serverTimestamp() }); tx.update(pr, { likeCount: increment(1) }); return true;
});

// Comments
export const watchComments = (postId, cb) => onSnapshot(query(collection(db, 'communityPosts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(200)), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
export const addComment = async (postId, me, text) => {
  await gateOrThrow(me.uid);
  const v = validateText(text, LIMITS.comment); if (!v.ok) throw Object.assign(new Error(v.error), { code: 'filter' });
  const b = writeBatch(db); const cr = doc(collection(db, 'communityPosts', postId, 'comments'));
  b.set(cr, { uid: me.uid, name: me.name, avatar: me.avatar || '', text: v.text, createdAt: serverTimestamp() });
  b.update(doc(db, 'communityPosts', postId), { commentCount: increment(1) });
  await b.commit(); return cr.id;
};
export const deleteComment = async (postId, cid) => { const b = writeBatch(db); b.delete(doc(db, 'communityPosts', postId, 'comments', cid)); b.update(doc(db, 'communityPosts', postId), { commentCount: increment(-1) }); await b.commit(); };

// ── Chat
export const watchChat = (cb, n = 30) => onSnapshot(query(chatCol(), orderBy('createdAt', 'desc'), limit(n)), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })), s.docs[s.docs.length - 1] || null), (e) => cb(null, null, e));
export const moreChat = async (cursor, n = 30) => { const s = await getDocs(query(chatCol(), orderBy('createdAt', 'desc'), startAfter(cursor), limit(n))); return { items: s.docs.map((d) => ({ id: d.id, ...d.data() })), cursor: s.docs[s.docs.length - 1] || null }; };
export const sendChat = async (me, { text }) => {
  await gateOrThrow(me.uid);
  const v = validateText(text, LIMITS.chat); if (!v.ok) throw Object.assign(new Error(v.error), { code: 'filter' });
  const r = await addDoc(chatCol(), { uid: me.uid, name: me.name, avatar: me.avatar || '', text: v.text, image: '', createdAt: serverTimestamp() });
  return r.id;
};
export const deleteChat = (id) => deleteDoc(doc(db, 'communityChat', id));

// ── Moderation
export const report = (me, { targetType, targetId, targetUid, postId = '', reason }) => addDoc(collection(db, 'reports'), { reporter: me.uid, targetType, targetId, targetUid, postId: postId || '', reason: String(reason || '').slice(0, LIMITS.reason), status: 'open', createdAt: serverTimestamp() });
export const loadBlocks = async (uid) => new Set((await getDocs(collection(db, 'users', uid, 'blocks'))).docs.map((d) => d.id));
export const block = (uid, other) => setDoc(doc(db, 'users', uid, 'blocks', other), { createdAt: serverTimestamp() });
export const unblock = (uid, other) => deleteDoc(doc(db, 'users', uid, 'blocks', other));
// Open Community reports (not manager-pal reports). Admin reads these and acts within 24 hours.
export const loadOpenReports = async () => {
  const s = await getDocs(query(collection(db, 'reports'), where('targetType', 'in', ['post', 'comment', 'chat', 'user']), limit(50)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.status === 'open' && !r.scope)
    .sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
};
export const resolveReport = (id, patch) => updateDoc(doc(db, 'reports', id), patch);
export const ejectUser = async (uid, { reason, reportId } = {}) => {
  const by = auth.currentUser && auth.currentUser.uid;
  if (!by) throw new Error('Not signed in.');
  await setDoc(banRef(uid), { uid, reason: String(reason || 'Objectionable content').slice(0, 300), reportId: String(reportId || '').slice(0, 128), ejectedAt: serverTimestamp(), by });
};
// Remove the reported content and eject its author. Content removal uses rules that are already deployed.
// The ban document needs the communityBans rules (not deployed from here). A failed eject stays in the queue.
export const actOnReport = async (report) => {
  const plan = moderationPlan(report);
  if (plan.remove && report.targetType === 'post') {
    await deletePost(report.targetId).catch(() => {});
    await deleteDoc(doc(db, 'posts', report.targetId)).catch(() => {});
  }
  else if (plan.remove && report.targetType === 'comment' && report.postId) await deleteComment(report.postId, report.targetId);
  else if (plan.remove && report.targetType === 'chat') await deleteChat(report.targetId);
  let ejected = false; let ejectError = '';
  if (plan.eject) {
    try { await ejectUser(report.targetUid, { reason: report.reason || 'Objectionable content', reportId: report.id }); ejected = true; }
    catch (e) { ejectError = (e && e.message) || 'Could not eject this account yet.'; }
  }
  await resolveReport(report.id, { status: ejected || !plan.eject ? 'actioned' : 'open', action: ejected ? 'removed-and-ejected' : 'removed', actedAt: serverTimestamp() });
  return { ejected, ejectError, removed: plan.remove };
};

// ── Follows: follows/{from}_{to}
export const isFollowing = async (from, to) => (await getDoc(doc(db, 'follows', followId(from, to)))).exists();
export const follow = (from, to) => setDoc(doc(db, 'follows', followId(from, to)), { from, to, createdAt: serverTimestamp() });
export const unfollow = (from, to) => deleteDoc(doc(db, 'follows', followId(from, to)));
export const myFollowing = async (uid) => new Set((await getDocs(query(collection(db, 'follows'), where('from', '==', uid), limit(1000)))).docs.map((d) => d.data().to));
export const followerUids = async (uid, cap = LIMITS.fanout) => (await getDocs(query(collection(db, 'follows'), where('to', '==', uid), limit(cap)))).docs.map((d) => d.data().from);
export const followCounts = async (uid) => {
  const [a, b] = await Promise.all([getCountFromServer(query(collection(db, 'follows'), where('to', '==', uid))), getCountFromServer(query(collection(db, 'follows'), where('from', '==', uid)))]);
  return { followers: a.data().count, following: b.data().count };
};

// ── Notifications: users/{to}/notifications, written by the actor (rules: type whitelist, from == auth.uid, not blocked).
export const notify = async (args) => { const n = buildNotif(args); if (!n) return; try { await addDoc(collection(db, 'users', args.to, 'notifications'), { ...n, createdAt: serverTimestamp() }); } catch (e) { /* recipient blocked us or rules not deployed: ignore */ } };
export const notifyFollowers = async (me, postId, extra) => {
  const targets = fanoutTargets(await followerUids(me.uid), me.uid);
  for (let i = 0; i < targets.length; i += 450) {
    // Individual writes (not one batch): a single recipient's block would otherwise fail the whole batch.
    await Promise.all(targets.slice(i, i + 450).map((to) => notify({ type: 'post', from: me.uid, fromName: me.name, to, postId, extra })));
  }
  return targets.length;
};
export const watchNotifs = (uid, cb) => onSnapshot(query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(50)), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
export const markRead = (uid, id) => updateDoc(doc(db, 'users', uid, 'notifications', id), { read: true });
export const markAllRead = async (uid, list) => { const b = writeBatch(db); list.filter((n) => !n.read).slice(0, 450).forEach((n) => b.update(doc(db, 'users', uid, 'notifications', n.id), { read: true })); await b.commit(); };

// ── Today's stats for the progress card
export const loadTodayStats = async (uid) => {
  let streak = 0; let tasksDone = 0; let points = 0;
  try { const s = await getDoc(doc(db, 'streaks', uid)); if (s.exists()) { const d = s.data(); streak = capStreak(d.streak); tasksDone = todayCount(d, localDateStr()); } } catch (e) { /* ignore */ }
  try { const m = await loadMyMonth(uid, monthKey()); points = (m && m.stats && m.stats.points) || 0; } catch (e) { /* ignore */ }
  return buildProgressCard({ tasksDone, points, streak });
};

// ── Community profiles (display-safe only: name, avatar, streak, bestStreak, badges) + my post count
export const getCommunityProfile = async (uid) => { const s = await getDoc(doc(db, 'communityProfiles', uid)); return s.exists() ? { id: uid, ...s.data() } : null; };
export const saveCommunityProfile = (uid, p) => setDoc(doc(db, 'communityProfiles', uid), { ...p, updatedAt: serverTimestamp() });
export const myPostCount = async (uid) => (await getCountFromServer(query(postsCol(), where('uid', '==', uid)))).data().count;
