<template>
  <div class="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow">
    <h2 class="text-2xl font-bold mb-4">Manage Subscription</h2>

    <div v-if="loading" class="text-gray-500">Loading...</div>

    <div v-else-if="!hasPaid">
      <p>You don't have an active subscription.</p>
    </div>

    <div v-else>
      <p class="mb-2">✅ You are subscribed to AI Routine Access.</p>
      <p class="mb-4">🔁 Next billing date: <strong>{{ nextBillingDate }}</strong></p>

      <button
          @click="cancelSubscription"
          class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
      >
        Cancel Subscription
      </button>

      <p v-if="cancelMessage" class="mt-4 text-green-600">{{ cancelMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig'; // ✅ must point to your Firestore setup

const loading = ref(true);
const hasPaid = ref(false);
const nextBillingDate = ref('');
const cancelMessage = ref('');

onMounted(async () => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    loading.value = false;
    return;
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.hasPaid) {
        hasPaid.value = true;
        nextBillingDate.value = data.current_period_end
            ? new Date(data.current_period_end * 1000).toLocaleDateString()
            : 'N/A';
      }
    }
  } catch (err) {
    console.error('❌ Error fetching user data:', err);
  }

  loading.value = false;
});

const cancelSubscription = async () => {
  const auth = getAuth();
  const user = auth.currentUser;

  try {
    const res = await fetch('/.netlify/functions/cancel-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.uid }),
    });

    if (res.ok) {
      cancelMessage.value = 'Your subscription has been cancelled.';
      hasPaid.value = false;
    } else {
      const error = await res.text();
      cancelMessage.value = 'Something went wrong: ' + error;
    }
  } catch (err) {
    console.error('❌ Cancel error:', err);
    cancelMessage.value = 'Something went wrong. Please try again.';
  }
};
</script>

<style scoped>
/* Tailwind handles most of the styling */
</style>
