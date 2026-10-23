<template>
  <div class="max-w-3xl mx-auto p-6 text-gray-800">
    <h1 class="text-3xl font-bold mb-6">Privacy Policy</h1>

    <p class="mb-4">
      ClingNote ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our app.
    </p>

    <h2 class="text-xl font-semibold mt-6 mb-2">1. Information We Collect</h2>
    <ul class="list-disc pl-6 mb-4">
      <li><strong>Personal Information:</strong> Email address, name and authentication data (via Firebase Auth). If you use Sign in with Apple we receive the name and email Apple shares with us, which may be a private relay address if you choose to hide your email.</li>
      <li><strong>Usage Data:</strong> Task creation, reminders, voice and image uploads.</li>
      <li><strong>Device Information:</strong> Device ID used by OneSignal for push notifications.</li>
      <li><strong>Purchase Information (iPhone app):</strong> Your Pro subscription or purchase status, product, and expiry, and your anonymous ClingNote user ID, which are shared with RevenueCat to validate purchases. We never receive or store your payment card or Apple ID payment details.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-6 mb-2">2. How We Use Your Information</h2>
    <ul class="list-disc pl-6 mb-4">
      <li>To create and manage user accounts.</li>
      <li>To send reminders and updates via push notifications.</li>
      <li>To improve user experience and enhance app functionality.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-6 mb-2">3. Data Sharing and Disclosure</h2>
    <p class="mb-4">
      We do not sell or share your personal information with third parties except to provide services (Firebase, OneSignal, OpenAI, RevenueCat, and Stripe on the web) or if required by law.
    </p>
    <ul class="list-disc pl-6 mb-4">
      <li><strong>Apple (in-app purchases):</strong> In the iPhone app, Pro subscriptions and purchases are processed by Apple through the App Store. Apple handles your payment and billing and manages renewals and cancellations through your Apple ID settings.</li>
      <li><strong>RevenueCat:</strong> We use RevenueCat to validate and manage in-app purchases. RevenueCat receives purchase information (such as product, transaction and subscription status) and your ClingNote user ID, but not your name or email address. See <a href="https://www.revenuecat.com/privacy" class="text-blue-600 hover:underline" target="_blank" rel="noopener">RevenueCat's privacy policy</a>.</li>
      <li><strong>Stripe (web):</strong> On the website, payments are processed by Stripe; we do not store your card details.</li>
      <li><strong>OpenAI (AI features):</strong> When you use AI features such as the AI coach or routine suggestions, the text you provide (for example your task titles and prompts) is sent to OpenAI to generate a response. It is used only to provide the feature to you. Do not include sensitive personal information in AI prompts.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-6 mb-2">4. Data Storage and Security</h2>
    <p class="mb-4">
      Your data is securely stored in Firebase Firestore and Firebase Storage. We take reasonable precautions to protect your data from unauthorized access.
    </p>

    <h2 class="text-xl font-semibold mt-6 mb-2">5. Your Rights</h2>
    <ul class="list-disc pl-6 mb-4">
      <li>You may request access to your data at any time by contacting us.</li>
      <li>You can delete your account and associated data at any time in the app: Profile &rarr; Delete account. This removes your account, tasks, streaks, settings and uploaded files. Deleting your account does not cancel an Apple subscription; manage subscriptions in your Apple ID settings.</li>
      <li>You may opt out of notifications through your device settings.</li>
    </ul>

    <h2 class="text-xl font-semibold mt-6 mb-2">6. Children's Privacy</h2>
    <p class="mb-4">
      ClingNote is not intended for use by children under the age of 13. We do not knowingly collect personal data from children.
    </p>

    <h2 class="text-xl font-semibold mt-6 mb-2">7. Updates to This Policy</h2>
    <p class="mb-4">
      We may update this Privacy Policy from time to time. The latest version will always be available in the app.
    </p>

    <h2 class="text-xl font-semibold mt-6 mb-2">8. Contact Us</h2>
    <p>
      If you have questions or concerns, please contact us at: <a href="mailto:support@clingnote.app" class="text-blue-600 hover:underline">support@clingnote.app</a>
    </p>

    <p class="text-sm text-gray-500 mt-8">Last updated: October 23, 2026</p>
  </div>
</template>

<script setup>
// No script needed for static policy page
</script>

<style scoped>
/* Optional: Scoped styles if needed */
</style>
