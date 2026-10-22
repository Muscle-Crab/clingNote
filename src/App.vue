<template>
  <div class="app-shell" :class="{ 'app-shell--home': isHome }">
    <navi/>
    <SubpageHero v-if="hero" :title="hero.title" :kicker="hero.kicker" :back="hero.back !== false" />
    <router-view></router-view>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import navi from '@/components/nav.vue';
import SubpageHero from '@/components/ui/SubpageHero.vue';

const route = useRoute();
const isHome = computed(() => route.name === 'home');
// Page titles for the shared sub-page header (home and the marketing landing page have their own hero).
const HEROES = {
  rankings: { title: 'Monthly Rankings', kicker: 'Compete' },
  discipline: { title: 'Discipline Mode', kicker: 'Stay strict' },
  'procrastination-log': { title: 'Procrastination Log', kicker: 'Discipline' },
  gate: { title: 'Break Gate', kicker: 'Earned breaks' },
  upcoming: { title: 'Upcoming Tasks', kicker: 'Schedule' },
  addiction: { title: 'Addiction Tracker', kicker: 'Habits' },
  about: { title: 'About ClingNote', kicker: 'Info' },
  'payment-success': { title: 'Payment Complete', kicker: 'Thank you' },
  Profile: { title: 'Your Profile', kicker: 'Account' },
  Pickup: { title: 'Pickup Game', kicker: 'Community' },
  Discussion: { title: 'Discussion Rooms', kicker: 'Community' },
  RoomInterior: { title: 'Chat Rooms', kicker: 'Community' },
  Login: { title: 'Welcome back', kicker: 'ClingNote', back: false },
  Register: { title: 'Create account', kicker: 'ClingNote', back: false },
  TermsandCondition: { title: 'Terms & Conditions', kicker: 'Legal', back: false },
  privacy: { title: 'Privacy Policy', kicker: 'Legal', back: false },
  subs: { title: 'Go Premium', kicker: 'Plans' },
  MealPlan: { title: 'Meal Tracker', kicker: 'Nutrition' },
  NotFoundComponent: { title: 'Page not found', kicker: '404' },
};
const hero = computed(() => HEROES[route.name] || null);
</script>
