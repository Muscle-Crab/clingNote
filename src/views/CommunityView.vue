<template>
  <div class="cm-page" data-test="community">
    <!-- EULA / community rules gate (App Store 1.2): must accept before any content is shown -->
    <section v-if="ready && !eulaOk" class="cm-card cm-eula" data-test="cm-eula">
      <h2>Welcome to the ClingNote Community</h2>
      <p>Before you join, please agree to our community terms:</p>
      <ul>
        <li><strong>Zero tolerance</strong> for objectionable content or abusive users: no harassment, hate, sexual content, violence, spam or illegal content.</li>
        <li>Offensive language is filtered automatically.</li>
        <li>You can <strong>report</strong> any post, comment, message or user, and <strong>block</strong> users to hide their content.</li>
        <li>Reported content is reviewed within 24 hours; offending content is removed and its author may be banned.</li>
        <li>Never share personal contact details. Your email is never shown.</li>
      </ul>
      <label class="cm-check"><input type="checkbox" v-model="eulaTick" data-test="cm-eula-check" /> I agree to the <router-link to="/terms">Terms &amp; Conditions (EULA)</router-link> and these community rules.</label>
      <button class="cm-btn" :disabled="!eulaTick || busy" @click="acceptEula" data-test="cm-eula-accept">Agree &amp; enter</button>
    </section>

    <template v-else-if="ready">
      <header class="cm-head">
        <div class="cm-tabs" role="tablist">
          <button role="tab" :class="{ on: tab === 'feed' }" @click="tab = 'feed'" data-test="cm-tab-feed">Feed</button>
          <button role="tab" :class="{ on: tab === 'chat' }" @click="openChat" data-test="cm-tab-chat">Chat</button>
        </div>
        <button class="cm-bell" @click="showNotifs = !showNotifs" aria-label="Notifications" data-test="cm-bell">🔔<span v-if="unread" class="cm-badge">{{ unread > 99 ? '99+' : unread }}</span></button>
        <button v-if="isAdmin" class="cm-chip" @click="adminMode = !adminMode" data-test="cm-admin">{{ adminMode ? 'Admin: on' : 'Admin' }}</button>
      </header>
      <p v-if="error" class="cm-error" role="alert">{{ error }}</p>
      <p v-if="toast" class="cm-toast" role="status">{{ toast }}</p>

      <!-- Notifications inbox -->
      <section v-if="showNotifs" class="cm-card cm-notifs" data-test="cm-notifs">
        <div class="cm-row"><strong>Notifications</strong><span class="cm-sp"></span><button class="cm-link" @click="readAll">Mark all read</button><button class="cm-link" @click="showPrefs = !showPrefs">Settings</button></div>
        <div v-if="showPrefs" class="cm-prefs">
          <label v-for="t in NOTIF_TYPES" :key="t" class="cm-check"><input type="checkbox" :checked="notifPrefs[t] !== false" @change="setPref(t, $event.target.checked)" /> {{ PREF_LABEL[t] }}</label>
        </div>
        <p v-if="!shownNotifs.length" class="cm-muted">Nothing yet.</p>
        <button v-for="n in shownNotifs" :key="n.id" class="cm-notif" :class="{ unread: !n.read }" @click="openNotif(n)">{{ NOTIF_ICON[n.type] }} {{ n.text }} <span class="cm-muted">· {{ ago(n.createdAt) }}</span></button>
      </section>

      <!-- ── FEED ── -->
      <template v-if="tab === 'feed'">
        <section class="cm-card cm-composer" data-test="cm-composer">
          <button class="cm-quick" @click="quickFill" :disabled="busy" data-test="cm-quickfill">📈 Share today's progress</button>
          <textarea v-model="draft.text" class="cm-input" rows="3" :maxlength="LIMITS.text" placeholder="What did you get done today?" data-test="cm-post-text"></textarea>
          <div v-if="draft.stats" class="cm-stats cm-stats--draft"><StatsRow :s="draft.stats" /><button class="cm-x" @click="draft.stats = null" aria-label="Remove stats">✕</button></div>
          <div v-if="draft.previews.length" class="cm-thumbs"><div v-for="(p, i) in draft.previews" :key="p" class="cm-thumb"><img :src="p" alt="" /><button class="cm-x" @click="removeImage(i)" aria-label="Remove image">✕</button></div></div>
          <div class="cm-row">
            <label class="cm-chip" :class="{ off: draft.files.length >= LIMITS.images }">📷 Photo<input type="file" accept="image/*" multiple hidden @change="pickPostImages" :disabled="draft.files.length >= LIMITS.images" /></label>
            <button class="cm-chip" v-if="!draft.stats" @click="attachStats">📊 Stats card</button>
            <span class="cm-sp"></span>
            <button class="cm-btn" :disabled="busy" @click="submitPost" data-test="cm-post-submit">{{ busy ? 'Posting…' : 'Post' }}</button>
          </div>
        </section>

        <div class="cm-filters">
          <button :class="{ on: sort === 'new' }" @click="sort = 'new'">Newest</button>
          <button :class="{ on: sort === 'liked' }" @click="sort = 'liked'">Most liked today</button>
          <button :class="{ on: onlyFollowing }" @click="onlyFollowing = !onlyFollowing" data-test="cm-following">Following</button>
        </div>

        <p v-if="!feed.length && feedLoaded" class="cm-muted cm-empty">{{ onlyFollowing ? 'No posts from people you follow yet.' : 'No posts yet. Be the first to share your progress!' }}</p>
        <article v-for="p in feed" :key="p.id" :id="'post-' + p.id" class="cm-card cm-post" :class="{ hl: p.id === highlight }" data-test="cm-post">
          <div class="cm-row">
            <button class="cm-author" @click="openProfile(p)"><Avatar :name="p.name" :src="p.avatar" /><span><strong>{{ nameOf(p.name) }}</strong><AuthorFlair :p="cprof[p.uid]" /><span class="cm-muted"> · {{ ago(p.createdAt) }}</span></span></button>
            <span class="cm-sp"></span>
            <button v-if="p.uid !== uid" class="cm-follow" :class="{ on: following.has(p.uid) }" @click="toggleFollow(p.uid, p.name)">{{ following.has(p.uid) ? 'Following' : 'Follow' }}</button>
            <button class="cm-more" @click="menuFor = { kind: 'post', item: p }" aria-label="More">⋯</button>
          </div>
          <h3 v-if="p.title" class="cm-title">{{ p.title }}</h3>
          <p v-if="p.text" class="cm-text">{{ p.text }}</p>
          <div v-if="p.stats" class="cm-stats"><StatsRow :s="p.stats" /></div>
          <div v-if="p.images && p.images.length" class="cm-gallery" :class="'n' + p.images.length"><img v-for="u in p.images" :key="u" :src="u" alt="Post image" loading="lazy" /></div>
          <div class="cm-actions">
            <button class="cm-heart" :class="{ on: liked[p.id], pop: popping === p.id }" @click="like(p)" :aria-pressed="liked[p.id] ? 'true' : 'false'" aria-label="Like" data-test="cm-like"><span class="h">{{ liked[p.id] ? '❤️' : '🤍' }}</span> {{ p.likeCount || 0 }}</button>
            <button @click="toggleComments(p)">💬 {{ p.commentCount || 0 }}</button>
            <button @click="share(p)">↗ Share</button>
            <button @click="copyLink(p)">🔗 Copy link</button>
          </div>
          <div v-if="openComments === p.id" class="cm-comments">
            <div v-for="c in shownComments" :key="c.id" class="cm-comment">
              <Avatar :name="c.name" :src="c.avatar" small /><div class="cm-cbody"><strong>{{ nameOf(c.name) }}</strong><AuthorFlair :p="cprof[c.uid]" /> {{ c.text }} <span class="cm-muted">· {{ ago(c.createdAt) }}</span></div>
              <button class="cm-more" @click="menuFor = { kind: 'comment', item: c, post: p }" aria-label="More">⋯</button>
            </div>
            <form class="cm-row" @submit.prevent="submitComment(p)"><input v-model="commentText" class="cm-input" :maxlength="LIMITS.comment" placeholder="Add a comment" /><button class="cm-btn" :disabled="busy">Send</button></form>
          </div>
        </article>
        <button v-if="feedCursor && !onlyFollowing" class="cm-more-btn" @click="loadMorePosts">Load more</button>
      </template>

      <!-- ── CHAT ── -->
      <section v-else class="cm-card cm-chat" data-test="cm-chat">
        <button v-if="chatCursor" class="cm-more-btn" @click="loadOlderChat">Load older messages</button>
        <div ref="chatBox" class="cm-chatlist">
          <div v-for="m in chat" :key="m.id" class="cm-msg" :class="{ mine: m.uid === uid }" @contextmenu.prevent="menuFor = { kind: 'chat', item: m }" @touchstart="pressStart(m)" @touchend="pressEnd" @touchmove="pressEnd">
            <Avatar v-if="m.uid !== uid" :name="m.name" :src="m.avatar" small @click="openProfile(m)" />
            <div class="cm-bubble">
              <div v-if="m.uid !== uid" class="cm-mname">{{ nameOf(m.name) }}</div>
              <img v-if="m.image" :src="m.image" alt="Shared image" class="cm-mimg" loading="lazy" />
              <div v-if="m.text">{{ m.text }}</div>
              <div class="cm-mtime">{{ ago(m.createdAt) }} <button class="cm-more" @click="menuFor = { kind: 'chat', item: m }" aria-label="More">⋯</button></div>
            </div>
          </div>
          <p v-if="!chat.length" class="cm-muted cm-empty">Say hi to everyone 👋</p>
        </div>
        <form class="cm-chatbar" @submit.prevent="submitChat">
          <label class="cm-chip" aria-label="Send a photo">📷<input type="file" accept="image/*" hidden @change="sendChatImage" /></label>
          <input v-model="chatText" class="cm-input" :maxlength="LIMITS.chat" placeholder="Message everyone" data-test="cm-chat-input" />
          <button class="cm-btn" :disabled="busy">Send</button>
        </form>
      </section>
    </template>

    <!-- Action sheet: report / block / hide / delete -->
    <div v-if="menuFor" class="cm-sheet-bg" @click.self="menuFor = null">
      <div class="cm-sheet" data-test="cm-sheet">
        <button v-if="canDelete(menuFor.item)" class="danger" @click="removeItem">🗑 Delete{{ menuFor.item.uid !== uid ? ' (admin)' : '' }}</button>
        <template v-if="menuFor.item.uid !== uid">
          <button @click="startReport(menuFor.kind)">🚩 Report {{ KIND_LABEL[menuFor.kind] }}</button>
          <button @click="startReport('user')">🚩 Report user</button>
          <button v-if="menuFor.kind === 'post'" @click="hidePost(menuFor.item)">🙈 Hide this post</button>
          <button class="danger" @click="doBlock(menuFor.item.uid, menuFor.item.name)">⛔ Block {{ nameOf(menuFor.item.name) }}</button>
        </template>
        <button @click="menuFor = null">Cancel</button>
      </div>
    </div>
    <div v-if="reporting" class="cm-sheet-bg" @click.self="reporting = null">
      <form class="cm-sheet" @submit.prevent="sendReport" data-test="cm-report">
        <strong>Report {{ KIND_LABEL[reporting.targetType] }}</strong>
        <label v-for="r in REASONS" :key="r" class="cm-check"><input type="radio" :value="r" v-model="reportReason" /> {{ r }}</label>
        <button class="cm-btn" :disabled="!reportReason">Send report</button>
        <button type="button" @click="reporting = null">Cancel</button>
      </form>
    </div>
    <!-- Mini profile -->
    <div v-if="profile" class="cm-sheet-bg" @click.self="profile = null">
      <div class="cm-sheet cm-profile" data-test="cm-profile">
        <Avatar :name="profile.name" :src="profile.avatar" big />
        <strong>{{ nameOf(profile.name) }}</strong>
        <div class="cm-pstreak" data-test="cm-profile-streak">🔥 <b>{{ (cprof[profile.uid] || {}).streak || 0 }}</b>-day streak <span class="cm-muted">· best {{ (cprof[profile.uid] || {}).bestStreak || 0 }}</span></div>
        <div class="cm-badgegrid" data-test="cm-badges">
          <div v-for="b in BADGES" :key="b.id" class="cm-badge" :class="{ off: !((cprof[profile.uid] || {}).badges || []).includes(b.id) }" :title="b.desc"><span>{{ b.icon }}</span><small>{{ b.name }}</small></div>
        </div>
        <div class="cm-muted"><b>{{ profile.counts.followers }}</b> followers · <b>{{ profile.counts.following }}</b> following</div>
        <template v-if="profile.uid !== uid">
          <button class="cm-btn" @click="toggleFollow(profile.uid, profile.name)">{{ following.has(profile.uid) ? 'Unfollow' : 'Follow' }}</button>
          <button @click="menuFor = { kind: 'user', item: { uid: profile.uid, name: profile.name, id: profile.uid } }; profile = null">More…</button>
        </template>
        <button @click="profile = null">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch, h } from 'vue';
