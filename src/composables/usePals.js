// Realtime (onSnapshot) data for Manager & Pal. Writes that need the admin SDK go through the manager-pal Netlify function.
import { ref, computed, onBeforeUnmount } from 'vue';
import { auth, db } from '@/firebaseConfig';
import { collection, doc, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { fnUrl } from '@/config/api';
import { pairId, tsMs } from '@/utils/pals';
import { scheduleLocal } from '@/utils/localNotify';

export const palApi = async (action, payload = {}) => {
  const token = await auth.currentUser.getIdToken();
  const r = await fetch(fnUrl('manager-pal'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, action }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: r.status });
  return data;
};

const subs = () => { const list = []; onBeforeUnmount(() => list.splice(0).forEach((u) => u())); return list; };

// Manager link state + nudges/DMs thread. New manager items raise a local notification on iOS (push arrives via OneSignal when backgrounded).
export function useManager(uid) {
  const managerDoc = ref(null); const chat = ref([]); const pending = ref([]); const s = subs();
  let primed = false;
  s.push(onSnapshot(doc(db, 'managers', uid), (d) => { managerDoc.value = d.exists() ? d.data() : null; }, () => {}));
  s.push(onSnapshot(query(collection(db, 'users', uid, 'managerChat'), orderBy('createdAt', 'desc'), limit(80)), (q) => {
    if (primed) q.docChanges().forEach((c) => { const x = c.doc.data(); if (c.type === 'added' && x.from === 'manager' && !x.read) scheduleLocal(`mgr:${c.doc.id}`, { title: x.kind === 'nudge' ? 'Nudge' : 'New message', body: x.text, at: new Date(Date.now() + 1000), route: '/pals?tab=manager', type: 'manager' }); });
    primed = true;
    chat.value = q.docs.map((d) => ({ id: d.id, ...d.data(), at: tsMs(d.data().createdAt) })).reverse();
    pending.value = pending.value.filter((p) => !chat.value.some((c) => c.from === 'user' && c.text === p.text && c.at >= p.at - 60000));
  }, () => {}));
  const unread = computed(() => chat.value.filter((c) => c.from === 'manager' && !c.read));
  const markAllRead = () => Promise.all(unread.value.map((c) => updateDoc(doc(db, 'users', uid, 'managerChat', c.id), { read: true }).catch(() => {})));
  const reply = async (text) => { const p = { id: 'p' + Date.now(), from: 'user', kind: 'dm', text, at: Date.now(), pending: true }; pending.value.push(p); try { await palApi('reply', { text }); } catch (e) { p.failed = true; pending.value = [...pending.value]; throw e; } };
  const thread = computed(() => [...chat.value, ...pending.value]);
  return { managerDoc, thread, unread, markAllRead, reply };
}

// Unread manager count only (nav badge).
export function useManagerBadge(uidRef) {
  const count = ref(0); let unsub = null;
  const watchUid = (uid) => { if (unsub) unsub(); unsub = null; count.value = 0; if (!uid) return; unsub = onSnapshot(query(collection(db, 'users', uid, 'managerChat'), where('read', '==', false)), (q) => { count.value = q.docs.filter((d) => d.data().from === 'manager').length; }, () => {}); };
  onBeforeUnmount(() => unsub && unsub());
  return { count, watchUid, uidRef };
}

export function usePalList(uid) {
  const pals = ref([]); const loaded = ref(false); const s = subs();
  s.push(onSnapshot(query(collection(db, 'pals'), where('members', 'array-contains', uid)), (q) => { pals.value = q.docs.map((d) => ({ id: d.id, ...d.data() })); loaded.value = true; }, () => { loaded.value = true; }));
  return { pals, loaded };
}

// A pal's week. Pals can't read each other's task docs directly (so Private tasks never reach them):
// the function returns Public tasks only. Refreshes every 8s while visible, and instantly when the app comes back.
export function usePalTasks(palUid) {
  const tasks = ref([]); const loaded = ref(false);
  const load = async () => { try { tasks.value = (await palApi('palTasks', { palUid })).tasks || []; } catch (e) { /* keep last */ } loaded.value = true; };
  load(); const t = setInterval(() => { if (!document.hidden) load(); }, 8000);
  const onVis = () => { if (!document.hidden) load(); }; document.addEventListener('visibilitychange', onVis);
  onBeforeUnmount(() => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); });
  return { tasks, loaded, refresh: load };
}

// People who manage me (signed-in managers), live.
export function useMyManagers(uid) {
  const managers = ref([]); const s = subs();
  s.push(onSnapshot(query(collection(db, 'managerConnections'), where('ownerUid', '==', uid)), (q) => { managers.value = q.docs.map((d) => ({ id: d.id, ...d.data() })); }, () => {}));
  return { managers };
}

// Manager mode home: everyone I manage, with overdue/unread badges (server-computed; Private tasks never counted).
export function useManagedPeople() {
  const people = ref([]); const loaded = ref(false);
  const load = async () => { try { people.value = (await palApi('managerList')).people || []; } catch (e) { /* keep last */ } loaded.value = true; };
  load(); const t = setInterval(() => { if (!document.hidden) load(); }, 20000);
  onBeforeUnmount(() => clearInterval(t));
  return { people, loaded, refresh: load };
}

// Pal DMs: client writes allowed by rules; the Firestore local cache shows the message instantly (optimistic) with hasPendingWrites.
export function usePalChat(myUid, palUid) {
  const id = pairId(myUid, palUid); const messages = ref([]); const s = subs();
  s.push(onSnapshot(query(collection(db, 'pals', id, 'messages'), orderBy('createdAt', 'desc'), limit(100)), { includeMetadataChanges: true }, (q) => {
    messages.value = q.docs.map((d) => ({ id: d.id, ...d.data(), at: tsMs(d.data().createdAt) || Date.now(), pending: d.metadata.hasPendingWrites })).reverse();
  }, () => {}));
  const send = (text) => addDoc(collection(db, 'pals', id, 'messages'), { from: myUid, text, createdAt: serverTimestamp() });
  return { messages, send };
}
