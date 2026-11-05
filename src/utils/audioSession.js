// iOS audio session (navigator.audioSession, WebKit 16.4+). Native iOS only.
// Default 'ambient': sfx, voice lines and other in-app sounds mix with the user's music/podcasts instead of cutting them off.
// WebKit's 'playback' type is NOT mixable (it interrupts Spotify/Apple Music), so it is used only while the in-app focus music
// plays AND no other app is playing audio. If the user's own music is on, the in-app music stays 'ambient' and mixes.
// The native ClingVoice plugin re-asserts AVAudioSession .playback + .mixWithOthers after every in-app sound (ensureMix),
// because WebKit may switch the shared session to a non-mixable category when a web <audio>/Web Audio source starts.
// No imports (loads under plain node tests): the Capacitor bridge global tells us we are in the iOS shell.
const isNativeIOS = () => { try { const C = typeof window !== 'undefined' && window.Capacitor; return !!(C && C.getPlatform && C.getPlatform() === 'ios'); } catch (e) { return false; } };
let music = false; let otherBusy = false;
const sess = () => { try { return isNativeIOS() && typeof navigator !== 'undefined' && navigator.audioSession ? navigator.audioSession : null; } catch (e) { return null; } };
const set = (t) => { const s = sess(); if (!s) return; try { if (s.type !== t) s.type = t; } catch (e) { /* unsupported */ } };
const plugin = () => { try { const P = isNativeIOS() && window.Capacitor.Plugins && window.Capacitor.Plugins.ClingVoice; return P || null; } catch (e) { return null; } };
const call = (name, arg) => { const P = plugin(); if (!P || !P[name]) return null; try { const r = P[name](arg); if (r && r.catch) r.catch(() => {}); return r; } catch (e) { return null; } };
// Pure: which WebKit session type to use.
export const sessionTypeFor = ({ music: m = false, otherAudio = false } = {}) => (m && !otherAudio ? 'playback' : 'ambient');
const apply = () => set(sessionTypeFor({ music, otherAudio: otherBusy }));
// Ask iOS whether another app (Spotify, podcasts) is playing. Resolves false off iOS / without the plugin.
export const refreshOtherAudio = () => { const r = call('otherAudioPlaying'); if (!r || !r.then) { otherBusy = false; return Promise.resolve(false); } return r.then((x) => { otherBusy = !!(x && x.playing); apply(); return otherBusy; }, () => false); };
export const otherAudioBusy = () => otherBusy;
export const initAudioSession = () => { set('ambient'); call('ensureMix'); refreshOtherAudio(); };
// Before sfx / voice playback: mixable web session + mixable native category.
export const ensureAmbient = () => { if (!music || otherBusy) set('ambient'); call('ensureMix'); };
// Also tells the native ClingVoice plugin, so it never deactivates the session under the music.
export const setMusicPlaying = (on) => {
  const was = music; music = !!on;
  set('ambient'); // start mixable; upgrade to 'playback' (lock-screen playback) only if nothing else is playing
  if (music) refreshOtherAudio(); else call('ensureMix');
  if (!plugin()) apply(); // web / no plugin: previous behaviour
  if (was !== music) call('setMusicPlaying', { playing: music });
};
export const musicPlaying = () => music;
// Focus-music AudioContext, registered by useBackground. Sound effects reuse it so a second
// context cannot suspend the music (iOS does that on every new AudioContext).
let musicCtx = () => null;
export const setMusicContext = (fn) => { musicCtx = typeof fn === 'function' ? fn : () => null; };
export const musicContext = () => { try { return musicCtx() || null; } catch (e) { return null; } };
// Dictation / speech ended (web Speech API or native): the focus music resumes itself unless the user paused it (useBackground listens).
export const audioRestored = (reason = '') => { try { if (typeof window !== 'undefined') window.dispatchEvent(new window.CustomEvent('cn:audio-restored', { detail: { reason } })); } catch (e) { /* old engine */ } };
