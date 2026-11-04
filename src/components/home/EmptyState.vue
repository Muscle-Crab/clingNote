<template>
  <div class="empty-state">
    <div class="empty-icon">✦</div>
    <h2 class="empty-title" data-test="empty-title">{{ title }}</h2>
    <p class="empty-sub">{{ sub }}</p>
    <button v-if="showAdd" type="button" class="empty-add" @click="$emit('add')">Add task</button>
    <button v-if="showTemplates" type="button" class="empty-link" data-test="templates-open" @click="$emit('templates')">or use a day template</button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
// dayLabel: '' on today; 'Mon, Nov 9' on a future tab. scheduled: tasks already scheduled for that date (listed under Scheduled).
const props = defineProps({ showAdd: { type: Boolean, default: false }, showTemplates: Boolean, dayLabel: { type: String, default: '' }, scheduled: { type: Number, default: 0 } });
const label = computed(() => (props.dayLabel === 'Tomorrow' ? 'tomorrow' : props.dayLabel));
const title = computed(() => (!props.dayLabel ? 'Nothing here yet' : props.scheduled ? `${props.scheduled} scheduled for ${label.value}` : `Nothing planned for ${label.value}`));
const sub = computed(() => (!props.dayLabel ? 'Add your first task to get the day moving.'
  : props.scheduled ? 'They move into this list on the day. Add more below.' : 'Add a task now and it will be waiting on that day.'));
defineEmits(['add', 'templates']);
</script>

<style scoped>
.empty-state { text-align: center; padding: 4rem 1rem; }
.empty-icon { font-size: 3rem; color: var(--c-border, #2a2a2e); margin-bottom: 1rem; }
.empty-title { font-size: 1.1rem; font-weight: 600; color: var(--c-text-3, #6b6a66); margin: 0; }
.empty-sub { color: var(--c-border-strong, #4a4a4e); font-size: 0.875rem; margin-top: 0.5rem; }
.empty-add { margin-top: 1rem; min-height: 44px; padding: 0 1.25rem; border: none; border-radius: 999px; background: var(--c-accent, #4F6FF0); color: #fff; font-weight: 700; cursor: pointer; }
.empty-link { display: block; margin: .75rem auto 0; min-height: 44px; background: none; border: none; color: var(--c-accent-text, #5B9BFF); font: inherit; font-size: .85rem; cursor: pointer; }
</style>
