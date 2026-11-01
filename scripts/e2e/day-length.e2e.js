// Day length + morning flow e2e (local emulators only, ZZTEST users). The REAL eight-hour-day function runs in-process against the
// emulator; its clock is mocked (the client follows the server clock through its offset), so a 6h / 3h day can be crossed in seconds.
// Covers: prompt on first open, 8 preselected, picker 3..12 in half hours, Are-you-sure with the end time, Change, no auto-start before
// Confirm, start = confirm time, 6h countdown + end time, frozen hours, reload persistence, 15/5-min warnings, shutdown at the end,
// 3h short span crossing the end live, profile setting saved to users/{uid}.dayLengthHours.
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, admin, ok, sleep, seedUser, emailLogin, idTokenFor, B } = H;
const { handler } = require('../../netlify/functions/eight-hour-day');
const SHOTS = process.env.SHOTS || '/tmp/zzshots/'; const TZ = 'America/New_York';
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const M = 60000, HR = 3600000;
let clock = Date.now(); const now = () => Math.round(clock);
const Ts = admin.firestore.Timestamp;
const fn = (body, headers) => handler({ httpMethod: 'POST', headers, body }, {}, { verify: (t) => admin.auth().verifyIdToken(t), db, now, ts: (ms) => Ts.fromMillis(ms), serverTime: () => Ts.fromMillis(now()), apiKey: undefined });
const api = async (uid, body) => { const r = await fn(JSON.stringify(body), { authorization: 'Bearer ' + await idTokenFor(uid) }); return { code: r.statusCode, body: JSON.parse(r.body) }; };
const clockText = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });

async function page(br, label) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: TZ });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); });
  await ctx.route('**/.netlify/functions/eight-hour-day**', async (route) => {
    const req = route.request(); const r = await fn(req.postData(), { authorization: req.headers().authorization });
    route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body });
  });
  await ctx.route('**/.netlify/functions/!(eight-hour-day)**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); const errs = [];
  p.on('pageerror', (e) => { if (/SDK already initialized/.test(e.message)) return; errs.push(e.message); console.log(`[${label} pageerror]`, e.message); });
  p.errs = errs; return p;
}
const seedDay = async (email, name) => {
  const uid = await seedUser(email, name);
  await db.doc(`users/${uid}`).set({ lockInEnabled: true }, { merge: true }); // lock-in is opt-in since lockIn.js
  const today = WEEK[(new Date().getDay() + 6) % 7];
  await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks: [{ title: 'ZZTEST Write report', completed: false, estimateMin: 60 }, { title: 'ZZTEST Gym', completed: false, estimateMin: 45 }] });
  const r = await api(uid, { action: 'plan', wakeTime: '00:00', taskCount: 2, tz: TZ }); // wake time already passed today
  ok(`${name}: plan saved (${r.code})`, r.code === 200);
  return uid;
};
// Since the robot morning report, the hours prompt opens from Start (card or report), not by itself: close the report, tap Start.
const openPrompt = async (p) => {
  await p.locator('[data-test=day-prompt], [data-test=boss-briefing], [data-test=eh-start]').first().waitFor({ timeout: 20000 }).catch(() => {});
  if (await p.locator('[data-test=day-prompt]').count()) return;
  await p.locator('[data-test=boss-briefing] .bb-x').click({ timeout: 3000 }).catch(() => {}); await sleep(500);
  await p.locator('[data-test=eh-start]').first().click({ timeout: 10000 }).catch(() => {});
};
const refreshNow = (p) => p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

