<template>
  <nav class="tb" aria-label="Main" data-test="tabbar">
    <router-link v-for="t in tabs" :key="t.name" :to="t.to" class="tb-tab" :class="{ 'tb-tab--on': t.active }" :aria-current="t.active ? 'page' : null" :data-test="'tab-' + t.name">
      <svg viewBox="0 0 24 24" aria-hidden="true" v-html="t.icon"></svg><span>{{ t.label }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
const props = defineProps({ uid: { type: String, default: null } });
const route = useRoute();
const I = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  upcoming: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  community: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.8 14.6c2.6.1 4.6 2 5.2 5.4"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5"/>',
};
const tabs = computed(() => [
  { name: 'home', label: 'Home', to: '/home', icon: I.home, active: route.name === 'home' },
  { name: 'upcoming', label: 'Upcoming', to: '/upcoming', icon: I.upcoming, active: route.name === 'upcoming' },
  { name: 'community', label: 'Community', to: '/community', icon: I.community, active: route.name === 'community' },
  { name: 'profile', label: 'Profile', to: props.uid ? '/profile/' + props.uid : '/login', icon: I.profile, active: route.name === 'Profile' && route.params.userId === props.uid },
]);
</script>

<style scoped>
.tb { position: fixed; left: 0; right: 0; bottom: 0; z-index: 80; display: flex; justify-content: space-around; padding: 6px max(8px, calc((100vw - 540px) / 2)) calc(6px + env(safe-area-inset-bottom));
  background: rgba(9, 16, 34, .94); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border-top: 1px solid rgba(120, 150, 255, .16); }
.tb-tab { flex: 1; min-height: 52px; min-width: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: #8B97B8; font: 600 11px/1.1 Inter, ui-sans-serif, system-ui, sans-serif; text-decoration: none; border-radius: 12px; }
.tb-tab svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.tb-tab--on { color: #fff; }
.tb-tab--on svg { color: #3C8CFF; filter: drop-shadow(0 0 6px rgba(60, 140, 255, .55)); }
.tb-tab:active { transform: scale(.96); }
</style>
