// Run: node scripts/test-community.js   (pure Community helpers + the prepared community-notify function, no network)
const path = require('path'); const fs = require('fs'); const os = require('os'); const assert = require('assert');
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-'));
fs.writeFileSync(path.join(dir, 'community.mjs'), fs.readFileSync(path.join(__dirname, '../src/utils/community.js'), 'utf8'));
const C = await import(path.join(dir, 'community.mjs'));
fs.writeFileSync(path.join(dir, 'streak.mjs'), fs.readFileSync(path.join(__dirname, '../src/utils/streak.js'), 'utf8'));
fs.writeFileSync(path.join(dir, 'badges.mjs'), fs.readFileSync(path.join(__dirname, '../src/utils/badges.js'), 'utf8').replace("'@/utils/streak'", "'./streak.mjs'"));
const BG = await import(path.join(dir, 'badges.mjs'));
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

// profanity filter
await t('filter: blocks plain, case, leetspeak, stretched and spaced profanity', () => {
  for (const s of ['what the fuck', 'SHIT happens', 'you b1tch', 'f*ck'.replace('*', 'u'), 'fuuuuck this', 'a$$hole', 'f u c k you']) assert.ok(!C.isClean(s), s);
});
await t('filter: allows innocent words (Scunthorpe-safe)', () => {
  for (const s of ['I finished class early', 'assessment done', 'Scunthorpe trip', 'cocktail party', 'grape juice', 'shiitake mushrooms', 'Dickens novel', '']) assert.ok(C.isClean(s), s);
});
await t('validateText: empty, too long, profanity, trims', () => {
  assert.equal(C.validateText('  ', 10).ok, false);
  assert.equal(C.validateText('', 10, { allowEmpty: true }).ok, true);
  assert.match(C.validateText('x'.repeat(11), 10).error, /max 10/);
  assert.match(C.validateText('shit', 100).error, /respectful/);
  assert.equal(C.validateText('  hi  ', 10).text, 'hi');
});
await t('displayNameOf never shows emails; safeAvatar https only', () => {
  assert.equal(C.displayNameOf('zztest@example.com'), 'Member'); assert.equal(C.displayNameOf(' Ann '), 'Ann'); assert.equal(C.displayNameOf(null), 'Member');
  assert.equal(C.safeAvatar('data:image/png;base64,xx'), ''); assert.equal(C.safeAvatar('https://x/y.png'), 'https://x/y.png');
});

// post card
await t('buildProgressCard: clamps, ints, milestone stage', () => {
  const c = C.buildProgressCard({ tasksDone: 6.7, points: '120', streak: 5 });
  assert.deepEqual(c, { tasksDone: 6, points: 120, streak: 5, milestone: 'Unstoppable', icon: '🚀' });
  assert.equal(C.buildProgressCard({ tasksDone: -3 }).tasksDone, 0);
  assert.equal(C.buildProgressCard({}).milestone, 'Starter');
  assert.equal(C.buildProgressCard({ streak: 3 }).milestone, 'On fire');
  assert.ok(C.isStatsCard(c)); assert.ok(!C.isStatsCard({ tasksDone: 1.5, points: 0, streak: 0, milestone: 'x' }));
});
await t('progressText: singular/plural and stats', () => {
  assert.match(C.progressText(C.buildProgressCard({ tasksDone: 1, points: 10, streak: 1 })), /finished 1 task,.*1-day streak.*10 points/);
  assert.match(C.progressText(C.buildProgressCard({ tasksDone: 4 })), /4 tasks/);
});

// blocks
await t('filterBlocked hides content and notifications from blocked users', () => {
  const items = [{ id: 1, uid: 'a' }, { id: 2, uid: 'b' }, { id: 3, from: 'b' }, null, { id: 4, uid: 'c' }];
  assert.deepEqual(C.filterBlocked(items, new Set(['b'])).map((x) => x.id), [1, 4]);
  assert.deepEqual(C.filterBlocked(items, ['a', 'c']).map((x) => x.id), [2, 3]);
  assert.equal(C.filterBlocked(items, []).length, 4);
});
await t('visibleNotifs respects blocks and per-type prefs; unreadCount', () => {
  const l = [{ id: 1, type: 'like', from: 'a', read: false }, { id: 2, type: 'follow', from: 'b', read: false }, { id: 3, type: 'comment', from: 'a', read: true }];
  const v = C.visibleNotifs(l, ['b'], { ...C.DEFAULT_NOTIF_PREFS, comment: false });
  assert.deepEqual(v.map((x) => x.id), [1]); assert.equal(C.unreadCount(l), 2);
});

