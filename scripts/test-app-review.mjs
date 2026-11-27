// Run: node scripts/test-app-review.mjs  (Guideline 5.6.3 rating gate + settings row)
import assert from 'assert'; import fs from 'fs';
const mem = new Map(); const sess = new Map();
const storage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const session = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
};
globalThis.localStorage = storage;
globalThis.sessionStorage = session;
let events = 0; globalThis.window = { dispatchEvent: () => { events++; }, location: {}, sessionStorage: session, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } } };
const src = fs.readFileSync(new URL('../src/utils/appReview.js', import.meta.url), 'utf8')
  .replace("import { isNativeIOS } from '@/utils/platform';", 'const isNativeIOS = () => false;');
const m = await import('data:text/javascript,' + encodeURIComponent(src));
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

const DAY = 86400000;
const t0 = Date.parse('2026-11-10T15:00:00-05:00');
const later = t0 + DAY + 3600000; // next calendar day
const newSession = () => { sess.clear(); };
const primed = (at = later) => { newSession(); mem.clear(); events = 0; m.noteAppLaunch(t0); newSession(); m.noteAppLaunch(at); };
const okOpts = (calls, extra = {}) => ({ reason: 'session_complete', onboardingComplete: true, now: later, request: async () => { calls.push(1); }, ...extra });

await t('refuses without onboarding, a valid reason, or a uid', async () => {
  primed();
  const c = [];
  assert.equal((m.reviewEligibility('u0', { reason: 'session_complete', now: later })).why, 'onboarding');
  assert.equal(await m.maybeRequestReview('u0', okOpts(c, { onboardingComplete: false })), false);
  assert.equal(await m.maybeRequestReview('u0', okOpts(c, { reason: 'home-load' })), false);
  assert.equal(await m.maybeRequestReview('u0', okOpts(c, { reason: undefined })), false);
  assert.equal(await m.maybeRequestReview(null, okOpts(c)), false);
  assert.equal(c.length, 0);
});

await t('stamps first launch and refuses in the first session, even the next day', async () => {
  mem.clear(); sess.clear(); events = 0; const c = [];
  assert.equal(m.noteAppLaunch(t0), 1);
  assert.equal(m.firstLaunchAt(), t0);
  assert.equal(m.launchCount(), 1);
  assert.equal(await m.maybeRequestReview('u1', okOpts(c, { now: t0 })), false);
  assert.equal(m.reviewEligibility('u1', { reason: 'session_complete', onboardingComplete: true, now: t0 }).why, 'first-day');
  // Same runtime, clock rolled past midnight: still the first session.
  assert.equal(await m.maybeRequestReview('u1', okOpts(c, { now: later })), false);
  assert.equal(m.reviewEligibility('u1', { reason: 'session_complete', onboardingComplete: true, now: later }).why, 'first-session');
  assert.equal(c.length, 0);
  assert.equal(m.launchCount(), 1);
});

await t('a second session on the first launch day is still refused', async () => {
  mem.clear(); sess.clear(); const c = [];
  m.noteAppLaunch(t0); newSession(); m.noteAppLaunch(t0 + 60 * 60 * 1000);
  assert.equal(m.launchCount(), 2);
  assert.equal(m.reviewEligibility('u1', { reason: 'session_complete', onboardingComplete: true, now: t0 + 60 * 60 * 1000 }).why, 'first-day');
  assert.equal(await m.maybeRequestReview('u1', okOpts(c, { now: t0 + 60 * 60 * 1000 })), false);
  assert.equal(c.length, 0);
});

await t('fires once on a later day after a second session, for a completed 8-task session', async () => {
  primed(); const c = [];
  assert.equal(m.reviewEligibility('u1', { reason: 'session_complete', onboardingComplete: true, now: later }).why, 'ok');
  assert.equal(await m.maybeRequestReview('u1', okOpts(c)), true);
  assert.equal(c.length, 1);
  assert(m.wasReviewRequested('u1'));
  assert.equal(events, 1);
  assert.equal(await m.maybeRequestReview('u1', okOpts(c, { reason: 'boss_unlock' })), false);
  assert.equal(c.length, 1);
});

await t('boss unlock is also a valid positive moment', async () => {
  primed(); const c = [];
  assert.equal(await m.maybeRequestReview('u-boss', okOpts(c, { reason: 'boss_unlock' })), true);
  assert.equal(c.length, 1);
  assert(m.wasReviewRequested('u-boss'));
});