import { useRoute } from 'vue-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { getPublicProfile } from '@/composables/usePublicProfile';
import * as C from '@/composables/useCommunity';
import { BADGES, topBadges, badgeInfo } from '@/utils/badges';
import { LIMITS, EULA_VERSION, NOTIF_TYPES, DEFAULT_NOTIF_PREFS, validateText, displayNameOf, safeAvatar, progressText, filterBlocked, sortFeed, filterFollowing, chatOrder, mergeById, toggleLikeState, createRateLimiter, postLink, shareTextFor, visibleNotifs, unreadCount, isAdminEmail, tsMs } from '@/utils/community';
import { timeAgo } from '@/utils/pals';
import { isNative } from '@/utils/platform';
import { initialsOf } from '@/utils/avatar';

const Avatar = (props, { attrs }) => props.src ? h('img', { src: props.src, alt: '', class: ['cm-av', props.small && 'sm', props.big && 'big'], ...attrs }) : h('span', { class: ['cm-av', 'cm-av--i', props.small && 'sm', props.big && 'big'], ...attrs }, initialsOf(displayNameOf(props.name)));
Avatar.props = ['name', 'src', 'small', 'big'];
const SR_ROW = 'display:grid;grid-template-columns:repeat(4,1fr);text-align:center;gap:4px;align-items:start';
const SR_B = 'display:block;font-size:1.05rem;line-height:1.25;font-weight:700';
const SR_S = 'display:block;font-size:.7rem;opacity:.85;line-height:1.2';
const stat = (v, l) => h('div', [h('b', { style: SR_B }, v), h('small', { style: SR_S }, l)]);
const statBadges = (s) => topBadges(s.badges, 3).map(badgeInfo);
const StatsRow = (props) => h('div', [h('div', { class: 'cm-statsrow', style: SR_ROW }, [
  stat(props.s.tasksDone, 'tasks done'), stat(props.s.points, 'points'),
  stat(`${props.s.streak}🔥`, 'day streak'), stat(`${props.s.icon || ''} ${props.s.milestone}`, 'milestone'),
]), statBadges(props.s).length ? h('div', { style: 'margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center' }, statBadges(props.s).map((b) => h('span', { style: 'background:rgba(255,255,255,.2);border-radius:999px;padding:2px 9px;font-size:.75rem;font-weight:600' }, `${b.icon} ${b.name}`))) : null]);
StatsRow.props = ['s'];
// Streak flame + top badges next to a name (from communityProfiles/{uid}).
const AuthorFlair = (props) => { const p = props.p; if (!p) return null; const b = topBadges(p.badges, 3).map(badgeInfo);
  if (!(p.streak > 0) && !b.length) return null;
  return h('span', { class: 'cm-flair', style: 'margin-left:6px;font-size:.78rem;white-space:nowrap' }, [p.streak > 0 ? h('span', { style: 'color:#f59e0b;font-weight:700' }, `🔥${p.streak}`) : null, ...b.map((x) => h('span', { title: x.name, style: 'margin-left:3px' }, x.icon))]); };
