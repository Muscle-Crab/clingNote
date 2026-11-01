// Avatar paint timing (local emulators, ZZTEST). Measures ms from navigation start until the side-nav avatar photo has loaded, on a warm reload.
const H = require('./manager-pal.e2e.js'); const { chromium } = require('playwright-core');
const { db, sleep, seedUser, emailLogin } = H; const B = H.B;
(async () => {
  const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
  await fetch(`http://127.0.0.1:${FP}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AP}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const uid = await seedUser('zztest-avatar@example.com', 'Avi ZZTEST');
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); });
  await ctx.route('**/.netlify/functions/**', (r) => r.fulfill({ status: 200, json: {} }));
  if (process.env.LAT) await ctx.route(/:(8087|9097)\//, async (r) => { await new Promise((s) => setTimeout(s, +process.env.LAT)); r.continue(); }); // simulated mobile RTT
  const p = await ctx.newPage();
  // 256px JPEG data URL avatar like the Profile uploader produces
  const dataUrl = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${i * 37 % 360},70%,50%)`; x.fillRect(Math.random() * 256, Math.random() * 256, 30, 30); } return c.toDataURL('image/jpeg', 0.85); });
  await db.doc(`users/${uid}`).set({ avatarURL: dataUrl }, { merge: true });
  await emailLogin(p, 'zztest-avatar@example.com'); await sleep(4000);
  const runs = [];
  for (let i = 0; i < 3; i++) {
    await p.goto(B + '/profile/' + uid, { waitUntil: 'commit' }); const t0 = Date.now();
    await p.waitForFunction(() => { const i = document.querySelector('[data-test=nav-avatar] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000, polling: 20 });
    runs.push(Date.now() - t0); await sleep(1500);
  }
  const kb = Math.round(dataUrl.length * 0.75 / 1024);
  console.log('AVATAR bytes~' + kb + 'KB runs(ms)=' + runs.join(',') + ' median=' + runs.sort((a, b) => a - b)[1]);
  await br.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
