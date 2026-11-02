// Whole-day walk (local emulators only, ZZTEST user, mocked native lock + browser clock synced to the in-process eight-hour-day clock):
// sessions setting -> morning session -> points break alert at 50 -> break (unlock/relock) -> Home line -> break history -> Locked apps
// row (normal + during a lock) -> session 2 from the shutdown (late in the day) -> late phase -> recap + its notification -> wake rollover.
// Run: EMU_AUTH_PORT=9399 EMU_FS_PORT=8385 WEB_PORT=8399 CHROME=... SHOTS=/workspace/lockfix-screens/walk/ node scripts/e2e/day-walk.e2e.js
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, admin, sleep, seedUser, emailLogin, B } = H;
const { handler } = require('../../netlify/functions/eight-hour-day');
const SHOTS = process.env.SHOTS || '/tmp/walk/'; const TZ = 'America/New_York'; const Ts = admin.firestore.Timestamp;
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const res = []; const step = (n, c, x = '') => { res.push([n, !!c]); console.log(`${c ? 'PASS' : 'BROKEN'} ${n} ${c ? '' : x}`); };
const atNY = (h, m = 0, plusDays = 0) => { const d = new Date(Date.now() + plusDays * 864e5); const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const guess = Date.parse(`${parts}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const off = (ms) => { const s = new Date(ms).toLocaleString('en-US', { timeZone: TZ, hourCycle: 'h23' }); return Date.parse(new Date(s + ' UTC').toISOString()) - ms; };
  return guess - off(guess); };
let clock = atNY(7, 50); const now = () => Math.round(clock);
const fn = (body, headers) => handler({ httpMethod: 'POST', headers, body }, {}, { verify: (t) => admin.auth().verifyIdToken(t, false).catch(() => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString())), db, now, ts: (ms) => Ts.fromMillis(ms), serverTime: () => Ts.fromMillis(now()), apiKey: undefined });
const ehDoc = async (uid) => (await db.doc(`eightHour/${uid}`).get()).data() || {};
const waitFor = async (f, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(400); } return false; };
const dd = async (p) => { for (let i = 0; i < 3; i++) { const b = p.locator('[data-test=boss-briefing] .bb-x, .drama-btn, button:has-text("Not now"), button:has-text("Maybe later")'); if (await b.count()) { await b.first().click({ timeout: 1500 }).catch(() => {}); await sleep(400); } } };
const shot = (p, name, sel) => (sel ? p.locator(sel).first().screenshot({ path: SHOTS + name + '.png' }) : p.screenshot({ path: SHOTS + name + '.png' })).catch((e) => console.log('shot failed', name, String(e).slice(0, 100)));
const row = (p) => p.locator('[data-test=gp-title]').innerText().catch(() => p.locator('[data-test=gp-text]').innerText()).catch(() => '');
const rowMain = (p) => p.locator('[data-test=gp-text]').innerText().catch(() => '');
const openRow = async (p) => { if ((await p.locator('[data-test=gp-toggle]').getAttribute('aria-expanded').catch(() => '')) !== 'true') await p.click('[data-test=gp-toggle]'); await sleep(400); };
const closeRow = async (p) => { if ((await p.locator('[data-test=gp-toggle]').getAttribute('aria-expanded').catch(() => '')) === 'true') await p.click('[data-test=gp-toggle]'); await sleep(300); };

(async () => {
  const FS = process.env.EMU_FS_PORT, AU = process.env.EMU_AUTH_PORT;
  await fetch(`http://127.0.0.1:${FS}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AU}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const email = 'zztest-daywalk@example.com'; const uid = await seedUser(email, 'Walk ZZTEST');
  if (uid === 'dsDDbr945rawMAUKKpIAJcnPYrX2') throw new Error('refusing to touch a real account');
  const today = WEEK[new Date(atNY(12)).getDay()]; const tomorrow = WEEK[new Date(atNY(12, 0, 1)).getDay()];
  const lastSun = (() => { const d = new Date(atNY(12)); d.setDate(d.getDate() - d.getDay()); return d.toLocaleDateString('en-CA'); })();
  await db.doc(`users/${uid}`).set({ lockInEnabled: true, bossMode: 'strict', onboardingComplete: true, paywallSeenAt: new Date(), wakeTime: '08:00',
    gamePlan: { dayStart: '08:00', closeHours: 8, sessions: 1, breakEvery: 50, minGoal: 50, reviewDow: 0, reviewTime: '18:00', lastReview: lastSun, pending: null } }, { merge: true });
  const tasks = (n, pre) => Array.from({ length: n }, (_, i) => ({ title: `ZZTEST ${pre} ${i + 1}`, completed: false, createdAt: `zz-walk-${pre}-${i}`, estimateMin: 45 }));
  await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks: tasks(6, 'Mon') }); await db.doc(`weeklyRoutines/${uid}_${tomorrow}`).set({ tasks: tasks(4, 'Tue') });
  await db.doc(`eightHour/${uid}`).delete().catch(() => {});
  const ymdNY = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ });
  await db.doc(`userSettings/${uid}`).set({ daySessions: { [ymdNY(atNY(12))]: { started: true, ended: false, startTime: Ts.fromMillis(atNY(8)), endTime: null }, [ymdNY(atNY(12, 0, 1))]: { started: true, ended: false, startTime: Ts.fromMillis(atNY(8, 0, 1)), endTime: null } } }, { merge: true });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: TZ, permissions: ['notifications'] });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn_community_eula_v1', '1'); localStorage.setItem('cn.appLock.on', '1');
    const K = 'zz.fakelock'; const rd = () => JSON.parse(localStorage.getItem(K) || '{"locked":false,"until":0,"label":"","scheduled":[],"offers":[],"breaks":[]}'); const wr = (v) => localStorage.setItem(K, JSON.stringify(v));
    window.__clingLockFake = { status: async () => ({ authorization: 'approved', selectionCount: 3, monitoring: rd().locked, ...rd() }),
      startLock: async ({ untilMs, label }) => { wr({ ...rd(), locked: true, until: untilMs, label }); return { locked: true, monitor: 'ok' }; },
      stopLock: async () => { wr({ ...rd(), locked: false, until: 0, label: '' }); return { locked: false }; },
      scheduleLock: async (o) => { const v = rd(); v.scheduled.push(o); wr(v); return { monitor: 'ok' }; }, labeledApps: async () => ({ apps: [] }), clearBreakOffer: async () => ({ cleared: true }), cancelScheduledLock: async (o) => { const v = rd(); v.cancelled = [...(v.cancelled || []), o.key]; wr(v); return { cancelled: true }; },
      offerBreak: async (o) => { const v = rd(); v.offers.push(o); wr(v); return { posted: true }; },
      startBreak: async ({ untilMs, minutes }) => { const v = rd(); v.breaks.push({ untilMs, minutes }); v.preBreak = { locked: v.locked, until: v.until }; v.locked = false; wr(v); return { started: true }; },
      endBreak: async () => { const v = rd(); if (v.preBreak && v.preBreak.locked) { v.locked = true; v.until = v.preBreak.until; } wr(v); return { ended: true }; },
      breakState: async () => ({ live: false, untilMs: 0, taken: [] }) };
    const N = []; window.__notifs = N; const Real = window.Notification; // record web notifications (the iOS LocalNotifications stand-in)
    class FakeN { constructor(t, o) { N.push({ title: t, body: o && o.body, tag: o && o.tag, at: Date.now() }); localStorage.setItem('zz.notifs', JSON.stringify(N)); } close() {} static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } }
    window.Notification = FakeN; void Real; });
  await ctx.addInitScript((u) => localStorage.setItem(`cn.coach.${u}`, JSON.stringify({ done: [], off: true })), uid);
  await ctx.route('**/.netlify/functions/eight-hour-day**', async (route) => { const q = route.request(); const r = await fn(q.postData(), { authorization: q.headers().authorization }); route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body }); });
  await ctx.route('**/.netlify/functions/!(eight-hour-day)**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.setDefaultTimeout(8000); p.on('dialog', (d) => d.accept()); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.clock.install({ time: now() });
  const setClock = async (ms) => { clock = ms; await p.clock.setSystemTime(ms); };
  const fake = () => p.evaluate(() => JSON.parse(localStorage.getItem('zz.fakelock') || '{}'));
  const home = async () => { await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3500); await dd(p); };
  await emailLogin(p, email);

  // 1) settings: 1 -> 2 sessions, break every 50 pts (apply now)
  await p.goto(B + '/profile/' + uid, { waitUntil: 'load' }); await sleep(3000); await dd(p);
  await p.locator('[data-test=gp-settings], [data-test=gp-panel]').first().click({ timeout: 4000 }).catch(() => {}); await sleep(400);
  await p.selectOption('[data-test=gp-sessions]', '2').catch((e) => console.log('sel', String(e).slice(0, 100))); await p.fill('[data-test=gp-breakevery]', '50').catch(() => {});
  await shot(p, '01-settings-2-sessions', '[data-test=gp-panel]'); await p.click('[data-test=gp-save]').catch(() => {}); await sleep(1500);
  const gp1 = ((await db.doc(`users/${uid}`).get()).data() || {}).gamePlan || {};
  step('1 pick 1 or 2 sessions (Settings, applies now)', gp1.sessions === 2 && gp1.breakEvery === 50, JSON.stringify(gp1));
  const lr = async () => (await p.locator('[data-test=locked-apps-row]').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const lockedNormal = await lr(); await shot(p, '02-locked-apps-row-normal', '[data-test=lock-in-setting]');

  // 2) morning session at the wake time (08:00)
  await setClock(atNY(8, 0)); await home();
  await p.fill('[data-test=eh-wake]', '08:00').catch((e) => console.log('wake', String(e).slice(0, 80))); await p.click('[data-test=eh-save]').catch(() => {});
  await p.locator('[data-test=day-prompt]').waitFor({ timeout: 10000 }).catch(() => {});
  if (!await p.locator('[data-test=day-prompt]').count()) { await p.locator('[data-test=eh-start]').first().click({ timeout: 5000 }).catch(() => {}); await p.locator('[data-test=day-prompt]').waitFor({ timeout: 10000 }).catch(() => {}); }
  for (let i = 0; i < 8; i++) { await p.click('[data-test=day-prompt-minus]', { timeout: 2000 }).catch(() => {}); }
  await shot(p, '03-morning-start-prompt'); await p.click('[data-test=day-prompt-next]').catch(() => {}); await sleep(400); await p.click('[data-test=day-prompt-confirm]').catch(() => {});
  await waitFor(async () => ((await ehDoc(uid)).lock || {}).endMs); let d = await ehDoc(uid);
  await setClock(atNY(8, 5)); await home();
  const r2 = await row(p); await shot(p, '04-home-morning-focus', '[data-test=gp-row]');
  step('2 morning session starts (block 0, native lock up, Focus 1/2)', d.lock && (d.lock.index || 0) === 0 && (await fake()).locked && /Focus 1\/2/.test(r2), `${JSON.stringify(d.lock && { i: d.lock.index, s: d.lock.startMs, e: d.lock.endMs })} ${r2}`);

  // 3) Locked apps row during a lock
  await p.goto(B + '/profile/' + uid, { waitUntil: 'load' }); await sleep(2500); await dd(p);
  const lockedDuring = await lr(); await shot(p, '05-locked-apps-row-during-lock', '[data-test=lock-in-setting]');
  step('3 Locked apps row: normal vs during a lock', lockedNormal && lockedDuring && lockedNormal !== lockedDuring, `normal="${lockedNormal}" during="${lockedDuring}"`);

  // 4) points: finish 3 medium tasks (20 each) -> 60 pts -> break alert fires once at 50
  await setClock(atNY(9, 30)); await home();
  for (let i = 0; i < 3; i++) { await p.locator('[data-test=task-check]').nth(0).click({ timeout: 5000 }).catch((e) => console.log('check', String(e).slice(0, 80))); await sleep(2000); }
  await waitFor(async () => /60\//.test(await row(p)), 8000);
  const offers = (await fake()).offers || [];
  step('4 points break alert fires at 50 (once)', offers.length === 1 && offers[0].points >= 50, JSON.stringify(offers));
  const r4 = await row(p); await shot(p, '06-home-points-line', '[data-test=gp-row]');
  step('5 Home points line (points never cut, break 1 status: 15m break ready)', /60\/\d+ pts/.test(r4) && /· 15m break ready/.test(r4) && await p.locator('[data-test=gp-gift]').count() === 1, r4);

  // 5) take a break: unlock, re-lock
  await openRow(p); await shot(p, '07-break-ready-open', '[data-test=gp-row]');
  await p.click('[data-test=gp-take-break]').catch(() => {}); await sleep(1200);
  const fb = await fake(); await shot(p, '08-break-running', '[data-test=gp-row]');
  const brkOn = !fb.locked && /Break ·/.test(await row(p));
  await p.click('[data-test=gp-end-break]').catch(() => {}); await sleep(1500);
  const fa = await fake();
  step('6 take a break (apps unlock, End break re-locks)', brkOn && fa.locked, `on=${brkOn} after=${JSON.stringify({ l: fa.locked, u: fa.until })}`);

  // 6) break history
  await openRow(p); await p.click('[data-test=gp-history-open]').catch(() => {}); await sleep(400);
  const hist = await p.locator('[data-test=gp-history-item]').allInnerTexts().catch(() => []); await shot(p, '09-break-history', '[data-test=gp-row]');
  step('7 break history lists the break', hist.length >= 1 && /min · at 60 pts/.test(hist[0]), JSON.stringify(hist)); await closeRow(p);

  // 7) session 1 ends -> shutdown at noon offers the afternoon session; late evening it says evening
  d = await ehDoc(uid); await setClock(d.lock.endMs + 60000); await home(); await sleep(1500);
  const noonTxt = await p.locator('[data-test=eh-next-session]').innerText().catch(() => ''); await shot(p, '10-shutdown-noon');
  await setClock(atNY(21, 0)); await home(); await sleep(1500);
  // 9 PM is past the default 8 PM plan time: planning opens by itself over the shutdown card (in-app only, apps stay locked); the pill goes back to the card
  const planAuto = !(await p.locator('[data-test=eh-shutdown]').count()) && await p.locator('[data-test=eh-pill]').count() === 1;
  await p.click('[data-test=eh-pill]').catch(() => {}); await sleep(1200);
  const eveTxt = await p.locator('[data-test=eh-next-session]').innerText().catch(() => ''); await shot(p, '11-shutdown-evening');
  step('8 shutdown wording by time (afternoon at noon; 9 PM: planning auto-opens, pill back to the card says evening)', /afternoon/.test(noonTxt) && planAuto && /evening/.test(eveTxt), `noon="${noonTxt}" planAuto=${planAuto} eve="${eveTxt}"`);
  const s1Start = ((await ehDoc(uid)).lock || {}).startMs;
  await p.click('[data-test=eh-next-session]').catch(() => {}); await waitFor(async () => { const l = (await ehDoc(uid)).lock || {}; return l.index === 1 && l.startMs !== s1Start; });
  d = await ehDoc(uid); const wake2 = atNY(8, 0, 1);
  step('9 session 2 from the shutdown (runs past the close, ends by the next wake)', d.lock.index === 1 && d.lock.endMs > atNY(16) && d.lock.endMs <= wake2 && (await fake()).locked, JSON.stringify({ s: new Date(d.lock.startMs).toISOString(), e: new Date(d.lock.endMs).toISOString(), wake2: new Date(wake2).toISOString() }));

  // 8) late phase on Home, a task finished now still counts
  await setClock(atNY(22, 0)); await home();
  await p.locator('[data-test=task-check]').nth(0).click({ timeout: 5000 }).catch(() => {}); await sleep(2500);
  const r8 = await row(p); const ph8 = await p.locator('[data-test=gp-row]').getAttribute('data-phase').catch(() => ''); await shot(p, '12-home-late-phase', '[data-test=gp-row]');
  step('10 late phase line (Session 2 · Xh left, points still count: 80)', ph8 === 'late' && /^Session 2 · \d+h \d+m left · 80\//.test(r8), `${ph8} ${r8}`);

  // 9) recap + notification at the end of session 2
  d = await ehDoc(uid); await p.clock.fastForward(d.lock.endMs - now() + 5000); clock = d.lock.endMs + 5000; await sleep(1500);
  const notifs = await p.evaluate(() => window.__notifs || []); const close = notifs.find((n) => /gp:close/.test(n.tag || ''));
  await home(); await sleep(1500); const recap = await p.locator('[data-test=eh-shut-recap]').innerText().catch(() => ''); await shot(p, '13-recap-shutdown');
  step('11 recap on the shutdown + Day done notification at session 2 end', !!recap && !!close, `recap="${recap}" notif=${JSON.stringify(close || notifs.map((n) => n.tag))}`);

  // 10) wake rollover: next day 08:00 -> old session settled with its points, new morning starts cleanly
  await setClock(atNY(8, 1, 1)); await home();
  const hs = (await db.collection(`eightHour/${uid}/history`).get()).docs.map((x) => x.data()); const h1 = hs.find((h) => h.index === 1);
  await p.locator('[data-test=day-prompt]').waitFor({ timeout: 15000 }).catch(() => {}); await shot(p, '14-wake-new-day-prompt');
  await p.click('[data-test=day-prompt-next]').catch(() => {}); await sleep(400); await p.click('[data-test=day-prompt-confirm]').catch(() => {});
  await waitFor(async () => { const l = (await ehDoc(uid)).lock || {}; return l.index === 0 && l.startMs >= wake2; }); d = await ehDoc(uid);
  await home(); await shot(p, '15-wake-new-day-home', '[data-test=gp-row]');
  step('12 wake rollover (evening session settled with points, new morning block, no overlap)', h1 && h1.earned > 0 && d.lock.index === 0 && d.lock.startMs >= wake2 && d.lock.dayKey !== hs[0].dayKey, JSON.stringify({ h1: h1 && { e: h1.earned, end: h1.endMs }, lock: { i: d.lock.index, s: d.lock.startMs, k: d.lock.dayKey } }));
  step('13 no page errors', errs.length === 0, errs.join(' | '));
  console.log(`\n${res.filter((x) => x[1]).length}/${res.length} pass`); await br.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
