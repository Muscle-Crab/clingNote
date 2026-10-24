<template>
  <div class="mp" data-test="manager-view">
    <div v-if="state === 'loading'" class="mp-center"><div class="mp-spin" /></div>
    <div v-else-if="state === 'gone'" class="mp-center mp-card" data-test="manager-gone">
      <template v-if="accountMode"><h1>Not connected</h1><p class="mp-muted">You're no longer connected to this person. They can invite you again with a new link.</p>
        <button class="mp-link" @click="router.push('/manage')">Back to everyone you manage</button></template>
      <template v-else><h1>Link not available</h1>
      <p class="mp-muted">This manager link was turned off or replaced. Ask for a new one.</p></template>
    </div>
    <template v-else>
      <button v-if="accountMode" class="mp-back" @click="router.push('/manage')" data-test="manager-back">‹ Everyone you manage</button>
      <div v-else-if="!connectDismissed" class="mp-card mp-connect" data-test="signin-connect">
        <div><b>Sign in to connect</b><p class="mp-muted">Optional. Keep {{ ownerName }} in your CleanNote app's Manager mode, no link needed.</p></div>
        <div class="mp-crow"><button class="mp-send" :disabled="connecting" @click="signInToConnect" data-test="signin-connect-btn">{{ connecting ? '…' : signedIn ? 'Connect' : 'Sign in' }}</button><button class="mp-link" @click="dismissConnect">Not now</button></div>
      </div>
      <header class="mp-head">
        <div class="mp-kicker">Manager view</div>
        <h1>{{ ownerName }}'s tasks</h1>
        <p class="mp-muted">{{ counts.done }} done · {{ counts.open }} to do<span v-if="counts.overdue" class="mp-red"> · {{ counts.overdue }} overdue</span></p>
      </header>

      <div class="mp-tabs" role="tablist">
        <button :class="{ on: tab === 'tasks' }" @click="tab = 'tasks'">Tasks</button>
        <button :class="{ on: tab === 'chat' }" @click="openChat">Messages</button>
      </div>

      <section v-if="tab === 'tasks'">
        <div v-if="!tasks.length" class="mp-card mp-muted">No tasks this week yet.</div>
        <template v-for="g in groups" :key="g.id">
          <h2 v-if="g.items.length" class="mp-sec" :class="g.cls">{{ g.label }}</h2>
          <article v-for="t in g.items" :key="t.key" class="mp-task" :class="{ done: t.completed, late: t.overdue }" data-test="manager-task">
            <span class="mp-check" :class="{ on: t.completed }">{{ t.completed ? '✓' : '' }}</span>
            <div class="mp-tbody">
              <div class="mp-ttl">{{ t.title }}</div>
              <div class="mp-meta">{{ t.day }}<span v-if="t.upcoming && t.scheduled"> · {{ t.scheduled.date.slice(5) }}</span><span v-if="t.reminder && t.reminder.time"> · ⏰ {{ t.reminder.time }}</span><span v-if="t.scheduled && t.scheduled.repeat" data-test="pal-repeat"> · 🔁 {{ t.scheduled.repeat }}</span><span v-if="t.overdue" class="mp-pill">Overdue</span></div>
            </div>
            <div v-if="!t.completed" class="mp-acts">
              <button v-if="sent[t.key]" class="mp-sent" disabled>{{ sent[t.key] }}</button>
              <template v-else>
                <button class="mp-chip" @click="nudge(t, t.overdue ? 'overdue' : 'ping')" data-test="nudge-btn">{{ t.overdue ? '⏰ Remind' : '👋 Ping' }}</button>
              </template>
            </div>
          </article>
        </template>
        <button class="mp-wide" @click="nudge(null, 'cheer')" :disabled="!!sent.__all">{{ sent.__all || '💪 Send encouragement' }}</button>
      </section>

      <section v-else class="mp-chat">
        <div class="mp-thread" ref="threadEl">
          <p v-if="!thread.length" class="mp-muted mp-c">Say hi to {{ ownerName }}. They'll get it in the app.</p>
          <div v-for="m in thread" :key="m.id" class="mp-msg" :class="[m.from === 'manager' ? 'me' : 'them', m.kind]">
            <div class="mp-bub">{{ m.text }}</div>
            <div class="mp-time">{{ m.failed ? 'Not sent' : m.pending ? 'Sending…' : ago(m.at) }}<button v-if="m.from === 'user' && !m.pending" type="button" class="mp-report" @click="reporting = m" data-test="report-msg">Report</button></div>
          </div>
        </div>
        <div class="mp-quick"><button v-for="q in QUICK_DMS" :key="q" class="mp-chip" @click="sendDm(q)">{{ q }}</button></div>
        <form class="mp-compose" @submit.prevent="sendDm(draft)">
          <input v-model="draft" maxlength="1000" :placeholder="`Message ${ownerName}`" aria-label="Message" />
          <button class="mp-send" :disabled="!draft.trim()">Send</button>
        </form>
      </section>

      <p v-if="accountMode" class="mp-foot mp-muted"><button class="mp-link mp-bad" @click="blockOwner" data-test="block-owner">Block {{ ownerName || 'this person' }}</button></p>
      <p v-if="!accountMode" class="mp-foot mp-muted">You're viewing as <b>{{ managerName || 'Manager' }}</b> · <button class="mp-link" @click="askName = true">change name</button></p>
    </template>

    <ReportDialog :open="!!reporting" :message="reporting" :who="ownerName" :can-block="accountMode" :send="sendReport" @close="onReportClose" />
    <div v-if="askName" class="mp-modal" data-test="name-prompt">
      <form class="mp-card" @submit.prevent="saveName">
        <h2>What should we call you?</h2>
        <p class="mp-muted">{{ ownerName }} will see this name on your nudges and messages. No sign-up needed.</p>
        <input v-model="nameDraft" maxlength="40" placeholder="e.g. Mom" autofocus />
        <button class="mp-send mp-full" :disabled="!nameDraft.trim()">Continue</button>
        <button type="button" class="mp-link mp-full" @click="askName = false; signInToConnect()" data-test="prompt-signin">Or sign in to connect</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fnUrl } from '@/config/api';
