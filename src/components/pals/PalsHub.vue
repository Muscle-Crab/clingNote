<template>
  <div class="pl" data-test="pals-hub">
    <template v-if="!selected">
      <h1>Manager &amp; Pals</h1>
      <p class="pl-sub">Get nudged by someone who cares, or keep each other on track.</p>
      <div class="pl-tabs" role="tablist">
        <button :class="{ on: tab === 'manager' }" @click="$emit('update:tab', 'manager')">Manager<span v-if="unread" class="pl-badge">{{ unread }}</span></button>
        <button :class="{ on: tab === 'pals' }" @click="$emit('update:tab', 'pals')">Pals<span v-if="pals.length" class="pl-small" style="margin-left:6px">{{ pals.length }}</span></button>
      </div>
      <ManagerPanel v-if="tab === 'manager'" v-bind="manager" @create="(n) => $emit('createLink', n)" @revoke="$emit('revoke')" @share="$emit('share')" @reply="(t) => $emit('reply', t)" @disconnect="(m) => $emit('disconnect', m)" />
      <div v-else data-test="pals-panel">
        <button v-for="p in pals" :key="p.uid" class="pl-item" @click="$emit('open', p)" data-test="pal-item">
          <span class="pl-av">{{ (p.name || '?').slice(0, 1).toUpperCase() }}</span>
          <div class="pl-grow"><div class="pl-name">{{ p.name || 'Pal' }}</div><div class="pl-small">Tap to see tasks and chat</div></div>
          <span class="pl-small">›</span>
        </button>
        <div class="pl-card">
          <h2>Invite a pal</h2>
          <p class="pl-muted">Pals see each other's tasks and can chat. It's mutual, and either of you can remove the other.</p>
          <template v-if="palCode"><div class="pl-code" data-test="pal-code">{{ palCode }}</div><p class="pl-small" style="text-align:center">Valid for 7 days, one use</p>
            <div class="pl-row"><button class="pl-btn pri" style="flex:1" @click="$emit('shareCode')">{{ codeCopied ? 'Copied ✓' : 'Share invite' }}</button></div></template>
          <div v-else class="pl-row"><button class="pl-btn pri" style="flex:1" :disabled="busy" @click="$emit('makeCode')">Get my invite code</button></div>
        </div>
        <div class="pl-card">
          <h2>Have a code?</h2>
          <form class="pl-row" @submit.prevent="$emit('accept', code)"><input class="pl-in" v-model="code" maxlength="12" placeholder="ABCD2345" autocapitalize="characters" style="letter-spacing:.15em;font-family:ui-monospace,Menlo,monospace" /><button class="pl-btn pri" :disabled="busy || code.replace(/[^A-Za-z0-9]/g, '').length < 8">Connect</button></form>
          <p v-if="error" class="pl-err">{{ error }}</p>
        </div>
      </div>
    </template>
    <slot v-else name="detail" />
  </div>
</template>
<script setup>
import { ref, watch } from 'vue';
import ManagerPanel from './ManagerPanel.vue';
const props = defineProps({ tab: { type: String, default: 'manager' }, manager: { type: Object, default: () => ({}) }, unread: { type: Number, default: 0 }, pals: { type: Array, default: () => [] }, selected: { type: Object, default: null }, palCode: { type: String, default: '' }, codeCopied: Boolean, busy: Boolean, error: { type: String, default: '' }, prefillCode: { type: String, default: '' } });
defineEmits(['update:tab', 'createLink', 'revoke', 'share', 'reply', 'disconnect', 'open', 'makeCode', 'shareCode', 'accept']);
const code = ref(props.prefillCode);
watch(() => props.prefillCode, (v) => { if (v) code.value = v; });
</script>
<style src="./pals.css"></style>
