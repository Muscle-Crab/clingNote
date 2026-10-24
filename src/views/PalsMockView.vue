<template>
  <PalsHub :tab="screen === 'pals' ? 'pals' : 'manager'" :manager="manager" :unread="2" :pals="pals" :pal-code="screen === 'pals' ? 'K7QM4XRT' : ''" :selected="screen.startsWith('detail') ? pals[0] : null">
    <template #detail><PalDetail :name="pals[0].name" :tasks="tasks" :messages="palMsgs" :initial-tab="screen === 'detail-chat' ? 'c' : 't'" /></template>
  </PalsHub>
</template>
<script setup>
// DEV-ONLY screenshot harness (route registered only when NODE_ENV === 'development'): renders the hub with ZZTEST mock data, no Firebase.
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import PalsHub from '@/components/pals/PalsHub.vue';
import PalDetail from '@/components/pals/PalDetail.vue';
import { viewTasks } from '@/utils/pals';
const route = useRoute();
const screen = computed(() => String(route.query.s || 'manager-tab'));
const m = (min) => Date.now() - min * 60000;
const manager = { active: true, managerName: 'Mom (ZZTEST)', link: 'https://clingnot.netlify.app/m/ZZTEST_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', thread: [
  { id: '1', kind: 'nudge', from: 'manager', text: 'Mom (ZZTEST) reminded you about "ZZTEST Finish biology lab report"', at: m(190), mine: false },
  { id: '2', kind: 'dm', from: 'user', text: 'On it! 👍', at: m(180), mine: true },
  { id: '3', kind: 'dm', from: 'manager', text: 'Proud of you! Dinner at 7?', at: m(25), mine: false, unread: true },
  { id: '4', kind: 'nudge', from: 'manager', text: 'Mom (ZZTEST) noticed this is overdue: "ZZTEST Call the dentist"', at: m(3), mine: false, unread: true },
] };
const pals = [{ uid: 'zztest-pal-1', name: 'Jordan ZZTEST' }, { uid: 'zztest-pal-2', name: 'Priya ZZTEST' }];
const tasks = viewTasks([
  { day: 'Monday', tasks: [{ title: 'ZZTEST Gym — leg day', completed: true }, { title: 'ZZTEST Pay phone bill' }] },
  { day: 'Thursday', tasks: [{ title: 'ZZTEST Read ch. 4', completed: true }, { title: 'ZZTEST Essay outline', reminder: { date: '2026-10-22', time: '18:00' } }] },
  { day: 'Friday', tasks: [{ title: 'ZZTEST Grocery run' }, { title: 'ZZTEST Laundry', completed: true }] },
  { day: 'Saturday', tasks: [{ title: 'ZZTEST Study group 2pm', reminder: { date: '2026-10-24', time: '14:00' } }] },
], new Date(2026, 9, 23, 20, 0));
const palMsgs = [
  { id: 'a', text: 'Study session tomorrow?', at: m(50), mine: false },
  { id: 'b', text: 'Yes! Library at 2', at: m(48), mine: true },
  { id: 'c', text: '👀 that overdue one', at: m(5), mine: false },
  { id: 'd', text: "Haha doing it now", at: m(1), mine: true, pending: true },
];
</script>
