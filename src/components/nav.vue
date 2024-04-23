<template>
  <nav class="bg-white border-gray-200 dark:bg-gray-900">
    <!-- Header -->
    <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
      <a href="https://flowbite.com/" class="flex items-center space-x-3 rtl:space-x-reverse">
        <img src="@/assets/logo.png" class="h-8" alt="Flowbite Logo" />
        <span class="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">Flowbite</span>
      </a>
      <button @click="toggleSidebar" type="button" class="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600" aria-expanded="false">
        <span class="sr-only">Open sidebar</span>
        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1h15M1 7h15M1 13h15"/>
        </svg>
      </button>
    </div>
    <!-- Sidebar -->
    <aside :class="{ 'hidden': !sidebarOpen, 'block': sidebarOpen }" class="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div class="flex items-center justify-between p-4">
        <span class="text-xl font-semibold dark:text-white">Sidebar</span>
        <button @click="closeSidebar" type="button" class="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none">
          <span class="sr-only">Close sidebar</span>
          <svg class="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
      <!-- Sidebar content -->
      <nav class="px-4 py-8">
        <ul class="space-y-4">
          <li>
            <a href="#" class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium">Home</a>
          </li>
          <li>
            <a href="#" class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium"><router-link to="/about">about</router-link></a>
          </li>
          <li>
            <a href="#" class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium">Services</a>
          </li>
          <li>
            <a href="#" class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium"></a>
          </li>

          <li>
            <!-- Add logout functionality -->
            <button @click="logout" class="text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-500 font-medium">Logout</button>
          </li>
        </ul>
      </nav>
    </aside>
    <!-- End of Sidebar -->
  </nav>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { auth } from '@/firebaseConfig'; // Import Firebase authentication
import { useRouter } from 'vue-router';

const router = useRouter();
const logout = async () => {

  try {
    await auth.signOut(); // Sign the user out
    console.log('logged out')
    router.push('/login');

  } catch (error) {
    console.error('Error logging out:', error.message);
  }
};
const sidebarOpen = ref(false);


const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
};

const closeSidebar = () => {
  sidebarOpen.value = false;
};



onMounted(() => {
  // Check window width on mount and open sidebar by default in desktop view
  if (window.innerWidth > 768) {
    sidebarOpen.value = true;
  }
});

</script>

<style scoped>
/* Add styles for the sidebar here */
</style>
