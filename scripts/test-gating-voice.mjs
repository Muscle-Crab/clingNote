import { readFileSync } from 'fs'; import assert from 'assert';
const { PRO_FEATURES, canUse } = await import('../src/utils/pro.js');
assert(PRO_FEATURES.includes('community'));
assert.equal(canUse({}, 'community'), false); assert.equal(canUse({ isPro: true }, 'community'), true);
const r = readFileSync('src/router/index.js', 'utf8');
for (const p of ['/community', '/rankings', '/fdfd', '/chat']) assert(new RegExp(`path: '${p}',[\\s\\S]{0,200}?proFeature: 'community'`).test(r), p);
assert(readFileSync('src/components/paywall/PaywallPanel.vue', 'utf8').includes("t: 'Community'"));
const h = readFileSync('src/views/HomeView.vue', 'utf8');
assert(!/Your next task is/.test(h) && !h.includes('announceNextTask'), 'female next-task line removed');
for (const f of ['src/views/HomeView.vue', 'src/views/Room.vue', 'src/views/addiction.vue', 'src/composables/useSpeech.js', 'src/components/eighthour/EightHourChrome.vue'])
  assert(!readFileSync(f, 'utf8').includes('SpeechSynthesisUtterance'), `${f}: raw speechSynthesis`);
console.log('ok   community gating + single voice');
