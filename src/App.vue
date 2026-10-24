<template>
  <div class="app-shell" :class="{ 'app-shell--home': isHome }">
    <navi v-if="!route.meta.bare"/>
    <SubpageHero v-if="hero" :title="hero.title" :kicker="hero.kicker" :back="hero.back !== false" />
    <router-view></router-view>
    <AiConsentModal />
    <BossBriefing />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { resumePush } from '@/composables/useFcm';
import { useRoute } from 'vue-router';
import navi from '@/components/nav.vue';
import SubpageHero from '@/components/ui/SubpageHero.vue';
import AiConsentModal from '@/components/AiConsentModal.vue';
import BossBriefing from '@/components/voiceover/BossBriefing.vue';

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
  about: { title: 'About CleanNote', kicker: 'Info' },
  'payment-success': { title: 'Payment Complete', kicker: 'Thank you' },
  Profile: { title: 'Your Profile', kicker: 'Account' },
  Pickup: { title: 'Pickup Game', kicker: 'Community' },
  Discussion: { title: 'Discussion Rooms', kicker: 'Community' },
  RoomInterior: { title: 'Chat Rooms', kicker: 'Community' },
  Login: { title: 'Welcome back', kicker: 'CleanNote', back: false },
  TermsandCondition: { title: 'Terms & Conditions', kicker: 'Legal', back: false },
  privacy: { title: 'Privacy Policy', kicker: 'Legal', back: false },
  support: { title: 'Support', kicker: 'Help', back: false },
  subs: { title: 'Go Premium', kicker: 'Plans' },
  MealPlan: { title: 'Meal Tracker', kicker: 'Nutrition' },
  NotFoundComponent: { title: 'Page not found', kicker: '404' },
};
const hero = computed(() => HEROES[route.name] || null);
// Returning users who already turned push on get the foreground handler back (never prompts).
onMounted(() => { try { onAuthStateChanged(auth, (u) => { if (u) resumePush(); }); } catch (e) { /* ignore */ } });
</script>
