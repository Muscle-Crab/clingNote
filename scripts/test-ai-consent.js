// Static guarantees for the OpenAI consent gate (L1): askAi gates itself, every AI call site asks first, rules let the owner write the consent fields.
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..'); const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const t = (n, f) => { f(); console.log('ok -', n); };
t('askAi refuses to run without consent (before the fetch)', () => {
  const s = read('src/composables/useAi.js'); const a = s.indexOf('ensureAiConsent()'); const b = s.indexOf('fetch(fnUrl');
  assert(a > 0 && b > a, 'consent check must come before fetch'); assert(/consent-declined/.test(s));
});
t('every view that calls askAi also asks for consent first', () => {
  for (const f of ['src/views/HomeView.vue', 'src/views/MealPlan.vue']) {
    const s = read(f); assert(/ensureAiConsent\(\)/.test(s), f);
    const calls = [...s.matchAll(/askAi\('/g)].map((m) => m.index);
    for (const i of calls) { const before = s.slice(Math.max(0, i - 2500), i); assert(/ensureAiConsent\(\)/.test(before), f + ' askAi call without a consent check shortly before'); }
  }
});
t('no other file calls the AI endpoint', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'assets' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
  for (const f of walk(path.join(root, 'src')).filter((x) => /\.(vue|js)$/.test(x))) { const s = fs.readFileSync(f, 'utf8'); if (/fnUrl\('ai'\)/.test(s)) assert(f.endsWith('composables/useAi.js'), f); }
});
t('consent modal is mounted once in App.vue and offers Allow / Don\'t allow + a clear declined message', () => {
  assert(/<AiConsentModal/.test(read('src/App.vue')));
  const m = read('src/components/AiConsentModal.vue'); assert(/OpenAI/.test(m) && /ai-consent-allow/.test(m) && /ai-consent-decline/.test(m) && /ai-consent-declined/.test(m));
});
t('firestore.rules lets the owner write aiConsent* (not a server-only billing key)', () => {
  const r = read('firestore.rules'); const bk = r.slice(r.indexOf('function billingKeys'), r.indexOf('function freeDefaultsOnly'));
  assert(!/aiConsent/.test(bk)); assert(/match \/users\/\{userId\}/.test(r) && /allow update: if isOwner\(userId\)/.test(r));
});
console.log('ai consent tests passed');
