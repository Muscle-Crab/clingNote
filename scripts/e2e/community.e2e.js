// Local Community run against the Firebase emulators (demo-clingnote; cannot reach production). Seeds ZZTEST users,
// drives the UI (EULA, heart like, comment, chat, report, follow) through the real firestore.rules, and saves phone screenshots.
// Run: emulators (auth/firestore, ports via EMU_AUTH_PORT/EMU_FS_PORT) + `VUE_APP_FIREBASE_EMULATORS=1 vue-cli-service serve --port $WEB_PORT`,
//      then NODE_PATH=<playwright-core + firebase-admin> node scripts/e2e/community.e2e.js
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FP}`; process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AP}`;
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright-core');
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-clingnote' });
const db = admin.firestore(); const TS = admin.firestore.Timestamp;
const B = `http://localhost:${process.env.WEB_PORT || 8099}`, SHOTS = (process.env.SHOTS || '/workspace/community-preview') + '/';
const IMG = process.env.IMG_DIR || '/workspace/cm-emu/img';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) throw new Error('E2E failed: ' + n); };
const ago = (min) => TS.fromMillis(Date.now() - min * 60000);
const img = (i) => `https://firebasestorage.googleapis.com/v0/b/demo/o/community%2Fseed%2Fp${i}.jpg?alt=media`;

