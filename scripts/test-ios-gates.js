// Run: node scripts/test-ios-gates.js  (static checks that iOS-only gating is in place and web paths are not altered)
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const rd = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const router = rd('src/router/index.js');
t('web-only routes are flagged and guarded on iOS', () => {
  ['/mealPlan', '/pro/success', '/payment-success'].forEach((r) => { const i = router.indexOf(`path: '${r}'`); assert(i > 0, r); assert(/webOnly: true/.test(router.slice(i, i + 300)), r + ' webOnly'); });
  assert(/isNativeIOS\(\) && to\.matched\.some\(r => r\.meta && r\.meta\.webOnly\)/.test(router));
});
t('paywall iOS: empty / failed / loading store offerings show a friendly state with Try again + Restore, never a blank or a dead Subscribe button', () => {
  const s = rd('src/components/paywall/PaywallPanel.vue');
  assert(/iapState = ref\(ios \? 'loading' : 'ready'\)/.test(s)); assert(/iapState\.value = 'empty'/.test(s) && /iapState\.value = 'error'/.test(s));
  assert(/data-test="pw-iap-state"/.test(s) && /data-test="pw-retry"/.test(s) && /@click="loadIap"/.test(s));
  assert(/<button v-if="!ios \|\| iapState === 'ready'" class="cta"/.test(s), 'CTA hidden until plans are loaded'); assert(/data-test="pw-restore"/.test(s));
  assert(!/Stripe|startCheckout/.test(s.slice(s.indexOf('async function buy'), s.indexOf('async function restore')).split('const r = await startCheckout')[0]), 'iOS buy path is IAP only');
});
t('terms hides the Stripe sentence on iOS only', () => { const s = rd('src/views/TermsandCondition.vue'); assert(/<span v-if="!ios"[^>]*>On the website, payments are processed by Stripe\. <\/span>/.test(s)); });
t('meal credits checkout is a no-op on iOS', () => assert(/redirectToCheckout = async \(\) => \{\s*if \(isNativeIOS\(\)\) return;/.test(rd('src/views/MealPlan.vue'))));
t('paywall iOS path has no hardcoded USD / trial wording leaks', () => {
  const s = rd('src/components/paywall/PaywallPanel.vue');
  assert(/shownPlans = computed\(\(\) => ios \?/.test(s)); assert(/priceText = \(p\) => iapFor\(p\.id\)\?\.priceString \|\| \(ios \? '' : fmt\(p\.price\)\)/.test(s));
  assert(!/\}\/year\. Cancel/.test(s.replace(/\$\{pr\}\/\$\{periodWord\(p\)\}/g, ''))); assert(/Unlock <span>ClingNot Pro<\/span>/.test(s));
});
t('Recovery Tracker + admin About are web-only; nav hides them on iOS; disclaimer + reworded option exist', () => {
  ['/addiction', '/about'].forEach((r) => { const i = router.indexOf(`path: '${r}'`); assert(i > 0, r); assert(/webOnly: true/.test(router.slice(i, i + 300)), r + ' webOnly'); });
  const nav = rd('src/components/nav.vue'); assert(/<template v-if="!isIOS && userEmail ===/.test(nav)); assert(/<li v-if="!isIOS"[^>]*data-test="nav-addiction"/.test(nav));
  const a = rd('src/views/addiction.vue'); assert(/data-test="recovery-disclaimer"/.test(a) && /not medical advice/i.test(a) && /988/.test(a) && /1-800-662-4357/.test(a));
  assert(/<option value="Porn">Adult content<\/option>/.test(a)); assert(!/>Porn</.test(a) && !/porn-related/.test(a));
});
t('privacy policy covers retention, DOB/gender, avatar/photos, analytics, no tracking, recovery tracker, deletion and uses ClingNot', () => {
  const p = rd('src/views/privacy-policy.vue');
  ['Retention', 'date of birth', 'gender', 'profile picture', 'Analytics', 'No tracking', 'Recovery Tracker', 'OneSignal', 'RevenueCat', 'Delete Account', 'comments, replies and reactions'].forEach((k) => assert(p.includes(k), k));
  assert(!/ClingNote/.test(p), 'brand is ClingNot');
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
  assert(/to="\/privacy-policy"/.test(rd('src/views/Login.vue')) && /to="\/privacy-policy"/.test(rd('src/views/UserRegistrationForm.vue')));
  assert(!/ClingNote/.test(rd('src/App.vue') + rd('src/views/TermsandCondition.vue')));
});
t('firestore.rules: captains/game writes limited to pickup admins / captains; post comments constrained', () => {
  const r = rd('firestore.rules');
  assert(!/match \/captains\/\{captainId\} \{\s*allow read, write: if isAuthenticated\(\);/.test(r)); assert(!/match \/game\/\{gameId\} \{\s*allow read, write: if isAuthenticated\(\);/.test(r));
  assert(/allow create, delete: if isPickupAdmin\(\);/.test(r) && /allow write: if isPickupAdmin\(\) \|\| isCaptain\(\);/.test(r) && /email_verified == true/.test(r));
  assert(/commentsChangeOk\(\) && ownMapKeyOnly\('reactions'\) && ownMapKeyOnly\('readComments'\)/.test(r));
  ['ds7513635@gmail.com', 'pablo.novoa89@gmail.com', 'lordsarfo123@gmail.com', 'ideastogether@yahoo.com', 'testing@gmail.com'].forEach((e) => assert(rd('src/views/Pickup.vue').includes(e) && r.includes(e), e));
});
t('privacy manifest exists, declares no tracking and is part of the Xcode project; Xcode is pinned in the workflow', () => {
  const m = rd('ios/App/App/PrivacyInfo.xcprivacy'); assert(/NSPrivacyTracking<\/key>\s*<false\/>/.test(m)); assert(/NSPrivacyAccessedAPICategoryUserDefaults/.test(m));
  const px = rd('ios/App/App.xcodeproj/project.pbxproj'); assert((px.match(/PrivacyInfo\.xcprivacy/g) || []).length >= 4);
  assert(/DEVELOPER_DIR: \/Applications\/Xcode_26\.\d+\.app/.test(rd('.github/workflows/ios-testflight.yml')));
});
console.log(`${n} passed`);