// rate limiting
await t('rate limiter: min gap, window max, recovery, persistence', () => {
  let saved = null; const store = { load: () => saved, save: (x) => { saved = JSON.parse(JSON.stringify(x)); } };
  const L = C.createRateLimiter({ chat: { max: 3, windowMs: 60000, minGapMs: 1000 } }, store);
  let now = 1e6; assert.ok(L.check('chat', now).ok); L.hit('chat', now);
  assert.equal(L.check('chat', now + 500).ok, false);
  L.hit('chat', now += 1500); L.hit('chat', now += 1500);
  const r = L.check('chat', now += 1500); assert.equal(r.ok, false); assert.match(r.error, /too fast/);
  assert.ok(L.check('chat', now + 60000).ok);
  const L2 = C.createRateLimiter({ chat: { max: 3, windowMs: 60000, minGapMs: 1000 } }, store); assert.equal(L2.check('chat', now).ok, false);
  assert.ok(L.check('unknown').ok);
  const D = C.createRateLimiter(); let tt = 0; for (let i = 0; i < 3; i++) { assert.ok(D.check('post', tt).ok); D.hit('post', tt); tt += 21000; } assert.equal(D.check('post', tt).ok, false);
});

// feed / chat ordering, likes, share, notifs
await t('sortFeed newest first; most liked today excludes older posts', () => {
  const now = new Date(2026, 9, 24, 15).getTime(); const today = new Date(2026, 9, 24, 9).getTime(); const yday = new Date(2026, 9, 23, 22).getTime();
  const ps = [{ id: 'a', createdAt: today, likeCount: 1 }, { id: 'b', createdAt: today + 1000, likeCount: 5 }, { id: 'c', createdAt: yday, likeCount: 99 }, { id: 'd', createdAt: { seconds: (today + 5000) / 1000 }, likeCount: 1 }];
  assert.deepEqual(C.sortFeed(ps, 'new', now).map((p) => p.id), ['d', 'b', 'a', 'c']);
  assert.deepEqual(C.sortFeed(ps, 'liked', now).map((p) => p.id), ['b', 'd', 'a']);
});
await t('filterFollowing keeps followed + own; chatOrder oldest->newest; mergeById dedupes', () => {
  assert.deepEqual(C.filterFollowing([{ uid: 'a' }, { uid: 'b' }, { uid: 'me' }], ['a'], 'me').map((p) => p.uid), ['a', 'me']);
  assert.deepEqual(C.chatOrder([{ id: 2, createdAt: 20 }, { id: 1, createdAt: 10 }]).map((m) => m.id), [1, 2]);
  assert.deepEqual(C.mergeById([{ id: 1, v: 1 }], [{ id: 1, v: 2 }, { id: 2 }]).map((x) => x.v || 0), [2, 0]);
});
await t('toggleLikeState: like/unlike, never negative', () => {
  assert.deepEqual(C.toggleLikeState({ likeCount: 2 }, false), { liked: true, likeCount: 3 });
  assert.deepEqual(C.toggleLikeState({ likeCount: 0 }, true), { liked: false, likeCount: 0 });
});
await t('fitWithin caps longest side at 1600 and keeps aspect', () => {
  assert.deepEqual(C.fitWithin(4032, 3024), { w: 1600, h: 1200 }); assert.deepEqual(C.fitWithin(800, 600), { w: 800, h: 600 }); assert.deepEqual(C.fitWithin(1000, 3200), { w: 500, h: 1600 });
});
await t('share link + text', () => { assert.equal(C.postLink('ab c&x'), 'https://clingnot.netlify.app/community?post=abcx'); assert.match(C.shareTextFor({ title: 'Day 5' }), /Day 5/); });
await t('buildNotif: allowed types, no self, no emails, text capped', () => {
  assert.equal(C.buildNotif({ type: 'hack', from: 'a', to: 'b' }), null); assert.equal(C.buildNotif({ type: 'like', from: 'a', to: 'a' }), null);
  const nn = C.buildNotif({ type: 'comment', from: 'a', fromName: 'x@y.com', to: 'b', postId: 'p', extra: 'z'.repeat(500) });
  assert.equal(nn.fromName, 'Member'); assert.ok(nn.text.length <= 140); assert.equal(nn.read, false); assert.equal(nn.postId, 'p');
  assert.equal(C.buildNotif({ type: 'follow', from: 'a', to: 'b' }).postId, null);
});
await t('fanoutTargets: dedupe, no self, cap 500', () => {
  const ids = Array.from({ length: 700 }, (_, i) => 'u' + i); assert.equal(C.fanoutTargets([...ids, 'me', 'u1'], 'me').length, 500);
  assert.deepEqual(C.fanoutTargets(['a', 'a', 'me', ''], 'me'), ['a']);
});
await t('admin email check', () => { assert.ok(C.isAdminEmail('DS7513635@gmail.com')); assert.ok(!C.isAdminEmail('zztest@example.com')); });

