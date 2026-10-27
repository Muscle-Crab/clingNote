// Run: node scripts/test-appearance.js  (theme mode + text size: storage, resolution, zoom clamps, DOM application)
const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appear-'));
for (const f of fs.readdirSync(path.join(__dirname, '../src/utils')).filter((x) => x.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(__dirname, '../src/utils', f), 'utf8').replace(/from '\.\/([\w]+)'/g, "from './$1.mjs'").replace(/from '@\/utils\/([\w]+)'/g, "from './$1.mjs'"));
const A = await import(path.join(dir, 'appearance.mjs'));
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
// Minimal DOM double: documentElement attributes + style, a theme-color meta, a computed root font size.
const fakeDoc = ({ rootPx = 16, applePx = null } = {}) => {
  const attrs = {}; const style = { setProperty(k, v) { this[k] = v; } }; const meta = { content: '', setAttribute(k, v) { this[k] = v; } };
  const html = { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k], style };
  const doc = {
    documentElement: html, attrs, meta,
    querySelector: (q) => (q.includes('theme-color') ? meta : null),
    createElement: () => { const el = { style: { _font: '', set cssText(v) { if (applePx && /font:-apple-system-body/.test(v)) this._font = '-apple-system-body'; }, get font() { return this._font; } }, remove() {} }; el._apple = true; return el; },
    body: { appendChild() {} },
    defaultView: { getComputedStyle: (el) => ({ fontSize: el === html ? `${rootPx}px` : `${applePx || rootPx}px` }) },
  };
  return doc;
};
const mm = (dark) => () => ({ matches: dark });

t('defaults: dark + system text (current look unchanged)', () => { assert.deepStrictEqual(A.loadAppearance(mem()), { mode: 'dark', text: 'system' }); });
t('normalize rejects junk values', () => {
  assert.deepStrictEqual(A.normAppearance({ mode: 'neon', text: 'huge' }), { mode: 'dark', text: 'system' });
  assert.deepStrictEqual(A.normAppearance('x'), { mode: 'dark', text: 'system' });
  assert.deepStrictEqual(A.normAppearance({ mode: 'light', text: 'xl' }), { mode: 'light', text: 'xl' });
});
t('save/load round trip + corrupt storage', () => {
  const s = mem(); A.saveAppearance(s, { mode: 'system', text: 'l' }); assert.deepStrictEqual(A.loadAppearance(s), { mode: 'system', text: 'l' });
  s.setItem(A.APPEARANCE_KEY, '{bad'); assert.deepStrictEqual(A.loadAppearance(s), { mode: 'dark', text: 'system' });
});
t('resolveTheme follows the OS only in system mode', () => {
  assert.strictEqual(A.resolveTheme('system', true), 'dark'); assert.strictEqual(A.resolveTheme('system', false), 'light');
  assert.strictEqual(A.resolveTheme('light', true), 'light'); assert.strictEqual(A.resolveTheme('dark', false), 'dark');
});
t('zoomFor: fixed sizes, Dynamic Type scale, clamps (web lower cap)', () => {
  assert.strictEqual(A.zoomFor('m'), 1); assert.strictEqual(A.zoomFor('l'), 1.12); assert.strictEqual(A.zoomFor('xl', { native: true }), 1.25);
  assert.strictEqual(A.zoomFor('system', { systemPx: 17, base: 17, native: true }), 1);
  assert.strictEqual(A.zoomFor('system', { systemPx: 21, base: 17, native: true }), 1.24);
  assert.strictEqual(A.zoomFor('system', { systemPx: 53, base: 17, native: true }), A.ZOOM_MAX_NATIVE); // AX5 accessibility size
  assert.strictEqual(A.zoomFor('system', { systemPx: 14, base: 17, native: true }), 0.9);
  assert.strictEqual(A.zoomFor('system', { systemPx: 24, base: 16 }), A.ZOOM_MAX_WEB);
  assert.strictEqual(A.zoomFor('system', {}), 1);
});
t('applyAppearance web: light theme attr, meta color, CSS zoom', () => {
  const d = fakeDoc(); const r = A.applyAppearance({ mode: 'light', text: 'l' }, { document: d, matchMedia: mm(true) });
  assert.deepStrictEqual([r.theme, r.zoom], ['light', 1.12]);
  assert.strictEqual(d.attrs['data-theme'], 'light'); assert.strictEqual(d.attrs['data-text'], 'l'); assert.strictEqual(d.meta.content, '#F3F5FA');
  assert.strictEqual(d.documentElement.style.zoom, '1.12'); assert.strictEqual(d.documentElement.style.colorScheme, 'light');
});
t('applyAppearance web default text: no zoom set; system mode follows dark OS', () => {
  const d = fakeDoc(); const r = A.applyAppearance({ mode: 'system', text: 'system' }, { document: d, matchMedia: mm(true) });
  assert.strictEqual(r.theme, 'dark'); assert.strictEqual(d.documentElement.style.zoom, ''); assert.strictEqual(d.meta.content, '#070D1C');
});
t('applyAppearance native: uses pageZoom (not CSS zoom) and measures Dynamic Type', () => {
  const d = fakeDoc({ applePx: 23 }); let z = null;
  const r = A.applyAppearance({ mode: 'dark', text: 'system' }, { document: d, matchMedia: mm(false), native: true, setPageZoom: (v) => { z = v; } });
  assert.strictEqual(r.zoom, 1.35); assert.strictEqual(z, 1.35); assert.strictEqual(d.documentElement.style.zoom, '');
});
t('measureSystemText: web ignores -apple-system-body (macOS reports 13px)', () => {
  const d = fakeDoc({ rootPx: 20, applePx: 13 });
  assert.deepStrictEqual(A.measureSystemText(d, false), { px: 20, base: 16 });
  assert.deepStrictEqual(A.measureSystemText(d, true), { px: 13, base: 17 });
});
t('light stylesheet exists and only applies under html[data-theme="light"]', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/assets/theme-light.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const sels = css.split('}').map((b) => b.split('{')[0].trim()).filter(Boolean);
  assert.ok(sels.length > 10);
  for (const s of sels) for (const part of s.split(',')) assert.ok(part.trim().startsWith('html[data-theme="light"]'), `unscoped selector: ${part.trim()}`);
  assert.ok(/--c-bg:\s*#F3F5FA/.test(css) && /color-scheme:\s*light/.test(css));
  assert.ok(fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8').includes("theme-light.css"));
});
console.log(`\n${n} appearance tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
