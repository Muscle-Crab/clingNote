// Settings "Locked apps" row (Profile.vue). Pure so scripts/test-locked-apps-row.mjs can check it.
// A running lock-in does not disable this row: the user can add, rename, or remove apps. The Screen Time
// shield is re-applied to whatever remains selected, so deleting an app drops it and the rest stay locked.
export const lockActive = (st = {}, now = Date.now()) => !!(st && st.locked) && (!Number(st.until) || Number(st.until) > now);
export const lockedAppsRow = ({ native = false, status = {}, now = Date.now() } = {}) => {
  if (!native) return { disabled: true, locked: false, sub: 'iOS app only: install ClingNote on your iPhone to use it.' };
  const n = Number(status.selectionCount) || 0;
  const active = lockActive(status, now);
  return { disabled: false, locked: active, sub: n ? `${n} selected` : 'Pick the apps ClingNote locks' };
};
