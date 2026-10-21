// Static security checks: no OpenAI key/URL in client code, no client writes of billing fields, rules file shape.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const root = path.join(__dirname, '..'); let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const src = walk(path.join(root, 'src')).filter((f) => /\.(vue|js)$/.test(f)).map((f) => [path.relative(root, f), fs.readFileSync(f, 'utf8')]);
for (const [f, s] of src) {
  ok(!/OPENAI_API_KEY|VUE_APP_OPENAI/.test(s), `${f}: no OpenAI key reference`);
  ok(!s.includes('api.openai.com'), `${f}: no direct OpenAI call`);
  ok(!/sk-[A-Za-z0-9]{20,}/.test(s), `${f}: no hardcoded secret-looking key`);
  ok(!/updateDoc\([^)]*users[^)]*\)\s*,\s*\{[^}]*\bcredits\s*:/.test(s), `${f}: no client credits update`);
}
const R = fs.readFileSync(path.join(root, 'firestore.rules.tight'), 'utf8');
ok(!/allow [a-z, ]+: if true;/.test(R), 'no public (unauthenticated) access');
ok(/match \/tasks\/\{taskId\} \{\s*allow read, write: if false;/.test(R), 'tasks denied');
ok(R.includes("routineId.split('_')[0]"), 'weeklyRoutines prefix owner check');
ok(/match \/streaks\/\{userId\} \{\s*allow read, write: if isOwner\(userId\);/.test(R), 'streaks owner-only');
ok(R.includes('affectedKeys().hasAny(billingKeys())'), 'billing fields protected');
ok(R.includes("hasOnly(['comments', 'reactions', 'readComments'])"), 'posts limited fields');
ok(R.trim().endsWith('}') && R.includes('match /{document=**}'), 'default deny kept');
const opens = (R.match(/\{/g) || []).length, closes = (R.match(/\}/g) || []).length; ok(opens === closes, 'braces balanced');
console.log(`test-security: ${pass} passed`);
