<template>
  <div class="max-w-xl mx-auto p-6 text-gray-800 dark:text-gray-100" data-test="support-page">
    <h1 class="text-2xl font-bold mb-3">ClingNote Support</h1>
    <p class="mb-4">Need help? Email us at
      <a :href="'mailto:' + EMAIL" class="text-blue-600 dark:text-blue-400 underline font-semibold" data-test="support-email">{{ EMAIL }}</a>
      and we will get back to you.</p>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">To delete your account: Profile &rarr; Delete account (<router-link :to="deletePath" class="underline" data-test="support-delete-account">open</router-link>).</p>
    <nav class="flex flex-wrap gap-4 text-sm" aria-label="Legal">
      <router-link to="/privacy-policy" class="text-blue-600 hover:underline">Privacy Policy</router-link>
      <router-link to="/terms" class="text-blue-600 hover:underline">Terms &amp; Conditions</router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { auth } from '@/firebaseConfig';

const EMAIL = 'musclecrabs@gmail.com';
const deletePath = computed(() => (auth.currentUser ? `/profile/${auth.currentUser.uid}?delete=1` : '/login'));
</script>
