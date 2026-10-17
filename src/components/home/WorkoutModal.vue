<template>
  <div class="modal-backdrop">
    <div class="modal-box">
      <div class="modal-header">
        <h2 class="modal-title">Customize Workout</h2>
        <button @click="$emit('close')" class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="field-group">
          <label class="field-label">Goal</label>
          <select v-model="preferences.goal" class="field-select">
            <option>Build Muscle</option>
            <option>Lose Fat</option>
            <option>General Fitness</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Equipment</label>
          <select v-model="preferences.equipment" class="field-select">
            <option>None</option>
            <option>Resistance Bands</option>
            <option>Resistance Bands + Equipment</option>
            <option>Full Gym</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Max per day</label>
          <select v-model="preferences.maxPerDay" class="field-select">
            <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Duration (min)</label>
          <input type="number" v-model="preferences.duration" class="field-input" />
        </div>
      </div>
      <div class="modal-footer">
        <button @click="$emit('close')" class="btn-secondary">Cancel</button>
        <button @click="$emit('generate')" class="btn-primary">Generate 💪</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ preferences: { type: Object, required: true } }); // reactive object owned by HomeView; edited in place via v-model
defineEmits(['close', 'generate']);
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
.field-group { margin-bottom: 1rem; }
.field-label { display: block; font-size: 0.78rem; font-weight: 500; color: #9a9891; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.field-input, .field-select {
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
.field-input:focus, .field-select:focus {
  outline: none;
  border-color: #378ADD;
}
.field-select { cursor: pointer; }
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
