<template>
  <div class="modal-backdrop">
    <div class="modal-box">
      <div class="modal-header">
        <h2 class="modal-title">Task details</h2>
        <button @click="$emit('close')" class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <h3 class="detail-title">{{ task.title }}</h3>

        <div v-if="task.youtubeURL" class="detail-media">
          <iframe
              :src="`https://www.youtube.com/embed/${extractYouTubeID(task.youtubeURL)}`"
              class="detail-video"
              height="220"
              frameborder="0"
              allowfullscreen
          ></iframe>
        </div>

        <div v-if="task.imageURL" class="detail-media detail-image-wrap">
          <img :src="task.imageURL" class="detail-image" @click="$emit('preview')" />
          <button @click="$emit('remove-attachment', 'imageURL')" class="detail-remove">✕</button>
        </div>

        <div v-if="task.fileURL" class="detail-file">
          📄 <a :href="task.fileURL" target="_blank" class="detail-file-link">{{ task.fileName || 'Download file' }}</a>
          <button @click="$emit('remove-attachment', 'fileURL')" class="detail-remove">✕</button>
        </div>

        <div v-if="task.reminder?.date && task.reminder?.time" class="detail-row">
          <span class="detail-row-icon">📅</span>
          <span>{{ formatShortDate(task.reminder.date) }} at {{ formatTime(task.reminder.time) }}</span>
        </div>

        <div v-if="task.notes" class="detail-row detail-row--block">
          <span class="detail-row-icon">📝</span>
          <div>
            <p class="detail-row-label">Notes</p>
            <p class="detail-row-content">{{ task.notes }}</p>
          </div>
        </div>

        <div v-if="task.labels?.length" class="detail-labels">
          <span
              v-for="(label, index) in task.labels"
              :key="index"
              @click="$emit('toggle-label', label)"
              class="label-pill"
              :class="{ 'label-pill--active': activeLabels.includes(label) }"
          >
            {{ label }}
          </span>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="$emit('close')" class="btn-primary">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatShortDate, formatTime, extractYouTubeID } from '@/utils/dateTime';

defineProps({
  task: { type: Object, default: () => ({}) },
  activeLabels: { type: Array, default: () => [] },
});
defineEmits(['close', 'preview', 'remove-attachment', 'toggle-label']);
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
  backdrop-filter: blur(4px);
}
.modal-box {
  background: var(--c-surface, #18181b);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--c-border, #2a2a2e);
}
.modal-title { font-size: 1rem; font-weight: 600; margin: 0; }
.modal-close {
  background: none; border: none; color: var(--c-text-3, #6b6a66); font-size: 1rem;
  cursor: pointer; padding: 4px 8px; border-radius: var(--r, 3px);
  transition: color 0.15s;
}
.modal-close:hover { color: var(--c-text, #e8e6e1); }
.modal-body { padding: 1.25rem; flex: 1; }
.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--c-border, #2a2a2e);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
.btn-primary {
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  background: var(--c-accent, #378ADD);
  color: white;
  border: none;
  border-radius: var(--r, 3px);
  padding: 9px 18px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover { background: var(--c-accent-hover, #2a6db0); }
.detail-title { font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem; }
.detail-media { margin: 0.75rem 0; position: relative; }
.detail-video { width: 100%; border-radius: var(--r, 3px); }
.detail-image-wrap { display: inline-block; }
.detail-image { max-height: 200px; width: 100%; object-fit: contain; border-radius: var(--r, 3px); cursor: zoom-in; }
.detail-remove {
  position: absolute; top: 8px; right: 8px;
  background: var(--c-danger, #ef4444); color: white; border: none;
  border-radius: 50%; width: 22px; height: 22px;
  font-size: 0.7rem; cursor: pointer;
}
.detail-file {
  display: flex; align-items: center; gap: 8px;
  background: var(--c-surface-2, #1e1e22); border-radius: var(--r, 3px); padding: 8px 12px;
  font-size: 0.875rem; position: relative;
}
.detail-file-link { color: var(--c-accent-text, #7fb8f5); text-decoration: none; }
.detail-row {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 0.875rem; padding: 8px 0;
  border-top: 1px solid var(--c-border, #2a2a2e);
}
.detail-row-icon { font-size: 1rem; flex-shrink: 0; }
.detail-row-label { font-weight: 600; font-size: 0.78rem; color: var(--c-text-3, #6b6a66); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
.detail-row-content { color: var(--c-text-2, #9a9891); }
.detail-labels { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 10px; border-top: 1px solid var(--c-border, #2a2a2e); }
.label-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--r, 3px);
  font-size: 0.72rem;
  font-weight: 500;
  background: var(--c-surface-2, #1e1e22);
  border: 1px solid var(--c-border, #2a2a2e);
  color: var(--c-text-2, #9a9891);
  cursor: pointer;
  transition: all 0.15s;
}
.label-pill:hover { border-color: var(--c-accent, #378ADD); color: var(--c-accent-text, #7fb8f5); }
.label-pill--active { background: var(--c-accent-soft, #1e2a3a); border-color: var(--c-accent, #378ADD); color: var(--c-accent-text, #7fb8f5); }

/* ── Jira-style dialog / form / button overrides ── */
.modal-backdrop { background: rgba(13,18,22,.72); backdrop-filter: none; }
.modal-box { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r); box-shadow: var(--shadow-2); max-width: 520px; }
.modal-header { padding: var(--sp-4) var(--sp-5) var(--sp-3); border-bottom: none; }
.modal-title { font-size: var(--fs-xl); font-weight: 500; line-height: 24px; color: var(--c-text); }
.modal-close { color: var(--c-text-3); border-radius: var(--r); }
.modal-close:hover { background: var(--c-surface-2); color: var(--c-text); }
.modal-body { padding: var(--sp-2) var(--sp-5) var(--sp-4); }
.modal-footer { padding: var(--sp-3) var(--sp-5) var(--sp-4); border-top: none; gap: var(--sp-2); }
.btn-primary, .btn-secondary { font-size: var(--fs-md); font-weight: 500; border-radius: var(--r); padding: 0 12px; height: 32px; border: 1px solid transparent; transition: background .15s; }
.btn-primary { background: var(--c-accent); color: var(--c-on-accent); }
.btn-primary:hover { background: var(--c-accent-hover); }
.btn-secondary { background: var(--c-surface-2); color: var(--c-text-2); }
.btn-secondary:hover { background: var(--c-border); color: var(--c-text); }
.btn-primary:disabled, .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }
.field-input, .field-select, .field-textarea { background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r); padding: 6px 8px; font-size: var(--fs-md); }
.field-input:focus, .field-select:focus, .field-textarea:focus { border-color: var(--c-accent); box-shadow: 0 0 0 1px var(--c-accent); outline: none; }
.field-label { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3); }
@media (max-width: 600px) { .modal-backdrop { align-items: flex-end; padding: 0; } .modal-box { max-width: none; max-height: 92vh; } .modal-header, .modal-body, .modal-footer { padding-left: var(--sp-4); padding-right: var(--sp-4); } }
</style>
