// Focus Mode preference. Missing means on. users/{uid}.focusMode is the source of truth;
// the local key only paints the switch before that doc loads. Both true and false are saved.
export const FOCUS_MODE_FIELD = 'focusMode';
const listeners = new Set();

export const focusModeCacheKey = (uid) => `cn.focus.mode.v1:${uid || 'device'}`;

export const focusModeFromDoc = (data) => {
  if (!data || typeof data !== 'object' || !Object.prototype.hasOwnProperty.call(data, FOCUS_MODE_FIELD)) return true;
  return data[FOCUS_MODE_FIELD] !== false;
};

export const readFocusMode = (store, uid) => {
  try {
    const v = store && store.getItem(focusModeCacheKey(uid));
    if (v === '0') return false;
    if (v === '1') return true;
  } catch (e) { /* private mode */ }
  return true;
};

export const writeFocusModeCache = (store, uid, on) => {
  try { if (store) store.setItem(focusModeCacheKey(uid), on ? '1' : '0'); } catch (e) { /* ignore */ }
};

export const subscribeFocusMode = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const publishFocusMode = (on) => { const value = !!on; listeners.forEach((fn) => fn(value)); };

// write(uid, fields) is saveUserFields: setDoc merge on users/{uid}. Called for off and on.
export const saveFocusMode = async ({ store, uid, on, write } = {}) => {
  const value = !!on;
  writeFocusModeCache(store, uid, value);
  if (uid && typeof write === 'function') await write(uid, { [FOCUS_MODE_FIELD]: value });
  publishFocusMode(value);
  return value;
};
