// Coach game plan e2e (Coach/strict mode only): one compact row on Home (focus / break / work / closed), Settings game plan
// (first save applies, later schedule edits wait for the weekly review), size chips S/M/L (10/20/40, points on completion),
// nothing earned after the hard close, close picker (picked leftovers to tomorrow, rest stays, no penalty), weekly review,
// goal reason + revoke penalty in the morning report, checklist gate + friend unlock link (function + public page, approve/deny).
// Emulators only (demo-clingnote), ZZTEST accounts only. Env: EMU_AUTH_PORT, EMU_FS_PORT, WEB_PORT, CHROME, SHOTS, TAG (before|after), ONLY.
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FP}`; process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AP}`;
const { chromium } = require('playwright-core'); const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-clingnote' }); const db = admin.firestore();
const { rawHandler } = require('../../netlify/functions/friend-unlock');
const B = `http://localhost:${process.env.WEB_PORT || 8099}`; const FORBIDDEN = 'dsDDbr945rawMAUKKpIAJcnPYrX2';
const SHOTS = (process.env.SHOTS || '/workspace/plan-shots/gameplan') + '/'; const TAG = process.env.TAG || 'after'; const AFTER = TAG === 'after';
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const results = [];
const ok = (n, c, x = '') => { results.push({ n, c: !!c }); console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${c ? '' : x}`); };
const ymd = (d = new Date()) => d.toLocaleDateString('en-CA'); const dayName = (d = new Date()) => WEEK[d.getDay()];
const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ago = (min) => hhmm(Date.now() - min * 60000);
const tmrw = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; };
async function seedUser(email, name, tasks = [], extra = {}) {
  if (!/^zztest/i.test(email)) throw new Error('ZZTEST only');
  try { const o = await admin.auth().getUserByEmail(email); await admin.auth().deleteUser(o.uid); } catch (e) { /* none */ }
  const u = await admin.auth().createUser({ email, password: 'zztest-pass-123', displayName: name }); if (u.uid === FORBIDDEN) throw new Error('forbidden uid');
  await db.doc(`users/${u.uid}`).set({ uid: u.uid, name, email, onboardingComplete: true, paywallSeenAt: new Date(), isPro: false, plan: 'free', aiConsent: true, aiConsentVersion: 2, bossMode: 'strict', ...extra });
  await db.doc(`publicProfiles/${u.uid}`).set({ name });
  for (const w of WEEK) await db.doc(`weeklyRoutines/${u.uid}_${w}`).delete().catch(() => {});
  await db.doc(`weeklyRoutines/${u.uid}_${dayName()}`).set({ tasks });
  await db.doc(`userSettings/${u.uid}`).set({ daySessions: { [ymd()]: { started: true, ended: false, startTime: admin.firestore.Timestamp.fromMillis(Date.now() - 3600e3), endTime: null } } }, { merge: true });
  return u.uid;
}
const fnRoute = async (route) => { const q = route.request(); const url = new URL(q.url());
  const r = await rawHandler({ httpMethod: q.method(), headers: q.headers(), body: q.postData() || '', queryStringParameters: Object.fromEntries(url.searchParams) }, {}, { db, verify: (t) => admin.auth().verifyIdToken(t) });
  route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body }); };
async function page(br) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn_community_eula_v1', '1'); });
  await ctx.route('**/.netlify/functions/**', (r) => (/friend-unlock/.test(r.request().url()) ? fnRoute(r) : r.fulfill({ status: 200, json: {} })));
  const pg = await ctx.newPage(); pg.errs = []; pg.on('dialog', (d) => d.accept());
  pg.on('console', (m) => process.env.GP_DEBUG && /warn|error/.test(m.type()) && console.log('CONSOLE', m.text().slice(0, 300))); pg.on('pageerror', (e) => !/SDK already initialized/.test(String(e)) && pg.errs.push(String(e).slice(0, 200)));
  return pg;
}
const dd = async (p) => { for (let i = 0; i < 3; i++) { const b = p.locator('[data-test=boss-briefing] .bb-x, .drama button, .drama-btn, .dsp-skip, button:has-text("Not now"), button:has-text("Maybe later")'); if (await b.count()) { await b.first().click({ timeout: 1500 }).catch(() => {}); await sleep(400); } } };
async function login(p, email) {
  await p.goto(B + '/login?returning=1', { waitUntil: 'load' }); await p.click('[data-test=email-toggle]');
  await p.fill('[data-test=login-email]', email); await p.fill('input[autocomplete=current-password]', 'zztest-pass-123'); await p.click('[data-test=email-login]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3000); await p.reload({ waitUntil: 'load' }); await sleep(2500); await dd(p);
}
const home = async (p) => { await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3500); await dd(p); };
const user = async (uid) => (await db.doc(`users/${uid}`).get()).data() || {};
const tasksOf = async (uid, d = dayName()) => ((await db.doc(`weeklyRoutines/${uid}_${d}`).get()).data() || {}).tasks || [];
const waitFor = async (f, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(400); } return false; };
const rowText = (p) => p.locator('[data-test=gp-text]').innerText().catch(() => '');
const openRow = async (p) => { if ((await p.locator('[data-test=gp-toggle]').getAttribute('aria-expanded').catch(() => '')) !== 'true') await p.click('[data-test=gp-toggle]'); await sleep(400); };
const shot = (p, name, sel) => (sel ? p.locator(sel).first().screenshot({ path: SHOTS + `${TAG}-${name}.png` }) : p.screenshot({ path: SHOTS + `${TAG}-${name}.png` })).catch((e) => console.log('shot failed', name, String(e).slice(0, 120)));
const mk = (title, i, extra = {}) => ({ title: 'ZZTEST ' + title, completed: false, createdAt: `zz-gp-${i}`, estimateMin: 45, points: 20, ...extra });
const lastSunday = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return ymd(d); };

(async () => {
  const ON = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const fresh = (dayStart, more = {}) => ({ gamePlan: { dayStart, reviewDow: 0, reviewTime: '18:00', minGoal: 50, friend: { name: 'ZZTEST Sam' }, pending: null, lastReview: lastSunday(), ...more } });

  if (ON('settings')) { const email = 'zztest.gp.settings@example.com'; const uid = await seedUser(email, 'ZZTEST GP Settings');
    const p = await page(br); await login(p, email); await p.goto(B + '/profile/' + uid, { waitUntil: 'load' }); await sleep(3000); await dd(p);
    await shot(p, 'settings-coach-row', '[data-test=boss-mode-row]');
    if (AFTER) {
      ok('settings: one tappable game plan line inside the Coach mode row', await p.locator('[data-test=boss-mode-row] [data-test=gp-settings]').count() === 1);
      await p.click('[data-test=gp-settings]'); await sleep(500);
      await p.fill('[data-test=gp-daystart]', '07:30'); await p.fill('[data-test=gp-friend]', 'ZZTEST Sam'); await p.click('[data-test=gp-save]'); await sleep(1500);
      let g = (await user(uid)).gamePlan || {};
      ok('settings: first save applies now (day start 07:30, friend saved)', g.dayStart === '07:30' && g.friend && g.friend.name === 'ZZTEST Sam' && !g.pending, JSON.stringify(g));
      await p.fill('[data-test=gp-daystart]', '06:00'); await p.fill('[data-test=gp-mingoal]', '70'); await p.click('[data-test=gp-save]'); await sleep(1500);
      g = (await user(uid)).gamePlan || {};
      ok('settings: later schedule edits are queued for the weekly review', g.dayStart === '07:30' && g.pending && g.pending.dayStart === '06:00' && g.pending.minGoal === 70, JSON.stringify(g));
      ok('settings: message says it applies at the review', /review/i.test(await p.locator('[data-test=gp-msg]').innerText()));
      await shot(p, 'settings-gameplan-open', '[data-test=boss-mode-row]');
      await p.click('[data-test=boss-simple]'); await sleep(1000);
      ok('settings: game plan line hidden in Simple mode', await p.locator('[data-test=gp-settings]').count() === 0);
    }
    ok('settings: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }

  if (ON('focus')) { const email = 'zztest.gp.focus@example.com';
    const tasks = [mk('Write report', 1), mk('Quick email', 2, { estimateMin: 15 }), mk('Deep refactor', 3, { estimateMin: 120 })];
    const uid = await seedUser(email, 'ZZTEST GP Focus', tasks, fresh(ago(10)));
    const p = await page(br); await login(p, email); await home(p);
    await shot(p, 'home-focus');
    if (AFTER) {
      ok('focus: row shows Focus 1/2 with minutes left', /Focus 1\/2/.test(await rowText(p)) && (await p.locator('[data-test=gp-row]').getAttribute('data-phase')) === 'focus', await rowText(p));
      ok('focus: coach banner is quiet during focus', await p.locator('[data-test=boss-panel]').count() === 0);
      ok('focus: one row only (no new card)', await p.locator('[data-test=gp-row]').count() === 1);
      await db.doc(`users/${uid}`).set(fresh(ago(55)), { merge: true }); await home(p);
      ok('break: automatic 10 min break after focus 1', /Break/.test(await rowText(p)) && (await p.locator('[data-test=gp-row]').getAttribute('data-phase')) === 'break', await rowText(p));
      await shot(p, 'home-break', '[data-test=gp-row]');
      await db.doc(`users/${uid}`).set(fresh(ago(65)), { merge: true }); await home(p);
      ok('focus: Focus 2/2 after the break', /Focus 2\/2/.test(await rowText(p)), await rowText(p));
      await db.doc(`users/${uid}`).set(fresh(ago(180)), { merge: true }); await home(p);
      ok('work: after both focus sessions the row shows the work phase', (await p.locator('[data-test=gp-row]').getAttribute('data-phase')) === 'work', await rowText(p));
      // sizes: AI guess from the estimate, user can change it
      await p.locator('.task-title', { hasText: 'ZZTEST Quick email' }).first().click(); await sleep(900);
      ok('size: chips in the existing estimate hint, AI guess S for 15 min', await p.locator('[data-test=size-s][aria-pressed=true]').count() === 1 && /AI guess/.test(await p.locator('[data-test=size-edit]').innerText()));
      await shot(p, 'task-size-chips', '[data-test=edit-panel]');
      await p.click('[data-test=size-l]'); await sleep(1500);
      const t2 = (await tasksOf(uid)).find((t) => t.title === 'ZZTEST Quick email');
      ok('size: user pick saved (L)', t2 && t2.size === 'l', JSON.stringify(t2 && t2.size));
      ok('size: hint says set by you', /set by you/.test(await p.locator('[data-test=size-edit]').innerText().catch(() => '')));
      await home(p);
      const card = p.locator('[data-test=task-check]').first(); await card.click(); await sleep(2500);
      const log = ((await user(uid)).gpLog || {})[ymd()] || {};
      ok('points: completing a task earns its size points (M 20 or L 40)', [20, 40].includes(log.earned), JSON.stringify(log));
      ok('points: goal stored for the day', log.goal >= 50, JSON.stringify(log));
    }
    ok('focus: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }

  if (ON('close')) { const email = 'zztest.gp.close@example.com';
    const tasks = [mk('Done before close', 1, { completed: true, completedAt: Date.now() - 9 * 3600e3, size: 's' }), mk('Done after close', 2, { completed: true, completedAt: Date.now() - 60000, size: 'l' }),
      mk('Leftover A', 3), mk('Leftover B', 4), mk('Leftover C', 5)];
    const uid = await seedUser(email, 'ZZTEST GP Close', tasks, fresh(ago(8 * 60 + 5)));
    if (AFTER) await db.doc(`weeklyRoutines/${uid}_${dayName(tmrw())}`).set({ tasks: [mk('Leftover C', 9)] });
    const p = await page(br); await login(p, email); await home(p);
    await shot(p, 'home-closed');
    if (AFTER) {
      ok('close: day closed 8 h after the start', (await p.locator('[data-test=gp-row]').getAttribute('data-phase')) === 'closed', await rowText(p));
      await openRow(p);
      ok('close: work after close earns nothing (+40 not counted)', /\+40 pts finished after close are not counted/.test(await p.locator('[data-test=gp-after]').innerText().catch(() => '')));
      await sleep(1500); const log = ((await user(uid)).gpLog || {})[ymd()] || {};
      ok('close: only the S before close counts (10)', log.earned === 10, JSON.stringify(log));
      ok('close: picker lists the 3 open leftovers, none picked', await p.locator('[data-test=gp-carry-pick]').count() === 3 && await p.locator('[data-test=gp-carry-pick]:checked').count() === 0);
      ok('close: planning stays allowed after close (add button present)', await p.locator('[data-test=create-task-fab], .fab-add, [data-test=easy-add]').count() > 0);
      await shot(p, 'close-picker', '[data-test=gp-row]');
      const picks = p.locator('[data-test=gp-carry-pick]'); await picks.nth(0).check(); await picks.nth(2).check(); await p.click('[data-test=gp-carry]'); await sleep(2500);
      const tm = (await tasksOf(uid, dayName(tmrw()))).map((t) => t.title); const td = (await tasksOf(uid)).map((t) => t.title);
      ok('close: picked go to tomorrow (deduped by title)', tm.filter((x) => x === 'ZZTEST Leftover A').length === 1 && tm.filter((x) => x === 'ZZTEST Leftover C').length === 1, JSON.stringify(tm));
      ok('close: unpicked stays today, nothing automatic', td.includes('ZZTEST Leftover B') && !tm.includes('ZZTEST Leftover B'), JSON.stringify(td));
      ok('close: no penalty for leftovers', !((await user(uid)).gpPenalty));
    }
    ok('close: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }

  if (ON('review') && AFTER) { const email = 'zztest.gp.review@example.com'; const log = {};
    for (let i = 1; i <= 14; i++) { const d = new Date(); d.setDate(d.getDate() - i); log[ymd(d)] = { earned: 100, goal: 80 }; }
    const queued = ago(170); const uid = await seedUser(email, 'ZZTEST GP Review', [mk('Task', 1)], { ...fresh(ago(180), { lastReview: '2000-01-02', pending: { dayStart: queued } }), gpLog: log });
    const p = await page(br); await login(p, email); await home(p);
    ok('review: due -> attention dot on the row', await p.locator('[data-test=gp-attn]').count() === 1);
    await openRow(p);
    ok('review: shows the week results', /goals hit/.test(await p.locator('[data-test=gp-review]').innerText().catch(() => '')));
    ok('review: proposes the queued edit + a raise', await p.locator('[data-test=gp-proposal]').count() >= 2);
    await shot(p, 'weekly-review', '[data-test=gp-row]');
    const props = p.locator('[data-test=gp-proposal]'); for (let i = 0; i < await props.count(); i++) await props.nth(i).check();
    await p.click('[data-test=gp-review-apply]'); await sleep(2000);
    const g = (await user(uid)).gamePlan || {};
    ok('review: queued day start applied, goal raised, review stamped', g.dayStart === queued && !g.pending && g.minGoal === 60 && g.lastReview !== '2000-01-02', JSON.stringify(g));
    ok('review: row no longer asks', await p.locator('[data-test=gp-review]').count() === 0);
    ok('review: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }

  if (ON('morning')) { const email = 'zztest.gp.morning@example.com'; const log = {};
    for (let i = 1; i <= 10; i++) { const d = new Date(); d.setDate(d.getDate() - i); log[ymd(d)] = { earned: 100 }; }
    const tasks = Array.from({ length: 8 }, (_, i) => mk(`Job ${i + 1}`, i)); // 8 x M = 160 planned
    const uid = await seedUser(email, 'ZZTEST GP Morning', tasks, { ...fresh(ago(30)), gpLog: log, gpPenalty: { day: ymd(), points: 25, reason: 'screen-time-revoked', at: Date.now() } });
    const p = await page(br); await login(p, email);
    await p.evaluate((u) => localStorage.removeItem(`morningReport_${u}`), uid); await home(p);
    await p.click('.hero-menu-btn').catch(() => {}); await sleep(800);
    await shot(p, 'morning-report', 'section.mr');
    if (AFTER) {
      ok('goal: 90% of the 2-week median (100 -> 90), under the 160 planned', /90 pts/.test(await p.locator('[data-test=mr-goal]').innerText().catch(() => '')), await p.locator('[data-test=mr-goal]').innerText().catch(() => ''));
      ok('goal: reason shown', /median/i.test(await p.locator('[data-test=mr-goal-why]').innerText().catch(() => '')));
      ok('revoke: penalty shown in the report', /25/.test(await p.locator('[data-test=mr-penalty]').innerText().catch(() => '')));
      await p.keyboard.press('Escape').catch(() => {}); await home(p); await openRow(p);
      ok('revoke: penalty shown in the row', /−25 pts/.test(await p.locator('[data-test=gp-penalty]').innerText().catch(() => '')));
    }
    ok('morning: no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }

  if (ON('unlock') && AFTER) { const email = 'zztest.gp.unlock@example.com';
    const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); })();
    const tpl = { id: 'zzMorning', title: 'ZZTEST Morning stretch', userId: '', status: 'todo', priority: 'low', labels: [], notes: '', scheduledTime: '', startDate: monday, recurrence: { freq: 'daily' }, generated: [], skip: [] };
    const uid = await seedUser(email, 'ZZTEST GP Owner', [mk('Task', 1)], { ...fresh(ago(180)), scheduledTasks: { tasks: [{ ...tpl }] } });
    const p = await page(br); await login(p, email); await home(p); await openRow(p);
    ok('gate: checklist not done -> apps stay locked', await p.locator('[data-test=gp-gate]').count() === 1 && /Checklist first/.test(await rowText(p)), await rowText(p));
    await shot(p, 'unlock-gate', '[data-test=gp-row]');
    await p.click('[data-test=gp-ask-10]'); await sleep(2500);
    const u = await p.evaluate(() => JSON.parse(localStorage.getItem('cn.gp.unlock') || '{}'));
    ok('unlock: request created, link to the website page', u.status === 'pending' && /\/friend-unlock\.html\?t=/.test(u.url || ''), JSON.stringify(u));
    const reqs = (await db.collection('unlockRequests').where('uid', '==', uid).get()).docs.map((d) => d.data());
    ok('unlock: Firestore record (pending, 10 min, friend + owner name, no raw token)', reqs.length === 1 && reqs[0].status === 'pending' && reqs[0].minutes === 10 && reqs[0].friendName === 'ZZTEST Sam' && reqs[0].ownerName === 'ZZTEST GP Owner' && !JSON.stringify(reqs[0]).includes(u.token));
    ok('unlock: row shows waiting for the friend', await p.locator('[data-test=gp-pending]').count() === 1);
    await shot(p, 'unlock-pending', '[data-test=gp-row]');
    // the friend opens the link (local copy of the Netlify page)
    const f = await page(br); await f.goto(B + '/friend-unlock.html?t=' + encodeURIComponent(u.token), { waitUntil: 'load' }); await sleep(2000);
    ok('friend page: shows who asks and for how long', /ZZTEST GP Owner/.test(await f.innerText('body')) && /10 min/.test(await f.innerText('body')));
    await shot(f, 'friend-page');
    await f.click('[data-test=fu-approve]'); await sleep(1500);
    ok('friend page: approved', (await f.getAttribute('body', 'data-status')) === 'approved');
    await shot(f, 'friend-page-approved');
    { const r2 = await rawHandler({ httpMethod: 'POST', body: JSON.stringify({ token: u.token, action: 'deny' }) }, {}, { db }); const d2 = (await db.collection('unlockRequests').where('uid', '==', uid).get()).docs[0].data();
      ok('friend page: decided once (a later deny does not change it)', JSON.parse(r2.body).status === 'approved' && d2.status === 'approved', r2.body); }
    ok('unlock: app sees approval, then a friction countdown', await waitFor(async () => (await p.locator('[data-test=gp-countdown]').count()) === 1, 15000));
    await shot(p, 'unlock-countdown', '[data-test=gp-row]');
    ok('unlock: opens after the countdown (8 s)', await waitFor(async () => (await p.evaluate(() => JSON.parse(localStorage.getItem('cn.gp.unlock') || '{}').status)) === 'open', 15000));
    // deny path with a fresh request
    await p.evaluate(() => localStorage.removeItem('cn.gp.unlock')); await home(p); await openRow(p);
    await p.click('[data-test=gp-ask-20]'); await sleep(2500); const u2 = await p.evaluate(() => JSON.parse(localStorage.getItem('cn.gp.unlock') || '{}'));
    await f.goto(B + '/friend-unlock.html?t=' + encodeURIComponent(u2.token), { waitUntil: 'load' }); await sleep(1500); await f.click('[data-test=fu-deny]'); await sleep(1500);
    ok('deny: friend page says kept locked', (await f.getAttribute('body', 'data-status')) === 'denied');
    ok('deny: app shows the answer', await waitFor(async () => (await p.locator('[data-test=gp-denied]').count()) === 1, 15000));
    await f.goto(B + '/friend-unlock.html?t=nope', { waitUntil: 'load' }); await sleep(1500);
    ok('unlock: bad token page fails safely (no buttons)', (await f.getAttribute('body', 'data-status')) === 'error' && !(await f.locator('[data-test=fu-approve]').isVisible()));
    ok('unlock: no page errors', p.errs.length === 0 && f.errs.length === 0, [...p.errs, ...f.errs].join(' | ')); await f.context().close(); await p.context().close(); }

  if (ON('simple')) { const email = 'zztest.gp.simple@example.com'; await seedUser(email, 'ZZTEST GP Simple', [mk('Task', 1)], { bossMode: 'simple', ...fresh(ago(10)) });
    const p = await page(br); await login(p, email); await home(p);
    ok('simple: no game plan row in Simple mode (unchanged)', await p.locator('[data-test=gp-row]').count() === 0);
    await p.locator('.task-title').first().click(); await sleep(800);
    ok('simple: no size chips in Simple mode', await p.locator('[data-test=size-edit]').count() === 0);
    await p.context().close(); }

  await br.close(); const pass = results.filter((r) => r.c).length;
  console.log(`gameplan e2e (${TAG}): ${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