AuthorFlair.props = ['p'];
const cprof = reactive({}); const cprofAt = {};
async function loadCProf(uids, force = false) {
  const todo = [...new Set(uids)].filter((u) => u && (force || !cprofAt[u] || Date.now() - cprofAt[u] > 5 * 60000));
  todo.forEach((u) => { cprofAt[u] = Date.now(); });
  await Promise.all(todo.map(async (u) => { try { const p = await C.getCommunityProfile(u); if (p) cprof[u] = p; } catch (e) { /* rules not deployed */ } }));
}

const KIND_LABEL = { post: 'post', comment: 'comment', chat: 'message', user: 'user' };
const REASONS = ['Spam', 'Harassment or bullying', 'Hate speech', 'Sexual or violent content', 'Something else objectionable'];
const PREF_LABEL = { follow: 'New followers', like: 'Likes on my posts', comment: 'Comments on my posts', share: 'Shares of my posts', post: 'New posts from people I follow' };
const NOTIF_ICON = { follow: '👤', like: '❤️', comment: '💬', share: '↗', post: '📝' };

const route = useRoute();
const ready = ref(false); const eulaOk = ref(false); const eulaTick = ref(false);
const uid = ref(''); const me = reactive({ uid: '', name: '', avatar: '' }); const isAdmin = ref(false); const adminMode = ref(false);
const tab = ref(route.query.tab === 'chat' ? 'chat' : 'feed');
const busy = ref(false); const error = ref(''); const toast = ref('');
const blocked = ref(new Set()); const following = ref(new Set());
const hidden = ref(new Set(JSON.parse(localStorage.getItem('cm.hidden') || '[]')));
const posts = ref([]); const morePostsList = ref([]); const feedCursor = ref(null); const feedLoaded = ref(false);
const sort = ref('new'); const onlyFollowing = ref(false); const liked = reactive({}); const popping = ref(''); const highlight = ref(route.query.post || '');
const openComments = ref(''); const comments = ref([]); const commentText = ref('');
const chatLive = ref([]); const chatOlder = ref([]); const chatCursor = ref(null); const chatText = ref(''); const chatBox = ref(null);
const notifs = ref([]); const showNotifs = ref(false); const showPrefs = ref(false); const notifPrefs = reactive({ ...DEFAULT_NOTIF_PREFS });
const menuFor = ref(null); const reporting = ref(null); const reportReason = ref(''); const profile = ref(null);
const draft = reactive({ text: '', stats: null, files: [], previews: [] });
const limiter = createRateLimiter(undefined, { load: () => { try { return JSON.parse(localStorage.getItem('cm.rate') || '{}'); } catch (e) { return {}; } }, save: (x) => localStorage.setItem('cm.rate', JSON.stringify(x)) });
const unsubs = [];

