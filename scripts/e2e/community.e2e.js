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
  await p.locator('#post-pAva [data-test=cm-like]').click(); await sleep(1500);
  ok('heart like transaction allowed (likeCount 6)', (await db.doc('communityPosts/pAva').get()).data().likeCount === 6);
  ok('like doc written', (await db.doc(`communityPosts/pAva/likes/${me}`).get()).exists);
  await shot('03-liked.png');
  ok('no always-visible composer on the feed', (await p.locator('[data-test=cm-composer]').count()) === 0 && (await p.locator('[data-test=cm-compose-open]').count()) === 1);
  await p.click('[data-test=cm-compose-open]'); await p.waitForSelector('[data-test=cm-composer]');
  ok('sheet: caption font >= 16px, 0/500 counter', parseFloat(await p.$eval('[data-test=cm-post-text]', (e) => getComputedStyle(e).fontSize)) >= 16 && /^0\/500$/.test((await p.textContent('[data-test=cm-post-count]')).trim()));
  await p.click('[data-test=cm-compose-close]'); await sleep(400);
  const closedX = (await p.locator('[data-test=cm-composer]').count()) === 0;
  await p.click('[data-test=cm-compose-open]'); await p.waitForSelector('[data-test=cm-composer]'); await p.mouse.click(200, 40); await sleep(400);
  ok('sheet closes via x and via backdrop', closedX && (await p.locator('[data-test=cm-composer]').count()) === 0);
  await p.click('[data-test=cm-compose-open]'); await p.waitForSelector('[data-test=cm-composer]');
  await p.click('[data-test=cm-stats-btn]'); await sleep(800);
  await p.fill('[data-test=cm-post-text]', 'Quiet but productive day. Onwards! ✨'); await shot('04-composer.png');
  await p.click('[data-test=cm-post-submit]'); await sleep(2500);
  ok('sheet closes after posting and post is first in feed', (await p.locator('[data-test=cm-composer]').count()) === 0 && /Onwards/.test(await p.locator('[data-test=cm-post]').first().textContent()));
  const mine = await db.collection('communityPosts').where('uid', '==', me).get();
  ok('own post created under rules', mine.size === 1);
  ok('composer has no title input; post stores no title (caption only)', (await p.locator('[data-test=cm-composer] input[placeholder^=Title]').count()) === 0 && !('title' in mine.docs[0].data()) && /Onwards/.test(mine.docs[0].data().text));
  ok('legacy titled post still renders its title', (await p.locator('.cm-title', { hasText: 'Day 12' }).count()) > 0);
  // Storage is unavailable (Spark plan, bucket locked): a photo upload failure must not post, must keep the caption, and must show a friendly message.
  await p.route('**/firebasestorage.googleapis.com/**', (r) => r.abort()); await p.route('**/v0/b/**', (r) => r.abort());
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await p.click('[data-test=cm-compose-open]'); await p.waitForSelector('[data-test=cm-composer]');
  await p.setInputFiles('[data-test=cm-composer] input[type=file]', { name: 'zz.png', mimeType: 'image/png', buffer: png });
  await sleep(21000); // post rate-limit min gap
  await p.fill('[data-test=cm-post-text]', 'ZZTEST photo post'); await p.click('[data-test=cm-post-submit]');
  await p.waitForSelector('.cm-error', { timeout: 25000 }).catch(() => {}); await shot('04b-photo-fail.png');
  const errTxt = (await p.locator('.cm-error').count()) ? await p.textContent('.cm-error') : '';
  console.log('PHOTOFAIL', JSON.stringify(errTxt), await p.inputValue('[data-test=cm-post-text]'));
  ok('photo upload failure: friendly message, caption kept, nothing posted', /Photo upload isn.t available/.test(errTxt) && (await p.inputValue('[data-test=cm-post-text]')) === 'ZZTEST photo post' && (await db.collection('communityPosts').where('uid', '==', me).get()).size === 1);
  await p.click('.cm-thumb .cm-x'); await p.fill('[data-test=cm-post-text]', ''); await p.click('[data-test=cm-compose-close]'); await sleep(400);
  const own = p.locator('[data-test=cm-post]', { hasText: 'Onwards' }).first();
  ok('caption-only post visible in feed', (await own.count()) === 1);
  await own.locator('.cm-more').first().click(); await p.click('button.danger:has-text("Delete")'); await sleep(2000);
  ok('caption-only post deleted under rules', (await db.collection('communityPosts').where('uid', '==', me).get()).size === 0 && (await p.locator('[data-test=cm-post]', { hasText: 'Onwards' }).count()) === 0);
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

  // ── Achievements: 7 consecutive counted days on the EXISTING streaks doc -> combined tier/badge pop-up -> one-tap share
  const zed = await seedUser('zztest-cm-zed@example.com', 'Zed ZZTEST');
  const dstr = (k) => { const d = new Date(); d.setDate(d.getDate() - k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const counted = [6, 5, 4, 3, 2, 1, 0].map(dstr);
  await db.doc(`streaks/${zed}`).set({ streak: 5, bestStreak: 5, lastCompletionDate: dstr(0), dayDate: dstr(0), dayDone: ['a', 'b', 'c', 'd', 'e', 'f'], counted });
  await db.doc(`users/${zed}/community/prefs`).set({ eulaVersion: 1 });
  const z = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await z.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); });
  await z.route('**/.netlify/functions/**', (r) => r.fulfill({ status: 200, json: {} }));
  const q = await z.newPage(); q.on('pageerror', (e) => console.log('[zed pageerror]', e.message));
  await q.goto(B + '/login?returning=1', { waitUntil: 'load' }); await q.click('[data-test=email-toggle]');
  await q.fill('[data-test=login-email]', 'zztest-cm-zed@example.com'); await q.fill('input[autocomplete=current-password]', 'zztest-pass-123');
  await q.click('[data-test=email-login]'); await q.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await q.waitForSelector('.drama', { timeout: 15000 }).catch(() => {});
  ok('pop-up waits while the app streak celebration is showing', !(await q.$('[data-test=ach-prompt]')) || !(await q.$('.drama')));
  for (let i = 0; i < 10 && await q.$('.drama'); i++) { await q.locator('.drama button').last().click().catch(() => {}); await sleep(500); }
  await q.waitForSelector('[data-test=ach-prompt]', { timeout: 20000 }); await sleep(600);
  const txt = await q.textContent('[data-test=ach-prompt]');
  ok('streak pop-up combines tiers 3 + 7 (uncapped run from counted dates)', /7-day streak/.test(txt) && /3-day streak/.test(txt));
  await q.screenshot({ path: SHOTS + '11-streak-popup.png' });
  await q.click('[data-test=ach-dismiss]'); await sleep(800);
  const pz = (await db.doc(`users/${zed}/community/prefs`).get()).data();
  ok('shown keys persisted (tier:3, tier:7)', pz.ach.shown.includes('tier:3') && pz.ach.shown.includes('tier:7'));
  const cp = (await db.doc(`communityProfiles/${zed}`).get()).data();
  ok('public communityProfile: display-safe fields + streak 7', cp && cp.streak === 7 && cp.bestStreak >= 7 && !('email' in cp) && cp.badges.includes('streak-7'));
  // Perfect Day (the all-done celebration calls the same sync with perfect=true)
  await q.evaluate(() => window.__cmPerfectDay()); await q.waitForSelector('[data-test=ach-prompt]', { timeout: 15000 }); await sleep(600);
  const t2 = await q.textContent('[data-test=ach-prompt]');
  ok('perfect day pop-up merged with the Perfect Day badge', /Finished all 6 tasks today/.test(t2) && /Perfect Day/.test(t2) && !/3-day streak/.test(t2));
  await q.screenshot({ path: SHOTS + '12-perfect-day-popup.png' });
  await q.click('[data-test=ach-share]'); await q.waitForSelector('[data-test=ach-toast]', { timeout: 15000 });
  await q.screenshot({ path: SHOTS + '13-shared-toast.png' });
  const zp = await db.collection('communityPosts').where('uid', '==', zed).get();
  ok('one-tap post created under rules with streak + badge in the stats card', zp.size === 1 && zp.docs[0].data().stats.streak === 7 && zp.docs[0].data().stats.badges.includes('perfect-1') && /Finished all 6 tasks/.test(zp.docs[0].data().text) && !('title' in zp.docs[0].data()));
  await q.evaluate(() => window.__cmPerfectDay()); await sleep(3000);
  ok('no second Perfect Day prompt the same day', !(await q.$('[data-test=ach-prompt]')) || !/Finished all/.test(await q.textContent('[data-test=ach-prompt]')));
  if (await q.$('[data-test=ach-prompt]')) await q.click('[data-test=ach-dismiss]');
  await q.click('[data-test=ach-toast] button').catch(async () => { await q.goto(B + '/community?post=' + zp.docs[0].id); });
  await q.waitForURL((u) => u.pathname.startsWith('/community'), { timeout: 10000 }); await sleep(2500);
  await q.screenshot({ path: SHOTS + '14-post-with-badges.png' });
  await q.locator('#post-' + zp.docs[0].id + ' .cm-author').click(); await sleep(1500);
  ok('profile sheet shows streak + badge grid', /7/.test(await q.textContent('[data-test=cm-profile-streak]')) && (await q.$$('[data-test=cm-badges] .cm-badge:not(.off)')).length >= 3);
  await q.screenshot({ path: SHOTS + '15-profile-badges.png' });
  console.log('done'); await br.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
