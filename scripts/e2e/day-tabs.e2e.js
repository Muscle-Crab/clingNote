// Run: EMU_AUTH_PORT=9199 EMU_FS_PORT=8185 WEB_PORT=8231 CHROME=/usr/bin/google-chrome node scripts/e2e/day-tabs.e2e.js (ZZTEST accounts only)
// Day-tab fix e2e: rolling tabs, therapy added on the Mon tab -> Nov 9 (scheduler), stale leftover hidden, chip prefilled.
const H = require('./lib.js'); const INIT = () => {};
const { db, ok, sleep, seedUser, newPage, emailLogin, todayName } = H;
const TAG = process.env.TAG || 'after'; const S = process.env.SHOTS || '/workspace/e2e-all-screens/daytabs/';
const shot = async (p, name) => { const f = `${S}${TAG}-${name}.png`; await p.screenshot({ path: f }); console.log('  shot', f); };
(async () => {
  const email = `zztest-daytabs-${Date.now()}@example.com`; const uid = await seedUser(email, 'Dana ZZTEST');
  if (uid === 'dsDDbr945rawMAUKKpIAJcnPYrX2') throw new Error('forbidden');
  for (const d of H.WEEK) await db.doc(`weeklyRoutines/${uid}_${d}`).set({ tasks: [] });
  await db.doc(`weeklyRoutines/${uid}_${todayName()}`).set({ tasks: [{ title: 'ZZTEST today task', completed: false, minutes: 20, points: 10, createdAt: new Date().toISOString() }] });
  await db.doc(`weeklyRoutines/${uid}_Mon`).set({ tasks: [
    { title: 'ZZTEST stale Mon leftover', completed: false, minutes: 20, createdAt: '2026-10-26T15:00:00Z' },
    { title: 'ZZTEST weekly Mon', completed: false, minutes: 20, type: 'recurring', repeatDays: ['Mon', 'Thu'], createdAt: '2026-10-01T15:00:00Z' }] });
  const br = await H.chromium.launch(); const p = await newPage(br, { label: 'daytabs', init: INIT });
  await emailLogin(p, email); await sleep(4000);
  const clear = async () => { for (let i = 0; i < 5; i++) { const b = p.locator('.bb-x, .dsp-skip, .drama button'); if (await b.count()) { await b.first().click({ timeout: 2000 }).catch(() => {}); await sleep(600); } } };
  await clear(); await shot(p, '1-home-tabs');
  const tabs = await p.locator('.day-tab').allInnerTexts(); console.log('  tabs:', tabs.map((t) => t.replace(/\s+/g, ' ')).join(' | '));
  ok('tabs start at today (Tue 3)', /tue\s*3/i.test(tabs[0] || ''), tabs[0]);
  ok('Mon tab shows Nov 9', tabs.some((t) => /mon\s*9/i.test(t)));
  await p.locator('.day-tab', { hasText: 'Mon' }).first().click(); await sleep(1500); await clear();
  const hdr = await p.locator('body').innerText();
  ok('header says Monday, November 9', /Monday, November 9/i.test(hdr));
  ok('stale leftover hidden on Mon Nov 9', !hdr.includes('ZZTEST stale Mon leftover'));
  ok('recurring Mon task still shows', hdr.includes('ZZTEST weekly Mon'));
  await shot(p, '2-mon-tab');
  await p.click('[data-test=create-task-fab]'); await sleep(900);
  if (!(await p.locator('#nt-name').isVisible().catch(() => false))) { const c = p.locator('text=/New task|Add a task|One task/i'); if (await c.count()) await c.first().click().catch(() => {}); await sleep(800); }
  await p.fill('#nt-name', 'therapy'); await sleep(300);
  const chip = await p.locator('[data-test=nt-date-chip]').innerText().catch(() => '');
  ok('date chip prefilled with Mon Nov 9', /Nov 9/.test(chip), chip);
  await shot(p, '3-add-sheet');
  await p.locator('.nt-form button[type=submit]').click(); await sleep(2500); await clear();
  const u = (await db.doc(`users/${uid}`).get()).data() || {};
  const e = ((u.scheduledTasks && u.scheduledTasks.tasks) || u.scheduledTasks || []).find?.((x) => x.title === 'therapy');
  ok('therapy stored with scheduledDate 2026-11-09', e && e.scheduledDate === '2026-11-09', JSON.stringify(e || u.scheduledTasks || null).slice(0, 200));
  const mon = ((await db.doc(`weeklyRoutines/${uid}_Mon`).get()).data() || {}).tasks || [];
  ok('therapy NOT written to the Mon weekday doc', !mon.some((t) => t.title === 'therapy'));
  const txt = await p.locator('body').innerText();
  ok('therapy visible on the Mon tab', txt.includes('therapy'));
  await shot(p, '4-mon-after-add');
  await p.locator('.day-tab').first().click(); await sleep(1200); await clear();
  const td = await p.locator('body').innerText();
  ok('today tab unchanged (today task or Start Day prompt, as before)', td.includes('ZZTEST today task') || /Start Your Day/i.test(td));
  await shot(p, '5-today-tab');
  await p.click('[data-test=create-task-fab]'); await sleep(900);
  if (!(await p.locator('#nt-name').isVisible().catch(() => false))) { const c = p.locator('text=/New task|Add a task|One task/i'); if (await c.count()) await c.first().click().catch(() => {}); await sleep(800); }
  const c0 = await p.locator('[data-test=nt-date-chip]').innerText().catch(() => '');
  ok('today tab: chip says Today', /Today/.test(c0), c0);
  await p.fill('#nt-name', 'dentist next monday'); await sleep(500);
  const h = p.locator('[data-test=nl-hint]'); if (await h.count()) { await h.click(); await sleep(600); }
  const c1 = await p.locator('[data-test=nt-date-chip]').innerText().catch(() => '');
  const sd = await p.inputValue('[data-test=sched-date]').catch(() => '');
  ok("'next Monday' hint moves the date to Mon Nov 9 (chip, or the schedule when the hint carries a time)", /Nov 9/.test(c1) || sd === '2026-11-09', c1 || sd);
  await shot(p, '6-next-monday-hint');
  await br.close(); H.summary ? H.summary() : null; process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
