<template>
  <div class="mt-6 border-t border-gray-200 pt-4 text-center" data-test="delete-account">
    <button v-if="!open" type="button" class="text-sm text-red-600 hover:underline" data-test="delete-account-open" @click="open = true">Delete account</button>
    <div v-else class="text-left rounded-lg border border-red-200 bg-red-50 p-3" role="alertdialog" aria-labelledby="del-title">
      <p id="del-title" class="font-semibold text-red-700 text-sm">Delete your account?</p>
      <p class="text-xs text-red-700 mt-1">This permanently erases your account, tasks, streaks, rooms/posts and settings. It cannot be undone.</p>
      <p v-if="isIos && userIsPro" class="text-xs text-gray-700 mt-1">Deleting your account does not cancel an Apple subscription. Cancel it in Settings &gt; Apple ID &gt; Subscriptions.</p>
      <p v-else-if="userIsPro" class="text-xs text-gray-700 mt-1">Any active web subscription will be cancelled.</p>
      <input v-if="method === 'password'" v-model="password" type="password" autocomplete="current-password" placeholder="Enter your password to confirm" data-test="delete-account-password"
             class="mt-2 w-full border border-red-300 rounded-md p-1.5 text-sm" @keyup.enter="confirm" />
      <p v-else-if="method === 'apple'" class="text-xs text-gray-700 mt-2">You will be asked to confirm with Apple.</p>
      <p v-else-if="method === 'google'" class="text-xs text-gray-700 mt-2">You will be asked to confirm with Google.</p>
      <p v-if="message" class="text-xs text-red-700 mt-2" role="alert" data-test="delete-account-msg">{{ message }}</p>
      <div class="mt-3 flex gap-2 justify-end">
        <button type="button" class="px-3 py-1.5 text-sm rounded bg-white border border-gray-300 text-gray-700" :disabled="busy" data-test="delete-account-cancel" @click="cancel">Cancel</button>
        <button type="button" class="px-3 py-1.5 text-sm rounded bg-red-600 text-white font-semibold disabled:opacity-50" :disabled="busy" data-test="delete-account-confirm" @click="confirm">{{ busy ? 'Deleting...' : 'Delete my account' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { auth } from '@/firebaseConfig';
import { isNativeIOS } from '@/utils/platform';
import { deleteMyAccount, reauthMethod } from '@/utils/deleteAccount';

defineProps({ userIsPro: { type: Boolean, default: false } });
const router = useRouter();
const open = ref(false); const busy = ref(false); const password = ref(''); const message = ref('');
const isIos = isNativeIOS();
const method = computed(() => (open.value ? reauthMethod(auth.currentUser) : 'none'));
const cancel = () => { open.value = false; password.value = ''; message.value = ''; };
const confirm = async () => {
  if (busy.value) return;
  busy.value = true; message.value = '';
  const r = await deleteMyAccount({ password: password.value });
  busy.value = false;
  if (r.ok) { router.replace('/login'); return; }
  message.value = r.message || '';
};
</script>
