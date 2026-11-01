// Card density screenshots at the iPhone 6.9" viewport (440x956 @3x). ZZTEST data on local emulators only.
// Usage: node scripts/e2e/cards-shot.e2e.js <label>   -> /workspace/card-preview/<label>-home.png, <label>-community.png, prints card heights
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, sleep, seedUser, emailLogin } = H; const B = H.B;
const OUT = process.env.CARD_OUT || '/workspace/card-preview/'; const label = process.argv[2] || 'now';
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
(async () => {
  const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
  await fetch(`http://127.0.0.1:${FP}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AP}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const uid = await seedUser('zztest-cards@example.com', 'Cara ZZTEST');
  const today = WEEK[(new Date().getDay() + 6) % 7]; const yd = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks: [
    { title: 'ZZTEST Write the quarterly report draft', completed: false, estimateMin: 45, important: true, notes: 'Pull numbers from the finance sheet first, then outline', labels: ['work'] },
    { title: 'ZZTEST Gym', completed: false, estimateMin: 60, repeatDays: WEEK.map((d) => d), anonymous: true },
    { title: 'ZZTEST Call the dentist', completed: false, estimateMin: 10, carriedFrom: yd, reminder: { date: new Date().toISOString().slice(0, 10), time: '15:30' } },
    { title: 'ZZTEST Read 20 pages', completed: true, estimateMin: 30, visibility: 'private' },
  ] });
  await db.doc(`communityPosts/zzc1`).set({ uid, name: 'Cara ZZTEST', avatar: '', title: 'Day 5 streak', text: 'Morning routine done before 8. Small wins stack up!', images: [], stats: { tasksDone: 6, points: 220, streak: 5, milestone: 'On fire', icon: '🔥' }, likeCount: 3, commentCount: 1, createdAt: new Date() });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const ctx = await br.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn_community_eula_v1', '1'); });
  await ctx.route('**/.netlify/functions/**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  const dismiss = async () => { for (let i = 0; i < 4; i++) { const b = p.locator('.drama button, button:has-text("Not now"), button:has-text("Maybe later"), button:has-text("Skip")'); if (await b.count()) { await b.first().click({ timeout: 2000 }).catch(() => {}); await sleep(400); } } };
  await emailLogin(p, 'zztest-cards@example.com'); await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3500); await dismiss();
  { const sd = p.getByRole('button', { name: /Start Day/ }); if (await sd.count()) { await sd.first().click(); await sleep(1500); } } const cards = p.locator('.task-card'); await p.evaluate(() => { const c = document.querySelector('.task-card'); window.scrollBy(0, c.getBoundingClientRect().top - 90); }); await sleep(600);
  const hs = []; for (const c of await cards.all()) hs.push(Math.round((await c.boundingBox()).height));
  const tgt = await p.evaluate(() => [...document.querySelectorAll('.task-card button')].filter((b) => b.offsetParent && !b.closest('.task-actions,.repeat-pop,.task-expand')).map((b) => { const r = b.getBoundingClientRect(); const pe = getComputedStyle(b, '::before'); const ex = pe.content !== 'none' && pe.position === 'absolute' && b.classList.contains('importance-btn') ? Math.max(0, -parseFloat(pe.top)) * 2 : 0; const ew = ex ? Math.max(0, -parseFloat(pe.left)) * 2 : 0; return Math.min(r.width + ew, r.height + ex); }).map((v, i, a) => v)); const small = await p.evaluate(() => [...document.querySelectorAll('.task-card button')].filter((b) => b.offsetParent && !b.closest('.task-actions,.repeat-pop,.task-expand')).map((b) => b.className + ':' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height))); console.error('BTN', small.join(' '));
  await p.screenshot({ path: `${OUT}${label}-home.png` });
  { const ob = p.locator('button:has-text("Open sidebar")').first(); await ob.click().catch(() => {}); await sleep(800);
    await p.screenshot({ path: `${OUT}${label}-nav.png`, clip: { x: 0, y: 0, width: 300, height: 180 } });
    const nl = await p.evaluate(() => { const i = document.querySelector('.app-sidebar img'); return i ? { src: i.currentSrc.split('/').pop(), w: i.width, h: i.height, radius: getComputedStyle(i).borderRadius } : null; }); console.log('NAV', JSON.stringify(nl)); }
  await p.goto(B + '/community', { waitUntil: 'load' }); await sleep(3000);
  const eula = p.locator('[data-test=cm-eula-check]'); if (await eula.count()) { await eula.click(); await p.click('[data-test=cm-eula-accept]'); await sleep(1500); }
  const post = p.locator('[data-test=cm-post]').first(); const ph = (await post.count()) ? Math.round((await post.boundingBox()).height) : 0;
  await p.screenshot({ path: `${OUT}${label}-community.png` });
  console.log(JSON.stringify({ label, taskCardHeights: hs, minTapTarget: Math.min(...tgt), communityPostHeight: ph }));
  await br.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
