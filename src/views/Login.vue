<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="bg-white p-8 rounded shadow-md max-w-md w-full">
      <h2 class="text-3xl font-extrabold text-gray-900 text-center mb-6">Login</h2>
      <form @submit.prevent="loginUser" class="space-y-4">
        <div>
          <label for="email-address" class="sr-only">Email address</label>
          <input id="email-address" name="email" type="email" v-model="email" required placeholder="Email address" class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
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
        <div v-if="errorMessage" class="text-red-500 text-sm">{{ errorMessage }}</div>
      </form>
      <div class="mt-4 text-sm text-center">
        Don't have an account? <a href="/register" class="text-indigo-600 hover:underline">Register here</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { useRouter } from 'vue-router';

const router = useRouter();

const email = ref('');
const password = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');

const loginUser = async () => {
  try {
    isSubmitting.value = true;
    const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value);
    const user = userCredential.user;
    console.log('Successfully logged in user:', user.email);
    // Clear form fields after login
    email.value = '';
    password.value = '';
    // Redirect to the homepage or any other route after login
    router.push('/');
  } catch (error) {
    console.error('Login failed:', error.message);
    errorMessage.value = "Invalid Credentials";
  } finally {
    isSubmitting.value = false;
  }
};
</script>
