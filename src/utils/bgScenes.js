// Lightweight particle scenes for the Background layer (pure sim + canvas draw; no DOM access except lazily-built sprites).
// Calm by design: light-to-moderate rain, slow drifting snow, a cozy steady fire. Every particle has a depth z (0 = far, 1 = near):
// far = smaller / slower / fainter, near = bigger / faster / brighter (parallax). Particles spawn above the top edge and loop seamlessly.
const rnd = (r, a, b) => a + r() * (b - a);
const TAU = Math.PI * 2;

// Shared wind (also drives the tree sway in heroAmbience): slow, smooth, long periods; gusts are rare and gentle. ~0..1, positive = to the right.
export const WIND_BASE = { none: 0.3, snow: 0.45, rain: 0.75, fire: 0.25 };
export const windAt = (t, kind = 'none') => {
  const base = WIND_BASE[kind] ?? WIND_BASE.none;
  const slow = 0.62 + 0.22 * Math.sin((t * TAU) / 13) + 0.12 * Math.sin((t * TAU) / 7.3 + 1.3);
  const gust = 0.28 * Math.pow(Math.max(0, Math.sin((t * TAU) / 41 + 0.6)), 6); // a soft swell roughly every 40 s
  return base * (slow + gust);
};

export const particleCount = (kind, w, h) => {
  const area = Math.max(1, w * h);
  const per = { snow: 5200, rain: 3000, fire: 14000 }[kind] || 9000;
  const cap = { snow: 90, rain: 140, fire: 36 }[kind] || 80;
  return Math.max(20, Math.min(cap, Math.round(area / per)));
};
export const makeScene = (kind, w, h, r = Math.random) => {
  const n = particleCount(kind, w, h);
  const s = { kind, w, h, t: 0, p: [], splash: [], wind: windAt(0, kind) };
  for (let i = 0; i < n; i++) s.p.push(spawn(s, r, true));
  return s;
};
function spawn(s, r, initial) {
  const { w, h, kind } = s;
  if (kind === 'snow') {
    const z = Math.pow(r(), 1.6); // most flakes far away, a few close
    return { z, x: rnd(r, -20, w + 20), y: initial ? rnd(r, -20, h) : rnd(r, -60, -8), rad: (0.7 + z * 3.4) * rnd(r, 0.75, 1.3),
      vy: (12 + z * 30) * rnd(r, 0.8, 1.2), amp: (5 + z * 16) * rnd(r, 0.6, 1.3), f: rnd(r, 0.25, 0.7), ph: rnd(r, 0, TAU),
      a: (0.28 + z * 0.5) * rnd(r, 0.8, 1.1), sp: r() < 0.12 ? rnd(r, 0.6, 1.4) : 0 };
  }
  if (kind === 'rain') {
    const z = Math.pow(r(), 1.3);
    return { z, x: rnd(r, -80, w + 20), y: initial ? rnd(r, -40, h) : rnd(r, -120, -20), len: (11 + z * 22) * rnd(r, 0.75, 1.25),
      vy: (360 + z * 330) * rnd(r, 0.85, 1.15), a: (0.16 + z * 0.34) * rnd(r, 0.75, 1.2), lw: 0.55 + z * 0.75 };
  }
  // fire: a few embers rise lazily from a band at the bottom centre
  const life = rnd(r, 1.6, 2.8);
  return { x: w / 2 + rnd(r, -0.22, 0.22) * w, y: h + 4, vx: rnd(r, -6, 6), vy: -rnd(r, 40, 95), life: initial ? rnd(r, 0, life) : life, max: life, rad: rnd(r, 14, 34), ph: rnd(r, 0, TAU) };
}
export const stepScene = (s, dt, r = Math.random) => {
  dt = Math.min(dt, 0.05); s.t += dt;
  const wind = (s.wind = windAt(s.t, s.kind));
  const W = s.w + 40;
  for (let i = 0; i < s.p.length; i++) {
    const p = s.p[i];
    if (s.kind === 'snow') {
      p.y += p.vy * dt; p.x += wind * (8 + p.z * 22) * dt;
      if (p.x > s.w + 20) p.x -= W; else if (p.x < -20) p.x += W;
      if (p.y > s.h + 8) s.p[i] = spawn(s, r, false);
    } else if (s.kind === 'rain') {
      const vx = rainVx(wind, p.vy);
      p.y += p.vy * dt; p.x += vx * dt;
      if (p.y - p.len > s.h) {
        if (p.z > 0.55 && s.splash.length < 18) s.splash.push({ x: p.x, y: s.h - rnd(r, 2, 16), t: 0, a: p.a });
        s.p[i] = spawn(s, r, false);
      }
    } else { p.life -= dt; p.x += (p.vx + Math.sin(s.t * 1.2 + p.ph) * 6) * dt; p.y += p.vy * dt; if (p.life <= 0) s.p[i] = spawn(s, r, false); }
  }
  if (s.splash.length) { for (const sp of s.splash) sp.t += dt; s.splash = s.splash.filter((sp) => sp.t < 0.45); }
  return s;
};
const rainVx = (wind, vy) => (0.06 + wind * 0.16) * vy; // gentle consistent slant (~8-12 deg), breathing with the wind

