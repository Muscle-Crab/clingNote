<template>
  <div class="grid grid-cols-5 gap-1 mb-3">
    <div class="bg-slate-900/80 rounded-xl py-2 text-center">
      <p class="text-[10px] text-slate-400">Total</p>
      <p class="text-sm font-bold text-white">{{ stats.totalDayTime }}</p>
    </div>

    <div class="bg-slate-900/80 rounded-xl py-2 text-center">
      <p class="text-[10px] text-emerald-400">Prod</p>
      <p class="text-sm font-bold text-white">{{ stats.productiveTime }}</p>
    </div>

    <div class="bg-slate-900/80 rounded-xl py-2 text-center">
      <p class="text-[10px] text-yellow-400">Gap</p>
      <p class="text-sm font-bold text-white">{{ stats.gapTime }}</p>
    </div>

    <div class="bg-slate-900/80 rounded-xl py-2 text-center">
      <p class="text-[10px] text-blue-400">Done</p>
      <p class="text-sm font-bold text-white">{{ stats.completedTasks }}</p>
    </div>

    <div class="bg-slate-900/80 rounded-xl py-2 text-center">
      <p class="text-[10px] text-red-400">Miss</p>
      <p class="text-sm font-bold text-white">{{ stats.missedTasks }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({ stats: { type: Object, required: true } });
</script>

<style scoped>

</style>
