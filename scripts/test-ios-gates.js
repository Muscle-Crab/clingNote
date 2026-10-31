// Run: node scripts/test-ios-gates.js  (static checks that iOS-only gating is in place and web paths are not altered)
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const rd = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const router = rd('src/router/index.js');
t('web-only routes are flagged and guarded on iOS', () => {
  ['/pro/success', '/payment-success'].forEach((r) => { const i = router.indexOf(`path: '${r}'`); assert(i > 0, r); assert(/webOnly: true/.test(router.slice(i, i + 300)), r + ' webOnly'); });
  assert(/isNativeIOS\(\) && to\.matched\.some\(r => r\.meta && r\.meta\.webOnly\)/.test(router));
});
t('paywall iOS: empty / failed / loading store offerings show a friendly state with Try again + Restore, never a blank or a dead Subscribe button', () => {
  const s = rd('src/components/paywall/PaywallPanel.vue');
  assert(/iapState = ref\(ios \? 'loading' : 'ready'\)/.test(s)); assert(/iapState\.value = 'empty'/.test(s) && /iapState\.value = 'error'/.test(s));
  assert(/data-test="pw-iap-state"/.test(s) && /data-test="pw-retry"/.test(s) && /@click="loadIap"/.test(s));
  assert(/<button v-if="!ios \|\| iapState === 'ready'" class="cta"/.test(s), 'CTA hidden until plans are loaded'); assert(/data-test="pw-restore"/.test(s));
  assert(!/Stripe|startCheckout/.test(s.slice(s.indexOf('async function buy'), s.indexOf('async function restore')).split('const r = await startCheckout')[0]), 'iOS buy path is IAP only');
});
t('iap purchase hands RevenueCat a raw (non-Proxy) package: the paywall plans live in a reactive ref', () => {
  const src = rd('src/utils/iap.js'); assert(/import \{ toRaw \} from 'vue'/.test(src)); assert(/purchasePackage\(\{ aPackage: toRaw\(plan\.pkg\) \}\)/.test(src));
  const { reactive, ref, isProxy, toRaw } = require('vue'); const pkg = { identifier: '$rc_lifetime', product: { identifier: 'clingnote_pro_lifetime' }, presentedOfferingContext: { offeringIdentifier: 'default' } };
  const plan = ref([{ id: 'lifetime', pkg }]).value[0]; assert(isProxy(plan.pkg), 'reactive plan.pkg is a Proxy'); assert(isProxy(reactive(pkg)));
  const raw = toRaw(plan.pkg); assert(!isProxy(raw) && raw === pkg, 'toRaw returns the original, un-serialised package object');
});
t('terms hides the Stripe sentence on iOS only', () => { const s = rd('src/views/TermsandCondition.vue'); assert(/<span v-if="!ios"[^>]*>On the website, payments are processed by Stripe\. <\/span>/.test(s)); });
t('pickup + meal plan pages are removed', () => { assert(!/'\/pickup'|'\/mealPlan'|Pickup\.vue|MealPlan\.vue/.test(router)); assert(!require('fs').existsSync('src/views/Pickup.vue') && !require('fs').existsSync('src/views/MealPlan.vue')); });
t('paywall iOS path has no hardcoded USD / trial wording leaks', () => {
  const s = rd('src/components/paywall/PaywallPanel.vue');
  assert(/shownPlans = computed\(\(\) => ios \?/.test(s)); assert(/priceText = \(p\) => iapFor\(p\.id\)\?\.priceString \|\| \(ios \? '' : fmt\(p\.price\)\)/.test(s));
  assert(!/\}\/year\. Cancel/.test(s.replace(/\$\{pr\}\/\$\{periodWord\(p\)\}/g, ''))); assert(/Unlock <span>ClingNote Pro<\/span>/.test(s));
});
t('Recovery Tracker + admin About are web-only; nav hides them on iOS; disclaimer + reworded option exist', () => {
  ['/addiction', '/about'].forEach((r) => { const i = router.indexOf(`path: '${r}'`); assert(i > 0, r); assert(/webOnly: true/.test(router.slice(i, i + 300)), r + ' webOnly'); });
  const nav = rd('src/components/nav.vue'); assert(/<template v-if="!isIOS && userEmail ===/.test(nav)); assert(/<li v-if="!isIOS"[^>]*data-test="nav-addiction"/.test(nav));
  const a = rd('src/views/addiction.vue'); assert(/data-test="recovery-disclaimer"/.test(a) && /not medical advice/i.test(a) && /988/.test(a) && /1-800-662-4357/.test(a));
  assert(/<option value="Porn">Adult content<\/option>/.test(a)); assert(!/>Porn</.test(a) && !/porn-related/.test(a));
});
t('privacy policy covers retention, DOB/gender, avatar/photos, analytics, no tracking, recovery tracker, deletion and uses ClingNote', () => {
  const p = rd('src/views/privacy-policy.vue');
  ['Retention', 'date of birth', 'gender', 'profile picture', 'Analytics', 'No tracking', 'Recovery Tracker', 'OneSignal', 'RevenueCat', 'Delete Account', 'comments, replies and reactions'].forEach((k) => assert(p.includes(k), k));
  assert(!/\bClingNot\b/.test(p), 'brand is ClingNote');
});
t('landing page skipped on native; landing video is not bundled in the iOS build and not loaded on native', () => {
  assert(/isNative\(\) && \(to\.path === '\/' \|\| to\.path === '\/landing'\)\) return next\(currentUser \? '\/home' : '\/login'\)/.test(router));
  const m = rd('src/utils/landingMedia.js'); assert(/VUE_APP_NATIVE_BUILD === '1' \|\| isNative\(\)\) \? '' : require\('@\/assets\/video\.mp4'\)/.test(m)); assert(/heroStyle = isNative\(\) \? \{\}/.test(m));
  assert(!/assets\/video\.mp4/.test(rd('src/views/landing.vue') + rd('src/views/Room.vue')));
  const v = rd('vue.config.js'); ['iphone.mov', 'test.html', 'sw.js', 'productionSourceMap: !NATIVE'].forEach((k) => assert(v.includes(k), k));
  assert(/npm run build:ios/.test(rd('.github/workflows/ios-testflight.yml')));
});
t('AI workout: disclaimer shown, no fabricated youtubeURL requested or stored; policy/terms/login link to each other; brand name', () => {
  assert(/data-test="workout-disclaimer"/.test(rd('src/components/home/WorkoutModal.vue')));
  assert(!/youtubeURL/.test(rd('netlify/functions/lib/aiPrompts.js'))); assert(/map\(\(\{ youtubeURL, \.\.\.task \}\)/.test(rd('src/views/HomeView.vue')));
  assert(/to="\/privacy-policy"/.test(rd('src/views/Login.vue')));
  assert(!/\bClingNot\b/.test(rd('src/App.vue') + rd('src/views/TermsandCondition.vue')));
});
t('firestore.rules: captains/game writes limited to pickup admins / captains; post comments constrained', () => {
  const r = rd('firestore.rules');
  assert(!/match \/captains\/\{captainId\} \{\s*allow read, write: if isAuthenticated\(\);/.test(r)); assert(!/match \/game\/\{gameId\} \{\s*allow read, write: if isAuthenticated\(\);/.test(r));
  assert(/allow create, delete: if isPickupAdmin\(\);/.test(r) && /allow write: if isPickupAdmin\(\) \|\| isCaptain\(\);/.test(r) && /email_verified == true/.test(r));
  assert(/commentsChangeOk\(\) && ownMapKeyOnly\('reactions'\) && ownMapKeyOnly\('readComments'\)/.test(r));
  ['ds7513635@gmail.com', 'pablo.novoa89@gmail.com', 'lordsarfo123@gmail.com', 'ideastogether@yahoo.com', 'testing@gmail.com'].forEach((e) => assert(r.includes(e), e));
});
t('privacy manifest exists, declares tracking (build 44 ATT; must match NSUserTrackingUsageDescription) and is part of the Xcode project; Xcode is pinned in the workflow', () => {
  const m = rd('ios/App/App/PrivacyInfo.xcprivacy'); assert(/NSPrivacyTracking<\/key>\s*<true\/>/.test(m)); assert(/NSUserTrackingUsageDescription/.test(rd('ios/App/App/Info.plist'))); assert(/NSPrivacyAccessedAPICategoryUserDefaults/.test(m));
  const px = rd('ios/App/App.xcodeproj/project.pbxproj'); assert((px.match(/PrivacyInfo\.xcprivacy/g) || []).length >= 4);
  assert(/DEVELOPER_DIR: \/Applications\/Xcode_26\.\d+\.app/.test(rd('.github/workflows/ios-testflight.yml')));
});
t('iOS trusts the RevenueCat pro entitlement directly (OR with server flag), cached and cleared on change', () => {
  const u = rd('src/composables/usePro.js'), i = rd('src/utils/iap.js');
  assert(/export const setRcPro/.test(u) && /clearProCache\(\)/.test(u.split('export const setRcPro')[1].split('\n')[0]));
  assert(/rcProActive = \(uid\) => isNativeIOS\(\) && rcPro\.value\.active && !!uid && rcPro\.value\.uid === uid/.test(u));
  assert((u.match(/withRcPro\(u\.uid,/g) || []).length === 3, 'every loadUserDoc return ORs RevenueCat');
  assert(/entitlements\?\.active\?\.\[RC_ENTITLEMENT\]/.test(i) && /RC_ENTITLEMENT = 'pro'/.test(rd('src/config/iap.js')));
  assert(/Purchases\.getCustomerInfo\(\)/.test(i) && /addCustomerInfoUpdateListener/.test(i) && /await refreshCustomerInfo\(\)/.test(i));
  assert(/setRcPro\(user\.uid, active, entitlementPlan\(res\?\.customerInfo\)\);\n    if \(!active\)/.test(i), 'purchase result applied immediately');
  assert(/const active = entitlementActive\(customerInfo\);\n    if \(user\?\.uid\) setRcPro\(user\.uid, active, entitlementPlan\(customerInfo\)\);/.test(i), 'restore result applied immediately');
  assert(/setRcPro\(null, false\)/.test(i), 'cleared on logout');
});
t('merged Pro drives Profile/paywall/limit prompts: Manage subscription, Pro (Lifetime), never Plan: Free for Pro', () => {
  const p = rd('src/views/Profile.vue'), r = rd('src/router/index.js'), i = rd('src/utils/iap.js'), m = rd('src/components/home/AddTaskModal.vue');
  assert(/withRcPro\(auth\.currentUser\?\.uid, userData\.value\)/.test(p) && /ensureIapUser\(auth\.currentUser\)/.test(p));
  assert(/'Pro \(Lifetime\)'/.test(p) && /Manage subscription<\/button>/.test(p) && /v-if="isOwn && userIsPro && !isLifetime"/.test(p) && /v-if="isOwn && !userIsPro" to="\/paywall"/.test(p));
  assert(!/Cancel subscription/i.test(p));
  assert(/Purchases\.showManageSubscriptions\(\)/.test(i) && /itms-apps:\/\/apps\.apple\.com\/account\/subscriptions/.test(i));
  assert(/isPro\(withRcPro\(user\.uid, d\)\)/.test(r) && /to\.path === '\/paywall' && currentUser/.test(r));
  assert(/v-if="!rcPro\(\)"[^>]*data-test="limit-upgrade"/.test(m));
  assert(/const rcPro = ref\(/.test(rd('src/composables/usePro.js')), 'RC state is reactive');
});
console.log(`${n} passed`);
