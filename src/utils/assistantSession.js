// ClingNote assistant conversation: module state (survives closing the panel) + on-device history per user (localStorage, last 30 turns).
import { ref } from 'vue';
import { trimContents } from './assistantLoop';
const KEY = (uid) => `cn.assistant.${uid || 'anon'}`;
export const assistantSession = { msgs: ref([]), contents: ref([]), remaining: ref(null), speak: ref(true), uid: '' };
export const loadAssistant = (uid) => {
  if (assistantSession.uid === uid) return; assistantSession.uid = uid;
  try { const d = JSON.parse(localStorage.getItem(KEY(uid)) || 'null'); assistantSession.msgs.value = Array.isArray(d?.msgs) ? d.msgs.slice(-40) : []; assistantSession.contents.value = trimContents(d?.contents || []); assistantSession.speak.value = d?.speak !== false; }
  catch (e) { assistantSession.msgs.value = []; assistantSession.contents.value = []; }
};
export const saveAssistant = () => {
  try { localStorage.setItem(KEY(assistantSession.uid), JSON.stringify({ msgs: assistantSession.msgs.value.slice(-40), contents: trimContents(assistantSession.contents.value), speak: assistantSession.speak.value })); } catch (e) { /* private mode / full */ }
};
export const clearAssistant = () => { assistantSession.msgs.value = []; assistantSession.contents.value = []; saveAssistant(); };
