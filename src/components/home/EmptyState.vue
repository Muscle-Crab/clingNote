<template>
  <div class="empty-state">
    <div class="empty-icon">✦</div>
    <h2 class="empty-title">Nothing here yet</h2>
    <p class="empty-sub">Tap the + button below to add your first task.</p>
    <button v-if="showAdd" type="button" class="empty-add" @click="$emit('add')">Add task</button>
  </div>
</template>

<script setup>
defineProps({ showAdd: { type: Boolean, default: false } });
defineEmits(['add']);
</script>

<style scoped>
.empty-state { text-align: center; padding: 4rem 1rem; }
.empty-icon { font-size: 3rem; color: var(--c-border, #2a2a2e); margin-bottom: 1rem; }
.empty-title { font-size: 1.1rem; font-weight: 600; color: var(--c-text-3, #6b6a66); margin: 0; }
.empty-sub { color: var(--c-border-strong, #4a4a4e); font-size: 0.875rem; margin-top: 0.5rem; }
.empty-add { margin-top: 1rem; min-height: 44px; padding: 0 1.25rem; border: none; border-radius: 999px; background: var(--c-accent, #4F6FF0); color: #fff; font-weight: 700; cursor: pointer; }
</style>
