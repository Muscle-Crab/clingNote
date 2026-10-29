// Static sanity check (no browser needed): `node scripts/check-sfc.js`
// For HomeView.vue and src/components/home/*.vue it (1) parses/compiles each SFC (script + template),
// and (2) flags template identifiers that resolve to neither <script setup> bindings nor props
// (these would be runtime "undefined" errors, e.g. after moving markup into a child component).
const fs = require('fs');
const path = require('path');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// Undeclared identifiers in a script (typos / things left behind after moving code). Browser/JS globals are fine.
const KNOWN_GLOBALS = new Set(['window', 'document', 'console', 'localStorage', 'Date', 'Intl', 'RegExp', 'Blob', 'File', 'URL', 'crypto', 'Uint8Array', 'Float32Array', 'TextEncoder', 'Math', 'Number', 'String', 'Object', 'Array', 'Promise', 'JSON',
  'Boolean', 'Error', 'Set', 'Map', 'parseInt', 'parseFloat', 'isNaN', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'alert', 'confirm',
  'process', 'require', 'SpeechSynthesisUtterance', 'undefined', 'NaN', 'Infinity', 'navigator', 'Notification', 'Audio', 'FileReader', 'URL', 'fetch', 'event',
  'defineProps', 'defineEmits', 'defineExpose', 'defineModel', 'withDefaults']);
// known pre-existing issues, reported as warnings rather than failures
const KNOWN_PREEXISTING = new Set(['deleteDoc']);
const freeVars = (code) => {
  const ast = babelParser.parse(code, { sourceType: 'module', plugins: [] });
  const out = new Set();
  traverse(ast, { Program(p) { Object.keys(p.scope.globals).forEach((g) => out.add(g)); } });
  return [...out].filter((g) => !KNOWN_GLOBALS.has(g));
};
const reportFree = (code, problems, warnings) => {
  try { freeVars(code).forEach((g) => (KNOWN_PREEXISTING.has(g) ? warnings : problems).push(`script uses undeclared identifier "${g}"`)); }
  catch (e) { problems.push('script parse: ' + e.message); }
};

const root = path.join(__dirname, '..', 'src');
const files = [path.join(root, 'views/HomeView.vue')];
const dir = path.join(root, 'components/home');
const jsModules = ['utils', 'composables'].flatMap((d) => fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith('.js')).map((f) => path.join(root, d, f)));
if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => f.endsWith('.vue')).forEach((f) => files.push(path.join(dir, f)));

const GLOBALS = new Set(['$event', '$slots', '$attrs', '$emit', '$props', '$refs', '$el', '$route', '$router', '$store', '$nextTick', '$parent', '$root']);
let failed = false;
for (const file of files) {
  const rel = path.relative(path.join(__dirname, '..'), file);
  const src = fs.readFileSync(file, 'utf8');
  const { descriptor, errors } = parse(src, { filename: file });
  const problems = errors.map((e) => String(e.message || e));
  const warnings = [];
  if (descriptor.scriptSetup) reportFree(descriptor.scriptSetup.content, problems, warnings);
  let bindings;
  if (descriptor.scriptSetup || descriptor.script) {
    try {
      const sc = compileScript(descriptor, { id: 'x', inlineTemplate: false });
      bindings = sc.bindings;
    } catch (e) { problems.push('script: ' + e.message); }
  }
  if (descriptor.template) {
    const r = compileTemplate({
      source: descriptor.template.content, filename: file, id: 'x',
      compilerOptions: { bindingMetadata: bindings, prefixIdentifiers: true },
    });
    r.errors.forEach((e) => problems.push('template: ' + (e.message || e)));
    (r.code.match(/_resolveComponent\("[^"]+"/g) || []).forEach((m) => {
      const n = m.slice(m.indexOf('"') + 1, -1);
      if (!['router-link', 'router-view', 'RouterLink', 'RouterView', 'transition', 'Transition'].includes(n)) problems.push(`component "${n}" is not imported/registered`);
    });
    const unresolved = new Set();
    (r.code.match(/_ctx\.[A-Za-z_$][\w$]*/g) || []).forEach((m) => {
      const n = m.slice(5);
      if (!GLOBALS.has('$' + n) && !GLOBALS.has(n) && !(bindings && n in bindings)) unresolved.add(n);
    });
    unresolved.forEach((n) => problems.push(`template uses "${n}" which is not a binding/prop (resolves on _ctx)`));
  }
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${rel}`);
  problems.forEach((p) => console.log('   - ' + p));
  warnings.forEach((w) => console.log('   ! (pre-existing) ' + w));
  if (problems.length) failed = true;
}
for (const file of jsModules) {
  const problems = []; const warnings = [];
  reportFree(fs.readFileSync(file, 'utf8'), problems, warnings);
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${path.relative(path.join(__dirname, '..'), file)}`);
  problems.forEach((p) => console.log('   - ' + p));
  if (problems.length) failed = true;
}
process.exit(failed ? 1 : 0);
