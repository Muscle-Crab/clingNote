// Day templates storage: userSettings/{uid}.dayTemplates (owner-only by firestore.rules, no rules change needed), with a
// per-account localStorage copy so the list opens instantly and survives offline.
import { ref } from 'vue';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { cleanTemplates, upsertTemplate, removeTemplate } from '@/utils/dayTemplates';

const key = (uid) => `cn.dayTemplates.${uid}`;
const readLocal = (uid) => { try { return cleanTemplates(JSON.parse(localStorage.getItem(key(uid)) || '[]')); } catch (e) { return []; } };
const writeLocal = (uid, list) => { try { localStorage.setItem(key(uid), JSON.stringify(list)); } catch (e) { /* storage off */ } };

export function useDayTemplates() {
  const templates = ref([]);
  const load = async (uid) => {
    if (!uid) { templates.value = []; return; }
    templates.value = readLocal(uid);
    try { const s = await getDoc(doc(db, 'userSettings', uid)); if (s.exists() && Array.isArray(s.data().dayTemplates)) { templates.value = cleanTemplates(s.data().dayTemplates); writeLocal(uid, templates.value); } } catch (e) { console.warn('templates load', e && e.code); }
  };
  const persist = async (uid, list) => { templates.value = list; writeLocal(uid, list); await setDoc(doc(db, 'userSettings', uid), { dayTemplates: list }, { merge: true }); };
  const save = (uid, tpl) => persist(uid, upsertTemplate(templates.value, tpl));
  const remove = (uid, id) => persist(uid, removeTemplate(templates.value, id));
  return { templates, load, save, remove };
}
