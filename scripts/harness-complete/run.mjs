import { chromium } from 'playwright-core';
const S = '/workspace/build37-shots/'; const res = {};
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function run(reduced) {
  const ctx = await b.newContext({ viewport: { width: 460, height: 360 }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); await p.goto('http://localhost:8137/'); await p.waitForSelector('[data-test=task-check]');
  const card = p.locator('.task-card').first(); const tag = reduced ? 'reduced-' : '';
  if (!reduced) await p.screenshot({ path: S + '1-before.png' });
  await p.locator('[data-test=task-check]').first().tap();
  const r = { classAfterTap: await card.evaluate((e) => e.className) };
  await p.waitForTimeout(250); if (!reduced) await p.screenshot({ path: S + '2-mid-animation.png' });
  r.classMid = await card.evaluate((e) => e.className);
  await p.waitForTimeout(1300);
  r.classAfter = await card.evaluate((e) => e.className);
  if (!reduced) await p.screenshot({ path: S + '3-after.png' });
  r.log = await p.evaluate(() => ({ ...window.__h.log, expanded: window.__h.expandedKey.value, completed: window.__h.tasks[0].completed }));
  r.editPanel = await p.locator('[data-test=edit-panel]').count();
  // also: mouse click path, and card-body tap still opens details (regression)
  await p.locator('[data-test=task-check]').nth(1).click(); await p.waitForTimeout(1500);
  r.afterSecondClick = await p.evaluate(() => ({ ...window.__h.log, expanded: window.__h.expandedKey.value }));
  await p.locator('.task-card').nth(1).locator('.task-body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await p.waitForTimeout(200); r.bodyTapOpensDetail = await p.evaluate(() => window.__h.log.detail);
  res[tag || 'motion'] = r; await ctx.close();
}
await run(false); await run(true); await b.close();
console.log(JSON.stringify(res, null, 1));
