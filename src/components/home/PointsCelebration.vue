<template>
  <div v-if="item.kind === 'vault'" class="pc-wrap pc-wrap--vault" data-test="points-celebration" data-kind="vault" role="presentation" @click="close">
    <div class="pc-safe" role="dialog" aria-modal="true" aria-labelledby="vault-release-title" data-test="vault-pop" @click.stop>
      <div class="pc-beam" aria-hidden="true"></div>
      <span v-for="i in 14" :key="i" class="pc-spark" :style="spark(i)" aria-hidden="true"></span>
      <div class="pc-frame" aria-hidden="true"><span v-for="k in 8" :key="k" class="pc-spoke" :style="{ transform: `rotate(${k * 45}deg)` }"></span><img v-if="item.robot" class="pc-robot" :src="item.robot" alt="" /></div>
      <div class="pc-rise">
        <div v-for="(a, i) in released" :key="a.id" class="pc-release" data-test="vault-pop-app" :style="{ animationDelay: `${0.15 + i * 0.08}s` }">
          <span class="pc-ico">
            <img v-if="a.icon" class="pc-img" :src="a.icon" alt="" />
            <span v-else-if="socialIcon(a.label)" class="pc-brand" data-test="vault-pop-brand" :style="{ background: socialIcon(a.label).bg }"><svg viewBox="0 0 24 24" width="28" height="28" v-html="socialIcon(a.label).svg"></svg></span>
            <span v-else class="pc-letter">{{ initial(a.label) }}</span>
          </span>
          <span class="pc-name">{{ displayName(a.label) }}</span>
          <span class="pc-open">Open</span>
        </div>
      </div>
      <p id="vault-release-title" class="pc-title">{{ item.title }}</p>
      <p v-if="item.sub" class="pc-sub">{{ item.sub }}</p>
      <button type="button" class="pc-dismiss" data-test="vault-pop-dismiss" @click="close">Continue</button>
    </div>
  </div>
  <div v-else class="pc-wrap" data-test="points-celebration" :data-kind="item.kind" role="status" aria-live="polite" @click="close">
    <div class="pc-burst" aria-hidden="true"><span v-for="i in 18" :key="i" class="pc-dot" :style="dot(i)"></span></div>
    <div class="pc-card">
      <p class="pc-title">{{ item.title }}</p>
      <!-- Overtime penalty: impossible to miss, and explicit that the points were lost BECAUSE of the overtime. -->
      <p v-if="item.penalty" class="pc-pen" data-test="points-celebration-penalty">⚠️ Overtime penalty: −{{ item.penalty.lost }} pts</p>
      <p v-if="item.points" class="pc-pts" data-test="points-celebration-gain"><s v-if="item.penalty" class="pc-full" data-test="points-celebration-full">+{{ item.penalty.full }}</s> +{{ shown }} pts</p>
      <p v-if="item.penalty" class="pc-sub pc-pen-why" data-test="points-celebration-why">You went {{ item.penalty.overMin }} min over the {{ item.penalty.durMin }} min timer, so you earned {{ item.penalty.earned }} of {{ item.penalty.full }}.</p>
      <p v-if="item.sub" class="pc-sub">{{ item.sub }}</p>
      <p v-if="item.cheer" class="pc-cheer" data-test="points-celebration-cheer">{{ item.cheer }}</p>
    </div>
  </div>
</template>
<script setup>
import { socialIcon } from '@/utils/socialIcons';
// Full-screen celebration: a task completion (animated count-up of the points just earned + session N/8 cheer) or a vault app unlock.
import { ref, onMounted, onBeforeUnmount } from 'vue';
const props = defineProps({ item: { type: Object, required: true } });
const emit = defineEmits(['close']);
const shown = ref(0); let raf = 0; let t = 0;
const released = (props.item.apps || []).slice(0, 4);
const dot = (i) => ({ transform: `rotate(${i * 20}deg) translateY(-${90 + (i % 3) * 25}px)`, background: ['#facc15', '#60a5fa', '#34d399', '#f472b6'][i % 4] });
const spark = (i) => ({ left: `${8 + ((i * 17) % 84)}%`, animationDelay: `${(i % 7) * 0.08}s`, background: ['#f6e2a8', '#7ee0c3', '#8eb6ff', '#f8e7b0'][i % 4] });
const initial = (l) => (String(l || '?').trim()[0] || '?').toUpperCase();
const displayName = (l) => (!String(l || '').trim() || /^app$/i.test(String(l).trim()) ? 'Unnamed' : l);
const close = () => emit('close');
onMounted(() => { const to = Number(props.item.points) || 0; const t0 = window.performance.now(); const dur = 700;
  const step = (now) => { const k = Math.min(1, (now - t0) / dur); shown.value = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = window.requestAnimationFrame(step); };
  if (to) raf = window.requestAnimationFrame(step); t = setTimeout(() => emit('close'), props.item.ms || 1800); });
