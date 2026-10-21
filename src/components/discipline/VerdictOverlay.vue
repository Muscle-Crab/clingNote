<template>
  <div class="verdict" :class="v.passed ? 'verdict--pass' : 'verdict--fail'" role="dialog" aria-modal="true" aria-label="Daily verdict">
    <div class="verdict-card">
      <p class="verdict-label">Daily verdict · {{ date }}</p>
      <h2 class="verdict-title">{{ v.passed ? 'PASSED' : 'FAILED' }}</h2>
      <div class="verdict-grade" :aria-label="'Grade ' + v.grade">{{ v.grade }}</div>
      <p class="verdict-score">{{ v.done }}/{{ v.min }} tasks</p>
      <p class="verdict-line">{{ text }}</p>
      <button type="button" class="verdict-btn" @click="$emit('close')">{{ v.passed ? 'Understood' : 'Tomorrow I deliver' }}</button>
    </div>
  </div>
</template>

<script setup>
defineProps({ v: { type: Object, required: true }, text: { type: String, default: '' }, date: { type: String, default: '' } });
defineEmits(['close']);
</script>

<style scoped>
.verdict { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.85); }
.verdict-card { width: min(92vw, 420px); padding: 2rem 1.5rem; border-radius: 16px; text-align: center; background: #111827; color: #f9fafb; }
.verdict--pass .verdict-card { box-shadow: 0 0 0 3px #22c55e; }
.verdict--fail .verdict-card { box-shadow: 0 0 0 3px #ef4444; }
.verdict-label { opacity: .7; margin: 0; font-size: .85rem; text-transform: uppercase; letter-spacing: .08em; }
.verdict-title { font-size: 2.6rem; margin: .4rem 0; letter-spacing: .1em; }
.verdict--pass .verdict-title { color: #22c55e; }
.verdict--fail .verdict-title { color: #ef4444; }
.verdict-grade { font-size: 4rem; font-weight: 800; line-height: 1; }
.verdict-score { opacity: .8; }
.verdict-line { margin: 1rem 0 1.4rem; }
.verdict-btn { padding: .7rem 1.4rem; border: 0; border-radius: 10px; font-weight: 700; background: #f9fafb; color: #111827; cursor: pointer; }
</style>
