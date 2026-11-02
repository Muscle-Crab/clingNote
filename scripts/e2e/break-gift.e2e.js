// Break gift walk (local emulators only, ZZTEST Pro user): Home game-plan line with the 🎁 when break 1 is unlocked, and the
// "N tasks to 15m break" text when it is not. Screens: SHOTS + TAG ('before'|'after'); checks run only for TAG=after.
// Run: EMU_AUTH_PORT=9399 EMU_FS_PORT=8385 WEB_PORT=8399 CHROME=... SHOTS=/workspace/break-gift-screens/ TAG=after node scripts/e2e/break-gift.e2e.js
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, sleep, seedUser, emailLogin, B } = H;
const SHOTS = process.env.SHOTS || '/tmp/bg/'; const TAG = process.env.TAG || 'after'; const CHECK = TAG === 'after';
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const res = []; const step = (n, c, x = '') => { res.push([n, !!c]); console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${c ? '' : x}`); };
const shot = (p, name, sel) => (sel ? p.locator(sel).first().screenshot({ path: `${SHOTS}${TAG}-${name}.png` }) : p.screenshot({ path: `${SHOTS}${TAG}-${name}.png` })).catch((e) => console.log('shot failed', name, String(e).slice(0, 100)));
const dd = async (p) => { for (let i = 0; i < 3; i++) { const b = p.locator('[data-test=boss-briefing] .bb-x, .drama-btn, button:has-text("Not now"), button:has-text("Maybe later")'); if (await b.count()) { await b.first().click({ timeout: 1500 }).catch(() => {}); await sleep(400); } } };
(async () => {
  const FS = process.env.EMU_FS_PORT, AU = process.env.EMU_AUTH_PORT;
  await fetch(`http://127.0.0.1:${FS}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AU}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const today = WEEK[new Date().getDay()]; const now = Date.now();
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const run = async (label, email, done) => {
    const uid = await seedUser(email, 'Break ZZTEST'); if (uid === 'dsDDbr945rawMAUKKpIAJcnPYrX2') throw new Error('refusing to touch a real account');
    const dayStart = `${String(Math.max(0, new Date().getHours() - 3)).padStart(2, '0')}:00`;
    await db.doc(`users/${uid}`).set({ onboardingComplete: true, paywallSeenAt: new Date(), isPro: true, plan: 'pro_yearly', proExpiresAt: new Date(now + 30 * 864e5), lockInEnabled: true, bossMode: 'strict',
      gamePlan: { dayStart, closeHours: 8, sessions: 2, breakEvery: 50, minGoal: 50 } }, { merge: true });
    await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks: Array.from({ length: 20 }, (_, i) => ({ title: `ZZTEST task ${i + 1}`, size: 'm', createdAt: `zz-bg-${i}`,
      completed: i < done, ...(i < done ? { completedAt: now - (done - i) * 60000, completedFor: new Date().toISOString().slice(0, 10) } : {}) })) });
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
    await ctx.addInitScript((u) => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem(`cn.coach.${u}`, JSON.stringify({ done: [], off: true })); }, uid);
    await ctx.route('**/.netlify/functions/**', (r) => r.fulfill({ status: 200, json: {} }));
    const p = await ctx.newPage(); p.setDefaultTimeout(8000); p.on('dialog', (d) => d.accept());
    await emailLogin(p, email); await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3500); await dd(p);
    await p.locator('button:has-text("Start Day")').first().click({ timeout: 3000 }).catch(() => {}); await sleep(1500); await dd(p);
    const row = p.locator('[data-test=gp-row]'); await row.scrollIntoViewIfNeeded().catch(() => {}); await sleep(400);
    await shot(p, `${label}-home`); await shot(p, `${label}-line`, '[data-test=gp-row]');
    const text = (await row.innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log(label, 'line:', text);
    return { p, ctx, text, uid };
  };
  // 7 of 20 done (140 pts): break 1 unlocked (needs 7 tasks + 50 pts)
  const a = await run('ready', 'zztest-bg-ready@example.com', 7);
  if (CHECK) {
    step('ready: gift shows', await a.p.locator('[data-test=gp-gift]').count() === 1);
    step('ready: line says 15m break', /15m/.test(a.text), a.text);
    await a.p.locator('[data-test=gp-gift]').click({ timeout: 8000 }).catch(() => {}); await sleep(1500);
    const g = (await db.doc(`users/${a.uid}`).get()).data().gpBreak || {};
    step('tap gift starts a 15m break', g.endMs - g.startMs === 15 * 60000, JSON.stringify(g)); await shot(a.p, 'ready-after-tap', '[data-test=gp-row]');
  }
  await a.ctx.close();
  // 4 of 20 done (80 pts): 3 tasks to the 15m break, no gift
  const b = await run('short', 'zztest-bg-short@example.com', 4);
  if (CHECK) { step('short: no gift', await b.p.locator('[data-test=gp-gift]').count() === 0); step('short: "3 tasks to 15m break"', /3 tasks to 15m break/.test(b.text), b.text); }
  await b.ctx.close(); await br.close();
  if (CHECK) console.log(`\nbreak gift walk: ${res.filter((r) => r[1]).length}/${res.length} pass`);
  process.exit(CHECK && res.some((r) => !r[1]) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
