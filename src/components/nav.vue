<template>
  <nav class="app-topbar">
    <!-- Header -->
    <div class="app-topbar-inner">
      <button @click="toggleSidebar" type="button" class="relative inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-600" aria-expanded="false">
        <span class="sr-only">Open sidebar</span>
        <span v-if="palBadge.count.value" class="pl-nav-dot" aria-label="New messages"></span>
        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1h15M1 7h15M1 13h15"/>
        </svg>
      </button>
      <!-- Display user's email and profile picture -->
      <router-link :to="userId ? '/profile/' + userId : '/login'" class="flex items-center space-x-3">

<!--        <div v-if="userEmail" class="text-gray-800 dark:text-gray-200">-->
<!--          {{ userEmail }}-->
<!--        </div>-->

          <div  v-if="userEmail" class="flex items-center space-x-3">
            <img
                v-if="avatarURL "
                :src="avatarURL"
                alt="Avatar"
                class="w-10 h-10 rounded-full border object-cover"
            />
            <span v-else class="app-avatar" :aria-label="'Profile ' + initials">{{ initials }}</span>
          </div>

      </router-link>
    </div>

    <!-- Sidebar -->
    <aside :class="{ 'hidden': !sidebarOpen, 'block': sidebarOpen }"
           class="app-sidebar fixed inset-y-0 left-0 z-50 w-64">
      <div class="flex items-center justify-between p-4">
        <router-link to="/" class="flex items-center space-x-3 rtl:space-x-reverse">
          <span class="flex items-center space-x-3 rtl:space-x-reverse">
            <img src="@/assets/logo.png" class="h-8" alt="Cling Note Logo"/>
            <span class="self-center text-xl font-semibold whitespace-nowrap">ClingNot</span>
          </span>
        </router-link>
        <button @click="closeSidebar" type="button"
                class="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none">
          <span class="sr-only">Close sidebar</span>
          <svg class="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"/>
          </svg>
        </button>
      </div>

      <!-- Sidebar content -->
      <nav class="px-3 py-4">
        <!-- User mode (your tasks) / Manager mode (people you manage). Any account can use both; last one is remembered. -->
        <div v-if="userId" class="mode-switch" role="group" aria-label="Mode" data-test="mode-switch">
          <button type="button" :class="{ on: mode === 'user' }" :aria-pressed="mode === 'user' ? 'true' : 'false'" @click="switchMode('user')">User mode</button>
          <button type="button" :class="{ on: mode === 'manager' }" :aria-pressed="mode === 'manager' ? 'true' : 'false'" @click="switchMode('manager')" data-test="mode-manager">Manager mode</button>
        </div>
        <ul class="app-sidebar-list">
          <!-- My Routine -->
          <li class="app-sidebar-item">
            <i class="fas fa-calendar-check"></i>
            <router-link to="/home"
                         class="app-sidebar-link">
              My Routine
            </router-link>
          </li>
          <li class="app-sidebar-item"><i class="fas fa-calendar-alt"></i><router-link to="/upcoming" class="app-sidebar-link">Upcoming</router-link></li>
          <li class="app-sidebar-item"><i class="fas fa-trophy"></i><router-link to="/rankings" class="app-sidebar-link">Rankings</router-link></li>
          <li v-if="userId" class="app-sidebar-item"><i class="fas fa-user-friends"></i><router-link to="/pals" class="app-sidebar-link" data-test="nav-pals">Manager &amp; Pals<span v-if="palBadge.count.value" class="pl-nav-badge">{{ palBadge.count.value }}</span></router-link></li>
          <li class="app-sidebar-item"><i class="fas fa-gavel"></i><router-link to="/discipline" class="app-sidebar-link">Discipline</router-link></li>



          <!-- Admin Only Routes -->
          <template v-if="userEmail === 'ds7513635@gmail.com'">
            <li class="app-sidebar-item">
              <i class="fas fa-info-circle"></i>
              <router-link to="/about"
                           class="app-sidebar-link">
                About
              </router-link>
            </li>
          </template>

          <!-- Addiction -->
          <li class="app-sidebar-item">
            <i class="fas fa-ban"></i>
            <router-link to="/addiction"
                         class="app-sidebar-link">
              Addiction
            </router-link>
          </li>

          <li class="app-sidebar-item">
            <i class="fas fa-user-shield"></i>
            <router-link to="/privacy-policy"
                         class="app-sidebar-link">
              Privacy Policy
            </router-link>
          </li>

          <!-- Logout -->
          <li class="app-sidebar-item">
            <i class="fas fa-sign-out-alt"></i>
            <button @click="logout"
                    class="app-sidebar-link">
              Logout
            </button>
          </li>

        </ul>
      </nav>
    </aside>
  </nav>
</template>

<script setup>
import { syncPublicProfile } from '@/composables/usePublicProfile';
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getMode, setMode, homeFor } from '@/utils/appMode';
import { auth, db } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { useManagerBadge } from '@/composables/usePals';

