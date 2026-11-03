// Time-of-day backgrounds + extra gallery backgrounds. Pure (no DOM), so node tests can import it.
// 'auto' (default) follows the local clock: morning 5–11, noon 11–16, evening 16–20, night 20–5.
// Any manual pick (a daytime scene, a gallery scene, a photo) wins until the user picks 'auto' again.
export const AUTO = 'auto';
export const PERIODS = [
  { id: 'morning', label: 'Morning', from: 5, to: 11 },
  { id: 'noon', label: 'Noon', from: 11, to: 16 },
  { id: 'evening', label: 'Evening', from: 16, to: 20 },
  { id: 'night', label: 'Night', from: 20, to: 5 },
];
// hour 0..23 (fractions allowed) -> period id. Out-of-range / bad input wraps or falls back to night.
export const periodForHour = (h) => {
  const n = Number(h); if (!Number.isFinite(n)) return 'night';
  const x = ((n % 24) + 24) % 24;
  if (x >= 5 && x < 11) return 'morning';
  if (x >= 11 && x < 16) return 'noon';
  if (x >= 16 && x < 20) return 'evening';
  return 'night';
};
export const periodAt = (date = new Date()) => periodForHour(date.getHours() + date.getMinutes() / 60);
// Ms until the next period boundary (for a precise timer); never < 1 s.
export const msUntilNextPeriod = (date = new Date()) => {
  const bounds = [5, 11, 16, 20]; const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const next = bounds.find((b) => b > h) ?? 24 + 5;
  return Math.max(1000, Math.round((next - h) * 3600000));
};

// Soft, layered gradients in the app's deep navy style (sky + glow + horizon), readable under white text.
export const DAYTIME = {
  'dt-morning': { label: 'Morning', css: 'radial-gradient(120% 70% at 78% 62%, rgba(255,214,160,.85), rgba(255,170,140,0) 55%), linear-gradient(180deg, #5b7fc7 0%, #9fb6e6 38%, #f2c6a8 66%, #3a4a78 100%)' },
  'dt-noon': { label: 'Noon', css: 'radial-gradient(70% 45% at 75% 18%, rgba(255,255,240,.9), rgba(255,255,255,0) 60%), linear-gradient(180deg, #2f86d8 0%, #63afef 40%, #a8d6f5 68%, #2a5a8a 100%)' },
  'dt-evening': { label: 'Evening', css: 'radial-gradient(110% 60% at 72% 70%, rgba(255,150,80,.9), rgba(255,90,90,0) 58%), linear-gradient(180deg, #2b2a5e 0%, #7a3f7c 38%, #e0745a 66%, #2a1d3a 100%)' },
  'dt-night': { label: 'Night', css: 'radial-gradient(1.5px 1.5px at 20% 22%, #fff, transparent), radial-gradient(1px 1px at 62% 14%, #fff, transparent), radial-gradient(1.2px 1.2px at 84% 32%, #dfe8ff, transparent), radial-gradient(1px 1px at 38% 40%, #cfd9ff, transparent), radial-gradient(40% 30% at 78% 22%, rgba(190,205,255,.35), rgba(0,0,0,0) 70%), linear-gradient(180deg, #0a1230 0%, #142250 45%, #1d2b5c 70%, #070d1c 100%)' },
};
// Extra gallery (pick manually). All CSS gradients: no network, no licences, tiny.
export const GALLERY = {
  'g-aurora': { label: 'Aurora', css: 'radial-gradient(80% 40% at 30% 30%, rgba(80,255,190,.55), rgba(0,0,0,0) 70%), radial-gradient(70% 35% at 70% 22%, rgba(140,110,255,.5), rgba(0,0,0,0) 70%), linear-gradient(180deg, #06142a, #0b2240 55%, #070d1c)' },
  'g-lavender': { label: 'Lavender', css: 'radial-gradient(90% 60% at 70% 30%, rgba(255,200,240,.55), rgba(0,0,0,0) 65%), linear-gradient(180deg, #4b4a8f, #8a74c4 50%, #2b2550)' },
  'g-mint': { label: 'Mint', css: 'radial-gradient(90% 60% at 25% 25%, rgba(200,255,230,.6), rgba(0,0,0,0) 60%), linear-gradient(180deg, #2a7f7a, #5fbfa7 50%, #173a42)' },
  'g-peach': { label: 'Peach', css: 'radial-gradient(90% 60% at 75% 35%, rgba(255,230,200,.8), rgba(0,0,0,0) 60%), linear-gradient(180deg, #e88b7a, #f6b48f 50%, #6a3a4a)' },
  'g-deepsea': { label: 'Deep sea', css: 'radial-gradient(70% 40% at 50% 0%, rgba(120,220,255,.45), rgba(0,0,0,0) 70%), linear-gradient(180deg, #0f4c75, #0b2f55 50%, #04101f)' },
  'g-forestmist': { label: 'Forest mist', css: 'radial-gradient(100% 50% at 50% 60%, rgba(220,240,220,.35), rgba(0,0,0,0) 65%), linear-gradient(180deg, #2f4a3a, #4f6f55 45%, #13241c)' },
  'g-desert': { label: 'Desert', css: 'radial-gradient(60% 40% at 70% 30%, rgba(255,240,200,.7), rgba(0,0,0,0) 60%), linear-gradient(180deg, #d98c4f, #e9b77a 50%, #6b3b26)' },
  'g-cosmos': { label: 'Cosmos', css: 'radial-gradient(1px 1px at 15% 30%, #fff, transparent), radial-gradient(1.4px 1.4px at 55% 18%, #fff, transparent), radial-gradient(1px 1px at 80% 45%, #fff, transparent), radial-gradient(60% 50% at 60% 40%, rgba(220,90,200,.35), rgba(0,0,0,0) 70%), linear-gradient(180deg, #120b2e, #2a1450 55%, #070d1c)' },
  'g-rose': { label: 'Rose gold', css: 'radial-gradient(80% 50% at 30% 30%, rgba(255,220,210,.6), rgba(0,0,0,0) 60%), linear-gradient(180deg, #b76e79, #d9a3a0 50%, #4a2a33)' },
  'g-slate': { label: 'Slate', css: 'radial-gradient(80% 50% at 70% 20%, rgba(200,215,240,.35), rgba(0,0,0,0) 65%), linear-gradient(180deg, #3b4658, #55627a 50%, #1a202c)' },
};
export const DAYTIME_IDS = Object.keys(DAYTIME);
export const GALLERY_IDS = Object.keys(GALLERY);
export const GRADIENT_IDS = [...DAYTIME_IDS, ...GALLERY_IDS];
export const gradientCss = (id) => (DAYTIME[id] || GALLERY[id] || {}).css || '';
export const isGradientId = (id) => GRADIENT_IDS.includes(id);

// Override logic: the saved choice -> the scene to show right now. Only 'auto' follows the clock.
export const resolveImage = (choice, date = new Date()) => (choice === AUTO ? 'dt-' + periodAt(date) : choice);
// What a tap in the picker saves: picking the same manual scene keeps it; picking Auto returns control to the clock.
export const pickImage = (current, picked) => (picked === AUTO ? AUTO : picked || current);
export const isManual = (choice) => choice !== AUTO;
