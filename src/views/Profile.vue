<template>
  <div class="container mx-auto py-8">
    <button type="button" class="profile-close" aria-label="Close" data-test="profile-close" @click="closeProfile">&#x2715;</button>
    <div v-if="userData" class="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
      <!-- Profile Image: own photo, or the default initials avatar -->
      <div class="relative">
        <div class="h-32 w-full" style="background:linear-gradient(135deg,#1e3a8a,#312e81 55%,#0f172a)"></div>
        <div class="absolute inset-x-0 bottom-0 pb-2 text-center">
          <img v-if="avatarSrc" class="profile-avatar h-16 w-16 object-cover rounded-full border-4 border-white shadow-md inline-block" :src="avatarSrc" alt="Profile picture" data-test="profile-avatar" />
          <span v-else class="profile-avatar profile-avatar--default inline-flex items-center justify-center h-16 w-16 rounded-full border-4 border-white shadow-md font-bold text-white" style="background:#2563eb;font-size:1.25rem" data-test="profile-avatar-default" aria-label="Default profile picture">{{ initials }}</span>
        </div>
      </div>
      <div v-if="isOwn" class="px-4 pt-3 text-center" data-test="avatar-controls">
        <input ref="fileInput" type="file" accept="image/*" class="hidden" data-test="avatar-file" @change="onPickAvatar" />
        <button type="button" class="text-sm text-blue-600 hover:underline" :disabled="avatarBusy" data-test="avatar-change" @click="fileInput && fileInput.click()">{{ avatarSrc ? 'Change photo' : 'Upload photo' }}</button>
        <template v-if="avatarSrc"> · <button type="button" class="text-sm text-gray-600 hover:underline" :disabled="avatarBusy" data-test="avatar-reset" @click="resetAvatar">Reset to default</button></template>
        <p v-if="avatarMsg" class="text-xs mt-1" :class="avatarErr ? 'text-red-600' : 'text-green-700'" role="status">{{ avatarMsg }}</p>
      </div>

      <!-- Profile Information -->
      <div v-if="!editMode" class="p-4">
        <h1 class="text-2xl font-semibold text-gray-800">{{ userData.name }}</h1>
        <p class="text-sm font-medium text-gray-600 mt-1">{{ userData.email }}</p>
        <p class="text-sm font-medium text-gray-600">{{ userData.gender }}</p>
        <p class="text-sm font-medium text-gray-600">{{ formatDOB(userData.dob) }}</p>
        <p v-if="isOwn" class="text-sm font-medium text-gray-600 mt-1" data-test="profile-plan">Plan: {{ planText }}
        </p>
        <router-link v-if="isOwn && !userIsPro" to="/paywall" data-test="upgrade-pro" style="background:linear-gradient(90deg,#f59e0b,#ea580c);color:#fff;border-radius:8px;padding:10px 16px;font-weight:700;display:block;text-align:center"
          class="mt-3 block w-full text-center bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white font-bold py-2 px-4 rounded">
          Upgrade to Pro
        </router-link>
        <button v-if="isOwn && userIsPro && !isLifetime" type="button" data-test="manage-sub" @click="manageSub"
          class="mt-3 block w-full text-center bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Manage subscription</button>
        <router-link v-if="isOwn" to="/onboarding" data-test="replay-onboarding" class="mt-3 block text-center text-blue-600 hover:underline text-sm">Replay onboarding</router-link>
        <PushSettings v-if="isOwn" />
        <button v-if="isOwn" @click="editMode = true" class="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Edit
        </button>
        <DeleteAccount v-if="isOwn" :user-is-pro="userIsPro" />
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
import DeleteAccount from '@/components/DeleteAccount.vue';
import { syncPublicProfile } from '@/composables/usePublicProfile';
import { fileToAvatarDataUrl, isAvatarSrc, initialsOf } from '@/utils/avatar';
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter as useCloseRouter } from 'vue-router';
const closeRouter = useCloseRouter();
const closeProfile = () => { if (window.history.state && window.history.state.back) closeRouter.back(); else closeRouter.push('/'); };
import { onAuthStateChanged } from 'firebase/auth';
import { ensureUserDoc } from '@/utils/userDoc';
import { isPro } from '@/utils/pro';
import { withRcPro } from '@/composables/usePro';
import { isNativeIOS } from '@/utils/platform';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'vue-router';
import { auth, db } from '@/firebaseConfig';
const route = useRouter();

