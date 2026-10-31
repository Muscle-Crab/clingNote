// Evening mode e2e (local emulators only, ZZTEST users). The REAL eight-hour-day function runs in-process against the emulator with
// a mocked clock (the client follows the server clock through its offset).
// Covers: split day in the start prompt (a later block fixed at confirm), the gap between blocks keeps ClingNote open with a
// "Next <time>" pill, the later block auto-starts at its fixed time, then "Schedule next lock-in" from the shut overlay opens the app
// until that block starts; a running block can't be cancelled.
// Run: EMU_AUTH_PORT=9199 EMU_FS_PORT=8185 WEB_PORT=8199 CHROME=... node scripts/e2e/evening-mode.e2e.js
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, admin, sleep, seedUser, emailLogin, idTokenFor, B } = H; const ok = (cond, name) => H.ok(name, cond);
const { handler } = require('../../netlify/functions/eight-hour-day');
const SHOTS = process.env.SHOTS || '/tmp/zzshots/evening-'; const TZ = 'America/New_York';
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const Ts = admin.firestore.Timestamp;
// h:mm today in New York as epoch ms
const atNY = (h, m = 0) => { const d = new Date(); const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const guess = Date.parse(`${parts}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const off = (ms) => { const s = new Date(ms).toLocaleString('en-US', { timeZone: TZ, hourCycle: 'h23' }); return Date.parse(new Date(s + ' UTC').toISOString()) - ms; };
  return guess - off(guess); };
let clock = atNY(7); const now = () => Math.round(clock);
const fn = (body, headers) => handler({ httpMethod: 'POST', headers, body }, {}, { verify: (t) => admin.auth().verifyIdToken(t), db, now, ts: (ms) => Ts.fromMillis(ms), serverTime: () => Ts.fromMillis(now()), apiKey: undefined });
const api = async (uid, b) => { const r = await fn(JSON.stringify(b), { authorization: 'Bearer ' + await idTokenFor(uid) }); return { code: r.statusCode, body: JSON.parse(r.body) }; };
const dd = async (p) => { for (let i = 0; i < 3; i++) { const b = p.locator('.drama-btn'); if (await b.count()) { await b.first().click().catch(() => {}); await sleep(500); } } };
const ehDoc = async (uid) => (await db.doc(`eightHour/${uid}`).get()).data() || {};
const waitFor = async (f, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(400); } return false; };

(async () => {
  // fresh emulator state (demo project, local only)
  const FS = process.env.EMU_FS_PORT || 8080, AU = process.env.EMU_AUTH_PORT || 9099;
  await fetch(`http://127.0.0.1:${FS}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AU}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const email = 'zztest-eve-e2e@example.com';
  const uid = await seedUser(email, 'Eve ZZTEST');
  if (uid === 'dsDDbr945rawMAUKKpIAJcnPYrX2') throw new Error('refusing to touch a real account');
  await db.doc(`users/${uid}`).set({ lockInEnabled: true }, { merge: true });
  await db.doc(`eightHour/${uid}`).delete().catch(() => {});
  const today = WEEK[(new Date().getDay() + 6) % 7];
  await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks: ['Write report', 'Gym', 'Email', 'Read', 'Plan week'].map((t, i) => ({ title: 'ZZTEST ' + t, completed: false, estimateMin: [60, 45, 20, 30, 15][i] })) });
  await api(uid, { action: 'plan', wakeTime: '00:00', taskCount: 5, tz: TZ });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: TZ });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); });
  await ctx.route('**/.netlify/functions/eight-hour-day**', async (route) => { const q = route.request(); const r = await fn(q.postData(), { authorization: q.headers().authorization }); route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body }); });
  await ctx.route('**/.netlify/functions/!(eight-hour-day)**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  await emailLogin(p, email); await p.goto(B + '/home', { waitUntil: 'load' });
  await p.locator('[data-test=day-prompt], [data-test=boss-briefing], [data-test=eh-start]').first().waitFor({ timeout: 20000 }).catch(() => {});
  if (!await p.locator('[data-test=day-prompt]').count()) { await p.locator('[data-test=boss-briefing] .bb-x').click({ timeout: 3000 }).catch(() => {}); await sleep(500); await p.locator('[data-test=eh-start]').first().click({ timeout: 10000 }).catch(() => {}); }
  await p.waitForSelector('[data-test=day-prompt]', { timeout: 20000 }); await dd(p);

  // 1) split day: 8h now (07:00-15:00) + a later 3h block at 17:00
  ok(await p.locator('[data-test=day-prompt-split]').isVisible(), 'split row shown in the start prompt');
  await p.click('[data-test=day-prompt-split]');
  await p.fill('[data-test=day-prompt-later-time]', '17:00'); await p.selectOption('[data-test=day-prompt-later-hours]', '3');
  await sleep(300); await p.screenshot({ path: SHOTS + '1-split-prompt.png' });
  await p.click('[data-test=day-prompt-next]'); await sleep(400);
  ok(/5:00\s?PM.+8:00\s?PM/.test(await p.locator('[data-test=day-prompt-later-text]').innerText()), 'confirm lists the later block');
  ok(/can't be shortened or removed/.test(await p.locator('[data-test=day-prompt]').innerText()), 'confirm says blocks are fixed');
  await p.screenshot({ path: SHOTS + '2-split-confirm.png' });
  await p.click('[data-test=day-prompt-confirm]');
  ok(await waitFor(async () => ((await ehDoc(uid)).lock || {}).endMs), 'main block started');
  let d = await ehDoc(uid);
  ok(d.lock.index === 0 && d.lock.pending.length === 1 && d.lock.pending[0].startMs === atNY(17) && d.lock.pending[0].endMs === atNY(20), 'later block fixed 17:00-20:00');

  // anti-cheat: a running block can't be cancelled or the later block removed by restarting
  const again = await api(uid, { action: 'start', hours: 3 }); ok(again.code >= 400 || again.body.lock?.endMs === d.lock.endMs, 'restart does not shorten the running block');

  // 2) gap 15:00-17:00: ClingNote is open, pill shows the next block
  clock = atNY(15, 5); await p.reload({ waitUntil: 'load' }); await sleep(2500); await dd(p);
  ok(!await p.locator('[data-test=eh-shutdown]').count(), 'not shut in the gap');
  ok(/Next 5:00\s?PM/.test(await p.locator('body').innerText()), 'pill shows Next 5:00 PM');
  await p.screenshot({ path: SHOTS + '3-gap-open.png' });

  // 3) the later block auto-starts at its fixed time
  clock = atNY(17, 0) + 30000; await p.reload({ waitUntil: 'load' });
  ok(await waitFor(async () => (await ehDoc(uid)).lock?.index === 1), 'block 1 auto-started');
  d = await ehDoc(uid); ok(d.lock.startMs === atNY(17) && d.lock.endMs === atNY(20), 'block 1 keeps its fixed times');
  ok(d.sessions && d.sessions[Object.keys(d.sessions)[0]].index === 0, 'block 0 archived by day+index');
  await sleep(1500); await dd(p); await p.screenshot({ path: SHOTS + '4-block2-running.png' });

  // 4) day over: shut overlay offers one compact "Schedule next lock-in" row
  clock = atNY(20, 2); await p.reload({ waitUntil: 'load' }); await p.waitForSelector('[data-test=eh-shutdown]', { timeout: 20000 }); await sleep(800); await dd(p);
  await p.screenshot({ path: SHOTS + '5-shut-schedule-row.png' });
  await p.click('[data-test=eh-sched-open]'); await p.fill('[data-test=eh-sched-time]', '21:00'); await p.selectOption('[data-test=eh-sched-hours]', '1');
  await sleep(300); await p.screenshot({ path: SHOTS + '6-shut-schedule-form.png' });
  // anti-cheat: a block after the next wake can't be used to escape the shut-down
  // tomorrow 06:00 is past the next wake (00:00)
  const late = await api(uid, { action: 'schedule', blocks: [{ time: '06:00', hours: 1 }] }); ok(late.code >= 400, 'block past the next wake refused');
  await p.click('[data-test=eh-sched-go]');
  ok(await waitFor(async () => ((await ehDoc(uid)).lock?.pending || []).some((b) => b.startMs === atNY(21))), 'scheduled 21:00 block stored');
  ok(await waitFor(async () => !(await p.locator('[data-test=eh-shutdown]').count())), 'app opens until the block starts');
  await sleep(800); await dd(p); await p.screenshot({ path: SHOTS + '7-scheduled-gap.png' });
  clock = atNY(21, 0) + 20000; await p.reload({ waitUntil: 'load' });
  ok(await waitFor(async () => (await ehDoc(uid)).lock?.index === 2), 'scheduled block auto-starts at 21:00');

  await br.close(); const f = H.results.filter((r) => !r.pass); console.log(`evening-mode e2e: ${H.results.length - f.length}/${H.results.length} passed`); process.exit(f.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
