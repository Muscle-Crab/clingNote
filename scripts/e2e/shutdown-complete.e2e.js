// Complete during shutdown + tomorrow's planning window e2e (local emulators only, ZZTEST users). The REAL eight-hour-day function
// runs in-process against the emulator with a mocked clock. Lock-in 07:00-15:00, shut until the next 07:00 wake.
// Covers: custom plan time (Settings row) opens at 18:30 not 18:29; default 8 PM: 7:59 PM shut overlay, 8:00 PM auto-opens on
// tomorrow's tab; add a task to tomorrow, complete tomorrow's task early (kept as tomorrow's), complete an open shut-day task in
// place; the lock-in result does not change; once per evening; 11:59 PM still open; 12:00 AM hard close (overlay back).
// MODE=before against the base build only takes the "before" shots (no planning path, completion hidden behind the overlay).
// Run: EMU_AUTH_PORT=9611 EMU_FS_PORT=8611 WEB_PORT=8613 CHROME=... SHOTS=/workspace/plan-shots/shutdown-complete/ node scripts/e2e/shutdown-complete.e2e.js
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, admin, sleep, seedUser, emailLogin, idTokenFor, B } = H; const ok = (cond, name) => H.ok(name, cond);
const { handler } = require('../../netlify/functions/eight-hour-day');
const SHOTS = process.env.SHOTS || '/tmp/zzshots/shutdown-complete-'; const TZ = 'America/New_York'; const BEFORE = process.env.MODE === 'before';
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const Ts = admin.firestore.Timestamp;
const nyParts = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { ymd: `${p.year}-${p.month}-${p.day}`, wd: p.weekday }; };
const atNY = (h, m = 0) => { const parts = nyParts(Date.now()).ymd;
  const guess = Date.parse(`${parts}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const off = (ms) => { const s = new Date(ms).toLocaleString('en-US', { timeZone: TZ, hourCycle: 'h23' }); return Date.parse(new Date(s + ' UTC').toISOString()) - ms; };
  return guess - off(guess); };
let clock = atNY(7); const now = () => Math.round(clock);
const fn = (body, headers) => handler({ httpMethod: 'POST', headers, body }, {}, { verify: (t) => admin.auth().verifyIdToken(t), db, now, ts: (ms) => Ts.fromMillis(ms), serverTime: () => Ts.fromMillis(now()), apiKey: undefined });
const api = async (uid, b) => { const r = await fn(JSON.stringify(b), { authorization: 'Bearer ' + await idTokenFor(uid) }); return { code: r.statusCode, body: JSON.parse(r.body) }; };
const dd = async (p) => { for (let i = 0; i < 3; i++) { const b = p.locator('.drama-btn, .bb-x, .dsp-skip'); if (await b.count()) { await b.first().click({ timeout: 2000 }).catch(() => {}); await sleep(400); } } };
const ehDoc = async (uid) => (await db.doc(`eightHour/${uid}`).get()).data() || {};
const waitFor = async (f, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(400); } return false; };
const tasksOf = async (uid, day) => ((await db.doc(`weeklyRoutines/${uid}_${day}`).get()).data() || {}).tasks || [];

(async () => {
  const FS = process.env.EMU_FS_PORT || 8080, AU = process.env.EMU_AUTH_PORT || 9099;
  await fetch(`http://127.0.0.1:${FS}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AU}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const email = 'zztest-shutdown-complete@example.com';
  const uid = await seedUser(email, 'Shutdown ZZTEST');
  if (uid === 'dsDDbr945rawMAUKKpIAJcnPYrX2') throw new Error('refusing to touch a real account');
  await db.doc(`users/${uid}`).set({ lockInEnabled: true }, { merge: true });
  const todayWd = nyParts(Date.now()).wd; const today = todayWd; const tomorrow = SHORT[(SHORT.indexOf(todayWd) + 1) % 7];
  const tomorrowYmd = nyParts(atNY(12) + 24 * 3600e3).ymd;
  const mk = (t, i) => ({ id: 'zz' + i, title: 'ZZTEST ' + t, completed: false, estimateMin: 30, createdAt: 1000 + i });
  await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks: ['Write report', 'Gym', 'Email', 'Read', 'Plan week'].map(mk) });
  await db.doc(`weeklyRoutines/${uid}_${tomorrow}`).set({ tasks: [mk('Tomorrow prep', 9)] });
  await api(uid, { action: 'plan', wakeTime: '07:00', taskCount: 5, tz: TZ });
  const st = await api(uid, { action: 'start', hours: 8 }); ok(st.code === 200, 'lock-in started 07:00-15:00');
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: TZ, reducedMotion: 'reduce' });
  await ctx.addInitScript((u) => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn.coach.' + u, JSON.stringify({ done: [], off: true })); }, uid);
  await ctx.route('**/.netlify/functions/eight-hour-day**', async (route) => { const q = route.request(); const r = await fn(q.postData(), { authorization: q.headers().authorization }); route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body }); });
  await ctx.route('**/.netlify/functions/!(eight-hour-day)**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  await emailLogin(p, email);
  const at = async (h, m, path = '/home') => { clock = h === 24 ? atNY(23, 59) + 60000 : atNY(h, m); await p.goto(B + path, { waitUntil: 'load' }); await sleep(3000); await dd(p); };
  const shutOn = () => p.locator('[data-test=eh-shutdown]').count().then((n) => n > 0);
  const planRow = () => p.locator('[data-test=eh-plan-open]').count().then((n) => n > 0);

  if (BEFORE) {
    await at(20, 0); ok(await shutOn(), 'before: shut overlay at 8 PM');
    ok(!(await planRow()), 'before: no planning path');
    ok(!(await p.locator('button.task-check').isVisible().catch(() => false)), 'before: completion not reachable');
    await p.screenshot({ path: SHOTS + 'before-1-shut-8pm.png' });
    await at(21, 0, '/profile/' + uid); await p.screenshot({ path: SHOTS + 'before-2-settings.png' });
    await br.close(); const f = H.results.filter((r) => !r.pass); console.log(`shutdown-complete (before) e2e: ${H.results.length - f.length}/${H.results.length} passed`); process.exit(f.length ? 1 : 0);
  }

  // 0) Settings: custom plan time 18:30 inside the existing lock-in card
  await at(8, 0, '/profile/' + uid);
  const pt = p.locator('[data-test=plan-time]'); await pt.scrollIntoViewIfNeeded().catch(() => {});
  ok(await pt.isVisible().catch(() => false), 'settings: "Plan tomorrow at" row in the lock-in card');
  ok((await pt.inputValue()) === '20:00', 'settings: default 8:00 PM');
  await p.locator('[data-test=plan-time-row]').screenshot({ path: SHOTS + 'after-0-settings-row.png' }).catch(() => {});
  await pt.fill('18:30'); await pt.dispatchEvent('change');
  ok(await waitFor(async () => ((await db.doc(`users/${uid}`).get()).data() || {}).planOpenTime === '18:30'), 'settings: plan time saved (18:30)');
  const earned0 = JSON.stringify(((await ehDoc(uid)).lock || {}).earned ?? null);

  // 1) shut after the lock-in
  await at(15, 30); ok(await shutOn(), '15:30 shut overlay'); ok(!(await planRow()), '15:30 no planning yet');
  await p.screenshot({ path: SHOTS + 'after-1-shut-1530.png' });
  // 2) custom open time
  await at(18, 29); ok(await shutOn() && !(await planRow()), 'custom 18:29: still shut');
  await at(18, 30); ok(!(await shutOn()), 'custom 18:30: planning auto-opens');
  ok(/Planning tomorrow/.test(await p.locator('body').innerText()), 'custom 18:30: pill says Planning tomorrow');
  await p.screenshot({ path: SHOTS + 'after-2-custom-1830-open.png' });

  // back to the default 8 PM for the boundary checks (a fresh evening: clear the once-per-evening mark)
  await db.doc(`users/${uid}`).set({ planOpenTime: '20:00' }, { merge: true });
  await p.evaluate(() => localStorage.removeItem('clingnote.planWin.seen'));
  await at(19, 59); ok(await shutOn(), '7:59 PM: shut overlay'); ok(!(await planRow()), '7:59 PM: no plan row');
  await p.screenshot({ path: SHOTS + 'after-3-shut-759pm.png' });
  await at(20, 0); ok(!(await shutOn()), '8:00 PM: auto-opens');
  ok(await waitFor(async () => (await p.locator('.day-tab--selected .day-tab-name').textContent().catch(() => '')).trim() === tomorrow), '8:00 PM: on tomorrow\'s tab');
  ok(await waitFor(() => p.locator('.task-card', { hasText: 'ZZTEST Tomorrow prep' }).isVisible().catch(() => false)), 'tomorrow\'s tasks shown');
  await p.screenshot({ path: SHOTS + 'after-4-8pm-planning-tomorrow.png' });

  // 3) plan: add a task to tomorrow
  await p.click('[data-test=create-task-fab]'); await sleep(900); await p.fill('#nt-name', 'ZZTEST Planned tonight');
  await p.locator('.nt-form button[type=submit]').click(); await sleep(2500); await dd(p);
  ok(await waitFor(async () => (await tasksOf(uid, tomorrow)).some((t) => t.title === 'ZZTEST Planned tonight')), 'added a task to tomorrow');
  // 4) complete tomorrow's task early -> stored, stamped completedFor tomorrow
  const tc = p.locator('.task-card', { hasText: 'ZZTEST Tomorrow prep' }).locator('[data-test=task-check]');
  ok(await tc.isVisible().catch(() => false), 'tomorrow\'s task has the done check in the window');
  await tc.click(); 
  ok(await waitFor(async () => { const t = (await tasksOf(uid, tomorrow)).find((x) => x.title === 'ZZTEST Tomorrow prep'); return t && t.completed && t.completedFor === tomorrowYmd; }), 'completed tomorrow\'s task (completedFor = tomorrow)');
  await sleep(800); await p.screenshot({ path: SHOTS + 'after-5-completed-tomorrow-task.png' });
  // 5) complete an open shut-day task, in place
  await p.locator('.day-tab--today').click(); await sleep(2500); await dd(p);
  const before = await tasksOf(uid, today);
  const gc = p.locator('.task-card', { hasText: 'ZZTEST Gym' }).locator('[data-test=task-check]'); await gc.click();
  ok(await waitFor(async () => (await tasksOf(uid, today)).find((x) => x.title === 'ZZTEST Gym')?.completed === true), 'completed an open shut-day task');
  const after = await tasksOf(uid, today); ok(after.length === before.length && after.map((t) => t.id).join() === before.map((t) => t.id).join(), 'shut day: completed in place (no shrink/reorder)');
  ok(JSON.stringify(((await ehDoc(uid)).lock || {}).earned ?? null) === earned0, 'lock-in result unchanged by late completions');
  await sleep(600); await p.screenshot({ path: SHOTS + 'after-6-completed-shutday-task.png' });
  // tomorrow's early completion survives switching tabs (old-week reset skips it)
  await p.locator('.day-tab', { hasText: tomorrow }).first().click(); await sleep(2500);
  ok((await tasksOf(uid, tomorrow)).find((x) => x.title === 'ZZTEST Tomorrow prep')?.completed === true, 'early completion kept after reopening tomorrow\'s tab');

  // 6) once per evening: closed via the pill -> stays closed on reload, the overlay offers "Plan tomorrow"
  await p.locator('.ehp, [data-test=eh-pill]').first().click({ timeout: 4000 }).catch(() => {}); await sleep(800);
  await at(21, 0); ok(await shutOn() && await planRow(), 'once per evening: no second auto-open, plan row offered');
  await p.screenshot({ path: SHOTS + 'after-7-reopen-row.png' });
  await p.click('[data-test=eh-plan-open]'); await sleep(1500); ok(!(await shutOn()), 'plan row reopens planning');
  // 7) 11:59 PM still open, 12:00 AM hard close
  await at(23, 59); ok(!(await shutOn()) || await planRow(), '11:59 PM: planning still available');
  await at(24, 0); ok(await shutOn(), '12:00 AM: hard close, overlay back'); ok(!(await planRow()), '12:00 AM: no plan row');
  await p.screenshot({ path: SHOTS + 'after-8-midnight-closed.png' });

  await br.close(); const f = H.results.filter((r) => !r.pass); console.log(`shutdown-complete e2e: ${H.results.length - f.length}/${H.results.length} passed`); process.exit(f.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
