// Session end e2e: one-tap "Start next session" (hours only), no planning window (local emulators only, ZZTEST users). The REAL eight-hour-day function
// runs in-process against the emulator with a mocked clock. Lock-in 07:00-15:00, shut until the next 07:00 wake.
// Covers: the shut overlay offers only "Start next session" (hours 5..12); no plan/schedule row, no auto-open window; starting
// runs a new session now for the chosen hours; tomorrow is untouched. MODE=before against the base build only takes the "before" shot.
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
    ok(await planRow(), 'before: "Plan next session" row present');
    await p.screenshot({ path: SHOTS + 'before-1-shut-8pm.png' });
    await br.close(); const f = H.results.filter((r) => !r.pass); console.log(`shutdown-complete (before) e2e: ${H.results.length - f.length}/${H.results.length} passed`); process.exit(f.length ? 1 : 0);
  }

  const earned0 = JSON.stringify(((await ehDoc(uid)).lock || {}).earned ?? null);
  // 1) session over: one action only, "Start next session" with the hours picker (no plan / schedule step, no time or date input)
  await at(15, 30); ok(await shutOn(), '15:30 shut overlay'); ok(!(await planRow()), 'no "Plan next session" row');
  ok(!(await p.locator('[data-test=eh-sched-open]').count()) && !(await p.locator('[data-test=eh-shutdown] input').count()), 'no schedule row, no time/date input');
  // main (e54115c): fewer than TASKS_PER_SESSION done -> 2 h cooldown after the session end (server session.canStart false until 17:00)
  ok(await p.locator('[data-test=eh-next-session]').count() === 0, '15:30: cooldown, no "Start next session" yet');
  await at(17, 30); ok(await shutOn() && !(await planRow()), '17:30: still shut, no plan row');
  ok(await p.locator('[data-test=eh-next-session]').count() === 1, 'after the cooldown: one "Start next session" button');
  await p.screenshot({ path: SHOTS + 'after-1-shut.png' });
  await at(20, 0); ok(await shutOn() && !(await planRow()), '8 PM: still shut, no planning auto-open');
  // 2) unfinished tasks stay in today's list (nothing moved to tomorrow)
  const tmBefore = (await tasksOf(uid, tomorrow)).map((t) => t.title).join();
  // 3) start the next session: 6 h from now
  await p.selectOption('[data-test=eh-next-hours]', '6'); await p.click('[data-test=eh-next-session]');
  ok(await waitFor(async () => { const l = (await ehDoc(uid)).lock; return l && l.index === 1 && l.endMs - l.startMs === 6 * 3600e3 && Math.abs(l.startMs - now()) < 120000; }), 'next session starts now for 6 h');
  ok(await waitFor(async () => !(await shutOn())), 'overlay gone, session running');
  ok((await tasksOf(uid, tomorrow)).map((t) => t.title).join() === tmBefore, 'tomorrow untouched');
  await sleep(800); await dd(p); await p.screenshot({ path: SHOTS + 'after-2-next-running.png' });

  await br.close(); const f = H.results.filter((r) => !r.pass); console.log(`shutdown-complete e2e: ${H.results.length - f.length}/${H.results.length} passed`); process.exit(f.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
