<template>
  <div class="modal-backdrop">
    <div class="timer-modal">
      <div class="timer-header">
        <h2>⏱ Set Timer</h2>
        <button @click="$emit('close')" class="timer-close">×</button>
      </div>

      <div class="timer-body">
        <div class="timer-picker">
          <div class="timer-field">
            <label>Hours</label>
            <select v-model="hours">
              <option
                  v-for="hour in 24"
                  :key="hour - 1"
                  :value="hour - 1"
              >
                {{ hour - 1 }}
              </option>
            </select>
          </div>

          <div class="timer-field">
            <label>Minutes</label>
            <select v-model="minutes">
              <option
                  v-for="minute in 60"
                  :key="minute - 1"
                  :value="minute - 1"
              >
                {{ minute - 1 }}
              </option>
            </select>
          </div>
        </div>

        <div class="timer-preview">
          {{ hours }}h {{ minutes }}m
          <button type="button" class="pomo-chip" data-test="timer-pomo" title="Pomodoro: 25 min focus, 5 min break, 4 rounds" @click="$emit('start-pomo')">🍅 25/5 ×4</button>
        </div>
      </div>

      <div class="timer-footer">
        <button @click="$emit('close')" class="timer-btn timer-cancel">
          Cancel
        </button>

        <button @click="$emit('start')" class="timer-btn timer-start">
          Start
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const hours = defineModel('hours');
const minutes = defineModel('minutes');
defineEmits(['close', 'start', 'start-pomo']);
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
.timer-picker {
  display: flex;
  gap: 16px;
  justify-content: center;
}
.timer-modal {
  width: min(92vw, 340px);
  background: var(--c-surface, #16171d);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--r, 3px);
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0,0,0,0.5);
}
.timer-header {
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.timer-header h2 {
  color: var(--c-on-accent, #fff);
  font-size: 17px;
  font-weight: 800;
  margin: 0;
}
.timer-close {
  background: var(--c-surface-2, #24262d);
  color: var(--c-text-2, #aaa);
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 20px;
}
.timer-body {
  padding: 18px 20px 20px;
  border-top: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.timer-picker {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.timer-field label {
  display: block;
  margin-bottom: 8px;
  color: var(--c-text-2, #9ca3af);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.timer-field select {
  width: 100%;
  height: 54px;
  padding: 0 14px;
  background: var(--c-surface-2, #22242b);
  color: var(--c-on-accent, #fff);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--r, 3px);
  font-size: 18px;
  font-weight: 800;
  outline: none;
}
.timer-preview {
  margin-top: 16px;
  text-align: center;
  color: var(--c-on-accent, #fff);
  font-size: 18px;
  font-weight: 900;
}
.pomo-chip {
  margin-left: 10px;
  vertical-align: middle;
  background: transparent;
  color: var(--c-text-2, #9ca3af);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 700;
}
.timer-footer {
  padding: 14px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.timer-btn {
  border: none;
  border-radius: var(--r, 3px);
  padding: 11px 18px;
  font-weight: 800;
}
.timer-cancel {
  background: var(--c-surface-2, #23242b);
  color: var(--c-text-2, #b8bbc3);
}
.timer-start {
  background: var(--c-accent, #2f8cff);
  color: white;
}
</style>
