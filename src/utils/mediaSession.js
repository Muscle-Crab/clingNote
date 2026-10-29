// Media Session API -> iOS Now Playing / Control Center / lock screen (WKWebView iOS 15+), Android & desktop media keys.
// Pure helpers, no-ops where navigator.mediaSession is missing.
import { trackInfo } from './bgPrefs.js';

export const ACTIONS = ['play', 'pause', 'stop', 'nexttrack', 'previoustrack'];
const ms = (nav) => (nav && nav.mediaSession ? nav.mediaSession : null);
const artwork = (base = '/') => [192, 512].map((n) => ({ src: `${base}icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png' }));

export const metadataFor = (id, base = '/') => { const t = trackInfo(id); return { title: t.label, artist: t.artist ? `${t.artist} · ClingNote` : 'ClingNote', album: 'ClingNote Background', artwork: artwork(base) }; };

export const setNowPlaying = (id, nav = typeof navigator !== 'undefined' ? navigator : null, base) => {
  const s = ms(nav); if (!s) return false;
  const m = metadataFor(id, base);
  const MM = typeof window !== 'undefined' ? window.MediaMetadata : undefined;
  try { s.metadata = MM ? new MM(m) : m; } catch (e) { s.metadata = m; }
  return true;
};
export const setPlaybackState = (state, nav = typeof navigator !== 'undefined' ? navigator : null) => { const s = ms(nav); if (!s) return false; try { s.playbackState = state; } catch (e) { /* old */ } return true; };
export const bindActions = (handlers, nav = typeof navigator !== 'undefined' ? navigator : null) => {
  const s = ms(nav); if (!s || !s.setActionHandler) return [];
  const bound = [];
  ACTIONS.forEach((a) => { if (!handlers[a]) return; try { s.setActionHandler(a, () => handlers[a]()); bound.push(a); } catch (e) { /* unsupported action */ } });
  return bound;
};
