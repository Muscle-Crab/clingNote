<template>
  <div class="subtask-list">
    <div class="subtask-head">
      <span class="subtask-title">Subtasks <span v-if="progress.total">({{ progress.done }}/{{ progress.total }})</span></span>
      <label class="subtask-auto" title="Mark this task done when every subtask is checked">
        <input type="checkbox" :checked="!!task.autoCompleteParent" @change="$emit('toggle-auto', $event.target.checked)" />
        <span>Auto-complete task</span>
      </label>
    </div>
    <ul v-if="subtasks.length" class="subtask-items">
      <li v-for="s in subtasks" :key="s.id" class="subtask-item" :class="{ 'subtask-item--done': s.done }">
        <input type="checkbox" :checked="s.done" :aria-label="'Done: ' + s.title" @change="$emit('change', toggleSubtask(subtasks, s.id))" />
        <input v-if="editingId === s.id" v-model="editTitle" class="field-input subtask-edit" type="text"
               @keydown.enter.prevent="saveEdit(s)" @keydown.esc.prevent="editingId = null" @blur="saveEdit(s)" />
        <span v-else class="subtask-text" @dblclick="startEdit(s)">{{ s.title }}</span>
        <button type="button" class="subtask-btn" title="Edit" @click="startEdit(s)">✏️</button>
        <button type="button" class="subtask-btn" title="Delete" @click="$emit('change', removeSubtask(subtasks, s.id))">🗑️</button>
      </li>
    </ul>
    <form class="subtask-add" @submit.prevent="add">
      <input v-model="newTitle" class="field-input" type="text" placeholder="Add a subtask…" />
      <button type="submit" class="btn-secondary subtask-add-btn" :disabled="!newTitle.trim()">Add</button>
    </form>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { subtasksOf, subtaskProgress, addSubtask, renameSubtask, toggleSubtask, removeSubtask } from '@/utils/subtasks';

const props = defineProps({ task: { type: Object, required: true } });
const emit = defineEmits(['change', 'toggle-auto']);

const subtasks = computed(() => subtasksOf(props.task));
const progress = computed(() => subtaskProgress(props.task));
const newTitle = ref('');
const editingId = ref(null);
const editTitle = ref('');

const add = () => {
  if (!newTitle.value.trim()) return;
  emit('change', addSubtask(subtasks.value, newTitle.value));
  newTitle.value = '';
};
const startEdit = (s) => { editingId.value = s.id; editTitle.value = s.title; };
const saveEdit = (s) => {
  if (editingId.value !== s.id) return; // already saved/cancelled (blur after enter/esc)
  editingId.value = null;
  if (editTitle.value.trim() && editTitle.value.trim() !== s.title) emit('change', renameSubtask(subtasks.value, s.id, editTitle.value));
};
</script>

<style scoped>
/* shared look (HomeView's scoped styles don't reach into child components) */
.field-input { width: 100%; background: #0f0f11; border: 1px solid #2a2a2e; border-radius: 10px; padding: 10px 12px; color: #e8e6e1; font-family: inherit; font-size: 0.9rem; transition: border-color 0.2s; box-sizing: border-box; }
.field-input:focus { outline: none; border-color: #378ADD; }
.btn-secondary { font-family: inherit; font-size: 0.875rem; font-weight: 500; background: #1e1e22; color: #9a9891; border: 1px solid #2a2a2e; border-radius: 10px; padding: 9px 18px; cursor: pointer; transition: all 0.2s; }
.btn-secondary:hover { color: #e8e6e1; border-color: #3a3a3e; }
.btn-secondary:disabled { opacity: 0.5; cursor: default; }
.subtask-list { margin: 0.25rem 0 0.75rem; }
.subtask-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.72rem; color: #a3a29d; margin-bottom: 6px; }
.subtask-auto { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.subtask-items { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.subtask-item { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #e8e6e1; }
.subtask-item--done .subtask-text { text-decoration: line-through; color: #77767a; }
.subtask-text { flex: 1; min-width: 0; word-break: break-word; }
.subtask-edit { flex: 1; padding: 4px 8px; }
.subtask-btn { background: none; border: none; cursor: pointer; font-size: 0.8rem; opacity: 0.7; padding: 2px; }
.subtask-btn:hover { opacity: 1; }
.subtask-add { display: flex; gap: 6px; }
.subtask-add .field-input { flex: 1; padding: 6px 10px; }
.subtask-add-btn { padding: 4px 12px; }
</style>
