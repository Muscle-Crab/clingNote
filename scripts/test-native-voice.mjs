// Run: node scripts/test-native-voice.mjs  (iOS voice task creation: plugin gate, permissions, live partials, phrase flush, restart, errors; wiring + plist + SPM)
import fs from 'fs'; import path from 'path'; import os from 'os'; import assert from 'assert'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-'));
const avail = { v: false };
fs.writeFileSync(path.join(dir, 'nv.mjs'), rd('src/utils/nativeVoice.js').replace("import { isNativeIOS, setNativeVoiceAvailable } from '@/utils/platform';", 'const isNativeIOS = () => globalThis.__ios === true; const setNativeVoiceAvailable = (b) => { globalThis.__avail = !!b; };'));
const V = await import(path.join(dir, 'nv.mjs'));

// fake plugin with a manual clock
const mkSr = (o = {}) => {
  const L = {}; const calls = []; let perm = o.perm || 'granted';
  const sr = { calls,
    available: async () => { if (o.availThrows) throw new Error('x'); return { available: o.available !== false }; },
    checkPermissions: async () => ({ speechRecognition: perm }),
    requestPermissions: async () => { calls.push('request'); perm = o.grantOnRequest ? 'granted' : 'denied'; return { speechRecognition: perm }; },
    start: async (opts) => { calls.push(['start', opts]); if (o.startErr) throw new Error(o.startErr); },
    stop: async () => { calls.push('stop'); },
    removeAllListeners: async () => { calls.push('removeAll'); Object.keys(L).forEach((k) => delete L[k]); },
    addListener: async (ev, fn) => { L[ev] = fn; return { remove: async () => {} }; },
    emit: (ev, d) => L[ev] && L[ev](d) };
  return sr;
};
const mkClock = () => { let id = 0; const q = new Map(); return { setT: (fn, ms) => { q.set(++id, { fn, ms }); return id; }, clearT: (i) => q.delete(i), run: async () => { const e = [...q.entries()]; q.clear(); for (const [, v] of e) v.fn(); await new Promise((r) => setImmediate(r)); }, size: () => q.size }; };
const tick = () => new Promise((r) => setImmediate(r));

await t('probe: not iOS -> false and untouched; iOS + available -> true; unavailable/throw -> false', async () => {
  globalThis.__ios = false; globalThis.__avail = undefined; assert.equal(await V.probeNativeVoice(async () => mkSr(), () => false), false); assert.equal(globalThis.__avail, undefined);
});
await t('probe: iOS available() true flips the gate on', async () => {
  const src = rd('src/utils/nativeVoice.js'); fs.writeFileSync(path.join(dir, 'nv2.mjs'), src.replace("import { isNativeIOS, setNativeVoiceAvailable } from '@/utils/platform';", 'const isNativeIOS = () => true; const setNativeVoiceAvailable = (b) => { globalThis.__avail = !!b; };'));
  const V2 = await import(path.join(dir, 'nv2.mjs')); assert.equal(await V2.probeNativeVoice(async () => mkSr()), true); assert.equal(globalThis.__avail, true);
  fs.writeFileSync(path.join(dir, 'nv3.mjs'), src.replace("import { isNativeIOS, setNativeVoiceAvailable } from '@/utils/platform';", 'const isNativeIOS = () => true; const setNativeVoiceAvailable = (b) => { globalThis.__avail = !!b; };') + '\n// 3');
  const V3 = await import(path.join(dir, 'nv3.mjs')); assert.equal(await V3.probeNativeVoice(async () => mkSr({ available: false })), false); assert.equal(globalThis.__avail, false);
  fs.writeFileSync(path.join(dir, 'nv4.mjs'), src.replace("import { isNativeIOS, setNativeVoiceAvailable } from '@/utils/platform';", 'const isNativeIOS = () => true; const setNativeVoiceAvailable = (b) => { globalThis.__avail = !!b; };') + '\n// 4');
  const V4 = await import(path.join(dir, 'nv4.mjs')); assert.equal(await V4.probeNativeVoice(async () => mkSr({ availThrows: true })), false); assert.equal(globalThis.__avail, false);
});
await t('permission: denied -> clear Settings message, never starts; prompt -> request once; granted -> ok', async () => {
  let err = ''; let sr = mkSr({ perm: 'denied' }); let s = V.createNativeVoice(sr, { onError: (m) => { err = m; } });
  assert.equal(await s.start(), false); assert.equal(err, V.MSG_DENIED); assert.ok(/Settings/.test(err)); assert.ok(!sr.calls.some((c) => Array.isArray(c) && c[0] === 'start'));
  err = ''; sr = mkSr({ perm: 'prompt' }); s = V.createNativeVoice(sr, { onError: (m) => { err = m; } }); assert.equal(await s.start(), false); assert.deepEqual(sr.calls.filter((c) => c === 'request'), ['request']); assert.equal(err, V.MSG_DENIED);
  err = ''; sr = mkSr({ perm: 'prompt', grantOnRequest: true }); s = V.createNativeVoice(sr, { onError: (m) => { err = m; } }); assert.equal(await s.start(), true); assert.equal(err, '');
});
await t('start passes language + partialResults:true + popup:false; partials stream live; a pause flushes ONE phrase', async () => {
  const sr = mkSr(); const ck = mkClock(); const phrases = []; const live = []; const s = V.createNativeVoice(sr, { language: 'en-GB', onPartial: (x) => live.push(x), onPhrase: (x) => phrases.push(x), setT: ck.setT, clearT: ck.clearT });
  assert.equal(await s.start(), true); const st = sr.calls.find((c) => Array.isArray(c))[1]; assert.equal(st.language, 'en-GB'); assert.equal(st.partialResults, true); assert.equal(st.popup, false);
  sr.emit('partialResults', { matches: ['call'] }); sr.emit('partialResults', { matches: ['call mom'] }); assert.deepEqual(live.slice(0, 2), ['call', 'call mom']);
  await ck.run(); // silence timer
  assert.deepEqual(phrases, ['call mom']); assert.ok(sr.calls.includes('stop'), 'recognizer stopped so the next phrase starts clean');
});
await t('recognizer ending a phrase itself (stopped event) saves the text and restarts hands-free', async () => {
  const sr = mkSr(); const ck = mkClock(); const phrases = []; const s = V.createNativeVoice(sr, { onPhrase: (x) => phrases.push(x), setT: ck.setT, clearT: ck.clearT });
  await s.start(); sr.emit('partialResults', { matches: ['buy milk and then walk the dog'] }); sr.emit('listeningState', { status: 'stopped' });
  assert.deepEqual(phrases, ['buy milk and then walk the dog']); await ck.run(); assert.equal(sr.calls.filter((c) => Array.isArray(c)).length, 2, 'restarted');
});
await t('repeated empty rounds stop with a friendly message (no infinite restart loop)', async () => {
  const sr = mkSr(); const ck = mkClock(); let err = ''; const s = V.createNativeVoice(sr, { onError: (m) => { err = m; }, setT: ck.setT, clearT: ck.clearT });
  await s.start(); for (let i = 0; i < 5 && !err; i++) { sr.emit('listeningState', { status: 'stopped' }); await ck.run(); }
  assert.equal(err, V.MSG_NOTHING); assert.equal(s.isActive(), false);
});
await t('start() rejection maps to permission / unavailable / generic messages', async () => {
  for (const [e, m] of [['Missing speech recognition permission.', V.MSG_DENIED], ['User denied microphone access.', V.MSG_DENIED], ['Speech recognizer is currently unavailable.', V.MSG_UNAVAILABLE], ['boom', V.MSG_FAILED]]) {
    let err = ''; const s = V.createNativeVoice(mkSr({ startErr: e }), { onError: (x) => { err = x; } }); assert.equal(await s.start(), false); assert.equal(err, m, e);
  }
});
await t('stop() discards the half-heard text, stops the recognizer and removes listeners', async () => {
  const sr = mkSr(); const phrases = []; const s = V.createNativeVoice(sr, { onPhrase: (x) => phrases.push(x) }); await s.start(); sr.emit('partialResults', { matches: ['half heard'] });
  await s.stop(); sr.emit('listeningState', { status: 'stopped' }); assert.deepEqual(phrases, []); assert.ok(sr.calls.includes('stop')); assert.ok(sr.calls.filter((c) => c === 'removeAll').length >= 2);
});

