// Local end-to-end run of Manager & Pal against the Firebase emulators (demo-clingnote; cannot reach production).
// Needs: emulators (firebase.e2e.json), scripts/e2e/fn-server.js on :8888, `VUE_APP_FIREBASE_EMULATORS=1 vue-cli-service serve --port 8099`.
// Run: NODE_PATH=<dir with playwright-core + firebase-admin> node scripts/e2e/manager-pal.e2e.js
process.env.GCLOUD_PROJECT = 'demo-clingnote'; process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085'; process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const { chromium } = require('playwright-core');
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-clingnote' });
const db = admin.firestore();
const B = 'http://localhost:8099', FN = 'http://127.0.0.1:8888', SHOTS = process.env.SHOTS || '/workspace/eighthour_shots/';
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond }); console.log(`${cond ? 'ok  ' : 'FAIL'} ${name} ${extra}`); if (!cond) throw new Error('E2E failed: ' + name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

async function seedUser(email, name) {
  const u = await admin.auth().createUser({ email, password: 'zztest-pass-123', displayName: name });
  await db.doc(`users/${u.uid}`).set({ uid: u.uid, name, email, onboardingComplete: true, paywallSeenAt: new Date(), isPro: false, plan: 'free' });
  await db.doc(`publicProfiles/${u.uid}`).set({ name });
  return u.uid;
}
async function seedTasks(uid, prefix) {
  const today = WEEK[(new Date().getDay() + 6) % 7];
  for (const d of WEEK) await db.doc(`weeklyRoutines/${uid}_${d}`).set({ tasks: [] });
  await db.doc(`weeklyRoutines/${uid}_${today}`).set({ tasks: [
    { title: `${prefix} public task`, completed: false, visibility: 'public' },
    { title: `${prefix} legacy task (no field)`, completed: false },
    { title: `${prefix} SECRET private task`, completed: false, visibility: 'private' },
  ] });
  if (today !== 'Monday') await db.doc(`weeklyRoutines/${uid}_Monday`).set({ tasks: [ // past day: overdue
    { title: `${prefix} overdue public task`, completed: false, visibility: 'public' },
    { title: `${prefix} SECRET overdue private task`, completed: false, visibility: 'private' },
  ] });
}
async function newPage(br, label) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('clingnote.tutorialSeen.v1', '1'); });
  // the dev server has no Netlify functions: forward them to the local harness (emulator-backed)
  await ctx.route('**/.netlify/functions/manager-pal**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const r = await fetch(FN + u.pathname + u.search, { method: req.method(), headers: req.headers(), body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() });
    route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
  });
  await ctx.route('**/.netlify/functions/!(manager-pal)**', (route) => route.fulfill({ status: 200, json: {} }));
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
  p.on('pageerror', (e) => console.log(`[${label} pageerror]`, e.message));
  return p;
}
async function emailLogin(p, email) {
  await p.goto(B + '/login?returning=1', { waitUntil: 'load' });
  await p.click('[data-test=email-toggle]');
  await p.fill('[data-test=login-email]', email); await p.fill('input[autocomplete=current-password]', 'zztest-pass-123');
  await p.click('[data-test=email-login]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
}
async function idTokenFor(uid) {
  const ct = await admin.auth().createCustomToken(uid);
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) });
  return (await r.json()).idToken;
}
async function callFn(tok, body) {
  const r = await fetch(FN + '/.netlify/functions/manager-pal', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function resetEmulators() {
  await fetch('http://127.0.0.1:8085/emulator/v1/projects/demo-clingnote/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-clingnote/accounts', { method: 'DELETE' });
}
const shot = (p, n) => p.screenshot({ path: SHOTS + n });
module.exports = { idTokenFor, callFn, db, admin, ok, sleep, seedUser, seedTasks, newPage, emailLogin, shot, B, FN, results };

if (require.main === module) (async () => {
  await resetEmulators();
  const br = await chromium.launch({ executablePath: process.env.CHROME });
  const ownerUid = await seedUser('zztest-owner@example.com', 'Olive ZZTEST');
  const palUid = await seedUser('zztest-pal@example.com', 'Pat ZZTEST');
  await seedTasks(ownerUid, 'Olive'); await seedTasks(palUid, 'Pat');
  const owner = await newPage(br, 'owner');
  await emailLogin(owner, 'zztest-owner@example.com');
  await owner.goto(B + '/pals', { waitUntil: 'load' }); await sleep(2500);
  await owner.fill('[data-test=manager-panel] input', 'Mom');
  await owner.click('[data-test=manager-panel] button.pri');
  const link = (await owner.locator('[data-test=manager-link]').innerText({ timeout: 15000 })).trim();
  ok('owner creates a manager link', /\/m\/[A-Za-z0-9_-]{20,}/.test(link));
  const mpath = new URL(link).pathname;

  // manager: opens the link (no account), sees only Public tasks
  const mgr = await newPage(br, 'manager');
  await mgr.goto(B + mpath, { waitUntil: 'load' }); await sleep(2500);
  const anon = await mgr.content();
  ok('link view shows Public + legacy tasks', anon.includes('Olive public task') && anon.includes('Olive legacy task'));
  ok('link view never shows the Private task', !anon.includes('SECRET'));
  ok('link view offers Sign in to connect', await mgr.locator('[data-test=signin-connect]').count() > 0 || await mgr.locator('[data-test=prompt-signin]').count() > 0);
  await shot(mgr, 'pal_e2e_1_link_view.png');
  const [popup] = await Promise.all([
    mgr.waitForEvent('popup', { timeout: 30000 }),
    (async () => {
      const b = mgr.locator('[data-test=prompt-signin], [data-test=signin-connect-btn]').first(); await b.click();
      await mgr.waitForURL(/\/login/, { timeout: 15000 });
      ok('pending token kept for sign-in', !!(await mgr.evaluate(() => localStorage.getItem('clingnote.pendingManagerToken.v1'))));
      await mgr.click('[data-test=google-signin]');
    })(),
  ]);
  await popup.waitForLoadState('load'); await sleep(1500);
  await popup.click('#add-account-button button');
  await popup.fill('#email-input', 'zztest-manager@example.com'); await popup.fill('#display-name-input', 'Mona ZZTEST');
  await popup.click('#sign-in');
  // a brand-new account goes through the NORMAL onboarding
  await mgr.waitForURL(/\/onboarding/, { timeout: 30000 });
  ok('new manager account is sent to normal onboarding', true);
  await shot(mgr, 'pal_e2e_2_onboarding.png');
  for (let i = 0; i < 12 && mgr.url().includes('/onboarding'); i++) {
    await sleep(700);
    if (await mgr.locator('.pw-link', { hasText: 'Maybe later' }).count()) { await mgr.click('.pw-link'); continue; }
    if (await mgr.locator('.ob-opt').count() && !(await mgr.locator('.ob-opt.on').count())) await mgr.locator('.ob-opt').first().click();
    if (await mgr.locator('.ob-later').count()) { await mgr.click('.ob-later'); continue; }
    if (await mgr.locator('.ob-cta').count()) await mgr.click('.ob-cta');
  }
  await mgr.waitForURL(/\/manage\//, { timeout: 30000 });
  ok('after onboarding: auto-connected and landed on the person', mgr.url().endsWith('/manage/' + ownerUid));
  ok('Manager mode remembered', (await mgr.evaluate(() => localStorage.getItem('clingnote.mode.v1'))) === 'manager');
  ok('pending token cleared', !(await mgr.evaluate(() => localStorage.getItem('clingnote.pendingManagerToken.v1'))));
  await sleep(2500);
  const mv = await mgr.content();
  ok('manager view (account): Public tasks shown, Private hidden', mv.includes('Olive public task') && !mv.includes('SECRET'));
  await shot(mgr, 'pal_e2e_3_manager_person.png');
  await mgr.click('[data-test=manager-back]'); await mgr.waitForURL(/\/manage$/); await sleep(2500);
  const rows = mgr.locator('[data-test=managed-person]');
  ok('Manager mode list shows the person', (await rows.count()) === 1 && (await rows.first().innerText()).includes('Olive ZZTEST'));
  await shot(mgr, 'pal_e2e_4_manager_list.png');
  await rows.first().click(); await mgr.waitForURL(/\/manage\//); await sleep(2000);

  // ping + DM from the signed-in manager
  await mgr.locator('[data-test=manager-task]', { hasText: 'Olive public task' }).locator('[data-test=nudge-btn]').click();
  await mgr.waitForSelector('text=Sent', { timeout: 10000 });
  ok('manager pings a Public task', true);
  await mgr.click('.mp-tabs button:has-text("Messages"), button:has-text("Messages")');
  await mgr.fill('.mp-compose input', 'ZZTEST hi from Mona'); await mgr.click('.mp-compose .mp-send'); await sleep(1500);
  ok('manager sends a DM', (await mgr.content()).includes('ZZTEST hi from Mona'));
  const chat = (await db.collection(`users/${ownerUid}/managerChat`).get()).docs.map((d) => d.data());
  ok('ping + DM stored for the owner', chat.some((c) => c.kind === 'nudge') && chat.some((c) => c.kind === 'dm' && c.text === 'ZZTEST hi from Mona'));
  // a Private task cannot be pinged even by crafting the request
  const mgrUid = (await admin.auth().getUserByEmail('zztest-manager@example.com')).uid;
  const pn = await callFn(await idTokenFor(mgrUid), { action: 'managerAct', ownerUid, act: 'nudge', taskKey: '|Olive SECRET private task' });
  ok('crafted ping on a Private task -> 404', pn.status === 404);

  // owner sees ping + DM, the connected manager by name, and replies
  await owner.goto(B + '/pals', { waitUntil: 'load' }); await sleep(3000);
  const oc = await owner.content();
  ok('owner sees the ping and the DM', oc.includes('ZZTEST hi from Mona') && /checking in on|Olive public task/.test(oc));
  ok('owner sees connected manager by name', (await owner.locator('[data-test=connected-manager]').innerText()).includes('Mona ZZTEST'));
  await owner.fill('[data-test=manager-panel] .pl-row input[aria-label=Message]', 'ZZTEST reply from Olive');
  await owner.locator('[data-test=manager-panel] form.pl-row button.pri').click(); await sleep(2000);
  ok('owner reply stored', (await db.collection(`users/${ownerUid}/managerChat`).where('from', '==', 'user').get()).size === 1);
  await shot(owner, 'pal_e2e_5_owner_inbox.png');

  // manager list: overdue badge counts only the Public overdue task, unread badge shows the reply
  await mgr.goto(B + '/manage', { waitUntil: 'load' }); await sleep(3000);
  const rowTxt = await mgr.locator('[data-test=managed-person]').first().innerText();
  ok('list badges: 1 overdue (private excluded), 1 new', /1 overdue/.test(rowTxt) && /1 new/.test(rowTxt), JSON.stringify(rowTxt));
  await shot(mgr, 'pal_e2e_6_manager_list_badges.png');
  await mgr.locator('[data-test=managed-person]').first().click(); await sleep(2500);
  await mgr.click('button:has-text("Messages")'); await sleep(800);
  ok('manager sees the owner reply', (await mgr.content()).includes('ZZTEST reply from Olive'));
  ok('Private overdue task not shown to the manager', !(await mgr.content()).includes('SECRET'));
  await shot(mgr, 'pal_e2e_7_manager_chat.png');

  // modes: the owner can switch to Manager mode (nobody they manage yet -> empty state) and back
  await owner.goto(B + '/pals', { waitUntil: 'load' }); await sleep(2500);
  await owner.locator('button[aria-expanded]').first().click(); await sleep(600);
  await shot(owner, 'pal_e2e_8_mode_switch.png');
  await owner.click('[data-test=mode-manager]'); await owner.waitForURL(/\/manage$/); await sleep(2500);
  ok('owner in Manager mode sees the empty state', await owner.locator('[data-test=manager-empty]').count() === 1);
  await shot(owner, 'pal_e2e_9_owner_manager_empty.png');
  await owner.click('[data-test=manager-empty] button'); await owner.waitForURL(/\/home/);
  ok('back to User mode (remembered)', (await owner.evaluate(() => localStorage.getItem('clingnote.mode.v1'))) === 'user');

  // pals: code pairing, Public-only tasks, live chat, remove
  const pal = await newPage(br, 'pal');
  await emailLogin(pal, 'zztest-pal@example.com');
  await owner.goto(B + '/pals', { waitUntil: 'load' }); await sleep(2000);
  await owner.click('.pl-tabs button:has-text("Pals")'); await owner.click('button:has-text("Get my invite code")');
  const code = (await owner.locator('[data-test=pal-code]').innerText({ timeout: 10000 })).trim();
  ok('owner gets a pal code', /^[A-Z0-9-]{8,9}$/.test(code), code);
  await pal.goto(B + '/pals', { waitUntil: 'load' }); await sleep(2000);
  await pal.click('.pl-tabs button:has-text("Pals")');
  await pal.fill('[data-test=pals-panel] input', code); await pal.click('[data-test=pals-panel] button:has-text("Connect")');
  await pal.waitForSelector('[data-test=pal-detail]', { timeout: 15000 }); await sleep(3000);
  ok('pal pairing by code (opens the new pal)', (await pal.locator('[data-test=pal-detail]').innerText()).includes('Olive ZZTEST'));
  const pt = await pal.content();
  ok('pal sees Public tasks, never Private', pt.includes('Olive public task') && !pt.includes('SECRET'));
  await shot(pal, 'pal_e2e_10_pal_tasks.png');
  const palUidNow = (await admin.auth().getUserByEmail('zztest-pal@example.com')).uid;
  ok('palTasks for a non-pal -> 403', (await callFn(await idTokenFor(mgrUid), { action: 'palTasks', palUid: ownerUid })).status === 403);
  await owner.waitForSelector('[data-test=pal-item]', { timeout: 15000 }); await owner.click('[data-test=pal-item]'); await sleep(1500);
  await owner.click('[data-test=pal-detail] .pl-tabs button:has-text("Chat")');
  await pal.click('[data-test=pal-detail] .pl-tabs button:has-text("Chat")');
  await pal.fill('[data-test=pal-detail] input[aria-label=Message]', 'ZZTEST pal says hi'); await pal.press('[data-test=pal-detail] input[aria-label=Message]', 'Enter');
  await owner.waitForSelector('text=ZZTEST pal says hi', { timeout: 10000 });
  ok('pal chat arrives live for the owner', true);
  await owner.fill('[data-test=pal-detail] input[aria-label=Message]', 'ZZTEST owner answers'); await owner.press('[data-test=pal-detail] input[aria-label=Message]', 'Enter');
  await pal.waitForSelector('text=ZZTEST owner answers', { timeout: 10000 });
  ok('owner chat arrives live for the pal', true);
  await shot(pal, 'pal_e2e_11_pal_chat.png');
  module.exports.ctx = { br, owner, mgr, pal, ownerUid, mgrUid, palUid: palUidNow, mpath };
  if (global.__beforeTeardown) await global.__beforeTeardown(module.exports.ctx);
  await pal.click('[data-test=remove-pal]'); await sleep(2500);
  ok('remove pal deletes the pair', (await db.collection('pals').get()).size === 0);

  // owner disconnects the signed-in manager
  await owner.goto(B + '/pals', { waitUntil: 'load' }); await sleep(2500);
  await owner.click('[data-test=disconnect-manager]'); await sleep(2500);
  ok('disconnect manager removes the connection', (await db.collection('managerConnections').get()).size === 0);
  await mgr.goto(B + '/manage', { waitUntil: 'load' }); await sleep(3000);
  ok('disconnected manager: list is empty', await mgr.locator('[data-test=manager-empty]').count() === 1);
  ok('disconnected manager: managerView -> 404', (await callFn(await idTokenFor(mgrUid), { action: 'managerView', ownerUid })).status === 404);

  // owner turns the link off
  await owner.click('[data-test=revoke-link]'); await sleep(2500);
  const anon2 = await newPage(br, 'anon');
  await anon2.goto(B + mpath, { waitUntil: 'load' }); await sleep(2500);
  ok('revoked link shows the gone state', await anon2.locator('[data-test=manager-gone]').count() === 1);
  ok('revoked link cannot connect', (await callFn(await idTokenFor(mgrUid), { action: 'connectManager', token: mpath.split('/').pop() })).status === 404);
  await shot(anon2, 'pal_e2e_12_revoked.png');

  // Firestore rules (emulator, real firestore.rules): direct client access
  const rest = async (tok, method, path, body) => (await fetch(`http://127.0.0.1:8085/v1/projects/demo-clingnote/databases/(default)/documents/${path}`, { method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).status;
  const today = WEEK[(new Date().getDay() + 6) % 7];
  const [tOwner, tMgr, tPal] = await Promise.all([idTokenFor(ownerUid), idTokenFor(mgrUid), idTokenFor(palUidNow)]);
  await db.doc(`managerConnections/${ownerUid}_${mgrUid}`).set({ ownerUid, managerUid: mgrUid, managerName: 'x' });
  await db.doc(`pals/${[ownerUid, palUidNow].sort().join('_')}`).set({ members: [ownerUid, palUidNow].sort() });
  ok('rules: owner reads own weeklyRoutines', (await rest(tOwner, 'GET', `weeklyRoutines/${ownerUid}_${today}`)) === 200);
  ok('rules: connected manager cannot read owner weeklyRoutines', (await rest(tMgr, 'GET', `weeklyRoutines/${ownerUid}_${today}`)) === 403);
  ok('rules: pal cannot read owner weeklyRoutines', (await rest(tPal, 'GET', `weeklyRoutines/${ownerUid}_${today}`)) === 403);
  ok('rules: manager reads own managerConnections doc', (await rest(tMgr, 'GET', `managerConnections/${ownerUid}_${mgrUid}`)) === 200);
  ok('rules: client cannot write managerConnections (manager)', (await rest(tMgr, 'PATCH', `managerConnections/${ownerUid}_${mgrUid}`, { fields: { managerName: { stringValue: 'hack' } } })) === 403);
  ok('rules: client cannot write managerConnections (owner)', (await rest(tOwner, 'PATCH', `managerConnections/${ownerUid}_x`, { fields: { ownerUid: { stringValue: ownerUid } } })) === 403);
  ok('rules: stranger cannot read managerConnections', (await rest(tPal, 'GET', `managerConnections/${ownerUid}_${mgrUid}`)) === 403);
  ok('rules: client cannot write managerChat as manager', (await rest(tMgr, 'POST', `users/${ownerUid}/managerChat`, { fields: { text: { stringValue: 'x' } } })) === 403);
  if (global.__afterRules) await global.__afterRules(module.exports.ctx, { rest, tOwner, tMgr, tPal });
  console.log(`\nE2E: ${results.filter((r) => r.pass).length}/${results.length} passed`);
  await br.close();
})().catch(async (e) => { console.error(e); process.exit(1); });
