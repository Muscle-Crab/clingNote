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
.field-input, .field-select, .field-textarea { width: 100%; box-sizing: border-box; background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r); padding: 6px 8px; min-height: 32px; color: var(--c-text); font-family: inherit; font-size: var(--fs-md); transition: border-color .15s, background .15s; }
.field-input:hover, .field-select:hover, .field-textarea:hover { background: var(--c-surface-2); }
.field-input:focus, .field-select:focus, .field-textarea:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 1px var(--c-accent); background: var(--c-bg); }
.field-textarea { min-height: 64px; resize: vertical; }
.btn-primary, .btn-secondary { font-family: inherit; font-size: var(--fs-md); font-weight: 500; border-radius: var(--r); padding: 0 12px; height: 32px; cursor: pointer; border: 1px solid transparent; transition: background .15s, border-color .15s; }
.btn-primary { background: var(--c-accent); color: var(--c-on-accent); }
.btn-primary:hover { background: var(--c-accent-hover); }
.btn-secondary { background: var(--c-surface-2); color: var(--c-text-2); }
.btn-secondary:hover { background: var(--c-border); color: var(--c-text); }
.btn-primary:disabled, .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }

.subtask-list { margin: var(--sp-2) 0 var(--sp-3); padding-left: var(--sp-4); border-left: 2px solid var(--c-border); }
.subtask-head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3); margin-bottom: var(--sp-2); }
.subtask-auto { display: flex; align-items: center; gap: var(--sp-1); cursor: pointer; text-transform: none; letter-spacing: 0; font-weight: 400; }
.subtask-items { list-style: none; margin: 0 0 var(--sp-2); padding: 0; display: flex; flex-direction: column; }
.subtask-item { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-md); color: var(--c-text); padding: 2px var(--sp-1); border-radius: var(--r); transition: background .15s; }
.subtask-item:hover { background: var(--c-surface-2); }
.subtask-item input[type="checkbox"], .subtask-auto input { accent-color: var(--c-accent); width: 14px; height: 14px; margin: 0; cursor: pointer; flex-shrink: 0; }
.subtask-item--done .subtask-text { text-decoration: line-through; color: var(--c-text-3); }
.subtask-text { flex: 1; min-width: 0; word-break: break-word; }
.subtask-edit { flex: 1; padding: 2px 6px; min-height: 24px; }
.subtask-btn { background: none; border: none; cursor: pointer; font-size: var(--fs-sm); opacity: 0; padding: 2px 4px; border-radius: var(--r); }
.subtask-item:hover .subtask-btn, .subtask-btn:focus-visible { opacity: .8; }
.subtask-btn:hover { opacity: 1; background: var(--c-border); }
.subtask-add { display: flex; gap: var(--sp-2); }
.subtask-add .field-input { flex: 1; }
.subtask-add-btn { padding: 0 12px; }
</style>
