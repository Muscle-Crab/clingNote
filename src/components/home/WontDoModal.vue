<template>
  <div class="modal-backdrop">
    <div class="modal-box modal-box--sm">
      <div class="modal-header">
        <h2 class="modal-title">🚫 Won't do this?</h2>
      </div>
      <div class="modal-body">
        <div class="field-group">
          <label class="field-label">Reason</label>
          <textarea v-model="reason" class="field-textarea" placeholder="Why are you skipping this?"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="$emit('cancel')" class="btn-secondary">Cancel</button>
        <button @click="$emit('confirm')" class="btn-primary">Confirm</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const reason = defineModel('reason');
defineEmits(['cancel', 'confirm']);
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
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #2a2a2e;
}
.modal-title { font-size: 1rem; font-weight: 600; margin: 0; }
.modal-body { padding: 1.25rem; flex: 1; }
.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid #2a2a2e;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
.field-group { margin-bottom: 1rem; }
.field-label { display: block; font-size: 0.78rem; font-weight: 500; color: #9a9891; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.field-textarea {
  width: 100%;
  background: #0f0f11;
  border: 1px solid #2a2a2e;
  border-radius: 10px;
  padding: 10px 12px;
  color: #e8e6e1;
  font-family: inherit;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.field-textarea:focus {
  outline: none;
  border-color: #378ADD;
}
.field-textarea { min-height: 80px; resize: vertical; }
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
.btn-secondary {
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  background: #1e1e22;
  color: #9a9891;
  border: 1px solid #2a2a2e;
  border-radius: 10px;
  padding: 9px 18px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover { color: #e8e6e1; border-color: #3a3a3e; }
</style>
