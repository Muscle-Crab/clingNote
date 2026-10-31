// B41 e2e: PUBG-style rank medal inside the streak medal (Bronze..Master, burst on reach) + automatic streak recheck.
// Emulators only (demo-clingnote), ZZTEST accounts only. Env: EMU_AUTH_PORT, EMU_FS_PORT, WEB_PORT, CHROME, SHOTS, TAG.
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FP}`; process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AP}`;
const { chromium } = require('playwright-core'); const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-clingnote' }); const db = admin.firestore();
const B = `http://localhost:${process.env.WEB_PORT || 8099}`; const SHOTS = process.env.SHOTS || '/workspace/plan-shots/b41/'; const TAG = process.env.TAG || 'after';
const FORBIDDEN = 'dsDDbr945rawMAUKKpIAJcnPYrX2'; const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const results = [];
const ok = (n, c, x = '') => { results.push({ n, c: !!c }); console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`); };
const ymd = (d = new Date()) => d.toLocaleDateString('en-CA'); const dayName = () => WEEK[(new Date().getDay() + 6) % 7];
async function seedUser(email, name) {
  if (!/^zztest/i.test(email)) throw new Error('ZZTEST only');
  try { const o = await admin.auth().getUserByEmail(email); await admin.auth().deleteUser(o.uid); } catch (e) { /* none */ }
  const u = await admin.auth().createUser({ email, password: 'zztest-pass-123', displayName: name }); if (u.uid === FORBIDDEN) throw new Error('forbidden uid');
  await db.doc(`users/${u.uid}`).set({ uid: u.uid, name, email, onboardingComplete: true, paywallSeenAt: new Date(), isPro: false, plan: 'free' });
  await db.doc(`publicProfiles/${u.uid}`).set({ name }); return u.uid;
}
async function page(br, init) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn_community_eula_v1', '1'); });
  if (init) await ctx.addInitScript(init.fn, init.arg);
  await ctx.route('**/.netlify/functions/**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); p.errs = []; p.on('pageerror', (e) => { if (!/OneSignal|SDK already initialized/.test(e.message + (e.stack || ''))) p.errs.push(e.message); }); if (process.env.DEBUG) p.on('console', (m) => { if (/streak|recheck|rror|DBG/i.test(m.text())) console.log('  [console]', m.text().slice(0, 300)); }); return p;
}
async function login(p, email) {
  await p.goto(B + '/login?returning=1', { waitUntil: 'load' }); await p.click('[data-test=email-toggle]');
  await p.fill('[data-test=login-email]', email); await p.fill('input[autocomplete=current-password]', 'zztest-pass-123'); await p.click('[data-test=email-login]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}
// Pre-existing (build 40 too): the first userSettings read right after a fresh login can miss server fields, so let the
// login writes settle and relaunch, like reopening the app.
const openHome = async (p) => { await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3000); await p.reload({ waitUntil: 'load' }); };
const dismiss = async (p) => { await p.locator('[data-test=boss-briefing] .bb-x').click({ timeout: 1500 }).catch(() => {}); for (let i = 0; i < 3; i++) { const b = p.locator('.drama button, button:has-text("Not now"), button:has-text("Maybe later")'); if (await b.count()) await b.first().click({ timeout: 1500 }).catch(() => {}); } };
const startMs = () => Date.now() - 3 * 3600e3;
async function seedDay(uid, { doneAfter = 0, doneBefore = 0, open = 1, boss = false } = {}) {
  const s = startMs(); const tasks = [];
  for (let i = 0; i < doneBefore; i++) tasks.push({ title: `ZZTEST early ${i}`, completed: true, completedAt: new Date(s - (i + 1) * 60e3).toISOString() });
  for (let i = 0; i < doneAfter; i++) tasks.push({ title: `ZZTEST done ${i}`, completed: true, completedAt: new Date(s + (i + 1) * 60e3).toISOString() });
  for (let i = 0; i < open; i++) tasks.push({ title: `ZZTEST open ${i}`, completed: false, ...(boss && i === 0 ? { boss: true } : {}) });
  await db.doc(`weeklyRoutines/${uid}_${dayName()}`).set({ tasks });
  await db.doc(`userSettings/${uid}`).set({ daySessions: { [ymd()]: { started: true, ended: false, startTime: admin.firestore.Timestamp.fromMillis(s), endTime: null } } }, { merge: true });
}
// B43: pin the Discipline deadline to 23:59 and wait until the server has it, so the recheck scenarios don't depend on the
// time of day (the 21:00 default settles today as missed late in the evening).
async function pinDeadline(uid) {
  await db.doc(`userSettings/${uid}`).set({ discipline: { enabled: true, deadline: '23:59', enabledOn: ymd(), strict: true } }, { merge: true });
  for (let i = 0; i < 20; i++) { const d = (await db.doc(`userSettings/${uid}`).get()).data(); if (d && d.discipline && d.discipline.deadline === '23:59') return; await sleep(100); }
  throw new Error('deadline not stored');
}
const streakCount = async (p) => (await p.locator('[data-test=streak-count]').textContent().catch(() => '')).trim();
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const yday = ymd(new Date(Date.now() - 864e5));
  // 1) rank medal at every tier: streak n-1 seen on this device, n stored -> card plays the level-up from n-1 to n
  const names = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'];
  const ONLY = process.env.ONLY || 'rank,recheck,early,gate,timer'; const on = (k) => ONLY.split(',').includes(k);
  if (on('rank')) for (let n = 1; n <= 5; n++) {
    const email = `zztest.b41.rank${n}@example.com`; const uid = await seedUser(email, `ZZTEST Rank ${n}`);
    await seedDay(uid, { doneAfter: 0, open: 2 });
    await db.doc(`streaks/${uid}`).set({ streak: n, bestStreak: n, lastCompletionDate: ymd(), dayDate: ymd(), dayDone: [], counted: [ymd()] });
    const p = await page(br, { fn: ([u, v]) => { localStorage.setItem(`cn_seen_streak_${u}`, JSON.stringify({ value: v, date: null })); }, arg: [uid, n - 1] });
    await login(p, email); await openHome(p);
    await p.waitForSelector('[data-test=streak-fx]', { timeout: 20000 }).catch(() => {});
    const card = p.locator('.progress-section'); await card.scrollIntoViewIfNeeded().catch(() => {});
    if (n === 1) { await sleep(500); const r0 = await p.getAttribute('[data-test=streak-rank]', 'data-rank').catch(() => null); ok('charge from 0 shows the Bronze medal', r0 === 'Bronze', r0); await card.screenshot({ path: `${SHOTS}${TAG}-rank-0-bronze.png` }).catch(() => {}); }
    await p.waitForSelector('[data-test=rank-burst]', { timeout: 4000 }).catch(() => {});
    const r = await p.getAttribute('[data-test=rank-burst]', 'data-rank').catch(() => null);
    const label = await p.textContent('[data-test=streak-rank-label]').catch(() => '');
    const emb = await p.locator(`[data-test=rank-emblem-${names[n].toLowerCase()}]`).count();
    ok(`streak ${n}: ${names[n]} medal + burst inside the existing medal`, r === names[n] && emb === 1 && label.includes(names[n].toUpperCase()), `${r} / ${label}`);
    await sleep(120); await card.screenshot({ path: `${SHOTS}${TAG}-rank-${n}-${names[n].toLowerCase()}.png` }).catch(() => {});
    await sleep(1500); ok(`streak ${n}: overlay settles, count shows ${n}/5`, (await streakCount(p)).startsWith(`${n}/5`), await streakCount(p));
    ok(`streak ${n}: no page errors`, p.errs.length === 0, p.errs.join(' | ')); await p.context().close();
  }
  // 2) automatic recheck: 5 tasks done after Start Day + 1 before; no tap -> streak goes 2 -> 3 on its own; the early task is not counted
  if (on('recheck')) { const email = 'zztest.b41.recheck@example.com'; const uid = await seedUser(email, 'ZZTEST Recheck');
    await seedDay(uid, { doneAfter: 5, doneBefore: 1, open: 1 });
    await pinDeadline(uid);
    await db.doc(`streaks/${uid}`).set({ streak: 2, bestStreak: 2, lastCompletionDate: yday, counted: [yday] });
    const p = await page(br); await login(p, email); await openHome(p); await sleep(6000); await dismiss(p);
    const st = (await db.doc(`streaks/${uid}`).get()).data();
    ok('recheck (no tap): 5 done after Start Day counts the day', st.streak === 3 && st.lastCompletionDate === ymd(), JSON.stringify({ s: st.streak, l: st.lastCompletionDate }));
    ok('recheck: task done before Start Day not counted', (st.dayDone || []).length === 5, String((st.dayDone || []).length));
    await sleep(2500); ok('recheck: card shows 3/5', (await streakCount(p)).startsWith('3/5'), await streakCount(p)); await p.context().close(); }
  // 3) only 4 after Start Day (+2 before): stays uncounted
  if (on('early')) { const email = 'zztest.b41.early@example.com'; const uid = await seedUser(email, 'ZZTEST Early');
    await seedDay(uid, { doneAfter: 4, doneBefore: 2, open: 1 });
    await pinDeadline(uid);
    await db.doc(`streaks/${uid}`).set({ streak: 2, bestStreak: 2, lastCompletionDate: yday, counted: [yday] });
    const p = await page(br); await login(p, email); await openHome(p); await sleep(6000);
    const st = (await db.doc(`streaks/${uid}`).get()).data(); ok('recheck: 4 after + 2 before Start Day does not count', st.lastCompletionDate === yday && (st.dayDone || []).length === 4, JSON.stringify({ l: st.lastCompletionDate, d: (st.dayDone || []).length })); await p.context().close(); }
  // 4) Discipline gate: boss set, not cleared -> not counted; boss cleared elsewhere -> visibility/resume recheck counts it (no tap)
  if (on('gate')) { const email = 'zztest.b41.gate@example.com'; const uid = await seedUser(email, 'ZZTEST Gate');
    await seedDay(uid, { doneAfter: 5, open: 1, boss: true });
    await db.doc(`userSettings/${uid}`).set({ discipline: { enabled: true, deadline: '23:59' } }, { merge: true });
    await db.doc(`discipline/${uid}`).set({ bossDate: ymd(), bossTitle: 'ZZTEST open 0', bossClearedDate: null }, { merge: true });
    await db.doc(`streaks/${uid}`).set({ streak: 2, bestStreak: 2, lastCompletionDate: yday, counted: [yday] });
    const p = await page(br); await login(p, email); await openHome(p); await sleep(6000); await dismiss(p);
    let st = (await db.doc(`streaks/${uid}`).get()).data(); ok('gate blocked: boss not cleared -> not counted', st.lastCompletionDate === yday, st.lastCompletionDate);
    await db.doc(`discipline/${uid}`).set({ bossClearedDate: ymd() }, { merge: true });
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(3000);
    st = (await db.doc(`streaks/${uid}`).get()).data(); ok('gate cleared -> recheck counts the day with no task tap', st.streak === 3 && st.lastCompletionDate === ymd(), JSON.stringify({ s: st.streak, l: st.lastCompletionDate }));
    await p.context().close(); }
  // 5) periodic: same as 4 but no event; wait for the 45 s timer
  if (on('timer')) { const email = 'zztest.b41.timer@example.com'; const uid = await seedUser(email, 'ZZTEST Timer');
    await seedDay(uid, { doneAfter: 5, open: 1, boss: true });
    await db.doc(`userSettings/${uid}`).set({ discipline: { enabled: true, deadline: '23:59' } }, { merge: true });
    await db.doc(`discipline/${uid}`).set({ bossDate: ymd(), bossTitle: 'ZZTEST open 0', bossClearedDate: null }, { merge: true });
    await db.doc(`streaks/${uid}`).set({ streak: 1, bestStreak: 1, lastCompletionDate: yday, counted: [yday] });
    const p = await page(br); await login(p, email); await openHome(p); await sleep(5000);
    await db.doc(`discipline/${uid}`).set({ bossClearedDate: ymd() }, { merge: true });
    let st; for (let i = 0; i < 14; i++) { await sleep(5000); st = (await db.doc(`streaks/${uid}`).get()).data(); if (st.lastCompletionDate === ymd()) break; }
    ok('periodic recheck (no event, no tap) counts the day within ~60 s', st.streak === 2 && st.lastCompletionDate === ymd(), JSON.stringify({ s: st.streak, l: st.lastCompletionDate }));
    await p.context().close(); }
  await br.close(); const fail = results.filter((r) => !r.c); console.log(`${results.length - fail.length}/${results.length} passed`); process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
