// Run: node scripts/test-template-bindings.js
// Every identifier a <script setup> SFC's template uses must be declared in its script (setup binding, prop, import) or be a Vue builtin.
// Catches "dead button / blank text" bugs like @change="undefinedHandler" or {{ undefinedVar }} that eslint-less builds silently ship.
const fs = require('fs'); const path = require('path');
const sfc = require('@vue/compiler-sfc');
const root = path.join(__dirname, '../src');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const GLOBALS = new Set(['$slots', '$emit', '$attrs', '$props', '$refs', '$el', '$route', '$router', '$store', '$t', '$nextTick', '$forceUpdate', '$parent', '$root', '$options', '$data', '$watch', '$off', '$on', '$once']);
const bad = []; let checked = 0;
for (const f of walk(root).filter((x) => x.endsWith('.vue'))) {
  const src = fs.readFileSync(f, 'utf8'); const { descriptor } = sfc.parse(src, { filename: f });
  if (!descriptor.scriptSetup || !descriptor.template) continue;
  const id = path.basename(f);
  const script = sfc.compileScript(descriptor, { id });
  const t = sfc.compileTemplate({ source: descriptor.template.content, filename: f, id, compilerOptions: { bindingMetadata: script.bindings, inline: false, mode: 'module' } });
  checked++;
  const used = new Set([...t.code.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  for (const u of used) if (!(u in (script.bindings || {})) && !GLOBALS.has(u) && !GLOBALS.has('$' + u.slice(1)) && !u.startsWith('$')) bad.push(`${path.relative(path.join(__dirname, '..'), f)}: template uses undeclared "${u}"`);
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`ok - ${checked} <script setup> templates only use declared identifiers`);
