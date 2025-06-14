<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4">
    <div class="bg-white dark:bg-gray-800 shadow-lg rounded-2xl w-full max-w-md p-6 sm:p-8">
      <!-- Header -->
      <h2 class="text-2xl sm:text-3xl font-bold text-center text-gray-800 dark:text-white mb-6">
        Welcome Back 👋
      </h2>

      <!-- 📌 Bookmark Prompt -->
      <div v-if="showBookmarkPrompt" class="bg-yellow-100 dark:bg-yellow-200/10 border border-yellow-300 dark:border-yellow-500 text-yellow-800 dark:text-yellow-300 p-4 rounded-md text-sm mb-6">
        <p v-if="isIos">To bookmark this app, tap the <strong>Share</strong> icon and choose <strong>"Add to Home Screen"</strong>.</p>
        <p v-else-if="isAndroid">To bookmark this app, tap the <strong>⋮ menu</strong> and select <strong>"Add to Home screen"</strong>.</p>
        <p v-else>Press <strong>Ctrl+D</strong> (Windows) or <strong>Cmd+D</strong> (Mac) to bookmark this app.</p>
        <button @click="showBookmarkPrompt = false" class="mt-3 text-blue-600 hover:underline dark:text-blue-400">Dismiss</button>
      </div>

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

        <!-- Google Sign-in -->
        <div>
          <button @click.prevent="signInWithGoogle"
                  class="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium">
            <img src="https://img.icons8.com/color/48/000000/google-logo.png" class="h-5 w-5" alt="Google" />
            <span>Sign in with Google</span>
          </button>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            By continuing, you agree to our
            <router-link to="/terms" class="text-blue-600 hover:underline dark:text-blue-400">Terms & Conditions</router-link>.
          </p>
        </div>

        <!-- Error -->
        <div v-if="errorMessage" class="text-red-500 text-sm text-center">{{ errorMessage }}</div>
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
import { ref, onMounted } from 'vue';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { useRouter } from 'vue-router';

const router = useRouter();
const email = ref('');
const password = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');

// Platform detection
const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
const isAndroid = /android/.test(window.navigator.userAgent.toLowerCase());
const showBookmarkPrompt = ref(false);

onMounted(() => {
  // Show bookmark prompt only if not already dismissed (you can enhance with localStorage)
  showBookmarkPrompt.value = true;
});

const loginUser = async () => {
  try {
    isSubmitting.value = true;
    const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value);
    const user = userCredential.user;
    console.log('Successfully logged in user:', user.email);
    email.value = '';
    password.value = '';
    router.push('/');
  } catch (error) {
    console.error('Login failed:', error.message);
    errorMessage.value = "Invalid Credentials";
  } finally {
    isSubmitting.value = false;
  }
};
onMounted(() => {
  showBookmarkPrompt.value = true;

  // Speak the instruction based on platform
  const message = isIos
      ? 'To bookmark this app, tap the Share icon and choose Add to Home Screen.'
      : isAndroid
          ? 'To bookmark this app, tap the three dots menu and select Add to Home screen.'
          : 'Press Control D on Windows or Command D on Mac to bookmark this app.';

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1;
  speechSynthesis.speak(utterance);
});


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
        credits: 15,
        hasPaid: true,
      });
      console.log("🎉 New user created with credits and hasPaid set.");
    } else {
      // Returning user — update last login only
      await setDoc(userRef, {
        lastLogin: new Date(),
      }, { merge: true });
      console.log("✅ Existing user, last login updated.");
    }

    router.push('/');
  } catch (error) {
    console.error('Google sign-in failed:', error.message);
    errorMessage.value = "Google sign-in failed.";
  }
};
</script>

