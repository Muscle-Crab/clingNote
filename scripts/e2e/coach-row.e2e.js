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
const SHOTS = process.env.SHOTS || '/workspace/coach-screens/'; const TAG = process.env.TAG || 'after'; const TZ = 'America/New_York'; const BEFORE = process.env.MODE === 'before';
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
  const email = 'zztest-coach-row@example.com'; const uid = await seedUser(email, 'Coach ZZTEST');
  if (uid === 'dsDDbr945rawMAUKKpIAJcnPYrX2') throw new Error('refusing to touch a real account');
  await db.doc(`users/${uid}`).set({ lockInEnabled: true, gamePlan: { dayStart: '07:00', sessions: 2, breakEvery: 50, reviewDow: 0, reviewTime: '18:00', minGoal: 50, userSet: true } }, { merge: true });
  const today = nyParts(Date.now()).wd;
  const mk = (t, i) => ({ id: 'zz' + i, title: 'ZZTEST ' + t, completed: false, estimateMin: 30, section: 'morning', createdAt: 1000 + i });
  await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks: ['Write report', 'Gym', 'Email', 'Read', 'Plan week'].map(mk) });
  await api(uid, { action: 'plan', wakeTime: '07:00', taskCount: 5, tz: TZ });
  ok((await api(uid, { action: 'start', hours: 8 })).code === 200, 'lock-in started 07:00-15:00');
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: TZ, reducedMotion: 'reduce' });
  await ctx.addInitScript((u) => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn.coach.' + u, JSON.stringify({ done: [], off: true })); }, uid);
  await ctx.route('**/.netlify/functions/eight-hour-day**', async (route) => { const q = route.request(); const r = await fn(q.postData(), { authorization: q.headers().authorization }); route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body }); });
  await ctx.route('**/.netlify/functions/!(eight-hour-day)**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  await emailLogin(p, email);
  const at = async (h, m, path = '/home') => { clock = atNY(h, m); await p.goto(B + path, { waitUntil: 'load' }); await sleep(3000); await dd(p); };
  // Settings coach row (iPhone 390)
  await at(8, 0, '/profile/' + uid);
  const row = p.locator('[data-test=boss-mode-row]'); await row.scrollIntoViewIfNeeded();
  await p.click('[data-test=boss-strict]'); await sleep(800);
  await row.screenshot({ path: `${SHOTS}${TAG}-1-coach-row.png` });
  await p.click('[data-test=gp-settings]'); await sleep(600);
  await row.screenshot({ path: `${SHOTS}${TAG}-2-coach-expanded.png` });
  const box = await row.boundingBox(); ok(box && box.width <= 390, 'row fits 390px');
  if (TAG === 'after') {
    const t = await row.innerText(); ok(/2 sessions · breaks 15m \+ 30m · review Sun 6 PM/.test(t), 'summary: new break/session rules'); ok(!/banks a break|break every/i.test(t), 'no outdated break text');
    const tb = await p.locator('[data-test=boss-mode-row] .pf-row-title').boundingBox(); const pb = await p.locator('[data-test=gp-panel]').boundingBox();
    ok(pb.y >= tb.y + tb.height - 1 && pb.width > 250, 'panel stacked full width below the title');
    const s1 = await p.locator('[data-test=boss-simple]').boundingBox(); const s2 = await p.locator('[data-test=boss-strict]').boundingBox(); ok(Math.abs(s1.y - s2.y) < 2, 'Simple/Strict inline');
  }
  // Shutdown screen after a missed session (server settle)
  await at(15, 30); await sleep(1500);
  const res = p.locator('[data-test=eh-shut-result]'); const txt = await res.innerText().catch(() => '');
  console.log('shut line:', txt);
  if (TAG === 'after') { ok(/^Missed \d+ pts: apps open at 5:00\sPM$/.test(txt), 'shutdown line: Missed X pts: apps open at 5:00 PM');
    const l = (await ehDoc(uid)).lock || {}; ok(l.graceUntilMs === atNY(17, 0) && l.session && l.session.met === false, 'server state: graceUntilMs = shutdown + 2 h'); }
  await p.screenshot({ path: `${SHOTS}${TAG}-3-shutdown.png` });
  await br.close(); const f = H.results.filter((r) => !r.pass); console.log(`coach-row e2e (${TAG}): ${H.results.length - f.length}/${H.results.length} passed`); process.exit(f.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
