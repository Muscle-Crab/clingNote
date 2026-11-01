// Routine add-ons e2e: Routine strip (today checklist + weekly bar/dots), Skip today, reminder time, repeat-after-completion.
// Local emulators only (demo-clingnote), fresh zztest-routine-<ts> account; never wipes the emulator.
// Run: EMU_AUTH_PORT=9199 EMU_FS_PORT=8185 WEB_PORT=8141 CHROME=... NODE_PATH=<playwright-core + firebase-admin> node scripts/e2e/routine.e2e.js
// BEFORE=1: only seeds + takes the Home screenshot (used for the before/after design comparison).
const H = require('./manager-pal.e2e.js');
const { chromium } = require('playwright-core');
const { db, ok, sleep, seedUser, newPage, emailLogin } = H;
const SHOTS = process.env.SHOTS || '/workspace/eighthour_shots/';
const BEFORE = process.env.BEFORE === '1';
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n, 12)); };

(async () => {
  const email = `zztest-routine-${Date.now()}@example.com`;
  const uid = await seedUser(email, 'Rita ZZTEST');
  const now = new Date(); const today = ymd(now); const monday = addDays(today, -((now.getDay() + 6) % 7));
  const todayName = WEEK[(now.getDay() + 6) % 7];
  for (const d of WEEK) await db.doc(`weeklyRoutines/${uid}_${d}`).set({ tasks: [] });
  await db.doc(`weeklyRoutines/${uid}_${todayName}`).set({ tasks: [
    { title: 'ZZTEST one-off A', completed: false, type: 'one-time', createdAt: '2026-01-01T00:00:01Z' },
    { title: 'ZZTEST one-off B', completed: false, type: 'one-time', createdAt: '2026-01-01T00:00:02Z' },
  ] });
  const tpl = (id, title, recurrence, extra = {}) => ({ id, title, userId: uid, status: 'todo', priority: 'low', labels: [], notes: '', scheduledTime: '', startDate: monday, recurrence, generated: [], skip: [], ...extra });
  const doneMon = monday < today ? [monday] : [];
  await db.doc(`users/${uid}`).set({ scheduledTasks: { tasks: [
    tpl('zzStretch', 'ZZTEST Stretch', { freq: 'daily' }, { doneOn: doneMon }),
    tpl('zzVitamins', 'ZZTEST Vitamins', { freq: 'daily' }, { remindAt: '07:30' }),
    tpl('zzJournal', 'ZZTEST Journal', { freq: 'daily' }),
    tpl('zzPlants', 'ZZTEST Water plants', { freq: 'afterCompletion', everyDays: 3 }, { startDate: today, nextDate: today }),
  ] } }, { merge: true });

  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const p = await newPage(br, 'routine');
  const errs = []; p.on('pageerror', (e) => /SDK already initialized/.test(e.message) || errs.push(e.message));
  p.on('console', (m) => { if (/routine log|skip today|undo skip|schedule edit/i.test(m.text())) console.log('[console]', m.text()); });
  await emailLogin(p, email); await sleep(3500);
  const clearOverlays = async () => { for (let i = 0; i < 4; i++) { const b = p.locator('.bb-x, .dsp-skip, .drama button'); if (await b.count()) { await b.first().click({ timeout: 3000 }).catch(() => {}); await sleep(700); } } };
  await clearOverlays();
  const sd = p.locator('button', { hasText: 'Start Day' }); if (await sd.count()) { await sd.first().click({ timeout: 5000 }).catch(() => {}); await sleep(2500); await clearOverlays(); }
  await sleep(1500);
  await p.screenshot({ path: SHOTS + (BEFORE ? 'routine_home_before.png' : 'routine_home_after.png') });
  // same views captured before (stashed code) and after, for the design comparison
  const designShots = async (tag) => {
    const base = `http://localhost:${process.env.WEB_PORT || 8080}`;
    await p.goto(base + '/home'); await sleep(3500); await clearOverlays();
    const jc = p.locator('.task-card', { hasText: 'ZZTEST Vitamins' }).first();
    await jc.scrollIntoViewIfNeeded(); await jc.locator('.task-more').first().click(); await sleep(400);
    await p.screenshot({ path: SHOTS + `design_${tag}_more_menu.png` });
    await jc.locator('.task-more').first().click(); await sleep(300);
    await jc.locator('[data-test=edit-btn]').click(); await sleep(400);
    await jc.locator('.adj-chip', { hasText: 'Full view' }).click(); await sleep(800);
    await p.screenshot({ path: SHOTS + `design_${tag}_picker.png` });
    await p.goto(base + '/upcoming'); await sleep(3000);
    await p.screenshot({ path: SHOTS + `design_${tag}_upcoming_top.png` });
    const h = p.locator('h2', { hasText: 'Repeating' }).first();
    if (await h.count()) { await h.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 80)); await sleep(500); }
    await p.screenshot({ path: SHOTS + `design_${tag}_upcoming_repeating.png` });
  };
  if (BEFORE) { await designShots('before'); await br.close(); console.log('before shots taken'); process.exit(0); }

  const dayTasks = async () => (await db.doc(`weeklyRoutines/${uid}_${todayName}`).get()).data().tasks || [];
  const sched = async () => (await db.doc(`users/${uid}`).get()).data().scheduledTasks.tasks;
  const strip = p.locator('[data-test=routine-strip]');
  ok('routine strip is one compact row', await strip.count() === 1 && (await strip.boundingBox()).height <= 56, String((await strip.boundingBox())?.height));
  ok('collapsed by default (no chips)', await p.locator('[data-test=routine-chip]').count() === 0);
  const head = await p.innerText('[data-test=routine-toggle]');
  ok('today count 0/4', /0\/4/.test(head), head);
  const wk = await p.getAttribute('[data-test=routine-week]', 'aria-label');
  ok('weekly label present', /This week: \d+ of \d+ routine tasks done/.test(wk || ''), wk);
  ok('7 day dots', await p.locator('[data-test=routine-dot]').count() === 7);
  ok('one-off tasks still in the list', await p.locator('.task-card', { hasText: 'ZZTEST one-off A' }).count() === 1);

  await p.click('[data-test=routine-toggle]'); await sleep(500);
  ok('expanded shows 4 chips', await p.locator('[data-test=routine-chip]').count() === 4);
  await p.screenshot({ path: SHOTS + 'routine_home_expanded.png' });
  const until = async (f, ms = 10000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await f()) return true; await sleep(400); } return false; };
  await p.locator('[data-test=routine-chip]', { hasText: 'ZZTEST Stretch' }).click();
  await until(async () => ((await sched()).find((t) => t.id === 'zzStretch').doneOn || []).includes(today));
  let st = await sched();
  ok('checking a chip records doneOn today', (st.find((t) => t.id === 'zzStretch').doneOn || []).includes(today));
  ok('chip shows done', await p.locator('[data-test=routine-chip].is-done', { hasText: 'ZZTEST Stretch' }).count() === 1);
  ok('today count 1/4', /1\/4/.test(await p.innerText('[data-test=routine-toggle]')));

  // repeat-after-completion: completing schedules the next one at today + 3
  await p.locator('[data-test=routine-chip]', { hasText: 'ZZTEST Water plants' }).click();
  await until(async () => (await sched()).find((t) => t.id === 'zzPlants').nextDate !== today);
  st = await sched();
  const plants = st.find((t) => t.id === 'zzPlants');
  ok('after-completion: nextDate = today + 3', plants.nextDate === addDays(today, 3), plants.nextDate);

  // Skip today from the task's existing ⋯ menu
  // today's copy (the seed's Monday copy is caught up as an overdue card too)
  const todayCard = () => p.locator('.task-card', { hasText: 'ZZTEST Journal' }).filter({ hasNotText: 'Overdue' }).first();
  const card = todayCard();
  await card.locator('.task-more').first().click();
  await sleep(400);
  await card.locator('[data-test=skip-today]').click(); await sleep(2500);
  st = await sched();
  ok('skip today adds the date to the series skip list', (st.find((t) => t.id === 'zzJournal').skip || []).includes(today));
  ok('skip today does not record a completion', !(st.find((t) => t.id === 'zzJournal').doneOn || []).includes(today));
  ok('skipped task left today\'s list', !(await dayTasks()).some((t) => t.templateId === 'zzJournal' && t.scheduledFor === today));
  ok('series continues (not stopped, no until)', !st.find((t) => t.id === 'zzJournal').stopped && !st.find((t) => t.id === 'zzJournal').recurrence.until);
  ok('skip toast with undo', await p.locator('[data-test=repeat-toast]', { hasText: 'Skipped today' }).count() === 1);
  await p.screenshot({ path: SHOTS + 'routine_skip_toast.png' });
  await p.click('[data-test=repeat-undo]'); await sleep(2500);
  st = await sched();
  ok('undo skip restores the task and the series', (await dayTasks()).some((t) => t.templateId === 'zzJournal' && t.scheduledFor === today) && !(st.find((t) => t.id === 'zzJournal').skip || []).includes(today));
  const card2 = todayCard();
  await card2.locator('.task-more').first().click(); await sleep(400);
  await p.screenshot({ path: SHOTS + 'routine_more_menu.png' });
  await card2.locator('[data-test=skip-today]').click(); await sleep(2500);
  st = await sched();
  ok('skipped again', (st.find((t) => t.id === 'zzJournal').skip || []).includes(today));
  const streakDoc = (await db.doc(`streaks/${uid}`).get()).data() || {};
  ok('skip did not touch streak dayDone', !(streakDoc.dayDone || []).some((k) => /Journal/.test(k)));

  // Reminder time inside the existing edit (full view) sheet's schedule picker
  const vcard = p.locator('.task-card', { hasText: 'ZZTEST Vitamins' }).first();
  await vcard.locator('[data-test=edit-btn]').click(); await sleep(400);
  await vcard.locator('.adj-chip', { hasText: 'Full view' }).click(); await sleep(800);
  ok('picker shows reminder time for a repeating task', await p.inputValue('[data-test=sched-remind]') === '07:30');
  await p.fill('[data-test=sched-remind]', '08:15');
  await p.screenshot({ path: SHOTS + 'routine_picker.png' });
  ok('picker offers "After done" with an N input', await p.locator('.sp-seg-btn', { hasText: 'After done' }).count() === 1);
  const save = p.locator('[data-test=sched-save-future], [data-test=sched-save]').first(); await save.click(); await sleep(2500);
  st = await sched();
  const vit = st.filter((t) => t.recurrence && /Vitamins/.test(t.title) && !t.stopped);
  ok('reminder time saved on the series', vit.some((t) => t.remindAt === '08:15'), JSON.stringify(vit.map((t) => t.remindAt)));
  await p.keyboard.press('Escape').catch(() => {}); await sleep(300);
  await p.goto(`http://localhost:${process.env.WEB_PORT || 8080}/upcoming`); await sleep(3000);
  const uw = p.locator('[data-test=routine-week]');
  ok('Upcoming shows the weekly routine dots inline in the Repeating header', await uw.count() === 1 && /This week: \d+ of \d+/.test(await uw.getAttribute('aria-label')));
  await p.screenshot({ path: SHOTS + 'routine_upcoming_after.png', fullPage: true });
  const plantsRow = await p.locator('li, .tpl-row, div', { hasText: 'ZZTEST Water plants' }).filter({ hasText: 'Next:' }).last().innerText();
  ok('Upcoming shows the after-completion next date', /Next: (Fri|Oct 30|Fri, Oct 30)/.test(plantsRow) && !/Next: —/.test(plantsRow), plantsRow.replace(/\s+/g, ' ').slice(0, 120));
  await designShots('after');
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await br.close();
  const failed = H.results.filter((r) => !r.pass);
  console.log(failed.length ? `routine e2e: ${failed.length} FAILED` : 'routine e2e: all passed');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E Error', e); process.exit(1); });