import { auth } from '@/firebaseConfig';
import { palApi } from '@/composables/usePals';
import { setMode, setPendingManagerToken } from '@/utils/appMode';
import { groupTasks, timeAgo, QUICK_DMS } from '@/utils/pals';
import ReportDialog from '@/components/pals/ReportDialog.vue';

const route = useRoute(); const router = useRouter();
const token = String(route.params.token || '');
// Two ways in: the no-account link (/m/:token) or a signed-in manager (/manage/:ownerUid). Same screen, same actions.
const ownerUid = String(route.params.ownerUid || '');
const accountMode = !!ownerUid;
const signedIn = ref(!!auth.currentUser); const connecting = ref(false);
const connectDismissed = ref(!!localStorage.getItem(`mgrNoConnect:${token.slice(0, 8)}`));
const dismissConnect = () => { connectDismissed.value = true; localStorage.setItem(`mgrNoConnect:${token.slice(0, 8)}`, '1'); };
// Sign in -> (new accounts: normal onboarding) -> connected as manager -> this person's view. The token waits in localStorage.
const signInToConnect = async () => {
  if (!auth.currentUser) { setPendingManagerToken(token); router.push({ path: '/login', query: { returning: '1' } }); return; }
  connecting.value = true;
  try { const r = await palApi('connectManager', { token }); setMode('manager'); router.replace(`/manage/${r.ownerUid}`); }
  catch (e) { alert(e.message || 'Could not connect'); } finally { connecting.value = false; }
};
const state = ref('loading'); const tab = ref('tasks');
const ownerName = ref(''); const managerName = ref(''); const tasks = ref([]); const serverChat = ref([]); const pendingMsgs = ref([]);
const sent = ref({}); const draft = ref(''); const askName = ref(false); const nameDraft = ref(''); const threadEl = ref(null);
const now = ref(Date.now());

const api = async (method, body) => {
  if (accountMode) return method === 'GET' ? palApi('managerView', { ownerUid }) : (({ action, ...rest }) => palApi('managerAct', { ...rest, ownerUid, act: action }))(body);
  const r = method === 'GET' ? await fetch(`${fnUrl('manager-pal')}?token=${encodeURIComponent(token)}`) : await fetch(fnUrl('manager-pal'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...body }) });
  const data = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(data.error || 'Error'), { status: r.status }); return data;
};
const load = async () => {
  try {
    const d = await api('GET');
    ownerName.value = d.ownerName; managerName.value = d.managerName; tasks.value = d.tasks || []; serverChat.value = d.chat || [];
    pendingMsgs.value = pendingMsgs.value.filter((p) => p.failed || !serverChat.value.some((c) => c.from === 'manager' && c.text === p.text));
    if (state.value === 'loading') { state.value = 'ok'; if (!accountMode && !d.managerName && !localStorage.getItem(`mgrName:${token.slice(0, 8)}`)) askName.value = true; }
  } catch (e) { if (e.status === 404) state.value = 'gone'; else if (state.value === 'loading') state.value = 'gone'; }
};
const g = computed(() => groupTasks(tasks.value));
const groups = computed(() => [
  { id: 'overdue', label: 'Overdue', cls: 'mp-red', items: g.value.overdue },
  { id: 'open', label: 'To do', cls: '', items: g.value.open },
  { id: 'done', label: 'Done', cls: 'mp-green', items: g.value.done },
]);
const counts = computed(() => ({ overdue: g.value.overdue.length, open: g.value.open.length + g.value.overdue.length, done: g.value.done.length }));
const thread = computed(() => [...serverChat.value, ...pendingMsgs.value]);
const ago = (ms) => timeAgo(ms, now.value);

