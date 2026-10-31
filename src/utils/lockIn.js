// Lock-in (the 8-hour countdown lock + shutdown) is OPT-IN, stored per account on users/{uid}:
//   lockInEnabled: true   -> Settings switch (Profile > Preferences). Missing/false = permanently off.
//   wakeAutoLock: true   -> "Lock at wake-up" (B44, src/utils/wakeLock.js): apps lock at the wake time without Confirm.
//   lockInSkipDate: 'YYYY-MM-DD' (the eight-hour dayKey) -> "Skip lock-in today" in the start-day prompt; that date only.
// Server mirror: netlify/functions/eight-hour-day.js start() refuses with the same rule.
import { ref } from 'vue';
import { loadUserDoc, clearProCache } from '@/composables/usePro';
import { saveUserFields } from '@/utils/userDoc';
export const lockInAllowed = (userDoc, dayKey) => !!userDoc && userDoc.lockInEnabled === true && !(dayKey && userDoc.lockInSkipDate === dayKey);
export const lockIn = ref({ loaded: false, enabled: false, skipDate: '', wakeAuto: false });
export async function loadLockIn(force = false) {
  const d = await loadUserDoc(force).catch(() => null);
  lockIn.value = { loaded: true, enabled: !!(d && d.lockInEnabled === true), skipDate: (d && d.lockInSkipDate) || '', wakeAuto: !!(d && d.wakeAutoLock === true) };
  return lockIn.value;
}
export async function setLockInEnabled(uid, on) {
  lockIn.value = { ...lockIn.value, enabled: !!on };
  await saveUserFields(uid, { lockInEnabled: !!on }); clearProCache();
}
export async function skipLockInToday(uid, dayKey) {
  lockIn.value = { ...lockIn.value, skipDate: dayKey };
  await saveUserFields(uid, { lockInSkipDate: dayKey }); clearProCache();
}
export async function setWakeAutoLock(uid, on) {
  lockIn.value = { ...lockIn.value, wakeAuto: !!on };
  await saveUserFields(uid, { wakeAutoLock: !!on }); clearProCache();
}
