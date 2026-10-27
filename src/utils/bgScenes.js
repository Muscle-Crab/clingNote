// Lightweight particle scenes for the Background layer (pure sim + canvas draw; no DOM access).
const rnd = (r, a, b) => a + r() * (b - a);
export const particleCount = (kind, w, h) => {
  const area = Math.max(1, w * h);
  const per = { snow: 9000, rain: 4200, fire: 9000 }[kind] || 9000;
  const cap = { snow: 110, rain: 260, fire: 110 }[kind] || 100;
  return Math.max(24, Math.min(cap, Math.round(area / per)));
};
export const makeScene = (kind, w, h, r = Math.random) => {
  const n = particleCount(kind, w, h);
  const s = { kind, w, h, t: 0, p: [] };
  for (let i = 0; i < n; i++) s.p.push(spawn(s, r, true));
  return s;
};
function spawn(s, r, initial) {
  const { w, h, kind } = s;
  if (kind === 'snow') return { x: rnd(r, 0, w), y: initial ? rnd(r, 0, h) : -6, rad: rnd(r, 1.1, 2.8), vy: rnd(r, 22, 60), ph: rnd(r, 0, 6.28), sw: rnd(r, 8, 24), a: rnd(r, 0.25, 0.55) };
  if (kind === 'rain') return { x: rnd(r, -40, w + 40), y: initial ? rnd(r, 0, h) : rnd(r, -80, -10), len: rnd(r, 14, 28), vy: rnd(r, 280, 420), vx: -45, a: rnd(r, 0.35, 0.7) };
  // fire: flames rise from a band at the bottom centre
  const life = rnd(r, 0.9, 1.7);
  return { x: w / 2 + rnd(r, -0.28, 0.28) * w, y: h + 4, vx: rnd(r, -14, 14), vy: -rnd(r, 90, 230), life: initial ? rnd(r, 0, life) : life, max: life, rad: rnd(r, 18, 46) };
}
export const stepScene = (s, dt, r = Math.random) => {
  dt = Math.min(dt, 0.05); s.t += dt;
  for (let i = 0; i < s.p.length; i++) {
    const p = s.p[i];
    if (s.kind === 'snow') { p.y += p.vy * dt; p.x += Math.sin(s.t * 0.9 + p.ph) * p.sw * dt; if (p.y > s.h + 6) s.p[i] = spawn(s, r, false); }
    else if (s.kind === 'rain') { p.y += p.vy * dt; p.x += p.vx * dt; if (p.y > s.h + 20) s.p[i] = spawn(s, r, false); }
    else { p.life -= dt; p.x += (p.vx + Math.sin(s.t * 3 + i) * 10) * dt; p.y += p.vy * dt; if (p.life <= 0) s.p[i] = spawn(s, r, false); }
  }
  return s;
};
export const drawScene = (ctx, s) => {
  const { w, h } = s;
  ctx.clearRect(0, 0, w, h);
  if (s.kind === 'snow') {
    ctx.fillStyle = '#fff';
    for (const p of s.p) { ctx.globalAlpha = p.a; ctx.beginPath(); ctx.arc(p.x, p.y, p.rad, 0, 6.2832); ctx.fill(); }
  } else if (s.kind === 'rain') {
    ctx.strokeStyle = '#b8d4ff'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (const p of s.p) { ctx.globalAlpha = p.a; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 0.02, p.y - p.len); }
    ctx.stroke();
  } else {
    const flick = 0.85 + Math.sin(s.t * 9) * 0.08 + Math.sin(s.t * 23) * 0.05;
    const g = ctx.createRadialGradient(w / 2, h, 10, w / 2, h, h * 0.75);
    g.addColorStop(0, `rgba(255,140,40,${0.5 * flick})`); g.addColorStop(0.5, `rgba(255,90,20,${0.2 * flick})`); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.p) {
      const k = Math.max(0, p.life / p.max); const rad = p.rad * (0.35 + k * 0.65);
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      gr.addColorStop(0, `rgba(255,${Math.round(120 + 110 * k)},40,${0.6 * k})`); gr.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
};
