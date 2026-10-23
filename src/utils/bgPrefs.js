// "Background" settings (animation + music), saved per device in localStorage. Default = the current static look.
export const KEY = 'clingnot_background_v1';
export const ANIMS = [{ id: 'none', label: 'None', icon: '🚫' }, { id: 'snow', label: 'Snow', icon: '❄️' }, { id: 'rain', label: 'Rain', icon: '🌧️' }, { id: 'fire', label: 'Fireplace', icon: '🔥' }];
export const TRACKS = [
  { id: 'lofi', label: 'Lo-fi chill', hint: 'Mellow keys, soft beat, vinyl dust' },
  { id: 'lofi-night', label: 'Lo-fi night', hint: 'Slow, drum-free late-night keys' },
  { id: 'ambient', label: 'Ambient drift', hint: 'Warm evolving pads' },
  { id: 'fireside', label: 'Fireside crackle', hint: 'Soft crackling fire sounds' },
];
// Home / page-header picture. 'forest' = the original art (default); 'custom' = the user's own photo (stored separately, see CUSTOM_KEY).
export const IMAGES = [
  { id: 'forest', label: 'Forest' }, { id: 'night', label: 'Night sky' }, { id: 'ocean', label: 'Ocean dusk' },
  { id: 'sunrise', label: 'Sunrise' }, { id: 'mountains', label: 'Mountains' }, { id: 'dark', label: 'Plain dark' },
];
export const IMAGE_IDS = [...IMAGES.map((i) => i.id), 'custom'];
export const DEFAULTS = Object.freeze({ anim: 'none', track: 'lofi', volume: 0.5, forceMotion: false, musicOn: false, image: 'forest' });
const clamp01 = (n) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : DEFAULTS.volume));
export const sanitize = (p) => {
  const o = p && typeof p === 'object' ? p : {};
  return {
    anim: ANIMS.some((a) => a.id === o.anim) ? o.anim : DEFAULTS.anim,
    track: TRACKS.some((t) => t.id === o.track) ? o.track : DEFAULTS.track,
    volume: clamp01(Number(o.volume)),
    forceMotion: o.forceMotion === true, // "play anyway" when the device asks for reduced motion
    musicOn: o.musicOn === true, // music was playing when the user left: resume it on return
    image: IMAGE_IDS.includes(o.image) ? o.image : DEFAULTS.image,
  };
};
export const loadPrefs = (storage = typeof localStorage !== 'undefined' ? localStorage : null) => {
  try { return sanitize(JSON.parse(storage.getItem(KEY) || 'null')); } catch (e) { return { ...DEFAULTS }; }
};
export const savePrefs = (p, storage = typeof localStorage !== 'undefined' ? localStorage : null) => { try { storage.setItem(KEY, JSON.stringify(sanitize(p))); } catch (e) { /* private mode */ } };

// "Upload your own" picture: a downscaled JPEG data URL in its own localStorage key (kept out of the small prefs JSON).
export const CUSTOM_KEY = 'clingnot_background_img_v1';
export const CUSTOM_MAX_SIDE = 1000; // px, longest side after downscaling
export const MAX_CUSTOM_CHARS = 450000; // ~330 KB of image; localStorage is ~5 MB per origin
export const isCustomImage = (v) => typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= MAX_CUSTOM_CHARS;
export const loadCustomImage = (storage = typeof localStorage !== 'undefined' ? localStorage : null) => { try { const v = storage.getItem(CUSTOM_KEY); return isCustomImage(v) ? v : ''; } catch (e) { return ''; } };
export const saveCustomImage = (v, storage = typeof localStorage !== 'undefined' ? localStorage : null) => { if (!isCustomImage(v)) return false; try { storage.setItem(CUSTOM_KEY, v); return true; } catch (e) { return false; /* quota / private mode */ } };
export const clearCustomImage = (storage = typeof localStorage !== 'undefined' ? localStorage : null) => { try { storage.removeItem(CUSTOM_KEY); } catch (e) { /* ignore */ } };
// Size to downscale a w x h picture to (never upscales).
export const fitSize = (w, h, max = CUSTOM_MAX_SIDE) => { const k = Math.min(1, max / Math.max(w, h, 1)); return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }; };
// The image to actually show: 'custom' without a valid saved picture falls back to the default.
export const effectiveImage = (id, custom) => (id === 'custom' && !isCustomImage(custom) ? DEFAULTS.image : (IMAGE_IDS.includes(id) ? id : DEFAULTS.image));
