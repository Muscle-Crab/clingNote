<template>
  <div class="pf">
    <div class="pf-wrap">
      <template v-if="userData">
        <!-- Identity card: avatar, name, email, plan -->
        <section class="pf-card pf-id">
          <div class="pf-id-row">
            <div class="pf-av-wrap">
              <img v-if="avatarSrc && !avFailed" :key="avatarSrc" class="profile-avatar pf-av" :src="avatarSrc" alt="Profile picture" data-test="profile-avatar" width="88" height="88" decoding="async" @error="avFailed = true" />
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
        <template v-if="!isOwn && otherStats">
          <section class="pf-stats" aria-label="Their stats" data-test="profile-other-stats">
            <div class="pf-stat"><span class="pf-stat-v">🔥 {{ otherStats.streak }}</span><span class="pf-stat-l">Day streak</span></div>
            <div class="pf-stat"><span class="pf-stat-v">🏆 {{ otherStats.best }}</span><span class="pf-stat-l">Best streak</span></div>
            <div class="pf-stat"><span class="pf-stat-v">🎖 {{ otherStats.badges.length }}</span><span class="pf-stat-l">Badges</span></div>
          </section>
          <section class="pf-card pf-badges" aria-label="Badges" data-test="profile-other-badges">
            <div v-for="b in BADGES" :key="b.id" class="pf-badge" :class="{ 'pf-badge--off': !otherStats.badges.includes(b.id) }" :title="b.desc"><span aria-hidden="true">{{ b.icon }}</span><small>{{ b.name }}</small></div>
          </section>
        </template>
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
          <section v-if="isOwn" class="pf-card pf-card--flush" data-test="lock-in-setting">
            <label class="pf-row"><span class="pf-ico" aria-hidden="true">🔒</span><span class="pf-row-title">Lock-in<small class="pf-dl-sub">8-hour lock: a timed day that shuts the app at the end. Off by default; you can skip it on any day.</small></span>
              <input type="checkbox" role="switch" class="pf-switch" data-test="lock-in-toggle" :checked="lockIn.enabled" :disabled="!lockIn.loaded" @change="onLockInToggle($event.target.checked)" /></label>
            <label v-if="lockIn.enabled" class="pf-row pf-row--divided" data-test="lock-end-alert-row"><span class="pf-ico" aria-hidden="true">📣</span><span class="pf-row-title">Lock-end alert<small class="pf-dl-sub">How hard ClingNote alerts you when a lock ends</small></span>
              <select class="pf-time" data-test="lock-end-alert" :value="lockEndAlert" @change="onLockEndAlert($event.target.value)"><option v-for="o in LOCK_END_OPTS" :key="o.v" :value="o.v">{{ o.l }}</option></select></label>
            <label class="pf-row pf-row--divided" data-test="auto-focus-row"><span class="pf-ico" aria-hidden="true">🎯</span><span class="pf-row-title">Auto-start focus<small class="pf-dl-sub">Starts a task's timer at its start time (and when iPhone Focus turns on) and locks you in until it ends</small></span>
              <input type="checkbox" role="switch" class="pf-switch" data-test="auto-focus-toggle" :checked="autoFocus" @change="onAutoFocus($event.target.checked)" /></label>
          </section>
          <section v-if="isOwn" class="pf-card pf-card--flush" data-test="wake-alarm-setting">
            <label class="pf-row"><span class="pf-ico" aria-hidden="true">⏰</span><span class="pf-row-title">Wake-up alarm<small class="pf-dl-sub" data-test="wake-alarm-sub">{{ wakeOk ? 'ClingNote asks you each day if you want an alarm, then rings at your time, even on silent (iOS 26+). Off by default.' : 'iOS app only: install ClingNote on your iPhone to use it.' }}</small></span>
              <input type="checkbox" role="switch" class="pf-switch" data-test="wake-alarm-toggle" :checked="wakeOk && wake.enabled" :disabled="!wakeOk || !wake.loaded || wakeBusy" @change="onWakeToggle($event.target.checked)" /></label>
            <template v-if="wakeOk && wake.enabled">
              <label class="pf-row pf-row--divided"><span class="pf-ico" aria-hidden="true">🔔</span><span class="pf-row-title">Alarm time<small class="pf-dl-sub">Prefilled each time you're asked</small></span>
                <input type="time" class="pf-time" data-test="wake-alarm-time" :value="wake.time" @change="setWakeTime($event.target.value)" /></label>
              <label class="pf-row pf-row--divided"><span class="pf-ico" aria-hidden="true">💬</span><span class="pf-row-title">Ask me at<small class="pf-dl-sub">{{ wakePromptHint }}</small></span>
                <input type="time" class="pf-time" data-test="wake-prompt-time" :value="wake.promptTime" @change="setWakePromptTime($event.target.value)" /></label>
              <div class="pf-row pf-row--divided pf-row--auto"><span class="pf-ico" aria-hidden="true">📅</span><span class="pf-row-title">Alarm days
                <span class="pf-days" role="group" aria-label="Alarm days"><button v-for="d in WEEKDAYS" :key="d.n" type="button" class="pf-day" :class="{ 'pf-day--on': wake.days.includes(d.n) }" :aria-pressed="wake.days.includes(d.n)" :aria-label="d.full" @click="toggleWakeDay(d.n)">{{ d.s }}</button></span></span></div>
              <p v-if="!wake.alarmKit" class="pf-wa-note" data-test="wake-alarm-fallback-note">On this iPhone the alarm rings as notifications, which follow the silent switch. Update to iOS 26 and allow Alarms for ClingNote to ring on silent.</p>
            </template>
          </section>
          <section v-if="isOwn && lockIn.enabled" class="pf-card pf-card--flush" data-test="day-length-setting">
            <div class="pf-row"><span class="pf-ico" aria-hidden="true">⏱</span><span class="pf-row-title">Day length<small class="pf-dl-sub">Preselected each morning · 3 to 12 h</small></span>
              <span class="pf-dl"><button type="button" class="pf-dl-btn" :disabled="dayLen <= DAY_HOURS.min" aria-label="Half an hour less" data-test="day-length-minus" @click="bumpDayLen(-0.5)">−</button><b data-test="day-length-value">{{ hoursLabel(dayLen) }} h</b><button type="button" class="pf-dl-btn" :disabled="dayLen >= DAY_HOURS.max" aria-label="Half an hour more" data-test="day-length-plus" @click="bumpDayLen(0.5)">+</button></span>
            </div>
          </section>

          <section class="pf-card pf-card--flush" data-test="appearance-setting">
            <div class="pf-row pf-row--stack"><span class="pf-ico" aria-hidden="true">🎨</span><span class="pf-row-title">Theme
              <span class="pf-seg" role="radiogroup" aria-label="Theme"><button v-for="o in THEME_OPTS" :key="o.v" type="button" role="radio" class="pf-seg-btn" :class="{ 'pf-seg-btn--on': appearance.mode === o.v }" :aria-checked="appearance.mode === o.v" :data-test="'theme-' + o.v" @click="setAppearance({ mode: o.v })">{{ o.l }}</button></span></span></div>
            <div class="pf-row pf-row--divided pf-row--stack"><span class="pf-ico" aria-hidden="true">🔠</span><span class="pf-row-title">Text size<small class="pf-dl-sub">Auto follows your device's text size</small>
              <span class="pf-seg" role="radiogroup" aria-label="Text size"><button v-for="o in TEXT_OPTS" :key="o.v" type="button" role="radio" class="pf-seg-btn" :class="{ 'pf-seg-btn--on': appearance.text === o.v }" :aria-checked="appearance.text === o.v" :aria-label="o.a" :data-test="'text-' + o.v" @click="setAppearance({ text: o.v })">{{ o.l }}</button></span></span></div>
          </section>
          <section v-if="isOwn" class="pf-card pf-card--flush" data-test="calendar-sync-setting">
            <label v-if="calNative" class="pf-row"><span class="pf-ico" aria-hidden="true">📆</span><span class="pf-row-title">Calendar sync<small class="pf-dl-sub" data-test="calendar-sync-sub">{{ calSub }}</small></span>
              <input type="checkbox" role="switch" class="pf-switch" data-test="calendar-sync-toggle" :checked="calSyncState.enabled" :disabled="calSyncState.busy" @change="onCalToggle($event.target.checked)" /></label>
            <div v-else class="pf-row pf-row--stack"><span class="pf-ico" aria-hidden="true">📆</span><span class="pf-row-title">Calendar<small class="pf-dl-sub" data-test="calendar-sync-sub">{{ calMsg || 'Two-way sync is in the iOS app. Here: export timed tasks as .ics, or import events.' }}</small>
              <span class="pf-mini-btns"><button type="button" class="pf-mini" data-test="ics-export" :disabled="calBusy" @click="onIcsExport">Export .ics</button><button type="button" class="pf-mini" data-test="ics-import" :disabled="calBusy" @click="icsInput && icsInput.click()">Import .ics</button></span></span>
              <input ref="icsInput" type="file" accept=".ics,text/calendar" class="pf-hidden-file" @change="onIcsImport" /></div>
          </section>

          <h2 class="pf-section">More</h2>
          <section class="pf-card pf-card--flush">
            <button type="button" data-test="stats-row" class="pf-row" @click="openStats"><span class="pf-ico" aria-hidden="true">📊</span><span class="pf-row-title">Stats</span><span class="pf-chev" aria-hidden="true">›</span></button>
            <router-link to="/onboarding" data-test="replay-onboarding" class="pf-row pf-row--divided"><span class="pf-ico" aria-hidden="true">🔄</span><span class="pf-row-title">Replay onboarding</span><span class="pf-chev" aria-hidden="true">›</span></router-link>
            <button v-if="isOwn" type="button" data-test="rate-app" class="pf-row pf-row--divided" @click="rateApp"><span class="pf-ico" aria-hidden="true">⭐</span><span class="pf-row-title">Rate ClingNote</span><span class="pf-chev" aria-hidden="true">›</span></button>
            <router-link to="/support" class="pf-row pf-row--divided" data-test="profile-support"><span class="pf-ico" aria-hidden="true">💬</span><span class="pf-row-title">Help &amp; support</span><span class="pf-chev" aria-hidden="true">›</span></router-link>
            <router-link to="/privacy-policy" class="pf-row pf-row--divided"><span class="pf-ico" aria-hidden="true">🔒</span><span class="pf-row-title">Privacy policy</span><span class="pf-chev" aria-hidden="true">›</span></router-link>
            <router-link to="/terms" class="pf-row pf-row--divided" data-test="profile-terms"><span class="pf-ico" aria-hidden="true">📄</span><span class="pf-row-title">Terms &amp; conditions</span><span class="pf-chev" aria-hidden="true">›</span></router-link>
            <template v-if="isOwn">
              <button type="button" class="pf-row pf-row--divided" data-test="task-transfer" :aria-expanded="xferOpen" @click="xferOpen = !xferOpen"><span class="pf-ico" aria-hidden="true">📦</span><span class="pf-row-title">Export / import tasks</span><span class="pf-chev" :class="{ 'pf-chev--open': xferOpen }" aria-hidden="true">›</span></button>
              <div v-if="xferOpen" class="pf-xfer" data-test="task-transfer-panel">
                <span class="pf-mini-btns"><button type="button" class="pf-mini" data-test="export-json" :disabled="xferBusy" @click="onExport('json')">Export JSON</button><button type="button" class="pf-mini" data-test="export-csv" :disabled="xferBusy" @click="onExport('csv')">Export CSV</button><button type="button" class="pf-mini" data-test="import-json" :disabled="xferBusy" @click="xferInput && xferInput.click()">Import JSON</button></span>
                <input ref="xferInput" type="file" accept=".json,application/json" class="pf-hidden-file" @change="onImport" />
                <small class="pf-dl-sub" data-test="task-transfer-msg" role="status">{{ xferMsg || 'Import adds tasks from a ClingNote JSON export. Duplicates are skipped.' }}</small>
              </div>
            </template>
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
    <StatsSheet v-if="statsOpen" :data="statsData" :loading="statsLoading" @close="statsOpen = false" />
  </div>
