// Guard for CanvasRenderingContext2D.createRadialGradient, which throws on
// non-finite arguments and on negative radii. Returns null when the gradient
// can't be built (NaN/Infinity coords, zero/negative outer radius) so callers
// can simply skip that draw instead of crashing the animation loop.
export const safeRadialGradient = (ctx, x0, y0, r0, x1, y1, r1) => {
  if (!ctx || typeof ctx.createRadialGradient !== 'function') return null;
  const n = [x0, y0, r0, x1, y1, r1];
  for (const v of n) if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  if (r0 < 0 || r1 <= 0) return null;
  try { return ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); } catch (e) { return null; }
};
