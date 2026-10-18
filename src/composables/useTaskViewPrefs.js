// Today sort/filter preference, persisted in localStorage only. Never throws.
import { ref, watch } from 'vue';
import { DEFAULT_PREFS, normalizePrefs } from '@/utils/taskView';

const STORAGE_KEY = 'todayViewPrefs';

export function useTaskViewPrefs() {
  const prefs = ref({ ...DEFAULT_PREFS });
  try { prefs.value = normalizePrefs(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); } catch (e) { /* ignore */ }
  watch(prefs, (v) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePrefs(v))); } catch (e) { /* ignore */ } }, { deep: true });
  return { prefs };
}