</template>

<script setup>
import { lockIn, loadLockIn, setLockInEnabled } from '@/utils/lockIn';
import { readAutoFocus, writeAutoFocus } from '@/utils/focusAutoStart';
loadLockIn(true).catch(() => {});
import { wake, wakeSupported, loadWake, setWakeEnabled, setWakeTime, setWakePromptTime, setWakeDays } from '@/composables/useWakeAlarm';
import { toMin } from '@/utils/wakeAlarm';
const wakeOk = wakeSupported(); const wakeBusy = ref(false);
const WEEKDAYS = [['S', 'Sunday'], ['M', 'Monday'], ['T', 'Tuesday'], ['W', 'Wednesday'], ['T', 'Thursday'], ['F', 'Friday'], ['S', 'Saturday']].map(([s, full], n) => ({ n, s, full }));
if (wakeOk && auth.currentUser) loadWake(auth.currentUser.uid, true).catch(() => {});
const onWakeToggle = async (on) => { wakeBusy.value = true; try { await setWakeEnabled(on); } catch (e) { console.warn('wake alarm toggle:', e); } wakeBusy.value = false; };
const toggleWakeDay = (n) => { const d = wake.value.days; const next = d.includes(n) ? d.filter((x) => x !== n) : [...d, n]; if (next.length) setWakeDays(next).catch(() => {}); };
const wakePromptHint = computed(() => (toMin(wake.value.promptTime) < toMin(wake.value.time) ? "Morning: asks about that morning's alarm" : 'Evening: asks about the next morning'));
const autoFocus = ref(readAutoFocus(localStorage)); // per device (src/utils/focusAutoStart.js)
const onAutoFocus = (on) => { writeAutoFocus(localStorage, on); autoFocus.value = !!on; };
const onLockInToggle = async (on) => { const u = auth.currentUser; if (!u) return; try { await setLockInEnabled(u.uid, on); } catch (e) { console.warn('lock-in toggle:', e); loadLockIn(true).catch(() => {}); } };
// Lock-end alert level (App Group defaults via ClingLock.setLockEndAlert; localStorage mirror for web/first paint).
const LOCK_END_OPTS = [{ v: 'off', l: 'Off' }, { v: 'subtle', l: 'Subtle' }, { v: 'standard', l: 'Standard' }, { v: 'loud', l: 'Loud' }, { v: 'maximum', l: 'Maximum' }];
const LOCK_END_KEY = 'cling.lockEndAlert';
const lockEndAlert = ref((() => { try { return localStorage.getItem(LOCK_END_KEY) || 'loud'; } catch (e) { return 'loud'; } })());
if (lockAvailable()) clingLock.setLockEndAlert().then((r) => { if (r && r.level) lockEndAlert.value = r.level; }).catch(() => {});
const onLockEndAlert = (v) => { lockEndAlert.value = v; try { localStorage.setItem(LOCK_END_KEY, v); } catch (e) { /* ignore */ } if (lockAvailable()) clingLock.setLockEndAlert(v).catch(() => {}); };
import { clingLock, lockAvailable } from '@/native/clingNative';
import PushSettings from '@/components/PushSettings.vue';
import DeleteAccount from '@/components/DeleteAccount.vue';
import { syncPublicProfile } from '@/composables/usePublicProfile';
import { fileToAvatarDataUrl, isAvatarSrc, initialsOf } from '@/utils/avatar';
import { myAvatar } from '@/composables/useAvatar';
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { BADGES } from '@/utils/badges';
import { getCommunityProfile } from '@/composables/useCommunity';
import { pageTitle } from '@/composables/usePageTitle';
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
import { onAuthStateChanged } from 'firebase/auth';
import { ensureUserDoc } from '@/utils/userDoc';
import { isPro } from '@/utils/pro';
import { rewardsFor, MILESTONES } from '@/utils/rewards';
import { withRcPro } from '@/composables/usePro';
import { isNativeIOS } from '@/utils/platform';
import { openWriteReview } from '@/utils/appReview';
import { DAY_HOURS, hoursLabel } from '@/utils/eightHour';
import { dayLengthHours, setDayLengthHours, loadDayLengthHours } from '@/composables/useEightHour';
const rateApp = () => openWriteReview();
// Appearance (F4), calendar sync / .ics (F1), task export/import (F3)
import { appearance, setAppearance } from '@/composables/useAppearance';
import { calSyncState, setCalendarSync, initCalendarSync, exportIcs, importIcs } from '@/composables/useCalendarSync';
import { exportTasks, importTasks } from '@/composables/useTaskBackup';
import { readTextFile } from '@/utils/fileSave';
const THEME_OPTS = [{ v: 'system', l: 'System' }, { v: 'light', l: 'Light' }, { v: 'dark', l: 'Dark' }];
const TEXT_OPTS = [{ v: 'system', l: 'Auto', a: 'System size' }, { v: 'm', l: 'A', a: 'Default' }, { v: 'l', l: 'A+', a: 'Large' }, { v: 'xl', l: 'A++', a: 'Larger' }];
const calNative = isNativeIOS(); const calBusy = ref(false); const calMsg = ref(''); const icsInput = ref(null);
if (auth.currentUser) initCalendarSync(auth.currentUser.uid);
const fmtAgo = (ms) => { if (!ms) return ''; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
const calSub = computed(() => {
  const s = calSyncState.value;
  if (s.busy) return 'Syncing…';
  if (s.message) return s.message;
  return s.enabled ? `Timed tasks ↔ your "ClingNote" calendar${s.lastSyncMs ? ` · synced ${fmtAgo(s.lastSyncMs)}` : ''}` : 'Timed tasks go to a "ClingNote" calendar; edits there come back. Off by default.';
});
const onCalToggle = async (on) => { const u = auth.currentUser; if (!u) return; try { const r = await setCalendarSync(u.uid, on, { pro: userIsPro.value }); if (r && r.message) calSyncState.value = { ...calSyncState.value, message: r.message }; } catch (e) { calSyncState.value = { ...calSyncState.value, message: 'Calendar sync failed. Try again.' }; } };
const onIcsExport = async () => { const u = auth.currentUser; if (!u) return; calBusy.value = true; try { const r = await exportIcs(u.uid); calMsg.value = r.result === 'failed' ? 'Could not save the file.' : `Exported ${r.count} timed task${r.count === 1 ? '' : 's'}.`; } catch (e) { calMsg.value = 'Export failed.'; } calBusy.value = false; };
const onIcsImport = async (ev) => { const u = auth.currentUser; const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!u || !f) return; calBusy.value = true; try { const r = await importIcs(u.uid, await readTextFile(f), { pro: userIsPro.value }); calMsg.value = r.message; } catch (e) { calMsg.value = (e && e.message) || 'Import failed.'; } calBusy.value = false; };
const xferOpen = ref(false); const xferBusy = ref(false); const xferMsg = ref(''); const xferInput = ref(null);
const onExport = async (fmt) => { const u = auth.currentUser; if (!u) return; xferBusy.value = true; try { const r = await exportTasks(u.uid, fmt, { native: isNativeIOS() }); xferMsg.value = r.result === 'failed' ? 'Could not save the file.' : r.result === 'cancelled' ? '' : `Exported ${r.count} task${r.count === 1 ? '' : 's'} as ${fmt.toUpperCase()}.`; } catch (e) { xferMsg.value = 'Export failed.'; } xferBusy.value = false; };
const onImport = async (ev) => { const u = auth.currentUser; const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!u || !f) return; xferBusy.value = true; try { const r = await importTasks(u.uid, await readTextFile(f), { pro: userIsPro.value }); xferMsg.value = r.message; } catch (e) { xferMsg.value = (e && e.message) || 'Import failed.'; } xferBusy.value = false; };
import { doc, getDoc, setDoc, getDocs, collection, query, where, documentId } from 'firebase/firestore';
import StatsSheet from '@/components/profile/StatsSheet.vue';
import { buildStats, monthKeysFor, countsFromMonthly, gridStart } from '@/utils/statsView';
import { localDateStr } from '@/utils/streak';
import { useRouter } from 'vue-router';
import { auth, db } from '@/firebaseConfig';
const route = useRouter();

