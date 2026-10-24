<template>
  <div class="pf">
    <div class="pf-scene" aria-hidden="true"></div>
    <div class="pf-wrap">
      <button type="button" class="pf-back" aria-label="Close" data-test="profile-close" @click="closeProfile"><span aria-hidden="true">‹</span> Profile</button>
      <header class="pf-hero">
        <h1 class="pf-title">{{ isOwn ? 'Your ' : '' }}<span class="pf-accent">{{ isOwn ? 'space.' : 'Profile' }}</span></h1>
        <p v-if="isOwn" class="pf-sub">Make it feel like you.</p>
      </header>

      <template v-if="userData">
        <!-- Identity card: avatar, name, email, plan -->
        <section class="pf-card pf-id">
          <div class="pf-id-row">
            <div class="pf-av-wrap">
              <img v-if="avatarSrc" class="profile-avatar pf-av" :src="avatarSrc" alt="Profile picture" data-test="profile-avatar" />
              <span v-else class="profile-avatar profile-avatar--default pf-av pf-av--default" data-test="profile-avatar-default" aria-label="Default profile picture">{{ initials }}</span>
              <button v-if="isOwn" type="button" class="pf-av-cam" aria-label="Change photo" :disabled="avatarBusy" @click="fileInput && fileInput.click()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
              </button>
            </div>
            <div class="pf-id-text">
              <p class="pf-name">{{ userData.name }}</p>
              <p v-if="userData.email" class="pf-email">{{ userData.email }}</p>
              <p v-if="isOwn" class="pf-chip" :class="{ 'pf-chip--pro': userIsPro }" data-test="profile-plan"><span aria-hidden="true">{{ userIsPro ? '👑' : '•' }}</span> Plan: {{ planText }}</p>
            </div>
          </div>
          <p v-if="userData.gender || formatDOB(userData.dob)" class="pf-meta">{{ [userData.gender, formatDOB(userData.dob)].filter(Boolean).join(' · ') }}</p>
          <div v-if="isOwn" class="pf-id-actions" data-test="avatar-controls">
            <input ref="fileInput" type="file" accept="image/*" class="hidden" data-test="avatar-file" @change="onPickAvatar" />
            <div class="pf-links">
              <button type="button" class="pf-link" :disabled="avatarBusy" data-test="avatar-change" @click="fileInput && fileInput.click()">{{ avatarSrc ? 'Change photo' : 'Upload photo' }}</button>
              <template v-if="avatarSrc"><span class="pf-dot" aria-hidden="true">•</span><button type="button" class="pf-link pf-link--muted" :disabled="avatarBusy" data-test="avatar-reset" @click="resetAvatar">Reset to default</button></template>
            </div>
            <button v-if="!editMode" type="button" class="pf-btn-outline" data-test="profile-edit" @click="editMode = true">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg> Edit profile</button>
          </div>
          <p v-if="avatarMsg" class="pf-msg" :class="avatarErr ? 'pf-msg--err' : 'pf-msg--ok'" role="status">{{ avatarMsg }}</p>

          <!-- Edit Profile Information -->
          <form v-if="editMode" class="pf-edit" @submit.prevent="saveUserData">
            <label class="pf-field"><span>Name</span><input type="text" v-model="editedUserData.name" placeholder="Name"></label>
            <label class="pf-field"><span>Email</span><input type="email" v-model="editedUserData.email" placeholder="Email"></label>
            <label class="pf-field"><span>Gender</span><select v-model="editedUserData.gender">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select></label>
            <label class="pf-field"><span>Date of birth</span><input type="date" v-model="editedUserData.dob"></label>
            <div class="pf-edit-actions">
              <button type="button" class="pf-btn-ghost" @click="editMode = false">Cancel</button>
              <button type="submit" class="pf-btn-primary">Save</button>
            </div>
          </form>
        </section>

        <!-- Stats -->
        <section v-if="isOwn && stats" class="pf-stats" aria-label="Your stats" data-test="profile-stats">
          <div class="pf-stat"><span class="pf-stat-v">🔥 {{ stats.streak }}</span><span class="pf-stat-l">Day streak</span></div>
          <div class="pf-stat"><span class="pf-stat-v">🏆 {{ stats.best }}</span><span class="pf-stat-l">Best streak</span></div>
          <div class="pf-stat"><span class="pf-stat-v">🎖 {{ stats.milestones }}/{{ stats.totalMilestones }}</span><span class="pf-stat-l">Milestones</span></div>
        </section>

        <template v-if="isOwn">
          <!-- Membership -->
          <section class="pf-card pf-member">
            <div class="pf-member-head">
              <span class="pf-ico pf-ico--lg" aria-hidden="true">👑</span>
              <div class="pf-row-text">
                <p class="pf-row-title">{{ userIsPro ? 'Pro membership' : 'ClingNote Free' }}</p>
                <p class="pf-row-sub">{{ userIsPro ? planText.replace(/^Pro \((.*)\)$/, '$1 plan') : 'Unlock everything with Pro' }}</p>
              </div>
              <span v-if="userIsPro" class="pf-pill-ok"><i aria-hidden="true"></i>Active</span>
            </div>
            <router-link v-if="isOwn && !userIsPro" to="/paywall" data-test="upgrade-pro" class="pf-upgrade">Upgrade to Pro</router-link>
            <button v-if="isOwn && userIsPro && !isLifetime" type="button" data-test="manage-sub" @click="manageSub" class="pf-row pf-row--divided pf-row--auto">
              <span class="pf-ico" aria-hidden="true">💳</span>Manage subscription</button>
          </section>

          <h2 class="pf-section">Preferences</h2>
          <section class="pf-card pf-card--flush pf-push"><PushSettings /></section>

          <h2 class="pf-section">More</h2>
          <section class="pf-card pf-card--flush">
            <router-link to="/onboarding" data-test="replay-onboarding" class="pf-row"><span class="pf-ico" aria-hidden="true">🔄</span><span class="pf-row-title">Replay onboarding</span><span class="pf-chev" aria-hidden="true">›</span></router-link>
            <button v-if="isOwn" type="button" data-test="rate-app" class="pf-row pf-row--divided" @click="rateApp"><span class="pf-ico" aria-hidden="true">⭐</span><span class="pf-row-title">Rate ClingNote</span><span class="pf-chev" aria-hidden="true">›</span></button>
            <router-link to="/support" class="pf-row pf-row--divided" data-test="profile-support"><span class="pf-ico" aria-hidden="true">💬</span><span class="pf-row-title">Help &amp; support</span><span class="pf-chev" aria-hidden="true">›</span></router-link>
            <router-link to="/privacy-policy" class="pf-row pf-row--divided"><span class="pf-ico" aria-hidden="true">🔒</span><span class="pf-row-title">Privacy policy</span><span class="pf-chev" aria-hidden="true">›</span></router-link>
          </section>

          <button type="button" class="pf-logout" data-test="profile-logout" :disabled="loggingOut" @click="logout">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>{{ loggingOut ? 'Logging out…' : 'Log out' }}</button>
          <div class="pf-danger"><DeleteAccount :user-is-pro="userIsPro" /></div>
        </template>
      </template>
      <div v-else-if="notFound" class="pf-state">This profile isn't available.</div>
      <div v-else-if="loading" class="pf-state">Loading...</div>
      <div v-else class="pf-state">Couldn't load this profile. <button @click="load" class="pf-link">Retry</button></div>
    </div>
  </div>
