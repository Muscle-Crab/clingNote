// Local only (emulators, ZZTEST): footer tab bar + Create-task FAB placement/behaviour. Shots to FF_OUT.
const H = require('./manager-pal.e2e.js');
const { chromium } = require('playwright-core');
const { sleep, seedUser, seedTasks, newPage, emailLogin } = H;
const B = `http://localhost:${process.env.WEB_PORT || 8099}`; const OUT = process.env.FF_OUT || '/tmp/ff/';
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
let fails = 0; const ok = (n, c, x = '') => { console.log(c ? 'PASS' : 'FAIL', n, x); if (!c) fails++; };
(async () => {
  await fetch(`http://127.0.0.1:${FP}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AP}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const uid = await seedUser('zztest-ff@example.com', 'Fe ZZTEST'); await seedTasks(uid, 'ZZTEST');
  const p = await newPage(br, 'ff');
  const dismiss = async () => { for (let i = 0; i < 3; i++) { const b = p.locator('.drama button, button:has-text("Not now"), button:has-text("Maybe later"), button:has-text("Skip"), button:has-text("do better")'); if (await b.count()) { await b.first().click({ timeout: 1500 }).catch(() => {}); await sleep(400); } } };
  await p.goto(B + '/login'); await sleep(1500); ok('no tab bar on login', !(await p.locator('[data-test=tabbar]').count()));
  await emailLogin(p, 'zztest-ff@example.com'); await sleep(3000); await p.goto(B + '/home'); await sleep(3000); await dismiss();
  const geo = () => p.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, w: b.width, h: b.height }; };
    const tabs = [...document.querySelectorAll('.tb-tab')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; });
    const de = document.documentElement; return { fab: r('[data-test=create-task-fab]'), bar: r('[data-test=tabbar]'), voice: r('.fab-voice'), tabs, active: document.querySelector('.tb-tab--on')?.innerText, hOv: de.scrollWidth > de.clientWidth }; });
  const chk = async (name) => { const g = await geo(); ok(name + ': bar + FAB present', g.bar && g.fab); if (!g.bar || !g.fab) return g;
    ok(name + ': FAB above bar, no overlap', g.fab.b <= g.bar.t - 4, `${Math.round(g.fab.b)}<=${Math.round(g.bar.t)}`); ok(name + ': FAB >=44', g.fab.h >= 44 && g.fab.w >= 44); ok(name + ': tabs >=44', g.tabs.length === 4 && g.tabs.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(g.tabs));
    if (g.voice) ok(name + ': voice not overlapping FAB/bar', g.voice.r < g.fab.l && g.voice.b <= g.bar.t);
    ok(name + ': no h-overflow', !g.hOv);
    await p.evaluate(() => window.scrollTo(0, 1e6)); await sleep(500);
    const under = await p.evaluate(() => { const bar = document.querySelector('[data-test=tabbar]').getBoundingClientRect().top; const fab = document.querySelector('[data-test=create-task-fab]').getBoundingClientRect();
      const els = [...document.querySelectorAll('.app-shell button, .app-shell a, .app-shell p, .app-shell h2, .app-shell li')].filter((e) => !e.closest('[data-test=tabbar],[data-test=create-task-fab],.fab-group,[role=dialog]') && getComputedStyle(e).position !== 'fixed' && e.getBoundingClientRect().height > 0 && e.offsetParent);
      return els.filter((e) => { const b = e.getBoundingClientRect(); return b.bottom > bar + 1 && b.top < innerHeight || (b.bottom > fab.top && b.top < fab.bottom && b.right > fab.left && b.left < fab.right); }).map((e) => (e.innerText || '').trim().slice(0, 30)); });
    ok(name + ': nothing hidden under bar/FAB at scroll end', under.length === 0, JSON.stringify(under)); await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300); return g; };
  let g = await chk('home'); ok('home tab active', g.active === 'Home'); await p.screenshot({ path: OUT + 'home.png' });
  await p.click('[data-test=create-task-fab]'); await sleep(1200); ok('FAB opens add-task on home', await p.locator('#nt-name').isVisible().catch(() => false)); await p.screenshot({ path: OUT + 'home_fab_modal.png' });
  await p.keyboard.press('Escape'); await p.goto(B + '/upcoming'); await sleep(2500); await dismiss(); g = await chk('upcoming'); ok('upcoming tab active', g.active === 'Upcoming'); await p.screenshot({ path: OUT + 'upcoming.png' });
  await p.click('[data-test=create-task-fab]'); await sleep(3500); ok('FAB from other page -> home add-task', p.url().endsWith('/home') && await p.locator('#nt-name').isVisible().catch(() => false), p.url().replace(B, ''));
  await p.keyboard.press('Escape');
  await p.goto(B + '/community'); await sleep(2500); await dismiss(); g = await chk('community'); ok('community tab active', g.active === 'Community'); await p.screenshot({ path: OUT + 'community.png' });
  await p.click('[data-test=tab-profile]'); await sleep(3000); await dismiss(); g = await chk('profile'); ok('profile tab active', g.active === 'Profile');
  for (const t of ['profile-terms', 'profile-support']) ok('profile link ' + t, await p.locator(`[data-test=${t}]`).count() > 0);
  ok('profile privacy link', await p.locator('.pf-row[href="/privacy-policy"]').count() > 0);
  await p.screenshot({ path: OUT + 'profile_top.png' }); await p.locator('[data-test=profile-terms]').scrollIntoViewIfNeeded(); await sleep(400); await p.screenshot({ path: OUT + 'profile_links.png' });
  for (const r of ['/rankings', '/discipline', '/pals', '/terms']) { await p.goto(B + r); await sleep(2500); await dismiss(); await chk(r); }
  await p.goto(B + '/gate'); await sleep(2500); ok('no FAB on gate', !(await p.locator('[data-test=create-task-fab]').count()));
  await p.goto(B + '/home'); await sleep(2500); await dismiss(); await p.mouse.click(30, 34); await sleep(900); ok('side nav still opens with items', /Rankings/.test(await p.locator('body').innerText()) && /Discipline/.test(await p.locator('body').innerText())); await p.screenshot({ path: OUT + 'sidenav.png' });
  await p.keyboard.press('Escape'); await p.goto(B + '/home'); await sleep(2500); await dismiss(); await p.click('.hero-menu-btn'); await sleep(600); await p.click('button.hero-menu-item:has-text("Shutdown day")'); await sleep(1500); await p.screenshot({ path: OUT + 'shutdown_prompt.png' });
  const sb = p.locator('button:has-text("Finish day")'); if (await sb.count()) { await sb.click(); await sleep(2500); for (const t of ['Confirm', 'Shut', 'Yes']) { const b = p.locator(`[role=dialog] button:has-text("${t}")`).first(); if (await b.count()) { await b.click().catch(() => {}); await sleep(1500); } } }
  if (await p.locator('[data-test=eh-shutdown]').count()) { ok('no FAB on shutdown screen', !(await p.locator('[data-test=create-task-fab]').isVisible().catch(() => false))); await p.screenshot({ path: OUT + 'shutdown_screen.png' }); } else console.log('note: shutdown screen not reached');
  console.log('fails', fails); await br.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