(async () => {
  const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
  await fetch(`http://127.0.0.1:${FP}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AP}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const br = await chromium.launch({ executablePath: process.env.CHROME });

  // ── 6-hour day ──
  const uid = await seedDay('zztest-day6@example.com', 'Dana ZZTEST');
  const p = await page(br, 'day6');
  await emailLogin(p, 'zztest-day6@example.com'); await p.evaluate(() => localStorage.removeItem('clingnote.dayPromptSeen.v1')); /* login may already have shown it once */ await p.goto(B + '/home', { waitUntil: 'load' });
  await openPrompt(p); await p.waitForSelector('[data-test=day-prompt]', { timeout: 20000 }).catch(async (e) => { await p.screenshot({ path: SHOTS + 'dbg.png' }); console.log('DBG', await p.evaluate(() => document.querySelector('[data-test=eight-hour-card]')?.innerText), p.url()); throw e; });
  ok('prompt shows on the first open of the day', /How many hours will you dedicate today\?/.test(await p.textContent('[data-test=day-prompt]')));
  ok('preselected 8h (no previous choice)', (await p.inputValue('[data-test=day-prompt-hours]')) === '8');
  const opts = await p.$$eval('[data-test=day-prompt-hours] option', (o) => o.map((x) => Number(x.value)));
  ok('picker is 3..12 in half hours (19 options)', opts.length === 19 && opts[0] === 3 && opts[18] === 12 && opts[1] === 3.5, JSON.stringify(opts));
  await sleep(1500);
  ok('no auto-start before Confirm (server has no lock)', !((await db.doc(`eightHour/${uid}`).get()).data() || {}).lock);
  for (let i = 0; i < 4; i++) await p.click('[data-test=day-prompt-minus]');
  ok('picker steps by half hours to 6', (await p.inputValue('[data-test=day-prompt-hours]')) === '6');
  await p.click('[data-test=day-prompt-next]');
  const conf = await p.textContent('[data-test=day-prompt-confirm-text]');
  ok('Are you sure shows the end time', /Your day will end at \d{1,2}:\d{2}\s?[AP]M and the app shuts down then\./.test(conf), conf);
  await p.screenshot({ path: SHOTS + 'day-prompt-confirm.png' });
  await p.click('[data-test=day-prompt-change]');
  ok('Change goes back to the picker (kept 6)', (await p.inputValue('[data-test=day-prompt-hours]')) === '6');
  await p.click('[data-test=day-prompt-next]');
  ok('still not started after Change', !((await db.doc(`eightHour/${uid}`).get()).data() || {}).lock);
  const tConfirm = now();
  await p.click('[data-test=day-prompt-confirm]');
  await p.waitForSelector('[data-test=eh-countdown]', { timeout: 15000 });
  const lock = (await db.doc(`eightHour/${uid}`).get()).data().lock;
  ok('lock: 6 hours, start = confirm time, end = start + 6h', lock.hours === 6 && lock.startMs >= tConfirm && lock.startMs - tConfirm < 15000 && lock.endMs === lock.startMs + 6 * HR, JSON.stringify({ h: lock.hours, d: lock.startMs - tConfirm }));
  ok('prompt closed after Confirm', !(await p.$('[data-test=day-prompt]')));
  const cd = await p.textContent('[data-test=eh-countdown]');
  ok('6h countdown', /^0?5:59:\d\d$/.test(cd.trim()), cd);
  const endsTxt = await p.textContent('[data-test=eh-ends]');
  ok('end time shown = start + 6h', endsTxt.includes(clockText(lock.endMs)), endsTxt + ' vs ' + clockText(lock.endMs));
  ok('choice saved to users/{uid}.dayLengthHours', (await db.doc(`users/${uid}`).get()).data().dayLengthHours === 6);
  await p.screenshot({ path: SHOTS + 'day-running-6h.png' });
  const again = await api(uid, { action: 'start', hours: 3 });
  ok('hours are frozen for the day (second start ignored)', again.body.lock.endMs === lock.endMs && again.body.lock.hours === 6);
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('[data-test=eh-countdown]', { timeout: 20000 }); await sleep(1500);
  ok('reload: no prompt again, countdown still running', !(await p.$('[data-test=day-prompt]')) && /^0?5:5\d:\d\d$/.test((await p.textContent('[data-test=eh-countdown]')).trim()));
  // warnings (time-mocked)
  clock = lock.endMs - 15 * M + 3000; await refreshNow(p); await p.waitForSelector('[data-test=eh-warning][data-min="15"]', { timeout: 10000 });
  const w15 = await p.textContent('[data-test=eh-warning]');
  ok('15-min warning banner', /15 min left in your 6-hour day\. ClingNote shuts down at/.test(w15) && w15.includes(clockText(lock.endMs)), w15);
  await p.screenshot({ path: SHOTS + 'day-warn-15.png' });
  clock = lock.endMs - 16 * M; await refreshNow(p); await sleep(1500);
  ok('no warning 16 min before the end', !(await p.$('[data-test=eh-warning]')));
  clock = lock.endMs - 5 * M + 3000; await refreshNow(p); await p.waitForSelector('[data-test=eh-warning][data-min="5"]', { timeout: 10000 });
  ok('5-min warning banner', /5 min left in your 6-hour day/.test(await p.textContent('[data-test=eh-warning]')));
  await p.screenshot({ path: SHOTS + 'day-warn-5.png' });
  await p.click('.ehw-x'); await sleep(400);
  ok('warning can be dismissed', !(await p.$('[data-test=eh-warning]')));
  // end: shutdown via the existing flow
  clock = lock.endMs + 2000; await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('[data-test=eh-shutdown]', { timeout: 20000 });
  ok('shutdown at the end ("Your 6 hours are up.")', /Your 6 hours are up\./.test(await p.textContent('[data-test=eh-shutdown]')));
  await p.screenshot({ path: SHOTS + 'day-shutdown.png' });
  // profile setting
  await p.goto(B + `/profile/${uid}`, { waitUntil: 'load' }); await p.waitForSelector('[data-test=day-length-value]', { timeout: 15000 });
  ok('profile shows the saved day length (6 h)', (await p.textContent('[data-test=day-length-value]')).trim() === '6 h');
  await p.click('[data-test=day-length-plus]'); await sleep(1200);
  ok('profile stepper saves 6.5 to users/{uid}.dayLengthHours', (await db.doc(`users/${uid}`).get()).data().dayLengthHours === 6.5 && (await p.textContent('[data-test=day-length-value]')).trim() === '6.5 h');
  ok('no page errors (local notification is a no-op on web)', p.errs.length === 0, p.errs.join(' | '));

  // ── 3-hour short span, end crossed live (no reload) ──
  clock = Date.now();
  const uid3 = await seedDay('zztest-day3@example.com', 'Tom ZZTEST');
  await db.doc(`users/${uid3}`).set({ dayLengthHours: 3.5 }, { merge: true });
  const q = await page(br, 'day3');
  await emailLogin(q, 'zztest-day3@example.com'); await q.evaluate(() => localStorage.removeItem('clingnote.dayPromptSeen.v1')); await q.goto(B + '/home', { waitUntil: 'load' });
  await openPrompt(q); await q.waitForSelector('[data-test=day-prompt]', { timeout: 20000 }); await sleep(1500);
  ok('preselected to the last choice (3.5)', (await q.inputValue('[data-test=day-prompt-hours]')) === '3.5');
  await q.click('[data-test=day-prompt-minus]'); /* 3.5 → 3, then minus is disabled */
  ok('cannot go below 3h', (await q.inputValue('[data-test=day-prompt-hours]')) === '3' && await q.isDisabled('[data-test=day-prompt-minus]'));
  await q.click('[data-test=day-prompt-next]'); await q.click('[data-test=day-prompt-confirm]');
  await q.waitForSelector('[data-test=eh-countdown]', { timeout: 15000 });
  const l3 = (await db.doc(`eightHour/${uid3}`).get()).data().lock;
  ok('3h lock', l3.hours === 3 && l3.endMs - l3.startMs === 3 * HR);
  ok('3h countdown', /^0?2:59:\d\d$/.test((await q.textContent('[data-test=eh-countdown]')).trim()));
  clock = l3.endMs - 4000; await refreshNow(q); await sleep(800);
  ok('countdown near zero', /^0?0:00:0\d$/.test((await q.textContent('[data-test=eh-countdown]')).trim()), await q.textContent('[data-test=eh-countdown]'));
  await q.waitForSelector('[data-test=eh-shutdown]', { timeout: 15000 });
  ok('app shuts down live at the end of the 3-hour day', /Your 3 hours are up\./.test(await q.textContent('[data-test=eh-shutdown]')));
  ok('no page errors (3h)', q.errs.length === 0, q.errs.join(' | '));

  console.log(`day-length e2e: ${H.results.filter((r) => r.pass).length}/${H.results.length} passed`);
  await br.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
