// B44 wake-up auto-lock e2e (local emulators only, ZZTEST users, mocked clock via the in-process eight-hour-day handler).
// iOS locked the picked apps at 07:00 with ClingNote closed; the user opens the app at 07:40 -> the server lock is created with
// start = 07:00 (no prompt / Confirm). Also: opt-in required, skip-today = no lock, window over = refused, the settings row + note.
// Run: EMU_AUTH_PORT=9199 EMU_FS_PORT=8185 WEB_PORT=8199 CHROME=... node scripts/e2e/b44-wake-lock.e2e.js
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, admin, sleep, seedUser, emailLogin, idTokenFor, B } = H; const ok = (cond, name) => H.ok(name, cond);
const { handler } = require('../../netlify/functions/eight-hour-day');
const SHOTS = process.env.SHOTS || '/tmp/zzshots/'; const TZ = 'America/New_York'; const Ts = admin.firestore.Timestamp;
const atNY = (h, m = 0) => { const d = new Date(); const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const guess = Date.parse(`${parts}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const off = (ms) => { const s = new Date(ms).toLocaleString('en-US', { timeZone: TZ, hourCycle: 'h23' }); return Date.parse(new Date(s + ' UTC').toISOString()) - ms; };
  return guess - off(guess); };
let clock = atNY(7, 40); const now = () => Math.round(clock);
const fn = (body, headers) => handler({ httpMethod: 'POST', headers, body }, {}, { verify: (t) => admin.auth().verifyIdToken(t), db, now, ts: (ms) => Ts.fromMillis(ms), serverTime: () => Ts.fromMillis(now()), apiKey: undefined });
const api = async (uid, b) => { const r = await fn(JSON.stringify(b), { authorization: 'Bearer ' + await idTokenFor(uid) }); return { code: r.statusCode, body: JSON.parse(r.body) }; };
const ehDoc = async (uid) => (await db.doc(`eightHour/${uid}`).get()).data() || {};
const waitFor = async (f, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(400); } return false; };
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const seed = async (email, extra) => {
  const uid = await seedUser(email, 'Wake ZZTEST'); if (uid === 'dsDDbr945rawMAUKKpIAJcnPYrX2') throw new Error('refusing to touch a real account');
  await db.doc(`users/${uid}`).set({ lockInEnabled: true, dayLengthHours: 8, ...extra }, { merge: true });
  const today = WEEK[(new Date().getDay() + 6) % 7];
  await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks: ['Write report', 'Gym', 'Email'].map((t) => ({ title: 'ZZTEST ' + t, completed: false, estimateMin: 30 })) });
  await api(uid, { action: 'plan', wakeTime: '07:00', taskCount: 3, tz: TZ }); return uid;
};

(async () => {
  const FS = process.env.EMU_FS_PORT || 8080, AU = process.env.EMU_AUTH_PORT || 9099;
  await fetch(`http://127.0.0.1:${FS}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AU}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const open = async (email) => {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: TZ });
    await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); });
    await ctx.route('**/.netlify/functions/eight-hour-day**', async (route) => { const q = route.request(); const r = await fn(q.postData(), { authorization: q.headers().authorization }); route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body }); });
    await ctx.route('**/.netlify/functions/!(eight-hour-day)**', (r) => r.fulfill({ status: 200, json: {} }));
    const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); await emailLogin(p, email); await p.goto(B + '/home', { waitUntil: 'load' }); return p;
  };

  // server guards (direct): opt-in required
  const offUid = await seed('zztest-wake-off@example.com', {});
  const off = await api(offUid, { action: 'start', hours: 8, autoWake: true }); ok(off.code === 403 && off.body.code === 'wake-off', 'autoWake refused without the opt-in (403 wake-off)');

  // 1) opted in, open at 07:40 -> lock starts at 07:00, ends 15:00, no prompt
  const uid = await seed('zztest-wake-on@example.com', { wakeAutoLock: true });
  const p = await open('zztest-wake-on@example.com');
  ok(await waitFor(async () => !!(await ehDoc(uid)).lock?.startMs), 'server lock created on open');
  const d = await ehDoc(uid);
  ok(d.lock && d.lock.startMs === atNY(7) && d.lock.endMs === atNY(15), 'lock start = scheduled wake time 07:00, end = 07:00 + 8h');
  await sleep(1500); ok(!await p.locator('[data-test=day-prompt]').count(), 'no start prompt / Confirm tap needed');
  await p.screenshot({ path: SHOTS + 'after-wake-lock-home.png' });
  const again = await api(uid, { action: 'start', hours: 3, autoWake: true }); ok(again.code === 200 && again.body.lock?.endMs === d.lock.endMs, 'reconcile again is idempotent');

  // settings row + gentle note (web build: iPhone-only)
  await p.goto(B + '/profile/' + uid, { waitUntil: 'load' });
  ok(await waitFor(async () => p.locator('[data-test=wake-lock-row]').isVisible().catch(() => false)), '"Lock at wake-up" row inside Lock-in');
  ok(await p.locator('[data-test=wake-lock-toggle]').isChecked(), 'toggle reflects users.wakeAutoLock');
  ok(/iPhone app only/.test(await p.locator('[data-test=wake-lock-sub]').innerText()), 'gentle note when not on iPhone');
  await p.locator('[data-test=wake-lock-row]').scrollIntoViewIfNeeded(); await sleep(300); await p.screenshot({ path: SHOTS + 'after-wake-lock-setting.png' });
  await p.locator('[data-test=wake-lock-toggle]').click();
  ok(await waitFor(async () => (await db.doc(`users/${uid}`).get()).data().wakeAutoLock === false, 5000), 'turning it off saves wakeAutoLock=false');

  // 2) skip lock-in today -> no auto lock
  const sk = await seed('zztest-wake-skip@example.com', { wakeAutoLock: true, lockInSkipDate: d.lock.dayKey });
  const p2 = await open('zztest-wake-skip@example.com'); await sleep(6000);
  ok(!(await ehDoc(sk)).lock?.startMs, 'skipped today: no lock created');
  await p2.close();

  // 3) window over (15:30): refused
  const late = await seed('zztest-wake-late@example.com', { wakeAutoLock: true }); clock = atNY(15, 30);
  const r = await api(late, { action: 'start', hours: 8, autoWake: true }); ok(r.code === 409, 'after the wake window: refused (409)');

  await br.close(); const f = H.results.filter((x) => !x.pass); console.log(`b44-wake-lock e2e: ${H.results.length - f.length}/${H.results.length} passed`); process.exit(f.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
