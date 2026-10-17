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
  background: #18181b;
  border: 1px solid #2a2a2e;
  border-radius: 20px;
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
  border-bottom: 1px solid #2a2a2e;
}
.modal-title { font-size: 1rem; font-weight: 600; margin: 0; }
.modal-close {
  background: none; border: none; color: #6b6a66; font-size: 1rem;
  cursor: pointer; padding: 4px 8px; border-radius: 6px;
  transition: color 0.15s;
}
.modal-close:hover { color: #e8e6e1; }
.modal-body { padding: 1.25rem; flex: 1; }
.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid #2a2a2e;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
.btn-primary {
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  background: #378ADD;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 9px 18px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover { background: #2a6db0; }
.detail-title { font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem; }
.detail-media { margin: 0.75rem 0; position: relative; }
.detail-video { width: 100%; border-radius: 10px; }
.detail-image-wrap { display: inline-block; }
.detail-image { max-height: 200px; width: 100%; object-fit: contain; border-radius: 10px; cursor: zoom-in; }
.detail-remove {
  position: absolute; top: 8px; right: 8px;
  background: #ef4444; color: white; border: none;
  border-radius: 50%; width: 22px; height: 22px;
  font-size: 0.7rem; cursor: pointer;
}
.detail-file {
  display: flex; align-items: center; gap: 8px;
  background: #1e1e22; border-radius: 8px; padding: 8px 12px;
  font-size: 0.875rem; position: relative;
}
.detail-file-link { color: #7fb8f5; text-decoration: none; }
.detail-row {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 0.875rem; padding: 8px 0;
  border-top: 1px solid #2a2a2e;
}
.detail-row-icon { font-size: 1rem; flex-shrink: 0; }
.detail-row-label { font-weight: 600; font-size: 0.78rem; color: #6b6a66; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
.detail-row-content { color: #9a9891; }
.detail-labels { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 10px; border-top: 1px solid #2a2a2e; }
.label-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 500;
  background: #1e1e22;
  border: 1px solid #2a2a2e;
  color: #9a9891;
  cursor: pointer;
  transition: all 0.15s;
}
.label-pill:hover { border-color: #378ADD; color: #7fb8f5; }
.label-pill--active { background: #1e2a3a; border-color: #378ADD; color: #7fb8f5; }
</style>
