<template>
  <section class="mr" role="region" aria-label="Morning report">
    <div class="mr-head">
      <h2 class="mr-title">☀️ Morning report</h2>
      <button type="button" class="mr-x" aria-label="Dismiss report" @click="$emit('close')">✕</button>
    </div>
    <p class="mr-big">Yesterday: <strong>{{ recap.done }}/{{ recap.min }}</strong> done <span v-if="recap.done >= recap.min">✅</span></p>
    <p>{{ recap.streakStatus }}</p>
    <p v-if="recap.slipped.length"><strong>Slipped:</strong> {{ recap.slipped.join(', ') }}</p>
    <div v-if="recap.pending.length"><strong>Waiting on:</strong>
      <ul class="mr-list"><li v-for="p in recap.pending" :key="p.title">{{ p.title }}<span v-if="p.on"> · {{ p.on }}</span><span v-if="p.days != null"> · {{ p.days }}d</span></li></ul>
    </div>
    <div v-if="recap.top3.length"><strong>Top 3 today:</strong>
      <ol class="mr-list"><li v-for="t in recap.top3" :key="t">{{ t }}</li></ol>
    </div>
  </section>
</template>

<script setup>
defineProps({ recap: { type: Object, required: true } });
defineEmits(['close']);
</script>

<style scoped>
.mr { margin: 8px 0; padding: 14px; border-radius: 12px; background: linear-gradient(135deg, #fff7ed, #fef3c7); border: 1px solid #fde68a; color: #422006; }
.mr-head { display: flex; justify-content: space-between; align-items: center; }
.mr-title { font-size: 1.05rem; font-weight: 800; margin: 0; }
.mr-x { background: none; border: none; font-size: 1rem; cursor: pointer; }
.mr-big { font-size: 1.1rem; margin: 6px 0; }
.mr-list { margin: 2px 0 6px 18px; padding: 0; }
.mr p { margin: 4px 0; }
</style>
