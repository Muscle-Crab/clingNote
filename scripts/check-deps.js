// Run first by `npm run check`: reports missing installs instead of letting tests crash with MODULE_NOT_FOUND.
const fs = require('fs'); const path = require('path'); const root = path.join(__dirname, '..');
const dirs = [['.', 'repo root'], ['netlify/functions', 'netlify/functions']];
let fatal = false;
for (const [d, label] of dirs) {
  const pkg = path.join(root, d, 'package.json'); if (!fs.existsSync(pkg)) continue;
  const { dependencies = {}, devDependencies = {} } = JSON.parse(fs.readFileSync(pkg, 'utf8'));
  const missing = Object.keys({ ...dependencies, ...devDependencies }).filter((m) => { for (let p = path.join(root, d); ; p = path.dirname(p)) { if (fs.existsSync(path.join(p, 'node_modules', m, 'package.json'))) return false; if (path.dirname(p) === p) return true; } });
  if (missing.length) {
    console.error(`check-deps: ${missing.length} package(s) missing in ${label}: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', ...' : ''} -> run \`npm ci\`${d === '.' ? '' : ` in ${d}`}`);
    if (d === '.') fatal = true;
  }
}
if (fatal) process.exit(1);
console.log('check-deps: ok');
