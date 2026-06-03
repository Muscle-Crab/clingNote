<template>
  <nav class="bg-black border-gray-200 dark:bg-gray-900">
    <!-- Header -->
    <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
      <button @click="toggleSidebar" type="button" class="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600" aria-expanded="false">
        <span class="sr-only">Open sidebar</span>
        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1h15M1 7h15M1 13h15"/>
        </svg>
      </button>
      <!-- Display user's email and profile picture -->
      <router-link :to="'/profile/' + userId" class="flex items-center space-x-3">

<!--        <div v-if="userEmail" class="text-gray-800 dark:text-gray-200">-->
<!--          {{ userEmail }}-->
<!--        </div>-->

          <div  v-if="userEmail" class="flex items-center space-x-3">
            <img
                v-if="avatarURL "
                :src="avatarURL"
                alt="Avatar"
                class="w-10 h-10 rounded-full border object-cover"
            />
            <img
                v-else
                src="https://ui-avatars.com/api/?name=User&background=4F46E5&color=fff&rounded=true"
                alt="Default Avatar"
                class="w-10 h-10 rounded-full border object-cover"
            />
          </div>

      </router-link>
    </div>

    <!-- Sidebar -->
    <aside :class="{ 'hidden': !sidebarOpen, 'block': sidebarOpen }"
           class="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div class="flex items-center justify-between p-4">
        <router-link to="/">
          <a href="#" class="flex items-center space-x-3 rtl:space-x-reverse">
            <img src="@/assets/logo.png" class="h-8" alt="Cling Note Logo"/>
            <span class="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">Clingnote</span>
          </a>
        </router-link>
        <button @click="closeSidebar" type="button"
                class="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none">
          <span class="sr-only">Close sidebar</span>
          <svg class="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"/>
          </svg>
        </button>
      </div>

      <!-- Sidebar content -->
      <nav class="px-4 py-8">
        <ul class="space-y-4">
          <!-- My Routine -->
          <li class="flex items-center space-x-3">
            <i class="fas fa-calendar-check text-gray-800 dark:text-gray-200"></i>
            <router-link to="/"
                         class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium">
              My Routine
            </router-link>
          </li>

          <!-- Chat -->
          <li class="flex items-center space-x-3">
            <i class="fas fa-comments text-gray-800 dark:text-gray-200"></i>
            <router-link to="/chat"
                         class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium">
              Chat
            </router-link>
          </li>


          <!-- Admin Only Routes -->
          <template v-if="userEmail === 'ds7513635@gmail.com'">
            <li class="flex items-center space-x-3">
              <i class="fas fa-info-circle text-gray-800 dark:text-gray-200"></i>
              <router-link to="/about"
                           class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium">
                About
              </router-link>
            </li>
          </template>

          <!-- Addiction -->
          <li class="flex items-center space-x-3">
            <i class="fas fa-ban text-gray-800 dark:text-gray-200"></i>
            <router-link to="/addiction"
                         class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium">
              Addiction
            </router-link>
          </li>

          <!-- Meal Tracker -->
          <li class="flex items-center space-x-3">
            <i class="fas fa-utensils text-gray-800 dark:text-gray-200"></i>
            <router-link to="/mealPlan"
                         class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium">
              Meal Tracker
            </router-link>
          </li>
          <li class="flex items-center space-x-3">
            <i class="fas fa-user-shield text-gray-800 dark:text-gray-200"></i>
            <router-link to="/privacy-policy"
                         class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium">
              Privacy Policy
            </router-link>
          </li>

          <!-- Logout -->
          <li class="flex items-center space-x-3">
            <i class="fas fa-sign-out-alt text-gray-800 dark:text-gray-200"></i>
            <button @click="logout"
                    class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium">
              Logout
            </button>
          </li>

        </ul>
      </nav>
    </aside>
  </nav>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { auth, db } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const router = useRouter();
const sidebarOpen = ref(false);
const userEmail = ref(null);
const userId = ref(null);
const avatarURL = ref(null); // New: Avatar URL from Firestore

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
};

const closeSidebar = () => {
  sidebarOpen.value = false;
};

const logout = async () => {
  try {
    await auth.signOut();
    console.log('logged out');
    router.push('/login');
  } catch (error) {
    console.error('Error logging out:', error.message);
  }
};

onMounted(() => {
  if (window.innerWidth > 768) {
    sidebarOpen.value = true;
  }

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      console.log("[AUTH] User logged in:", user.uid);
      userEmail.value = user.email;
      userId.value = user.uid;

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          avatarURL.value = userDocSnap.data().avatarURL || null;
        } else {
          console.warn("No user document found in Firestore.");
        }
      } catch (err) {
        console.error("Error fetching avatar:", err.message);
      }
    } else {
      console.log("[AUTH] User not logged in");
      userEmail.value = null;
      userId.value = null;
      avatarURL.value = null;
    }
  });
});
</script>


<style scoped>
/* Customize the sidebar or add responsive styles here if needed */
</style>
