// QA smoke (local emulators only, fresh zztest-qa-<ts> account): robot morning report closes on a tap outside the card;
// with a saved 8-hour plan (real eight-hour-day fn in-process), the count card shows planned vs list, + is enabled above 5,
// and the "Starts" pill does not overlap task names. Screenshots to SHOTS.
process.env.E2E_KEEP_BRIEFING = '1';
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, admin, ok, sleep, seedUser, emailLogin, idTokenFor, B } = H;
const { handler } = require('../../netlify/functions/eight-hour-day');
const SHOTS = process.env.SHOTS || '/workspace/eighthour_shots/'; const TZ = 'America/New_York';
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; const Ts = admin.firestore.Timestamp; const now = () => Date.now();
const fn = (body, headers) => handler({ httpMethod: 'POST', headers, body }, {}, { verify: (t) => admin.auth().verifyIdToken(t), db, now, ts: (ms) => Ts.fromMillis(ms), serverTime: () => Ts.fromMillis(now()), apiKey: undefined });
(async () => {
  const email = `zztest-qa-${Date.now()}@example.com`; const uid = await seedUser(email, 'Quinn ZZTEST');
  await db.doc(`users/${uid}`).set({ lockInEnabled: true }, { merge: true }); // the 8-hour lock-in is opt-in (Profile > Preferences)
  const today = WEEK[(new Date().getDay() + 6) % 7];
  const tasks = Array.from({ length: 7 }, (_, i) => ({ title: `ZZTEST Long task name number ${i + 1} to check overlap`, completed: false, estimateMin: 30 }));
  await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks });
  const wake = new Date(Date.now() + 2 * 3600e3); const wk = `${String(wake.getHours()).padStart(2, '0')}:${String(wake.getMinutes()).padStart(2, '0')}`;
  const r = await fn(JSON.stringify({ action: 'plan', wakeTime: wake.getDate() === new Date().getDate() ? wk : '23:59', taskCount: 6, tz: TZ }), { authorization: 'Bearer ' + await idTokenFor(uid) });
  ok('plan saved (6 tasks)', r.statusCode === 200, r.body.slice(0, 120));
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: TZ });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); });
  await ctx.route('**/.netlify/functions/eight-hour-day**', async (route) => { const q = route.request(); const x = await fn(q.postData(), { authorization: q.headers().authorization }); route.fulfill({ status: x.statusCode, contentType: 'application/json', body: x.body }); });
  await ctx.route('**/.netlify/functions/!(eight-hour-day)**', (q) => q.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  await emailLogin(p, email);
  const bb = p.locator('[data-test=boss-briefing]');
  await bb.waitFor({ timeout: 20000 }).catch(() => {});
  ok('morning report shows', await bb.count() === 1);
  if (await bb.count()) {
    await p.screenshot({ path: SHOTS + 'qa_morning_report.png' });
    const card = await p.locator('[data-test=boss-briefing] > *').first().boundingBox();
    await p.mouse.click(195, Math.max(8, Math.round(card.y / 2))); await sleep(1200);
    ok('morning report closes on a tap outside the card', await bb.count() === 0, JSON.stringify(card));
  }
  for (let i = 0; i < 3; i++) { const b = p.locator('.dsp-skip, .drama button'); if (await b.count()) { await b.first().click({ timeout: 3000 }).catch(() => {}); await sleep(600); } }
  await sleep(2000); await p.screenshot({ path: SHOTS + 'qa_home_plan.png', fullPage: true });
  const pv = p.locator('[data-test=eh-planned-vs-list], [data-test=eh-needs-tasks]');
  ok('count card shows planned vs list', await pv.count() > 0 && /6.*7|7.*6/.test(await pv.first().innerText()), await pv.count() ? await pv.first().innerText() : 'missing');
  const plus = p.locator('[data-test=eight-hour-card] button[aria-label="More tasks"]');
  if (await plus.count()) ok('+ enabled above 5 (max 50)', await plus.first().isEnabled());
  else console.log('note: no editable stepper in this phase (plan already saved)');
  const st = p.locator('[data-test=eh-starts]');
  if (await st.count()) {
    const sb = await st.boundingBox(); let hit = 0;
    for (const t of await p.locator('.task-title').all()) { const b = await t.boundingBox(); if (b && sb && b.x < sb.x + sb.width && sb.x < b.x + b.width && b.y < sb.y + sb.height && sb.y < b.y + b.height) hit++; }
    ok('Starts pill does not cover task names', hit === 0, `overlaps=${hit}`);
  } else console.log('note: no Starts pill rendered', await p.locator('[data-test=eight-hour-card]').count());
  await br.close();
  const failed = H.results.filter((x) => !x.pass); console.log(failed.length ? `qa-smoke: ${failed.length} FAILED` : 'qa-smoke: all passed'); process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
