// Wake-up alarm Home row, web render check: fakes the iOS platform name (no native plugins -> every native call is a safe no-op)
// so the daily question renders; screenshot + one-row check. Local emulators only, fresh zztest-wake-<ts> account.
// TAG=before|after names the screenshot.
const H = require('./manager-pal.e2e.js');
const { chromium } = require('playwright-core');
const { db, ok, sleep, seedUser, newPage, emailLogin } = H;
const SHOTS = process.env.SHOTS || '/workspace/eighthour_shots/';
const TAG = process.env.TAG || 'after';
(async () => {
  const email = `zztest-wake-${Date.now()}@example.com`;
  const uid = await seedUser(email, 'Walt ZZTEST');
  // prompt time = a minute ago, alarm 2h before now -> the open question is about tomorrow morning
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const alarm = hm(new Date(Date.now() - 2 * 3600e3)); const prompt = hm(new Date(Date.now() - 60e3));
  await db.doc(`users/${uid}`).set({ wakeAlarmEnabled: true, wakeAlarmTime: alarm, wakeAlarmPromptTime: prompt, wakeAlarmDays: [0, 1, 2, 3, 4, 5, 6] }, { merge: true });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await newPage(br, 'wake');
  await p.context().addInitScript(() => { window.CapacitorCustomPlatform = { name: 'ios', plugins: {} }; });
  await emailLogin(p, email); await sleep(4000);
  for (let i = 0; i < 4; i++) { const b = p.locator('.bb-x, .dsp-skip, .drama button'); if (await b.count()) { await b.first().click({ timeout: 3000 }).catch(() => {}); await sleep(700); } }
  await p.goto(`http://localhost:${process.env.WEB_PORT || 8080}/home`); await sleep(4000);
  const w = p.locator('[data-test=wake-alarm-prompt]');
  ok('wake question renders on Home', await w.count() === 1);
  if (await w.count()) { await w.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollTo(0, 0)); }
  await p.screenshot({ path: SHOTS + `design_${TAG}_wake_row.png` });
  if (TAG === 'after' && await w.count()) {
    const hgt = (await w.boundingBox()).height;
    ok('wake question is one compact row', hgt <= 48, Math.round(hgt));
    const bg = await w.evaluate((el) => getComputedStyle(el).backgroundColor + '|' + getComputedStyle(el).borderTopWidth);
    ok('no card background/border', /rgba\(0, 0, 0, 0\)\|0px/.test(bg), bg);
    ok('prefilled time', await p.inputValue('[data-test=wake-prompt-time-input]') === alarm);
    await p.click('[data-test=wake-prompt-skip]'); await sleep(1500);
    ok('Not today hides it', await w.count() === 0);
    const u = (await db.doc(`users/${uid}`).get()).data();
    ok('Not today saved as choice no', u.wakeAlarmChoice && u.wakeAlarmChoice.choice === 'no');
  }
  await br.close();
  const failed = H.results.filter((r) => !r.pass);
  console.log(failed.length ? `wake-row e2e: ${failed.length} FAILED` : 'wake-row e2e: all passed');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E Error', e); process.exit(1); });
