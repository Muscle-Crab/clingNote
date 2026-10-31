// B44 strict boss mode e2e: onboarding Simple/Strict choice, Settings boss mode + emergency toggle, strict morning report
// (wake greeting, mood check, suggested + adjustable points goal, never below the minimum). Shield policy is unit-tested (no Screen Time on web).
// Emulators only (demo-clingnote), ZZTEST accounts only. Env: EMU_AUTH_PORT, EMU_FS_PORT, WEB_PORT, CHROME, SHOTS, TAG (before|after).
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FP}`; process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AP}`;
const { chromium } = require('playwright-core'); const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-clingnote' }); const db = admin.firestore();
const B = `http://localhost:${process.env.WEB_PORT || 8099}`; const FORBIDDEN = 'dsDDbr945rawMAUKKpIAJcnPYrX2';
const SHOTS = (process.env.SHOTS || '/workspace/plan-shots/build-44-gcal') + '/'; const TAG = process.env.TAG || 'after'; const AFTER = TAG === 'after';
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const results = [];
const ok = (n, c, x = '') => { results.push({ n, c: !!c }); console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${c ? '' : x}`); };
const ymd = (d = new Date()) => d.toLocaleDateString('en-CA'); const dayName = () => WEEK[new Date().getDay()];
async function seedUser(email, name, tasks = []) {
  if (!/^zztest/i.test(email)) throw new Error('ZZTEST only');
  try { const o = await admin.auth().getUserByEmail(email); await admin.auth().deleteUser(o.uid); } catch (e) { /* none */ }
  const u = await admin.auth().createUser({ email, password: 'zztest-pass-123', displayName: name }); if (u.uid === FORBIDDEN) throw new Error('forbidden uid');
  await db.doc(`users/${u.uid}`).set({ uid: u.uid, name, email, onboardingComplete: true, paywallSeenAt: new Date(), isPro: false, plan: 'free', aiConsent: true, aiConsentVersion: 2 });
  await db.doc(`publicProfiles/${u.uid}`).set({ name });
  for (const w of WEEK) await db.doc(`weeklyRoutines/${u.uid}_${w}`).delete().catch(() => {});
  await db.doc(`weeklyRoutines/${u.uid}_${dayName()}`).set({ tasks });
  await db.doc(`userSettings/${u.uid}`).set({ daySessions: { [ymd()]: { started: true, ended: false, startTime: admin.firestore.Timestamp.fromMillis(Date.now() - 3600e3), endTime: null } } }, { merge: true });
  return u.uid;
}
async function page(br, { busy } = {}) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((b) => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn_community_eula_v1', '1'); if (b) window.__CN_TEST_BUSY__ = b; }, busy || null);
  await ctx.route('**/.netlify/functions/**', (r) => r.fulfill({ status: 200, json: {} }));
  const pg = await ctx.newPage(); pg.errs = [];
  pg.on('pageerror', (e) => !/SDK already initialized/.test(String(e)) && pg.errs.push(String(e).slice(0, 200)));
  return pg;
}
async function login(p, email) {
  await p.goto(B + '/login?returning=1', { waitUntil: 'load' }); await p.click('[data-test=email-toggle]');
  await p.fill('[data-test=login-email]', email); await p.fill('input[autocomplete=current-password]', 'zztest-pass-123'); await p.click('[data-test=email-login]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3000); await p.reload({ waitUntil: 'load' }); await sleep(2500);
  await p.locator('[data-test=boss-briefing] .bb-x').click({ timeout: 1500 }).catch(() => {});
  for (let i = 0; i < 3; i++) { const b = p.locator('.drama button, button:has-text("Not now"), button:has-text("Maybe later")'); if (await b.count()) await b.first().click({ timeout: 1500 }).catch(() => {}); }
}
const todayTasks = async (uid) => ((await db.doc(`weeklyRoutines/${uid}_${dayName()}`).get()).data() || {}).tasks || [];
const sched = async (uid) => ((((await db.doc(`users/${uid}`).get()).data() || {}).scheduledTasks || {}).tasks || []);
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); };
(async () => {
  const ON = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const SH = '/workspace/plan-shots/build-44-gcal/';
  if (ON('settings')) { const email = 'zztest.b44.strict1@example.com'; const uid = await seedUser(email, 'ZZTEST Strict');
    const p = await page(br); await login(p, email);
    await p.goto(B + '/profile/' + uid, { waitUntil: 'load' }); await sleep(3000);
    const row = p.locator('[data-test=boss-mode-row]');
    await p.locator('[data-test=calendar-sync-setting]').screenshot({ path: SH + `${TAG}-settings-boss.png` }).catch((e) => console.log('shot failed', String(e).slice(0, 160)));
    if (AFTER) {
      ok('settings: boss mode row inside existing card', await p.locator('[data-test=calendar-sync-setting] [data-test=boss-mode-row]').count() === 1);
      ok('settings: simple by default', await p.locator('[data-test=boss-simple][aria-pressed=true]').count() === 1);
      await p.click('[data-test=boss-strict]'); await sleep(1200);
      ok('settings: strict saved', ((await db.doc(`users/${uid}`).get()).data() || {}).bossMode === 'strict');
      ok('settings: emergency unlock on by default', await p.locator('[data-test=emergency-toggle]').isChecked());
      await p.click('[data-test=emergency-toggle]'); await sleep(1200);
      ok('settings: emergency unlock off saved', ((await db.doc(`users/${uid}`).get()).data() || {}).emergencyUnlock === false);
      await row.screenshot({ path: SH + `${TAG}-settings-boss-strict.png` }).catch(() => {});
      await p.reload({ waitUntil: 'load' }); await sleep(3000);
      ok('settings: strict + emergency off persist after reload', await p.locator('[data-test=boss-strict][aria-pressed=true]').count() === 1 && !(await p.locator('[data-test=emergency-toggle]').isChecked()));
      await p.click('[data-test=boss-simple]'); await sleep(1200);
      ok('settings: back to simple', ((await db.doc(`users/${uid}`).get()).data() || {}).bossMode === 'simple');
    }
    ok('settings: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }
  if (ON('morning')) { const email = 'zztest.b44.strict2@example.com';
    const tasks = Array.from({ length: 8 }, (_, i) => ({ title: `ZZTEST job ${i + 1}`, completed: false, createdAt: `zz-sj-${i}`, points: 20 }));
    const uid = await seedUser(email, 'ZZTEST Strict2', tasks); if (AFTER) await db.doc(`users/${uid}`).set({ bossMode: 'strict' }, { merge: true });
    const p = await page(br); await login(p, email);
    if (new Date().getHours() < 8) { console.log('skip morning (before 8 AM)'); } else {
      await p.evaluate((u) => localStorage.removeItem(`morningReport_${u}`), uid); await p.reload({ waitUntil: 'load' }); await sleep(4000);
      await p.locator('[data-test=boss-briefing] .bb-x').click({ timeout: 1500 }).catch(() => {});
      await p.click('.hero-menu-btn').catch(() => {}); await sleep(600);
      const mr = p.locator('section.mr'); await mr.screenshot({ path: SH + `${TAG}-morning-report.png` }).catch((e) => console.log('shot failed', String(e).slice(0, 160)));
      ok('morning: goal line shows suggested 130 pts (8 tasks x 20, 80%)', /130 pts/.test(await p.locator('[data-test=mr-goal]').innerText().catch(() => '')));
      if (AFTER) {
        ok('morning: wake greeting + mood chips', /How are you feeling/.test(await p.locator('[data-test=mr-mood]').innerText().catch(() => '')) && await p.locator('[data-test^=mood-]').count() === 4);
        await p.click('[data-test=mood-low]'); await sleep(1200);
        const ud = (await db.doc(`users/${uid}`).get()).data() || {};
        ok('morning: mood saved for today', ud.mood && ud.mood.id === 'low' && ud.mood.day === ymd());
        await p.click('[data-test=mr-goal-edit]'); await p.fill('[data-test=mr-goal-in]', '20'); await p.keyboard.press('Enter'); await sleep(1200);
        ok('morning: goal never below minimum (20 -> 50)', /50 pts/.test(await p.locator('[data-test=mr-goal]').innerText()));
        await p.click('[data-test=mr-goal-edit]'); await p.fill('[data-test=mr-goal-in]', '161'); await p.keyboard.press('Enter'); await sleep(1500);
        const g = ((await db.doc(`users/${uid}`).get()).data() || {}).pointsGoal || {};
        ok('morning: adjusted goal saved (161 -> 160)', g.value === 160 && g.day === ymd(), JSON.stringify(g));
        await mr.screenshot({ path: SH + `${TAG}-morning-report-adjusted.png` }).catch(() => {});
      }
    }
    ok('morning: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }
  if (ON('onboarding') && AFTER) { const email = 'zztest.b44.strict3@example.com'; const uid = await seedUser(email, 'ZZTEST Strict3');
    const p = await page(br); await login(p, email);
    await p.goto(B + '/onboarding?step=4', { waitUntil: 'load' }); await sleep(2500);
    for (let i = 0; i < 4 && !(await p.locator('[data-test=ob-boss]').count()); i++) { await p.locator('.ob-cta').click({ timeout: 2000 }).catch(() => {}); await sleep(600); }
    ok('onboarding: boss mode choice in strictness step', await p.locator('[data-test=ob-boss]').count() === 1);
    await p.click('[data-test=ob-boss-strict]').catch(() => {}); await sleep(300);
    await p.locator('.ob-sec').screenshot({ path: SH + `${TAG}-onboarding-boss.png` }).catch(() => {});
    await p.locator('.ob-cta').click().catch(() => {}); await sleep(1500);
    ok('onboarding: strict saved to account', ((await db.doc(`users/${uid}`).get()).data() || {}).bossMode === 'strict');
    ok('onboarding: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }
  await br.close(); const pass = results.filter((r) => r.c).length;
  console.log(`b44 strict boss e2e (${TAG}): ${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
