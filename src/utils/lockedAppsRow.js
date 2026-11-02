// Settings "Locked apps" row (Profile.vue). Pure so scripts/test-locked-apps-row.mjs can check the lock-mode rule.
// While any shield is up (lock-in, coach/strict day, wake lock: native status.locked with a future or open end) the row is
// disabled: Apple's picker can only replace the whole selection, so a deselect would unlock apps on the next sync.
// Native pickApps also merges (adds only) while locked, as a second guard for other callers.
export const lockActive = (st = {}, now = Date.now()) => !!(st && st.locked) && (!Number(st.until) || Number(st.until) > now);
export const lockedAppsRow = ({ native = false, status = {}, now = Date.now() } = {}) => {
  if (!native) return { disabled: true, locked: false, sub: 'iOS app only: install ClingNote on your iPhone to use it.' };
  if (lockActive(status, now)) return { disabled: true, locked: true, sub: 'Add or change after your lock ends; per-task apps open from their task' };
  const n = Number(status.selectionCount) || 0;
  return { disabled: false, locked: false, sub: n ? `${n} selected` : 'Pick the apps ClingNote locks' };
};
