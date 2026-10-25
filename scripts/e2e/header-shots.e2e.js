// Local only (emulators, ZZTEST): 390x844 screenshots of every titled page + a count of stacked page headers per route.
const H = require('./manager-pal.e2e.js');
const { chromium } = require('playwright-core');
const { sleep, seedUser, newPage, emailLogin } = H;
const B = `http://localhost:${process.env.WEB_PORT || 8099}`;
const OUT = process.env.HDR_OUT || '/tmp/hdr/';
(async () => {
  const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
  await fetch(`http://127.0.0.1:${FP}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AP}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const uid = await seedUser('zztest-hdr@example.com', 'Hana ZZTEST');
  const p = await newPage(br, 'hdr'); await emailLogin(p, 'zztest-hdr@example.com'); await sleep(2500);
  const routes = ['/profile/' + uid, '/rankings', '/community', '/discipline', '/discipline/log', '/gate', '/upcoming', '/addiction', '/about', '/pals', '/manage', '/pickup', '/chat', '/mealPlan', '/support', '/terms', '/privacy-policy', '/sub', '/payment-success', '/no-such-page'];
  let bad = 0;
  for (const r of routes) {
    await p.goto(B + r, { waitUntil: 'load' }); await sleep(2500);
    for (const b of await p.locator('button:has-text("Not now"), button:has-text("Maybe later"), button:has-text("Skip")').all()) await b.click({ timeout: 1000 }).catch(() => {});
    const info = await p.evaluate(() => { const vis = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0; };
      const h1 = [...document.querySelectorAll('h1')].filter(vis).map((e) => e.innerText.trim().replace(/\s+/g, ' '));
      const backs = [...document.querySelectorAll('button, a')].filter(vis).filter((e) => /^‹|^<|^\s*‹/.test(e.innerText.trim()) || /back|close/i.test(e.getAttribute('aria-label') || '')).length;
      return { h1, backs, firstCardTop: Math.round(document.querySelector('.pf-card, main section, .card')?.getBoundingClientRect().top || -1) }; });
    const dup = info.h1.length > 1; if (dup) bad++;
    console.log(dup ? 'DUP ' : 'ok  ', r.replace(uid, ':uid'), JSON.stringify(info));
    await p.screenshot({ path: OUT + (r === '/profile/' + uid ? 'profile' : r.replace(/\//g, '_')) + '.png' });
  }
  console.log('stacked headers:', bad); await br.close(); process.exit(process.env.HDR_EXPECT_ZERO && bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
