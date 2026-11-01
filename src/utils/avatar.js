// Profile picture helpers. The photo is stored as a small JPEG data URL on users/{uid}.avatarURL (no Storage rules/bucket needed),
// "" (empty) means the default initials avatar.
export const AVATAR_SIZE = 256;
export const MAX_AVATAR_CHARS = 120000; // keeps users/{uid} and publicProfiles/{uid} tiny

export const initialsOf = (name = '', email = '') => {
  const src = String(name || '').trim() || String(email || '').split('@')[0] || '';
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2);
  return s.toUpperCase();
};

// Square center-crop rectangle of a w x h image.
export const cropRect = (w, h) => { const s = Math.min(w, h); return { sx: Math.floor((w - s) / 2), sy: Math.floor((h - s) / 2), s }; };

export const isAvatarSrc = (v) => typeof v === 'string' && (/^data:image\/(jpeg|png|webp);base64,/.test(v) || /^https:\/\//.test(v)) && v.length <= MAX_AVATAR_CHARS * 2;

// File -> square JPEG data URL (browser only)
export const fileToAvatarDataUrl = async (file, size = AVATAR_SIZE) => {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('Please choose an image file.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new window.Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image.')); i.src = url; });
    const { sx, sy, s } = cropRect(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
    let out = c.toDataURL('image/jpeg', 0.85);
    if (out.length > MAX_AVATAR_CHARS) out = c.toDataURL('image/jpeg', 0.6);
    if (out.length > MAX_AVATAR_CHARS) throw new Error('That image is too large.');
    return out;
  } finally { URL.revokeObjectURL(url); }
};
