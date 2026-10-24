<template>
  <div data-test="pal-detail">
    <button class="pl-back" @click="$emit('back')">‹ All pals</button>
    <div class="pl-item" style="border:0;background:none;padding:0 0 8px">
      <span class="pl-av">{{ (name || '?').slice(0, 1).toUpperCase() }}</span>
      <div class="pl-grow"><div class="pl-name" style="font-size:20px">{{ name || 'Pal' }}</div><div class="pl-small">{{ done }}/{{ tasks.length }} done this week<span v-if="late" style="color:var(--c-danger)"> · {{ late }} overdue</span> · live</div></div>
    </div>
    <div class="pl-tabs"><button :class="{ on: tab === 't' }" @click="tab = 't'">Tasks</button><button :class="{ on: tab === 'c' }" @click="tab = 'c'">Chat</button></div>
    <DayTaskView v-if="tab === 't'" :tasks="tasks" row-test="pal-task" />
    <div v-else class="pl-card"><ChatThread :messages="messages" :quick="QUICK" :placeholder="`Message ${name || 'your pal'}`" :empty="`Start a chat with ${name || 'your pal'}.`" :report="report" :can-block="true" :who="name || 'this pal'" @send="(t) => $emit('send', t)" /></div>
    <div class="pl-row" style="margin-top:14px">
      <button class="pl-btn bad" style="flex:1" @click="confirmRemove" data-test="remove-pal">Remove pal</button>
      <button class="pl-btn bad" style="flex:1" @click="confirmBlock" data-test="block-pal">Block</button>
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import DayTaskView from './DayTaskView.vue';
import ChatThread from './ChatThread.vue';
const props = defineProps({ name: { type: String, default: '' }, tasks: { type: Array, default: () => [] }, messages: { type: Array, default: () => [] }, initialTab: { type: String, default: 't' }, report: { type: Function, default: null } });
const emit = defineEmits(['send', 'remove', 'back', 'block']);
const tab = ref(props.initialTab);
const done = computed(() => props.tasks.filter((t) => t.completed).length);
const late = computed(() => props.tasks.filter((t) => t.overdue).length);
const QUICK = ['You got this 💪', 'Nice work!', 'Study session?', '👀 that overdue one'];
const confirmBlock = () => { if (confirm(`Block ${props.name || 'this pal'}? They're removed, your chat is deleted, and they can't message you or add you again.`)) emit('block'); };
const confirmRemove = () => { if (confirm(`Remove ${props.name || 'this pal'}? You'll both stop seeing each other's tasks.`)) emit('remove'); };
</script>
