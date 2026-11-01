// Appearance (per device, localStorage): theme mode (system / light / dark) + text size (system / default / large / larger).
// Theme: <html data-theme="light|dark">; colors come from the CSS variables in src/assets/ui.css, overridden in src/assets/theme-light.css.
// Text size: one zoom factor for the whole UI so every px-sized layout scales together and reflows (no per-element font edits).
//   iOS app: native WKWebView.pageZoom (ClingNative.setPageZoom) = same as Safari's text-size menu, viewport units stay correct.
//   Web: CSS `zoom` on <html> (browsers also have their own Ctrl/Cmd + zoom), capped lower because 100vh sheets grow with CSS zoom.
// "System" text size follows iOS Dynamic Type (WebKit's -apple-system-body font = 17px at the default size) or the browser's root font size.
export const APPEARANCE_KEY = 'clingnote.appearance.v1';
export const MODES = ['system', 'light', 'dark'];
export const TEXT_SIZES = { system: null, m: 1, l: 1.12, xl: 1.25 };
export const DEFAULT_APPEARANCE = Object.freeze({ mode: 'dark', text: 'system' }); // dark = today's look; light/system are opt-in
export const ZOOM_MIN = 0.9; export const ZOOM_MAX_NATIVE = 1.35; export const ZOOM_MAX_WEB = 1.2;
export const ZOOM_MAX_AUTO_NATIVE = 1.1; // 'system'/Auto on iOS: follow Dynamic Type only up to 1.10 (larger AX sizes overflowed Home); A/A+/A++ unaffected
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const normAppearance = (v) => {
  const o = v && typeof v === 'object' ? v : {};
  return { mode: MODES.includes(o.mode) ? o.mode : DEFAULT_APPEARANCE.mode, text: Object.prototype.hasOwnProperty.call(TEXT_SIZES, o.text) ? o.text : DEFAULT_APPEARANCE.text };
};
export const loadAppearance = (storage) => { try { return normAppearance(JSON.parse(storage.getItem(APPEARANCE_KEY) || 'null')); } catch (e) { return normAppearance(null); } };
export const saveAppearance = (storage, v) => { const n = normAppearance(v); try { storage.setItem(APPEARANCE_KEY, JSON.stringify(n)); } catch (e) { /* private mode */ } return n; };

export const resolveTheme = (mode, prefersDark) => (mode === 'system' ? (prefersDark ? 'dark' : 'light') : (mode === 'light' ? 'light' : 'dark'));
// systemPx: measured -apple-system-body size (iOS) or root font size (web); base: 17 (iOS body) or 16 (web root).
export const systemScale = (systemPx, base) => (Number(systemPx) > 0 && Number(base) > 0 ? Number(systemPx) / Number(base) : 1);
export const zoomFor = (text, { systemPx, base = 16, native = false } = {}) => {
  const fixed = TEXT_SIZES[text];
  const raw = fixed ?? systemScale(systemPx, base);
  const hi = native ? (fixed == null ? ZOOM_MAX_AUTO_NATIVE : ZOOM_MAX_NATIVE) : ZOOM_MAX_WEB;
  const z = clamp(raw, ZOOM_MIN, hi);
  return Math.round(z * 100) / 100;
};

// Measure iOS Dynamic Type through WebKit's system font keyword. Returns { px, base } or null when unsupported.
// apple=false (web): only the browser's root font size (macOS Safari's -apple-system-body is 13px, not Dynamic Type).
export const measureSystemText = (doc, apple = true) => {
  try {
    if (apple) {
      const el = doc.createElement('span'); el.style.cssText = 'position:absolute;visibility:hidden;font:-apple-system-body;';
      const ok = /-apple-system-body/.test(el.style.font || ''); // unsupported keyword -> declaration dropped
      doc.body.appendChild(el); const px = parseFloat(doc.defaultView.getComputedStyle(el).fontSize); el.remove();
      if (ok && px > 0) return { px, base: 17 };
    }
    const root = parseFloat(doc.defaultView.getComputedStyle(doc.documentElement).fontSize);
    return root > 0 ? { px: root, base: 16 } : null;
  } catch (e) { return null; }
};

// Apply to the document. env: { document, matchMedia, native, setPageZoom(z) }. Returns what was applied.
export const applyAppearance = (prefs, env) => {
  const p = normAppearance(prefs); const doc = env.document; const html = doc.documentElement;
  const dark = !!(env.matchMedia && env.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = resolveTheme(p.mode, dark);
  html.setAttribute('data-theme', theme); html.style.colorScheme = theme;
  const meta = doc.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', theme === 'light' ? '#F3F5FA' : '#070D1C');
  const m = p.text === 'system' ? measureSystemText(doc, !!env.native) : null;
  const zoom = zoomFor(p.text, { systemPx: m && m.px, base: m ? m.base : 16, native: !!env.native });
  html.setAttribute('data-text', p.text === 'system' ? 'system' : p.text);
  if (env.native && env.setPageZoom) { html.style.zoom = ''; env.setPageZoom(zoom); } else html.style.zoom = zoom === 1 ? '' : String(zoom);
  html.style.setProperty('--ui-zoom', String(zoom));
  return { theme, zoom, mode: p.mode, text: p.text };
};