// wiring + config
await t('web SpeechRecognition path is unchanged and only created outside the iOS shell', () => {
  const h = rd('src/views/HomeView.vue');
  assert(/if \(voiceSupported && !nativeVoiceShell\) \{\s*const SpeechRecognition = window\.SpeechRecognition \|\| window\.webkitSpeechRecognition;/.test(h));
  assert(/recognition\.continuous = voiceCap !== 'partial'/.test(h) && /recognition\.onresult = /.test(h));
  assert(/if \(nativeVoiceShell\) \{ startNativeVoice\(\); return; \}/.test(h)); assert(/onPhrase: \(t\) => saveSpoken\(t\)/.test(h), 'same downstream splitting/add path');
  assert(/:show-voice="!voiceBlocked"/.test(h) && /const voiceBlocked = computed\(\(\) => voiceInputBlocked\(\)\)/.test(h));
});
await t('voice gate: iOS blocked until the plugin is available; web never blocked', () => {
  const p = rd('src/utils/platform.js'); assert(/export const voiceInputBlocked = \(\) => isNativeIOS\(\) && !nativeVoiceAvailable\.value;/.test(p));
  assert(/probeNativeVoice\(\)/.test(rd('src/main.js')));
  const l = rd('src/views/landing.vue'); assert(/voiceInputBlocked\(\) && \/Voice-Controlled\//.test(l) && /isNativeIOS\(\) && \/Voice Notes\//.test(l));
});
await t('Info.plist has honest mic + speech usage strings; plugin is the SPM-compatible capgo build (community 7.x is CocoaPods-only)', () => {
  const x = rd('ios/App/App/Info.plist'); assert(/NSMicrophoneUsageDescription<\/key>\s*<string>[^<]{30,}</.test(x)); assert(/NSSpeechRecognitionUsageDescription<\/key>\s*<string>[^<]{30,}</.test(x));
  const pk = JSON.parse(rd('package.json')); assert(pk.dependencies['@capgo/capacitor-speech-recognition'], 'capgo plugin'); assert(!pk.dependencies['@capacitor-community/speech-recognition'], 'community 7.x has no Package.swift');
  const sw = rd('ios/App/CapApp-SPM/Package.swift'); assert(/CapgoCapacitorSpeechRecognition/.test(sw));
  assert(/Voice input:/.test(rd('src/views/privacy-policy.vue')));
});
console.log(`native voice: ${n} checks passed`);