</template>

<script setup>
import PushSettings from '@/components/PushSettings.vue';
import DeleteAccount from '@/components/DeleteAccount.vue';
import { syncPublicProfile } from '@/composables/usePublicProfile';
import { fileToAvatarDataUrl, isAvatarSrc, initialsOf } from '@/utils/avatar';
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter as useCloseRouter } from 'vue-router';
const closeRouter = useCloseRouter();
const loggingOut = ref(false);
// Same sign-out flow as the nav menu: Firebase signOut, then back to /login.
const logout = async () => {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try { await auth.signOut(); closeRouter.push('/login'); }
  catch (error) { console.error('Error logging out:', error.message); }
  finally { loggingOut.value = false; }
};
const closeProfile = () => { if (window.history.state && window.history.state.back) closeRouter.back(); else closeRouter.push('/'); };
import { onAuthStateChanged } from 'firebase/auth';
import { ensureUserDoc } from '@/utils/userDoc';
import { isPro } from '@/utils/pro';
import { rewardsFor, MILESTONES } from '@/utils/rewards';
import { withRcPro } from '@/composables/usePro';
import { isNativeIOS } from '@/utils/platform';
import { openWriteReview } from '@/utils/appReview';
const rateApp = () => openWriteReview();
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'vue-router';
import { auth, db } from '@/firebaseConfig';
const route = useRouter();

