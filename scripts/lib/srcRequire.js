// Test helper: require ES-module files from src/ in plain node (babel -> CJS, '@/' alias, assets stubbed, 'firebase/*' and '@/firebaseConfig' left to the caller's stubs).
const fs = require('fs'); const path = require('path'); const Module = require('module'); const babel = require('@babel/core');
const src = path.join(__dirname, '..', '..', 'src');
const stubs = {};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (stubs[req]) return req;
  if (req.startsWith('@/')) req = path.join(src, req.slice(2));
  return origResolve.call(this, req, ...rest);
};
const origLoad = Module._load;
Module._load = function (req, ...rest) { return stubs[req] ? stubs[req] : origLoad.call(this, req, ...rest); };
const toCjs = (code, filename) => babel.transformSync(code, { filename, babelrc: false, configFile: false, presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' }, modules: 'commonjs' }]] }).code;
const { parse, compileScript } = require('@vue/compiler-sfc');
require.extensions['.vue'] = (mod, filename) => {
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'), { filename });
  mod._compile(toCjs(compileScript(descriptor, { id: 'sr', inlineTemplate: true }).content, filename), filename);
};
for (const ext of ['.svg', '.png', '.jpg', '.webp', '.mp3', '.css']) require.extensions[ext] = (mod, filename) => { mod.exports = filename; };
const origJs = require.extensions['.js'];
require.extensions['.js'] = (mod, filename) => {
  if (filename.startsWith(src) || filename.includes(`${path.sep}netlify${path.sep}functions${path.sep}lib${path.sep}eightHourCore`)) { if (filename.startsWith(src)) mod._compile(toCjs(fs.readFileSync(filename, 'utf8'), filename), filename); else origJs(mod, filename); }
  else origJs(mod, filename);
};
module.exports = { src, stubs, load: (rel) => require(path.join(src, rel)) };
