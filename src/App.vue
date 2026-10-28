<template>
  <div class="app-shell" :class="{ 'app-shell--home': isHome, 'app-shell--tabs': showTabs }">
    <navi v-if="!route.meta.bare"/>
    <SubpageHero v-if="hero" :title="hero.title" :kicker="hero.kicker" :back="hero.back !== false" />
    <router-view></router-view>
    <AiConsentModal />
    <BossBriefing />
    <BrandMark v-if="showBrand" />
    <EightHourChrome />
    <AchievementPrompt />
    <Teleport to="body"><AppTabBar v-if="showTabs" :uid="uid" /><CreateTaskFab v-if="showFab" /><AssistantFab v-if="showFab && !isHome" /></Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { resumePush } from '@/composables/useFcm';
import { syncCalendarNow, initCalendarSync } from '@/composables/useCalendarSync';
import { useRoute } from 'vue-router';
import navi from '@/components/nav.vue';
import SubpageHero from '@/components/ui/SubpageHero.vue';
import AiConsentModal from '@/components/AiConsentModal.vue';
import BossBriefing from '@/components/voiceover/BossBriefing.vue';
import BrandMark from '@/components/brand/BrandMark.vue';
import EightHourChrome from '@/components/eighthour/EightHourChrome.vue';
import AchievementPrompt from '@/components/AchievementPrompt.vue';
import { pageTitle } from '@/composables/usePageTitle';
import AppTabBar from '@/components/shell/AppTabBar.vue';
import CreateTaskFab from '@/components/shell/CreateTaskFab.vue';
import AssistantFab from '@/components/shell/AssistantFab.vue';
import { ref, onBeforeUnmount } from 'vue';

const route = useRoute();
const isHome = computed(() => route.name === 'home');
// Wordmark on key screens only; off on sign-in, onboarding, paywall and marketing pages (clutter).
const BRAND_ROUTES = ['home', 'upcoming', 'rankings', 'community', 'discipline', 'procrastination-log', 'pals', 'manager', 'manager-home', 'manager-person'];
const showBrand = computed(() => BRAND_ROUTES.includes(route.name));
// Page titles for the shared sub-page header (home and the marketing landing page have their own hero).
const HEROES = {
  rankings: { title: 'Monthly Rankings', kicker: 'Compete' },
  community: { title: 'Community', kicker: 'Together' },
  discipline: { title: 'Discipline Mode', kicker: 'Stay strict' },
  'procrastination-log': { title: 'Procrastination Log', kicker: 'Discipline' },
  gate: { title: 'Break Gate', kicker: 'Earned breaks' },
  upcoming: { title: 'Upcoming Tasks', kicker: 'Schedule' },
  addiction: { title: 'Addiction Tracker', kicker: 'Habits' },
  about: { title: 'About ClingNote', kicker: 'Info' },
  'payment-success': { title: 'Payment complete', kicker: 'Thank you' },
  Profile: { title: 'Your Profile', kicker: 'Account' },
  Discussion: { title: 'Discussion Rooms', kicker: 'Community' },
  RoomInterior: { title: 'Chat Rooms', kicker: 'Community' },
  Login: { title: 'Welcome back', kicker: 'ClingNote', back: false },
  TermsandCondition: { title: 'Terms & Conditions', kicker: 'Legal', back: false },
  privacy: { title: 'Privacy Policy', kicker: 'Legal', back: false },
  support: { title: 'Support', kicker: 'Help', back: false },
  subs: { title: 'ClingNote Pro', kicker: 'Plans' },
  NotFoundComponent: { title: 'Page not found', kicker: '404' },
};
const hero = computed(() => (route.name === 'Profile' && pageTitle.value) || HEROES[route.name] || null);
// Footer tab bar + Create-task FAB (signed in only; never on auth/onboarding/paywall; FAB also off on locked/shutdown screens).
const uid = ref(auth.currentUser?.uid || null);
const shutOn = ref(false);
const NO_TABS = ['Login', 'welcome', 'landing', 'onboarding', 'paywall', 'pro-success', 'Landing', 'Discussion'];
const showTabs = computed(() => !!uid.value && !route.meta.bare && !NO_TABS.includes(route.name) && !/^\/(login|welcome|landing|onboarding|paywall|pro\/)/.test(route.path));
const showFab = computed(() => showTabs.value && route.name !== 'gate' && route.name !== 'RoomInterior' && !shutOn.value);
let mo = null;
onMounted(() => { try { onAuthStateChanged(auth, (u) => { uid.value = u ? u.uid : null; }); } catch (e) { /* ignore */ }
  const sync = () => { shutOn.value = !!document.querySelector('[data-test="eh-shutdown"]'); }; mo = new MutationObserver(sync); mo.observe(document.body, { childList: true, subtree: true }); sync(); });
onBeforeUnmount(() => mo && mo.disconnect());
// Returning users who already turned push on get the foreground handler back (never prompts).
onMounted(() => { try { onAuthStateChanged(auth, (u) => { if (u) resumePush(); }); } catch (e) { /* ignore */ } });
// Calendar sync (Settings, off by default; iOS app only): sync on sign-in and whenever the app comes back to the foreground (throttled).
const calSync = () => { if (uid.value && document.visibilityState === 'visible') syncCalendarNow(uid.value).catch(() => {}); };
onMounted(() => { try { onAuthStateChanged(auth, (u) => { if (u) { initCalendarSync(u.uid); setTimeout(calSync, 1500); } }); } catch (e) { /* ignore */ }
  document.addEventListener('visibilitychange', calSync); });
onBeforeUnmount(() => document.removeEventListener('visibilitychange', calSync));
</script>

<style>
/* Room for the footer tab bar + FAB so page content never ends behind them. */
:root { --tabbar-h: 64px; }
.app-shell.app-shell--tabs { padding-bottom: calc(var(--tabbar-h) + 84px + env(safe-area-inset-bottom)) !important; }
</style>
