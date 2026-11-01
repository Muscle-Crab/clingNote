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
const vo = await import('../src/composables/useVoiceover.js'); const np = await import('../src/composables/useNowPlaying.js');
let nativeReleases = 0; vo._setNativeRelease(() => { nativeReleases++; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 1) voice ends/cancels with no music -> session cleared, element detached, native release once (debounced)
vo.stopVoice(); assert.equal(session.metadata, null); assert.equal(session.playbackState, 'none');
await wait(vo.RELEASE_DELAY_MS + 50); assert.equal(nativeReleases, 1, 'native Now Playing/session release after speech');
// 2) background music: widget = ClingNote / track name, lock-screen play/pause call back
let calls = []; let holds = false; vo._setMusicHolds(() => holds);
np.npStart('Lo-fi chill', { play: () => calls.push('play'), pause: () => calls.push('pause') }); holds = np.npActive();
assert.equal(session.metadata.title, 'ClingNote'); assert.equal(session.metadata.artist, 'Lo-fi chill'); assert.equal(session.playbackState, 'playing');
const anchor = np._anchor(); assert.equal(anchor.loop, true); assert(!anchor.muted, 'anchor not muted (iOS ignores muted media)'); assert(anchor.src.endsWith('audio/np-anchor.mp3'));
handlers.pause(); handlers.play(); assert.deepEqual(calls, ['pause', 'play']);
np.npPaused('Lo-fi chill'); assert.equal(session.playbackState, 'paused'); assert.equal(session.metadata.title, 'ClingNote', 'lock-screen pause keeps widget');
np.npTitle('Jazzy lo-fi'); assert.equal(session.metadata.artist, 'Jazzy lo-fi');
// 3) voice while music holds: finishing speech does NOT clear the widget or deactivate natively
vo.stopVoice(); assert.equal(session.metadata.title, 'ClingNote');
await wait(vo.RELEASE_DELAY_MS + 50); assert.equal(nativeReleases, 1, 'no native release while music holds Now Playing');
// 4) stop clears everything + native release
np.npStop(); holds = np.npActive(); assert.equal(session.metadata, null); assert.equal(session.playbackState, 'none'); assert.equal(anchor.getAttribute('src'), null);
await wait(vo.RELEASE_DELAY_MS + 100); assert.equal(nativeReleases, 2, 'stop -> native clear');
const bg = readFileSync('src/composables/useBackground.js', 'utf8');
assert(/npStart\(trackName\(\), lockHandlers\(\)\)/.test(bg) && /else npStop\(\)/.test(bg) && /watch\(voSpeaking/.test(bg) && /DUCK/.test(bg), 'background music wired to Now Playing + ducking');
// static wiring
const sw = readFileSync('ios/App/App/ClingVoicePlugin.swift', 'utf8');
for (const k of ['nowPlayingInfo = nil', 'endReceivingRemoteControlEvents', 'notifyOthersOnDeactivation', 'isEnabled = false', '"releaseAudio"']) assert(sw.includes(k), k);
assert(!/releaseNowPlaying\(\)/.test(readFileSync('ios/App/App/AppDelegate.swift', 'utf8')), 'no background teardown of music');
assert(!/AVAudio/.test(readFileSync('ios/App/App/ClingAlarmPlugin.swift', 'utf8')), 'alarm uses AlarmKit system audio, independent');
assert(readFileSync('ios/App/App/Info.plist', 'utf8').includes('<string>audio</string>'));
console.log('ok   now playing / background music');
process.exit(0);
