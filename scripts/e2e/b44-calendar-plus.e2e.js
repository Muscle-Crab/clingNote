// B44 calendar+ e2e: plain-word entry (local parser fallback + mocked AI), category colour, multiple reminders, location + map link
// + leave-time, busy/free strip from mocked device calendars (window.__CN_TEST_BUSY__, emulator builds only), work hours + focus row.
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
const sched = async (uid) => ((((await db.doc(`users/${uid}`).get()).data() || {}).scheduledTasks || {}).tasks || []);
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); };
(async () => {
  const ON = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); const at = (h, m = 0) => d0.getTime() + (h * 60 + m) * 60000;
  const busy = [{ startMs: at(9), endMs: at(10) }, { startMs: at(14), endMs: at(15, 30) }];
  // 1) add-task sheet: plain words, reminders, category, place
  if (ON('add')) { const email = 'zztest.b44.calplus@example.com'; const uid = await seedUser(email, 'ZZTEST CalPlus');
    const p = await page(br, { busy }); await login(p, email);
    await p.click('[data-test=create-task-fab], .fab-add'); await sleep(500);
    await p.fill('#nt-name', 'gym tomorrow at 6'); await sleep(400);
    await p.locator('.nt-sheet').screenshot({ path: SHOTS + `${TAG}-add-sheet.png` }).catch((e) => console.log('shot failed', String(e).slice(0, 160)));
    if (AFTER) {
      const hint = p.locator('[data-test=nl-hint]'); ok('plain words: one compact hint row appears', await hint.count() === 1);
      ok('plain words: hint names tomorrow 6 PM', /Tomorrow/.test(await hint.innerText()) && /6:00 PM/.test(await hint.innerText()), await hint.innerText().catch(() => ''));
      await hint.click(); await sleep(400);
      ok('plain words: title cleaned to "Gym"', (await p.inputValue('#nt-name')) === 'Gym');
      ok('plain words: schedule set to tomorrow 18:00', (await p.inputValue('[data-test=sched-date]')) === tomorrow() && (await p.inputValue('[data-test=sched-time]')) === '18:00');
      await p.click('[data-test=rem-add]'); await p.selectOption('[data-test=rem-pick]', '1440'); await p.click('[data-test=rem-add]'); await p.selectOption('[data-test=rem-pick]', '10');
      ok('reminders: two chips', await p.locator('[data-test=rem-chip]').count() === 2);
      await p.click('[data-test=cat-health]');
      ok('category: health chip on', await p.locator('[data-test=cat-health].on').count() === 1);
      await p.click('.advanced-toggle'); await sleep(300);
      await p.fill('[data-test=task-place]', 'Planet Fitness Main St'); await p.selectOption('[data-test=task-travel]', '20');
      await p.locator('[data-test=task-place]').scrollIntoViewIfNeeded().catch(() => {}); await sleep(200); await p.locator('.nt-sheet').screenshot({ path: SHOTS + `${TAG}-add-sheet-filled.png` }).catch((e) => console.log('shot failed', String(e).slice(0, 160)));
      await p.click('button[type=submit]'); await sleep(3000);
      const e = (await sched(uid)).find((x) => x.title === 'Gym');
      ok('saved: scheduled tomorrow 18:00', e && e.scheduledDate === tomorrow() && e.scheduledTime === '18:00', JSON.stringify(e || {}));
      ok('saved: reminders [1440,10], category health', e && JSON.stringify(e.remindOffsets) === '[1440,10]' && e.category === 'health', JSON.stringify(e || {}));
      ok('saved: place + 20 min travel', e && e.location === 'Planet Fitness Main St' && e.travelMin === 20);
    } else { await p.click('.advanced-toggle').catch(() => {}); await sleep(300); await p.locator('.nt-sheet').screenshot({ path: SHOTS + `${TAG}-add-sheet-advanced.png` }).catch((e) => console.log('shot failed', String(e).slice(0, 160))); }
    ok('add sheet: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }
  // 2) local parser fallback with a day-list task (today, timed) + detail sheet (map link, colour)
  if (ON('detail')) { const email = 'zztest.b44.calplus2@example.com'; const uid = await seedUser(email, 'ZZTEST CalPlus2', [{ title: 'ZZTEST dentist', completed: false, createdAt: 'zz-den-1', startTime: '16:00', category: 'health', location: '12 Oak St, Springfield', travelMin: 15, remindOffsets: [60, 10] }]);
    const p = await page(br, { busy }); await login(p, email);
    await p.click('[data-test=section-toggle-afternoon]').catch(() => {}); await sleep(600);
    await p.locator('.task-card', { hasText: 'ZZTEST dentist' }).first().screenshot({ path: SHOTS + `${TAG}-task-card.png` }).catch((e) => console.log('shot failed', String(e).slice(0, 160)));
    await p.locator('.task-card', { hasText: 'ZZTEST dentist' }).first().click({ position: { x: 230, y: 6 } }).catch(() => {}); await sleep(800);
    await p.locator('[data-test=task-detail-sheet]').screenshot({ path: SHOTS + `${TAG}-task-detail.png` }).catch((e) => console.log('shot failed', String(e).slice(0, 160)));
    if (AFTER) {
      const link = p.locator('[data-test=detail-map]'); ok('detail: map link row', await link.count() === 1);
      ok('detail: Apple Maps URL', /^https:\/\/maps\.apple\.com\/\?q=12%20Oak%20St/.test(await link.getAttribute('href') || ''), await link.getAttribute('href').catch(() => ''));
      ok('detail: leave-by time shown (4:00 PM - 15 min)', /Leave by 3:45 PM/.test(await link.innerText()), await link.innerText().catch(() => ''));
      ok('detail: reminders listed', /1 hr.*10 min|10 min.*1 hr/.test(await p.locator('[data-test=detail-facts]').innerText()));
      const card = p.locator('.task-card', { hasText: 'ZZTEST dentist' }).first(); ok('card: health colour (green tone)', (await card.locator('.tone-green, [data-tone=green], .task-cat--green').count()) > 0);
    }
    await p.keyboard.press('Escape'); await p.locator('[data-test=task-detail-sheet] .modal-close, [data-test=task-detail-sheet] button:has-text("✕")').first().click({ timeout: 1500 }).catch(() => {}); await sleep(300);
    // schedule picker with a busy clash (mocked device calendars)
    await p.click('[data-test=create-task-fab], .fab-add'); await sleep(400); await p.fill('#nt-name', 'ZZTEST call bank');
    await p.click('[data-test=schedule-switch]'); await p.fill('[data-test=sched-date]', ymd()); await p.fill('[data-test=sched-time]', '09:30'); await sleep(600);
    await p.locator('[data-test=schedule-picker]').screenshot({ path: SHOTS + `${TAG}-schedule-busy.png` }).catch((e) => console.log('shot failed', String(e).slice(0, 160)));
    if (AFTER) {
      const row = p.locator('[data-test=busy-row]'); ok('busy: one compact busy/free row', await row.count() === 1);
      ok('busy: clash named + next free slot offered', /Busy/.test(await row.innerText()) && /10:00 AM/.test(await row.innerText()), await row.innerText().catch(() => ''));
      await row.click(); await sleep(300); ok('busy: tap moves the time to the free slot', (await p.inputValue('[data-test=sched-time]')) === '10:00');
      ok('busy: no titles exposed (only times)', !/ZZTEST|Meeting/.test(await row.innerText()));
    }
    // local parser fallback (no AI for a free user)
    await p.fill('#nt-name', 'pay rent friday 9am'); await sleep(400);
    if (AFTER) { const h = p.locator('[data-test=nl-hint]'); ok('fallback parser: friday 9 AM detected', (await h.count()) === 1 && /Fri/.test(await h.innerText()) && /9:00 AM/.test(await h.innerText()), await h.innerText().catch(() => '')); }
    ok('detail/busy: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }
  // 3) settings: work hours + focus row (web shows the row too; calendar writes are iOS-only)
  if (ON('settings')) { const email = 'zztest.b44.calplus3@example.com'; const uid = await seedUser(email, 'ZZTEST CalPlus3');
    const p = await page(br); await login(p, email);
    await p.goto(B + '/profile/' + uid, { waitUntil: 'load' }); await sleep(3000);
    const sec = p.locator('[data-test=calendar-sync-setting]'); await sec.scrollIntoViewIfNeeded().catch(() => {});
    await sec.screenshot({ path: SHOTS + `${TAG}-settings-calendar.png` }).catch((e) => console.log('shot failed', String(e).slice(0, 160)));
    if (AFTER) {
      const row = p.locator('[data-test=timeblock-row]'); ok('time blocks: one compact row', await row.count() === 1);
      await row.click(); await sleep(300);
      await p.fill('[data-test=work-start]', '08:30'); await p.fill('[data-test=work-end]', '16:30'); await p.selectOption('[data-test=focus-min]', '90'); await p.click('[data-test=timeblock-save]'); await sleep(1500);
      await sec.screenshot({ path: SHOTS + `${TAG}-settings-calendar-open.png` }).catch((e) => console.log('shot failed', String(e).slice(0, 160)));
      const u = (await db.doc(`users/${uid}`).get()).data() || {};
      ok('time blocks: saved on the user doc', u.timeBlocks && u.timeBlocks.start === '08:30' && u.timeBlocks.end === '16:30' && u.timeBlocks.focusMin === 90, JSON.stringify(u.timeBlocks || {}));
      ok('time blocks: summary updates', /8:30 AM.*4:30 PM/.test(await p.locator('[data-test=timeblock-row]').innerText()) && /1h 30m/.test(await p.locator('[data-test=timeblock-row]').innerText()));
    }
    ok('settings: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }
  await br.close();
  const f = results.filter((r) => !r.c).length; console.log(`b44 calendar+ e2e (${TAG}): ${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
