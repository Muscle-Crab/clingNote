// Run: node scripts/test-music-interrupt.mjs  (focus music stops only via its own pause; dictation/TTS/OS interruptions resume it)
// Source-contract test: the iOS plugin and the WebView glue can't run under node, so assert the wiring that the fix depends on.
import fs from 'fs'; import path from 'path'; import assert from 'assert'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const swift = rd('ios/App/App/ClingVoicePlugin.swift'), bg = rd('src/composables/useBackground.js'), as = rd('src/utils/audioSession.js');
t('dictation session is mixable (does not interrupt the music)', () => {
  const m = swift.match(/setCategory\(\.playAndRecord[^\n]*/); assert(m, 'playAndRecord set');
  assert(/\.mixWithOthers/.test(m[0]) && !/\.measurement|\.duckOthers/.test(m[0]), m[0]);
});
t('native: interruption observer + audioRestored after dictation/speech', () => {
  assert(/interruptionNotification/.test(swift)); assert(/notifyListeners\("audioInterruption"/.test(swift));
  assert((swift.match(/notifyListeners\("audioRestored"/g) || []).length >= 2);
  assert(/private func teardown[\s\S]*?restoreAfterCapture\("dictation"\)/.test(swift));
});
t('JS: resume only if the user did not pause', () => {
  assert(/export const audioRestored/.test(as) && /cn:audio-restored/.test(as));
  const f = bg.slice(bg.indexOf('export const resumeAfterInterruption'));
  assert(/^export const resumeAfterInterruption = \(\) => \{\n\s+if \(!prefs\.musicOn\) return/.test(f), 'musicOn guard first');
  assert(/addEventListener\('cn:audio-restored'/.test(bg) && /addListener\('audioRestored'/.test(bg) && /addListener\('audioInterruption'/.test(bg));
  assert(/st === 'running'\) \{ if \(prefs\.musicOn/.test(bg), 'context back to running -> playing again');
});
t('every dictation end path signals audio-restored', () => {
  for (const p of ['src/components/home/AskSheet.vue', 'src/components/home/AssistantSheet.vue', 'src/views/HomeView.vue']) assert(/audioRestored\('dictation'\)/.test(rd(p)), p);
});
t('a context blip resumes music instead of pausing the anchor', () => {
  const s = bg.slice(bg.indexOf('const syncReal'), bg.indexOf('const onCtxState'));
  assert(/if \(!prefs\.musicOn\) return/.test(s));
  assert(/resumeAfterInterruption\(\)/.test(s));
  assert(!/npPaused\(/.test(s), 'syncReal must not pause the Now Playing anchor');
  assert(/setMusicContext\(/.test(bg) && /musicContext\(/.test(rd('src/utils/sfx.js')) && /musicContext\(/.test(rd('src/composables/useSounds.js')));
  assert(/audioRestored\('notification'\)/.test(rd('src/utils/localNotify.js')));
});
t('pause() is still the only thing that turns musicOn off', () => {
  const offs = bg.split('\n').filter((l) => /prefs\.musicOn = false/.test(l)); assert(offs.length >= 1);
  assert(!/resumeAfterInterruption[\s\S]{0,900}prefs\.musicOn = false/.test(bg.slice(bg.indexOf('export const resumeAfterInterruption'), bg.indexOf('export const resumeAfterInterruption') + 900)));
});
console.log(`${n} tests passed`);
