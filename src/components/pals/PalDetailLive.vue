<template>
  <PalDetail :name="name" :tasks="tasks" :messages="view" @send="onSend" @remove="$emit('remove')" @block="$emit('block')" :report="report" @back="$emit('back')" />
</template>
<script setup>
import { computed } from 'vue';
import PalDetail from './PalDetail.vue';
import { usePalTasks, usePalChat, palApi } from '@/composables/usePals';
const props = defineProps({ myUid: { type: String, required: true }, palUid: { type: String, required: true }, name: { type: String, default: '' } });
const emit = defineEmits(['remove', 'back', 'block', 'blocked']);
const { tasks } = usePalTasks(props.palUid);
const { messages, send } = usePalChat(props.myUid, props.palUid);
const view = computed(() => messages.value.map((m) => ({ ...m, mine: m.from === props.myUid })));
// Report goes to the function (stored for review); "also block" removes + blocks the pal.
const report = async (m, { reason, block }) => { const r = await palApi('report', { scope: 'pal', palUid: props.palUid, messageId: m.id, reason }); if (block) { await palApi('block', { palUid: props.palUid }); setTimeout(() => emit('blocked'), 1800); } return r; };
const onSend = (t) => { send(t).catch(() => alert('Message not sent')); };
</script>