const userData = ref(null);
const editedUserData = ref(null);
const editMode = ref(false);
const isOwn = ref(false);
const notFound = ref(false);
// Merged Pro: Firestore/server flag OR (iOS) RevenueCat's active 'pro' entitlement (reactive).
const proDoc = computed(() => (isOwn.value && userData.value ? withRcPro(auth.currentUser?.uid, userData.value) : userData.value));
const userIsPro = computed(() => isPro(proDoc.value));
const isLifetime = computed(() => userIsPro.value && proDoc.value?.plan === 'lifetime');
const PLAN_WORD = { monthly: 'Monthly', yearly: 'Yearly' };
const planText = computed(() => (!userIsPro.value ? 'Free' : isLifetime.value ? 'Pro (Lifetime)' : PLAN_WORD[proDoc.value?.plan] ? `Pro (${PLAN_WORD[proDoc.value.plan]})` : 'Pro'));
// iOS: Apple's subscription management (apps cannot cancel IAP). Web: the existing Manage Subscription page (Stripe cancel flow).
const manageSub = async () => { if (isNativeIOS()) { const m = await import('@/utils/iap'); await m.manageSubscriptions(); } else route.push('/subs'); };

const loading = ref(true);
// Streak stats (own profile only, read-only; streaks/{uid} is written by Home).
const stats = ref(null);
const loadStats = async (uid) => {
  try {
    const snap = await withTimeout(getDoc(doc(db, 'streaks', uid)), 8000, 'streaks');
    const d = snap.exists() ? snap.data() : {};
    const n = (v) => (Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0);
    stats.value = { streak: n(d.streak), best: n(d.bestStreak ?? d.streak), milestones: rewardsFor(n(d.bestStreak ?? d.streak)).unlocked.length, totalMilestones: MILESTONES.length };
  } catch (e) { stats.value = null; }
};
const fileInput = ref(null);
const avatarBusy = ref(false);
const avatarMsg = ref('');
const avatarErr = ref(false);
const avatarSrc = computed(() => (userData.value && isAvatarSrc(userData.value.avatarURL) ? userData.value.avatarURL : ''));
const initials = computed(() => initialsOf(userData.value?.name, userData.value?.email));
const saveAvatar = async (value, okMsg) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  avatarBusy.value = true; avatarMsg.value = ''; avatarErr.value = false;
  try {
    await setDoc(doc(db, 'users', uid), { avatarURL: value }, { merge: true });
    userData.value = { ...userData.value, avatarURL: value };
    if (editedUserData.value) editedUserData.value = { ...editedUserData.value, avatarURL: value };
    syncPublicProfile(uid, userData.value).catch(() => {});
    window.dispatchEvent(new CustomEvent('clingnot:avatar', { detail: value }));
    avatarMsg.value = okMsg;
  } catch (e) { console.error('Avatar save failed:', e.message); avatarErr.value = true; avatarMsg.value = 'Could not save your photo. Try again.'; }
  avatarBusy.value = false;
};
const onPickAvatar = async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  avatarBusy.value = true; avatarMsg.value = ''; avatarErr.value = false;
  try { const data = await fileToAvatarDataUrl(f); avatarBusy.value = false; await saveAvatar(data, 'Photo updated.'); }
  catch (e) { avatarBusy.value = false; avatarErr.value = true; avatarMsg.value = e.message || 'Could not use that image.'; }
};
const resetAvatar = () => saveAvatar('', 'Photo reset to default.');
// Never let a hung network/auth call keep the page on "Loading..." forever.
const withTimeout = (pr, ms, label) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timed out')), ms))]);
// Fallback built from the auth user so the owner always sees something even if Firestore fails.
const fromAuth = (u) => ({ id: u.uid, email: u.email || '', name: u.displayName || (u.email || '').split('@')[0] || 'You' });

