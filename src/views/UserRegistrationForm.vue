<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="bg-white p-8 rounded shadow-md max-w-md w-full">
      <h2 class="text-3xl font-extrabold text-gray-900 text-center mb-6">Register</h2>
      <form @submit.prevent="registerUser" class="space-y-4">
        <div>
          <label for="name" class="sr-only">Name</label>
          <input id="name" name="name" type="text" v-model="name" required placeholder="Name" class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
        </div>
        <div>
          <label for="email-address" class="sr-only">Email address</label>
          <input id="email-address" name="email" type="email" v-model="email" required placeholder="Email address" class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
        </div>
        <div>
          <label for="password" class="sr-only">Password</label>
          <input id="password" name="password" type="password" v-model="password" required placeholder="Password" class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
        </div>
        <div>
          <label for="dob" class="sr-only">Date of Birth</label>
          <input id="dob" name="dob" type="date" v-model="dob" required placeholder="Date of Birth" class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
        </div>
        <div>
          <label for="gender" class="sr-only">Gender</label>
          <select id="gender" name="gender" v-model="gender" required class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm">
            <option value="" disabled selected>Select your gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <button type="submit" :disabled="isSubmitting" class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <span class="mr-2">
              <svg class="h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M6 9V7a5 5 0 0 1 10 0v2h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h2z" clip-rule="evenodd" />
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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/firebaseConfig';
import { collection, doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'vue-router';

const router = useRouter();

const email = ref('');
const password = ref('');
const name = ref('');
const dob = ref('');
const gender = ref('');
const avatar = ref(null);
const isSubmitting = ref(false);

const handleAvatarChange = (event) => {
  const file = event.target.files[0];
  avatar.value = file;
};

const registerUser = async () => {
  try {
    isSubmitting.value = true;
    const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value);
    const user = userCredential.user;

    const userData = {
      id: user.uid, // Adding the id field
      email: user.email,
      name: name.value,
      dob: dob.value,
      gender: gender.value,
      // avatarURL: if you have an avatar URL
    };

    // If avatar is selected, upload it to a storage bucket and get the URL
    if (avatar.value) {
      // Here you need to write code to upload the avatar to a storage bucket and get its URL
      // Example:
      // const avatarURL = await uploadAvatarToStorageBucket(avatar.value);
      // userData.avatarURL = avatarURL;
    }

    await setDoc(doc(db, 'users', user.uid), userData);

    console.log('Successfully registered user:', user.email);
    email.value = '';
    password.value = '';
    name.value = '';
    dob.value = '';
    gender.value = '';
    avatar.value = null;
    router.push('/');
  } catch (error) {
    console.error('Registration failed:', error.message);
  } finally {
    isSubmitting.value = false;
  }
};
</script>