const nameOf = displayNameOf;
const ago = (v) => timeAgo(tsMs(v)) || 'now';
const flash = (m) => { toast.value = m; setTimeout(() => { if (toast.value === m) toast.value = ''; }, 2500); };
const fail = (e, m) => { console.warn(e); error.value = m || 'Something went wrong. Please try again.'; setTimeout(() => (error.value = ''), 4000); };
const gate = (action) => { const r = limiter.check(action); if (!r.ok) { error.value = r.error; setTimeout(() => (error.value = ''), 3000); return false; } return true; };

const feed = computed(() => {
  let list = filterBlocked(mergeById(posts.value, morePostsList.value), blocked.value).filter((p) => !hidden.value.has(p.id));
  if (onlyFollowing.value) list = filterFollowing(list, following.value, uid.value);
  return sortFeed(list, sort.value);
});
const chat = computed(() => chatOrder(filterBlocked(mergeById(chatOlder.value, chatLive.value), blocked.value)));
const shownComments = computed(() => filterBlocked(comments.value, blocked.value));
watch(() => [...feed.value.map((p) => p.uid), ...comments.value.map((c) => c.uid)], (u) => loadCProf(u));
const shownNotifs = computed(() => visibleNotifs(notifs.value, blocked.value, notifPrefs));
const unread = computed(() => unreadCount(shownNotifs.value));
const canDelete = (it) => it && (it.uid === uid.value || isAdmin.value);

