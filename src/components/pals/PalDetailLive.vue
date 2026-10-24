<template>
  <PalDetail :name="name" :tasks="tasks" :messages="view" @send="onSend" @remove="$emit('remove')" @back="$emit('back')" />
</template>
<script setup>
import { computed } from 'vue';
import PalDetail from './PalDetail.vue';
import { usePalTasks, usePalChat } from '@/composables/usePals';
const props = defineProps({ myUid: { type: String, required: true }, palUid: { type: String, required: true }, name: { type: String, default: '' } });
defineEmits(['remove', 'back']);
const { tasks } = usePalTasks(props.palUid);
const { messages, send } = usePalChat(props.myUid, props.palUid);
const view = computed(() => messages.value.map((m) => ({ ...m, mine: m.from === props.myUid })));
const onSend = (t) => { send(t).catch(() => alert('Message not sent')); };
</script>