// Fetch user data from Firestore
const fetchUserData = async () => {
  const targetId = route.currentRoute.value.params.userId;
  const user = auth.currentUser;
  const own = !!user && user.uid === targetId;
  isOwn.value = own;
  try {
    const docSnap = await withTimeout(getDoc(doc(db, own ? 'users' : 'publicProfiles', targetId)), 10000, 'getDoc');
    if (docSnap.exists()) {
      userData.value = own ? { ...fromAuth(user), ...docSnap.data() } : docSnap.data();
    } else if (own) {
      // Older accounts may have no users/{uid} doc: create a minimal one (no billing fields), but don't block on it.
      userData.value = fromAuth(user);
      ensureUserDoc(user).then((d) => { if (d) userData.value = { ...userData.value, ...d }; }).catch((e) => console.warn('ensureUserDoc failed:', e.message));
    } else {
      notFound.value = true;
    }
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    if (own) userData.value = fromAuth(user); else notFound.value = true;
  }
  if (userData.value) editedUserData.value = { ...userData.value };
  stats.value = null;
  if (own) loadStats(targetId);
};

// Wait for auth to settle (refresh/direct URL) and refetch when :userId changes (component is reused).
const authReady = () => (auth.authStateReady ? auth.authStateReady() : new Promise(res => { const u = onAuthStateChanged(auth, () => { u(); res(); }); }));
let seq = 0;
const load = async () => {
  const my = ++seq;
  loading.value = true; notFound.value = false; userData.value = null;
  try {
    await withTimeout(authReady(), 8000, 'auth').catch((e) => console.warn(e.message));
    if (my === seq) await fetchUserData();
  } catch (e) {
    console.error('Profile load failed:', e?.message);
  } finally {
    if (my === seq) loading.value = false;
  }
};
onMounted(load);
// iOS: make sure RevenueCat is logged in and customerInfo is read for this page (the auth listener may not have finished yet).
onMounted(() => { if (isNativeIOS() && auth.currentUser) import("@/utils/iap").then((m) => m.ensureIapUser(auth.currentUser)).catch(() => {}); });
watch(() => route.currentRoute.value.params.userId, (n, o) => { if (n && n !== o) load(); });