// Optimistic one-tap nudge: label flips to "Sent ✓" immediately; reverts if the request fails.
const nudge = async (t, preset) => {
  const k = t ? t.key : '__all';
  sent.value = { ...sent.value, [k]: 'Sent ✓' };
  try { await api('POST', { action: 'nudge', preset, taskKey: t ? t.key : undefined }); setTimeout(load, 300); }
  catch (e) { const { [k]: _drop, ...rest } = sent.value; sent.value = rest; alert(e.message || 'Could not send'); }
};
const scrollDown = () => nextTick(() => { if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight; });
const sendDm = async (text) => {
  text = String(text || '').trim(); if (!text) return; draft.value = '';
  const p = { id: 'p' + Date.now(), from: 'manager', kind: 'dm', text, at: Date.now(), pending: true }; pendingMsgs.value.push(p); scrollDown();
  try { await api('POST', { action: 'dm', text }); p.pending = false; pendingMsgs.value = [...pendingMsgs.value]; load(); }
  catch (e) { p.failed = true; pendingMsgs.value = [...pendingMsgs.value]; }
};
// Block & Report (App Store 1.2). Link viewers can report; signed-in managers can also block (disconnects, can't reconnect).
const reporting = ref(null); const blockedNow = ref(false);
const sendReport = async ({ reason, block }) => {
  const r = accountMode ? await palApi('report', { scope: 'manager', ownerUid, messageId: reporting.value.id, reason }) : await api('POST', { action: 'report', messageId: reporting.value.id, reason });
  if (block) { await palApi('block', { ownerUid }); blockedNow.value = true; }
  return r;
};
const onReportClose = () => { reporting.value = null; if (blockedNow.value) router.replace('/manage'); };
const blockOwner = async () => {
  if (!confirm(`Block ${ownerName.value || 'this person'}? You'll be disconnected and they can't invite you again.`)) return;
  try { await palApi('block', { ownerUid }); router.replace('/manage'); } catch (e) { alert(e.message || 'Could not block'); }
};
const openChat = () => { tab.value = 'chat'; scrollDown(); };
const saveName = async () => {
  const n = nameDraft.value.trim(); if (!n) return; askName.value = false; managerName.value = n;
  localStorage.setItem(`mgrName:${token.slice(0, 8)}`, '1');
  try { await api('POST', { action: 'setName', name: n }); } catch (e) { /* keep local name */ }
};
let timer = null; let tick = null;
onMounted(() => { load(); timer = setInterval(() => { if (!document.hidden) load(); }, 15000); tick = setInterval(() => { now.value = Date.now(); }, 30000); });
onBeforeUnmount(() => { clearInterval(timer); clearInterval(tick); });
</script>

<style scoped>
.mp { --bg: #070D1C; --s2: #12203F; --bd: #2A3C66; --t: #F2F5FC; --t2: #A9B4CC; --t3: #7180A0; --ac: #2F6FFF; --ok: #3DDC97; --bad: #F87171;
  min-height: 100dvh; background: var(--bg); color: var(--t); font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 560px; margin: 0 auto; padding: calc(20px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom)); box-sizing: border-box; }
