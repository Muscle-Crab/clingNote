<template>
  <div>
    <div class="pl-thread" ref="el" data-test="chat-thread">
      <p v-if="!messages.length" class="pl-muted" style="text-align:center;margin:24px 0">{{ empty }}</p>
      <div v-for="m in messages" :key="m.id" class="pl-msg" :class="[m.mine ? 'me' : 'them', m.kind, { unread: m.unread }]">
        <div class="pl-bub">{{ m.text }}</div>
        <div class="pl-time">{{ m.failed ? 'Not sent' : m.pending ? 'Sending…' : ago(m.at) }}<button v-if="report && !m.mine && !m.pending && !String(m.id).startsWith('p')" type="button" class="pl-report" @click="reporting = m" data-test="report-msg">Report</button></div>
      </div>
    </div>
    <div class="pl-quick"><button v-for="q in quick" :key="q" class="pl-chip" @click="send(q)">{{ q }}</button></div>
    <form class="pl-row" @submit.prevent="send(draft)">
      <input class="pl-in" v-model="draft" maxlength="1000" :placeholder="placeholder" aria-label="Message" />
      <button class="pl-btn pri" :disabled="!draft.trim()">Send</button>
    </form>
    <ReportDialog :open="!!reporting" :message="reporting" :who="who" :can-block="!!reporting && (typeof canBlock === 'function' ? canBlock(reporting) : canBlock)" :send="(o) => report(reporting, o)" @close="reporting = null" />
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import { timeAgo } from '@/utils/pals';
import ReportDialog from './ReportDialog.vue';
const props = defineProps({ messages: { type: Array, default: () => [] }, quick: { type: Array, default: () => [] }, placeholder: { type: String, default: 'Message' }, empty: { type: String, default: 'No messages yet.' },
  // Block & Report (App Store 1.2): report(msg, {reason, block}) -> Promise; canBlock: bool or (msg) => bool.
  report: { type: Function, default: null }, canBlock: { type: [Boolean, Function], default: false }, who: { type: String, default: '' } });
const emit = defineEmits(['send']);
const draft = ref(''); const el = ref(null); const reporting = ref(null);
const ago = (ms) => timeAgo(ms);
const scroll = () => nextTick(() => { if (el.value) el.value.scrollTop = el.value.scrollHeight; });
const send = (t) => { t = String(t || '').trim(); if (!t) return; draft.value = ''; emit('send', t); scroll(); };
watch(() => props.messages.length, scroll); onMounted(scroll);
</script>
