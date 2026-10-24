<template>
  <div v-if="ach.open && ach.pending && !otherModal" class="ap-bg" data-test="ach-prompt" role="dialog" aria-modal="true" aria-labelledby="ap-title">
    <div class="ap-card">
      <div class="ap-emoji">{{ headIcon }}</div>
      <h2 id="ap-title" class="ap-title">{{ ach.title }}</h2>
      <ul class="ap-list">
        <li v-if="ach.pending.perfectDate">✅ Perfect Day — every task done</li>
        <li v-for="t in ach.pending.tiers" :key="'t' + t">🔥 {{ t }}-day streak</li>
        <li v-for="b in shownBadges" :key="b.id">{{ b.icon }} <strong>{{ b.name }}</strong> <span class="ap-muted">· {{ b.desc }}</span></li>
      </ul>
      <div v-if="ach.card" class="ap-stats">
        <div><b>{{ ach.card.tasksDone }}</b><small>tasks today</small></div>
        <div><b>{{ ach.card.streak }}🔥</b><small>day streak</small></div>
        <div><b>{{ ach.card.points }}</b><small>points</small></div>
      </div>
      <label v-if="ach.needEula" class="ap-eula" data-test="ach-eula"><input type="checkbox" v-model="ach.eulaTick" /> I agree to the <router-link to="/terms" @click="dismiss">Terms (EULA)</router-link>: no objectionable content or abusive users; reported content is reviewed within 24 hours.</label>
      <p v-if="ach.error" class="ap-error" role="alert">{{ ach.error }}</p>
      <button class="ap-btn" :disabled="ach.busy" @click="shareAchievement" data-test="ach-share">{{ ach.busy ? 'Sharing…' : (ach.needEula ? 'Agree & share' : 'Share to Community') }}</button>
      <button class="ap-link" :disabled="ach.busy" @click="dismiss" data-test="ach-dismiss">Not now</button>
    </div>
  </div>
  <div v-if="ach.toast" class="ap-toast" role="status" data-test="ach-toast">{{ ach.toast.text }} <button class="ap-view" @click="view">View post</button></div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { ach, syncAchievements, shareAchievement, dismiss } from '@/composables/useAchievements';
import { badgeInfo } from '@/utils/badges';

const router = useRouter();
const shownBadges = computed(() => ((ach.pending && ach.pending.badges) || []).map(badgeInfo).filter(Boolean));
const headIcon = computed(() => (ach.pending && ach.pending.perfectDate ? '🎉' : ach.pending && ach.pending.tiers.length ? '🔥' : (shownBadges.value[0] || {}).icon || '🏅'));
const view = () => { const id = ach.toast && ach.toast.postId; ach.toast = null; if (id) router.push({ path: '/community', query: { post: id } }); };

// Re-check whenever the existing streak doc changes (debounced: a task toggle may write it more than once).
let stopAuth = null; let stopDoc = null; let t = null;
onMounted(() => {
  if (process.env.VUE_APP_FIREBASE_EMULATORS === '1') window.__cmPerfectDay = () => syncAchievements({ perfect: true }); // local e2e hook only
  stopAuth = onAuthStateChanged(auth, (u) => {
    if (stopDoc) { stopDoc(); stopDoc = null; }
    if (!u) return;
    stopDoc = onSnapshot(doc(db, 'streaks', u.uid), () => { clearTimeout(t); t = setTimeout(() => syncAchievements().catch(() => {}), 1500); }, () => {});
  });
});
// Wait for the app's own streak/reward celebration (.drama) to close so the two never stack.
const otherModal = ref(false);
const poll = setInterval(() => { otherModal.value = !!document.querySelector('.drama'); }, 400);
onBeforeUnmount(() => { clearInterval(poll); if (stopAuth) stopAuth(); if (stopDoc) stopDoc(); clearTimeout(t); });
</script>

<style scoped>
.ap-bg { position: fixed; inset: 0; z-index: 1000; background: rgba(5, 8, 20, .72); display: flex; align-items: flex-end; justify-content: center; padding: 16px; }
.ap-card { width: 100%; max-width: 420px; background: var(--c-surface, #fff); color: var(--c-text, #111); border-radius: 18px; padding: 20px 18px calc(16px + env(safe-area-inset-bottom)); text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,.4); animation: ap-up .25s ease; }
.ap-emoji { font-size: 2.6rem; animation: ap-pop .45s ease; }
.ap-title { font-size: 1.15rem; margin: 6px 0 10px; }
.ap-list { list-style: none; padding: 0; margin: 0 0 12px; text-align: left; display: grid; gap: 6px; }
.ap-list li { background: var(--c-surface-2, #f1f5f9); border-radius: 10px; padding: 8px 10px; font-size: .9rem; }
.ap-muted { opacity: .7; font-size: .8rem; }
.ap-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 10px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; margin-bottom: 12px; }
.ap-stats b { display: block; font-size: 1.1rem; } .ap-stats small { display: block; font-size: .7rem; opacity: .85; }
.ap-eula { display: block; text-align: left; font-size: .8rem; margin-bottom: 10px; }
.ap-error { color: #ef4444; font-size: .85rem; margin: 0 0 8px; }
.ap-btn { width: 100%; padding: 13px; border: 0; border-radius: 12px; background: var(--c-primary, #3b82f6); color: #fff; font-weight: 700; font-size: 1rem; cursor: pointer; }
.ap-btn:disabled { opacity: .6; }
.ap-link { margin-top: 8px; background: none; border: 0; color: inherit; opacity: .8; padding: 8px; font-size: .95rem; cursor: pointer; }
.ap-toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(20px + env(safe-area-inset-bottom)); z-index: 1001; background: #111827; color: #fff; padding: 10px 14px; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,.35); font-size: .9rem; white-space: nowrap; }
.ap-view { margin-left: 8px; background: none; border: 0; color: #93c5fd; font-weight: 700; cursor: pointer; }
@keyframes ap-up { from { transform: translateY(30px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes ap-pop { 0% { transform: scale(.4); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
</style>