await t('at most once per app version; a later version may ask again', async () => {
  primed(); const c = [];
  assert.equal(await m.maybeRequestReview('u2', okOpts(c, { version: '1.0' })), true);
  assert.equal(await m.maybeRequestReview('u2', okOpts(c, { version: '1.0' })), false);
  assert.equal(await m.maybeRequestReview('u2', okOpts(c, { version: '1.1' })), true);
  assert.equal(c.length, 2);
  assert(m.wasReviewRequested('u2', '1.0'));
  assert(m.wasReviewRequested('u2', '1.1'));
});

await t('legacy first-launch done flag still blocks 1.0 but not a later version', async () => {
  primed(); const c = [];
  mem.set('cn_review_requested_u-legacy', '2026-11-13T00:00:00.000Z');
  assert(m.wasReviewRequested('u-legacy', '1.0'));
  assert.equal(await m.maybeRequestReview('u-legacy', okOpts(c, { version: '1.0' })), false);
  assert.equal(await m.maybeRequestReview('u-legacy', okOpts(c, { version: '1.1' })), true);
  assert.equal(c.length, 1);
});

await t('leftover onboarding pending flag never arms or fires the prompt', async () => {
  primed(); const c = [];
  mem.set('cn_review_pending_u3', String(later));
  assert.equal(await m.maybeRequestReview('u3', { now: later, request: async () => { c.push(1); } }), false);
  assert.equal(await m.maybeRequestReview('u3', okOpts(c, { onboardingComplete: false })), false);
  assert.equal(mem.has('cn_review_pending_u3'), false, 'stale pending key is cleared');
  assert.equal(c.length, 0);
  assert.equal(await m.maybeRequestReview('u3', okOpts(c)), true);
  assert.equal(c.length, 1);
});

await t('per user: another account on the same device gets its own single prompt', async () => {
  primed(); const c = [];
  assert.equal(await m.maybeRequestReview('u4', okOpts(c)), true);
  assert.equal(await m.maybeRequestReview('u5', okOpts(c)), true);
  assert.equal(c.length, 2);
});

await t('never throws: plugin rejects, storage throws, no uid', async () => {
  primed();
  assert.equal(await m.maybeRequestReview('u6', { reason: 'session_complete', onboardingComplete: true, now: later, request: async () => { throw new Error('UNIMPLEMENTED'); } }), true);
  const g = globalThis.localStorage; const s = globalThis.window.sessionStorage;
  const boom = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  globalThis.localStorage = boom; globalThis.window.sessionStorage = boom;
  assert.equal(await m.maybeRequestReview('u7', okOpts([])), false);
  m.noteAppLaunch(later);
  globalThis.localStorage = g; globalThis.window.sessionStorage = s;
  assert.equal(await m.maybeRequestReview(null, okOpts([])), false);
});

await t('default native request is a no-op off iOS', async () => {
  primed();
  assert.equal(await m.maybeRequestReview('u8', { reason: 'session_complete', onboardingComplete: true, now: later }), true);
});

await t('no dashboard delay or 2-hour wait in the gate', async () => {
  const body = fs.readFileSync(new URL('../src/utils/appReview.js', import.meta.url), 'utf8');
  assert(!/REVIEW_DELAY|delayMs|7200000|2 \* 60 \* 60/.test(body));
  assert(!/setTimeout/.test(body));
  assert(!/markReviewPending/.test(body));
});

await t('write-review URL + wiring (no onboarding/home-load trigger; session and boss hooks; settings row; no custom gate)', async () => {
  assert.equal(m.WRITE_REVIEW_URL, 'https://apps.apple.com/app/id6826148686?action=write-review');
  const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const onboarding = rd('src/views/OnboardingView.vue');
  const home = rd('src/views/HomeView.vue');
  const main = rd('src/main.js');
  assert(!/markReviewPending|maybeRequestReview|appReview/.test(onboarding), 'onboarding must not arm or request a rating');
  assert(!/onMounted\(\(\) => \{[^}]*maybeRequestReview/.test(home), 'home onMounted must not request a rating');
  assert(!/stillOnHome/.test(home));
  assert(/offerAppReview\('session_complete'\)/.test(home), 'session-complete hook');
  assert(/offerAppReview\('boss_unlock'\)/.test(home), 'boss-unlock hook');
  assert(/noteAppLaunch\(/.test(main), 'first-launch / session count stamped at startup');
  assert(/data-test="rate-app"[^>]*@click="rateApp"[\s\S]*Rate ClingNote/.test(rd('src/views/Profile.vue')));
  assert(!/like (it|ClingNote)\?|enjoying/i.test(rd('src/utils/appReview.js').replace(/\/\/.*$/gm, '')), 'no custom gate');
  assert(/CapacitorCommunityInAppReview/.test(rd('ios/App/CapApp-SPM/Package.swift')), 'iOS SPM package synced');
});

console.log(`\n${n} app-review tests passed`);
