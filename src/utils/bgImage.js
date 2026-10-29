// Browser-only helpers for the home/header background picture: turn the chosen id into a CSS <image> value and set it on <html> as --hero-img.
// Each hero spot uses `var(--hero-img, url(<forest>))`, so with no override the original forest art shows (default).
import { effectiveImage, fitSize, isCustomImage, MAX_CUSTOM_CHARS, CUSTOM_MAX_SIDE } from '@/utils/bgPrefs';
import night from '@/assets/bg/bg-night.jpg';
import ocean from '@/assets/bg/bg-ocean.jpg';
import sunrise from '@/assets/bg/bg-sunrise.jpg';
import mountains from '@/assets/bg/bg-mountains.jpg';
import campfire from '@/assets/bg/bg-campfire.jpg';
import forest from '@/assets/hero-forest.jpg';

const files = { forest, night, ocean, sunrise, mountains, campfire };
export const imageCss = (id, custom = '') => {
  const e = effectiveImage(id, custom);
  if (e === 'dark') return 'linear-gradient(180deg, #172036, #0B1220 70%, #070D1C)';
  if (e === 'custom') return 'url("' + custom + '")';
  return 'url("' + files[e] + '")';
};
export const applyBackgroundImage = (id, custom = '') => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (effectiveImage(id, custom) === 'forest') root.style.removeProperty('--hero-img'); // default: the CSS fallback (original art)
  else root.style.setProperty('--hero-img', imageCss(id, custom));
  root.dataset.heroImg = effectiveImage(id, custom);
};

// File from <input type=file> -> downscaled JPEG data URL (<= MAX_CUSTOM_CHARS), or throws a friendly Error.
export const fileToBackgroundDataUrl = async (file) => {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('Please choose an image file.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new window.Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Couldn't read that picture. Try a JPEG or PNG.")); i.src = url; });
    let side = CUSTOM_MAX_SIDE;
    for (const q of [0.72, 0.6, 0.5, 0.4]) {
      const { w, h } = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height, side);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      const out = c.toDataURL('image/jpeg', q);
      if (isCustomImage(out)) return out;
      side = Math.round(side * 0.8);
    }
    throw new Error('That picture is too large to save on this device.');
  } finally { URL.revokeObjectURL(url); }
};
export { MAX_CUSTOM_CHARS };
