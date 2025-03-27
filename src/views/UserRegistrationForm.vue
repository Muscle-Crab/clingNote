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
        <div v-if="errorMessage" class="text-red-500 bg-red-100 border border-red-400 px-4 py-2 rounded mb-4">
          {{ errorMessage }}
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 mt-4">
          By continuing, you agree to our
          <router-link to="/terms" class="text-blue-600 hover:underline">
            Terms & Conditions
          </router-link>.
        </p>

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
const errorMessage = ref(''); // Add error message state

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
const sendNotificationToPlayer = async (userName, action) => {
  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // Replace with your actual API key
    'Content-Type': 'application/json'
  };

  const actionMessages = {
    created: {
      content: `${userName} has signed up! 🎉`,
      heading: "New User Registration"
    }
  };

  const data = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476", // Replace with your actual OneSignal app ID
    "include_player_ids": ["ff823cf5-aef7-4363-82f7-33c1de7ce02e"], // Replace with the player's device ID
    "contents": { "en": actionMessages[action]?.content || "A new user has registered." },
    "headings": { "en": actionMessages[action]?.heading || "Notification" }
  };

  try {
    await axios.post('https://onesignal.com/api/v1/notifications', data, { headers });
    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

const registerUser = async () => {
  errorMessage.value = ''; // Reset error message
  try {
    isSubmitting.value = true;
    const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value);
    const user = userCredential.user;

    const userData = {
      id: user.uid,
      email: user.email,
      name: name.value,
      dob: dob.value,
      gender: gender.value,
    };

    await setDoc(doc(db, 'users', user.uid), userData);

    // Send notification after successful signup
    await sendNotificationToPlayer(name.value, "created");

    email.value = '';
    password.value = '';
    name.value = '';
    dob.value = '';
    gender.value = '';
    avatar.value = null;
    router.push('/');
  } catch (error) {
    errorMessage.value = getFriendlyErrorMessage(error); // Set user-friendly error message
  } finally {
    isSubmitting.value = false;
  }
};

</script>
