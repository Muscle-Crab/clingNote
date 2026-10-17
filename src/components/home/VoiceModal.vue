<template>
  <div class="modal-backdrop">
    <div class="modal-box modal-box--sm voice-modal">
      <button @click="$emit('cancel')" class="modal-close voice-cancel">✕</button>
      <div class="voice-waves">
        <span class="wave wave-1"></span>
        <span class="wave wave-2"></span>
        <span class="wave wave-3"></span>
        <span class="wave wave-4"></span>
        <span class="wave wave-5"></span>
      </div>
      <p class="voice-label">Listening...</p>
      <p class="voice-transcript">"<span>{{ transcript }}</span>"</p>
      <p class="voice-hint">Speak your task clearly</p>
    </div>
  </div>
</template>

<script setup>
defineProps({ transcript: { type: String, default: '' } });
defineEmits(['cancel']);
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
.modal-box--sm { max-width: 360px; }
.modal-close {
  background: none; border: none; color: #6b6a66; font-size: 1rem;
  cursor: pointer; padding: 4px 8px; border-radius: 6px;
  transition: color 0.15s;
}
.modal-close:hover { color: #e8e6e1; }
.voice-modal { text-align: center; padding: 2rem 1.5rem; position: relative; }
.voice-cancel { position: absolute; top: 12px; right: 12px; }
.voice-waves { display: flex; gap: 4px; justify-content: center; margin-bottom: 1.5rem; align-items: flex-end; }
.wave {
  width: 4px; border-radius: 4px;
  background: #4ade80;
  animation: waveUp 0.8s ease infinite alternate;
}
.wave-1 { height: 16px; animation-delay: 0.0s; }
.wave-2 { height: 24px; animation-delay: 0.1s; }
.wave-3 { height: 32px; animation-delay: 0.2s; }
.wave-4 { height: 20px; animation-delay: 0.3s; }
.wave-5 { height: 12px; animation-delay: 0.4s; }
.voice-label { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
.voice-transcript { color: #7fb8f5; font-size: 0.9rem; margin-bottom: 0.5rem; }
.voice-hint { font-size: 0.75rem; color: #6b6a66; }
@keyframes waveUp { from { transform: scaleY(0.5); } to { transform: scaleY(1); } }
</style>
