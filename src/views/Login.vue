<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="bg-white p-8 rounded shadow-md max-w-md w-full">
      <h2 class="text-3xl font-extrabold text-gray-900 text-center mb-6">Login</h2>

      <!-- 📌 Bookmark Prompt -->
      <div v-if="showBookmarkPrompt" class="bg-yellow-100 border border-yellow-300 text-yellow-800 p-4 rounded mb-6 text-sm">
        <p v-if="isIos">To bookmark this app, tap the <strong>Share</strong> icon and choose <strong>"Add to Home Screen"</strong>.</p>
        <p v-else-if="isAndroid">To bookmark this app, tap the <strong>⋮ menu</strong> and select <strong>"Add to Home screen"</strong>.</p>
        <p v-else>Press <strong>Ctrl+D</strong> (Windows) or <strong>Cmd+D</strong> (Mac) to bookmark this app.</p>
        <button @click="showBookmarkPrompt = false" class="mt-2 text-blue-600 hover:underline">Dismiss</button>
      </div>

      <form @submit.prevent="loginUser" class="space-y-4">
        <!-- Login Fields -->
        <div>
          <label for="email-address" class="sr-only">Email address</label>
          <input id="email-address" name="email" type="email" v-model="email" required placeholder="Email address"
                 class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
        </div>
        <div>
          <label for="password" class="sr-only">Password</label>
          <input id="password" name="password" type="password" v-model="password" required placeholder="Password" class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
        </div>
        <div>
          <button type="submit" :disabled="isSubmitting" class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <span class="mr-2">
              <svg class="h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M6 9V7a5 5 0 0 1 10 0v2h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h2z" clip-rule="evenodd" />
              </svg>
            </span>
            <span>Login</span>
          </button>
        </div>
        <div>
          <button @click.prevent="signInWithGoogle" class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
            <span class="mr-2">
              <img src="https://img.icons8.com/color/48/000000/google-logo.png" alt="Google Icon" class="h-5 w-5"/>
            </span>
            <span>Sign in with Google</span>
          </button>
          <p class="text-sm text-gray-600 dark:text-gray-300 mt-4">
            By continuing, you agree to our
            <router-link to="/terms" class="text-blue-600 hover:underline">
              Terms & Conditions
            </router-link>.
          </p>

        </div>
        <div v-if="errorMessage" class="text-red-500 text-sm">{{ errorMessage }}</div>
      </form>
      <div class="mt-4 text-sm text-center">
        Don't have an account? <a href="#" class="text-indigo-600 hover:underline"><router-link to="/register">Register</router-link></a>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      profilePicture: user.photoURL,
      provider: user.providerId,
      lastLogin: new Date(),
    });

    router.push('/');
  } catch (error) {
    console.error('Google sign-in failed:', error.message);
    errorMessage.value = "Google sign-in failed.";
  }
};
</script>

