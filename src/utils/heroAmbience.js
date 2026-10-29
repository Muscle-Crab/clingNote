// Home header picture "life": which weather fits which picture, plus the calm ambient layer drawn over the picture
// (tree sway via a smooth mesh warp limited to the tree region, slow cloud wisps, soft star twinkle, gentle moon glow, rain mist / snow haze).
// Pure helpers + a canvas draw; the Vue wrapper (HeroAmbience.vue) owns the canvas, rAF and visibility.
import { windAt } from './bgScenes.js';

const TAU = Math.PI * 2;
// Picture -> allowed animations. Sunny/dusk pictures never get rain or snow; "fire" (fireplace glow) is cozy, not weather, so it fits everywhere.
// Positions are fractions of the source image (x, y); trees = the region whose pixels sway (base = where trunks are rooted).
export const SCENES = {
  forest: { weather: ['snow', 'rain'], wind: 1, moon: { x: 0.82, y: 0.175, r: 0.035 }, stars: { x0: 0.38, x1: 0.98, y0: 0.02, y1: 0.36 },
    clouds: { y0: 0.2, y1: 0.36 }, trees: { x0: 0.5, x1: 1.0, top: 0.06, base: 1.0, skyline: [[0.5, 0.66], [0.6, 0.6], [0.66, 0.48], [0.73, 0.38], [0.8, 0.24], [0.86, 0.1], [0.92, 0.08], [1, 0.12]] } }, // overcast-capable mountain night: rain or snow
  night: { weather: ['snow'], wind: 0.5, moon: { x: 0.74, y: 0.24, r: 0.06 }, stars: { x0: 0, x1: 1, y0: 0.02, y1: 0.6 } }, // clear cold night: snow only
  ocean: { weather: [], wind: 0.3 }, // sunset over the sea: clear
  sunrise: { weather: [], wind: 0.3 }, // sunny: clear
  mountains: { weather: ['snow', 'rain'], wind: 0.8, clouds: { y0: 0.08, y1: 0.3 } }, // overcast grey-blue ridges: rain or snow
  dark: { weather: ['snow', 'rain'], wind: 0.5 }, // plain gradient: anything
  custom: { weather: ['snow', 'rain'], wind: 0.5 }, // user's own photo: we can't tell, so allow both (they chose it)
};
export const sceneFor = (img) => SCENES[img] || SCENES.forest;
export const animAllowed = (img, anim) => anim === 'none' || anim === 'fire' || sceneFor(img).weather.includes(anim);
export const effectiveAnim = (img, anim) => (animAllowed(img, anim) ? anim : 'none');

// CSS `background-position: px% py%; background-size: cover` for an iw x ih image in a w x h box.
export const coverRect = (iw, ih, w, h, px = 0.72, py = 0.3) => {
  const s = Math.max(w / iw, h / ih); const dw = iw * s; const dh = ih * s;
  return { x: (w - dw) * px, y: (h - dh) * py, w: dw, h: dh, s };
};

const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
export const makeAmbience = (img, anim, w, h, iw = 1024, ih = 576) => {
  const sc = sceneFor(img); const r = rng(7 + w * 3 + h); const rect = coverRect(iw, ih, w, h);
  const P = (fx, fy) => ({ x: rect.x + fx * rect.w, y: rect.y + fy * rect.h });
  const stars = [];
  if (sc.stars) for (let i = 0; i < 26; i++) { const p = P(sc.stars.x0 + r() * (sc.stars.x1 - sc.stars.x0), sc.stars.y0 + r() * (sc.stars.y1 - sc.stars.y0)); if (p.x > 0 && p.x < w && p.y > 0 && p.y < h * 0.6) stars.push({ ...p, f: 0.25 + r() * 0.6, ph: r() * TAU, s: 0.5 + r() * 0.9 }); }
  const clouds = [];
  if (sc.clouds) for (let i = 0; i < 4; i++) { const p = P(r(), sc.clouds.y0 + r() * (sc.clouds.y1 - sc.clouds.y0)); clouds.push({ x: r() * (w + 240) - 120, y: p.y, rx: 70 + r() * 90, ry: 10 + r() * 12, v: 2.5 + r() * 3, a: 0.05 + r() * 0.05 }); }
  return { img, anim, w, h, rect, sc, stars, clouds, t: 0, moon: sc.moon ? { ...P(sc.moon.x, sc.moon.y), r: sc.moon.r * rect.w } : null };
};
export const stepAmbience = (a, dt) => { dt = Math.min(dt, 0.1); a.t += dt; for (const c of a.clouds) { c.x += c.v * dt; if (c.x - c.rx > a.w) c.x = -c.rx * 2; } return a; };
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Tree mask (gw x gh grid over the image, 0..1): dark silhouette pixels under the tree skyline sway; sky, moon, clouds and lit mountains stay put.
// `lum` = luminance grid (0..255) sampled from the picture once (HeroAmbience does it via an offscreen canvas).
export const buildTreeMask = (lum, gw, gh, tr) => {
  const sky = (fx) => { const k = tr.skyline || [[0, tr.top], [1, tr.top]]; for (let i = 1; i < k.length; i++) if (fx <= k[i][0]) { const [x0, y0] = k[i - 1]; const [x1, y1] = k[i]; return y0 + ((fx - x0) / (x1 - x0)) * (y1 - y0); } return k[k.length - 1][1]; };
  const raw = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const fx = (x + 0.5) / gw; const fy = (y + 0.5) / gh; raw[y * gw + x] = (1 - smooth(22, 48, lum[y * gw + x])) * smooth(sky(fx) - 0.03, sky(fx) + 0.03, fy); }
  const m = new Float32Array(gw * gh); // 3x3 blur: soft edges, no tearing
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { let t = 0; let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i; const yy = y + j; if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) { t += raw[yy * gw + xx]; n++; } } m[y * gw + x] = t / n; }
  return { gw, gh, m };
};
const maskAt = (mk, fx, fy) => { if (!mk) return 1; const x = Math.min(mk.gw - 1, Math.max(0, Math.floor(fx * mk.gw))); const y = Math.min(mk.gh - 1, Math.max(0, Math.floor(fy * mk.gh))); return mk.m[y * mk.gw + x]; };