.mp h1 { font-size: 24px; margin: 2px 0 4px; letter-spacing: -.01em; } .mp h2 { margin: 0; }
.mp-kicker { color: #5B9BFF; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.mp-muted { color: var(--t2); font-size: 14px; } .mp-red { color: var(--bad); } .mp-green { color: var(--ok); } .mp-c { text-align: center; margin-top: 40px; }
.mp-center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60dvh; text-align: center; }
.mp-spin { width: 28px; height: 28px; border: 3px solid var(--bd); border-top-color: var(--ac); border-radius: 50%; animation: s 1s linear infinite; } @keyframes s { to { transform: rotate(360deg); } }
.mp-card { background: linear-gradient(180deg, rgba(18,32,63,.92), rgba(12,22,48,.92)); border: 1px solid var(--bd); border-radius: 16px; padding: 16px; }
.mp-head { margin-bottom: 14px; }
.mp-tabs { display: flex; gap: 6px; background: #0C1630; border: 1px solid #1A2846; border-radius: 12px; padding: 4px; margin-bottom: 14px; }
.mp-tabs button { flex: 1; min-height: 38px; border-radius: 9px; border: 0; background: transparent; color: var(--t2); font-weight: 600; font-size: 14px; }
.mp-tabs button.on { background: var(--s2); color: var(--t); }
.mp-sec { font-size: 12px !important; text-transform: uppercase; letter-spacing: .08em; color: var(--t3); margin: 16px 2px 8px !important; }
.mp-task { display: flex; align-items: center; gap: 12px; background: linear-gradient(180deg, rgba(18,32,63,.92), rgba(12,22,48,.92)); border: 1px solid var(--bd); border-radius: 14px; padding: 12px; margin-bottom: 8px; }
.mp-task.late { border-color: rgba(248,113,113,.55); box-shadow: inset 3px 0 0 var(--bad); }
.mp-task.done .mp-ttl { color: var(--t3); text-decoration: line-through; }
.mp-check { flex: none; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--bd); display: grid; place-items: center; font-size: 13px; font-weight: 800; }
.mp-check.on { background: var(--ok); border-color: var(--ok); color: #062014; }
.mp-tbody { flex: 1; min-width: 0; } .mp-ttl { font-weight: 600; font-size: 15px; overflow-wrap: anywhere; }
.mp-meta { color: var(--t3); font-size: 12px; margin-top: 2px; }
.mp-pill { margin-left: 6px; background: #2E1517; color: var(--bad); border-radius: 999px; padding: 1px 7px; font-weight: 700; }
.mp-acts { flex: none; }
.mp-chip { min-height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--bd); background: var(--s2); color: var(--t); font-weight: 600; font-size: 13px; white-space: nowrap; }
.mp-chip:active, .mp-send:active { transform: scale(.96); }
.mp-sent { min-height: 34px; padding: 0 12px; border-radius: 999px; border: 0; background: #10261D; color: var(--ok); font-weight: 700; font-size: 13px; }
.mp-wide { width: 100%; margin-top: 12px; min-height: 46px; border-radius: 12px; border: 1px dashed var(--bd); background: transparent; color: var(--t); font-weight: 600; }
.mp-chat { display: flex; flex-direction: column; height: calc(100dvh - 250px); min-height: 360px; }
.mp-thread { flex: 1; overflow-y: auto; padding: 4px 2px; }
.mp-msg { display: flex; flex-direction: column; margin: 6px 0; max-width: 82%; } .mp-msg.me { margin-left: auto; align-items: flex-end; }
.mp-bub { padding: 9px 13px; border-radius: 16px; background: var(--s2); border: 1px solid var(--bd); font-size: 15px; overflow-wrap: anywhere; }
.mp-msg.me .mp-bub { background: var(--ac); border-color: var(--ac); color: #fff; }
.mp-msg.nudge .mp-bub { background: #2B2209; border-color: #5a4512; color: #F5C75F; }
.mp-time { font-size: 11px; color: var(--t3); margin-top: 2px; }
.mp-report { background: none; border: 0; color: var(--t3); font-size: 11px; text-decoration: underline; margin-left: 8px; padding: 6px 4px; }
.mp-bad { color: var(--bad) !important; }
.mp-quick { display: flex; gap: 6px; overflow-x: auto; padding: 8px 0; } .mp-quick::-webkit-scrollbar { display: none; }
.mp-compose { display: flex; gap: 8px; }
.mp-compose input, .mp-modal input { flex: 1; min-height: 46px; border-radius: 12px; border: 1px solid var(--bd); background: rgba(7,13,28,.6); color: var(--t); padding: 0 14px; font-size: 16px; }
.mp-send { min-height: 46px; padding: 0 18px; border-radius: 12px; border: 0; background: var(--ac); color: #fff; font-weight: 700; font-size: 15px; }
.mp-send:disabled { opacity: .45; } .mp-full { width: 100%; margin-top: 10px; }
.mp-foot { text-align: center; margin-top: 18px; font-size: 13px; }
.mp-link { background: none; border: 0; color: #5B9BFF; text-decoration: underline; font-size: 13px; padding: 0; }
.mp-back { background: none; border: 0; color: #5B9BFF; font-weight: 600; font-size: 15px; padding: 0 0 10px; }
.mp-connect { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; border-color: #2F6FFF; } .mp-connect p { margin: 2px 0 0; }
.mp-crow { display: flex; align-items: center; gap: 14px; } .mp-crow .mp-send { min-height: 40px; }
.mp-modal { position: fixed; inset: 0; background: rgba(3,6,14,.7); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
.mp-modal .mp-card { width: 100%; max-width: 380px; } .mp-modal h2 { font-size: 20px; margin-bottom: 6px; } .mp-modal input { width: 100%; box-sizing: border-box; margin-top: 8px; }
</style>
