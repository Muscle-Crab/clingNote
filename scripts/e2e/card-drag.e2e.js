// Coach game plan e2e (Coach/strict mode only): one compact row on Home (focus / break / work / closed), Settings game plan
// (first save applies, later schedule edits wait for the weekly review), size chips S/M/L (10/20/40, points on completion),
// nothing earned after the hard close, close picker (picked leftovers to tomorrow, rest stays, no penalty), weekly review,
// (shared helpers) goal reason + revoke penalty in the morning report, checklist gate + friend unlock link (function + public page, approve/deny).
// Emulators only (demo-clingnote), ZZTEST accounts only. Env: EMU_AUTH_PORT, EMU_FS_PORT, WEB_PORT, CHROME, SHOTS, TAG (before|after), ONLY.
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FP}`; process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AP}`;
const { chromium } = require('playwright-core'); const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-clingnote' }); const db = admin.firestore();
const { rawHandler } = require('../../netlify/functions/friend-unlock');
const B = `http://localhost:${process.env.WEB_PORT || 8099}`; const FORBIDDEN = 'dsDDbr945rawMAUKKpIAJcnPYrX2';
const SHOTS = (process.env.SHOTS || '/workspace/plan-shots/gameplan') + '/'; const TAG = process.env.TAG || 'after'; const AFTER = TAG === 'after';
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const results = [];
const ok = (n, c, x = '') => { results.push({ n, c: !!c }); console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${c ? '' : x}`); };
const ymd = (d = new Date()) => d.toLocaleDateString('en-CA'); const dayName = (d = new Date()) => WEEK[d.getDay()];
const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ago = (min) => hhmm(Date.now() - min * 60000);
const tmrw = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; };
async function seedUser(email, name, tasks = [], extra = {}) {
  if (!/^zztest/i.test(email)) throw new Error('ZZTEST only');
  try { const o = await admin.auth().getUserByEmail(email); await admin.auth().deleteUser(o.uid); } catch (e) { /* none */ }
  const u = await admin.auth().createUser({ email, password: 'zztest-pass-123', displayName: name }); if (u.uid === FORBIDDEN) throw new Error('forbidden uid');
  await db.doc(`users/${u.uid}`).set({ uid: u.uid, name, email, onboardingComplete: true, paywallSeenAt: new Date(), isPro: false, plan: 'free', aiConsent: true, aiConsentVersion: 2, bossMode: 'strict', ...extra });
  await db.doc(`publicProfiles/${u.uid}`).set({ name });
  for (const w of WEEK) await db.doc(`weeklyRoutines/${u.uid}_${w}`).delete().catch(() => {});
  await db.doc(`weeklyRoutines/${u.uid}_${dayName()}`).set({ tasks });
  await db.doc(`userSettings/${u.uid}`).set({ daySessions: { [ymd()]: { started: true, ended: false, startTime: admin.firestore.Timestamp.fromMillis(Date.now() - 3600e3), endTime: null } } }, { merge: true });
  return u.uid;
}
const fnRoute = async (route) => { const q = route.request(); const url = new URL(q.url());
  const r = await rawHandler({ httpMethod: q.method(), headers: q.headers(), body: q.postData() || '', queryStringParameters: Object.fromEntries(url.searchParams) }, {}, { db, verify: (t) => admin.auth().verifyIdToken(t) });
  route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body }); };
async function page(br) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn_community_eula_v1', '1'); });
  await ctx.route('**/.netlify/functions/**', (r) => (/friend-unlock/.test(r.request().url()) ? fnRoute(r) : r.fulfill({ status: 200, json: {} })));
  const pg = await ctx.newPage(); pg.errs = []; pg.on('dialog', (d) => d.accept());
  pg.on('console', (m) => process.env.GP_DEBUG && /warn|error/.test(m.type()) && console.log('CONSOLE', m.text().slice(0, 300))); pg.on('pageerror', (e) => !/SDK already initialized/.test(String(e)) && pg.errs.push(String(e).slice(0, 200)));
  return pg;
}
const dd = async (p) => { for (let i = 0; i < 3; i++) { const b = p.locator('[data-test=boss-briefing] .bb-x, .drama button, .drama-btn, .dsp-skip, button:has-text("Not now"), button:has-text("Maybe later")'); if (await b.count()) { await b.first().click({ timeout: 1500 }).catch(() => {}); await sleep(400); } } };
async function login(p, email) {
  await p.goto(B + '/login?returning=1', { waitUntil: 'load' }); await p.click('[data-test=email-toggle]');
  await p.fill('[data-test=login-email]', email); await p.fill('input[autocomplete=current-password]', 'zztest-pass-123'); await p.click('[data-test=email-login]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3000); await p.reload({ waitUntil: 'load' }); await sleep(2500); await dd(p);
}
const home = async (p) => { await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3500); await dd(p); };
const user = async (uid) => (await db.doc(`users/${uid}`).get()).data() || {};
const tasksOf = async (uid, d = dayName()) => ((await db.doc(`weeklyRoutines/${uid}_${d}`).get()).data() || {}).tasks || [];
const waitFor = async (f, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(400); } return false; };
const rowText = (p) => p.locator('[data-test=gp-text]').innerText().catch(() => '');
const openRow = async (p) => { if ((await p.locator('[data-test=gp-toggle]').getAttribute('aria-expanded').catch(() => '')) !== 'true') await p.click('[data-test=gp-toggle]'); await sleep(400); };
const shot = (p, name, sel) => (sel ? p.locator(sel).first().screenshot({ path: SHOTS + `${TAG}-${name}.png` }) : p.screenshot({ path: SHOTS + `${TAG}-${name}.png` })).catch((e) => console.log('shot failed', name, String(e).slice(0, 120)));
const mk = (title, i, extra = {}) => ({ title: 'ZZTEST ' + title, completed: false, createdAt: `zz-gp-${i}`, estimateMin: 45, points: 20, ...extra });
const lastSunday = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return ymd(d); };


// Long-press-then-drag on Home task cards (TaskCard.vue via TaskSections/useSmoothReorder). Real CDP touch events.
const titles = (p) => p.$$eval('.tasks-list [data-reorder-key] .task-title', (n) => n.map((x) => x.textContent.trim()));
const cardBox = async (p, i) => (await p.locator('.tasks-list > .task-card, .tasks-list [data-reorder-key]:not(.task-section)').nth(i).boundingBox());
async function touchDrag(p, cdp, from, dy, holdMs, steps = 12, liftShot = '') {
  const b = await cardBox(p, from); const x = b.x + b.width * 0.6, y = b.y + b.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(holdMs);
  const lifted = await p.evaluate(() => !!document.querySelector('.reorder-lift'));
  if (liftShot && lifted) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 40 }] }); await sleep(250); await shot(p, liftShot, '.tasks-list'); }
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (dy * i) / steps }] }); await sleep(30); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(1200); return lifted;
}
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
  for (const mode of ['strict', 'simple']) {
    const email = `zztest.drag.${mode}@example.com`; const tasks = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => mk('Card ' + i, i));
    const uid = await seedUser(email, 'ZZTEST Drag ' + mode, tasks, { bossMode: mode });
    const p = await page(br); await login(p, email); await home(p); const cdp = await p.context().newCDPSession(p);
    await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    await shot(p, `home-cards-${mode}`, '.tasks-list');
    if (!AFTER) { await p.context().close(); continue; }
    const t0 = await titles(p);
    // 1. quick swipe (no hold) = scroll, never a reorder
    await p.evaluate(() => window.scrollTo(0, 400)); await sleep(300); const y0 = await p.evaluate(() => window.scrollY);
    const lifted0 = await touchDrag(p, cdp, 4, 220, 40, 6);
    ok(`${mode}: quick swipe does not pick the card up`, !lifted0);
    ok(`${mode}: quick swipe keeps the order`, JSON.stringify(await titles(p)) === JSON.stringify(t0), JSON.stringify(await titles(p)));
    ok(`${mode}: quick swipe scrolls the page`, (await p.evaluate(() => window.scrollY)) !== y0, String(y0));
    await p.evaluate(() => window.scrollTo(0, 0)); await sleep(400);
    // 2. tap = details sheet (unchanged)
    await p.evaluate(() => document.querySelectorAll('.tasks-list .task-card')[1].scrollIntoView({ block: 'center' })); await sleep(500); const b = await cardBox(p, 1); await p.touchscreen.tap(b.x + b.width * 0.62, b.y + b.height * 0.72); await sleep(900); if (!(await p.locator('[data-test=task-detail-sheet]').count())) await shot(p, 'debug-tap-' + mode);
    ok(`${mode}: a normal tap still opens the card`, await p.locator('[data-test=task-detail-sheet]').count() === 1);
    await p.keyboard.press('Escape'); await sleep(300); if (await p.locator('[data-test=task-detail-sheet]').count()) { await p.locator('[data-test=task-detail-sheet] button[aria-label=Close], .modal-close').first().click().catch(() => {}); await sleep(500); }
    await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    // 3. long-press 500 ms then drag down two cards
    const h = (await cardBox(p, 0)).height;
    const lifted = await touchDrag(p, cdp, 0, h * 2.3, 520, 12, mode === 'strict' ? 'home-card-lifted' : '');
    ok(`${mode}: ~400 ms hold lifts the card`, lifted);
    const t1 = await titles(p);
    ok(`${mode}: drag reorders`, t1[0] !== t0[0] && t1.indexOf(t0[0]) >= 2, JSON.stringify(t1));
    ok(`${mode}: no detail sheet after the drag`, await p.locator('[data-test=task-detail-sheet]').count() === 0);
    if (mode === 'strict') await shot(p, 'home-cards-after-drag', '.tasks-list');
    await sleep(2500); await home(p);
    ok(`${mode}: order saved (same after reload)`, JSON.stringify(await titles(p)) === JSON.stringify(t1), JSON.stringify(await titles(p)));
    void uid; ok(`${mode}: no page errors`, p.errs.length === 0, p.errs.join(' | ')); await p.context().close();
  }
  await br.close(); const f = results.filter((r) => !r.c).length; console.log(`drag e2e (${TAG}): ${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
