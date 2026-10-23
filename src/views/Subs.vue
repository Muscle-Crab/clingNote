<template>
  <div class="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow">
    <h2 class="text-2xl font-bold mb-4">Manage Subscription</h2>

    <div v-if="ios">
      <p class="mb-4">Subscriptions bought in the app are managed by Apple.</p>
      <a href="https://apps.apple.com/account/subscriptions" class="text-blue-600 underline" @click.prevent="openManage">Manage subscription in Apple ID settings</a>
    </div>

    <div v-else-if="loading" class="text-gray-500">Loading...</div>

    <div v-else-if="!hasPaid">
      <p>You don't have an active subscription.</p>
      <router-link to="/paywall" class="text-blue-600 underline" data-test="subs-see-plans">See plans</router-link>
    </div>

    <div v-else>
      <p class="mb-2" data-test="subs-plan">✅ {{ planLabel }}</p>
      <p v-if="isLifetime" class="mb-4">♾️ One-time purchase: it never renews and there is nothing to cancel.</p>
      <template v-else>
        <p class="mb-4" data-test="subs-date">{{ cancelling ? '⏳ Access ends on:' : '🔁 Next billing date:' }} <strong>{{ nextBillingDate }}</strong></p>
        <p v-if="cancelling" class="mb-4 text-gray-600" data-test="subs-cancelling">Your subscription is cancelled and will not renew. You keep Pro until that date.</p>
        <button v-else :disabled="busy" @click="cancelSubscription" data-test="subs-cancel"
            class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-60">
          {{ busy ? 'Cancelling…' : 'Cancel Subscription' }}
        </button>
      </template>

      <p v-if="cancelMessage" class="mt-4" :class="cancelError ? 'text-red-600' : 'text-green-600'" data-test="subs-msg">{{ cancelMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { fnUrl } from '@/config/api';
import { ref, computed, onMounted } from 'vue';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

import { isNativeIOS } from '@/utils/platform';
import { openExternal } from '@/utils/openExternal';
const ios = isNativeIOS();
const openManage = () => openExternal('https://apps.apple.com/account/subscriptions');
const loading = ref(true);
const hasPaid = ref(false); // = users/{uid}.isPro (written only by the Stripe / RevenueCat webhooks)
const plan = ref('');
const nextBillingDate = ref('N/A');
const cancelMessage = ref('');
const cancelError = ref(false);
const cancelling = ref(false); // cancel_at_period_end already set
const busy = ref(false);

const PLAN_NAMES = { monthly: 'Pro Monthly', yearly: 'Pro Yearly', lifetime: 'Pro Lifetime' };
const isLifetime = computed(() => plan.value === 'lifetime');
const planLabel = computed(() => `You are subscribed to ${PLAN_NAMES[plan.value] || 'ClingNot Pro'}.`);
// Firestore Timestamp | Date | seconds | ISO string -> localized date ('N/A' when unknown)
const fmtDate = (v) => {
  if (!v) return 'N/A';
  const d = v.toDate ? v.toDate() : typeof v === 'number' ? new Date(v * 1000) : new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
};

onMounted(async () => {
  const user = getAuth().currentUser;
  if (!user) { loading.value = false; return; }
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.isPro) {
        hasPaid.value = true;
        plan.value = data.plan || '';
        nextBillingDate.value = fmtDate(data.proExpiresAt);
        cancelling.value = !!data.cancelAtPeriodEnd;
      }
    }
  } catch (err) {
    console.error('Error fetching user data:', err);
  }
  loading.value = false;
});

const cancelSubscription = async () => {
  const user = getAuth().currentUser;
  if (!user || busy.value) return;
  busy.value = true; cancelError.value = false; cancelMessage.value = '';
  try {
    const token = await user.getIdToken();
    const res = await fetch(fnUrl('cancel-subscription'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{}', // the server takes the uid from the verified token
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      cancelling.value = !!data.cancelAtPeriodEnd;
      if (data.endsAt) nextBillingDate.value = fmtDate(data.endsAt);
      cancelMessage.value = 'Your subscription has been cancelled. You keep Pro until the end of the paid period.';
    } else {
      cancelError.value = true;
      cancelMessage.value = data.error || 'Something went wrong. Please try again.';
    }
  } catch (err) {
    console.error('Cancel error:', err);
    cancelError.value = true;
    cancelMessage.value = 'Something went wrong. Please try again.';
  } finally {
    busy.value = false;
  }
};
</script>

<style scoped>
/* Tailwind handles most of the styling */
</style>