// Horizontal displacement (screen px) of the tree layer at image fraction (fx, fy): bends from the base, slow sway, per-tree phase.
export const treeShift = (a, fx, fy) => {
  const tr = a.sc.trees; if (!tr) return 0;
  const k = (a.anim === 'rain' ? 1.4 : a.anim === 'snow' ? 1.1 : 0.95) * (a.sc.wind || 1);
  const amp = Math.min(16, 0.014 * a.rect.w + 4) * k; // clearly visible but soft: ~10-20 px at the tips on phones
  const hgt = Math.pow(Math.max(0, (tr.base - fy) / (tr.base - tr.top)), 1.6) * smooth(tr.top - 0.04, tr.top + 0.05, fy);
  const edge = smooth(tr.x0, tr.x0 + 0.08, fx);
  const wind = windAt(a.t, a.anim === 'fire' ? 'none' : a.anim);
  const sway = 0.55 * wind + 0.35 * Math.sin((a.t * TAU) / 6.2 + fx * 11) + 0.12 * Math.sin((a.t * TAU) / 3.1 + fx * 27 + fy * 4);
  return amp * hgt * edge * sway * maskAt(a.mask, fx, fy);
};

// Draws the ambient layer. `image` (HTMLImageElement or null) is the picture itself; when given (built-in art with trees) the
// picture is redrawn cover-fit and the tree region is mesh-warped; otherwise only transparent overlays are drawn over the CSS picture.
export const drawAmbience = (ctx, a, image) => {
  const { w, h, rect } = a; ctx.clearRect(0, 0, w, h); ctx.globalAlpha = 1;
  if (image && a.sc.trees) {
    const iw = image.naturalWidth || image.width; const ih = image.naturalHeight || image.height; const s = rect.w / iw;
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
    const tr = a.sc.trees; const cw = 14; const ch = 7; // screen px per mesh cell
    const sx0 = Math.max(rect.x + tr.x0 * rect.w, 0); const sx1 = Math.min(rect.x + tr.x1 * rect.w, w);
    const sy0 = Math.max(rect.y + (tr.top - 0.05) * rect.h, 0); const sy1 = Math.min(rect.y + tr.base * rect.h, h);
    for (let y = sy0; y < sy1; y += ch) {
      const fy = (y + ch / 2 - rect.y) / rect.h;
      for (let x = sx0; x < sx1; x += cw) {
        const fx = (x + cw / 2 - rect.x) / rect.w; const dx = treeShift(a, fx, fy);
        if (Math.abs(dx) < 0.1) continue;
        ctx.drawImage(image, (x - rect.x) / s, (y - rect.y) / s, (cw + 1) / s, (ch + 1) / s, x + dx, y, cw + 1, ch + 1);
      }
    }
  }
  if (a.moon) { // gentle glow breathing (~9 s)
    const m = a.moon; const k = 0.75 + 0.25 * Math.sin((a.t * TAU) / 9);
    const g = ctx.createRadialGradient(m.x, m.y, m.r * 0.6, m.x, m.y, m.r * 5);
    g.addColorStop(0, `rgba(200,215,255,${0.16 * k})`); g.addColorStop(1, 'rgba(200,215,255,0)');
    ctx.fillStyle = g; ctx.fillRect(m.x - m.r * 5, m.y - m.r * 5, m.r * 10, m.r * 10);
  }
  ctx.fillStyle = '#eef3ff';
  for (const st of a.stars) { const tw = 0.5 + 0.5 * Math.sin(a.t * st.f * TAU * 0.25 + st.ph); ctx.globalAlpha = 0.12 + 0.55 * tw * tw; ctx.fillRect(st.x - st.s / 2, st.y - st.s / 2, st.s, st.s); }
  for (const c of a.clouds) {
    ctx.globalAlpha = 1; const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.rx);
    g.addColorStop(0, `rgba(170,185,215,${c.a})`); g.addColorStop(1, 'rgba(170,185,215,0)');
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, c.ry / c.rx); ctx.translate(-c.x, -c.y); ctx.fillStyle = g; ctx.fillRect(c.x - c.rx, c.y - c.rx, c.rx * 2, c.rx * 2); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (a.anim === 'rain') { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(10,16,30,.28)'); g.addColorStop(0.6, 'rgba(60,75,100,.10)'); g.addColorStop(1, 'rgba(10,16,30,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  else if (a.anim === 'snow') { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(215,225,245,.07)'); g.addColorStop(1, 'rgba(215,225,245,.02)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
};
// Browser-only: luminance grid of a loaded picture (tiny offscreen canvas, done once per picture).
export const sampleLum = (image, gw = 96, gh = 54) => {
  const c = document.createElement('canvas'); c.width = gw; c.height = gh; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0, gw, gh); const d = g.getImageData(0, 0, gw, gh).data; const lum = new Float32Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) lum[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
  return { lum, gw, gh };
};
export const treeMaskFor = (img, image) => { const tr = sceneFor(img).trees; if (!tr || !image) return null; try { const { lum, gw, gh } = sampleLum(image); return buildTreeMask(lum, gw, gh, tr); } catch (e) { return null; } };
