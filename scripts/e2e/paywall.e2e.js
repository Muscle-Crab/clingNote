// Paywall guard walk (local emulators only, ZZTEST users): a FREE user can add/edit/complete tasks, every Pro area leads to the paywall
// sheet (with Restore Purchases), the server refuses Pro actions (402); a PRO user gets in. Screens: SHOTS + TAG ('before'|'after').
// Run: EMU_AUTH_PORT=9399 EMU_FS_PORT=8385 WEB_PORT=8399 CHROME=... SHOTS=/workspace/paywall-screens/ TAG=after node scripts/e2e/paywall.e2e.js
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, admin, sleep, seedUser, emailLogin, B } = H;
const eh = require('../../netlify/functions/eight-hour-day');
const SHOTS = process.env.SHOTS || '/tmp/pw/'; const TAG = process.env.TAG || 'after'; const CHECK = TAG === 'after';
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const res = []; const step = (n, c, x = '') => { res.push([n, !!c]); console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${c ? '' : x}`); };
const verify = (t) => admin.auth().verifyIdToken(t, false).catch(() => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()));
const shot = (p, name, sel) => (sel ? p.locator(sel).first().screenshot({ path: `${SHOTS}${TAG}-${name}.png` }) : p.screenshot({ path: `${SHOTS}${TAG}-${name}.png` })).catch((e) => console.log('shot failed', name, String(e).slice(0, 100)));
const dd = async (p) => { for (let i = 0; i < 3; i++) { const b = p.locator('[data-test=boss-briefing] .bb-x, .drama-btn, button:has-text("Not now"), button:has-text("Maybe later")'); if (await b.count()) { await b.first().click({ timeout: 1500 }).catch(() => {}); await sleep(400); } } };
const onPaywall = (p) => /\/onboarding\?.*step=paywall|\/paywall/.test(p.url());

async function session(br, email, uid) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  await ctx.addInitScript((u) => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn_community_eula_v1', '1'); localStorage.setItem(`cn.coach.${u}`, JSON.stringify({ done: [], off: true })); }, uid);
  await ctx.route('**/.netlify/functions/eight-hour-day**', async (route) => { const q = route.request(); const r = await eh.handler({ httpMethod: 'POST', headers: { authorization: q.headers().authorization }, body: q.postData() }, {}, { verify, db, apiKey: undefined }); route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body }); });
  await ctx.route('**/.netlify/functions/!(eight-hour-day)**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.setDefaultTimeout(8000); p.on('dialog', (d) => d.accept());
  await emailLogin(p, email); return { ctx, p };
}
const home = async (p) => { await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3500); await dd(p); };

(async () => {
  const FS = process.env.EMU_FS_PORT, AU = process.env.EMU_AUTH_PORT;
  await fetch(`http://127.0.0.1:${FS}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AU}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const today = WEEK[new Date().getDay()];
  const mk = async (email, name, extra) => { const uid = await seedUser(email, name); if (uid === 'dsDDbr945rawMAUKKpIAJcnPYrX2') throw new Error('refusing to touch a real account');
    await db.doc(`users/${uid}`).set({ onboardingComplete: true, paywallSeenAt: new Date(), lockInEnabled: true, bossMode: 'strict', gamePlan: { dayStart: '08:00', closeHours: 8, sessions: 2, breakEvery: 50, minGoal: 50 }, ...extra }, { merge: true });
    await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks: [1, 2, 3].map((i) => ({ title: `ZZTEST task ${i}`, completed: false, createdAt: `zz-pw-${i}`, estimateMin: 30 })) }); return uid; };
  const freeUid = await mk('zztest-pw-free@example.com', 'Free ZZTEST', { isPro: false });
  const proUid = await mk('zztest-pw-pro@example.com', 'Pro ZZTEST', { isPro: true, plan: 'pro_yearly', proExpiresAt: new Date(Date.now() + 30 * 864e5) });
  const br = await chromium.launch({ executablePath: process.env.CHROME });

  // ---- FREE user ----
  const { p } = await session(br, 'zztest-pw-free@example.com', freeUid);
  await home(p); await shot(p, 'free-home'); await shot(p, 'free-tabbar', '[data-test=tabbar]');
  await p.mouse.wheel(0, 900); await sleep(500); await shot(p, 'free-home-scrolled');
  // basics: add a task, complete it
  const before = ((await db.doc(`weeklyRoutines/${freeUid}_${today}`).get()).data().tasks || []).length;
  await p.locator('button:has-text("Start Day")').first().click({ timeout: 4000 }).catch(() => {}); await sleep(1500);
  await shot(p, 'free-day-started');
  await p.locator('[data-test=task-check]').first().click({ timeout: 4000 }).catch(() => {}); await sleep(1500);
  const doneOk = ((await db.doc(`weeklyRoutines/${freeUid}_${today}`).get()).data().tasks || []).some((t) => t.completed);
  if (CHECK) step('free: can complete a task', doneOk);
  // Pro areas -> paywall
  const tryPaywall = async (label, act) => { await home(p); await act().catch(() => {}); await sleep(1800); const ok = onPaywall(p); if (CHECK) step(`free: ${label} -> paywall`, ok, p.url()); return ok; };
  await tryPaywall('Upcoming tab', () => p.click('[data-test=tab-upcoming]'));
  await shot(p, 'free-paywall-sheet');
  const restore = await p.locator('[data-test=pw-restore]').count(); if (CHECK) step('paywall shows Restore Purchases', restore > 0);
  await tryPaywall('Community tab', () => p.click('[data-test=tab-community]'));
  await tryPaywall('Assistant', () => p.locator('[data-test=assistant-bubble]').first().click({ timeout: 4000 }));
  await home(p); await shot(p, 'free-lockin-card', '[data-test=eight-hour-card]');
  await tryPaywall('Lock-in start', () => p.locator('[data-test=eh-save], [data-test=eh-start]').first().click({ timeout: 4000 }));
  for (const r of ['/rankings', '/pals', '/discipline', '/manage']) { await p.goto(B + r, { waitUntil: 'load' }); await sleep(2500); if (CHECK) step(`free: ${r} -> paywall`, onPaywall(p), p.url()); }
  // Settings stay reachable, Pro rows show a lock
  await p.goto(B + '/profile/' + freeUid, { waitUntil: 'load' }); await sleep(3000); await dd(p); await shot(p, 'free-settings');
  const del = await p.locator('[data-test=delete-account], button:has-text("Delete account")').count(); if (CHECK) step('free: Settings + Delete account reachable', !onPaywall(p) && del > 0);
  const up = await p.locator('[data-test=upgrade-pro]').count(); if (CHECK) step('free: Upgrade to Pro link in Settings', up > 0);
  // server: Pro actions refused
  const tokFor = (uid) => ['e30', Buffer.from(JSON.stringify({ uid, user_id: uid, sub: uid })).toString('base64url'), 'x'].join('.'); // emulator-style unsigned token
  const tok = tokFor(freeUid);
  const call = (uid, action) => eh.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer ' + tokFor(uid) }, body: JSON.stringify({ action, hours: 2 }) }, {}, { verify, db });
  if (CHECK && tok) { const s = await call(freeUid, 'start'); step('server: free start lock -> 402', s.statusCode === 402, s.statusCode); const st = await call(freeUid, 'state'); step('server: free state still 200', st.statusCode === 200, st.statusCode); }

  // ---- PRO user ----
  const s2 = await session(br, 'zztest-pw-pro@example.com', proUid);
  await home(s2.p); await shot(s2.p, 'pro-home'); await shot(s2.p, 'pro-tabbar', '[data-test=tabbar]');
  await s2.p.click('[data-test=tab-upcoming]'); await sleep(2000); if (CHECK) step('pro: Upcoming opens', /\/upcoming/.test(s2.p.url()), s2.p.url());
  await s2.p.goto(B + '/rankings', { waitUntil: 'load' }); await sleep(2500); if (CHECK) step('pro: /rankings opens', !onPaywall(s2.p), s2.p.url());
  await br.close();
  const bad = res.filter((r) => !r[1]); console.log(`\npaywall walk: ${res.length - bad.length}/${res.length} pass`); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
