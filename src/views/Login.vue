<template>
  <div class="login-page flex justify-center px-4 pt-4 pb-10 sm:pt-10">
    <div class="bg-white dark:bg-gray-800 shadow-lg rounded-2xl w-full max-w-md p-6 sm:p-8">
      <!-- Header -->

      <!-- Sign in: Apple (iOS app + web) / Google (web + iOS app). New accounts are created on first Apple/Google sign-in; there is no email sign-up. -->
      <h1 class="text-xl font-semibold text-center text-gray-900 dark:text-gray-100 mb-1" data-test="login-title">Sign in to ClingNote</h1>
      <p class="text-sm text-center text-gray-500 dark:text-gray-400 mb-5">New here? Signing in creates your account.</p>
      <div class="space-y-3">
        <!-- Sign in with Apple (App Store Guideline 4.8) -->
        <button v-if="showApple" type="button" @click.prevent="signInWithAppleClick" :disabled="isSubmitting" data-test="apple-signin"
                class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white text-black border border-gray-900 dark:border-white hover:bg-gray-200 text-sm font-semibold disabled:opacity-50">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.37 1.43c0 1.14-.46 2.22-1.2 3.02-.8.86-2.1 1.52-3.14 1.44-.13-1.1.42-2.25 1.15-3 .82-.86 2.2-1.5 3.19-1.46zM20.5 17.1c-.55 1.27-.82 1.84-1.52 2.96-1 1.57-2.4 3.52-4.14 3.54-1.55.02-1.95-1-4.05-.99-2.1.01-2.54 1.01-4.09.99-1.74-.02-3.07-1.78-4.07-3.35C-.27 15.7-.56 10.6 1.4 7.88c1.4-1.93 3.6-3.06 5.67-3.06 2.1 0 3.42 1.15 5.16 1.15 1.68 0 2.7-1.15 5.14-1.15 1.84 0 3.79 1 5.18 2.73-4.55 2.5-3.81 9 .0 9.55z"/></svg>
          <span>Sign in with Apple</span>
        </button>
        <!-- Google: web = Firebase popup; iOS app = native Google Sign-In SDK (Google blocks OAuth inside WKWebView) -->
        <button v-if="showGoogle" type="button" @click.prevent="signInWithGoogle" :disabled="isSubmitting" data-test="google-signin"
                class="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50">
          <img src="https://img.icons8.com/color/48/000000/google-logo.png" class="h-5 w-5" alt="Google" />
          <span>Sign in with Google</span>
        </button>
        <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
          By continuing, you agree to our
          <router-link to="/terms" class="text-blue-600 hover:underline dark:text-blue-400" data-test="login-terms">Terms & Conditions</router-link>
          and <router-link to="/privacy-policy" class="text-blue-600 hover:underline dark:text-blue-400" data-test="login-privacy">Privacy Policy</router-link>.
          <router-link to="/support" class="block mt-2 text-gray-500 dark:text-gray-400 underline" data-test="login-support">Support</router-link>
        </p>
      </div>

      <div v-if="errorMessage && !showEmail" class="mt-3 text-red-600 dark:text-red-400 text-sm text-center" role="alert">{{ errorMessage }}</div>

      <!-- Existing email accounts only (sign-in + forgot password; no sign-up). Kept for legacy email users and the App Store review demo login. -->
      <div class="mt-6 text-center">
        <button v-if="!showEmail" type="button" class="text-xs text-gray-500 dark:text-gray-400 underline min-h-[44px] px-3" data-test="email-toggle" @click="openEmail">Sign in with email</button>
      </div>
      <form v-if="showEmail" @submit.prevent="loginUser" class="space-y-3" data-test="email-form">
        <p class="text-xs text-center text-gray-500 dark:text-gray-400">For existing email accounts.</p>
        <div>
          <label for="email-address" class="sr-only">Email address</label>
          <input id="email-address" ref="emailEl" type="email" v-model="email" required autocomplete="email" autocapitalize="none" autocorrect="off" data-test="login-email"
                 class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                 placeholder="Email address" />
        </div>
        <div>
          <label for="password" class="sr-only">Password</label>
          <PasswordField id="password" v-model="password" required autocomplete="current-password" placeholder="Password"
                         input-class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
        </div>
        <button type="submit" :disabled="isSubmitting" data-test="email-login"
                class="w-full px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 text-white text-sm font-semibold disabled:opacity-50">Sign in</button>
        <div v-if="errorMessage" class="text-red-600 dark:text-red-400 text-sm text-center" role="alert" data-test="login-error">{{ errorMessage }}</div>
        <div class="text-center text-sm"><button type="button" class="underline text-indigo-600 dark:text-indigo-300 min-h-[44px] px-3 disabled:opacity-50" :disabled="isResetting" data-test="forgot-password" @click="resetPassword">{{ isResetting ? 'Sending…' : 'Forgot password?' }}</button></div>
        <div v-if="infoMessage" class="text-green-700 dark:text-green-400 text-sm text-center" role="status" data-test="login-info">{{ infoMessage }}</div>
      </form>

    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import PasswordField from '@/components/ui/PasswordField.vue';
