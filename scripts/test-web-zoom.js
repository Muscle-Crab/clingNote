// Run: node scripts/test-web-zoom.js  (website keeps pinch-zoom; zoom lock only in the iOS app)
const fs = require('fs'); const path = require('path'); const assert = require('assert'); const r = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
t('index.html viewport allows zoom', () => { const vp = [...r('public/index.html').matchAll(/name="viewport" content="([^"]+)"/g)].pop()[1]; /* web (else) branch */ assert.ok(!/user-scalable=no|maximum-scale/.test(vp), vp); });
t('iOS bundle (VUE_APP_NATIVE_BUILD) ships the locked viewport in static HTML (no wide-layout clipping)', () => { const h = r('public/index.html'); assert.ok(/VUE_APP_NATIVE_BUILD === '1'[^]*?maximum-scale=1, user-scalable=no, viewport-fit=cover[^]*?else[^]*?initial-scale=1, viewport-fit=cover/.test(h)); });
t('ui.css: pan-y touch lock only under html.cn-native', () => { const c = r('src/assets/ui.css'); assert.ok(!/^html, body \{ touch-action: pan-y/m.test(c)); assert.ok(c.includes('html.cn-native, html.cn-native body { touch-action: pan-y; }')); });
t('main.js: gesture blocking + locked viewport only when isNative()', () => { const m = r('src/main.js'); assert.ok(/isNative\(\) && \/iPhone\|iPad\|iPod\/\.test/.test(m)); assert.ok(m.includes("classList.add('cn-native')")); assert.ok(!/^if \(typeof document !== 'undefined' && \/iPhone/m.test(m)); });
t('inputs stay >= 16px on mobile (no iOS focus auto-zoom)', () => assert.ok(/font-size: max\(16px, 1em\)/.test(r('src/assets/ui.css'))));
console.log(`\n${n} web-zoom tests passed`);
