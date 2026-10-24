<template>
  <!-- Persistent 8-hour countdown pill (centered in the top bar, below the notch / safe area), the hard-stop overlay and one transient celebration. -->
  <button v-if="pill" type="button" class="ehp" :class="'ehp--' + pill.kind" data-test="eh-pill" :aria-label="pill.aria" @click="goCard">
    <span class="ehp-dot" aria-hidden="true"></span><span class="ehp-main" role="timer">{{ pill.main }}</span><span v-if="pill.sub" class="ehp-sub">{{ pill.sub }}</span>
  </button>

  <div v-if="shutVisible" class="ehs" role="dialog" aria-modal="true" aria-labelledby="ehs-t" data-test="eh-shutdown">
    <div class="ehs-card">
      <div class="ehs-icon" aria-hidden="true">🌙</div>
      <h2 id="ehs-t">Your 8 hours are up.</h2>
      <p>ClingNote is shut for today. Come back tomorrow at <b data-test="eh-shut-until">{{ shut.untilLabel }}</b>.</p>
      <p class="ehs-res" :class="shut.met ? 'ok' : 'miss'" data-test="eh-shut-result">{{ shut.met ? 'Goal met' : 'Goal missed' }} · {{ shut.earned }}/{{ shut.target }} pts</p>
      <nav class="ehs-links">
        <router-link :to="profileLink">Settings</router-link><router-link to="/support">Support</router-link><router-link to="/privacy-policy">Privacy</router-link><router-link to="/sub">Premium</router-link>
        <button type="button" @click="signOutNow" data-test="eh-shut-signout">Sign out</button>
      </nav>
    </div>
  </div>

  <transition name="ehc"><div v-if="cele && !shutVisible" class="ehc" :class="{ 'ehc--miss': cele.miss }" role="status" data-test="eh-celebrate" @click="dismiss">
    <b>{{ cele.title }}</b><span v-for="l in cele.lines" :key="l">{{ l }}</span><small>Tap to close</small>
  </div></transition>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { useEightHour } from '@/composables/useEightHour';
import { paceOf, pendingCelebration } from '@/utils/pressure';
import { pillState, SHUT_ROUTES, PILL_ROUTES, SEEN_KEY } from '@/utils/eightHourChrome';
import { speak } from '@/composables/useSpeech';

const route = useRoute(); const router = useRouter();
const eh = useEightHour();
const uid = ref(null);
// Shared useEightHour state: at most one 'state' fetch here, and only if nothing else has loaded it yet.
onMounted(() => { try { onAuthStateChanged(auth, (u) => { uid.value = u ? u.uid : null; if (u && !eh.st.loaded && !eh.st.loading) eh.refresh().catch(() => {}); }); } catch (e) { /* ignore */ } });
const profileLink = computed(() => (uid.value ? `/profile/${uid.value}` : '/login'));

const pill = computed(() => {
  if (!uid.value || !PILL_ROUTES.includes(route.name) || route.meta.bare) return null;
  const l = eh.lock.value;
  return pillState({ phase: eh.phase.value, running: eh.running.value, countdown: eh.countdown.value, startsLabel: eh.startsLabel.value, hasPlan: !!eh.plan.value,
    shut: !!eh.shutdown.value, untilLabel: eh.shutdown.value?.untilLabel, earned: l ? l.earned || 0 : 0, target: l ? l.target || 0 : 0,
    pace: l && eh.running.value ? paceOf({ earned: l.earned || 0, target: l.target || 0, startMs: l.startMs, endMs: l.endMs, nowMs: eh.nowMs() }) : null });
});
const shut = computed(() => eh.shutdown.value);
const shutVisible = computed(() => !!(uid.value && shut.value && SHUT_ROUTES.includes(route.name)));
const goCard = () => { router.push({ name: 'home' }).then(() => setTimeout(() => document.querySelector('[data-test="eight-hour-card"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)).catch(() => {}); };
const signOutNow = async () => { try { await signOut(auth); } finally { router.push('/login'); } };

// One transient celebration (day result or manager award), shown once per event, with a boss voice line.
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; } };
const cele = ref(null);
watch(() => [uid.value, eh.stats.value, eh.st.data?.offline], () => {
  if (!uid.value || eh.st.data?.offline || cele.value) return;
  const c = pendingCelebration(eh.stats.value, readSeen());
  if (!c) return;
  cele.value = c;
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [c.key]: c.id })); } catch (e) { /* ignore */ }
  try { speak(c.voice); } catch (e) { /* no speech */ }
  setTimeout(() => { if (cele.value === c) cele.value = null; }, 7000);
}, { immediate: true });
const dismiss = () => { cele.value = null; };
</script>

