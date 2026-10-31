// B43 e2e: Discipline deadline settle vs the automatic recheck, with a mocked browser clock.
//   (a) 5 tasks done elsewhere (written straight to Firestore) before 21:00, app first opened 21:30 / 23:10 -> counted
//   (b) same device: tap before the deadline counts; a short day (5th task after 21:00) is still missed -> streak 0
//   (c) midnight: counted at 23:58 -> still counted once after 00:01; first open at 00:01 credits a qualifying
//       yesterday once; a short yesterday is settled missed once (one penalty) across reopens
// Emulators only (demo-clingnote), ZZTEST accounts only. Dates are in the past so emulator tokens stay valid.
// Env: EMU_AUTH_PORT, EMU_FS_PORT, WEB_PORT, CHROME, ONLY.
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FP}`; process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AP}`;
const { chromium } = require('playwright-core'); const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-clingnote' }); const db = admin.firestore();
const B = `http://localhost:${process.env.WEB_PORT || 8099}`; const FORBIDDEN = 'dsDDbr945rawMAUKKpIAJcnPYrX2';
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const results = [];
const ok = (n, c, x = '') => { results.push({ n, c: !!c }); console.log(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`); };
const ymd = (d) => d.toLocaleDateString('en-CA'); const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
const at = (ds, hh, mm = 0, ss = 0) => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d, hh, mm, ss); };
const wk = (ds) => WEEK[new Date(`${ds}T12:00:00`).getDay()];
// D = three days ago (local), so every mocked time is before the real clock.
const D = addDays(ymd(new Date()), -3); const DM1 = addDays(D, -1); const D1 = addDays(D, 1);
async function seedUser(email, name) {
  if (!/^zztest/i.test(email)) throw new Error('ZZTEST only');
  try { const o = await admin.auth().getUserByEmail(email); await admin.auth().deleteUser(o.uid); } catch (e) { /* none */ }
  const u = await admin.auth().createUser({ email, password: 'zztest-pass-123', displayName: name }); if (u.uid === FORBIDDEN) throw new Error('forbidden uid');
  await db.doc(`users/${u.uid}`).set({ uid: u.uid, name, email, onboardingComplete: true, paywallSeenAt: new Date(), isPro: false, plan: 'free' });
  await db.doc(`publicProfiles/${u.uid}`).set({ name });
  for (const w of WEEK) await db.doc(`weeklyRoutines/${u.uid}_${w}`).delete().catch(() => {});
  return u.uid;
}
// tasks done elsewhere: completedAt written directly; day started 08:00 on `day`; deadline 21:00; settled through day-1
async function seedDay(uid, day, { done = [], open = 1, streak = 2, counted = null } = {}) {
  const tasks = done.map(([hh, mm], i) => ({ title: `ZZTEST done ${i}`, completed: true, completedAt: at(day, hh, mm).toISOString(), createdAt: `zz-${i}` }));
  for (let i = 0; i < open; i++) tasks.push({ title: `ZZTEST open ${i}`, completed: false, createdAt: `zz-open-${i}` });
  await db.doc(`weeklyRoutines/${uid}_${wk(day)}`).set({ tasks });
  await db.doc(`userSettings/${uid}`).set({ discipline: { enabled: true, deadline: '21:00', enabledOn: addDays(day, -20), strict: true },
    daySessions: { [day]: { started: true, ended: false, startTime: admin.firestore.Timestamp.fromDate(at(day, 8)), endTime: null } } }, { merge: true });
  await db.doc(`discipline/${uid}`).set({ lastSettled: addDays(day, -1), log: [], lossPending: null });
  const prev = addDays(day, -1);
  await db.doc(`streaks/${uid}`).set({ streak, bestStreak: streak, lastCompletionDate: prev, counted: counted || [prev] });
}
async function open(br, email, time) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.clock.install({ time });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); localStorage.setItem('cn_community_eula_v1', '1'); });
  await ctx.route('**/.netlify/functions/**', (r) => r.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept()); p.errs = [];
  p.on('pageerror', (e) => { if (!/OneSignal|SDK already initialized/.test(e.message + (e.stack || ''))) p.errs.push(e.message); });
  await p.goto(B + '/login?returning=1', { waitUntil: 'load' }); await p.click('[data-test=email-toggle]');
  await p.fill('[data-test=login-email]', email); await p.fill('input[autocomplete=current-password]', 'zztest-pass-123'); await p.click('[data-test=email-login]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await p.goto(B + '/home', { waitUntil: 'load' }); await sleep(3000); await p.reload({ waitUntil: 'load' });
  return p;
}
const streakOf = async (uid) => (await db.doc(`streaks/${uid}`).get()).data() || {};
const discOf = async (uid) => (await db.doc(`discipline/${uid}`).get()).data() || {};
const waitFor = async (fn, ms = 20000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v.ok) return v; await sleep(500); } return v; };
const missedLog = (d, day) => (d.log || []).filter((e) => e && e.type === 'missed-deadline' && e.date === day).length;
const once = (arr, day) => (arr || []).filter((x) => x === day).length === 1;
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ONLY = process.env.ONLY || 'a2130,a2310,bshort,btap,cmid,cyday,cshort'; const on = (k) => ONLY.split(',').includes(k);
  const five = [[19, 1], [19, 2], [19, 3], [19, 4], [19, 5]];
  for (const [tag, hh, mm] of [['a2130', 21, 30], ['a2310', 23, 10]]) if (on(tag)) {
    const email = `zztest.b43.${tag}@example.com`; const uid = await seedUser(email, `ZZTEST ${tag}`);
    await seedDay(uid, D, { done: five });
    const p = await open(br, email, at(D, hh, mm));
    const v = await waitFor(async () => { const s = await streakOf(uid); return { ok: s.lastCompletionDate === D, s }; });
    const d = await discOf(uid);
    ok(`(a) done elsewhere before 21:00, opened ${hh}:${mm}: day counted, streak 2 -> 3`, v.s.streak === 3 && v.s.lastCompletionDate === D && once(v.s.counted, D), JSON.stringify({ s: v.s.streak, l: v.s.lastCompletionDate }));
    ok(`(a) ${hh}:${mm}: no missed-deadline penalty, no loss screen`, missedLog(d, D) === 0 && !d.lossPending, JSON.stringify({ log: (d.log || []).map((e) => e.type), lp: d.lossPending || null }));
    ok(`(a) ${hh}:${mm}: no page errors`, p.errs.length === 0, p.errs.join(' | ')); await p.context().close();
  }
  if (on('bshort')) { // same device rules unchanged: 4 before + 1 after the deadline -> missed, streak broken
    const email = 'zztest.b43.bshort@example.com'; const uid = await seedUser(email, 'ZZTEST bshort');
    await seedDay(uid, D, { done: [[19, 1], [19, 2], [19, 3], [19, 4], [21, 10]] });
    const p = await open(br, email, at(D, 21, 30));
    const v = await waitFor(async () => { const d = await discOf(uid); return { ok: d.lastSettled === D, d }; });
    const s = await streakOf(uid);
    ok('(b) 5th task after 21:00: day not counted, settled missed, streak 0', s.streak === 0 && s.lastCompletionDate === DM1 && missedLog(v.d, D) === 1, JSON.stringify({ s: s.streak, l: s.lastCompletionDate, m: missedLog(v.d, D) }));
    await p.context().close();
  }
  if (on('btap')) { // same device: the 5th tap before 21:00 counts the day immediately
    const email = 'zztest.b43.btap@example.com'; const uid = await seedUser(email, 'ZZTEST btap');
    await seedDay(uid, D, { done: [[19, 1], [19, 2], [19, 3], [19, 4]], open: 2 });
    await db.doc(`streaks/${uid}`).set({ dayDate: D, dayDone: ['zz-0|ZZTEST done 0', 'zz-1|ZZTEST done 1', 'zz-2|ZZTEST done 2', 'zz-3|ZZTEST done 3'] }, { merge: true });
    const p = await open(br, email, at(D, 20, 30)); await sleep(4000);
    for (let i = 0; i < 3; i++) { const b = p.locator('[data-test=boss-briefing] .bb-x, .drama button, button:has-text("Not now"), button:has-text("Maybe later")'); if (await b.count()) await b.first().click({ timeout: 1500 }).catch(() => {}); await sleep(300); }
    const before = await streakOf(uid);
    const chk = p.locator("xpath=//*[contains(text(),'ZZTEST open 0')]/ancestor::*[.//button[@data-test='task-check']][1]//button[@data-test='task-check']").first();
    await chk.scrollIntoViewIfNeeded().catch(() => {}); await chk.click({ timeout: 8000 }).catch((e) => console.log('tap failed', e.message));
    const v = await waitFor(async () => { const s = await streakOf(uid); return { ok: s.lastCompletionDate === D, s }; }, 15000);
    ok('(b) same device: not counted before the tap (4/5)', before.lastCompletionDate === DM1, before.lastCompletionDate);
    ok('(b) same device: 5th tap at 20:30 counts the day, streak 3', v.s.streak === 3 && v.s.lastCompletionDate === D, JSON.stringify({ s: v.s.streak, l: v.s.lastCompletionDate }));
    await p.context().close();
  }
  if (on('cmid')) { // counted at 23:58, clock runs past midnight: counted once, no penalty for D, D+1 starts empty
    const email = 'zztest.b43.cmid@example.com'; const uid = await seedUser(email, 'ZZTEST cmid');
    await seedDay(uid, D, { done: five });
    const p = await open(br, email, at(D, 23, 58));
    const v = await waitFor(async () => { const s = await streakOf(uid); return { ok: s.lastCompletionDate === D, s }; });
    ok('(c) 23:58: day counted (streak 3)', v.s.streak === 3, JSON.stringify({ s: v.s.streak, l: v.s.lastCompletionDate }));
    await p.clock.fastForward('03:00'); await sleep(8000); await p.clock.fastForward('01:05'); await sleep(6000);
    const now = await p.evaluate(() => new Date().toLocaleString('en-CA'));
    const s = await streakOf(uid); const d = await discOf(uid);
    ok('(c) after 00:01: still streak 3, D counted once, no penalty', s.streak === 3 && s.lastCompletionDate === D && once(s.counted, D) && missedLog(d, D) === 0, JSON.stringify({ now, s: s.streak, l: s.lastCompletionDate, c: s.counted, m: missedLog(d, D) }));
    await p.context().close();
    const p2 = await open(br, email, at(D1, 0, 3)); await sleep(8000);
    const s2 = await streakOf(uid); const d2 = await discOf(uid);
    ok('(c) reopen 00:03: no double count, no penalty', s2.streak === 3 && once(s2.counted, D) && missedLog(d2, D) === 0 && !d2.lossPending, JSON.stringify({ s: s2.streak, c: s2.counted, m: missedLog(d2, D) }));
    await p2.context().close();
  }
  if (on('cyday')) { // yesterday done elsewhere before 21:00, never opened that day; first open at 00:01 -> credited once
    const email = 'zztest.b43.cyday@example.com'; const uid = await seedUser(email, 'ZZTEST cyday');
    await seedDay(uid, D, { done: five });
    const p = await open(br, email, at(D1, 0, 1));
    const v = await waitFor(async () => { const d = await discOf(uid); return { ok: d.lastSettled === D, d }; });
    const s = await streakOf(uid);
    ok('(c) first open 00:01: yesterday credited, streak 3, no penalty', s.streak === 3 && s.lastCompletionDate === D && once(s.counted, D) && missedLog(v.d, D) === 0 && !v.d.lossPending, JSON.stringify({ s: s.streak, l: s.lastCompletionDate, m: missedLog(v.d, D) }));
    await p.context().close();
    const p2 = await open(br, email, at(D1, 0, 4)); await sleep(8000);
    const s2 = await streakOf(uid);
    ok('(c) reopen 00:04: still 3, counted once', s2.streak === 3 && once(s2.counted, D), JSON.stringify({ s: s2.streak, c: s2.counted }));
    await p2.context().close();
  }
  if (on('cshort')) { // short yesterday (3 done): first open 00:01 settles it missed once; a reopen adds no 2nd penalty
    const email = 'zztest.b43.cshort@example.com'; const uid = await seedUser(email, 'ZZTEST cshort');
    await seedDay(uid, D, { done: five.slice(0, 3) });
    const p = await open(br, email, at(D1, 0, 1));
    const v = await waitFor(async () => { const d = await discOf(uid); return { ok: d.lastSettled === D, d }; });
    const s = await streakOf(uid);
    ok('(c) short yesterday: settled missed at 00:01, streak 0, one penalty', s.streak === 0 && missedLog(v.d, D) === 1, JSON.stringify({ s: s.streak, m: missedLog(v.d, D) }));
    await p.context().close();
    const p2 = await open(br, email, at(D1, 0, 4)); await sleep(8000);
    const d2 = await discOf(uid);
    ok('(c) reopen 00:04: still one penalty for yesterday', missedLog(d2, D) === 1, String(missedLog(d2, D)));
    await p2.context().close();
  }
  await br.close(); const fail = results.filter((r) => !r.c); console.log(`${results.length - fail.length}/${results.length} passed`); process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
