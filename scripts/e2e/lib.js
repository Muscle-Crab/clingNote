// Local-only harness shared by whats-next.e2e.js (and future suites): Firebase emulators (demo-clingnote), an emulator-mode dist served on WEB_PORT.
// Same defaults as manager-pal.e2e.js: EMU_AUTH_PORT 9099, EMU_FS_PORT 8085, WEB_PORT 8099. ZZTEST users only; the production owner uid is refused.
const AP = process.env.EMU_AUTH_PORT || 9099, FP = process.env.EMU_FS_PORT || 8085;
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${FP}`; process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${AP}`;
for (const k of ['FIREBASE_SERVICE_ACCOUNT', 'GOOGLE_APPLICATION_CREDENTIALS_BASE64', 'GOOGLE_APPLICATION_CREDENTIALS_BASE', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_SECRET_KEY_LIVE']) delete process.env[k];
const R = process.env.REPO || require('path').resolve(__dirname, '../..');
let PW; try { PW = require('playwright'); } catch (e) { PW = require('playwright-core'); }
const BR = process.env.BR || 'chromium'; const chromium = { launch: (o = {}) => PW[BR].launch(BR === 'chromium' && process.env.CHROME ? { executablePath: process.env.CHROME } : {}) };
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-clingnote' });
const db = admin.firestore();
const B = process.env.BASE || `http://localhost:${process.env.WEB_PORT || 8099}`; const TZ = 'America/New_York';
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); return !!cond; };
const FORBIDDEN = 'dsDDbr945rawMAUKKpIAJcnPYrX2';
async function seedUser(email, name, extra = {}) {
  if (!/^zztest/i.test(email)) throw new Error('ZZTEST only');
  try { const o = await admin.auth().getUserByEmail(email); await admin.auth().deleteUser(o.uid); } catch (e) { /* none */ }
  const u = await admin.auth().createUser({ email, password: 'zztest-pass-123', displayName: name });
  if (u.uid === FORBIDDEN) throw new Error('forbidden uid');
  await db.doc(`users/${u.uid}`).set({ uid: u.uid, name, email, onboardingComplete: true, paywallSeenAt: new Date(), isPro: false, plan: 'free', ...extra });
  await db.doc(`publicProfiles/${u.uid}`).set({ name });
  return u.uid;
}
const todayName = () => WEEK[(new Date().getDay() + 6) % 7];
async function idTokenFor(uid) {
  const ct = await admin.auth().createCustomToken(uid);
  const r = await fetch(`http://127.0.0.1:${AP}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) });
  return (await r.json()).idToken;
}
const ehFn = (deps = {}) => { const { handler } = require(R + '/netlify/functions/eight-hour-day'); const Ts = admin.firestore.Timestamp;
  return (body, headers) => handler({ httpMethod: 'POST', headers, body }, {}, { verify: (t) => admin.auth().verifyIdToken(t), db, ts: (ms) => Ts.fromMillis(ms), serverTime: () => admin.firestore.FieldValue.serverTimestamp(), apiKey: undefined, ...deps }); };
async function newPage(br, { label = 'p', routes = {}, init } = {}) {
  const dev = BR === 'webkit' ? { ...PW.devices['iPhone 15'] } : { deviceScaleFactor: 3, isMobile: true, hasTouch: true }; const ctx = await br.newContext({ ...dev, viewport: { width: 393, height: 852 }, timezoneId: TZ });
  await ctx.route(/onesignal|googletagmanager|google-analytics|googlesyndication/, (r) => r.abort());
  if (BR === 'webkit') await ctx.route((u) => u.protocol === 'https:' && /jsdelivr|cdnjs|fonts\.g|gstatic|icons8|apis\.google/.test(u.host), async (route) => { try { const r = await fetch(route.request().url(), { headers: { 'user-agent': 'Mozilla/5.0' } }); const h = Object.fromEntries(r.headers); delete h['content-encoding']; delete h['content-length']; return route.fulfill({ status: r.status, headers: h, body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { return route.abort(); } });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { const v = g.call(this, k); return (v == null && String(k).startsWith('cn.coach.')) ? JSON.stringify({ done: [], off: true }) : v; }; }); // coach lessons off
  if (init) await ctx.addInitScript(init);
  const fn = ehFn();
  await ctx.route('**/.netlify/functions/**', async (route) => {
    const req = route.request(); const name = new URL(req.url()).pathname.split('/').pop();
    if (routes[name]) return routes[name](route, req);
    if (name === 'eight-hour-day') { const r = await fn(req.postData(), { authorization: req.headers().authorization }); return route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body }); }
    return route.fulfill({ status: 200, json: {} });
  });
  const p = await ctx.newPage(); p.on('dialog', (d) => { p.dialogs = (p.dialogs || []).concat(d.message()); d.accept(); });
  p.errs = []; p.on('pageerror', (e) => { p.errs.push(e.message); console.log(`[${label} pageerror]`, e.message); });
  p.on('console', (m) => { if (m.type() === 'warning' && process.env.WARN) console.log('[warn]', m.text()); if (m.type() === 'error') (p.cerrs = p.cerrs || []).push(m.text()); });
  return p;
}
async function emailLogin(p, email) {
  await p.goto(B + '/login?returning=1', { waitUntil: 'load' });
  await p.click('[data-test=email-toggle]');
  await p.fill('[data-test=login-email]', email); await p.fill('input[autocomplete=current-password]', 'zztest-pass-123');
  await p.click('[data-test=email-login]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}
const closeBriefing = async (p) => { await p.locator('[data-test=boss-briefing] .bb-x').click({ timeout: 2500 }).catch(() => {}); };
try { require('fs').mkdirSync('/workspace/plan-shots/next', { recursive: true }); } catch (e) { /* optional */ }
module.exports = { chromium, admin, db, B, TZ, WEEK, sleep, ok, results, seedUser, todayName, idTokenFor, ehFn, newPage, emailLogin, closeBriefing, SHOTS: '/workspace/plan-shots/next/' + BR + '-', BR, PW };
