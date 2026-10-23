<template>
  <div class="container mx-auto py-8">
    <div v-if="userData" class="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
      <!-- Profile Image -->
      <div class="relative">
        <img class="h-32 w-full object-cover" src="https://cdn.pixabay.com/photo/2023/11/14/11/07/sparrow-8387465_640.jpg" alt="Profile Picture">
        <div class="absolute inset-0 bg-black opacity-50"></div>
        <div class="absolute inset-x-0 bottom-0 pb-2 text-center">
          <img class="h-16 w-16 object-cover rounded-full border-4 border-white shadow-md" src="https://cdn.pixabay.com/photo/2023/08/24/01/01/boy-8209561_640.jpg" alt="Profile Picture">
        </div>
      </div>

      <!-- Profile Information -->
      <div v-if="!editMode" class="p-4">
        <h1 class="text-2xl font-semibold text-gray-800">{{ userData.name }}</h1>
        <p class="text-sm font-medium text-gray-600 mt-1">{{ userData.email }}</p>
        <p class="text-sm font-medium text-gray-600">{{ userData.gender }}</p>
        <p class="text-sm font-medium text-gray-600">{{ formatDOB(userData.dob) }}</p>
        <p v-if="isOwn" class="text-sm font-medium text-gray-600 mt-1">Plan: {{ userIsPro ? (userData.plan || 'Pro') : 'Free' }}
        </p>
        <router-link v-if="isOwn && !userIsPro" to="/paywall" data-test="upgrade-pro" style="background:linear-gradient(90deg,#f59e0b,#ea580c);color:#fff;border-radius:8px;padding:10px 16px;font-weight:700;display:block;text-align:center"
          class="mt-3 block w-full text-center bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white font-bold py-2 px-4 rounded">
          Upgrade to Pro
        </router-link>
        <router-link v-if="isOwn" to="/onboarding" data-test="replay-onboarding" class="mt-3 block text-center text-blue-600 hover:underline text-sm">Replay onboarding</router-link>
        <PushSettings v-if="isOwn" />
        <button v-if="isOwn" @click="editMode = true" class="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Edit
        </button>
      </div>

      <!-- Edit Profile Information -->
      <div v-else class="p-4">
        <input type="text" v-model="editedUserData.name" class="border border-gray-300 rounded-md p-1 mb-2 w-full" placeholder="Name">
        <input type="email" v-model="editedUserData.email" class="border border-gray-300 rounded-md p-1 mb-2 w-full" placeholder="Email">
        <select v-model="editedUserData.gender" class="border border-gray-300 rounded-md p-1 mb-2 w-full">
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        <input type="date" v-model="editedUserData.dob" class="border border-gray-300 rounded-md p-1 mb-2 w-full">
        <button @click="saveUserData" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
          Save
        </button>
        <button @click="editMode = false" class="ml-2 bg-gray-400 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">
          Cancel
        </button>
      </div>
    </div>
    <div v-else-if="notFound" class="text-center text-gray-500">
      This profile isn't available.
    </div>
    <div v-else-if="loading" class="text-center text-gray-500">
      Loading...
    </div>
    <div v-else class="text-center text-gray-500">
      Couldn't load this profile. <button @click="load" class="text-blue-600 underline">Retry</button>
    </div>
  </div>
</template>

<script setup>
import PushSettings from '@/components/PushSettings.vue';
import { syncPublicProfile } from '@/composables/usePublicProfile';
import { ref, computed, onMounted, watch } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { ensureUserDoc } from '@/utils/userDoc';
import { isPro } from '@/utils/pro';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'vue-router';
import { auth, db } from '@/firebaseConfig';
const route = useRouter();

const userData = ref(null);
const editedUserData = ref(null);
const editMode = ref(false);
const isOwn = ref(false);
const notFound = ref(false);
const userIsPro = computed(() => isPro(userData.value));

const loading = ref(true);
// Never let a hung network/auth call keep the page on "Loading..." forever.
const withTimeout = (pr, ms, label) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timed out')), ms))]);
// Fallback built from the auth user so the owner always sees something even if Firestore fails.
const fromAuth = (u) => ({ id: u.uid, email: u.email || '', name: u.displayName || (u.email || '').split('@')[0] || 'You' });

// Fetch user data from Firestore
const fetchUserData = async () => {
  const targetId = route.currentRoute.value.params.userId;
  const user = auth.currentUser;
  const own = !!user && user.uid === targetId;
  isOwn.value = own;
  try {
    const docSnap = await withTimeout(getDoc(doc(db, own ? 'users' : 'publicProfiles', targetId)), 10000, 'getDoc');
    if (docSnap.exists()) {
      userData.value = own ? { ...fromAuth(user), ...docSnap.data() } : docSnap.data();
    } else if (own) {
      // Older accounts may have no users/{uid} doc: create a minimal one (no billing fields), but don't block on it.
      userData.value = fromAuth(user);
      ensureUserDoc(user).then((d) => { if (d) userData.value = { ...userData.value, ...d }; }).catch((e) => console.warn('ensureUserDoc failed:', e.message));
    } else {
      notFound.value = true;
    }
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    if (own) userData.value = fromAuth(user); else notFound.value = true;
  }
  if (userData.value) editedUserData.value = { ...userData.value };
};

// Wait for auth to settle (refresh/direct URL) and refetch when :userId changes (component is reused).
const authReady = () => (auth.authStateReady ? auth.authStateReady() : new Promise(res => { const u = onAuthStateChanged(auth, () => { u(); res(); }); }));
let seq = 0;
const load = async () => {
  const my = ++seq;
  loading.value = true; notFound.value = false; userData.value = null;
  try {
    await withTimeout(authReady(), 8000, 'auth').catch((e) => console.warn(e.message));
    if (my === seq) await fetchUserData();
  } catch (e) {
    console.error('Profile load failed:', e?.message);
  } finally {
    if (my === seq) loading.value = false;
  }
};
onMounted(load);
watch(() => route.currentRoute.value.params.userId, (n, o) => { if (n && n !== o) load(); });

// Method to format date of birth
const formatDOB = (dob) => {
  if (!dob) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(`${dob}T12:00:00`) : new Date(dob?.toDate ? dob.toDate() : dob);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Method to save edited user data
const saveUserData = async () => {
  try {
    const docRef = doc(db, 'users', route.currentRoute.value.params.userId);
    // scheduledTasks is owned by useScheduledTasks; never write back a stale copy
    const { scheduledTasks: _omit, ...editable } = editedUserData.value;
    await setDoc(docRef, editable, { merge: true });
    syncPublicProfile(route.currentRoute.value.params.userId, editable).catch(() => {});
    userData.value = { ...editedUserData.value };
    editMode.value = false;
  } catch (error) {
    console.error('Error saving user data:', error.message);
  }
};
</script>
