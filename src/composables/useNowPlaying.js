// iOS lock-screen "Now Playing" for the Home Background music.
// Why this exists: the Background music is pure Web Audio (useBackgroundAudio), and WKWebView only registers HTML media elements
// with Now Playing. So while the music plays we loop an inaudible anchor clip (public/audio/np-anchor.mp3, ~-80 dBFS dither,
// not muted, since muted elements are ignored by iOS) and set navigator.mediaSession metadata: title "ClingNote", subtitle = track name.
// Lock-screen play/pause call back into useBackground. stop() pauses, drops the src, clears mediaSession and asks the native side to clear
// MPNowPlayingInfoCenter / remote commands and deactivate the audio session. Voice lines (useVoiceover) never take over this entry.
const base = (typeof process !== 'undefined' && process.env && process.env.BASE_URL) || '/';
let a = null; let active = false; let handlers = {};
const ms = () => (typeof navigator !== 'undefined' && navigator.mediaSession) || null;
// no MP3 decoder (e.g. Linux WebKit without GStreamer codecs): playing would crash the web process, so skip (see useVoiceover)
const canPlayMp3 = (x) => { try { return typeof x.canPlayType !== 'function' || x.canPlayType('audio/mpeg') !== ''; } catch (e) { return true; } };
const el = () => { if (!a && typeof Audio !== 'undefined') { a = new Audio(); a.loop = true; a.preload = 'auto'; a.volume = 1; } return a; };
const ACTIONS = ['play', 'pause', 'stop'];

function meta(subtitle, state) {
  const s = ms(); if (!s) return;
  try {
    const M = typeof window !== 'undefined' && window.MediaMetadata;
    if (M) s.metadata = new M({ title: 'ClingNote', artist: subtitle || 'Background music', album: 'ClingNote', artwork: [{ src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' }] });
    s.playbackState = state;
    ACTIONS.forEach((k) => { try { s.setActionHandler(k, handlers[k] ? () => handlers[k]() : null); } catch (e) { /* unsupported action */ } });
  } catch (e) { /* ignore */ }
}

// Call from the same tap that starts the music (iOS needs the gesture for media playback).
export function npStart(subtitle, h = {}) {
  handlers = h; active = true;
  const x = el(); if (x && canPlayMp3(x)) { if (!x.getAttribute('src')) x.src = `${base}audio/np-anchor.mp3`; try { const p = x.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
  meta(subtitle, 'playing');
}
export function npTitle(subtitle) { if (active) meta(subtitle, a && !a.paused ? 'playing' : 'paused'); }
// Lock-screen pause: keep the widget (paused) so play works from the lock screen.
export function npPaused(subtitle) { if (!active) return; if (a) { try { a.pause(); } catch (e) { /* ignore */ } } meta(subtitle, 'paused'); }
export function npStop() {
  const was = active; active = false; handlers = {};
  if (a) { try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { /* ignore */ } }
  const s = ms(); if (s) { try { s.metadata = null; s.playbackState = 'none'; ACTIONS.forEach((k) => { try { s.setActionHandler(k, null); } catch (e) { /* ignore */ } }); } catch (e) { /* ignore */ } }
  if (was) import('@/composables/useVoiceover').then((m) => m.releaseMedia()).catch(() => {});
}
export const npActive = () => active;
export const _anchor = () => a; // tests