const userData = ref(null);
const editedUserData = ref(null);
const editMode = ref(false);
const isOwn = ref(false);
const otherStats = ref(null); // another user's streak + badges (communityProfiles/{uid})
onBeforeUnmount(() => { pageTitle.value = null; });
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
// B39 Stats sheet: read-only, own profile only. Heatmap from monthlyStats/{m}/private/{uid}.done (owner-only), streaks/{uid}.counted
// as a fallback, and dailyCheckins for optional mood dots. Missing/denied docs just count as empty.
const statsOpen = ref(false);
const statsLoading = ref(false);
const statsData = ref(null);
const openStats = async () => {
  statsOpen.value = true;
  const uid = auth.currentUser?.uid;
  if (!uid || statsLoading.value) return;
  statsLoading.value = true;
  try {
    const today = localDateStr();
    const safe = (pr) => withTimeout(pr, 8000, 'stats').catch(() => null);
    const months = await Promise.all(monthKeysFor(today).map((mk) => safe(getDoc(doc(db, 'monthlyStats', mk, 'private', uid)))));
    const st = await safe(getDoc(doc(db, 'streaks', uid)));
    const from = gridStart(today);
    const ck = await safe(getDocs(query(collection(db, 'users', uid, 'dailyCheckins'), where(documentId(), '>=', from))));
    const moods = {}; (ck?.docs || []).forEach((d) => { moods[d.id] = d.data()?.mood; });
    statsData.value = buildStats({ todayStr: today, counts: countsFromMonthly(months.map((m) => (m && m.exists() ? m.data() : null))), counted: st && st.exists() ? st.data().counted : [], moods });
  } catch (e) { statsData.value = null; } finally { statsLoading.value = false; }
};
const fileInput = ref(null);
const avatarBusy = ref(false);
const avatarMsg = ref('');
const avatarErr = ref(false);
const avFailed = ref(false);
const avatarSrc = computed(() => { const own = isOwn.value && myAvatar.uid === auth.currentUser?.uid && myAvatar.url; const v = userData.value ? userData.value.avatarURL : own; return isAvatarSrc(v) ? v : (isAvatarSrc(own) ? own : ''); });
watch(avatarSrc, () => { avFailed.value = false; });
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
  isOwn.value = own; otherStats.value = null; pageTitle.value = null;
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
  if (!own && userData.value) {
    pageTitle.value = { title: userData.value.name || 'Profile', kicker: 'Profile' };
    try { const cp = await withTimeout(getCommunityProfile(targetId), 8000, 'communityProfile'); const n = (v) => Math.max(0, Number(v) || 0);
      otherStats.value = { streak: n(cp?.streak), best: n(cp?.bestStreak ?? cp?.streak), badges: Array.isArray(cp?.badges) ? cp.badges : [] };
    } catch (e) { otherStats.value = { streak: 0, best: 0, badges: [] }; }
  }
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
onMounted(() => load().then(() => { if (route.currentRoute.value.query.delete === '1') setTimeout(() => { const el = document.getElementById('delete-account'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50); })); // ☰ menu "Delete Account" link lands on the delete section
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

// Day length preference (users/{uid}.dayLengthHours, localStorage fallback). Today's confirmed day never changes; this preselects the next morning.
const dayLen = ref(dayLengthHours());
const bumpDayLen = async (d) => { dayLen.value = await setDayLengthHours(dayLen.value + d); };
onMounted(() => { loadDayLengthHours().then((v) => { dayLen.value = v; }).catch(() => {}); });
</script>

<style scoped>
.pf { position: relative; min-height: 100%; color: var(--c-text); font-family: var(--font); padding-bottom: calc(env(safe-area-inset-bottom) + 32px); }
.pf-scene { position: absolute; z-index: 0; inset: 0 0 auto 0; height: 340px; pointer-events: none;
  background: linear-gradient(180deg, rgba(7,13,28,.2), rgba(7,13,28,0) 40%, var(--c-bg) 97%), var(--hero-img, url('~@/assets/hero-forest.jpg')) 72% 30% / cover no-repeat; }
.pf-wrap { position: relative; z-index: 1; max-width: 520px; margin: 0 auto; padding: 4px max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left)); }
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
.pf-av-cam { position: absolute; right: -6px; bottom: -6px; width: 44px; height: 44px; border-radius: 50%; background: #12203F; border: 1.5px solid var(--c-border-strong); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.pf svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
.pf-id-text { min-width: 0; }
.pf-name { margin: 0; font-size: 22px; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-email { margin: 2px 0 0; font-size: 14px; color: var(--c-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-chip { display: inline-flex; align-items: center; gap: 6px; margin: 8px 0 0; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--c-text-2); background: var(--c-surface-2); border: 1px solid var(--c-border-strong); }
.pf-chip--pro { color: #8FB6FF; background: var(--c-accent-soft); border-color: var(--c-accent-line); }
.pf-meta { margin: 12px 0 0; font-size: 13px; color: var(--c-text-3); }
.pf-id-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
.pf-links { display: flex; align-items: center; gap: 8px; }
.pf-link { background: none; border: 0; padding: 6px 0; min-height: 44px; font-size: 14px; color: var(--c-accent-text); cursor: pointer; }
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
.pf-dl { display: inline-flex; align-items: center; gap: 6px; } .pf-dl b { min-width: 48px; text-align: center; font-variant-numeric: tabular-nums; }
.pf-dl-btn { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: var(--c-text); font-size: 18px; }
.pf-dl-sub { display: block; font-size: 12px; font-weight: 500; color: var(--c-text-3, #9aa3b5); }
.pf-row-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--c-text); flex: 1; text-align: left; }
.pf-row-sub { margin: 2px 0 0; font-size: 13px; color: var(--c-text-2); }
.pf-pill-ok { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-size: 13px; color: var(--c-success); background: var(--c-success-soft); border: 1px solid rgba(61,220,151,.35); }
.pf-pill-ok i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pf-upgrade { display: block; margin: 4px 0 12px; min-height: 48px; line-height: 48px; text-align: center; border-radius: 14px; font-weight: 800; color: #fff; background: linear-gradient(90deg, #f59e0b, #ea580c); box-shadow: 0 6px 18px rgba(234,88,12,.3); }
.pf-time { min-height: 40px; margin-left: auto; padding: 0 8px; border-radius: 10px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: var(--c-text); font-size: 15px; flex: none; }
.pf-days { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.pf-day { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--c-border, #2a2a2e); background: transparent; color: var(--c-text); font-weight: 700; font-size: 13px; }
.pf-day--on { background: #4aa8ff; border-color: #4aa8ff; color: #06121f; }
.pf-wa-note { margin: 0 0 12px; font-size: 12px; color: var(--c-text-3, #9aa3b5); }
.pf-switch { width: 22px; height: 22px; margin-left: auto; accent-color: #4aa8ff; flex: none; }
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
.pf-badges { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px; margin-top: 12px; }
.pf-badge { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 12px; background: rgba(255,255,255,.04); text-align: center; }
.pf-badge span { font-size: 22px; } .pf-badge small { font-size: 10.5px; line-height: 1.2; color: var(--c-text-2, #A9B4CC); }
.pf-badge--off { opacity: .35; filter: grayscale(1); }
/* segmented controls + mini buttons for Appearance / Calendar / Export rows */
.pf-seg { display: flex; margin-top: 8px; padding: 3px; gap: 3px; border-radius: 12px; background: var(--c-surface-2); border: 1px solid var(--c-border); max-width: 100%; }
.pf-seg-btn { flex: 1 1 0; min-width: 0; min-height: 36px; padding: 0 6px; border: 0; border-radius: 9px; background: transparent; color: var(--c-text-2); font: 600 14px/1.1 var(--font); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-seg-btn--on { background: var(--c-accent); color: #fff; }
.pf-mini-btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.pf-mini { min-height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--c-border-strong); background: var(--c-surface-2); color: var(--c-text); font: 600 13px/1.1 var(--font); cursor: pointer; }
.pf-mini:disabled { opacity: .55; }
.pf-hidden-file { display: none; }
.pf-row--stack { align-items: flex-start; padding: 12px 0; } .pf-row--stack .pf-row-title { min-width: 0; }
.pf-xfer { padding: 0 0 12px 50px; }
.pf-chev { transition: transform .15s ease; } .pf-chev--open { transform: rotate(90deg); }
</style>
