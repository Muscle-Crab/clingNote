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

    <h2 class="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">3. Subscriptions and Purchases</h2>
    <p class="mb-4 text-gray-600 dark:text-gray-400">
      ClingNote Pro is offered as an auto-renewing monthly or yearly subscription, or as a one-time lifetime purchase. In the iPhone app, purchases are processed by Apple: payment is charged to your Apple ID account at confirmation of purchase, and subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours before the end of the current period. Manage or cancel subscriptions in your Apple ID account settings. Any free trial period offered, if you do not cancel before it ends, converts to a paid subscription; an unused portion of a trial is forfeited when you purchase a subscription. On the website, payments are processed by Stripe. Purchases made through Apple are also subject to Apple's standard
      <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" class="text-blue-600 hover:underline" target="_blank" rel="noopener">Licensed Application End User License Agreement</a>. You can restore previous purchases from the upgrade screen. Contact <a href="mailto:support@clingnote.app" class="text-blue-600 hover:underline">support@clingnote.app</a> for help; Apple handles refund requests for App Store purchases.
    </p>

    <h2 class="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">4. AI Features</h2>
    <p class="mb-4 text-gray-600 dark:text-gray-400">
      AI features are powered by OpenAI. Text you submit to them is sent to OpenAI to produce a response. AI output can be inaccurate and is not professional advice.
    </p>

    <h2 class="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">5. Termination</h2>
    <p class="mb-4 text-gray-600 dark:text-gray-400">
      We reserve the right to terminate or suspend access to our services immediately, without prior notice, for any breach.
    </p>

    <h2 class="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">6. Changes</h2>
    <p class="mb-4 text-gray-600 dark:text-gray-400">
      We may update these Terms from time to time. Continued use of the service after any changes constitutes your acceptance.
    </p>

    <p class="mt-6 text-sm text-gray-500 dark:text-gray-400">
      Last updated: {{ lastUpdated }}
    </p>
  </div>
</template>

<script setup>
const lastUpdated = 'October 23, 2026';
</script>