const router = useRouter();
const sidebarOpen = ref(false);
const userEmail = ref(null);
const userId = ref(null);
const palBadge = useManagerBadge();
const route = useRoute();
const mode = computed(() => (route.path === '/manage' || route.path.startsWith('/manage/') ? 'manager' : route.path === '/home' ? 'user' : getMode()));
const switchMode = (m) => { setMode(m); router.push(homeFor(m)); };
watch(userId, (u) => palBadge.watchUid(u));
const avatarURL = ref(null);
const displayName = ref('');
const initials = computed(() => { const src = (displayName.value || userEmail.value || 'U').replace(/@.*/, '').trim(); const parts = src.split(/[\s._-]+/).filter(Boolean); return ((parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')).toUpperCase(); }); // New: Avatar URL from Firestore

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
};

const closeSidebar = () => {
  sidebarOpen.value = false;
};

const logout = async () => {
  try {
    await auth.signOut();
    console.log('logged out');
    router.push('/login');
  } catch (error) {
    console.error('Error logging out:', error.message);
  }
};

// Responsive sidebar: open (and pushing the page) from 768px up, a closed overlay below; follows window resizes.
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 768px)') : null;
const onMq = (e) => { sidebarOpen.value = e.matches; };
const onEsc = (e) => { if (e.key === 'Escape' && !(mq && mq.matches)) sidebarOpen.value = false; };
watch(sidebarOpen, (open) => { document.body.classList.toggle('sidebar-open', open); }, { immediate: true });
watch(() => router.currentRoute.value.fullPath, () => { if (!(mq && mq.matches)) sidebarOpen.value = false; });
onBeforeUnmount(() => {
  if (mq) mq.removeEventListener('change', onMq);
  document.removeEventListener('keydown', onEsc);
  document.body.classList.remove('sidebar-open');
});

onMounted(() => {
  sidebarOpen.value = mq ? mq.matches : window.innerWidth >= 768;
  if (mq) mq.addEventListener('change', onMq);
  document.addEventListener('keydown', onEsc);
  window.addEventListener('clingnot:avatar', (e) => { avatarURL.value = (e && e.detail) || null; });

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      console.log("[AUTH] User logged in:", user.uid);
      userEmail.value = user.email;
      userId.value = user.uid;

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          avatarURL.value = userDocSnap.data().avatarURL || null;
          displayName.value = userDocSnap.data().name || userDocSnap.data().displayName || user.displayName || '';
          syncPublicProfile(user.uid, userDocSnap.data()).catch(() => {}); // others only ever read publicProfiles
        } else {
          console.warn("No user document found in Firestore.");
        }
      } catch (err) {
        console.error("Error fetching avatar:", err.message);
      }
    } else {
      console.log("[AUTH] User not logged in");
      userEmail.value = null;
      userId.value = null;
      avatarURL.value = null;
    }
  });
});
</script>


<style>
.pl-nav-badge { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; margin-left: 8px; border-radius: 999px; background: #F87171; color: #fff; font-size: 11px; font-weight: 800; }
.pl-nav-dot { position: absolute; top: 6px; right: 6px; width: 9px; height: 9px; border-radius: 50%; background: #F87171; box-shadow: 0 0 0 2px #070D1C; }
/* From 768px up the open sidebar pushes the page instead of covering it; below that it is an overlay. */
@media (min-width: 768px) {
  body.sidebar-open #app { padding-left: 16rem; }
}
/* Shared shell: slim dark top bar + dark sidebar matching the home view palette */
.app-topbar { background: #070D1C; border-bottom: 1px solid #121C33; padding-top: env(safe-area-inset-top); }
.app-topbar-inner { max-width: 1200px; margin: 0 auto; height: 56px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; }
.app-topbar-inner > a { margin-left: auto; }
.app-avatar { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 700; letter-spacing: .02em; color: #fff; background: rgba(12,22,48,.7); border: 1.5px solid #3D6FD8; }
.app-sidebar { background: #0A1226; border-right: 1px solid #16223F; color: #E6E9EF; }
.app-sidebar-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.app-sidebar-item { position: relative; display: flex; align-items: center; gap: 12px; padding: 0 12px; height: 40px; border-radius: 10px; color: #8791A5; }
.app-sidebar-item:hover { background: #1A1E28; color: #E6E9EF; }
.app-sidebar-item i { width: 18px; text-align: center; }
.app-sidebar-link { color: #B4BCCB; font-weight: 500; font-size: 14px; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: none; }
.app-sidebar-link::after { content: ''; position: absolute; inset: 0; } /* whole row is clickable */
.app-sidebar-item:hover .app-sidebar-link, .app-sidebar-link.router-link-exact-active { color: #fff; }
.app-sidebar-item:has(.router-link-exact-active) { background: #19224A; color: #8FA8FF; }
.mode-switch { display: flex; gap: 4px; margin: 4px 12px 12px; padding: 4px; background: #0C1630; border: 1px solid #1A2846; border-radius: 12px; }
.mode-switch button { flex: 1; min-height: 34px; border: 0; border-radius: 9px; background: transparent; color: #A9B4CC; font-weight: 600; font-size: 13px; }
.mode-switch button.on { background: #12203F; color: #F2F5FC; }
</style>