// Pre-rendered sprites (built once, lazily, only where a canvas exists).
let flake = null; let streak = null;
const mk = (w, h) => { if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const flakeSprite = () => {
  if (flake !== null) return flake; const c = mk(32, 32); if (!c) return (flake = false);
  const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(250,252,255,.85)'); gr.addColorStop(0.7, 'rgba(235,242,255,.28)'); gr.addColorStop(1, 'rgba(235,242,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return (flake = c);
};
const streakSprite = () => {
  if (streak !== null) return streak; const c = mk(4, 64); if (!c) return (streak = false);
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 64); // tail (top) fades in to a bright head (bottom)
  gr.addColorStop(0, 'rgba(200,220,255,0)'); gr.addColorStop(0.7, 'rgba(214,230,255,.55)'); gr.addColorStop(1, 'rgba(240,247,255,1)');
  g.fillStyle = gr; g.fillRect(1, 0, 2, 64); g.fillStyle = 'rgba(214,230,255,.25)'; g.fillRect(0, 40, 1, 24); g.fillRect(3, 40, 1, 24); return (streak = c);
};

export const drawScene = (ctx, s) => {
  const { w, h } = s;
  ctx.clearRect(0, 0, w, h);
  if (s.kind === 'snow') {
    const spr = flakeSprite();
    for (const p of s.p) {
      const x = p.x + Math.sin(s.t * p.f + p.ph) * p.amp; // gentle tumbling sway
      let a = p.a; if (p.sp) a = Math.min(1, a * (1 + 0.9 * Math.pow(Math.max(0, Math.sin(s.t * p.sp + p.ph)), 24))); // rare soft sparkle
      ctx.globalAlpha = a;
      if (spr) { const d = p.rad * 2.6; ctx.drawImage(spr, x - d / 2, p.y - d / 2, d, d); } else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, p.y, p.rad, 0, TAU); ctx.fill(); }
    }
  } else if (s.kind === 'rain') {
    const spr = streakSprite();
    // One shear for the whole frame: every streak shares the wind slant, so no per-drop rotate.
    for (const p of s.p) {
      const k = rainVx(s.wind, p.vy) / p.vy; // dx per dy
      ctx.globalAlpha = p.a;
      if (spr) { ctx.save(); ctx.transform(1, 0, k, 1, -k * p.y, 0); ctx.drawImage(spr, p.x - p.lw / 2, p.y - p.len, Math.max(1, p.lw * 1.4), p.len); ctx.restore(); }
      else { ctx.strokeStyle = '#cfe0ff'; ctx.lineWidth = p.lw; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - k * p.len, p.y - p.len); ctx.stroke(); }
    }
    ctx.strokeStyle = 'rgba(210,225,255,1)'; ctx.lineWidth = 0.8;
    for (const sp of s.splash) { const k = sp.t / 0.45; ctx.globalAlpha = sp.a * 0.7 * (1 - k); ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 1.5 + k * 7, 0.5 + k * 1.6, 0, 0, TAU); ctx.stroke(); }
  } else {
    const flick = 0.9 + Math.sin(s.t * 2.1) * 0.04 + Math.sin(s.t * 5.3 + 1) * 0.025; // cozy, steady
    const g = ctx.createRadialGradient(w / 2, h, 10, w / 2, h, h * 0.7);
    g.addColorStop(0, `rgba(255,140,50,${0.42 * flick})`); g.addColorStop(0.5, `rgba(255,95,30,${0.16 * flick})`); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.p) {
      const k = Math.max(0, p.life / p.max); const rad = p.rad * (0.35 + k * 0.65);
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      gr.addColorStop(0, `rgba(255,${Math.round(120 + 100 * k)},50,${0.45 * k})`); gr.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
};