const userData = ref(null);
const editedUserData = ref(null);
const editMode = ref(false);
const isOwn = ref(false);
const notFound = ref(false);
// Merged Pro: Firestore/server flag OR (iOS) RevenueCat's active 'pro' entitlement (reactive).
const proDoc = computed(() => (isOwn.value && userData.value ? withRcPro(auth.currentUser?.uid, userData.value) : userData.value));
const userIsPro = computed(() => isPro(proDoc.value));
const isLifetime = computed(() => userIsPro.value && proDoc.value?.plan === 'lifetime');
const PLAN_WORD = { monthly: 'Monthly', yearly: 'Yearly' };
const planText = computed(() => (!userIsPro.value ? 'Free' : isLifetime.value ? 'Pro (Lifetime)' : PLAN_WORD[proDoc.value?.plan] ? `Pro (${PLAN_WORD[proDoc.value.plan]})` : 'Pro'));
// iOS: Apple's subscription management (apps cannot cancel IAP). Web: the existing Manage Subscription page (Stripe cancel flow).
const manageSub = async () => { if (isNativeIOS()) { const m = await import('@/utils/iap'); await m.manageSubscriptions(); } else route.push('/subs'); };

const loading = ref(true);
const fileInput = ref(null);
const avatarBusy = ref(false);
const avatarMsg = ref('');
const avatarErr = ref(false);
const avatarSrc = computed(() => (userData.value && isAvatarSrc(userData.value.avatarURL) ? userData.value.avatarURL : ''));
const initials = computed(() => initialsOf(userData.value?.name, userData.value?.email));
const saveAvatar = async (value, okMsg) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  avatarBusy.value = true; avatarMsg.value = ''; avatarErr.value = false;
  try {
    await setDoc(doc(db, 'users', uid), { avatarURL: value }, { merge: true });
    userData.value = { ...userData.value, avatarURL: value };
    if (editedUserData.value) editedUserData.value = { ...editedUserData.value, avatarURL: value };
    syncPublicProfile(uid, userData.value).catch(() => {});
    window.dispatchEvent(new CustomEvent('clingnot:avatar', { detail: value }));
    avatarMsg.value = okMsg;
  } catch (e) { console.error('Avatar save failed:', e.message); avatarErr.value = true; avatarMsg.value = 'Could not save your photo. Try again.'; }
  avatarBusy.value = false;
};
const onPickAvatar = async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  avatarBusy.value = true; avatarMsg.value = ''; avatarErr.value = false;
  try { const data = await fileToAvatarDataUrl(f); avatarBusy.value = false; await saveAvatar(data, 'Photo updated.'); }
  catch (e) { avatarBusy.value = false; avatarErr.value = true; avatarMsg.value = e.message || 'Could not use that image.'; }
};
const resetAvatar = () => saveAvatar('', 'Photo reset to default.');
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
// iOS: make sure RevenueCat is logged in and customerInfo is read for this page (the auth listener may not have finished yet).
onMounted(() => { if (isNativeIOS() && auth.currentUser) import("@/utils/iap").then((m) => m.ensureIapUser(auth.currentUser)).catch(() => {}); });
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

<style scoped>
.profile-close { position: fixed; top: calc(env(safe-area-inset-top) + 64px); right: 16px; z-index: 70; width: 40px; height: 40px; border-radius: 9999px;
  display: flex; align-items: center; justify-content: center; font-size: 18px; line-height: 1; color: #F2F5FC; background: rgba(12,22,48,.85); border: 1px solid #2A3C66; }
.profile-close:hover { background: #12203F; }
</style>