<style scoped>
.ehp { position: fixed; top: calc(env(safe-area-inset-top) + 14px); left: 50%; transform: translateX(-50%); z-index: 60; height: 28px; max-width: 46vw;
  display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border-radius: 999px; border: 1px solid rgba(55,138,221,.45); background: rgba(10,18,38,.92);
  color: #e6e9ef; font: 700 12px/1 system-ui, -apple-system, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; cursor: pointer; }
.ehp-dot { width: 7px; height: 7px; border-radius: 50%; background: #378ADD; flex: none; }
.ehp--run .ehp-dot { background: #3cb46e; animation: ehp-pulse 1.6s infinite; }
.ehp--risk { border-color: rgba(224,90,90,.7); } .ehp--risk .ehp-dot { background: #e05a5a; }
.ehp--shut .ehp-dot, .ehp--before .ehp-dot { background: #8791a5; }
.ehp-sub { font-weight: 600; opacity: .7; overflow: hidden; text-overflow: ellipsis; }
@keyframes ehp-pulse { 50% { opacity: .35; } }
.ehs { position: fixed; inset: 0; z-index: 9500; display: grid; place-items: center; padding: calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px);
  background: rgba(4,8,18,.94); backdrop-filter: blur(6px); }
.ehs-card { max-width: 360px; text-align: center; color: #e6e9ef; }
.ehs-icon { font-size: 40px; } .ehs-card h2 { font-size: 22px; font-weight: 800; margin: 8px 0; } .ehs-card p { opacity: .85; margin: 6px 0; }
.ehs-res { font-weight: 700; } .ehs-res.ok { color: #3cb46e; } .ehs-res.miss { color: #e05a5a; }
.ehs-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; margin-top: 18px; font-size: 13px; }
.ehs-links a, .ehs-links button { color: #9fb7e0; background: none; border: 0; padding: 4px; cursor: pointer; text-decoration: underline; font: inherit; }
.ehc { position: fixed; left: 50%; top: calc(env(safe-area-inset-top) + 56px); transform: translateX(-50%); z-index: 9400; width: min(340px, 92vw);
  display: flex; flex-direction: column; gap: 2px; text-align: center; padding: 12px 14px; border-radius: 16px; background: linear-gradient(135deg, #1f3b2a, #12301f); border: 1px solid rgba(60,180,110,.5); color: #e6f6ec; box-shadow: 0 10px 30px rgba(0,0,0,.45); cursor: pointer; }
.ehc--miss { background: linear-gradient(135deg, #3b1f1f, #301212); border-color: rgba(224,90,90,.5); color: #f6e6e6; }
.ehc b { font-size: 15px; } .ehc span { font-size: 13px; } .ehc small { opacity: .55; font-size: 11px; margin-top: 2px; }
.ehc-enter-active, .ehc-leave-active { transition: opacity .25s, transform .25s; } .ehc-enter-from, .ehc-leave-to { opacity: 0; transform: translate(-50%, -8px); }
@media (prefers-reduced-motion: reduce) { .ehp--run .ehp-dot { animation: none; } .ehc-enter-active, .ehc-leave-active { transition: none; } }
</style>
