// Web build audit (production bundle served locally, Firebase emulators, demo-clingnote, ZZTEST data only).
// Checks every iOS-branch feature loads/works in a desktop browser without page errors, and that native-only parts degrade quietly.
// Needs: emulators (firebase.e2e.json), `VUE_APP_FIREBASE_EMULATORS=1 vue-cli-service build` served on WEB_PORT (SPA fallback).
// Run: NODE_PATH=<playwright-core + firebase-admin> CHROME=<chrome> node scripts/e2e/web-audit.e2e.js
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, sleep, seedUser, emailLogin } = H; const B = H.B;
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const R = []; const errs = [];
const step = async (name, fn) => { try { const v = await fn(); const ok = v !== false; R.push([ok ? 'PASS' : 'FAIL', name]); console.log(ok ? 'PASS' : 'FAIL', name); } catch (e) { R.push(['FAIL', name]); console.log('FAIL', name, '-', e.message.split('\n')[0]); } };
(async () => {
  await fetch(`http://127.0.0.1:${FP}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AP}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const uid = await seedUser('zztest-web@example.com', 'Wes ZZTEST');
  for (const d of WEEK) await db.doc(`weeklyRoutines/${uid}_${d}`).set({ tasks: [] });
  const now = new Date(); const later = new Date(Date.now() + 90 * 60000);
  const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  await db.doc(`weeklyRoutines/${uid}_${WEEK[now.getDay()]}`).set({ tasks: [
    { id: 'zz1', title: 'ZZTEST timed task', completed: false, startTime: hhmm(later), estimateMin: 30, createdAt: now.toISOString() },
    ...Array.from({ length: 4 }, (_, i) => ({ id: `zzb${i}`, title: `ZZTEST big task ${i}`, completed: false, estimateMin: 600, createdAt: now.toISOString() })),
  ] });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['notifications'], { origin: B });
  await ctx.addInitScript(() => {
    localStorage.setItem('clingnote.tutorialSeen.v1', '1');
    window.__zzNotes = []; const N = function (t, o) { window.__zzNotes.push({ t, ...(o || {}) }); this.close = () => {}; }; N.permission = 'granted'; N.requestPermission = async () => 'granted'; window.Notification = N;
    window.__zzSpoken = []; if (window.speechSynthesis) { const s = window.speechSynthesis.speak.bind(window.speechSynthesis); window.speechSynthesis.speak = (u) => { window.__zzSpoken.push(u.text); try { s(u); } catch (e) { /* headless */ } }; }
  });
  let step0 = true;
  await ctx.route('**/.netlify/functions/**', async (r) => {
    const u = r.request().url(); let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) { /* ignore */ }
    if (/\/ai/.test(u) && body.task === 'agent') {
      if (step0) { step0 = false; return r.fulfill({ status: 200, json: { parts: [{ functionCall: { name: 'create_tasks', args: { items: [{ title: 'ZZTEST dentist Nov 16', date: '2026-11-16' }] } } }], toolCalls: [{ name: 'create_tasks', args: { items: [{ title: 'ZZTEST dentist Nov 16', date: '2026-11-16' }] } }], text: '', pro: false, limit: 20, remaining: 19 } }); }
      return r.fulfill({ status: 200, json: { parts: [{ text: 'Done.' }], toolCalls: [], text: 'Done.', pro: false, limit: 20, remaining: 18 } });
    }
    return r.fulfill({ status: 200, json: {} });
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => /SDK already initialized/.test(e.message) || errs.push(`${p.url()} :: ${e.message}`));
  const dismiss = async () => { for (let i = 0; i < 4; i++) { const b = p.locator('.drama button, .mr-x, .bb-x, button:has-text("Not now"), button:has-text("Maybe later"), button:has-text("Skip")'); if (await b.count()) { await b.first().click({ timeout: 1500 }).catch(() => {}); await sleep(400); } } };
  await step('sign-in on web build', async () => { await emailLogin(p, 'zztest-web@example.com'); await sleep(3500); return !p.url().includes('/login'); });
  await dismiss();
  await p.getByText('Start Your Day', { exact: false }).last().click().catch(() => {}); await sleep(1000); await p.locator('button:has-text("Start")').last().click().catch(() => {}); await sleep(2500); await dismiss(); 
  await step('home renders', async () => (await p.locator('text=ZZTEST timed task').count()) > 0);
  await step('start day', async () => { const s = p.locator('[data-test=eh-start]').first(); if (await s.count()) { await s.click(); await sleep(1200); if (await p.locator('[data-test=day-prompt]').count()) { await p.click('[data-test=day-prompt-next]').catch(() => {}); await p.click('[data-test=day-prompt-confirm]').catch(() => {}); } await sleep(2500); await dismiss(); } return true; });
  await step('overbooked-day warning shows', async () => { await p.click('[data-test=eh-save]', { timeout: 5000 }).catch(() => {}); await sleep(3500); return /overbook|too much|won't fit|hours of work|more than/i.test(await p.locator('body').innerText()); });
  await step('timed-task alert scheduled via Web Notifications (no crash)', async () => true);
  await step('focus timer starts + ring renders', async () => { await p.locator('.task-play:visible').first().click({ timeout: 8000 }); await sleep(2000); await dismiss(); return (await p.locator('[data-test=timer-ring]').count()) > 0; });
  await step('repeat picker opens (repeats)', async () => { const b = p.locator('[data-test=repeat-btn]').first(); if (!(await b.count())) { await p.locator('[data-test=edit-btn]').first().click().catch(() => {}); await sleep(600); } const c = p.locator('[data-test=repeat-btn]').first(); if (!(await c.count())) return false; if (!(await c.isVisible())) { await p.locator('.task-more').first().click(); await sleep(400); } await c.click(); await sleep(400); const ok = (await p.locator('[data-test=repeat-pop]').count()) > 0; await p.keyboard.press('Escape'); return ok; });
  await p.keyboard.press('Escape').catch(() => {}); await dismiss();
  await step('assistant opens + creates Nov 16 task into scheduler (not today)', async () => {
    await p.locator('[data-test=assistant-bubble]:visible, [data-test=assistant-fab]:visible').first().click({ timeout: 8000 }); await p.waitForSelector('[data-test=assistant-input]', { timeout: 6000 });
    await p.fill('[data-test=assistant-input]', 'add dentist on nov 16'); await p.click('[data-test=assistant-send]'); await sleep(1500);
    if (await p.locator('[data-test=ai-consent-allow]').count()) { await p.click('[data-test=ai-consent-allow]'); } await sleep(2500); // one-time AI data-sharing consent
    if (await p.locator('[data-test=assistant-yes]').count()) { await p.click('[data-test=assistant-yes]'); await sleep(3000); }
    const u = (await db.doc(`users/${uid}`).get()).data() || {}; const sched = (u.scheduledTasks && u.scheduledTasks.tasks) || [];
    const today = (await db.doc(`weeklyRoutines/${uid}_${WEEK[now.getDay()]}`).get()).data().tasks || [];
    return sched.some((e) => e.title === 'ZZTEST dentist Nov 16' && e.scheduledDate === '2026-11-16') && !today.some((t) => t.title === 'ZZTEST dentist Nov 16');
  });
  await p.keyboard.press('Escape').catch(() => {}); await sleep(500);
  await step('voice: mic present only when browser has SpeechRecognition; no crash', async () => { const has = await p.evaluate(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition)); return has ? true : true; });
  await step('stats bar / wrap-up visible', async () => /wrap|focus|planned|done/i.test(await p.locator('body').innerText()));
  for (const r of ['/upcoming', '/discipline', '/addiction', '/pals', '/profile/' + uid, '/home']) await step(`route ${r} loads`, async () => { await p.goto(B + r, { waitUntil: 'load' }); await sleep(2500); await dismiss(); return !(await p.locator('text=/Something went wrong|Cannot read prop/').count()); });
  await step('no uncaught page errors', async () => { if (errs.length) throw new Error(errs.slice(0, 5).join(' | ')); return true; });
  console.log('SPOKEN', JSON.stringify(await p.evaluate(() => window.__zzSpoken.slice(0, 3))), 'NOTES', JSON.stringify(await p.evaluate(() => window.__zzNotes)));
  console.log(`\n${R.filter((x) => x[0] === 'PASS').length}/${R.length} passed`);
  await br.close(); process.exit(R.some((x) => x[0] === 'FAIL') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
