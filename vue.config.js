const { defineConfig } = require('@vue/cli-service')
// VUE_APP_NATIVE_BUILD=1 (npm run build:ios) -> bundle for the Capacitor iOS app: skip website-only/test files from public/ (the 26MB landing video is dropped in src/utils/landingMedia.js).
const NATIVE = process.env.VUE_APP_NATIVE_BUILD === '1'
const NATIVE_PUBLIC_EXCLUDE = ['**/iphone.mov', '**/test.html', '**/sw.js']
module.exports = defineConfig({
  transpileDependencies: true,
  productionSourceMap: !NATIVE, // no source maps inside the app bundle
  chainWebpack: (config) => {
    config.plugin('html').tap((args) => { args[0].title = 'CleanNote'; return args; });
    if (NATIVE) {
      config.plugin('copy').tap((args) => {
        args[0].patterns.forEach((p) => { p.globOptions = p.globOptions || {}; p.globOptions.ignore = [...(p.globOptions.ignore || []), ...NATIVE_PUBLIC_EXCLUDE]; });
        return args;
      });
    }
  },
})
