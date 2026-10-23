// Run: node scripts/test-ios-gates.js  (static checks that iOS-only gating is in place and web paths are not altered)
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const rd = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const router = rd('src/router/index.js');
t('web-only routes are flagged and guarded on iOS', () => {
  ['/mealPlan', '/pro/success', '/payment-success'].forEach((r) => { const i = router.indexOf(`path: '${r}'`); assert(i > 0, r); assert(/webOnly: true/.test(router.slice(i, i + 300)), r + ' webOnly'); });
  assert(/isNativeIOS\(\) && to\.matched\.some\(r => r\.meta && r\.meta\.webOnly\)/.test(router));
});
t('terms hides the Stripe sentence on iOS only', () => { const s = rd('src/views/TermsandCondition.vue'); assert(/<span v-if="!ios"[^>]*>On the website, payments are processed by Stripe\. <\/span>/.test(s)); });
t('meal credits checkout is a no-op on iOS', () => assert(/redirectToCheckout = async \(\) => \{\s*if \(isNativeIOS\(\)\) return;/.test(rd('src/views/MealPlan.vue'))));
t('paywall iOS path has no hardcoded USD / trial wording leaks', () => {
  const s = rd('src/components/paywall/PaywallPanel.vue');
  assert(/shownPlans = computed\(\(\) => ios \?/.test(s)); assert(/priceText = \(p\) => iapFor\(p\.id\)\?\.priceString \|\| \(ios \? '' : fmt\(p\.price\)\)/.test(s));
  assert(!/\}\/year\. Cancel/.test(s.replace(/\$\{pr\}\/\$\{periodWord\(p\)\}/g, ''))); assert(/Unlock <span>ClingNot Pro<\/span>/.test(s));
});
console.log(`${n} passed`);
