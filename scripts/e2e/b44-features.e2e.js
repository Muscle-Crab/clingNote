// B44 e2e: flexible schedules (fixed every-N-days repeat), pomodoro from the ⋯ menu (phase cycling with a mocked clock),
// AI breakdown with the ai function MOCKED (the live one has no key). Two-way calendar sync is EventKit-only (iOS), so it is
// covered by scripts/test-b44-calendar-2way.js with a fake device calendar, not here.
// Emulators only (demo-clingnote), ZZTEST accounts only. Env: EMU_AUTH_PORT, EMU_FS_PORT, WEB_PORT, CHROME, SHOTS, ONLY.
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FP}`; process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AP}`;
const { chromium } = require('playwright-core'); const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-clingnote' }); const db = admin.firestore();
const B = `http://localhost:${process.env.WEB_PORT || 8099}`; const FORBIDDEN = 'dsDDbr945rawMAUKKpIAJcnPYrX2';
const SHOTS = (process.env.SHOTS || '/workspace/plan-shots/b45') + '/';
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
async function page(br, { uid, ai, clock } = {}) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((u) => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn_community_eula_v1', '1'); if (u) localStorage.setItem(`clingnote.aiConsent.v2.${u}`, '1'); }, uid || '');
  if (clock) await ctx.clock.install({ time: Date.now() });
  await ctx.route('**/.netlify/functions/**', (r) => (/functions\/ai\b/.test(r.request().url()) && ai ? ai(r) : r.fulfill({ status: 200, json: {} })));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); p.errs = []; p.on('pageerror', (e) => { if (!/OneSignal|SDK already initialized/.test(e.message + (e.stack || ''))) p.errs.push(e.message); }); return p;
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
const openMenu = async (p, title) => { const c = p.locator('.task-card', { hasText: title }).first(); await c.scrollIntoViewIfNeeded(); await c.locator('.task-more').click(); return c; };
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ONLY = process.env.ONLY || 'flex,pomo,breakdown'; const on = (k) => ONLY.split(',').includes(k);
  if (on('flex')) { const email = 'zztest.b44.flex@example.com'; const uid = await seedUser(email, 'ZZTEST Flex');
    const p = await page(br); await login(p, email);
    await p.click('[data-test=create-task-fab], .fab-add'); await p.fill('#nt-name', 'ZZTEST water plants');
    await p.click('[data-test=schedule-switch]'); await p.click('[data-test=repeat-afterCompletion]');
    await p.selectOption('[data-test=sched-every-mode]', 'interval'); await p.fill('[data-test=sched-every]', '3');
    await p.locator('[data-test=schedule-picker]').screenshot({ path: SHOTS + 'after-flex-every-n-picker.png' }).catch(() => {});
    ok('every-N: compact row (one select added, no new box)', await p.locator('[data-test=sched-every-mode]').count() === 1);
    await p.click('button[type=submit]'); await sleep(3000);
    const list = (((await db.doc(`users/${uid}`).get()).data() || {}).scheduledTasks || {}).tasks || [];
    const tpl = list.find((e) => e.title === 'ZZTEST water plants' && e.recurrence);
    ok('every-N fixed: template stored as interval/3', tpl && tpl.recurrence.freq === 'interval' && tpl.recurrence.everyDays === 3, JSON.stringify(tpl && tpl.recurrence));
    ok('every-N fixed: today occurrence materialized', (await todayTasks(uid)).some((t) => t.title === 'ZZTEST water plants' && t.templateId === (tpl && tpl.id)));
    const lbl = await p.locator('[data-test=sched-label]', { hasText: 'Every 3 days' }).count(); ok('every-N fixed: label "Every 3 days" on the card', lbl > 0);
    await p.screenshot({ path: SHOTS + 'after-flex-home.png' }).catch(() => {});
    ok('flex: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }
  if (on('pomo')) { const email = 'zztest.b44.pomo@example.com'; const uid = await seedUser(email, 'ZZTEST Pomo', [{ title: 'ZZTEST deep work', completed: false, createdAt: 'zz-pomo-1', estimateMin: 50 }]);
    const p = await page(br, { clock: true }); await login(p, email);
    await openMenu(p, 'ZZTEST deep work'); await p.screenshot({ path: SHOTS + 'after-pomo-menu.png' }).catch(() => {});
    ok('🍅 in the existing ⋯ menu', await p.locator('[data-test=pomodoro-btn]').count() === 1);
    await p.click('[data-test=pomodoro-btn]'); await sleep(2500);
    let t = (await todayTasks(uid)).find((x) => x.title === 'ZZTEST deep work');
    const len = t && (Date.parse(t.timerEndTime) - Date.parse(t.timerStartedAt)) / 60000;
    ok('pomodoro starts a 25-min focus round 1/4', t && t.timerActive && t.timerPomo && t.timerPomo.phase === 'work' && t.timerPomo.round === 1 && Math.round(len) === 25, JSON.stringify(t && { p: t.timerPomo, len }));
    await p.clock.fastForward('25:30'); await sleep(4000);
    t = (await todayTasks(uid)).find((x) => x.title === 'ZZTEST deep work');
    ok('after 25 min: break 1/4 (task not carried to tomorrow)', t && t.timerActive && t.timerPomo && t.timerPomo.phase === 'break' && !t.overdue, JSON.stringify(t && { p: t.timerPomo, o: t.overdue }));
    await p.clock.fastForward('05:00'); await sleep(4000);
    t = (await todayTasks(uid)).find((x) => x.title === 'ZZTEST deep work');
    ok('after the break: focus 2/4', t && t.timerPomo && t.timerPomo.phase === 'work' && t.timerPomo.round === 2, JSON.stringify(t && t.timerPomo));
    await p.screenshot({ path: SHOTS + 'after-pomo-running.png' }).catch(() => {});
    ok('pomo: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }
  if (on('breakdown')) { const email = 'zztest.b44.bd@example.com'; const tasks = [{ title: 'ZZTEST do taxes', completed: false, createdAt: 'zz-bd-1' }, { title: 'ZZTEST other', completed: false, createdAt: 'zz-bd-2' }];
    let uid = await seedUser(email, 'ZZTEST Breakdown', tasks); let calls = 0;
    const steps = { steps: [{ title: 'Find last year\'s return', minutes: 5 }, { title: 'Gather W-2s', minutes: 10 }, { title: 'Open tax software', minutes: 3 }], remaining: 9 };
    let p = await page(br, { uid, ai: (r) => { calls++; return r.fulfill({ status: 200, json: steps }); } }); await login(p, email);
    await openMenu(p, 'ZZTEST do taxes'); await p.click('[data-test=breakdown-btn]');
    await p.waitForSelector('[data-test=breakdown-steps] li', { timeout: 10000 }).catch(() => {});
    ok('breakdown: mocked AI steps shown in the sheet', await p.locator('[data-test=breakdown-steps] li').count() === 3 && calls === 1, `calls=${calls}`);
    await p.screenshot({ path: SHOTS + 'after-breakdown-sheet.png' }).catch(() => {});
    await p.click('[data-test=breakdown-add]'); await sleep(2500);
    const t = (await todayTasks(uid)).find((x) => x.title === 'ZZTEST do taxes');
    ok('breakdown: 3 subtasks saved on the right task', t && (t.subtasks || []).length === 3 && t.subtasks.every((s) => s.done === false), JSON.stringify(t && t.subtasks));
    ok('breakdown: other task untouched', !((await todayTasks(uid)).find((x) => x.title === 'ZZTEST other').subtasks || []).length);
    ok('breakdown: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close();
    uid = await seedUser(email, 'ZZTEST Breakdown', tasks);
    p = await page(br, { uid, ai: (r) => r.fulfill({ status: 500, json: { error: 'Server not configured' } }) }); await login(p, email);
    await openMenu(p, 'ZZTEST do taxes'); await p.click('[data-test=breakdown-btn]');
    await p.waitForSelector('[data-test=breakdown-error]', { timeout: 10000 }).catch(() => {});
    const err = await p.textContent('[data-test=breakdown-error]').catch(() => '');
    ok('breakdown: live no-key state -> calm message, nothing saved', /isn't available/.test(err) && !((await todayTasks(uid)).find((x) => x.title === 'ZZTEST do taxes').subtasks || []).length, err);
    await p.screenshot({ path: SHOTS + 'after-breakdown-nokey.png' }).catch(() => {});
    await p.context().close(); }
  await br.close(); const fail = results.filter((r) => !r.c); console.log(`b44-features e2e: ${results.length - fail.length}/${results.length} passed`); process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
