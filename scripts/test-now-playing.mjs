// Voice must never leave a lock-screen Now Playing player behind; focus music owns it (ClingNote / Focus music) and clears it on stop.
import assert from 'assert'; import { readFileSync, existsSync } from 'fs'; import { register } from 'module'; import { pathToFileURL } from 'url';
// resolve the app's '@/x' alias (and extension-less paths) to src/ so the real composables load under plain node
const SRC = pathToFileURL(`${process.cwd()}/src/`).href;
register(`data:text/javascript,${encodeURIComponent(`export async function resolve(s, c, n) { if (s.startsWith('@/')) s = ${JSON.stringify(SRC)} + s.slice(2);
  if (s.startsWith('file:') && !/\\.[a-z]+$/.test(s)) { try { return await n(s + '.js', c); } catch (e) { return n(s + '/index.js', c); } } return n(s, c); }`)}`);
// minimal browser shims
class FakeAudio { constructor() { this.attrs = {}; this.paused = true; this.loads = 0; this.volume = 1; } set src(v) { this.attrs.src = v; } get src() { return this.attrs.src || ''; }
  getAttribute(k) { return this.attrs[k] ?? null; } removeAttribute(k) { delete this.attrs[k]; } load() { this.loads++; } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } addEventListener() {} }
const handlers = {}; const session = { metadata: 'x', playbackState: 'playing', setActionHandler: (k, f) => { handlers[k] = f; } };
globalThis.Audio = FakeAudio; Object.defineProperty(globalThis, 'navigator', { value: { mediaSession: session }, configurable: true }); globalThis.window = { MediaMetadata: class { constructor(o) { Object.assign(this, o); } } };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const vo = await import('../src/composables/useVoiceover.js'); const fm = await import('../src/composables/useFocusMusic.js');
let nativeReleases = 0; vo._setNativeRelease(() => { nativeReleases++; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 1) voice ends/cancels with no music -> session cleared, element detached, native release once (debounced)
vo.stopVoice(); assert.equal(session.metadata, null); assert.equal(session.playbackState, 'none');
await wait(vo.RELEASE_DELAY_MS + 50); assert.equal(nativeReleases, 1, 'native Now Playing/session release after speech');
// 2) music: widget metadata, lock-screen play/pause work
assert.equal(fm.startMusic(), true); await wait(0);
assert.equal(session.metadata.title, 'ClingNote'); assert.equal(session.metadata.artist, 'Focus music'); assert.equal(session.playbackState, 'playing');
const el = fm._el(); assert.equal(el.loop, true); assert.equal(el.volume, fm.MUSIC_VOL);
handlers.pause(); assert.equal(el.paused, true); assert.equal(session.playbackState, 'paused');
handlers.play(); assert.equal(el.paused, false); assert.equal(session.playbackState, 'playing');
// 3) voice while music: ducks, and finishing speech does NOT clear the music widget or deactivate natively
vo.voSpeaking.value = true; await wait(0); assert.equal(el.volume, fm.DUCK_VOL, 'ducks under voice');
vo.stopVoice(); await wait(0); assert.equal(el.volume, fm.MUSIC_VOL); assert.equal(session.metadata.title, 'ClingNote');
await wait(vo.RELEASE_DELAY_MS + 50); assert.equal(nativeReleases, 1, 'no native release while music plays');
// 4) mute stops music; stop clears Now Playing + native release
fm.startMusic(); vo.setVoMuted(true); await wait(0); assert.equal(fm.musicOn.value, false); assert.equal(el.getAttribute('src'), null);
assert.equal(session.metadata, null); await wait(vo.RELEASE_DELAY_MS + 50); assert.equal(nativeReleases, 2);
assert.equal(fm.startMusic(), false, 'muted -> no music'); vo.setVoMuted(false);
// static wiring
const sw = readFileSync('ios/App/App/ClingVoicePlugin.swift', 'utf8');
for (const k of ['nowPlayingInfo = nil', 'endReceivingRemoteControlEvents', 'notifyOthersOnDeactivation', 'isEnabled = false', '"releaseAudio"']) assert(sw.includes(k), k);
assert(!/releaseNowPlaying\(\)/.test(readFileSync('ios/App/App/AppDelegate.swift', 'utf8')), 'no background teardown of music');
assert(!/AVAudio/.test(readFileSync('ios/App/App/ClingAlarmPlugin.swift', 'utf8')), 'alarm uses AlarmKit system audio, independent');
const sh = readFileSync('src/components/home/AssistantSheet.vue', 'utf8');
assert(/onMounted\(\(\) => \{ if \(speak\.value\) startMusic\(\)/.test(sh) && /onBeforeUnmount\(\(\) => \{[^\n]*stopMusic\(\)/.test(sh) && /if \(v\) pauseMusic\(\)/.test(sh));
assert(readFileSync('ios/App/App/Info.plist', 'utf8').includes('<string>audio</string>'));
console.log('ok   now playing / focus music');
process.exit(0);
