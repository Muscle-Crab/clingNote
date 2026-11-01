// Campfire flames for the "Campfire" picture. WebGL (one small quad around the fire, cheap fragment shader) with a Canvas2D fallback.
// Flames: fbm-noise driven turbulent upward flow, gentle flicker, color ramp white-yellow core -> orange -> red -> faint smoke.
// Heat shimmer: the picture just above the flames is resampled with a tiny noise offset. Calm on purpose (slow flow, soft flicker).
import { safeRadialGradient } from './canvasSafe.js';
const VS = `attribute vec2 p; uniform vec4 vbox; uniform vec2 vres; varying vec2 uv;
void main(){ uv = p; vec2 px = vbox.xy + p * vbox.zw; vec2 c = px / vres * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }`;
const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
 varying vec2 uv; uniform float t; uniform sampler2D img; uniform vec4 imgBox; uniform vec4 box; uniform vec2 res; uniform float hasImg;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * n(p); p = p * 2.03 + 3.1; a *= 0.5; } return v; }
void main(){
  // uv: x 0..1 across the box, y 0 at the top of the box .. 1 at its bottom. The fire base sits at y = 0.86.
  float y = (0.86 - uv.y) / 0.86;           // 0 at base, 1 at box top
  float x = (uv.x - 0.5) * 2.0;
  float flow = fbm(vec2(x * 3.4, y * 3.6 - t * 1.3));            // slow upward turbulent flow
  float fine = fbm(vec2(x * 8.0 + 7.0, y * 7.0 - t * 2.1));      // ragged edges
  float flick = 0.94 + 0.04 * sin(t * 2.3) + 0.02 * sin(t * 5.3 + 1.7); // soft, never strobing
  float wob = (fbm(vec2(y * 1.8 - t * 0.55, 4.0)) - 0.5) * 0.6 * y;
  float tongues = 0.55 + 0.45 * fbm(vec2(x * 4.5, t * 0.35));     // several tongues of different heights
  float H = 0.5 * flick * tongues;
  float hw = 0.46 * pow(max(1.0 - y / 0.6, 0.0), 0.6);
  float d = abs(x - wob) / max(hw, 0.001);
  float f = (1.0 - d) * 1.05 - (y / H) * 0.6 + (flow - 0.5) * 1.2 + (fine - 0.5) * 0.5;
  f = clamp(f, 0.0, 1.0) * step(-0.05, y) * step(y, 0.62) * smoothstep(-0.06, 0.05, y);
  vec3 col = mix(vec3(0.55, 0.08, 0.02), vec3(1.0, 0.42, 0.08), smoothstep(0.15, 0.45, f));
  col = mix(col, vec3(1.0, 0.82, 0.38), smoothstep(0.5, 0.8, f));
  col = mix(col, vec3(1.0, 0.97, 0.86), smoothstep(0.8, 1.0, f) * (1.0 - smoothstep(0.05, 0.3, y)));
  float fa = smoothstep(0.02, 0.45, f) * mix(0.55, 0.92, smoothstep(0.0, 0.14, y)); // logs glow through at the base
  // faint smoke above the flames
  float sm = fbm(vec2(x * 1.6 - t * 0.12, y * 1.4 - t * 0.35)) * smoothstep(0.35, 0.6, y) * (1.0 - smoothstep(0.75, 1.0, y)) * (1.0 - smoothstep(0.2, 0.8, abs(x - wob * 1.5)));
  float sa = sm * 0.16;
  // heat shimmer: re-sample the picture just above the flames with a small moving offset
  vec3 base = vec3(0.0); float ba = 0.0;
  if (hasImg > 0.5) {
    vec2 px = box.xy + uv * box.zw;
    float sh = smoothstep(0.2, 0.42, y) * (1.0 - smoothstep(0.55, 0.85, y)) * (1.0 - smoothstep(0.15, 0.55, abs(x)));
    vec2 d = vec2(fbm(vec2(uv.x * 9.0, uv.y * 7.0 - t * 1.6)) - 0.5, 0.0) * 2.6 * sh;
    vec2 iuv = (px + d - imgBox.xy) / imgBox.zw;
    base = texture2D(img, iuv).rgb; ba = sh * 0.6;
  }
  vec3 outc = col * fa + vec3(0.42, 0.40, 0.40) * sa * (1.0 - fa);
  float oa = fa + sa * (1.0 - fa);
  outc = outc + base * ba * (1.0 - oa); oa = oa + ba * (1.0 - oa);
  gl_FragColor = vec4(outc, oa);
}`;

// Box (screen px) around the fire: centred on the base, 5x its width wide, tall enough for flames + smoke.
export const fireBox = (rect, fire) => { const fw = fire.w * rect.w; const bw = fw * 3.2; const bh = fw * 3.4; const cx = rect.x + fire.x * rect.w; const by = rect.y + fire.y * rect.h; return { x: cx - bw / 2, y: by - bh * 0.86, w: bw, h: bh }; };

export const createFireGL = (canvas, image) => {
  let gl = null;
  try { gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  let prog;
  try { prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null; } catch (e) { return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = { vbox: U('vbox'), vres: U('vres'), t: U('t'), box: U('box'), res: U('res'), imgBox: U('imgBox'), hasImg: U('hasImg'), img: U('img') };
  let hasImg = 0;
  if (image) { try { const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image); hasImg = 1; } catch (e) { hasImg = 0; } }
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return {
    kind: 'webgl',
    draw(t, a) { // a = ambience (w, h, rect, sc.fire); canvas is w*dpr x h*dpr
      const k = canvas.width / a.w; const b = fireBox(a.rect, a.sc.fire);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(u.t, t); gl.uniform4f(u.box, b.x * k, b.y * k, b.w * k, b.h * k); gl.uniform2f(u.res, canvas.width, canvas.height); gl.uniform4f(u.vbox, b.x * k, b.y * k, b.w * k, b.h * k); gl.uniform2f(u.vres, canvas.width, canvas.height);
      gl.uniform4f(u.imgBox, a.rect.x * k, a.rect.y * k, a.rect.w * k, a.rect.h * k); gl.uniform1f(u.hasImg, hasImg); gl.uniform1i(u.img, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }, // keep the context: a canvas can only ever own one
  };
};

// Canvas2D fallback: layered soft tongues with the same ramp (no shimmer).
export const drawFire2D = (ctx, t, a) => {
  const b = fireBox(a.rect, a.sc.fire); const cx = b.x + b.w / 2; const by = b.y + b.h * 0.86; const fw = a.sc.fire.w * a.rect.w;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const ph = i * 1.7; const hh = fw * (1.1 + 0.35 * Math.sin(t * (1.6 + i * 0.21) + ph)) * (i % 3 === 0 ? 1.25 : 0.9);
    const x = cx + (i - 3) * fw * 0.09 + Math.sin(t * 1.3 + ph) * fw * 0.05; const r = fw * 0.32;
    const g = safeRadialGradient(ctx, x, by - hh * 0.35, 0, x, by - hh * 0.35, hh * 0.6);
    if (!g || !(r > 0)) continue;
    g.addColorStop(0, 'rgba(255,240,200,.55)'); g.addColorStop(0.3, 'rgba(255,170,60,.35)'); g.addColorStop(0.7, 'rgba(230,70,20,.12)'); g.addColorStop(1, 'rgba(120,20,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, by - hh * 0.35, r, hh * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
};
