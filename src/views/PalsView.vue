<template>
  <PalsHub v-model:tab="tab" :manager="managerProps" :unread="unread.length" :pals="palList" :selected="selected" :pal-code="palCode" :code-copied="codeCopied"
    :busy="busy" :error="error" :prefill-code="prefill" @create-link="createLink" @revoke="revoke" @share="shareLink" @reply="onReply" @disconnect="disconnect" @block-manager="blockManager" @open="(p) => (selected = p)"
    @make-code="makeCode" @share-code="shareCode" @accept="accept">
    <template #detail>
      <PalDetailLive v-if="selected" :key="selected.uid" :my-uid="uid" :pal-uid="selected.uid" :name="selected.name" @back="selected = null" @remove="removePal" @block="blockPal" @blocked="selected = null" />
    </template>
  </PalsHub>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { auth } from '@/firebaseConfig';
import PalsHub from '@/components/pals/PalsHub.vue';
import PalDetailLive from '@/components/pals/PalDetailLive.vue';
import { useManager, useMyManagers, usePalList, palApi } from '@/composables/usePals';
import { otherMember, managerLinkUrl } from '@/utils/pals';
import { PROD_ORIGIN } from '@/config/api';
import { palLinkUrl } from '@/utils/palLink';
import { isNative } from '@/utils/platform';

const route = useRoute();
const uid = auth.currentUser.uid;
const prefill = computed(() => String(route.query.code || ''));
const tab = ref(prefill.value ? 'pals' : 'manager');
watch(prefill, (v) => { if (v) { tab.value = 'pals'; selected.value = null; } });
const busy = ref(false); const error = ref(''); const copied = ref(false); const codeCopied = ref(false); const palCode = ref(''); const selected = ref(null);
const LINK_KEY = `mgrLink:${uid}`;
const link = ref(localStorage.getItem(LINK_KEY) || '');
const origin = isNative() ? PROD_ORIGIN : window.location.origin;

const { managerDoc, thread, unread, markAllRead, reply } = useManager(uid);
const { pals } = usePalList(uid);
const { managers } = useMyManagers(uid);
const palList = computed(() => pals.value.map((p) => { const o = otherMember(p, uid); return { uid: o, name: (p.names && p.names[o]) || 'Pal' }; }));
const view = computed(() => thread.value.map((m) => ({ ...m, mine: m.from === 'user', unread: m.from === 'manager' && !m.read })));
const managerProps = computed(() => ({ connected: managers.value, active: !!managerDoc.value, managerName: (managerDoc.value && managerDoc.value.name) || '', link: managerDoc.value ? link.value : '', thread: view.value, report: reportManagerMsg, busy: busy.value, copied: copied.value }));
// Seeing the manager tab marks nudges/DMs read (clears the badge) after a short beat so new ones still flash.
watch([tab, () => unread.value.length], ([t, n]) => { if (t === 'manager' && n) setTimeout(markAllRead, 1500); }, { immediate: true });

const run = async (fn) => { busy.value = true; error.value = ''; try { return await fn(); } catch (e) { error.value = e.message; alert(e.message); } finally { busy.value = false; } };
const share = async (text, url, flag) => {
  try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(url ? `${text} ${url}` : text); flag.value = true; setTimeout(() => (flag.value = false), 2000); } catch (e) { prompt('Copy this:', url || text); }
};
const createLink = (name) => run(async () => { const { token } = await palApi('createManagerLink', { name }); link.value = managerLinkUrl(origin, token); localStorage.setItem(LINK_KEY, link.value); shareLink(); });
const shareLink = () => share('Here is my ClingNote task list. You can check on me and send nudges:', link.value, copied);
const revoke = () => { if (!confirm('Turn off the manager link? It stops working right away.')) return; run(async () => { await palApi('revokeManager'); link.value = ''; localStorage.removeItem(LINK_KEY); }); };
const disconnect = (m) => { if (!confirm(`Disconnect ${m.managerName || 'this manager'}? They won't see your tasks anymore.`)) return; run(() => palApi('disconnectManager', { managerUid: m.managerUid })); };
const onReply = (t) => reply(t).catch(() => {});
const makeCode = () => run(async () => { palCode.value = (await palApi('createPalCode')).code; });
const shareCode = () => share(`Be my ClingNote pal! Open the app → Manager & Pals → enter code ${palCode.value}`, palLinkUrl(palCode.value), codeCopied);
const accept = (code) => run(async () => { const r = await palApi('acceptPal', { code }); selected.value = { uid: r.palUid, name: '' }; setTimeout(() => { const p = palList.value.find((x) => x.uid === r.palUid); if (p) selected.value = p; }, 800); });
const blockPal = () => run(async () => { await palApi('block', { palUid: selected.value.uid }); selected.value = null; });
const blockManager = (m) => { if (!confirm(`Block ${m.managerName || 'this manager'}? They're disconnected, your manager link is turned off, and they can't message you or reconnect.`)) return; run(async () => { await palApi('block', { managerUid: m.managerUid }); link.value = ''; localStorage.removeItem(LINK_KEY); }); };
// Owner reports a manager's nudge/message. "Also block": a connected manager is blocked; a link-only manager can't be identified, so the link is turned off.
const reportManagerMsg = async (m, { reason, block }) => {
  const r = await palApi('report', { scope: 'manager', messageId: m.id, reason });
  if (block) { if (m.managerUid) await palApi('block', { managerUid: m.managerUid }); else await palApi('revokeManager'); link.value = ''; localStorage.removeItem(LINK_KEY); }
  return r;
};
const removePal = () => run(async () => { await palApi('removePal', { palUid: selected.value.uid }); selected.value = null; });
</script>