// ── boot
let stopAuth = null;
onMounted(() => { stopAuth = onAuthStateChanged(auth, async (u) => { if (!u) return; await boot(u); }); });
onBeforeUnmount(() => { unsubs.forEach((f) => f && f()); if (stopAuth) stopAuth(); });
async function boot(u) {
  uid.value = u.uid; me.uid = u.uid; isAdmin.value = isAdminEmail(u.email) && u.emailVerified !== false;
  try { const p = await getPublicProfile(u.uid); me.name = displayNameOf((p && p.name) || u.displayName); me.avatar = safeAvatar((p && p.avatarURL) || u.photoURL); } catch (e) { me.name = displayNameOf(u.displayName); }
  let prefs = {};
  try { prefs = await C.loadPrefs(u.uid); } catch (e) { /* rules not deployed yet */ }
  eulaOk.value = Number(prefs.eulaVersion) >= EULA_VERSION || localStorage.getItem(`cm.eula.${u.uid}`) === String(EULA_VERSION);
  Object.assign(notifPrefs, prefs.notif || {});
  ready.value = true;
  if (eulaOk.value) start();
}
async function acceptEula() {
  busy.value = true; localStorage.setItem(`cm.eula.${uid.value}`, String(EULA_VERSION)); eulaOk.value = true;
  try { await C.savePrefs(uid.value, { eulaVersion: EULA_VERSION, eulaAcceptedAt: new Date().toISOString() }); } catch (e) { console.warn(e); }
  busy.value = false; start();
}
let started = false; let firstNotifs = true; const seenNotif = new Set();
async function start() {
  if (started) return; started = true;
  try { blocked.value = await C.loadBlocks(uid.value); } catch (e) { /* ignore */ }
  try { following.value = await C.myFollowing(uid.value); } catch (e) { /* ignore */ }
  unsubs.push(C.watchFeed((items, cur, err) => { feedLoaded.value = true; if (err) return fail(err, 'Community is not available yet.'); posts.value = items; if (!morePostsList.value.length) feedCursor.value = items.length >= C.PAGE ? cur : null; loadLikes(items); }));
  unsubs.push(C.watchNotifs(uid.value, onNotifs));
  if (tab.value === 'chat') openChat();
  if (highlight.value) focusPost(highlight.value);
}
async function loadLikes(items) { for (const p of items) if (!(p.id in liked)) { liked[p.id] = false; C.myLike(p.id, uid.value).then((v) => { liked[p.id] = v; }).catch(() => {}); } }
async function loadMorePosts() { try { const r = await C.morePosts(feedCursor.value); morePostsList.value = [...morePostsList.value, ...r.items]; feedCursor.value = r.items.length >= C.PAGE ? r.cursor : null; loadLikes(r.items); } catch (e) { fail(e); } }
async function focusPost(id) {
  if (!posts.value.find((p) => p.id === id)) { try { const p = await C.getPost(id); if (p) morePostsList.value = [...morePostsList.value, p]; } catch (e) { /* ignore */ } }
  await nextTick(); const el = document.getElementById('post-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── composer
async function attachStats() { try { draft.stats = await C.loadTodayStats(uid.value); } catch (e) { fail(e, 'Could not load today\'s stats.'); } }
async function quickFill() { await attachStats(); if (draft.stats) { if (!draft.text) draft.text = progressText(draft.stats); } }
function pickPostImages(e) {
  const files = [...(e.target.files || [])].filter((f) => /^image\//.test(f.type)); e.target.value = '';
  for (const f of files.slice(0, LIMITS.images - draft.files.length)) { draft.files.push(f); draft.previews.push(URL.createObjectURL(f)); }
}
function removeImage(i) { URL.revokeObjectURL(draft.previews[i]); draft.files.splice(i, 1); draft.previews.splice(i, 1); }
async function submitPost() {
  const x = validateText(draft.text, LIMITS.text, { allowEmpty: false }); if (!x.ok) return (error.value = x.error);
  if (!gate('post')) return;
  busy.value = true; error.value = '';
  try {
    const images = []; for (const f of draft.files) images.push(await C.uploadImage(uid.value, f));
    const id = await C.createPost(me, { text: x.text, images, stats: draft.stats });
    limiter.hit('post');
    draft.files.forEach((_, i) => URL.revokeObjectURL(draft.previews[i])); Object.assign(draft, { text: '', stats: null, files: [], previews: [] });
    flash('Posted 🎉');
    C.notifyFollowers(me, id, x.text).catch(() => {});
  } catch (e) { fail(e, 'Could not post. Please try again.'); } finally { busy.value = false; }
}

// ── likes / comments / share
async function like(p) {
  const was = !!liked[p.id]; const next = toggleLikeState(p, was); liked[p.id] = next.liked; p.likeCount = next.likeCount;
  if (next.liked) { popping.value = p.id; setTimeout(() => { if (popping.value === p.id) popping.value = ''; }, 400); }
  try { const now = await C.toggleLike(p.id, uid.value); liked[p.id] = now; if (now && !was) C.notify({ type: 'like', from: uid.value, fromName: me.name, to: p.uid, postId: p.id }); } catch (e) { liked[p.id] = was; fail(e, 'Could not update like.'); }
}
let stopComments = null;
function toggleComments(p) {
  if (stopComments) { stopComments(); stopComments = null; }
  if (openComments.value === p.id) { openComments.value = ''; return; }
  openComments.value = p.id; comments.value = []; stopComments = C.watchComments(p.id, (c) => { comments.value = c; }); unsubs.push(() => stopComments && stopComments());
}
async function submitComment(p) {
  const v = validateText(commentText.value, LIMITS.comment); if (!v.ok) return (error.value = v.error);
  if (!gate('comment')) return;
  busy.value = true;
  try { await C.addComment(p.id, me, v.text); limiter.hit('comment'); commentText.value = ''; C.notify({ type: 'comment', from: uid.value, fromName: me.name, to: p.uid, postId: p.id, extra: v.text }); } catch (e) { fail(e, 'Could not comment.'); } finally { busy.value = false; }
}
async function share(p) {
  const url = postLink(p.id); const text = shareTextFor(p); let done = false;
  // navigator.share opens the native iOS share sheet inside the Capacitor WKWebView (iOS 15+); @capacitor/share is not installed.
  if (!done && navigator.share) { try { await navigator.share({ title: 'ClingNote', text, url }); done = true; } catch (e) { if (e && e.name === 'AbortError') return; } }
  if (!done) { await copyLink(p); return; }
  C.notify({ type: 'share', from: uid.value, fromName: me.name, to: p.uid, postId: p.id });
}
async function copyLink(p) { try { await navigator.clipboard.writeText(postLink(p.id)); flash('Link copied'); } catch (e) { flash(postLink(p.id)); } }

// ── chat
function openChat() {
  tab.value = 'chat';
  if (unsubs.chat) return;
  unsubs.chat = C.watchChat((items, cur, err) => { if (err) return fail(err, 'Chat is not available yet.'); const atBottom = isAtBottom(); chatLive.value = items; if (!chatOlder.value.length) chatCursor.value = items.length >= 30 ? cur : null; if (atBottom) scrollBottom(); });
  unsubs.push(unsubs.chat);
}
const isAtBottom = () => { const el = chatBox.value; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
const scrollBottom = () => nextTick(() => { const el = chatBox.value; if (el) el.scrollTop = el.scrollHeight; });
async function loadOlderChat() { try { const r = await C.moreChat(chatCursor.value); chatOlder.value = [...chatOlder.value, ...r.items]; chatCursor.value = r.items.length >= 30 ? r.cursor : null; } catch (e) { fail(e); } }
async function submitChat() {
  const v = validateText(chatText.value, LIMITS.chat); if (!v.ok) return (error.value = v.error);
  if (!gate('chat')) return;
  busy.value = true; try { await C.sendChat(me, { text: v.text }); limiter.hit('chat'); chatText.value = ''; scrollBottom(); } catch (e) { fail(e, 'Could not send.'); } finally { busy.value = false; }
}
async function sendChatImage(e) {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f || !gate('chat')) return;
  busy.value = true; try { const url = await C.uploadImage(uid.value, f); await C.sendChat(me, { image: url }); limiter.hit('chat'); scrollBottom(); } catch (err) { fail(err, 'Could not send the photo.'); } finally { busy.value = false; }
}
let pressTimer = null;
const pressStart = (m) => { pressTimer = setTimeout(() => { menuFor.value = { kind: 'chat', item: m }; }, 550); };
const pressEnd = () => clearTimeout(pressTimer);

// ── moderation
async function removeItem() {
  const { kind, item, post } = menuFor.value; menuFor.value = null;
  if (!confirm('Delete this ' + KIND_LABEL[kind] + '?')) return;
  try {
    if (kind === 'post') { await C.deletePost(item.id); morePostsList.value = morePostsList.value.filter((p) => p.id !== item.id); }
    else if (kind === 'comment') await C.deleteComment(post.id, item.id);
    else if (kind === 'chat') { await C.deleteChat(item.id); chatOlder.value = chatOlder.value.filter((m) => m.id !== item.id); }
    flash('Deleted');
  } catch (e) { fail(e, 'Could not delete.'); }
}
function startReport(targetType) { const { item, post } = menuFor.value; reporting.value = { targetType, targetId: targetType === 'user' ? item.uid : item.id, targetUid: item.uid, postId: post ? post.id : '' }; reportReason.value = ''; menuFor.value = null; }
async function sendReport() {
  if (!gate('report')) return;
  try { await C.report(me, { ...reporting.value, reason: reportReason.value }); limiter.hit('report'); flash('Thanks. Our team reviews reports within 24 hours.'); } catch (e) { fail(e, 'Could not send the report.'); }
  reporting.value = null;
}
function hidePost(p) { hidden.value = new Set([...hidden.value, p.id]); localStorage.setItem('cm.hidden', JSON.stringify([...hidden.value].slice(-500))); menuFor.value = null; flash('Post hidden'); }
async function doBlock(other, name) {
  menuFor.value = null;
  if (!confirm(`Block ${displayNameOf(name)}? You will no longer see their posts, comments or messages, and they can't notify you.`)) return;
  blocked.value = new Set([...blocked.value, other]);
  try { await C.block(uid.value, other); if (following.value.has(other)) await toggleFollow(other, name); flash('User blocked'); } catch (e) { fail(e, 'Could not block.'); }
}

// ── follows / profile
async function toggleFollow(other, name) {
  const on = following.value.has(other); const next = new Set(following.value); if (on) next.delete(other); else next.add(other); following.value = next;
  try { if (on) await C.unfollow(uid.value, other); else { await C.follow(uid.value, other); C.notify({ type: 'follow', from: uid.value, fromName: me.name, to: other }); } if (profile.value && profile.value.uid === other) profile.value.counts.followers += on ? -1 : 1; } catch (e) { following.value = new Set(on ? [...next, other] : [...next].filter((u) => u !== other)); fail(e, 'Could not update follow.'); }
}
async function openProfile(item) {
  profile.value = { uid: item.uid, name: item.name, avatar: item.avatar, counts: { followers: 0, following: 0 } };
  loadCProf([item.uid], true);
  try { profile.value.counts = await C.followCounts(item.uid); } catch (e) { /* ignore */ }
}

// ── notifications (inbox + foreground device alert)
async function onNotifs(list) {
  const fresh = visibleNotifs(list, blocked.value, notifPrefs).filter((n) => !n.read && !seenNotif.has(n.id));
  list.forEach((n) => seenNotif.add(n.id)); notifs.value = list;
  if (firstNotifs) { firstNotifs = false; return; }
  if (!fresh.length || !isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const p = await LocalNotifications.checkPermissions(); if (p.display !== 'granted') return;
    await LocalNotifications.schedule({ notifications: fresh.slice(0, 3).map((n, i) => ({ id: (Date.now() % 100000000) + i, title: 'ClingNote Community', body: n.text, extra: { route: n.postId ? `/community?post=${n.postId}` : '/community', type: 'community' } })) });
  } catch (e) { /* ignore */ }
}
async function openNotif(n) { showNotifs.value = false; if (!n.read) C.markRead(uid.value, n.id).catch(() => {}); if (n.postId) { tab.value = 'feed'; highlight.value = n.postId; focusPost(n.postId); } else if (n.type === 'follow') openProfile({ uid: n.from, name: n.fromName }); }
async function readAll() { try { await C.markAllRead(uid.value, notifs.value); } catch (e) { fail(e); } }
async function setPref(t, v) { notifPrefs[t] = v; try { await C.savePrefs(uid.value, { notif: { ...notifPrefs } }); } catch (e) { fail(e); } }
watch(() => route.query.post, (id) => { if (id && started) { tab.value = 'feed'; highlight.value = id; focusPost(id); } });
</script>

<style scoped>
.cm-page { max-width: 640px; margin: 0 auto; padding: 12px 14px 96px; }
.cm-card { margin-top: 12px; padding: 14px; border-radius: 14px; background: var(--c-surface, #fff); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.cm-head { display: flex; align-items: center; gap: 8px; }
.cm-tabs { display: flex; flex: 1; background: var(--c-border, #e2e8f0); border-radius: 999px; padding: 3px; }
.cm-tabs button { flex: 1; padding: 7px 0; border-radius: 999px; font-weight: 600; color: var(--c-text-3, #64748b); }
.cm-tabs button.on { background: var(--c-surface, #fff); color: var(--c-primary, #6366f1); box-shadow: 0 1px 2px rgba(0,0,0,.1); }
.cm-bell { position: relative; font-size: 1.25rem; padding: 4px 8px; }
.cm-badge { position: absolute; top: -2px; right: -2px; background: #ef4444; color: #fff; font-size: .65rem; font-weight: 700; border-radius: 999px; padding: 1px 5px; }
.cm-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cm-sp { flex: 1; }
.cm-muted { color: var(--c-text-3, #64748b); font-size: .85rem; }
.cm-empty { text-align: center; margin: 24px 0; }
.cm-error { margin: 10px 0 0; padding: 8px 12px; border-radius: 8px; background: #fee2e2; color: #991b1b; font-size: .9rem; }
.cm-toast { margin: 10px 0 0; padding: 8px 12px; border-radius: 8px; background: var(--c-success-soft, #dcfce7); color: var(--c-success, #166534); font-size: .9rem; }
.cm-input { width: 100%; padding: 9px 11px; border: 1px solid var(--c-border, #e2e8f0); border-radius: 10px; background: transparent; margin-top: 8px; font-size: .95rem; }
.cm-row .cm-input { flex: 1; width: auto; margin-top: 0; }
.cm-btn { padding: 8px 16px; border-radius: 999px; background: var(--c-primary, #6366f1); color: #fff; font-weight: 600; }
.cm-btn:disabled { opacity: .5; }
.cm-chip { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--c-border, #e2e8f0); font-size: .85rem; cursor: pointer; }
.cm-chip.off { opacity: .4; }
.cm-link { color: var(--c-primary, #6366f1); font-size: .85rem; }
.cm-check { display: flex; gap: 8px; align-items: flex-start; font-size: .9rem; margin: 2px 0; min-height: 44px; padding: 10px 0; cursor: pointer; }
.cm-check input[type=checkbox] { width: 20px; height: 20px; flex: 0 0 20px; margin-top: 1px; }
.cm-eula h2 { font-size: 1.2rem; font-weight: 700; margin: 0 0 6px; }
.cm-eula ul { margin: 8px 0 12px 18px; list-style: disc; font-size: .9rem; line-height: 1.45; }
.cm-eula a { color: var(--c-primary, #6366f1); text-decoration: underline; }
.cm-composer .cm-row { margin-top: 10px; }
.cm-quick { width: 100%; padding: 10px; border-radius: 12px; background: var(--c-primary-soft, #eef2ff); color: var(--c-primary, #6366f1); font-weight: 700; }
.cm-filters { display: flex; gap: 6px; margin-top: 12px; overflow-x: auto; }
.cm-filters button { padding: 5px 12px; border-radius: 999px; border: 1px solid var(--c-border, #e2e8f0); font-size: .85rem; white-space: nowrap; }
.cm-filters button.on { background: var(--c-primary, #6366f1); color: #fff; border-color: transparent; }
.cm-post.hl { outline: 2px solid var(--c-primary, #6366f1); }
.cm-author { display: flex; align-items: center; gap: 8px; text-align: left; }
.cm-follow { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--c-primary, #6366f1); color: var(--c-primary, #6366f1); font-size: .8rem; font-weight: 600; }
.cm-follow.on { background: var(--c-primary-soft, #eef2ff); border-color: transparent; }
.cm-more { padding: 2px 8px; color: var(--c-text-3, #64748b); font-size: 1.1rem; }
.cm-title { font-size: 1.05rem; font-weight: 700; margin: 10px 0 0; }
.cm-text { margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; }
.cm-stats { position: relative; margin-top: 10px; padding: 10px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
.cm-x { position: absolute; top: 4px; right: 6px; background: rgba(0,0,0,.45); color: #fff; border-radius: 999px; width: 22px; height: 22px; font-size: .7rem; }
.cm-thumbs { display: flex; gap: 6px; margin-top: 8px; }
.cm-thumb { position: relative; width: 64px; height: 64px; }
.cm-thumb img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
.cm-gallery { display: grid; gap: 4px; margin-top: 10px; border-radius: 12px; overflow: hidden; }
.cm-gallery.n2, .cm-gallery.n3, .cm-gallery.n4 { grid-template-columns: 1fr 1fr; }
.cm-gallery img { width: 100%; max-height: 360px; object-fit: cover; aspect-ratio: 4 / 3; }
.cm-gallery.n1 img { aspect-ratio: auto; }
.cm-actions { display: flex; gap: 4px; margin-top: 10px; border-top: 1px solid var(--c-border, #e2e8f0); padding-top: 8px; }
.cm-actions button { flex: 1; padding: 6px 0; border-radius: 8px; font-size: .85rem; color: var(--c-text-2, #475569); }
.cm-heart.on { color: #ef4444; font-weight: 700; }
.cm-heart .h { display: inline-block; }
.cm-heart.pop .h { animation: cm-pop .4s ease; }
@keyframes cm-pop { 0% { transform: scale(1); } 40% { transform: scale(1.45); } 100% { transform: scale(1); } }
.cm-comments { margin-top: 8px; }
.cm-comment { display: flex; gap: 8px; align-items: flex-start; margin: 6px 0; font-size: .9rem; }
.cm-cbody { flex: 1; background: var(--c-surface-2, #f1f5f9); color: var(--c-text, inherit); padding: 6px 10px; border-radius: 12px; }
.cm-more-btn { display: block; margin: 12px auto; color: var(--c-primary, #6366f1); font-weight: 600; }
.cm-chat { display: flex; flex-direction: column; height: calc(100vh - 210px); min-height: 360px; }
.cm-chatlist { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.cm-msg { display: flex; gap: 6px; align-items: flex-end; -webkit-user-select: none; user-select: none; }
.cm-msg.mine { justify-content: flex-end; }
.cm-bubble { max-width: 75%; padding: 7px 11px; border-radius: 16px; background: var(--c-surface-2, #f1f5f9); color: var(--c-text, inherit); word-break: break-word; }
.cm-msg.mine .cm-bubble { background: var(--c-primary, #6366f1); color: #fff; }
.cm-mname { font-size: .72rem; font-weight: 700; color: var(--c-primary, #6366f1); }
.cm-mimg { max-width: 100%; border-radius: 10px; margin: 2px 0; }
.cm-mtime { font-size: .65rem; opacity: .7; text-align: right; }
.cm-mtime .cm-more { font-size: .8rem; padding: 0 2px; color: inherit; }
.cm-chatbar { display: flex; gap: 6px; align-items: center; padding-top: 8px; border-top: 1px solid var(--c-border, #e2e8f0); }
.cm-chatbar .cm-input { margin: 0; }
.cm-notifs .cm-notif { display: block; width: 100%; text-align: left; padding: 8px; border-radius: 8px; font-size: .9rem; }
.cm-notif.unread { background: var(--c-primary-soft, #eef2ff); font-weight: 600; }
.cm-prefs { padding: 6px 0; border-bottom: 1px solid var(--c-border, #e2e8f0); margin-bottom: 6px; }
.cm-sheet-bg { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 60; display: flex; align-items: flex-end; justify-content: center; }
.cm-sheet { width: 100%; max-width: 480px; background: var(--c-surface, #fff); border-radius: 18px 18px 0 0; padding: 14px 16px calc(16px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 4px; }
.cm-sheet > button { padding: 12px; border-radius: 10px; text-align: center; font-weight: 600; }
.cm-sheet > button.danger { color: #dc2626; }
.cm-profile { align-items: center; text-align: center; }
.cm-pstreak { font-size: .95rem; }
.cm-badgegrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; width: 100%; margin: 6px 0; }
.cm-badge { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 2px; border-radius: 10px; background: var(--c-surface-2, #f1f5f9); }
.cm-badge span { font-size: 1.3rem; } .cm-badge small { font-size: .62rem; line-height: 1.15; opacity: .9; }
.cm-badge.off { opacity: .28; filter: grayscale(1); }
:deep(.cm-av) { width: 36px; height: 36px; border-radius: 999px; object-fit: cover; flex: none; }
:deep(.cm-av.sm) { width: 28px; height: 28px; font-size: .7rem; }
:deep(.cm-av.big) { width: 72px; height: 72px; font-size: 1.4rem; }
:deep(.cm-av--i) { display: inline-flex; align-items: center; justify-content: center; background: var(--c-primary-soft, #eef2ff); color: var(--c-primary, #6366f1); font-weight: 700; font-size: .8rem; }

/* ── Compact post cards ── */
.cm-post.cm-card { padding: 10px 12px 2px; margin-top: 8px; }
.cm-post .cm-title { margin: 4px 0 0; font-size: 1rem; line-height: 1.3; }
.cm-post .cm-text { margin: 2px 0 0; line-height: 1.35; }
.cm-post .cm-stats { margin-top: 6px; padding: 5px 8px; }
.cm-post .cm-actions { margin-top: 4px; padding-top: 0; }
.cm-post .cm-actions button { min-height: 44px; padding: 0; }
</style>