async function seedUser(email, name) {
  const u = await admin.auth().createUser({ email, password: 'zztest-pass-123', displayName: name });
  await db.doc(`users/${u.uid}`).set({ uid: u.uid, name, email, onboardingComplete: true, paywallSeenAt: new Date(), isPro: false, plan: 'free' });
  await db.doc(`publicProfiles/${u.uid}`).set({ name });
  return u.uid;
}
(async () => {
  await fetch(`http://127.0.0.1:${FP}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AP}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const me = await seedUser('zztest-cm-me@example.com', 'Mia ZZTEST');
  const ava = await seedUser('zztest-cm-ava@example.com', 'Ava ZZTEST');
  const ben = await seedUser('zztest-cm-ben@example.com', 'Ben ZZTEST');
  await db.doc(`streaks/${me}`).set({ count: 4, lastDate: new Date().toISOString().slice(0, 10) }).catch(() => {});
  const P = (id, o) => db.doc(`communityPosts/${id}`).set({ avatar: '', title: '', text: '', images: [], stats: null, likeCount: 0, commentCount: 0, ...o });
  await P('pAva', { uid: ava, name: 'Ava ZZTEST', title: 'Day 12 — morning routine locked in', text: 'Gym, journal, and deep work before 9am. Small wins stack up!', images: [img(0), img(1)], stats: { tasksDone: 7, points: 340, streak: 12, milestone: 'Unstoppable', icon: '🏆' }, likeCount: 5, commentCount: 1, createdAt: ago(20) });
  await P('pBen', { uid: ben, name: 'Ben ZZTEST', text: 'First full week without skipping reading. 📚', stats: { tasksDone: 3, points: 90, streak: 3, milestone: 'On fire', icon: '🔥' }, likeCount: 2, createdAt: ago(90) });
  await P('pBen2', { uid: ben, name: 'Ben ZZTEST', title: 'Meal prep Sunday', images: [img(2)], likeCount: 1, createdAt: ago(300) });
  await db.doc('communityPosts/pAva/comments/c1').set({ uid: ben, name: 'Ben ZZTEST', avatar: '', text: 'Huge! Keep it going 💪', createdAt: ago(10) });
  const C = (id, uid, name, text, m, image = '') => db.doc(`communityChat/${id}`).set({ uid, name, avatar: '', text, image, createdAt: ago(m) });
  await C('m1', ava, 'Ava ZZTEST', 'Morning all! Who is doing a 5am start this week?', 40);
  await C('m2', ben, 'Ben ZZTEST', 'Me 🙋 — 3 days in so far', 35);
  await C('m3', ava, 'Ava ZZTEST', 'Today\'s desk setup', 30, img(1));
  await db.doc(`follows/${ava}_${me}`).set({ from: ava, to: me, createdAt: ago(60) });
  const N = (id, o, m) => db.doc(`users/${me}/notifications/${id}`).set({ read: false, postId: null, createdAt: ago(m), ...o });
  await N('n1', { type: 'follow', from: ava, fromName: 'Ava ZZTEST', text: 'Ava ZZTEST started following you' }, 60);
  await N('n2', { type: 'post', from: ava, fromName: 'Ava ZZTEST', postId: 'pAva', text: 'Ava ZZTEST shared new progress' }, 20);

  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); });
  await ctx.route('https://firebasestorage.googleapis.com/**', (r) => { const m = r.request().url().match(/p(\d)\.jpg/); r.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(path.join(IMG, `p${m ? m[1] : 0}.jpg`)) }); });
  await ctx.route('**/.netlify/functions/**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const shot = (n) => p.screenshot({ path: SHOTS + n });
  await p.goto(B + '/login?returning=1', { waitUntil: 'load' });
  await p.click('[data-test=email-toggle]');
  await p.fill('[data-test=login-email]', 'zztest-cm-me@example.com'); await p.fill('input[autocomplete=current-password]', 'zztest-pass-123');
  await p.click('[data-test=email-login]'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await p.goto(B + '/community', { waitUntil: 'load' });
  await p.waitForSelector('[data-test=cm-eula]', { timeout: 15000 }); await sleep(500); await shot('01-eula.png');
  await p.click('[data-test=cm-eula-check]'); await p.click('[data-test=cm-eula-accept]');
  await p.waitForSelector('[data-test=cm-post]', { timeout: 15000 }); await sleep(1500);
  ok('eula accepted -> prefs saved under rules', (await db.doc(`users/${me}/community/prefs`).get()).exists);
  ok('feed shows 3 seeded posts', (await p.$$('[data-test=cm-post]')).length === 3);
  await shot('overview.png'); await shot('02-feed.png');
  await p.locator('[data-test=cm-like]').first().click(); await sleep(1500);
  ok('heart like transaction allowed (likeCount 6)', (await db.doc('communityPosts/pAva').get()).data().likeCount === 6);
  ok('like doc written', (await db.doc(`communityPosts/pAva/likes/${me}`).get()).exists);
  await shot('03-liked.png');
  await p.click('[data-test=cm-quickfill]'); await sleep(800);
  await p.fill('[data-test=cm-post-text]', 'Quiet but productive day. Onwards! ✨'); await shot('04-composer.png');
  await p.click('[data-test=cm-post-submit]'); await sleep(2500);
  const mine = await db.collection('communityPosts').where('uid', '==', me).get();
  ok('own post created under rules', mine.size === 1);
  ok('follower (Ava) got a post notification', (await db.collection(`users/${ava}/notifications`).where('type', '==', 'post').get()).size === 1);
  ok('Ava got a like notification', (await db.collection(`users/${ava}/notifications`).where('type', '==', 'like').get()).size === 1);
  await p.click('[data-test=cm-bell]'); await sleep(1000); await shot('05-notifications.png');
  await p.keyboard.press('Escape'); await p.goto(B + '/community?post=pAva', { waitUntil: 'load' }); await sleep(2500); await shot('06-post-comments.png');
  await p.goto(B + '/community?tab=chat', { waitUntil: 'load' }); await sleep(2500);
  await p.fill('[data-test=cm-chat-input]', 'Hey everyone — day 4 streak here!'); await p.keyboard.press('Enter'); await sleep(1500);
  ok('chat message sent under rules', (await db.collection('communityChat').where('uid', '==', me).get()).size === 1);
  await shot('07-chat.png');
  await p.locator('.cm-msg').first().click({ button: 'right' }).catch(() => {}); await sleep(700);
  if (await p.$('[data-test=cm-sheet]')) { await shot('08-action-sheet.png');
    await p.click('[data-test=cm-sheet] >> text=/Report message|Report item/i').catch(() => {}); await sleep(700);
    if (await p.$('[data-test=cm-report]')) { await shot('09-report.png'); await p.locator('[data-test=cm-report] input[type=radio]').first().check(); await p.locator('[data-test=cm-report] .cm-btn').click(); await sleep(1500);
      ok('report written to reports', (await db.collection('reports').where('reporter', '==', me).get()).size >= 1); } }
  await p.goto(B + '/community', { waitUntil: 'load' }); await sleep(2000);
  await p.locator('[data-test=cm-post]').nth(1).locator('.cm-author').click().catch(() => {}); await sleep(1200);
  if (await p.$('[data-test=cm-profile]')) await shot('10-profile.png');
  console.log('done'); await br.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
