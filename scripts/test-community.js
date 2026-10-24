// Run: node scripts/test-community.js   (pure Community helpers + the prepared community-notify function, no network)
const path = require('path'); const fs = require('fs'); const os = require('os'); const assert = require('assert');
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-'));
fs.writeFileSync(path.join(dir, 'community.mjs'), fs.readFileSync(path.join(__dirname, '../src/utils/community.js'), 'utf8'));
const C = await import(path.join(dir, 'community.mjs'));
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