// prepared Netlify function (fake admin db)
await t('community-notify: auth, ownership, block + pref skip, push via FCM sender', async () => {
  const fn = require('../netlify/functions/community-notify.js');
  const data = { 'communityPosts/p1': { uid: 'author', name: 'Ann', title: 'Day 5' }, 'users/f2/blocks/author': {}, 'users/f3/community/prefs': { notif: { post: false } }, 'users/f1': { fcmTokens: ['tok1'] } };
  const follows = [{ from: 'f1', to: 'author' }, { from: 'f2', to: 'author' }, { from: 'f3', to: 'author' }, { from: 'author', to: 'author' }];
  const db = { doc: (p) => ({ get: async () => ({ exists: p in data, data: () => data[p] }), update: async () => {} }), collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: follows.map((f) => ({ data: () => f })) }) }) }) }) };
  const sent = []; const messaging = { sendEachForMulticast: async (m) => { sent.push(m); return { successCount: m.tokens.length, failureCount: 0, responses: m.tokens.map(() => ({ success: true })) }; } };
  const deps = (u) => ({ verify: async () => ({ uid: u }), db, messaging, FieldValue: { arrayRemove: () => null } });
  const ev = (b) => ({ httpMethod: 'POST', headers: { authorization: 'Bearer x' }, body: JSON.stringify(b) });
  assert.equal((await fn.rawHandler({ httpMethod: 'GET', headers: {} }, {}, deps('author'))).statusCode, 405);
  assert.equal((await fn.rawHandler(ev({}), {}, deps('author'))).statusCode, 400);
  assert.equal((await fn.rawHandler(ev({ postId: 'p1' }), {}, deps('intruder'))).statusCode, 403);
  const r = await fn.rawHandler(ev({ postId: 'p1' }), {}, deps('author')); const b = JSON.parse(r.body);
  assert.equal(r.statusCode, 200); assert.equal(b.recipients, 1); assert.equal(b.sent, 1); assert.equal(sent[0].data.url, '/community?post=p1');
});

