// Run: EMU_AUTH_PORT=9199 EMU_FS_PORT=8185 WEB_PORT=8231 CHROME=/usr/bin/google-chrome node scripts/e2e/day-tabs.e2e.js (ZZTEST accounts only)
// Day-tab fix e2e: rolling tabs, therapy added on a future tab -> that tab's date (scheduler). Date-relative: works on any day, stale leftover hidden, chip prefilled.
const H = require('./lib.js'); const INIT = () => {};
const { db, ok, sleep, seedUser, newPage, emailLogin, todayName } = H;
const TAG = process.env.TAG || 'after'; const S = process.env.SHOTS || '/workspace/e2e-all-screens/daytabs/';
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const NOW = new Date(); NOW.setHours(12, 0, 0, 0);
const nextOf = (wd) => addD(NOW, ((wd - NOW.getDay() + 7) % 7) || 7); // strictly after today
const TW = NOW.getDay() === 1 ? 3 : 1; const T = nextOf(TW); const TD = DN[TW]; // target tab: Mon (Wed when today is Mon)
const TISO = iso(T); const TSHORT = `${MN[T.getMonth()].slice(0, 3)} ${T.getDate()}`; const TLONG = `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][TW]}, ${MN[T.getMonth()]} ${T.getDate()}`;
const NM = nextOf(1); const NMISO = iso(NM); const NMSHORT = `${MN[NM.getMonth()].slice(0, 3)} ${NM.getDate()}`;
const shot = async (p, name) => { const f = `${S}${TAG}-${name}.png`; await p.screenshot({ path: f }); console.log('  shot', f); };
(async () => {
  const email = `zztest-daytabs-${Date.now()}@example.com`; const uid = await seedUser(email, 'Dana ZZTEST');
  if (uid === 'dsDDbr945rawMAUKKpIAJcnPYrX2') throw new Error('forbidden');
  for (const d of H.WEEK) await db.doc(`weeklyRoutines/${uid}_${d}`).set({ tasks: [] });
  await db.doc(`weeklyRoutines/${uid}_${todayName()}`).set({ tasks: [{ title: 'ZZTEST today task', completed: false, minutes: 20, points: 10, createdAt: new Date().toISOString() }] });
  await db.doc(`weeklyRoutines/${uid}_${TD}`).set({ tasks: [
    { title: 'ZZTEST stale leftover', completed: false, minutes: 20, createdAt: addD(T, -7).toISOString() },
    { title: 'ZZTEST weekly', completed: false, minutes: 20, type: 'recurring', repeatDays: [TD], createdAt: addD(T, -35).toISOString() }] });
  const br = await H.chromium.launch(); const p = await newPage(br, { label: 'daytabs', init: INIT });
  await emailLogin(p, email); await sleep(4000);
  const clear = async () => { for (let i = 0; i < 5; i++) { const b = p.locator('.bb-x, .dsp-skip, .drama button'); if (await b.count()) { await b.first().click({ timeout: 2000 }).catch(() => {}); await sleep(600); } } };
  await clear(); await shot(p, '1-home-tabs');
  const tabs = await p.locator('.day-tab').allInnerTexts(); console.log('  tabs:', tabs.map((t) => t.replace(/\s+/g, ' ')).join(' | '));
  ok(`tabs start at today (${DN[NOW.getDay()]} ${NOW.getDate()})`, new RegExp(`${DN[NOW.getDay()]}\\s*${NOW.getDate()}\\b`, 'i').test(tabs[0] || ''), tabs[0]);
  ok(`${TD} tab shows ${TSHORT}`, tabs.some((t) => new RegExp(`${TD}\\s*${T.getDate()}\\b`, 'i').test(t)));
  await p.locator('.day-tab', { hasText: TD }).first().click(); await sleep(1500); await clear();
  const hdr = await p.locator('body').innerText();
  ok(`header says ${TLONG}`, hdr.toLowerCase().includes(TLONG.toLowerCase()));
  ok(`stale leftover hidden on ${TSHORT}`, !hdr.includes('ZZTEST stale leftover'));
  ok('recurring task still shows', hdr.includes('ZZTEST weekly'));
  await shot(p, '2-target-tab');
  await p.click('[data-test=create-task-fab]'); await sleep(900);
  if (!(await p.locator('#nt-name').isVisible().catch(() => false))) { const c = p.locator('text=/New task|Add a task|One task/i'); if (await c.count()) await c.first().click().catch(() => {}); await sleep(800); }
  await p.fill('#nt-name', 'therapy'); await sleep(300);
  const chip = await p.locator('[data-test=nt-date-chip]').innerText().catch(() => '');
  ok(`date chip prefilled with ${TSHORT}`, chip.includes(TSHORT) || (iso(addD(NOW, 1)) === TISO && /Tomorrow/.test(chip)), chip);
  await shot(p, '3-add-sheet');
  await p.locator('.nt-form button[type=submit]').click(); await sleep(2500); await clear();
  const u = (await db.doc(`users/${uid}`).get()).data() || {};
  const e = ((u.scheduledTasks && u.scheduledTasks.tasks) || u.scheduledTasks || []).find?.((x) => x.title === 'therapy');
  ok(`therapy stored with scheduledDate ${TISO}`, e && e.scheduledDate === TISO, JSON.stringify(e || u.scheduledTasks || null).slice(0, 200));
  const mon = ((await db.doc(`weeklyRoutines/${uid}_${TD}`).get()).data() || {}).tasks || [];
  ok(`therapy NOT written to the ${TD} weekday doc`, !mon.some((t) => t.title === 'therapy'));
  const txt = await p.locator('body').innerText();
  ok(`therapy visible on the ${TD} tab`, txt.includes('therapy'));
  await shot(p, '4-target-after-add');
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
  ok(`'next Monday' hint moves the date to ${NMSHORT} (chip, or the schedule when the hint carries a time)`, c1.includes(NMSHORT) || sd === NMISO || (NOW.getDay() === 0 && (sd === iso(addD(NM, 7)) || c1.includes(`${MN[addD(NM, 7).getMonth()].slice(0, 3)} ${addD(NM, 7).getDate()}`))), c1 || sd);
  await shot(p, '6-next-monday-hint');
  await br.close(); H.summary ? H.summary() : null; process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