import { requestPasswordReset, loginErrorMessage } from '@/utils/authReset';
import { signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { signInWithGoogle as googleSignIn } from '@/utils/googleAuth';
import { isNativeIOS } from '@/utils/platform';
import { signInWithApple } from '@/utils/appleAuth';
import { hasSeenTutorial, markTutorialSeen } from '@/utils/entryGuard';
import { syncAfterAuth } from '@/composables/useEightHour';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const showApple = isNativeIOS();
const showGoogle = true; // iOS uses native Google Sign-In (src/utils/googleAuth.js)
const _rd = useRoute().query.redirect;
const afterLogin = () => (typeof _rd === 'string' && _rd.startsWith('/') && !_rd.startsWith('//') ? _rd : '/');
// A brand-new account created from this page (Apple/Google) that never saw the tutorial goes through it first (/welcome?new=1), then on to the post-signup setup + paywall.
const afterNewAccount = () => (hasSeenTutorial() ? '/onboarding' : { path: '/welcome', query: { new: '1' } });
// Existing account: tutorial is for new users only. Also flush a wake pick cached before sign-up (a locked server plan always wins).
const afterSignIn = () => { markTutorialSeen(); syncAfterAuth().catch(() => {}); };
const email = ref(typeof useRoute().query.email === 'string' ? useRoute().query.email : '');
const password = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');
const infoMessage = ref('');
const emailEl = ref(null);
const showEmail = ref(!!email.value);
const openEmail = async () => { showEmail.value = true; errorMessage.value = ''; await nextTick(); if (emailEl.value) emailEl.value.focus(); };
const isResetting = ref(false);
const resetPassword = async () => {
  if (isResetting.value) return;
  errorMessage.value = ''; infoMessage.value = '';
  isResetting.value = true;
  try {
    const r = await requestPasswordReset(sendPasswordResetEmail, auth, email.value);
    if (r.ok) infoMessage.value = r.message;
    else { errorMessage.value = r.message; if (r.code) console.error('[reset]', r.code); }
    if (r.field === 'email') { await nextTick(); if (emailEl.value) emailEl.value.focus(); }
  } finally { isResetting.value = false; }
};

const loginUser = async () => {
  errorMessage.value = ''; infoMessage.value = '';
  try {
    isSubmitting.value = true;
    const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value);
    const user = userCredential.user;
    console.log('Successfully logged in user:', user.email);
    email.value = '';
    password.value = '';
    afterSignIn();
    router.push(afterLogin());
  } catch (error) {
    console.error('Login failed:', error.message);
    errorMessage.value = loginErrorMessage(error);
  } finally {
    isSubmitting.value = false;
  }
};


const signInWithGoogle = async () => {
  errorMessage.value = ''; infoMessage.value = '';
  try {
    const result = await googleSignIn();
    const user = result.user;

    console.log('Google sign-in successful:', user.email);

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // First time sign-in — assign credits and hasPaid
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        profilePicture: user.photoURL,
        provider: user.providerId,
        lastLogin: new Date(),
        isPro: false,
        plan: 'free',
        onboardingComplete: false,
      });
      syncAfterAuth().catch(() => {});
      router.push(afterNewAccount());
      return;
    } else {
      // Returning user — update last login only
      await setDoc(userRef, {
        lastLogin: new Date(),
      }, { merge: true });
      console.log("✅ Existing user, last login updated.");
    }

    afterSignIn();
    router.push(afterLogin());
  } catch (error) {
    console.error('Google sign-in failed:', error?.code || '', error?.message);
    if (/cancel/i.test(String(error?.message || error?.code || ''))) return; // user closed the Google sheet
    errorMessage.value = "Google sign-in failed.";
  }
};

const signInWithAppleClick = async () => {
  errorMessage.value = ''; infoMessage.value = '';
  try {
    isSubmitting.value = true;
    const a = await signInWithApple();
    const user = a.user;
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    // Apple only returns the name on the very first authorization, so store it now.
    const name = [a.givenName, a.familyName].filter(Boolean).join(' ') || user.displayName || (user.email || '').split('@')[0] || 'You';
    if (a.givenName && !user.displayName) { try { await updateProfile(user, { displayName: name }); } catch (e) { /* non-fatal */ } }
    if (!userSnap.exists()) {
      await setDoc(userRef, { id: user.uid, uid: user.uid, name, email: user.email || a.email || '', provider: 'apple.com', lastLogin: new Date(), createdAt: new Date(), isPro: false, plan: 'free', onboardingComplete: false });
      syncAfterAuth().catch(() => {});
      router.push(afterNewAccount());
      return;
    }
    await setDoc(userRef, { lastLogin: new Date(), ...(a.givenName ? { name } : {}) }, { merge: true });
    afterSignIn();
    router.push(afterLogin());
  } catch (error) {
    const code = String(error?.code || error?.message || '');
    if (/1001|cancel/i.test(code)) return; // user dismissed the Apple sheet
    console.error('Apple sign-in failed:', code);
    errorMessage.value = 'Sign in with Apple failed. Please try again.' + (isNativeIOS() ? ' [' + code.slice(0, 90) + ']' : '');
  } finally {
    isSubmitting.value = false;
  }
};
</script>
