// Run: node scripts/test-native-push.js  (iOS native push opt-in state machine + wiring)
const path = require('path'); const fs = require('fs'); const os = require('os'); const assert = require('assert');
(async () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/utils/nativePush.js'), 'utf8')
    .replace("import { isNativeIOS } from '@/utils/platform';", 'const isNativeIOS = () => globalThis.__ios === true;');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'np-')), 'np.mjs'); fs.writeFileSync(f, src);
  const N = await import(f);
  let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
  const fake = (perm, opted) => ({ initialize() {}, login() {}, logout() {}, Notifications: { permissionNative: async () => perm, requestPermission: async () => perm === 2 }, User: { pushSubscription: { getOptedInAsync: async () => opted, optIn() { fake.calls.push('in'); }, optOut() { fake.calls.push('out'); } } } });
  fake.calls = [];
  await t('permission mapping', () => { assert.equal(N.mapNativePermission(0), 'unknown'); assert.equal(N.mapNativePermission(1), 'denied'); [2, 3, 4].forEach((x) => assert.equal(N.mapNativePermission(x), 'granted')); });
  await t('web: unsupported, never touches OneSignal', async () => { globalThis.__ios = false; assert.deepEqual(await N.getNativePushState(), { status: 'unsupported', optedIn: false }); assert.equal(await N.requestNativePushPermission(), false); });
  globalThis.__ios = true; globalThis.window = {};
  await t('not asked yet -> unknown', async () => { window.plugins = { OneSignal: fake(0, false) }; assert.deepEqual(await N.getNativePushState(), { status: 'unknown', optedIn: false }); });
  await t('denied -> denied (UI shows Settings guidance)', async () => { window.plugins = { OneSignal: fake(1, false) }; assert.deepEqual(await N.getNativePushState(), { status: 'denied', optedIn: false }); });
  await t('granted + opted in', async () => { window.plugins = { OneSignal: fake(2, true) }; assert.deepEqual(await N.getNativePushState(), { status: 'granted', optedIn: true }); });
  await t('granted but opted out -> off', async () => { window.plugins = { OneSignal: fake(2, false) }; assert.deepEqual(await N.getNativePushState(), { status: 'granted', optedIn: false }); });
  await t('opt out / opt in call the subscription API', () => { N.optOutNativePush(); N.optInNativePush(); assert.deepEqual(fake.calls, ['out', 'in']); });
  const ob = fs.readFileSync(path.join(__dirname, '../src/views/OnboardingView.vue'), 'utf8');
  await t('onboarding uses native permission on iOS', () => assert(/isNativeIOS\(\)[\s\S]{0,200}requestNativePushPermission/.test(ob)));
  const ps = fs.readFileSync(path.join(__dirname, '../src/components/PushSettings.vue'), 'utf8');
  await t('settings has denied handling + opt-out', () => { assert(/push-denied/.test(ps)); assert(/optOutNativePush/.test(ps)); });
  console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
