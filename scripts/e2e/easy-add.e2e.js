// Easy-add / Plan my day / templates / "N more not shown" e2e. Local emulators only (demo-clingnote), ZZTEST user.
// Does NOT wipe the emulators (they are shared): uses a fresh zztest-easyadd-<ts> account.
// Run: WEB_PORT=8141 NODE_PATH=<playwright-core + firebase-admin> node scripts/e2e/easy-add.e2e.js
const H = require('./manager-pal.e2e.js');
const { chromium } = require('playwright-core');
const { db, ok, sleep, seedUser, newPage, emailLogin } = H;
const SHOTS = process.env.SHOTS || '/workspace/eighthour_shots/';
// Emulator ports: EMU_AUTH_PORT / EMU_FS_PORT (read by manager-pal.e2e.js); the dev server needs matching VUE_APP_EMU_*_PORT.
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

(async () => {
  const email = `zztest-easyadd-${Date.now()}@example.com`;
  const uid = await seedUser(email, 'Eddie ZZTEST');
  const today = WEEK[(new Date().getDay() + 6) % 7];
  for (const d of WEEK) await db.doc(`weeklyRoutines/${uid}_${d}`).set({ tasks: [] });
  const tasks = [];
  for (let i = 0; i < 9; i++) tasks.push({ title: `ZZTEST task ${i + 1}`, completed: false, estimateMin: 30, createdAt: `2026-01-01T00:00:0${i}Z` });
  tasks.push({ title: 'ZZTEST Gym', completed: false, estimateMin: 45 }, { title: 'ZZTEST Gym', completed: false, estimateMin: 45 }); // same createdAt|title key
  tasks.push({ title: 'ZZTEST done A', completed: true, createdAt: '2026-01-01T00:01:00Z' }, { title: 'ZZTEST done B', completed: true, createdAt: '2026-01-01T00:02:00Z' });
  await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await newPage(br, 'easy');
  const errs = []; p.on('pageerror', (e) => /SDK already initialized/.test(e.message) || errs.push(e.message)); // known dev-server SDK noise, ignored by the other e2e suites too
  await emailLogin(p, email); await sleep(3500);
  for (let i = 0; i < 3; i++) { const b = p.locator('.drama button'); if (await b.count()) { await b.first().click().catch(() => {}); await sleep(600); } }
  const clearOverlays = async () => { for (let i = 0; i < 4; i++) { const b = p.locator('.bb-x, .dsp-skip, .drama button'); if (await b.count()) { await b.first().click({ timeout: 3000 }).catch(() => {}); await sleep(700); } } };
  await clearOverlays();
  const sd = p.locator('button', { hasText: 'Start Day' }); if (await sd.count()) { await sd.first().click({ timeout: 5000 }).catch(() => {}); await sleep(2500); await clearOverlays(); }
  await p.screenshot({ path: SHOTS + 'easy_0_home.png' });

  // Feature 2: 13 tasks (2 completed under the Done toggle) -> no "hidden" note; duplicate-key cards both render
  const more = p.locator('[data-test=more-hidden]');
  ok('no hidden note when nothing is filtered (completed have the Done toggle)', await more.count() === 0);
  ok('both duplicate-key Gym cards render', await p.locator('.task-card', { hasText: 'ZZTEST Gym' }).count() === 2);
  ok('11 open cards on screen', await p.locator('.task-card:not(.task-card--completed)').count() === 11, String(await p.locator('.task-card:not(.task-card--completed)').count()));
  await p.screenshot({ path: SHOTS + 'easy_1_list.png' });

  // Feature 3: Plan my day — nothing preselected, preview, save only on Confirm
  ok('no extra Plan/Templates button row on Home', await p.locator('[data-test=day-tools]').count() === 0);
  await p.click('.sort-btn'); await sleep(300); await p.screenshot({ path: SHOTS + 'easy_0_header_menu.png' });
  await p.click('[data-test=plan-day-open]'); await sleep(600);
  ok('start empty', (await p.inputValue('[data-test=plan-start]')) === '');
  ok('hours empty', (await p.inputValue('[data-test=plan-hours]')) === '');
  ok('lay out disabled until both chosen', await p.isDisabled('[data-test=plan-layout]'));
  await p.fill('[data-test=plan-start]', '09:00');
  ok('still disabled with only start', await p.isDisabled('[data-test=plan-layout]'));
  const opts = await p.locator('[data-test=plan-hours] option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
  await p.selectOption('[data-test=plan-hours]', opts.includes('4') ? '4' : opts[3]);
  await p.click('[data-test=plan-layout]'); await sleep(800);
  ok('preview shown', await p.locator('[data-test=plan-preview]').isVisible());
  await p.screenshot({ path: SHOTS + 'easy_2_plan_preview.png' });
  const before = (await db.doc(`weeklyRoutines/${uid}_${today}`).get()).data().tasks;
  ok('nothing saved before Confirm', before.every((t) => !t.startTime));
  await p.click('[data-test=plan-confirm]'); await sleep(3000);
  const after = (await db.doc(`weeklyRoutines/${uid}_${today}`).get()).data().tasks;
  const timed = after.filter((t) => t.startTime);
  ok('Confirm saved start times inside 09:00-13:00', timed.length > 0 && timed.every((t) => t.startTime >= '09:00' && t.startTime < '13:00'), `${timed.length} timed`);
  ok('completed tasks untouched', after.filter((t) => t.completed).every((t) => !t.startTime));

  // Feature 4: templates — save, apply skips duplicates
  await p.click('.sort-btn'); await sleep(300);
  await p.click('[data-test=templates-open]'); await sleep(800);
  ok('template header count matches what is saved', (await p.innerText('.dts-h')).includes('(12 tasks)'));
  await p.fill('[data-test=tpl-name]', 'ZZTEST Workday'); await p.click('[data-test=tpl-times]'); await p.click('[data-test=tpl-save]'); await sleep(2000);
  ok('template saved note', (await p.innerText('[data-test=tpl-note]')).includes('ZZTEST Workday'));
  const st = (await db.doc(`userSettings/${uid}`).get()).data() || {};
  ok('template stored in userSettings', Array.isArray(st.dayTemplates) && st.dayTemplates[0].name === 'ZZTEST Workday' && st.dayTemplates[0].items.length === 12, JSON.stringify((st.dayTemplates || []).map((t) => t.items.length)));
  await p.screenshot({ path: SHOTS + 'easy_3_templates.png' });
  await p.click('[data-test=tpl-apply]'); await sleep(2500);
  const t2 = (await db.doc(`weeklyRoutines/${uid}_${today}`).get()).data().tasks;
  ok('apply on same day adds nothing (all duplicates skipped)', t2.length === 13, String(t2.length));
  const toast = await p.locator('[data-test=note-toast], [data-test=tpl-error]').first().innerText().catch(() => '');
  ok('apply summary says already on today', /already on today/.test(toast), JSON.stringify(toast));

  // Feature 1: widget "+" deep link target opens the add sheet even when Home is already open
  await p.goto(p.url().replace(/\/home.*$/, '/home?new=1'), { waitUntil: 'load' }); await sleep(5000);
  ok('/home?new=1 opens Add task sheet', await p.locator('#nt-name').isVisible().catch(() => false));
  await p.screenshot({ path: SHOTS + 'easy_4_new_sheet.png' });
  ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
  await br.close(); console.log('easy-add e2e: all passed'); process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
