<template>
  <span class="av" :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.38) + 'px' }" :aria-label="alt || ('Profile ' + initials)">
    <span class="av-i" aria-hidden="true">{{ initials }}</span>
    <img v-if="src && !failed" :key="src" :src="src" alt="" :width="size" :height="size" decoding="async" :loading="eager ? 'eager' : 'lazy'"
         class="av-img" :class="{ on: loaded }" @load="onLoad" @error="fail" />
  </span>
</template>
<script setup>
// Initials paint instantly; the photo fades in on load. Error or an 8 s stall keeps the initials (no retry loop).
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { initialsOf } from '@/utils/avatar';
const props = defineProps({ src: { type: String, default: '' }, name: { type: String, default: '' }, email: { type: String, default: '' }, size: { type: Number, default: 40 }, alt: { type: String, default: '' }, eager: Boolean, timeoutMs: { type: Number, default: 8000 } });
const loaded = ref(false); const failed = ref(false); let t = null;
const initials = computed(() => initialsOf(props.name, props.email));
const clear = () => { if (t) { clearTimeout(t); t = null; } };
const arm = () => { clear(); loaded.value = false; failed.value = false; if (props.src) t = setTimeout(() => { if (!loaded.value) failed.value = true; }, props.timeoutMs); };
const onLoad = () => { clear(); loaded.value = true; };
const fail = () => { clear(); failed.value = true; };
watch(() => props.src, arm, { immediate: true });
onBeforeUnmount(clear);
</script>
<style scoped>
.av { position: relative; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; overflow: hidden; flex: none; background: var(--c-primary-soft, #eef2ff); color: var(--c-primary, #6366f1); font-weight: 700; }
.av-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .2s ease; }
.av-img.on { opacity: 1; }
</style>
