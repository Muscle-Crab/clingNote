<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4">
    <div class="bg-white dark:bg-gray-800 shadow-lg rounded-2xl w-full max-w-md p-6 sm:p-8">
      <!-- Header -->

      <!-- Login Form -->
      <form @submit.prevent="loginUser" class="space-y-4">
        <div>
          <label for="email-address" class="sr-only">Email address</label>
          <input id="email-address" type="email" v-model="email" required
                 class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                 placeholder="Email address" />
        </div>
        <div>
          <label for="password" class="sr-only">Password</label>
          <input id="password" type="password" v-model="password" required
                 class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                 placeholder="Password" />
        </div>

        <!-- Submit -->
        <div>
          <button type="submit" :disabled="isSubmitting"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg class="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0-1.104.896-2 2-2s2 .896 2 2v1h1a1 1 0 011 1v6a1 1 0 01-1 1H8a1 1 0 01-1-1v-6a1 1 0 011-1h1v-1c0-1.104.896-2 2-2s2 .896 2 2z" />
            </svg>
            <span>Login</span>
          </button>
        </div>

        <!-- Sign in with Apple (iOS app only; App Store Guideline 4.8) -->
        <div v-if="showApple">
          <button type="button" @click.prevent="signInWithAppleClick" :disabled="isSubmitting" data-test="apple-signin"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white text-black border border-white hover:bg-gray-200 text-sm font-semibold disabled:opacity-50">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.37 1.43c0 1.14-.46 2.22-1.2 3.02-.8.86-2.1 1.52-3.14 1.44-.13-1.1.42-2.25 1.15-3 .82-.86 2.2-1.5 3.19-1.46zM20.5 17.1c-.55 1.27-.82 1.84-1.52 2.96-1 1.57-2.4 3.52-4.14 3.54-1.55.02-1.95-1-4.05-.99-2.1.01-2.54 1.01-4.09.99-1.74-.02-3.07-1.78-4.07-3.35C-.27 15.7-.56 10.6 1.4 7.88c1.4-1.93 3.6-3.06 5.67-3.06 2.1 0 3.42 1.15 5.16 1.15 1.68 0 2.7-1.15 5.14-1.15 1.84 0 3.79 1 5.18 2.73-4.55 2.5-3.81 9 .0 9.55z"/></svg>
            <span>Sign in with Apple</span>
          </button>
        </div>

        <!-- Google Sign-in (web only: Google blocks embedded WKWebView OAuth, so it is hidden in the iOS app) -->
        <div>
          <button v-if="showGoogle" @click.prevent="signInWithGoogle"
                  class="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium">
            <img src="https://img.icons8.com/color/48/000000/google-logo.png" class="h-5 w-5" alt="Google" />
            <span>Sign in with Google</span>
          </button>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            By continuing, you agree to our
            <router-link to="/terms" class="text-blue-600 hover:underline dark:text-blue-400" data-test="login-terms">Terms & Conditions</router-link>
            and <router-link to="/privacy-policy" class="text-blue-600 hover:underline dark:text-blue-400" data-test="login-privacy">Privacy Policy</router-link>.
          </p>
        </div>

        <!-- Error -->
        <div v-if="errorMessage" class="text-red-500 text-sm text-center">{{ errorMessage }}</div>
        <div class="text-center text-sm"><button type="button" class="underline text-gray-300" @click="resetPassword">Forgot password?</button></div>
        <div v-if="infoMessage" class="text-green-400 text-sm text-center">{{ infoMessage }}</div>
      </form>

      <!-- Register Link -->
      <div class="mt-6 text-sm text-center text-gray-600 dark:text-gray-300">
        Don't have an account?
        <router-link to="/register" class="text-indigo-600 hover:underline dark:text-indigo-400">Register</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { isNativeIOS } from '@/utils/platform';
import { signInWithApple } from '@/utils/appleAuth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const showApple = isNativeIOS();
const showGoogle = !isNativeIOS(); // native Google needs @capacitor-firebase/authentication + GoogleService-Info.plist (see progress notes)
const _rd = useRoute().query.redirect;
const afterLogin = () => (typeof _rd === 'string' && _rd.startsWith('/') && !_rd.startsWith('//') ? _rd : '/');
const email = ref(typeof useRoute().query.email === 'string' ? useRoute().query.email : '');
const password = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');
const infoMessage = ref('');
const resetPassword = async () => {
  errorMessage.value = ''; infoMessage.value = '';
  if (!email.value) { errorMessage.value = 'Enter your email above first.'; return; }
  try { await sendPasswordResetEmail(auth, email.value); infoMessage.value = 'If an account exists for that email, a reset link is on its way.'; }
  catch (e) { console.error('[reset]', e); errorMessage.value = e.code === 'auth/invalid-email' ? 'Invalid email format.' : 'Could not send reset email. Try again.'; }
};

const loginUser = async () => {
  try {
    isSubmitting.value = true;
    const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value);
    const user = userCredential.user;
    console.log('Successfully logged in user:', user.email);
    email.value = '';
    password.value = '';
    router.push(afterLogin());
  } catch (error) {
    console.error('Login failed:', error.message);
    errorMessage.value = "Invalid Credentials";
  } finally {
    isSubmitting.value = false;
  }
};


const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
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
      router.push('/onboarding');
      return;
      console.log("🎉 New user created with credits and hasPaid set.");
    } else {
      // Returning user — update last login only
      await setDoc(userRef, {
        lastLogin: new Date(),
      }, { merge: true });
      console.log("✅ Existing user, last login updated.");
    }

    router.push(afterLogin());
  } catch (error) {
    console.error('Google sign-in failed:', error.message);
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
      router.push('/onboarding');
      return;
    }
    await setDoc(userRef, { lastLogin: new Date(), ...(a.givenName ? { name } : {}) }, { merge: true });
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
