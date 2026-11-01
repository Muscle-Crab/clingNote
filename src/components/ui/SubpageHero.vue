<template>
  <header class="sub-hero">
    <div class="sub-hero-art" aria-hidden="true"></div>
    <div class="sub-hero-inner">
      <router-link v-if="back" to="/home" class="sub-hero-back" aria-label="Back to home"><i class="fas fa-chevron-left" aria-hidden="true"></i> Home</router-link>
      <p class="sub-hero-kicker">{{ kicker }}</p>
      <h1 class="sub-hero-title">{{ lead }}<span class="sub-hero-accent">{{ accent }}</span></h1>
    </div>
  </header>
</template>

<script setup>
// Small forest header shared by every non-home page (same art + type scale as the home hero).
import { computed } from 'vue';
const props = defineProps({ title: { type: String, required: true }, kicker: { type: String, default: '' }, back: { type: Boolean, default: true } });
const parts = computed(() => { const t = props.title; const i = t.lastIndexOf(' '); return i < 0 ? ['', t] : [t.slice(0, i + 1), t.slice(i + 1)]; });
const lead = computed(() => parts.value[0]);
const accent = computed(() => parts.value[1]);
</script>

<style scoped>
.sub-hero { position: relative; overflow: hidden; padding: calc(56px + env(safe-area-inset-top)) 16px 22px; }
.sub-hero-art { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(7,13,28,.2), rgba(7,13,28,.35) 55%, var(--c-bg, #070D1C)), var(--hero-img, url('~@/assets/hero-forest.jpg')) 72% 35% / cover no-repeat; }
.sub-hero-inner { position: relative; max-width: 720px; margin: 0 auto; }
.sub-hero-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--c-text-2, #A9B4CC); text-decoration: none; min-height: 44px; padding: 0 12px 0 8px; margin-left: -8px; border-radius: 999px; }
.sub-hero-back:hover { background: rgba(255,255,255,.06); color: #fff; }
.sub-hero-kicker { margin: 8px 0 0; font-size: 12px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #5E9BFF; min-height: 1em; }
.sub-hero-title { margin: 2px 0 0; font-size: 30px; line-height: 36px; font-weight: 800; letter-spacing: -.02em; color: #fff; }
.sub-hero-accent { color: #3D8BFF; }
</style>
