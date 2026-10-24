// Scheduling e2e (local emulators only, ZZTEST data). Reuses the manager-pal harness helpers.
// Needs the same services as manager-pal.e2e.js (ports via EMU_AUTH_PORT/EMU_FS_PORT/FN_PORT/WEB_PORT).
const H = require('./manager-pal.e2e.js');
const { chromium } = require('playwright-core');
const { db, admin, ok, sleep, seedUser, seedTasks, newPage, emailLogin, idTokenFor, callFn, B, FN, results } = H;
const SHOTS = process.env.SCHED_SHOTS || '/workspace/eighthour_shots/';
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const shot = (p, n) => p.screenshot({ path: SHOTS + n });

(async () => {
  await fetch(`http://127.0.0.1:${FP}/emulator/v1/projects/demo-clingnote/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:${AP}/emulator/v1/projects/demo-clingnote/accounts`, { method: 'DELETE' });
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const uid = await seedUser('zztest-sched@example.com', 'Sam ZZTEST'); await seedTasks(uid, 'Sam');
  const strangerUid = await seedUser('zztest-stranger@example.com', 'Stan ZZTEST');
  const now = new Date(); const today = ymd(now); const todayName = WEEK[(now.getDay() + 6) % 7];
  const p = await newPage(br, 'owner');
  p.on('console', (msg) => { if (msg.type() === 'error' && process.env.SCHED_DEBUG) console.log('[console]', msg.text().slice(0, 300)); });
  await emailLogin(p, 'zztest-sched@example.com'); await sleep(3000);
  const dismiss = async () => { for (let i = 0; i < 3; i++) { const b = p.locator('.drama button'); if (await b.count()) { await b.first().click().catch(() => {}); await sleep(600); } } };
  await dismiss();
  const sd = p.locator('button', { hasText: 'Start Day' }); if (await sd.count()) { await sd.first().click(); await sleep(2000); await dismiss(); }

  const openAdd = async (title) => { await p.click('.fab-add'); await p.fill('#nt-name', title); };
  // 1) one-time today, time already passed -> appears today, labelled, overdue
  await openAdd('ZZTEST Sched one-time');
  ok('Schedule switch starts off', (await p.getAttribute('[data-test=schedule-switch]', 'aria-checked')) === 'false');
  await p.click('[data-test=schedule-switch]');
  ok('switch on reveals date/time/repeat', await p.locator('[data-test=sched-date]').isVisible() && await p.locator('[data-test=sched-time]').isVisible() && await p.locator('[data-test=repeat-never]').isVisible());
  ok('date defaults to today', (await p.inputValue('[data-test=sched-date]')) === today);
  await p.fill('[data-test=sched-time]', '00:01');
  await shot(p, 'sched_1_add_onetime.png');
  await p.click('button[type=submit]'); await sleep(2500);
  const card1 = p.locator('.task-card, [class*=task]', { hasText: 'ZZTEST Sched one-time' }).first();
  ok('one-time task shows on today', await card1.count() > 0);
  const lbl1 = await p.locator('[data-test=sched-label]', { hasText: '12:01 AM' }).first().innerText().catch(() => '');
  ok('clock label + overdue on passed time', lbl1.includes('⏰') && lbl1.includes('Overdue'), lbl1);

  // 2) recurring daily at 23:59 -> today's occurrence materialized with repeat label
  await openAdd('ZZTEST Sched daily');
  await p.click('[data-test=schedule-switch]'); await p.fill('[data-test=sched-time]', '23:59'); await p.click('[data-test=repeat-daily]');
  await shot(p, 'sched_2_add_daily.png');
  await p.click('button[type=submit]'); await sleep(2500);
  const lbl2 = await p.locator('[data-test=sched-label]', { hasText: 'Every day' }).first().innerText().catch(() => '');
  ok('daily occurrence on today with repeat label', lbl2.includes('🔁') && lbl2.includes('11:59 PM'), lbl2);

  // 3) weekly on a different weekday, ends in 4 weeks -> only in the series list
  const other = (now.getDay() + 2) % 7; const until = new Date(now); until.setDate(until.getDate() + 28);
  await openAdd('ZZTEST Sched weekly');
  await p.click('[data-test=schedule-switch]'); await p.click('[data-test=repeat-weekly]');
  await p.click(`[data-test=wd-${now.getDay()}]`); await p.click(`[data-test=wd-${other}]`);
  await p.fill('[data-test=sched-until]', ymd(until));
  await shot(p, 'sched_3_add_weekly.png');
  await p.click('button[type=submit]'); await sleep(2500);
  ok('weekly (other day) not on today', await p.locator('.task-title', { hasText: 'ZZTEST Sched weekly' }).count() === 0);
  await p.click('.sched-toggle'); await sleep(500);
  ok('series list shows weekly + daily', (await p.locator('[data-test=series-list]').innerText()).includes('ZZTEST Sched weekly'));
  await p.locator('[data-test=series-list]').scrollIntoViewIfNeeded(); await shot(p, 'sched_4_upcoming_series.png');

  // validation: weekly with no weekday
  await openAdd('ZZTEST Sched invalid'); await p.click('[data-test=schedule-switch]'); await p.click('[data-test=repeat-weekly]');
  const chips = p.locator('[data-test^=wd-][aria-pressed=true], [data-test^=wd-].on, [data-test^=wd-].active');
  for (let i = await chips.count(); i > 0; i--) await chips.first().click();
  await p.click('button[type=submit]'); await sleep(800);
  ok('validation blocks weekly without weekdays', (await p.content()).includes('Pick at least one weekday.'));
  await shot(p, 'sched_5_validation.png');
  await p.click('.modal-close'); await sleep(400);

  // Firestore state
  const u = (await db.doc(`users/${uid}`).get()).data(); const list = (u.scheduledTasks || {}).tasks || [];
  const daily = list.find((e) => e.title === 'ZZTEST Sched daily' && e.recurrence);
  const weekly = list.find((e) => e.title === 'ZZTEST Sched weekly' && e.recurrence);
  ok('templates stored with recurrence', daily && daily.recurrence.freq === 'daily' && weekly && weekly.recurrence.freq === 'weekly' && weekly.recurrence.until === ymd(until));
  const dayDoc = (await db.doc(`weeklyRoutines/${uid}_${todayName.slice(0, 3)}`).get()).data().tasks;
  if (process.env.SCHED_DEBUG) { const all = await db.collection('weeklyRoutines').get(); all.docs.filter((d) => d.id.startsWith(uid)).forEach((d) => console.log('[doc]', d.id, JSON.stringify((d.data().tasks || []).map((t) => t.title)))); console.log('[sched]', JSON.stringify(list.map((e) => ({ t: e.title, g: e.generated, m: e.materializedAt, md: e.materializedDate })))); }
  const occ = dayDoc.find((t) => t.title === 'ZZTEST Sched daily');
  ok('today occurrence materialized as a normal task', occ && occ.templateId === daily.id && occ.scheduledFor === today && !occ.completed, JSON.stringify({ occ: occ && { tpl: occ.templateId, sf: occ.scheduledFor, c: occ.completed }, dailyId: daily.id, today, titles: dayDoc.map((t) => t.title) }));

  // manager view (function harness): Public scheduled tasks with times, Private hidden
  await db.doc(`users/${uid}`).set({ scheduledTasks: { tasks: [...list, { id: 'zzpriv', title: 'ZZTEST SECRET sched', visibility: 'private', startDate: today, scheduledTime: '08:00', recurrence: { freq: 'daily' }, generated: [], skip: [] }], updatedAt: Date.now() } }, { merge: true });
  const tok = await idTokenFor(uid);
  const { body: { token } } = await callFn(tok, { action: 'createManagerLink', name: 'Mom' });
  const view = await (await fetch(`${FN}/.netlify/functions/manager-pal?token=${token}`)).json();
  const vt = view.tasks || [];
  ok('manager sees today daily occurrence with time + repeat', vt.some((t) => t.title === 'ZZTEST Sched daily' && t.scheduled && t.scheduled.time === '23:59' && t.scheduled.repeat));
  ok('manager sees upcoming daily occurrences (tomorrow+)', vt.some((t) => t.upcoming && t.title === 'ZZTEST Sched daily'));
  ok('manager sees the one-time overdue', vt.some((t) => t.title === 'ZZTEST Sched one-time' && t.overdue));
  ok('private scheduled never leaves server', !JSON.stringify(view).includes('SECRET'));
  ok('manager stays read-only (bad action rejected)', (await (await fetch(`${FN}/.netlify/functions/manager-pal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action: 'editTask' }) })).status) === 400);
  const m = await newPage(br, 'manager'); await m.goto(`${B}/m/${token}`, { waitUntil: 'load' }); await sleep(3000);
  ok('manager page shows repeat label', await m.locator('[data-test=pal-repeat]').count() > 0);
  await shot(m, 'sched_6_manager_view.png');

  // detail: switch the daily occurrence off ("unscheduled")
  await p.reload({ waitUntil: 'load' }); await sleep(3000); await dismiss();
  await p.locator('.task-title', { hasText: 'ZZTEST Sched one-time' }).first().click(); await sleep(800);
  ok('detail shows schedule picker', await p.locator('[data-test=detail-schedule]').count() > 0);
  await shot(p, 'sched_7_detail.png');
  await p.click('[data-test=detail-schedule] [data-test=schedule-switch]'); await p.click('[data-test=sched-save]'); await sleep(2500);
  const after = (await db.doc(`weeklyRoutines/${uid}_${todayName.slice(0, 3)}`).get()).data().tasks.find((t) => t.title === 'ZZTEST Sched one-time');
  ok('switch off removes schedule but keeps the task', after && !after.scheduledId && !after.reminder);
  await p.keyboard.press('Escape'); await sleep(500);
  await shot(p, 'sched_8_after_unschedule.png');

  // rules: owner-only + validation
  const rest = async (t, path, fields, mask) => (await fetch(`http://127.0.0.1:${FP}/v1/projects/demo-clingnote/databases/(default)/documents/${path}?${mask.map((f) => 'updateMask.fieldPaths=' + f).join('&')}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })).status;
  const tasksVal = (n) => ({ mapValue: { fields: { tasks: { arrayValue: { values: Array.from({ length: n }, (_, i) => ({ mapValue: { fields: { id: { stringValue: 'zz' + i } } } })) } } } } });
  const tStr = await idTokenFor(strangerUid);
  ok('rules: owner writes scheduledTasks', (await rest(tok, `users/${uid}`, { scheduledTasks: tasksVal(3) }, ['scheduledTasks'])) === 200);
  ok('rules: stranger cannot write owner scheduledTasks', (await rest(tStr, `users/${uid}`, { scheduledTasks: tasksVal(1) }, ['scheduledTasks'])) === 403);
  ok('rules: >300 scheduled tasks rejected', (await rest(tok, `users/${uid}`, { scheduledTasks: tasksVal(301) }, ['scheduledTasks'])) === 403);
  ok('rules: non-map scheduledTasks rejected', (await rest(tok, `users/${uid}`, { scheduledTasks: { stringValue: 'x' } }, ['scheduledTasks'])) === 403);

  await br.close();
  console.log(`\nSCHED E2E: ${results.filter((r) => r.pass).length}/${results.length} passed`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
