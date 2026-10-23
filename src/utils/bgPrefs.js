// "Background" settings (animation + music), saved per device in localStorage. Default = the current static look.
export const KEY = 'clingnot_background_v1';
export const ANIMS = [{ id: 'none', label: 'None', icon: '🚫' }, { id: 'snow', label: 'Snow', icon: '❄️' }, { id: 'rain', label: 'Rain', icon: '🌧️' }, { id: 'fire', label: 'Fireplace', icon: '🔥' }];
export const TRACKS = [
  { id: 'lofi', label: 'Lo-fi chill', hint: 'Mellow keys, soft beat, vinyl dust' },
  { id: 'lofi-night', label: 'Lo-fi night', hint: 'Slow, drum-free late-night keys' },
  { id: 'ambient', label: 'Ambient drift', hint: 'Warm evolving pads' },
  { id: 'fireside', label: 'Fireside crackle', hint: 'Soft crackling fire sounds' },
];
export const DEFAULTS = Object.freeze({ anim: 'none', track: 'lofi', volume: 0.5, forceMotion: false });
const clamp01 = (n) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : DEFAULTS.volume));
export const sanitize = (p) => {
  const o = p && typeof p === 'object' ? p : {};
  return {
    anim: ANIMS.some((a) => a.id === o.anim) ? o.anim : DEFAULTS.anim,
    track: TRACKS.some((t) => t.id === o.track) ? o.track : DEFAULTS.track,
    volume: clamp01(Number(o.volume)),
    forceMotion: o.forceMotion === true, // "play anyway" when the device asks for reduced motion
  };
};
export const loadPrefs = (storage = typeof localStorage !== 'undefined' ? localStorage : null) => {
  try { return sanitize(JSON.parse(storage.getItem(KEY) || 'null')); } catch (e) { return { ...DEFAULTS }; }
};
export const savePrefs = (p, storage = typeof localStorage !== 'undefined' ? localStorage : null) => { try { storage.setItem(KEY, JSON.stringify(sanitize(p))); } catch (e) { /* private mode */ } };
