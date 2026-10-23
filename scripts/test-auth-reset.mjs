// Forgot-password flow + password show/hide field.
import assert from 'assert';
import fs from 'fs';
import { requestPasswordReset, isEmailish, resetErrorMessage, loginErrorMessage, normalizeEmail } from '../src/utils/authReset.js';
const calls = []; const ok = async (...a) => { calls.push(a); };
const failWith = (code) => async () => { const e = new Error('x'); e.code = code; throw e; };
const AUTH = { id: 'auth' };
(async () => {
  let r = await requestPasswordReset(ok, AUTH, ''); assert.equal(r.ok, false); assert.equal(r.field, 'email'); assert.ok(/enter your email/i.test(r.message)); assert.equal(calls.length, 0, 'empty email: nothing is sent');
  r = await requestPasswordReset(ok, AUTH, '   '); assert.equal(r.field, 'email'); assert.equal(calls.length, 0);
  r = await requestPasswordReset(ok, AUTH, 'not-an-email'); assert.equal(r.ok, false); assert.equal(r.field, 'email'); assert.ok(/doesn't look right/.test(r.message)); assert.equal(calls.length, 0);
  r = await requestPasswordReset(ok, AUTH, '  zz.test@example.com '); assert.equal(r.ok, true); assert.ok(r.message.includes('zz.test@example.com'));
  assert.deepEqual(calls[0], [AUTH, 'zz.test@example.com'], 'sent with (auth, trimmedEmail) only: no actionCodeSettings / continue URL');
  assert.ok((await requestPasswordReset(failWith('auth/user-not-found'), AUTH, 'a@b.co')).ok, 'unknown email looks like success (no account enumeration)');
  for (const [code, re] of [['auth/invalid-email', /doesn't look right/], ['auth/too-many-requests', /Too many requests/], ['auth/network-request-failed', /Network error/], ['auth/internal-error', /Could not send/]]) {
    const x = await requestPasswordReset(failWith(code), AUTH, 'a@b.co'); assert.equal(x.ok, false); assert.ok(re.test(x.message), code + ' -> ' + x.message);
  }
  assert.ok(/Could not send/.test(resetErrorMessage(null)));
  assert.equal(loginErrorMessage({ code: 'auth/network-request-failed' }).startsWith('Network'), true); assert.equal(loginErrorMessage({ code: 'auth/wrong-password' }), 'Invalid Credentials'); assert.ok(/Too many/.test(loginErrorMessage({ code: 'auth/too-many-requests' })));
  assert.ok(isEmailish('a@b.co') && !isEmailish('a@b') && !isEmailish('a b@c.de')); assert.equal(normalizeEmail(null), '');
  // wiring (static)
  const login = fs.readFileSync(new URL('../src/views/Login.vue', import.meta.url), 'utf8');
  assert.ok(/data-test="forgot-password"/.test(login) && /:disabled="isResetting"/.test(login), 'Forgot password button, disabled while sending');
  assert.ok(/requestPasswordReset\(sendPasswordResetEmail, auth, email\.value\)/.test(login) && !/actionCodeSettings|handleCodeInApp/.test(login), 'no continue URL');
  assert.ok(/<PasswordField/.test(login), 'show/hide password on Login');
  assert.ok(!/type="password"/.test(login), 'no raw password inputs left on those screens');
  console.log('test-auth-reset: ok');
})().catch((e) => { console.error(e); process.exit(1); });
