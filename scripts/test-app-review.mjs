// Run: node scripts/test-app-review.mjs  (one-time App Store rating prompt + settings row)
import assert from 'assert'; import fs from 'fs';
const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
let events = 0; globalThis.window = { dispatchEvent: () => { events++; }, location: {}, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } } };
const src = fs.readFileSync(new URL('../src/utils/appReview.js', import.meta.url), 'utf8')
  .replace("import { isNativeIOS } from '@/utils/platform';", 'const isNativeIOS = () => false;');
const m = await import('data:text/javascript,' + encodeURIComponent(src));
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const opts = (calls) => ({ wait: async () => {}, request: async () => { calls.push(1); } });
await t('does nothing unless onboarding armed it', async () => { const c = []; assert.equal(await m.maybeRequestReview('u0', opts(c)), false); assert.equal(c.length, 0); });
await t('fires exactly once after onboarding, never again (even if re-armed by Replay onboarding)', async () => {
  const c = []; m.markReviewPending('u1'); assert.equal(await m.maybeRequestReview('u1', opts(c)), true); assert.equal(c.length, 1); assert(m.wasReviewRequested('u1'));
  assert.equal(await m.maybeRequestReview('u1', opts(c)), false); m.markReviewPending('u1'); assert.equal(await m.maybeRequestReview('u1', opts(c)), false); assert.equal(c.length, 1); assert.equal(events, 1);
});
await t('per user: another account on the same device gets its own single prompt', async () => { const c = []; m.markReviewPending('u2'); assert.equal(await m.maybeRequestReview('u2', opts(c)), true); assert.equal(c.length, 1); });
await t('waits the delay and stays pending if the user left /home', async () => {
  const c = []; let waited = 0; m.markReviewPending('u3');
  assert.equal(await m.maybeRequestReview('u3', { ...opts(c), wait: async (ms) => { waited = ms; }, stillOnHome: () => false }), false); assert.equal(waited, 2000); assert.equal(c.length, 0);
  assert.equal(await m.maybeRequestReview('u3', opts(c)), true);
});
await t('never throws: plugin rejects, storage throws, no uid', async () => {
  m.markReviewPending('u4'); assert.equal(await m.maybeRequestReview('u4', { wait: async () => {}, request: async () => { throw new Error('UNIMPLEMENTED'); } }), true);
  const g = globalThis.localStorage; globalThis.localStorage = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(await m.maybeRequestReview('u5', opts([])), false); m.markReviewPending('u5'); globalThis.localStorage = g; assert.equal(await m.maybeRequestReview(null), false);
});
await t('default native request is a no-op off iOS', async () => { m.markReviewPending('u6'); assert.equal(await m.maybeRequestReview('u6', { wait: async () => {} }), true); });
await t('write-review URL + wiring (onboarding finish arms it, home triggers it, settings row, no custom gate)', async () => {
  assert.equal(m.WRITE_REVIEW_URL, 'https://apps.apple.com/app/id6826148686?action=write-review');
  const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert(/async function finish\(\)[^\n]*\n\s*if \(auth\.currentUser\) markReviewPending/.test(rd('src/views/OnboardingView.vue')));
  assert(/PaywallPanel v-if="step === STEPS\.length"[^>]*@close="finish"/.test(rd('src/views/OnboardingView.vue')), 'prompt armed only after the paywall closes');
  assert(/maybeRequestReview\(u\.uid/.test(rd('src/views/HomeView.vue')));
  assert(/data-test="rate-app"[^>]*@click="rateApp"[\s\S]*Rate ClingNote/.test(rd('src/views/Profile.vue')));
  assert(!/like (it|ClingNote)\?|enjoying/i.test(rd('src/utils/appReview.js').replace(/\/\/.*$/gm, '')), 'no custom gate');
  assert(/CapacitorCommunityInAppReview/.test(rd('ios/App/CapApp-SPM/Package.swift')), 'iOS SPM package synced');
});
console.log(`\n${n} app-review tests passed`);
