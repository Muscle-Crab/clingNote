// Local-only design audit (emulators, ZZTEST). Full-page 390x844 shots + automated layout checks per state. Writes /tmp/audit/*.png + report.json
const H = require('./manager-pal.e2e.js');
const { chromium } = require('playwright-core');
const { db, sleep, seedUser, seedTasks, newPage, emailLogin } = H;
const B = `http://localhost:${process.env.WEB_PORT || 8099}`; const OUT = process.env.AUDIT_OUT || '/tmp/audit/';
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
const report = [];
const CHECK = () => {
  const vw = innerWidth, vh = innerHeight, out = {};
  const vis = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && r.width > 1 && r.height > 1; };
  const lbl = (e) => (e.innerText || e.getAttribute('aria-label') || e.getAttribute('alt') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const de = document.documentElement; out.hOverflow = de.scrollWidth > de.clientWidth + 1 ? de.scrollWidth - de.clientWidth : 0;
  out.wideEls = [...document.querySelectorAll('body *')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.right > vw + 2 && getComputedStyle(e).position !== 'fixed' && !e.closest('[class*=scroll],[class*=carousel],[style*=overflow]') && !['HTML','BODY'].includes(e.tagName); }).filter((e) => { let a = e.parentElement; while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return false; a = a.parentElement; } return true; }).slice(0, 5).map(lbl);
  const taps = [...document.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]), select')].filter(vis);
  out.smallTaps = [...new Set(taps.filter((e) => { const r = e.getBoundingClientRect(); return (r.width < 44 || r.height < 44) && !(e.tagName === 'A' && getComputedStyle(e).display === 'inline'); }).map((e) => { const r = e.getBoundingClientRect(); return `${lbl(e)}(${Math.round(r.width)}x${Math.round(r.height)})`; }))].slice(0, 12);
  // leaf text / controls overlap
  const leaves = [...document.querySelectorAll('button, a, h1, h2, h3, p, label, small, strong, b, span, input, li')].filter(vis).filter((e) => (e.innerText || '').trim() || e.tagName === 'INPUT' || e.tagName === 'BUTTON').filter((e) => ![...e.children].some((c) => vis(c) && (c.innerText || '').trim()));
  const ov = [];
  const fixedAnc = (e) => { while (e && e !== document.body) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e; e = e.parentElement; } return null; };
  for (let i = 0; i < leaves.length && ov.length < 8; i++) for (let j = i + 1; j < leaves.length && ov.length < 8; j++) {
    const a = leaves[i], b = leaves[j]; if (a.contains(b) || b.contains(a)) continue; if (fixedAnc(a) !== fixedAnc(b)) continue;
    const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
    const w = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left), h = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
    if (w > 4 && h > 4 && w * h > 0.25 * Math.min(r1.width * r1.height, r2.width * r2.height)) ov.push(`"${lbl(a)}" x "${lbl(b)}"`);
  }
  out.overlaps = ov;
  out.clipped = [...new Set([...document.querySelectorAll('body *')].filter(vis).filter((e) => { const s = getComputedStyle(e); if (!(e.innerText || '').trim() || e.children.length > 2) return false; const ell = s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1; const cut = (s.overflow === 'hidden' || s.overflowY === 'hidden') && e.scrollHeight > e.clientHeight + 3 && s.webkitLineClamp === 'none'; const clamp = s.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 3; return ell || cut || clamp; }).map(lbl))].slice(0, 8);
  out.h1 = [...document.querySelectorAll('h1')].filter(vis).map(lbl);
  out.brokenImgs = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && vis(i)).map((i) => i.src.slice(-50));
  const body = document.body.innerText; out.badNames = (body.match(/\b(Cling ?note|Clean ?Note|Kling ?Note|ClingNotes|Clingnote|CLINGNOTE|EightHour|8hour|Vue App|TODO|undefined|NaN|\[object)\b/g) || []).filter((m) => m !== 'ClingNote');
  // fixed top/bottom bars + content under them
  const fixed = [...document.querySelectorAll('body *')].filter(vis).filter((e) => ['fixed', 'sticky'].includes(getComputedStyle(e).position)).map((e) => ({ e, r: e.getBoundingClientRect() }));
  const bottom = fixed.filter((f) => f.r.bottom >= vh - 2 && f.r.height < vh * 0.5 && f.r.width > vw * 0.6); const top = fixed.filter((f) => f.r.top <= 2 && f.r.height < 200 && f.r.width > vw * 0.6);
  out.fixedBars = { top: top.map((f) => Math.round(f.r.height)), bottom: bottom.map((f) => Math.round(f.r.height)) };
  // last content bottom padding vs bottom bar (at end of scroll)
  const sh = de.scrollHeight; const bbH = Math.max(0, ...bottom.map((f) => f.r.height));
  const contentEls = leaves.filter((e) => !fixedAnc(e)); const lastBottom = Math.max(0, ...contentEls.map((e) => e.getBoundingClientRect().bottom + scrollY));
  out.lastContentGapToEnd = Math.round(sh - lastBottom); out.bottomBar = Math.round(bbH); out.hiddenUnderBottomBar = bbH > 0 && sh - lastBottom < bbH ? true : false;
  // big vertical gaps between content blocks
  const ys = contentEls.map((e) => { const r = e.getBoundingClientRect(); return [r.top + scrollY, r.bottom + scrollY]; }).sort((a, b) => a[0] - b[0]);
  const gaps = []; let maxB = ys.length ? ys[0][1] : 0; for (const [t, b] of ys) { if (t - maxB > 120) gaps.push(`${Math.round(maxB)}→${Math.round(t)}`); maxB = Math.max(maxB, b); } out.gaps = gaps.slice(0, 4);
  out.font = getComputedStyle(document.body).fontFamily.split(',')[0]; out.bg = getComputedStyle(document.body).backgroundColor;
  out.hFonts = [...new Set([...document.querySelectorAll('h1,h2')].filter(vis).map((e) => getComputedStyle(e).fontFamily.split(',')[0]))];
  out.height = sh; return out;
};
(async () => {
  await fetch(`http://127.0.0.1:${FP}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AP}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const uid = await seedUser('zztest-audit@example.com', 'Ada ZZTEST'); const other = await seedUser('zztest-audit2@example.com', 'Bo ZZTEST');
  await seedTasks(uid, 'ZZTEST');
  const p = await newPage(br, 'aud'); const errs = []; p.on('pageerror', (e) => errs.push(p.url() + ' :: ' + e.message.slice(0, 120)));
  const dismiss = async () => { for (let i = 0; i < 3; i++) { const b = p.locator('.drama button, button:has-text("Not now"), button:has-text("Maybe later"), button:has-text("Skip")'); if (await b.count()) { await b.first().click({ timeout: 1500 }).catch(() => {}); await sleep(400); } } };
  const cap = async (name, note = '') => { const c = await p.evaluate(CHECK).catch((e) => ({ err: e.message })); await p.screenshot({ path: OUT + name + '.png', fullPage: true }).catch(() => {}); await p.screenshot({ path: OUT + name + '__vp.png' }).catch(() => {}); report.push({ name, url: p.url().replace(B, '').replace(uid, ':me').replace(other, ':other'), note, ...c }); console.log('cap', name); };
  const go = async (r, n, d = true) => { await p.goto(B + r, { waitUntil: 'load' }); await sleep(2800); if (d) await dismiss(); await cap(n || 'r' + r.replace(/[/?=&:]/g, '_')); };
  const tryStep = async (n, fn) => { try { await fn(); } catch (e) { report.push({ name: n, missing: e.message.split('\n')[0].slice(0, 120) }); console.log('miss', n, e.message.split('\n')[0]); } };
  // logged-out pages
  for (const r of ['/landing', '/welcome', '/login', '/login?returning=1']) await go(r, 'out' + r.replace(/[/?=&]/g, '_'), false);
  await emailLogin(p, 'zztest-audit@example.com'); await sleep(3000);
  await tryStep('home_morning_prompt', async () => { await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3500); await cap('home_morning_prompt', 'first view of the day (hours prompt if shown)'); });
  await dismiss();
  await tryStep('home_ready', async () => { await cap('home_ready'); });
  await tryStep('side_nav', async () => { await p.mouse.click(30, 34); await sleep(900); await cap('side_nav'); await p.keyboard.press('Escape'); await p.goto(B + '/home'); await sleep(2500); await dismiss(); });
  await tryStep('hero_menu', async () => { await p.click('.hero-menu-btn', { timeout: 4000 }); await sleep(700); await cap('hero_menu'); });
  await tryStep('shutdown', async () => { await p.click('button.hero-menu-item:has-text("Shutdown day")', { timeout: 4000 }); await sleep(1500); await cap('shutdown_prompt'); await p.goto(B + '/home'); await sleep(2500); await dismiss(); });
  await tryStep('add_task', async () => { await p.click('[data-test=create-task-fab], .fab-add', { timeout: 4000 }); await sleep(800); await p.fill('#nt-name', 'ZZTEST Wash the car with a really long task name to see wrapping behaviour'); await cap('add_task_modal'); await p.click('button[type=submit]'); await sleep(2500); await dismiss(); await cap('home_filled'); });
  await tryStep('start_day', async () => { const s = p.locator('[data-test=eh-start], button:has-text("Start Day")').first(); await s.click({ timeout: 4000 }); await sleep(1500); await cap('home_started_prompt'); for (const t of ['Confirm', 'Start']) { const b = p.locator(`button:has-text("${t}")`).first(); if (await b.count()) { await b.click().catch(() => {}); await sleep(1000); } } await dismiss(); await cap('home_started'); });
  await tryStep('complete_celebrate', async () => { for (const c of await p.locator('button.task-check[aria-label="Mark done"]').all()) { await c.click().catch(() => {}); await sleep(500); if (await p.locator('[data-test=eh-celebrate]').count()) { await cap('achievement_celebrate'); } } await sleep(1500); if (await p.locator('[data-test=eh-celebrate], .drama').count()) await cap('achievement_after'); await dismiss(); await cap('home_done'); });
  await tryStep('badges', async () => { const b = p.locator('[data-test=eh-badges] > *').first(); await b.click({ timeout: 3000 }); await sleep(800); await cap('badge_popup'); await p.keyboard.press('Escape'); });
  // Community
  await tryStep('community', async () => { await go('/community', 'community_empty'); await p.click('[data-test=cm-compose-open]', { timeout: 4000 }); await p.click('[data-test=cm-post-text]', { timeout: 4000 }); await sleep(500); await cap('community_composer'); await p.fill('[data-test=cm-post-text]', 'ZZTEST first post ✨ checking how a longer community post wraps on a small phone screen.'); await p.click('[data-test=cm-post-submit]'); await sleep(2500); await cap('community_filled');
    const av = p.locator('[data-test=cm-post] .cm-avatar, [data-test=cm-post] button').first(); await av.click({ timeout: 3000 }); await sleep(1200); if (await p.locator('[data-test=cm-profile]').count()) await cap('community_profile_sheet_badges'); await p.keyboard.press('Escape'); });
  const routes = ['/profile/' + uid, '/profile/' + other, '/rankings', '/discipline', '/discipline/log', '/gate', '/upcoming', '/addiction', '/about', '/pals', '/manage', '/chat', '/support', '/terms', '/privacy-policy', '/sub', '/payment-success', '/pro/success', '/no-such-page', '/onboarding', '/paywall'];
  for (const r of routes) await tryStep(r, async () => go(r, r === '/profile/' + uid ? 'profile_me' : r === '/profile/' + other ? 'profile_other' : undefined));
  for (let s = 1; s <= 6; s++) await tryStep('ob' + s, async () => go('/onboarding?step=' + s, 'onboarding_step' + s, false));
  require('fs').writeFileSync(OUT + 'report.json', JSON.stringify({ report, errs }, null, 1)); console.log('pageerrors', errs.length); await br.close(); process.exit(0);
})().catch((e) => { console.error(e); require('fs').writeFileSync(OUT + 'report.json', JSON.stringify({ report, fatal: e.message }, null, 1)); process.exit(1); });
