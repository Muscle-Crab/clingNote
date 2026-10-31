// Run: node scripts/test-att-tracking.mjs  (ATT flow with a mocked native bridge + static checks of the iOS side; no device, no network)
import fs from 'fs'; import assert from 'assert'; import { fileURLToPath } from 'url'; import path from 'path';
import { maybeAskTracking, ATT_ASKED_KEY } from '../src/utils/tracking.js';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let n = 0; const t = async (name, f) => { await f(); n++; console.log('ok -', name); };
const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
// Mock of ClingNative + an iOS-like ATT manager: prompts only while notDetermined; SDK init records IDFA presence.
const mockNative = (initial, answer) => {
  const s = { status: initial, prompts: 0, sdk: { tiktokInits: 0, idfa: null, events: [] } };
  const startSdks = () => { if (s.sdk.tiktokInits) return; s.sdk.tiktokInits++; s.sdk.idfa = s.status === 'authorized' ? 'IDFA' : '00000000-0000-0000-0000-000000000000'; s.sdk.events.push('InstallApp'); };
  return { s, startSdks, native: {
    trackingStatus: async () => ({ status: s.status }),
    requestTracking: async () => { if (s.status === 'notDetermined') { s.prompts++; s.status = answer; } startSdks(); return { status: s.status }; },
  } };
};
const nowait = { delayMs: 0 };
await t('authorized: prompt once, SDK init with IDFA, InstallApp once', async () => {
  const st = store(); const m = mockNative('notDetermined', 'authorized');
  const r = await maybeAskTracking({ native: m.native, storage: st, ...nowait });
  assert.deepStrictEqual(r, { asked: true, status: 'authorized' }); assert.equal(m.s.prompts, 1); assert.equal(m.s.sdk.idfa, 'IDFA');
  await maybeAskTracking({ native: m.native, storage: st, ...nowait }); m.startSdks();
  assert.equal(m.s.prompts, 1); assert.deepStrictEqual(m.s.sdk.events, ['InstallApp']); assert.equal(st.getItem(ATT_ASKED_KEY), 'authorized');
});
for (const ans of ['denied', 'restricted']) await t(`${ans}: SDK still inits without IDFA, no repeat prompt`, async () => {
  const st = store(); const m = mockNative('notDetermined', ans);
  const r = await maybeAskTracking({ native: m.native, storage: st, ...nowait });
  assert.equal(r.status, ans); assert.equal(m.s.sdk.tiktokInits, 1); assert.match(m.s.sdk.idfa, /^0{8}-/);
  for (let i = 0; i < 3; i++) await maybeAskTracking({ native: m.native, storage: st, ...nowait });
  assert.equal(m.s.prompts, 1);
});
await t('already decided (restricted by MDM / answered earlier): never prompts', async () => {
  const m = mockNative('restricted', 'authorized'); const st = store();
  const r = await maybeAskTracking({ native: m.native, storage: st, ...nowait }); assert.equal(r.asked, false); assert.equal(m.s.prompts, 0);
});
await t('web / no plugin / bridge throws: no crash, no prompt', async () => {
  assert.equal((await maybeAskTracking({ native: null, storage: store() })).asked, false);
  const bad = { trackingStatus: async () => { throw new Error('boom'); }, requestTracking: async () => { throw new Error('x'); } };
  assert.equal((await maybeAskTracking({ native: bad, storage: store(), ...nowait })).status, 'error');
  assert.equal((await maybeAskTracking({ native: { trackingStatus: async () => ({ status: 'unavailable' }) }, storage: store() })).asked, false);
});
await t('notDetermined left pending (app killed mid-prompt) is not re-asked by JS; native start() covers TikTok next launch', async () => {
  const st = store(); st.setItem(ATT_ASKED_KEY, 'pending'); const m = mockNative('notDetermined', 'authorized');
  assert.equal((await maybeAskTracking({ native: m.native, storage: st, ...nowait })).status, 'skipped');
});
await t('delay before prompt (Home renders first)', async () => {
  const waits = []; const m = mockNative('notDetermined', 'denied');
  await maybeAskTracking({ native: m.native, storage: store(), delayMs: 1500, wait: async (ms) => waits.push(ms) }); assert.deepStrictEqual(waits, [1500]);
});
// ---- static checks: native side
const ia = rd('ios/App/App/InstallAttribution.swift'); const plist = rd('ios/App/App/Info.plist'); const plug = rd('ios/App/App/ClingNativePlugin.swift');
await t('prompt is not on cold launch: start() never requests ATT; only HomeView triggers it', async () => {
  const start = ia.slice(ia.indexOf('static func start()'), ia.indexOf('static func requestTracking'));
  assert(!/requestTrackingAuthorization|requestTracking\(/.test(start)); assert(!/requestTracking/.test(rd('ios/App/App/AppDelegate.swift')));
  const home = rd('src/views/HomeView.vue'); assert(/maybeAskTracking\(\{ native: clingNative/.test(home));
  for (const v of ['src/views/WelcomeView.vue', 'src/views/OnboardingView.vue', 'src/App.vue', 'src/main.js']) if (fs.existsSync(path.join(root, v))) assert(!/maybeAskTracking|requestTracking/.test(rd(v)), v);
});
await t('TikTok waits for ATT decision, inits once, IDFA read only by SDK when authorized', async () => {
  assert(/if trackingStatus\(\) != "notDetermined" \|\| UserDefaults\.standard\.bool\(forKey: attAskedKey\) \{ startTikTok\(\) \}/.test(ia)); assert(/guard !tiktokStarted else \{ return \}/.test(ia));
  assert(/ATTrackingManager\.requestTrackingAuthorization \{ _ in finish\(\) \}/.test(ia)); assert(/startTikTok\(\); done\(trackingStatus\(\)\)/.test(ia));
  assert(!/advertisingIdentifier/.test(ia), 'app never reads IDFA itself');
});
await t('Firebase: IdentitySupport linked + ADID collection on (SDK gates on ATT)', async () => {
  assert(/productName = FirebaseAnalyticsIdentitySupport;/.test(rd('ios/App/App.xcodeproj/project.pbxproj')));
  assert(/GOOGLE_ANALYTICS_ADID_COLLECTION_ENABLED<\/key>\s*<true\/>/.test(plist)); assert(/FirebaseApp\.configure\(\)/.test(ia));
});
await t('Info.plist: honest ATT text, SKAN ids, Reddit ping flag OFF', async () => {
  assert(/NSUserTrackingUsageDescription<\/key>\s*<string>ClingNote uses this to see which ads brought you to the app\.<\/string>/.test(plist));
  assert(/22mmun2rn5\.skadnetwork/.test(plist)); assert(/ClingRedditPingEnabled<\/key>\s*<false\/>/.test(plist));
});
await t('Reddit ping disabled: gated in start() and inside the sender (sent flag never set)', async () => {
  assert(/if redditPingEnabled\(\) \{ sendRedditFirstOpenOnce\(\) \}/.test(ia));
  const send = ia.slice(ia.indexOf('static func sendRedditFirstOpenOnce')); assert(send.indexOf('guard redditPingEnabled()') < send.indexOf('redditSentKey'));
  assert(/\?\? false/.test(ia.slice(ia.indexOf('func redditPingEnabled'))), 'missing key = off');
});
await t('plugin exposes trackingStatus/requestTracking', async () => {
  assert(/name: "requestTracking"/.test(plug) && /@objc func requestTracking/.test(plug) && /name: "trackingStatus"/.test(plug));
});
await t('privacy manifest: tracking true, DeviceID + ProductInteraction used for tracking / 3rd-party ads', async () => {
  const p = rd('ios/App/App/PrivacyInfo.xcprivacy'); assert(/NSPrivacyTracking<\/key>\s*<true\/>/.test(p));
  for (const ty of ['DeviceID', 'ProductInteraction']) { const b = p.slice(p.indexOf(`DataType${ty}<`)); const blk = b.slice(0, b.indexOf('</dict>'));
    assert(/Tracking<\/key>\s*<true\/>/.test(blk), ty); assert(/PurposeThirdPartyAdvertising/.test(blk), ty); }
});
console.log(`\n${n} ATT tracking tests passed`);
