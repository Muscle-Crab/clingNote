<template>
  <section class="push" data-test="push-settings">
    <h2 class="push-h">🔔 Notifications</h2>
    <p class="push-p">Get push notifications on this device.</p>
    <p v-if="iosNote && !native" class="push-note" data-test="push-ios-note">On iPhone and iPad, web push only works after you add ClingNote to your Home Screen (Share → Add to Home Screen) and open it from there.</p>
    <p v-if="native && nativeStatus === 'denied'" class="push-note" data-test="push-denied">Notifications are turned off for ClingNote on this iPhone. To get reminders, open Settings → Notifications → ClingNote and allow notifications.</p>
    <div v-if="native" class="push-actions">
      <button v-if="nativeStatus === 'denied'" type="button" class="push-btn push-btn--primary" :disabled="busy" data-test="push-open-settings" @click="enableNative">Open iPhone Settings</button>
      <button v-else-if="!enabled" type="button" class="push-btn push-btn--primary" :disabled="busy" data-test="push-enable" @click="enableNative">Turn on reminders</button>
      <template v-else>
        <button type="button" class="push-btn push-btn--primary" :disabled="busy" data-test="push-test" @click="testNative">Send test notification</button>
        <button type="button" class="push-btn" :disabled="busy" data-test="push-disable" @click="disableNative">Turn off</button>
      </template>
    </div>
    <div v-else class="push-actions">
      <button v-if="!enabled" type="button" class="push-btn push-btn--primary" :disabled="busy" data-test="push-enable" @click="enable">Enable notifications</button>
      <template v-else>
        <button type="button" class="push-btn push-btn--primary" :disabled="busy" data-test="push-test" @click="test">Send test notification</button>
        <button type="button" class="push-btn" :disabled="busy" data-test="push-disable" @click="disable">Turn off</button>
      </template>
    </div>
    <p v-if="msg" class="push-msg" role="status" data-test="push-msg">{{ msg }}</p>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { enablePush, disablePush, sendTestPush, pushState, iosNeedsInstall } from '@/composables/useFcm';
import { isNativeIOS } from '@/utils/platform';
import { getNativePushState, requestNativePushPermission, optInNativePush, optOutNativePush } from '@/utils/nativePush';
import { sendPush } from '@/composables/useNotifications';

const enabled = ref(false); const busy = ref(false); const msg = ref('');
const iosNote = ref(iosNeedsInstall());
const native = isNativeIOS();
const nativeStatus = ref('unknown');
const refreshNative = async () => { const st = await getNativePushState(); nativeStatus.value = st.status; enabled.value = st.optedIn; return st; };
onMounted(() => { if (native) refreshNative(); else enabled.value = pushState().enabled; });
// iOS app: the permission prompt only appears from this tap. If it was declined before, iOS will not ask again, so we point to Settings.
const enableNative = async () => {
  busy.value = true; msg.value = '';
  try {
    const before = await getNativePushState();
    if (before.status === 'granted') optInNativePush(); else await requestNativePushPermission();
    const st = await refreshNative();
    msg.value = st.optedIn ? 'Reminders are on for this iPhone.' : st.status === 'denied' ? 'Notifications are still blocked. Turn them on in iPhone Settings → Notifications → ClingNote.' : 'Permission was not granted.';
  } catch (e) { msg.value = 'Could not turn on reminders. Try again.'; }
  busy.value = false;
};
const disableNative = async () => { busy.value = true; optOutNativePush(); await refreshNative(); enabled.value = false; msg.value = 'Reminders are off for this iPhone. You can turn them back on here any time.'; busy.value = false; };
const testNative = async () => { busy.value = true; msg.value = ''; try { await sendPush({ kind: 'self', title: 'ClingNote', message: 'Test reminder: notifications are working.' }); msg.value = 'Test sent. It should arrive in a moment.'; } catch (e) { msg.value = e.message || 'Could not send.'; } busy.value = false; };
const REASONS = { denied: 'Notifications are blocked in your browser settings for this site.', dismissed: 'Permission was not granted.', unsupported: 'This browser does not support web push.', 'ios-install': 'Add ClingNote to your Home Screen first, then enable notifications there.', signin: 'Sign in first.', error: 'Could not turn on notifications. Try again.' };
const enable = async () => { busy.value = true; msg.value = ''; const r = await enablePush(); enabled.value = r.ok; msg.value = r.ok ? 'Notifications are on for this device.' : (REASONS[r.reason] || 'Could not turn on notifications.'); busy.value = false; };
const disable = async () => { busy.value = true; await disablePush(); enabled.value = false; msg.value = 'Notifications are off for this device.'; busy.value = false; };
const test = async () => { busy.value = true; msg.value = ''; try { const r = await sendTestPush(); msg.value = r.ok ? 'Test sent. It should arrive in a moment.' : (r.error || 'Could not send.'); } catch (e) { msg.value = 'Could not send.'; } busy.value = false; };
</script>

<style scoped>
.push { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
.push-h { font-size: 1rem; font-weight: 700; margin: 0 0 4px; color: #1f2937; }
.push-p, .push-note, .push-msg { font-size: .85rem; color: #4b5563; margin: 4px 0; }
.push-note { background: #fef3c7; color: #92400e; padding: 8px 10px; border-radius: 8px; }
.push-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.push-btn { min-height: 44px; padding: 0 14px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; color: #1f2937; font-weight: 600; }
.push-btn--primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.push-btn:disabled { opacity: .6; }
</style>
