// Entry order + one-time paywall tests (pure logic in src/utils/entryGuard.js) and static checks of the router/onboarding wiring.
// Order: NEW user = tutorial (unauth, once, no skip) -> sign up -> paywall -> app. EXISTING signed-in user = app; paywall only once if not Pro.
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire');
const root = path.join(__dirname, '..'); const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; };
const mem = {}; global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const g = sr.load('utils/entryGuard.js');
const D = (to, o = {}) => g.decideEntry({ to: typeof to === 'string' ? { path: to, query: {} } : to, ...o });
const PW_NEW = { isPro: false, seenLocal: false, seenRemote: false, docLoaded: true };

// ── unauthenticated: tutorial first, once per install, no skip ──
t('first launch, native: / -> /welcome', () => assert.deepStrictEqual(D('/', { native: true }), { path: '/welcome' }));
t('first launch, native: /login (no returning flag) -> /welcome (tutorial cannot be skipped)', () => assert.deepStrictEqual(D('/login', { native: true }), { path: '/welcome' }));
t('no email sign-up: the /register route only redirects to /login and the form is gone', () => { assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src/views/UserRegistrationForm.vue'))); assert.match(read('src/router/index.js'), /path: '\/register',\s*redirect:/); assert.ok(!/createUserWithEmailAndPassword/.test(read('src/views/Login.vue'))); assert.ok(!/to="\/register"|'\/register'|Create account|>Register</.test(read('src/views/Login.vue') + read('src/views/WelcomeView.vue') + read('src/App.vue'))); });
t('first launch: /home (signed out) -> /welcome, not /login', () => assert.deepStrictEqual(D('/home'), { path: '/welcome' }));
t('returning=1 lets an existing user on a fresh install reach /login', () => assert.strictEqual(D({ path: '/login', query: { returning: '1' } }, { native: true }), null));
t('web landing / login stay reachable without the tutorial', () => { assert.strictEqual(D('/'), null); assert.strictEqual(D('/login'), null); });
t('/welcome is public', () => assert.strictEqual(D('/welcome'), null));
t('tutorial seen: /register, /login and native / are not redirected by the entry guard', () => { for (const p of ['/login', '/']) assert.strictEqual(D(p, { native: true, tutorialSeen: true }), null); });
t('other public pages (terms, privacy, support) are never gated', () => { for (const p of ['/terms', '/privacy-policy', '/support']) assert.strictEqual(D(p, { native: true }), null); });

// ── signed in ──
t('existing signed-in user never sees /welcome again', () => { assert.deepStrictEqual(D('/welcome', { user: {}, tutorialSeen: true }), { path: '/home' }); assert.deepStrictEqual(D('/welcome', { user: {} }), { path: '/home' }); });
t('a brand-new account created on /login (Apple/Google) without the tutorial may enter /welcome?new=1', () => assert.strictEqual(D({ path: '/welcome', query: { new: '1' } }, { user: {}, tutorialSeen: false }), null));
t('...but only once: after the tutorial it bounces to /home', () => assert.deepStrictEqual(D({ path: '/welcome', query: { new: '1' } }, { user: {}, tutorialSeen: true }), { path: '/home' }));
t('existing user, not Pro, never saw the paywall -> /paywall once (from /home)', () => { const r = D('/home', { user: {}, tutorialSeen: true, paywall: PW_NEW }); assert.strictEqual(r.path, '/paywall'); assert.strictEqual(r.query.from, '/home'); });
t('same on / (app entry)', () => assert.strictEqual(D('/', { user: {}, tutorialSeen: true, paywall: PW_NEW }).path, '/paywall'));
t('paywall already seen (local or on the account) -> straight to the app', () => { assert.strictEqual(D('/home', { user: {}, paywall: { ...PW_NEW, seenLocal: true } }), null); assert.strictEqual(D('/home', { user: {}, paywall: { ...PW_NEW, seenRemote: true } }), null); });
t('Pro users never see it', () => assert.strictEqual(D('/home', { user: {}, paywall: { ...PW_NEW, isPro: true } }), null));
t('user doc unreadable (offline) -> no paywall, the app opens', () => assert.strictEqual(D('/home', { user: {}, paywall: { ...PW_NEW, docLoaded: false } }), null));
t('the paywall is only auto-shown on app entry, never on other routes (Subs/Profile/Rankings...)', () => { for (const p of ['/sub', '/rankings', '/discipline', '/onboarding', '/paywall', '/profile/abc']) assert.strictEqual(D(p, { user: {}, paywall: PW_NEW }), null); });
t('shouldShowPaywallOnce truth table', () => {
  const f = g.shouldShowPaywallOnce;
  assert.strictEqual(f({ isPro: false, seenLocal: false, seenRemote: false, docLoaded: true }), true);
  assert.strictEqual(f({ isPro: true, seenLocal: false, seenRemote: false, docLoaded: true }), false);
  assert.strictEqual(f({ isPro: false, seenLocal: true, seenRemote: false, docLoaded: true }), false);
  assert.strictEqual(f({ isPro: false, seenLocal: false, seenRemote: true, docLoaded: true }), false);
  assert.strictEqual(f({ isPro: false, seenLocal: false, seenRemote: false, docLoaded: false }), false);
});
t('local flags: tutorial once per install, paywall once per uid', () => {
  assert.strictEqual(g.hasSeenTutorial(), false); g.markTutorialSeen(); assert.strictEqual(g.hasSeenTutorial(), true);
  assert.strictEqual(g.hasSeenPaywallLocal('u1'), false); g.markPaywallSeenLocal('u1'); assert.strictEqual(g.hasSeenPaywallLocal('u1'), true); assert.strictEqual(g.hasSeenPaywallLocal('u2'), false);
});

// ── static wiring ──
const router = read('src/router/index.js'); const onb = read('src/views/OnboardingView.vue'); const welcome = read('src/views/WelcomeView.vue');
t('router: /welcome is a public bare route; the guard applies decideEntry; /paywall alias is intact', () => {
  assert.match(router, /path: '\/welcome'[\s\S]{0,200}meta: \{ bare: true \}/); assert.ok(!/path: '\/welcome'[\s\S]{0,200}requiresAuth/.test(router));
  assert.match(router, /decideEntry\(/); assert.match(router, /path: '\/paywall'[\s\S]{0,120}step: 5/);
});
t('onboarding: paywall step records "seen" (local + users/{uid}.paywallSeenAt) so existing users see it once', () => { assert.match(onb, /markPaywallSeenLocal/); assert.match(onb, /paywallSeenAt/); });
t('welcome: no skip control, finishing marks the tutorial seen, the wake pick is explicit and cached locally before sign-up', () => {
  assert.ok(!/skip/i.test(welcome.replace(/no skip/gi, ''))); assert.match(welcome, /markTutorialSeen/); assert.match(welcome, /cachePlan/); assert.doesNotMatch(welcome, /wakeConfirmed/);
});
t('sign-in paths flush the cached wake plan to the account (syncAfterAuth) and route new accounts correctly', () => {
  for (const f of ['src/views/Login.vue', 'src/views/WelcomeView.vue']) assert.match(read(f), /syncAfterAuth/);
  assert.match(read('src/views/Login.vue'), /markTutorialSeen/);
});
t('new Apple/Google account (onboardingComplete false) entering the app -> /onboarding, before the paywall', () => { assert.deepStrictEqual(D('/home', { user: {}, tutorialSeen: true, paywall: { ...PW_NEW, needsOnboarding: true } }), { path: '/onboarding' }); assert.strictEqual(D('/home', { user: {}, paywall: { ...PW_NEW, needsOnboarding: true, seenLocal: true } }), null); assert.strictEqual(D('/home', { user: {}, paywall: { ...PW_NEW, needsOnboarding: true, docLoaded: false } }), null); });
t('login: Apple (iOS) / Google (web) create the users doc and route new accounts to onboarding; email is sign-in only', () => { const l = read('src/views/Login.vue'); assert.match(l, /onboardingComplete: false/); assert.match(l, /afterNewAccount\(\)/); assert.match(l, /'\/onboarding'/); assert.match(l, /signInWithEmailAndPassword/); assert.match(l, /data-test="email-toggle"/); });
console.log(`entry guard: ${n} checks passed`);
