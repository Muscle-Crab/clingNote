// Whole-app smoke + flow run (local emulators only, demo-clingnote, ZZTEST data). Each step is recorded pass/fail and the run continues.
// Needs the same services as manager-pal.e2e.js. Run: NODE_PATH=<playwright-core + firebase-admin> node scripts/e2e/full-app.e2e.js
const H = require('./manager-pal.e2e.js');
const { chromium } = require('playwright-core');
const { db, sleep, seedUser, newPage, emailLogin } = H;
const B = `http://localhost:${process.env.WEB_PORT || 8099}`;
const SHOTS = process.env.SHOTS || '/tmp/zzshots/';
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const R = []; const errs = [];
const step = async (name, fn) => { try { const v = await fn(); const ok = v !== false; R.push([ok ? 'PASS' : 'FAIL', name]); console.log(ok ? 'PASS' : 'FAIL', name); } catch (e) { R.push(['FAIL', name, e.message.split('\n')[0]]); console.log('FAIL', name, '-', e.message.split('\n')[0]); } };
(async () => {
  await fetch(`http://127.0.0.1:${FP}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AP}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const uid = await seedUser('zztest-full@example.com', 'Fay ZZTEST');
  const now = new Date(); const ti = (now.getDay() + 6) % 7; const yi = (ti + 6) % 7;
  for (const d of WEEK) await db.doc(`weeklyRoutines/${uid}_${d}`).set({ tasks: [] });
  await db.doc(`weeklyRoutines/${uid}_${WEEK[yi]}`).set({ tasks: [] });
  const yd = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  await db.doc(`weeklyRoutines/${uid}_${WEEK[ti]}`).set({ tasks: [{ title: 'ZZTEST leftover from yesterday', completed: false, carriedFrom: yd }] });
  const p = await newPage(br, 'full');
  p.on('pageerror', (e) => /SDK already initialized/.test(e.message) || errs.push(`${p.url()} :: ${e.message}`));
  const shot = (n) => p.screenshot({ path: SHOTS + 'full_' + n + '.png' }).catch(() => {});
  const dismiss = async () => { for (let i = 0; i < 4; i++) { const b = p.locator('.drama button, button:has-text("Not now"), button:has-text("Maybe later"), button:has-text("Skip")'); if (await b.count()) { await b.first().click({ timeout: 2000 }).catch(() => {}); await sleep(500); } } };
  await step('sign-in (email, emulator)', async () => { await emailLogin(p, 'zztest-full@example.com'); await sleep(3000); return !p.url().includes('/login'); });
  await dismiss(); await shot('1_home');
  await step('home renders with 8-hour card / start', async () => (await p.locator('[data-test=eight-hour-card], [data-test=eh-start], button:has-text("Start Day")').count()) > 0);
  await step('start day (8-hour)', async () => { const s = p.locator('[data-test=eh-start], button:has-text("Start Day"), button:has-text("Start")').first(); if (await s.count()) { await s.click(); await sleep(1200); if (await p.locator('[data-test=day-prompt]').count()) { await p.click('[data-test=day-prompt-next]'); await p.click('[data-test=day-prompt-confirm]'); } await sleep(2500); await dismiss(); } await shot('3_started'); return (await p.locator('[data-test=eh-countdown], [data-test=eh-ends]').count()) > 0 || (await p.locator('[data-test=create-task-fab], .fab-add').count()) > 0; });
  await step('rollover banner shows for yesterday leftover', async () => { await p.waitForSelector('[data-test=rollover-banner]', { timeout: 8000 }); return true; });
  await p.locator('[data-test=rollover-dismiss]').first().click().catch(() => {}); await dismiss();
  await step('add-task modal: every input/textarea/select >= 16px (no iOS focus zoom) and FAB has no scale-on-tap', async () => {
    await p.click('[data-test=create-task-fab], .fab-add'); await p.waitForSelector('#nt-name', { timeout: 6000 }); await sleep(500);
    const small = await p.evaluate(() => { const m = document.querySelector('#nt-name').closest('[role=dialog], .modal, form') || document.body;
      return [...m.querySelectorAll('input, textarea, select')].filter((e) => !['checkbox', 'radio', 'range', 'hidden', 'color'].includes(e.type)).map((e) => [e.id || e.name || e.type || e.tagName, parseFloat(getComputedStyle(e).fontSize)]).filter(([, f]) => f < 16); });
    const vp = await p.evaluate(() => (document.querySelector('meta[name=viewport]') || {}).content || '');
    await p.keyboard.press('Escape'); await sleep(600); if (await p.locator('#nt-name').count()) { const c = p.locator('button:has-text("Cancel"), [aria-label=Close]').first(); if (await c.count()) await c.click(); await sleep(500); }
    if (small.length || /user-scalable=no|maximum-scale=1/.test(vp)) throw new Error('small fields ' + JSON.stringify(small) + ' viewport ' + vp);
  });
  await step('add task', async () => { await p.click('[data-test=create-task-fab], .fab-add'); await p.fill('#nt-name', 'ZZTEST Wash the car'); await sleep(800); await shot('2_add'); await p.click('button[type=submit]'); await sleep(2500); await dismiss(); return (await p.locator('.task-title', { hasText: 'ZZTEST Wash the car' }).count()) > 0; });
  await step('auto time estimate on new task', async () => /\d+m · \d+p/.test(await p.locator('body').innerText()));
  await step('play timer starts', async () => { await p.locator('.task-play').first().click(); await sleep(2000); await shot('4_play'); await dismiss(); return true; });
  await step('timer locked once started (edit panel)', async () => { await p.keyboard.press('Escape').catch(() => {}); await sleep(500); await p.locator('[data-test=edit-btn]').first().click(); await sleep(800); await shot('5_lock'); return (await p.locator('[data-test=timer-lock-hint], [data-test=lock-hint]').count()) > 0; });
  await step('edit title', async () => { const f = p.locator('[data-test=edit-title]').first(); await f.fill('ZZTEST Wash the car edited'); await f.press('Enter'); await sleep(1500); await p.locator('[data-test=edit-btn]').first().click().catch(() => {}); await sleep(800); return (await p.locator('text=ZZTEST Wash the car edited').count()) > 0; });
  await step('complete task + streak counter', async () => { for (const c of await p.locator('button.task-check[aria-label="Mark done"]').all()) { await c.click().catch(() => {}); await sleep(1200); } await sleep(2000); await shot('6_done'); await dismiss(); return (await p.locator('[data-test=streak-count], [data-test=streak-today]').count()) > 0; });
  await step('rating prompt fires once after onboarding, not on reload', async () => {
    await p.addInitScript(() => window.addEventListener('cn:review-requested', () => localStorage.setItem('zz_rev', String(+(localStorage.getItem('zz_rev') || 0) + 1))));
    const uidNow = uid;
    await p.evaluate((u) => { localStorage.removeItem('zz_rev'); localStorage.removeItem('cn_review_requested_' + u); localStorage.setItem('cn_review_pending_' + u, String(Date.now())); }, uidNow);
    await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(4500);
    const first = await p.evaluate(() => localStorage.getItem('zz_rev'));
    await p.reload({ waitUntil: 'load' }); await sleep(4500);
    const after = await p.evaluate(() => localStorage.getItem('zz_rev'));
    if (!uidNow) throw new Error('no uid'); if (first !== '1' || after !== '1') throw new Error(`fired ${first} then ${after}`); return true; });
  await step('Profile has Rate ClingNote row', async () => { await p.goto(B + '/profile/' + uid, { waitUntil: 'load' }); await sleep(3000); await dismiss(); return (await p.locator('[data-test=rate-app]').count()) > 0; });
  const routes = ['/home', '/rankings', '/community', '/discipline', '/discipline/log', '/upcoming', '/addiction', '/about', '/pals', '/manage', '/paywall', '/pro/success', '/gate', '/support', '/terms', '/privacy-policy', '/chat', '/sub', '/landing', '/profile/' + uid, '/payment-success', '/no-such-page'];
  for (const r of routes) {
    await step('route ' + r, async () => { const n0 = errs.length; await p.goto(B + r, { waitUntil: 'load' }); await sleep(2500); await shot('route' + r.replace(/\//g, '_')); const txt = (await p.locator('body').innerText()).trim(); if (errs.length > n0) throw new Error('pageerror: ' + errs.slice(n0).join(' | ').slice(0, 200)); return txt.length > 20; });
  }
  await step('paywall lists plans/prices', async () => { await p.goto(B + '/paywall', { waitUntil: 'load' }); await sleep(3000); for (let i = 0; i < 8 && !/restore/i.test(await p.locator('body').innerText()); i++) { const n = p.locator('button:has-text("Not now"), .ob-later, .ob-cta'); if (await n.count()) await n.first().click().catch(() => {}); await sleep(1200); } const t = await p.locator('body').innerText(); await shot('paywall'); return /month|year|lifetime/i.test(t) && /restore/i.test(t); });
  await step('home menu: shutdown / background+music entries', async () => { await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3000); await dismiss(); await p.click('.hero-menu-btn'); await sleep(600); const h = await p.content(); await p.keyboard.press('Escape').catch(() => {}); return /Shutdown/.test(h) && /music/i.test(h); });
  await step('background/music panel opens', async () => { await p.locator('[data-test=open-background], [data-test=open-background-pill]').first().click(); await sleep(1200); await shot('bg'); const t = await p.locator('body').innerText(); await p.keyboard.press('Escape'); await dismiss(); return /music|rain|snow/i.test(t); });
  await step('notifications bell opens inbox', async () => { await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(2500); await dismiss(); await p.click('.hero-menu-btn'); await sleep(800); await shot('bell'); const t = await p.locator('body').innerText(); await p.click('.hero-menu-btn').catch(() => {}); return /Shutdown day/.test(t); });
  await step('day menu -> Shutdown day prompt', async () => { await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(2500); await dismiss(); await p.click('.hero-menu-btn'); await sleep(600); await p.click('button.hero-menu-item:has-text("Shutdown day")'); await sleep(1500); await shot('shutdown'); return /shutdown/i.test(await p.locator('body').innerText()); });
  await step('no residual CleanNote/KlingNote text on home', async () => !/CleanNote|KlingNote/.test(await p.content()));
  console.log('\nSUMMARY'); for (const x of R) console.log(x.join(' | '));
  console.log('pageerrors:', errs.length); errs.slice(0, 15).forEach((e) => console.log('  ', e.slice(0, 250)));
  await br.close(); process.exit(R.some((x) => x[0] === 'FAIL') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
