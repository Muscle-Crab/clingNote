<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="bg-white p-8 rounded shadow-md max-w-md w-full">
      <h2 class="text-3xl font-extrabold text-gray-900 text-center mb-6">Register</h2>
      <form @submit.prevent="registerUser" class="space-y-4">

        <!-- Name -->
        <div>
          <label for="name" class="sr-only">Name</label>
          <input id="name" name="name" type="text" v-model="name" required placeholder="Name"
                 class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
        </div>

        <!-- Email -->
        <div>
          <label for="email-address" class="sr-only">Email address</label>
          <input id="email-address" name="email" type="email" v-model="email" required placeholder="Email address"
                 class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
        </div>

        <!-- Password -->
        <div>
          <label for="password" class="sr-only">Password</label>
          <input id="password" name="password" type="password" v-model="password" required placeholder="Password"
                 class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
        </div>

        <!-- Profile Photo Upload -->
        <div>
          <label class="block text-sm font-medium text-gray-700">Profile Photo</label>
          <input type="file" @change="handleAvatarUpload" accept="image/*"
                 class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200" />
          <div v-if="avatarPreview" class="mt-2">
            <img :src="avatarPreview" alt="Preview" class="w-16 h-16 rounded-full object-cover border" />
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="text-red-500 bg-red-100 border border-red-400 px-4 py-2 rounded mb-4">
          {{ errorMessage }}
        </div>

        <!-- Terms -->
        <p class="text-sm text-gray-600 dark:text-gray-300 mt-4">
          By continuing, you agree to our
          <router-link to="/terms" class="text-blue-600 hover:underline">
            Terms & Conditions
          </router-link>.
        </p>

        <!-- Submit Button -->
        <div>
          <button type="submit" :disabled="isSubmitting"
                  class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <span class="mr-2">
              <svg class="h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                   fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd"
                      d="M6 9V7a5 5 0 0 1 10 0v2h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h2z"
                      clip-rule="evenodd" />
              </svg>
            </span>
            <span>Register</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, storage } from '@/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const router = useRouter();

const email = ref('');
const password = ref('');
const name = ref('');
const dob = ref('');
const gender = ref('');
const avatar = ref(null);
const avatarPreview = ref(null);
const isSubmitting = ref(false);
const errorMessage = ref('');

const handleAvatarUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    avatar.value = file;
    avatarPreview.value = URL.createObjectURL(file);
  }
};

const getFriendlyErrorMessage = (error) => {
  const errorMap = {
    "auth/email-already-in-use": "This email is already registered. Please use a different email or log in.",
    "auth/weak-password": "Your password is too weak. Please use at least 6 characters.",
    "auth/invalid-email": "Invalid email format. Please enter a valid email address.",
    "auth/missing-email": "Please enter an email address.",
    "auth/missing-password": "Please enter a password.",
    "auth/user-not-found": "No account found with this email. Please sign up first.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/network-request-failed": "Network error. Please check your connection and try again.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
  };
  return errorMap[error.code] || "An unexpected error occurred. Please try again.";
};

const registerUser = async () => {
  errorMessage.value = '';
  try {
    isSubmitting.value = true;
    const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value);
    const user = userCredential.user;

    let avatarURL = '';
    if (avatar.value) {
      const storagePath = `avatars/${user.uid}`;
      const imageRef = storageRef(storage, storagePath);
      await uploadBytes(imageRef, avatar.value);
      avatarURL = await getDownloadURL(imageRef);
    }

    const userData = {
      id: user.uid,
      email: user.email,
      name: name.value,
      dob: dob.value,
      gender: gender.value,
      credits: 15,
      hasPaid: false,
      avatarURL,
    };

    await setDoc(doc(db, 'users', user.uid), userData);

    // Reset form
    email.value = '';
    password.value = '';
    name.value = '';
    dob.value = '';
    gender.value = '';
    avatar.value = null;
    avatarPreview.value = null;

    router.push('/');
  } catch (error) {
    errorMessage.value = getFriendlyErrorMessage(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>
