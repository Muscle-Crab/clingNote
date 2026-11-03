// Brand tiles for the main social platforms (vault pop-out web fallback): background + a simple white 24x24 glyph. Unknown apps -> null (letter tile).
export const SOCIAL = {
  instagram: { bg: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)',
    svg: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#fff" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="#fff"/>' },
  tiktok: { bg: '#010101',
    svg: '<path d="M14 3h3a4 4 0 0 0 4 4v3a7 7 0 0 1-4-1.3V15a6 6 0 1 1-6-6v3.2A2.8 2.8 0 1 0 14 15z" fill="#25F4EE" transform="translate(-1 -1)"/><path d="M14 3h3a4 4 0 0 0 4 4v3a7 7 0 0 1-4-1.3V15a6 6 0 1 1-6-6v3.2A2.8 2.8 0 1 0 14 15z" fill="#FE2C55" transform="translate(1 1)"/><path d="M14 3h3a4 4 0 0 0 4 4v3a7 7 0 0 1-4-1.3V15a6 6 0 1 1-6-6v3.2A2.8 2.8 0 1 0 14 15z" fill="#fff"/>' },
  x: { bg: '#000', svg: '<path d="M4 4h4.5l11.5 16h-4.5z" fill="#fff"/><path d="M18.6 4h1.9l-6.6 7.5-1.1-1.4zM5.4 20H3.5l6.7-7.6 1.1 1.4z" fill="#fff"/>' },
  youtube: { bg: '#FF0000', svg: '<rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="#fff"/><path d="M10 9v6l5.2-3z" fill="#FF0000"/>' },
  facebook: { bg: '#1877F2', svg: '<path d="M13.5 21v-7h2.4l.4-2.8h-2.8V9.4c0-.8.3-1.4 1.4-1.4h1.5V5.5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.7v2.1H8.2V14h2.4v7z" fill="#fff"/>' },
};
const ALIAS = { insta: 'instagram', ig: 'instagram', twitter: 'x', 'x (twitter)': 'x', yt: 'youtube', fb: 'facebook' };
export const socialIcon = (label = '') => { const k = String(label).trim().toLowerCase(); return SOCIAL[ALIAS[k] || k] || null; };
