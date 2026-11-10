// iOS audio session (navigator.audioSession, WebKit 16.4+). Native iOS only.
// Default 'ambient': sfx, voice lines and other in-app sounds mix with the user's music/podcasts instead of cutting them off.
// WebKit's 'playback' type is NOT mixable (it interrupts Spotify/Apple Music), so it is used only while the in-app focus music
// plays AND no other app is playing audio. If the user's own music is on, the in-app music stays 'ambient' and mixes.
// The native ClingVoice plugin re-asserts AVAudioSession .playback + .mixWithOthers after every in-app sound (ensureMix),
// because WebKit may switch the shared session to a non-mixable category when a web <audio>/Web Audio source starts.
// No imports (loads under plain node tests): the Capacitor bridge global tells us we are in the iOS shell.
const isNativeIOS = () => { try { const C = typeof window !== 'undefined' && window.Capacitor; return !!(C && C.getPlatform && C.getPlatform() === 'ios'); } catch (e) { return false; } };
let music = false; let otherBusy = false; let audible = false; let sharedCtx = null;
const sess = () => { try { return isNativeIOS() && typeof navigator !== 'undefined' && navigator.audioSession ? navigator.audioSession : null; } catch (e) { return null; } };
const set = (t) => { const s = sess(); if (!s) return; try { if (s.type !== t) s.type = t; } catch (e) { /* unsupported */ } };
const plugin = () => { try { const P = isNativeIOS() && window.Capacitor.Plugins && window.Capacitor.Plugins.ClingVoice; return P || null; } catch (e) { return null; } };
const call = (name, arg) => { const P = plugin(); if (!P || !P[name]) return null; try { const r = P[name](arg); if (r && r.catch) r.catch(() => {}); return r; } catch (e) { return null; } };
// Pure: which WebKit session type to use.
export const sessionTypeFor = ({ music: m = false, otherAudio = false } = {}) => (m && !otherAudio ? 'playback' : 'ambient');
// Changing navigator.audioSession.type while Web Audio is already running suspends that context.
// The type is chosen once, from the last known "other app" flag, before the context resumes.
const apply = () => { if (audible && music) return; set(sessionTypeFor({ music, otherAudio: otherBusy })); };
export const markMusicAudible = (on) => { audible = !!on; };
// Ask iOS whether another app (Spotify, podcasts) is playing. Resolves false off iOS / without the plugin.
export const refreshOtherAudio = () => { const r = call('otherAudioPlaying'); if (!r || !r.then) { otherBusy = false; return Promise.resolve(false); } return r.then((x) => { otherBusy = !!(x && x.playing); apply(); return otherBusy; }, () => false); };
export const otherAudioBusy = () => otherBusy;
export const initAudioSession = () => { set('ambient'); call('ensureMix'); refreshOtherAudio(); };
// Before sfx / voice playback: mixable web session + mixable native category.
export const ensureAmbient = () => {
  if (music) return; // a session change here is what cut the focus music on every UI sound
  set('ambient'); call('ensureMix');
};
// Also tells the native ClingVoice plugin, so it never deactivates the session under the music.
// Foreground return: reactivate the mixable session only when this process already started music.
// Does not create an audio context and does not declare a background mode.
export const prepareForegroundPlayback = () => {
  if (!music) return Promise.resolve(false);
  const r = call('prepareForegroundMusic');
  if (!r || !r.then) return Promise.resolve(false);
  return r.then((x) => !!(x && x.active), () => false);
};
export const setMusicPlaying = (on) => {
  const was = music; music = !!on;
  if (!music) audible = false;
  apply(); // cached decision, same turn as the tap. A later refresh must not retarget a live context.
  if (music) refreshOtherAudio(); else call('ensureMix');
  if (was !== music) call('setMusicPlaying', { playing: music });
};
export const musicPlaying = () => music;
// Focus-music AudioContext, registered by useBackground. Sound effects reuse it so a second
// context cannot suspend the music (iOS does that on every new AudioContext).
let musicCtx = () => null;
export const setMusicContext = (fn) => { musicCtx = typeof fn === 'function' ? fn : () => null; };
// One AudioContext for the whole app. A second one suspends the music context on iOS.
export const sharedAudioContext = ({ fresh = false } = {}) => {
  try {
    if (!fresh && sharedCtx && sharedCtx.state !== 'closed' && sharedCtx.state !== 'interrupted') return sharedCtx;
    if (sharedCtx && sharedCtx.state !== 'closed') { try { sharedCtx.close(); } catch (e) { /* gone */ } }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    sharedCtx = new AC();
    return sharedCtx;
  } catch (e) { return null; }
};
export const musicContext = () => {
  try {
    const owned = musicCtx() || null;
    if (owned && owned.state !== 'closed') return owned;
    return sharedCtx && sharedCtx.state !== 'closed' ? sharedCtx : null;
  } catch (e) { return null; }
};
// Dictation / speech ended (web Speech API or native): the focus music resumes itself unless the user paused it (useBackground listens).
export const audioRestored = (reason = '') => { try { if (typeof window !== 'undefined') window.dispatchEvent(new window.CustomEvent('cn:audio-restored', { detail: { reason } })); } catch (e) { /* old engine */ } };
