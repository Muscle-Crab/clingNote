<template>
  <div class="p-6 max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg">
    <h1 class="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Terms and Conditions</h1>
    <p class="mb-4 text-gray-700 dark:text-gray-300">
      Welcome to our app. By accessing or using our services, you agree to be bound by the following terms and conditions.
    </p>

    <h2 class="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">1. User Responsibilities</h2>
    <p class="mb-4 text-gray-600 dark:text-gray-400">
      You are responsible for maintaining the confidentiality of your account and all activities under your account.
    </p>

    <h2 class="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">2. Prohibited Activities</h2>
    <p class="mb-4 text-gray-600 dark:text-gray-400">
      You agree not to misuse the app by intentionally spreading malware, spamming, or violating any laws.
    </p>

    <h2 class="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">3. Termination</h2>
    <p class="mb-4 text-gray-600 dark:text-gray-400">
      We reserve the right to terminate or suspend access to our services immediately, without prior notice, for any breach.
    </p>

    <h2 class="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">4. Changes</h2>
    <p class="mb-4 text-gray-600 dark:text-gray-400">
      We may update these Terms from time to time. Continued use of the service after any changes constitutes your acceptance.
    </p>

    <p class="mt-6 text-sm text-gray-500 dark:text-gray-400">
      Last updated: {{ lastUpdated }}
    </p>
  </div>
</template>

<script setup>
const lastUpdated = 'March 27, 2025';
</script>
