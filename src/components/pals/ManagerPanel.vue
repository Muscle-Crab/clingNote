<template>
  <div data-test="manager-panel">
    <div v-if="!active" class="pl-card">
      <h2>Add a manager</h2>
      <p class="pl-muted">Someone you trust (like your mom) gets a private link to see your tasks, nudge you, and message you. They don't need an account. You can turn the link off anytime.</p>
      <div class="pl-row"><input class="pl-in" v-model="name" maxlength="40" placeholder="Their name, e.g. Mom" /><button class="pl-btn pri" :disabled="busy" @click="$emit('create', name)" data-test="create-link">{{ busy ? '…' : 'Create link' }}</button></div>
    </div>
    <div v-else class="pl-card">
      <h2>{{ managerName || 'Your manager' }} <span class="pl-small">· link on</span></h2>
      <p class="pl-muted">They can see all your tasks (done and not done) and send nudges and messages. They can't change anything.</p>
      <div v-if="link" class="pl-link" data-test="manager-link">{{ link }}</div>
      <p v-else class="pl-small" style="margin-top:8px">For safety the link is only shown on the device that made it. Make a new one to share again (the old one stops working).</p>
      <div class="pl-row">
        <button v-if="link" class="pl-btn pri" @click="$emit('share')">{{ copied ? 'Copied ✓' : 'Share link' }}</button>
        <button class="pl-btn" :disabled="busy" @click="$emit('create', managerName)">New link</button>
        <button class="pl-btn bad" :disabled="busy" @click="$emit('revoke')" data-test="revoke-link">Turn off</button>
      </div>
    </div>
    <div v-if="active || thread.length" class="pl-card">
      <h2>Nudges &amp; messages</h2>
      <ChatThread :messages="thread" :quick="QUICK_REPLIES" placeholder="Reply…" :empty="`Nudges and messages from ${managerName || 'your manager'} show up here.`" @send="(t) => $emit('reply', t)" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ChatThread from './ChatThread.vue';
defineProps({ active: Boolean, managerName: { type: String, default: '' }, link: { type: String, default: '' }, thread: { type: Array, default: () => [] }, busy: Boolean, copied: Boolean });
defineEmits(['create', 'revoke', 'share', 'reply']);
const name = ref('');
const QUICK_REPLIES = ['On it! 👍', 'Done ✅', 'Thanks!', 'Later today'];
</script>
