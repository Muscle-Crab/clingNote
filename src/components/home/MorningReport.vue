<template>
  <section class="mr" role="region" aria-label="Morning report">
    <div class="mr-head">
      <h2 class="mr-title">☀️ Morning report</h2>
      <button type="button" class="mr-x" aria-label="Dismiss report" @click="$emit('close')">✕</button>
    </div>
    <p class="mr-big">Yesterday: <strong>{{ recap.done }}/{{ recap.min }}</strong> done <span v-if="recap.done >= recap.min">✅</span></p>
    <p>{{ recap.streakStatus }}</p>
    <p v-if="recap.pointsGoal" data-test="mr-goal">🎯 Today's goal: <strong>{{ recap.pointsGoal.goal }} pts</strong> · {{ recap.pointsGoal.tasks }} task{{ recap.pointsGoal.tasks === 1 ? '' : 's' }}, {{ recap.pointsGoal.load }} pts planned</p>
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
.mr { margin: 8px 0; padding: 14px 16px; border-radius: var(--r-lg, 16px); background: var(--c-surface, #12151C); border: 1px solid var(--c-border, #252B38); border-left: 3px solid var(--c-warn, #F5B83D); color: var(--c-text-2, #B4BCCB); }
.mr strong, .mr-title { color: var(--c-text, #E6E9EF); }
.mr-head { display: flex; justify-content: space-between; align-items: center; }
.mr-title { font-size: var(--fs-lg, 16px); font-weight: 700; margin: 0; }
.mr-x { width: 28px; height: 28px; border-radius: 8px; background: none; border: none; color: var(--c-text-3, #8791A5); font-size: 13px; cursor: pointer; }
.mr-x:hover { background: var(--c-surface-2, #1A1E28); }
.mr-big { font-size: 1.1rem; margin: 6px 0; }
.mr-list { margin: 2px 0 6px 18px; padding: 0; }
.mr p { margin: 4px 0; }
</style>
