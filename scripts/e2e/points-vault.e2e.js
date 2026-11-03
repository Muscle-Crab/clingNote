const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FP}`; process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AP}`;
const { chromium } = require('playwright-core'); const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-clingnote' }); const db = admin.firestore();
const { rawHandler } = require('../../netlify/functions/friend-unlock');
const B = `http://localhost:${process.env.WEB_PORT || 8099}`; const FORBIDDEN = 'dsDDbr945rawMAUKKpIAJcnPYrX2';
const SHOTS = (process.env.SHOTS || '/workspace/vault-screens') + '/'; const TAG = process.env.TAG || 'after'; const AFTER = TAG === 'after';
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
  await db.doc(`users/${u.uid}`).set({ uid: u.uid, name, email, onboardingComplete: true, paywallSeenAt: new Date(), isPro: true, plan: 'lifetime', aiConsent: true, aiConsentVersion: 2, bossMode: 'strict', ...extra });
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

const FAKE = () => { localStorage.setItem('cn.appLock.on', '1'); const K = 'zz.fakelock'; const rd = () => JSON.parse(localStorage.getItem(K) || '{"locked":true,"until":0,"label":"","scheduled":[],"vault":null}'); const wr = (v) => localStorage.setItem(K, JSON.stringify(v));
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toLocaleDateString('en-CA'); }; const days = {};
  for (let i = 1; i <= 7; i++) days[d(i)] = { a1: 0, a2: 15, a3: 30, a4: 60, a5: 120, a6: 240 };
  window.__clingLockFake = { status: async () => ({ authorization: 'approved', selectionCount: 6, monitoring: rd().locked, ...rd() }), startLock: async ({ untilMs, label }) => { wr({ ...rd(), locked: true, until: untilMs, label }); return { locked: true, monitor: 'ok' }; },
    stopLock: async () => { wr({ ...rd(), locked: false }); return { locked: false }; }, scheduleLock: async () => ({ monitor: 'ok' }), labeledApps: async () => ({ apps: [] }), clearBreakOffer: async () => ({ cleared: true }), cancelScheduledLock: async () => ({ cancelled: true }),
    startUsage: async () => ({ monitor: 'ok' }), vaultUsage: async () => ({ days, apps: [['a1', 'Maps'], ['a2', 'News'], ['a3', 'YouTube'], ['a4', 'Instagram'], ['a5', 'X'], ['a6', 'TikTok']].map(([id, label]) => ({ id, label })) }),
    vaultState: async () => { const v = rd().vault; return v && v.untilMs > Date.now() ? { ids: v.ids, untilMs: v.untilMs, live: true } : { ids: [], untilMs: 0, live: false }; },
    allowVaultApps: async ({ ids, untilMs }) => { wr({ ...rd(), vault: { ids, untilMs } }); return { allowed: ids.length }; }, endVaultApps: async () => { wr({ ...rd(), vault: null }); return { ended: true }; } }; };
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const fresh = { gamePlan: { dayStart: ago(300), reviewDow: 0, reviewTime: '18:00', minGoal: 50, friend: { name: 'ZZTEST Sam' }, pending: null, lastReview: lastSunday() } };
  const done = (t, i) => mk(t, i, { completed: true, completedAt: Date.now() - i * 600000, size: 'l' });
  // main user: 3 done (L = 40 pts each -> 120 pts)
  { const email = 'zztest.vault.main@example.com'; await seedUser(email, 'ZZTEST Vault', [done('Done A', 1), done('Done B', 2), done('Done C', 3), mk('Open task', 4)], fresh);
    const p = await page(br); await p.context().addInitScript(FAKE); await login(p, email); await home(p);
    await shot(p, 'home-gameplan'); await shot(p, 'gameplan-row', '[data-test=gp-row]');
    if (AFTER) {
      const t = await p.locator('[data-test=vault-text]').innerText().catch(() => '');
      ok('vault: one slim line inside the game plan row', await p.locator('[data-test=gp-row] [data-test=vault-toggle]').count() === 1, t);
      ok('vault: 120 pts opens 3 of 6, next at 150', /Vault · 3 of 6 open · next at 150 pts/.test(t), t);
      await shot(p, 'vault-collapsed', '[data-test=gp-row]');
      await p.click('[data-test=vault-toggle]'); await sleep(500);
      const prices = await p.locator('[data-test=vault-app]').allInnerTexts();
      ok('vault: expands to 6 priced apps, cheapest first', prices.length === 6 && /Maps/.test(prices[0]) && /TikTok/.test(prices[5]) && /220/.test(prices[5]), prices.join(' | '));
      ok('vault: time line 60 min from 120 pts', /0 of 60|60 of 60/.test(await p.locator('[data-test=vault-time]').innerText()), await p.locator('[data-test=vault-time]').innerText());
      await shot(p, 'vault-expanded', '[data-test=gp-row]');
      await p.click('[data-test=vault-start]').catch(() => {}); await sleep(1200);
      ok('vault: Use starts app time natively (fake)', !!(await p.evaluate(() => JSON.parse(localStorage.getItem('zz.fakelock')).vault)), '');
      ok('vault: row shows min left', /min left/.test(await p.locator('[data-test=vault-text]').innerText()));
      await shot(p, 'vault-running', '[data-test=gp-row]');
      await p.click('[data-test=vault-stop]').catch(() => {}); await sleep(800);
    }
    await home(p); await p.evaluate(() => window.__bkDemo && window.__bkDemo({ mode: 'popup', min: 20 })); await sleep(1200);
    await shot(p, 'break-popup');
    ok('no page errors', p.errs.length === 0, p.errs.join(' | ')); await p.context().close(); }
  if (AFTER) { const email = 'zztest.vault.gate@example.com'; await seedUser(email, 'ZZTEST Vault Gate', [done('Done A', 1), mk('Open 1', 2), mk('Open 2', 3)], fresh);
    const p = await page(br); await p.context().addInitScript(FAKE); await login(p, email); await home(p);
    ok('gate: needs 2 more tasks', /finish 2 more tasks to open/.test(await p.locator('[data-test=vault-text]').innerText().catch(() => '')));
    await p.click('[data-test=vault-toggle]'); await sleep(500);
    ok('gate: body explains, no app open', await p.locator('[data-test=vault-gate]').count() === 1 && await p.locator('[data-test=vault-app][data-open="1"]').count() === 0);
    await shot(p, 'vault-gate', '[data-test=gp-row]'); await p.context().close(); }
  await br.close(); const f = results.filter((r) => !r.c); console.log(`${results.length - f.length}/${results.length} passed`); process.exit(f.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