onBeforeUnmount(() => { window.cancelAnimationFrame(raf); clearTimeout(t); });
</script>
<style scoped>
.pc-wrap { position: fixed; inset: 0; z-index: 320; display: flex; align-items: center; justify-content: center; background: rgba(5, 10, 25, 0.72); animation: pcIn 0.18s ease-out; }
.pc-card { text-align: center; color: #fff; padding: 24px 28px; border-radius: 24px; background: linear-gradient(160deg, #1e3a8a, #0f172a); box-shadow: 0 0 60px rgba(96, 165, 250, 0.5); animation: pcPop 0.35s cubic-bezier(.2,1.6,.4,1); }
.pc-title { font-size: 26px; font-weight: 800; margin: 0 0 6px; }
.pc-pts { font-size: 48px; font-weight: 900; color: #facc15; margin: 0; }
.pc-sub { opacity: 0.85; margin: 6px 0 0; }
.pc-pen { font-size: 22px; line-height: 1.2; font-weight: 900; color: #f97316; margin: 0 0 4px; text-shadow: 0 0 18px rgba(239, 68, 68, 0.55); }
.pc-full { color: #ef4444; opacity: 0.8; font-size: 30px; text-decoration-thickness: 4px; }
.pc-pen-why { max-width: 280px; margin-left: auto; margin-right: auto; color: #fdba74; font-weight: 700; opacity: 1; }
.pc-cheer { margin: 10px 0 0; font-weight: 700; color: #86efac; }
.pc-burst { position: absolute; left: 50%; top: 50%; }
.pc-dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; animation: pcFly 0.9s ease-out forwards; }
.pc-wrap--vault { background: rgba(5, 8, 16, .55); padding: 16px; }
.pc-safe { position: relative; width: min(340px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; box-sizing: border-box; text-align: center; color: #f4f7fb; padding: 18px 14px 14px; border-radius: 22px; background-color: #141a24; background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px), linear-gradient(180deg, #3a4250, #141a24 30%); box-shadow: inset 0 0 0 2px #e6c56a, 0 16px 40px rgba(0,0,0,.45); }
.pc-beam { position: absolute; left: 50%; top: 54px; width: 90px; height: 120px; margin-left: -45px; background: linear-gradient(180deg, rgba(246,226,168,.0), rgba(246,226,168,.55), rgba(126,224,195,.15)); filter: blur(1px); animation: pcBeam 1.4s ease-out both; pointer-events: none; }
.pc-spark { position: absolute; top: 40%; width: 5px; height: 5px; border-radius: 50%; animation: pcSpark 1.3s ease-out both; pointer-events: none; }
.pc-frame { position: relative; width: 56px; height: 56px; margin: 0 auto 8px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 35% 30%, #3a4d73, #10182a 70%); box-shadow: inset 0 0 0 2px #d6b25e, 0 0 16px rgba(214,178,94,.45); }
.pc-spoke { position: absolute; width: 3px; height: 16px; top: 6px; left: 26.5px; border-radius: 2px; background: linear-gradient(#f8e7b0, #8a6a32); transform-origin: 1.5px 22px; }
.pc-robot { position: relative; width: 22px; height: 22px; border-radius: 5px; object-fit: cover; }
.pc-rise { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; min-height: 92px; }
.pc-release { width: 76px; display: flex; flex-direction: column; align-items: center; gap: 3px; animation: pcRise 1.1s cubic-bezier(.2,.85,.2,1) both; }
.pc-ico { width: 48px; height: 48px; border-radius: 12px; overflow: hidden; display: grid; place-items: center; background: #0e141c; box-shadow: 0 8px 16px rgba(0,0,0,.35), 0 0 12px rgba(246,226,168,.35); }
.pc-img, .pc-brand, .pc-letter { width: 48px; height: 48px; display: grid; place-items: center; }
.pc-img { object-fit: cover; }
.pc-letter { font-weight: 800; color: #f6e2a8; }
.pc-brand :deep(svg) { display: block; }
.pc-name { max-width: 76px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .72rem; font-weight: 700; }
.pc-open { font-size: .62rem; letter-spacing: .08em; text-transform: uppercase; color: #b6f3d8; }
.pc-dismiss { margin-top: 10px; min-height: 40px; min-width: 140px; border: 0; border-radius: 999px; background: linear-gradient(180deg, #1ea36a, #0e7a45); color: #f4fff8; font: inherit; font-weight: 750; cursor: pointer; }
.pc-dismiss:focus-visible { outline: 2px solid #f6e2a8; outline-offset: 2px; }
@keyframes pcRise { 0% { opacity: 0; transform: translateY(36px) scale(.6); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes pcBeam { 0% { opacity: 0; transform: scaleY(.2); } 30% { opacity: 1; } 100% { opacity: .35; transform: scaleY(1); } }
@keyframes pcSpark { 0% { opacity: 0; transform: translateY(10px) scale(.4); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-48px) scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .pc-beam, .pc-spark, .pc-release, .pc-wrap, .pc-card { animation: none; }
}
@keyframes pcIn { from { opacity: 0; } }
@keyframes pcPop { from { transform: scale(0.6); opacity: 0; } }
@keyframes pcFly { from { opacity: 1; } to { opacity: 0; } }
</style>
