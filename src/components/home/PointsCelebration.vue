<template>
  <div class="pc-wrap" data-test="points-celebration" :data-kind="item.kind" role="status" aria-live="polite" @click="$emit('close')">
    <div class="pc-burst" aria-hidden="true"><span v-for="i in 18" :key="i" class="pc-dot" :style="dot(i)"></span></div>
    <div class="pc-card">
      <!-- Vault unlock (web / no-token fallback of the native icon overlay): the door spins open and each app pops out, staggered. -->
      <div v-if="item.kind === 'vault' && item.apps && item.apps.length" class="pc-vault" data-test="vault-pop" aria-hidden="true">
        <span class="pc-door"><span v-for="k in 3" :key="k" class="pc-spoke" :style="{ transform: `rotate(${k * 60}deg)` }"></span><img v-if="item.robot" class="pc-robot" :src="item.robot" alt="" /></span>
        <span v-for="(a, i) in item.apps.slice(0, 6)" :key="a.id" class="pc-app" data-test="vault-pop-app" :style="pop(i, Math.min(item.apps.length, 6))">
          <span class="pc-ico">{{ initial(a.label) }}</span><span class="pc-name">{{ a.label }}</span>
        </span>
      </div>
      <p class="pc-title">{{ item.title }}</p>
      <p v-if="item.points" class="pc-pts" data-test="points-celebration-gain">+{{ shown }} pts</p>
      <p v-if="item.sub" class="pc-sub">{{ item.sub }}</p>
      <p v-if="item.cheer" class="pc-cheer" data-test="points-celebration-cheer">{{ item.cheer }}</p>
    </div>
  </div>
</template>
<script setup>
// Full-screen celebration: a task completion (animated count-up of the points just earned + session N/8 cheer) or a vault app unlock.
import { ref, onMounted, onBeforeUnmount } from 'vue';
const props = defineProps({ item: { type: Object, required: true } });
const emit = defineEmits(['close']);
const shown = ref(0); let raf = 0; let t = 0;
const dot = (i) => ({ transform: `rotate(${i * 20}deg) translateY(-${90 + (i % 3) * 25}px)`, background: ['#facc15', '#60a5fa', '#34d399', '#f472b6'][i % 4] });
const initial = (l) => (String(l || '?').trim()[0] || '?').toUpperCase();
// Fan above the door: app i of n lands at angle a, staggered spring (same layout as the native VaultUnlockView.spot).
const pop = (i, n) => { const spread = Math.min(n - 1, 4) * 0.36; const a = -Math.PI / 2 + (n > 1 ? -spread / 2 + (spread * i) / (n - 1) : 0);
  return { '--x': `${Math.round(Math.cos(a) * 92)}px`, '--y': `${Math.round(Math.sin(a) * 92) + 18}px`, animationDelay: `${0.45 + i * 0.18}s` }; };
onMounted(() => { const to = Number(props.item.points) || 0; const t0 = window.performance.now(); const dur = 700;
  const step = (now) => { const k = Math.min(1, (now - t0) / dur); shown.value = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = window.requestAnimationFrame(step); };
  raf = window.requestAnimationFrame(step); t = setTimeout(() => emit('close'), props.item.ms || 1800); });
onBeforeUnmount(() => { window.cancelAnimationFrame(raf); clearTimeout(t); });
</script>
<style scoped>
.pc-wrap { position: fixed; inset: 0; z-index: 320; display: flex; align-items: center; justify-content: center; background: rgba(5, 10, 25, 0.72); animation: pcIn 0.18s ease-out; }
.pc-card { text-align: center; color: #fff; padding: 24px 28px; border-radius: 24px; background: linear-gradient(160deg, #1e3a8a, #0f172a); box-shadow: 0 0 60px rgba(96, 165, 250, 0.5); animation: pcPop 0.35s cubic-bezier(.2,1.6,.4,1); }
.pc-title { font-size: 26px; font-weight: 800; margin: 0 0 6px; }
.pc-pts { font-size: 48px; font-weight: 900; color: #facc15; margin: 0; }
.pc-sub { opacity: 0.85; margin: 6px 0 0; }
.pc-cheer { margin: 10px 0 0; font-weight: 700; color: #86efac; }
.pc-burst { position: absolute; left: 50%; top: 50%; }
.pc-dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; animation: pcFly 0.9s ease-out forwards; }
.pc-vault { position: relative; height: 150px; margin: 0 0 8px; }
.pc-door { position: absolute; left: 50%; bottom: 0; width: 76px; height: 76px; margin-left: -38px; border-radius: 50%; background: linear-gradient(135deg, #1e3a8a, #0f172a); border: 3px solid rgba(96, 165, 250, 0.85); box-shadow: 0 0 24px rgba(96, 165, 250, 0.55); display: flex; align-items: center; justify-content: center; animation: pcDoor 0.7s cubic-bezier(.3,1.4,.5,1) 0.15s both; }
.pc-spoke { position: absolute; width: 4px; height: 44px; border-radius: 2px; background: rgba(96, 165, 250, 0.9); }
.pc-robot { position: relative; width: 38px; height: 38px; object-fit: contain; }
.pc-app { position: absolute; left: 50%; bottom: 20px; width: 64px; margin-left: -32px; display: flex; flex-direction: column; align-items: center; gap: 3px; opacity: 0; animation: pcOut 0.6s cubic-bezier(.2,1.7,.4,1) both; }
.pc-ico { width: 40px; height: 40px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; color: #0f172a; background: linear-gradient(160deg, #facc15, #f59e0b); box-shadow: 0 0 14px rgba(250, 204, 21, 0.55); }
.pc-name { font-size: 11px; font-weight: 700; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@keyframes pcDoor { from { transform: rotate(0) scale(1); } to { transform: rotate(200deg) scale(0.85); } }
@keyframes pcOut { 0% { opacity: 0; transform: translate(0, 0) scale(0.2) rotate(-30deg); } 100% { opacity: 1; transform: translate(var(--x), var(--y)) scale(1) rotate(0); } }
@media (prefers-reduced-motion: reduce) { .pc-door, .pc-app { animation-duration: 0.01s; } }
@keyframes pcIn { from { opacity: 0; } }
@keyframes pcPop { from { transform: scale(0.6); opacity: 0; } }
@keyframes pcFly { from { opacity: 1; } to { opacity: 0; } }
</style>
