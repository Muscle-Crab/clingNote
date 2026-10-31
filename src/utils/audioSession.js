// iOS audio session (navigator.audioSession, WebKit 16.4+). Native iOS only.
// Default 'ambient': sfx, voice lines and other in-app sounds mix with the user's music/podcasts instead of cutting them off.
// 'playback' only while the in-app focus music plays (so it keeps playing on the lock screen), then back to 'ambient'.
// No imports (loads under plain node tests): the Capacitor bridge global tells us we are in the iOS shell.
const isNativeIOS = () => { try { const C = typeof window !== 'undefined' && window.Capacitor; return !!(C && C.getPlatform && C.getPlatform() === 'ios'); } catch (e) { return false; } };
let music = false;
const sess = () => { try { return isNativeIOS() && typeof navigator !== 'undefined' && navigator.audioSession ? navigator.audioSession : null; } catch (e) { return null; } };
const set = (t) => { const s = sess(); if (!s) return; try { if (s.type !== t) s.type = t; } catch (e) { /* unsupported */ } };
export const initAudioSession = () => set('ambient');
export const ensureAmbient = () => { if (!music) set('ambient'); }; // before sfx / voice playback
// Also tells the native ClingVoice plugin, so it never deactivates the session under the music.
const tellNative = (on) => { try { const P = isNativeIOS() && window.Capacitor.Plugins && window.Capacitor.Plugins.ClingVoice; if (P && P.setMusicPlaying) { const r = P.setMusicPlaying({ playing: on }); if (r && r.catch) r.catch(() => {}); } } catch (e) { /* plugin missing */ } };
export const setMusicPlaying = (on) => { const was = music; music = !!on; set(music ? 'playback' : 'ambient'); if (was !== music) tellNative(music); };
export const musicPlaying = () => music;
