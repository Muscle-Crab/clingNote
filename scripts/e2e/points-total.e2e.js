// Points total regression (local emulators, ZZTEST only): completing a 10-pt task adds exactly +10 to the visible day points,
// survives a reload (Firestore), un-completing takes the 10 off; full-screen celebration fires. Env: EMU_AUTH_PORT EMU_FS_PORT WEB_PORT TAG SHOTS
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FP}`; process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AP}`;
for (const k of ['OPENAI_API_KEY', 'GEMINI_API_KEY']) delete process.env[k];
const { chromium } = require('playwright-core'); const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-clingnote' }); const db = admin.firestore();
const B = `http://localhost:${process.env.WEB_PORT || 8099}`; const FORBIDDEN = 'dsDDbr945rawMAUKKpIAJcnPYrX2';
const SHOTS = (process.env.SHOTS || '/workspace/points-fix-screens') + '/'; const TAG = process.env.TAG || 'after';
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const results = [];
const ok = (n, c, x = '') => { results.push({ n, c: !!c }); console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`); };
const ymd = (d = new Date()) => d.toLocaleDateString('en-CA'); const dayName = (d = new Date()) => WEEK[d.getDay()];
const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
async function seedUser(email, tasks, extra) {
  if (!/^zztest/i.test(email)) throw new Error('ZZTEST only');
  try { const o = await admin.auth().getUserByEmail(email); await admin.auth().deleteUser(o.uid); } catch (e) { /* none */ }
  const u = await admin.auth().createUser({ email, password: 'zztest-pass-123', displayName: 'ZZTEST Pts' }); if (u.uid === FORBIDDEN) throw new Error('forbidden uid');
  await db.doc(`users/${u.uid}`).set({ uid: u.uid, name: 'ZZTEST Pts', email, onboardingComplete: true, paywallSeenAt: new Date(), isPro: true, plan: 'lifetime', aiConsent: true, aiConsentVersion: 2, ...extra });
  await db.doc(`publicProfiles/${u.uid}`).set({ name: 'ZZTEST Pts' });
  for (const w of WEEK) await db.doc(`weeklyRoutines/${u.uid}_${w}`).delete().catch(() => {});
  await db.doc(`weeklyRoutines/${u.uid}_${dayName()}`).set({ tasks });
  await db.doc(`userSettings/${u.uid}`).set({ daySessions: { [ymd()]: { started: true, ended: false, startTime: admin.firestore.Timestamp.fromMillis(Date.now() - 3600e3), endTime: null } } }, { merge: true });
  return u.uid;
}
const dd = async (p) => { for (let i = 0; i < 3; i++) { const b = p.locator('[data-test=boss-briefing] .bb-x, .drama button, .drama-btn, [data-test=day-prompt-skip], [data-test=day-prompt-skip-pick], button:has-text("Not now"), button:has-text("Maybe later")'); if (await b.count()) { await b.first().click({ timeout: 1500 }).catch(() => {}); await sleep(400); } } };
const ehPts = async (p) => (await p.locator('[data-test=eh-points]').first().innerText().catch(() => '')).trim();
const pts = async (p) => { const t = await p.locator('[data-test=day-pts]').first().innerText().catch(() => ''); const m = t.match(/(\d+)/); return m ? Number(m[1]) : NaN; };
const settle = async (p) => { const sd = p.locator('button:has-text("Start Day")'); if (await sd.count()) { await sd.first().click().catch(() => {}); await sleep(2500); await dd(p); } await sleep(1600); };
async function run(br, label, extra, hook) {
  const email = `zztest.points.${label}@example.com`;
  const tasks = [{ title: 'ZZTEST Small ten', completed: false, createdAt: 'zz-pt-1', estimateMin: 15, size: 's', points: 10 },
    { title: 'ZZTEST Done', completed: true, completedAt: new Date(Date.now() - 1800e3).toISOString(), createdAt: 'zz-pt-2', estimateMin: 15, size: 's', points: 10 },
    { title: 'ZZTEST Open', completed: false, createdAt: 'zz-pt-3', estimateMin: 45, size: 'm', points: 20 }];
  if (extra.lockInEnabled) for (let i = 4; i <= 6; i++) tasks.push({ title: `ZZTEST Filler ${i}`, completed: false, createdAt: `zz-pt-${i}`, estimateMin: 45, size: 'm', points: 20 });
  const uid = await seedUser(email, tasks, extra);
  if (hook) await hook(uid);
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn_community_eula_v1', '1'); });
  await ctx.route('**/.netlify/functions/**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.errs = []; p.on('dialog', (d) => d.accept()); p.on('pageerror', (e) => !/SDK already initialized/.test(String(e)) && p.errs.push(String(e).slice(0, 200)));
  await p.goto(B + '/login?returning=1'); await p.click('[data-test=email-toggle]');
  await p.fill('[data-test=login-email]', email); await p.fill('input[autocomplete=current-password]', 'zztest-pass-123'); await p.click('[data-test=email-login]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await p.goto(B + '/home'); await sleep(4000); await dd(p); await settle(p);
  const before = await pts(p); await p.screenshot({ path: `${SHOTS}${TAG}-${label}-1-before.png` });
  const card = p.locator('.task-card', { hasText: 'ZZTEST Small ten' }).first();
  await card.locator('[data-test=task-check]').click(); await sleep(700);
  const celeb = await p.locator('[data-test=points-celebration]').count();
  await p.screenshot({ path: `${SHOTS}${TAG}-${label}-2-celebration.png` });
  await sleep(2500); await dd(p);
  const after = await pts(p); await p.screenshot({ path: `${SHOTS}${TAG}-${label}-3-after.png` });
  ok(`${label}: +10 on screen`, after === before + 10, `${before} -> ${after} | card: ${await ehPts(p)}`);
  ok(`${label}: celebration fired`, celeb > 0);
  const stored = (((await db.doc(`weeklyRoutines/${uid}_${dayName()}`).get()).data() || {}).tasks || []).find((t) => t.createdAt === 'zz-pt-1');
  ok(`${label}: completion stored`, stored && stored.completed);
  await p.reload(); await sleep(4000); await dd(p); await settle(p);
  const reloaded = await pts(p); await p.screenshot({ path: `${SHOTS}${TAG}-${label}-4-reload.png` });
  ok(`${label}: persists after reload`, reloaded === before + 10, `${reloaded}`);
  const again = p.locator('.task-card', { hasText: 'ZZTEST Small ten' }).first(); if (!(await again.isVisible().catch(() => false))) { const tg = p.locator('.done-toggle', { hasText: 'Completed' }).first(); await tg.scrollIntoViewIfNeeded().catch(() => {}); if ((await tg.getAttribute('aria-expanded').catch(() => null)) !== 'true') await tg.click({ force: true }).catch(() => {}); await sleep(800); }
  await again.scrollIntoViewIfNeeded().catch(() => {}); await again.locator('[data-test=task-check]').click({ timeout: 8000, force: true }).catch((e) => console.log('uncheck failed', String(e).slice(0, 80))); await sleep(3000); await dd(p);
  const undone = await pts(p); await p.screenshot({ path: `${SHOTS}${TAG}-${label}-5-uncomplete.png` });
  ok(`${label}: un-complete -10`, undone === before, `${undone}`);
  ok(`${label}: no page errors`, !p.errs.length, p.errs.join(' | ')); await ctx.close();
}
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  const lastSun = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return ymd(d); })();
  const gp = (startAgoMin) => ({ bossMode: 'strict', gamePlan: { dayStart: hhmm(Date.now() - startAgoMin * 60000), reviewDow: 0, reviewTime: '18:00', minGoal: 50, pending: null, lastReview: lastSun } });
  const only = process.env.ONLY;
  if (!only || only === 'simple') await run(br, 'simple', {});
  if (!only || only === 'coach') await run(br, 'coach', gp(120));
  const startSession = (late) => async (uid) => {
    const L = require('./lib.js'); const fn = L.ehFn(); const tok = await L.idTokenFor(uid); const h = { authorization: `Bearer ${tok}` };
    await fn(JSON.stringify({ action: 'plan', tz: 'America/New_York', taskCount: 6 }), h);
    const r = await fn(JSON.stringify({ action: 'start', hours: 8 }), h); console.log('start', r.statusCode, String(r.body).slice(0, 160));
    if (late) { const ref = db.doc(`weeklyRoutines/${uid}_${dayName()}`); const d = (await ref.get()).data(); const t = d.tasks; const i = t.findIndex((x) => x.createdAt === 'zz-pt-1'); const [x] = t.splice(i, 1); t.push({ ...x, createdAt: 'zz-pt-1b' }); await ref.update({ tasks: t }); }
  };
  if (!only || only === 'session') await run(br, 'session', { lockInEnabled: true }, startSession(false));
  if (!only || only === 'sessionadd') await run(br, 'sessionadd', { lockInEnabled: true }, startSession(true));
  if (!only || only === 'coachsession') await run(br, 'coachsession', { lockInEnabled: true, ...gp(120) }, startSession(true));
  if (only === 'coachlate') await run(br, 'coachlate', gp(Math.min(11 * 60, new Date().getHours() * 60 + new Date().getMinutes() - 5)));
  await br.close(); const f = results.filter((r) => !r.c); console.log(`${results.length - f.length}/${results.length} passed`); process.exit(f.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
