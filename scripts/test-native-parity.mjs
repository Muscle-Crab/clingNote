// Run: node scripts/test-native-parity.mjs  (iOS-shell parity: AdSense skipped, in-app navigation for 402, target=_blank -> in-app browser, local Notification guards)
import fs from 'fs'; import path from 'path'; import os from 'os'; import assert from 'assert'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

await t('AdSense script is only injected on the web (not in the native shell)', () => {
  const h = rd('public/index.html');
  assert(!/<script[^>]+src="https:\/\/pagead2\.googlesyndication\.com/.test(h), 'no static AdSense tag');
  const i = h.indexOf('pagead2.googlesyndication.com'); assert(i > 0, 'still present for web');
  assert(/isNativePlatform\(\)\)\) \{[^}]*pagead2/.test(h.slice(h.lastIndexOf('<script>', i), i + 200)), 'guarded by the native check');
});
await t('useAi 402 goes through the router, not a full page load', () => { const s = rd('src/composables/useAi.js'); assert(!/location\.assign|location\.href/.test(s)); assert(/default\.push\(\{ path: '\/paywall', query: \{ feature: 'aiCoach' \} \}\)/.test(s)); });
await t('no raw window.open / location redirects left in views (except through openExternal)', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(path.join(root, 'src/views'))) { const s = fs.readFileSync(f, 'utf8'); assert(!/window\.open\(/.test(s), `${f} uses window.open`); }
});
await t('local Notification calls are guarded (typeof + permission + try/catch) so native never throws', () => {
  const s = rd('src/views/HomeView.vue');
  for (const m of s.matchAll(/new Notification\(/g)) { const before = s.slice(Math.max(0, m.index - 220), m.index); assert(/typeof Notification !== 'undefined' && Notification\.permission === 'granted'/.test(before), 'guard'); const after = s.slice(m.index, m.index + 320); assert(/catch \(e\)/.test(after), 'try/catch'); }
});
await t('main.js installs the _blank interceptor', () => assert(/interceptBlankLinks\(\);/.test(rd('src/main.js'))));

// openExternal with a stubbed platform module
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oe-')); let native = true;
fs.writeFileSync(path.join(dir, 'oe.mjs'), rd('src/utils/openExternal.js').replace("import { isNative } from '@/utils/platform';", 'const isNative = () => globalThis.__native;'));
const { interceptBlankLinks, openExternal } = await import(path.join(dir, 'oe.mjs'));
await t('interceptBlankLinks: native only, http(s) target=_blank only', async () => {
  globalThis.__native = false; assert.equal(interceptBlankLinks({ addEventListener() {} }, false), null, 'web: untouched');
  let handler; const doc = { addEventListener: (ev, h, cap) => { assert.equal(ev, 'click'); assert.equal(cap, true); handler = h; } };
  assert.ok(interceptBlankLinks(doc, true)); const opened = [];
  globalThis.window = { open: (u) => opened.push(u) }; globalThis.__native = true;
  const mk = (href, extra = {}) => { const a = { href, getAttribute: () => href }; let prevented = false; return { ev: { target: { closest: (sel) => { assert.match(sel, /target="_blank"/); return extra.noMatch ? null : a; } }, defaultPrevented: false, preventDefault: () => { prevented = true; } }, was: () => prevented }; };
  let c = mk('https://example.com/x'); handler(c.ev); assert.ok(c.was(), 'https blank link intercepted');
  c = mk('mailto:a@b.c'); handler(c.ev); assert.ok(!c.was(), 'mailto left alone');
  c = mk('https://example.com', { noMatch: true }); handler(c.ev); assert.ok(!c.was(), 'normal links left alone');
  globalThis.__native = false; assert.equal(await openExternal('https://e.com', 'w=1'), true); assert.deepEqual(opened, ['https://e.com'], 'web still window.open');
});
console.log(`${n} passed`);
