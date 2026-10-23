<template>
  <div class="max-w-3xl mx-auto p-6 text-gray-800" data-test="support-page">
    <h1 class="text-3xl font-bold mb-2">CleanNote Support</h1>
    <p class="mb-6 text-gray-600">Need help with CleanNote? Start with the answers below or email us.</p>

    <section class="mb-8 rounded-xl border border-gray-200 bg-white p-4" aria-labelledby="contact-h">
      <h2 id="contact-h" class="text-xl font-semibold mb-2">Contact us</h2>
      <p class="mb-1">Email: <a :href="'mailto:' + SUPPORT_EMAIL + '?subject=CleanNote%20support'" class="text-blue-600 hover:underline" data-test="support-email">{{ SUPPORT_EMAIL }}</a></p>
      <p class="text-sm text-gray-600">We aim to reply within 2 business days. Please include the email address you signed up with. Never send your password.</p>
    </section>

    <section class="mb-8" aria-labelledby="faq-h">
      <h2 id="faq-h" class="text-xl font-semibold mb-3">Frequently asked questions</h2>
      <div v-for="f in faq" :key="f.q" class="mb-4">
        <h3 class="font-semibold">{{ f.q }}</h3>
        <p class="text-gray-700">{{ f.a }}</p>
      </div>
    </section>

    <section class="mb-8 rounded-xl border border-red-200 bg-red-50 p-4" aria-labelledby="del-h">
      <h2 id="del-h" class="text-xl font-semibold mb-2">Delete your account</h2>
      <p class="mb-2 text-sm text-gray-700">You can permanently delete your account and data yourself, inside the app: Profile &rarr; Delete account.</p>
      <router-link :to="deletePath" class="text-red-700 font-semibold hover:underline" data-test="support-delete-account">Delete my account</router-link>
    </section>

    <nav class="flex flex-wrap gap-4 text-sm" aria-label="Legal">
      <router-link to="/privacy-policy" class="text-blue-600 hover:underline">Privacy Policy</router-link>
      <router-link to="/terms" class="text-blue-600 hover:underline">Terms &amp; Conditions</router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { auth } from '@/firebaseConfig';
import { isNativeIOS } from '@/utils/platform';
import { SUPPORT_EMAIL } from '@/config/support';

const iOS = isNativeIOS();
const deletePath = computed(() => (auth.currentUser ? `/profile/${auth.currentUser.uid}?delete=1` : '/login'));
const faq = [
  { q: 'How do I delete my account?', a: 'Open Profile and tap Delete account, then confirm. This permanently erases your account and data. Deleting your account does not cancel an Apple subscription; cancel it in Settings > Apple ID > Subscriptions first if you have one.' },
  { q: iOS ? 'How do I manage or cancel my subscription?' : 'How do I manage or cancel my plan?', a: iOS ? 'Subscriptions are billed by Apple. Open Settings > your name > Subscriptions > CleanNote Pro, or use "Manage in Apple ID settings" on the Subscription page in the app. Deleting the app does not cancel a subscription.' : 'Open the Subscription page from the menu to manage or cancel your plan.' },
  { q: 'I bought Pro but it is not unlocked.', a: iOS ? 'Open the upgrade screen and tap Restore Purchases while signed in to the same Apple ID. If it still does not unlock, email us with the email address you signed up with.' : 'Sign out and back in, then email us the address you signed up with and your receipt.' },
  { q: 'I am not getting reminders.', a: iOS ? 'Open Profile and turn on reminders. If you earlier tapped Don\'t Allow, enable notifications for CleanNote in the iPhone Settings app.' : 'Open Profile, turn on reminders and allow notifications in your browser.' },
  { q: 'What data do the AI features use?', a: 'Only when you allow it: the text, meal photos and workout preferences you submit are sent to OpenAI to generate a result. You can decline, and the rest of the app keeps working. AI output can be wrong and is not medical advice.' },
  { q: 'I forgot my password.', a: 'On the login screen tap "Forgot password?" and follow the email, or sign in with Apple if you created your account that way.' },
];
</script>