// ── badges / streak tiers / achievement prompt
await t('badges: one config, unique ids, every badge has icon/name/rank/test', () => {
  const ids = BG.BADGES.map((b) => b.id); assert.equal(new Set(ids).size, ids.length);
  BG.BADGES.forEach((b) => { assert.ok(b.icon && b.name && b.desc && typeof b.rank === 'number' && typeof b.test === 'function', b.id); });
  for (const id of ['perfect-1', 'perfect-10', 'streak-3', 'streak-7', 'streak-14', 'streak-30', 'streak-100', 'first-post', 'tasks-100']) assert.ok(BG.BADGE_BY_ID[id], id);
  assert.deepEqual(BG.STREAK_TIERS, [3, 7, 14, 30, 100]);
});
await t('badges: earned thresholds', () => {
  assert.deepEqual(BG.earnedBadges({}), []);
  assert.deepEqual(BG.earnedBadges({ perfectDays: 1 }), ['perfect-1']);
  assert.ok(BG.earnedBadges({ perfectDays: 10 }).includes('perfect-10')); assert.ok(!BG.earnedBadges({ perfectDays: 9 }).includes('perfect-10'));
  const s = BG.earnedBadges({ run: 7 }); assert.ok(s.includes('streak-3') && s.includes('streak-7') && !s.includes('streak-14'));
  assert.ok(BG.earnedBadges({ run: 2, bestRun: 30 }).includes('streak-30')); // best run keeps streak badges after a break
  assert.ok(BG.earnedBadges({ run: 100 }).includes('streak-100'));
  assert.ok(BG.earnedBadges({ posts: 1 }).includes('first-post')); assert.ok(BG.earnedBadges({ tasksTotal: 100 }).includes('tasks-100')); assert.ok(!BG.earnedBadges({ tasksTotal: 99 }).includes('tasks-100'));
  assert.deepEqual(BG.earnedBadges({ perfectDays: -5, run: 'x', tasksTotal: NaN }), []);
});
await t('badges: newBadges vs owned, topBadges by rank (max 3), unknown ids dropped', () => {
  assert.deepEqual(BG.newBadges({ run: 7 }, ['streak-3']), ['streak-7']);
  assert.deepEqual(BG.topBadges(['first-post', 'streak-100', 'perfect-1', 'tasks-100', 'bogus']), ['streak-100', 'tasks-100', 'perfect-1']);
  assert.deepEqual(BG.knownBadges(['x', 'perfect-1', 'perfect-1']), ['perfect-1']);
});
await t('streak tiers: highest tier + only new tiers', () => {
  assert.equal(BG.streakTier(2), 0); assert.equal(BG.streakTier(8), 7); assert.equal(BG.streakTier(150), 100);
  assert.deepEqual(BG.newStreakTiers(7, []), [3, 7]); assert.deepEqual(BG.newStreakTiers(7, [3]), [7]); assert.deepEqual(BG.newStreakTiers(7, [3, 7]), []);
});
await t('extendRun: uncapped consecutive days from the streak doc counted dates', () => {
  const days = (start, k) => Array.from({ length: k }, (_, i) => { const d = new Date(Date.UTC(2026, 0, start + i)); return d.toISOString().slice(0, 10); });
  assert.equal(BG.extendRun(null, days(1, 10), '2026-01-10').len, 10);
  assert.equal(BG.extendRun(null, days(1, 10), '2026-01-11').len, 10); // today still open
  assert.equal(BG.extendRun(null, days(1, 10), '2026-01-13').len, 0); // broken
  assert.equal(BG.extendRun(null, [...days(1, 3), ...days(6, 4)], '2026-01-09').len, 4); // gap resets
  assert.equal(BG.extendRun(null, [], '2026-01-09').len, 0);
  // longer than the 62-day window: previous run joins
  assert.equal(BG.extendRun({ len: 80, last: '2026-01-05' }, days(1, 10), '2026-01-10').len, 85);
  assert.equal(BG.extendRun({ len: 80, last: '2025-12-31' }, days(1, 10), '2026-01-10').len, 90);
  assert.equal(BG.extendRun({ len: 80, last: '2025-12-20' }, days(1, 10), '2026-01-10').len, 10); // old run ended before the gap
});
await t('perfect days counted once per date; lifetime tasks from monthly counts', () => {
  const a = BG.bumpPerfect({}, '2026-01-01'); assert.deepEqual(a, { perfectDays: 1, lastPerfect: '2026-01-01' });
  assert.equal(BG.bumpPerfect(a, '2026-01-01').perfectDays, 1); assert.equal(BG.bumpPerfect(a, '2026-01-02').perfectDays, 2);
  let m = BG.mergeMonthCount({}, '2026-01', 40); m = BG.mergeMonthCount(m, '2026-01', 30); m = BG.mergeMonthCount(m, '2026-02', 65);
  assert.equal(BG.sumMonths(m), 105);
});
await t('pending achievements: once per key, combined, tier covers its streak badge', () => {
  const raw = { perfectDate: '2026-01-05', tiers: [7], badges: ['streak-7', 'perfect-10'] };
  const p = BG.pendingAchievements(raw, []); assert.deepEqual(p, { perfectDate: '2026-01-05', tiers: [7], badges: ['perfect-10'] });
  const shown = BG.achievementKeys(p); assert.deepEqual(shown, ['perfect:2026-01-05', 'tier:7', 'badge:perfect-10']);
  const again = BG.pendingAchievements(raw, shown); assert.ok(!BG.hasPending(again));
  assert.ok(BG.hasPending(BG.pendingAchievements({ badges: ['first-post'] }, shown)));
});
await t('achievement title + stats card (streak + badges) pass the post filter and rules shape', () => {
  assert.equal(BG.achievementTitle({ perfectDate: 'd', tasksDone: 8 }), 'Finished all 8 tasks today 🎉');
  assert.equal(BG.achievementTitle({ perfectDate: 'd', tasksDone: 1 }), 'Finished all 1 task today 🎉');
  const t2 = BG.achievementTitle({ perfectDate: 'd', tasksDone: 5, tiers: [3, 7], badges: ['perfect-10'] });
  assert.match(t2, /Finished all 5 tasks today/); assert.match(t2, /7-day streak/); assert.match(t2, /10 Perfect Days/); assert.ok(t2.length <= 120);
  assert.ok(C.validateText(t2, C.LIMITS.title).ok);
  const card = BG.achievementCard(C.buildProgressCard({ tasksDone: 8, points: 120, streak: 5 }), { run: 12, badges: ['streak-7', 'perfect-1', 'first-post', 'tasks-100'] });
  assert.equal(card.streak, 12); assert.equal(card.badges.length, 3); assert.ok(C.isStatsCard(card));
  assert.deepEqual(Object.keys(card).sort(), ['badges', 'icon', 'milestone', 'points', 'streak', 'tasksDone']);
  assert.ok(!('badges' in BG.achievementCard(C.buildProgressCard({}), {})));
});
await t('public community profile has display-safe fields only', () => {
  const p = BG.publicCommunityProfile({ name: 'Ann', avatar: 'https://x/a.png', run: 4, bestRun: 2, badges: ['perfect-1', 'nope'], email: 'a@b.c', uid: 'u' });
  assert.deepEqual(Object.keys(p).sort(), ['avatar', 'badges', 'bestStreak', 'name', 'streak']); assert.equal(p.bestStreak, 4); assert.deepEqual(p.badges, ['perfect-1']);
});
await t('rules: communityProfiles + stats badges + prefs.ach prepared', () => {
  const r = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  assert.ok(r.includes('match /communityProfiles/{uid}') && r.includes("'name', 'avatar', 'streak', 'bestStreak', 'badges', 'updatedAt'"));
  assert.ok(r.includes("'icon', 'badges'") && r.includes("'notif', 'ach', 'updatedAt'"));
});

// rules file sanity (static): community collections present, default deny kept last, admin email only via verified token
await t('firestore.rules + storage.rules contain the community sections', () => {
  const r = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  for (const m of ['/communityPosts/{postId}', '/likes/{likerId}', '/comments/{commentId}', '/communityChat/{msgId}', '/follows/{followId}', '/reports/{reportId}', '/users/{userId}/blocks/{otherId}', '/users/{userId}/notifications/{notifId}', 'cmBlockedBy']) assert.ok(r.includes(m), m);
  assert.ok(r.lastIndexOf('match /{document=**}') > r.indexOf('/communityPosts/'));
  const s = fs.readFileSync(path.join(__dirname, '../storage.rules'), 'utf8');
  assert.ok(s.includes('/community/{uid}/{fileName}') && s.includes('5 * 1024 * 1024'));
});
console.log(`\n${n} community tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