// Method to format date of birth
const formatDOB = (dob) => {
  if (!dob) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(`${dob}T12:00:00`) : new Date(dob?.toDate ? dob.toDate() : dob);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Method to save edited user data
const saveUserData = async () => {
  try {
    const docRef = doc(db, 'users', route.currentRoute.value.params.userId);
    // scheduledTasks is owned by useScheduledTasks; never write back a stale copy
    const { scheduledTasks: _omit, ...editable } = editedUserData.value;
    await setDoc(docRef, editable, { merge: true });
    syncPublicProfile(route.currentRoute.value.params.userId, editable).catch(() => {});
    userData.value = { ...editedUserData.value };
    editMode.value = false;
  } catch (error) {
    console.error('Error saving user data:', error.message);
  }
};
</script>

<style scoped>
.pf { position: relative; min-height: 100%; color: var(--c-text); font-family: var(--font); padding-bottom: calc(env(safe-area-inset-bottom) + 32px); }
.pf-scene { position: absolute; z-index: 0; inset: 0 0 auto 0; height: 340px; pointer-events: none;
  background: linear-gradient(180deg, rgba(7,13,28,.2), rgba(7,13,28,0) 40%, var(--c-bg) 97%), var(--hero-img, url('~@/assets/hero-forest.jpg')) 72% 30% / cover no-repeat; }
.pf-wrap { position: relative; z-index: 1; max-width: 520px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 12px) max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left)); }
.pf-back { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 4px; background: none; border: 0; color: var(--c-text); font-size: 17px; cursor: pointer; }
.pf-back span { font-size: 28px; line-height: 1; margin-top: -3px; }
.pf-hero { padding: 72px 4px 18px; }
.pf-title { margin: 0; font-size: 34px; line-height: 40px; font-weight: 800; letter-spacing: -.02em; color: #fff; }
.pf-accent { color: #3D8BFF; }
.pf-sub { margin: 2px 0 0; font-size: 15px; color: var(--c-text-2); }

.pf-card { background: rgba(12,22,48,.82); border: 1px solid var(--c-border-strong); border-radius: 20px; padding: 18px; margin-bottom: 14px;
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 10px 30px rgba(0,0,0,.25); }
.pf-card--flush { padding: 4px 16px; }
.pf-id-row { display: flex; align-items: center; gap: 16px; }
.pf-av-wrap { position: relative; flex-shrink: 0; }
.pf-av { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(255,255,255,.85); box-shadow: 0 6px 18px rgba(0,0,0,.35); display: inline-flex; }
.pf-av--default { align-items: center; justify-content: center; background: linear-gradient(135deg, #2F6FFF, #1e3a8a); color: #fff; font-weight: 800; font-size: 28px; }
.pf-av-cam { position: absolute; right: -2px; bottom: -2px; width: 32px; height: 32px; border-radius: 50%; background: #12203F; border: 1.5px solid var(--c-border-strong); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.pf svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
.pf-id-text { min-width: 0; }
.pf-name { margin: 0; font-size: 22px; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-email { margin: 2px 0 0; font-size: 14px; color: var(--c-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-chip { display: inline-flex; align-items: center; gap: 6px; margin: 8px 0 0; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--c-text-2); background: var(--c-surface-2); border: 1px solid var(--c-border-strong); }
.pf-chip--pro { color: #8FB6FF; background: var(--c-accent-soft); border-color: var(--c-accent-line); }
.pf-meta { margin: 12px 0 0; font-size: 13px; color: var(--c-text-3); }
.pf-id-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
.pf-links { display: flex; align-items: center; gap: 8px; }
.pf-link { background: none; border: 0; padding: 6px 0; font-size: 14px; color: var(--c-accent-text); cursor: pointer; }
.pf-link--muted { color: var(--c-text-2); }
.pf-dot { color: var(--c-text-3); font-size: 10px; }
.pf-btn-outline { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1.5px solid #6b8cff; background: rgba(79,111,240,.12); color: #fff; font-weight: 600; font-size: 15px; cursor: pointer; }
.pf-msg { margin: 10px 0 0; font-size: 13px; } .pf-msg--ok { color: var(--c-success); } .pf-msg--err { color: var(--c-danger); }
.pf-edit { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--c-border); display: grid; gap: 10px; }
.pf-field { display: grid; gap: 4px; font-size: 12px; color: var(--c-text-3); text-transform: uppercase; letter-spacing: .06em; }
.pf-field input, .pf-field select { min-height: 44px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--c-border-strong); background: var(--c-surface-2); color: var(--c-text); font-size: 16px; text-transform: none; letter-spacing: 0; }
.pf-edit-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.pf-btn-primary, .pf-btn-ghost { min-height: 44px; padding: 0 20px; border-radius: 12px; font-weight: 700; cursor: pointer; }
.pf-btn-primary { background: var(--c-accent); color: #fff; border: 0; }
.pf-btn-ghost { background: transparent; color: var(--c-text-2); border: 1px solid var(--c-border-strong); }

.pf-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.pf-stat { background: rgba(12,22,48,.82); border: 1px solid var(--c-border-strong); border-radius: 16px; padding: 12px 8px; text-align: center; display: grid; gap: 2px; }
.pf-stat-v { font-size: 18px; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
.pf-stat-l { font-size: 11px; color: var(--c-text-3); text-transform: uppercase; letter-spacing: .06em; }

.pf-member { background: linear-gradient(180deg, rgba(12,22,48,.55), rgba(12,22,48,.92)), var(--hero-img, url('~@/assets/hero-forest.jpg')) 60% 40% / cover no-repeat; padding-bottom: 6px; }
.pf-member-head { display: flex; align-items: center; gap: 14px; padding-bottom: 12px; }
.pf-ico { width: 36px; height: 36px; border-radius: 10px; background: var(--c-surface-2); display: inline-flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
.pf-ico--lg { width: 52px; height: 52px; border-radius: 14px; font-size: 24px; background: var(--c-accent-soft); }
.pf-row-text { flex: 1; min-width: 0; }
.pf-row-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--c-text); flex: 1; text-align: left; }
.pf-row-sub { margin: 2px 0 0; font-size: 13px; color: var(--c-text-2); }
.pf-pill-ok { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-size: 13px; color: var(--c-success); background: var(--c-success-soft); border: 1px solid rgba(61,220,151,.35); }
.pf-pill-ok i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pf-upgrade { display: block; margin: 4px 0 12px; min-height: 48px; line-height: 48px; text-align: center; border-radius: 14px; font-weight: 800; color: #fff; background: linear-gradient(90deg, #f59e0b, #ea580c); box-shadow: 0 6px 18px rgba(234,88,12,.3); }
.pf-row { display: flex; align-items: center; gap: 14px; width: 100%; min-height: 56px; padding: 8px 0; background: none; border: 0; color: var(--c-text); cursor: pointer; text-decoration: none; }
.pf-row--divided { border-top: 1px solid var(--c-border); }
.pf-row--auto { font-size: 16px; font-weight: 600; }
.pf-row--auto::after { content: "›"; margin-left: auto; color: var(--c-text-3); font-size: 22px; line-height: 1; }
.pf-chev { color: var(--c-text-3); font-size: 22px; line-height: 1; }
.pf-section { margin: 22px 4px 8px; font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--c-text-3); }
.pf-push :deep(.push) { margin: 0; padding: 12px 0; border: 0; background: none; }

.pf-logout { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 52px; margin-top: 22px; border-radius: 16px;
  background: rgba(12,22,48,.82); border: 1px solid var(--c-border-strong); color: var(--c-text); font-size: 16px; font-weight: 600; cursor: pointer; }
.pf-logout:disabled { opacity: .6; }
.pf-danger { margin-top: 6px; }
.pf-danger :deep(#delete-account) { border-color: var(--c-border); }
.pf-state { padding: 40px 0; text-align: center; color: var(--c-text-2); }

.pf-back, .pf-btn-outline, .pf-row, .pf-logout, .pf-upgrade, .pf-av-cam { transition: transform .15s ease, background .2s ease, opacity .2s ease; }
.pf-btn-outline:active, .pf-logout:active, .pf-upgrade:active, .pf-row:active { transform: scale(.98); }
.pf-row:hover .pf-chev { color: var(--c-text); }
.pf :focus-visible { outline: 2px solid var(--c-accent-text); outline-offset: 2px; border-radius: 10px; }
@media (min-width: 600px) { .pf-scene { border-radius: 0 0 28px 28px; } .pf-title { font-size: 40px; line-height: 46px; } }
@media (prefers-reduced-motion: reduce) { .pf * { transition: none !important; animation: none !important; } .pf-btn-outline:active, .pf-logout:active, .pf-upgrade:active, .pf-row:active { transform: none; } }
</style>
