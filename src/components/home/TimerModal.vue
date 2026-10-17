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
defineEmits(['close', 'start']);
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
  background: #16171d;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px;
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
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  margin: 0;
}
.timer-close {
  background: #24262d;
  color: #aaa;
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
  color: #9ca3af;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.timer-field select {
  width: 100%;
  height: 54px;
  padding: 0 14px;
  background: #22242b;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  font-size: 18px;
  font-weight: 800;
  outline: none;
}
.timer-preview {
  margin-top: 16px;
  text-align: center;
  color: #fff;
  font-size: 18px;
  font-weight: 900;
}
.timer-footer {
  padding: 14px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.timer-btn {
  border: none;
  border-radius: 14px;
  padding: 11px 18px;
  font-weight: 800;
}
.timer-cancel {
  background: #23242b;
  color: #b8bbc3;
}
.timer-start {
  background: #2f8cff;
  color: white;
}
</style>
