// User mode (your own tasks) vs Manager mode (people you manage). Any account can use both; the last one used is remembered on this device.
// Also holds a manager invite token across sign-in + normal onboarding, so the connection happens once onboarding is done.
const MODE_KEY = 'clingnote.mode.v1';
const PENDING_KEY = 'clingnote.pendingManagerToken.v1';
const ls = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };
export const getMode = () => { try { return ls()?.getItem(MODE_KEY) === 'manager' ? 'manager' : 'user'; } catch (e) { return 'user'; } };
export const setMode = (m) => { try { ls()?.setItem(MODE_KEY, m === 'manager' ? 'manager' : 'user'); } catch (e) { /* private mode */ } };
export const homeFor = (mode = getMode()) => (mode === 'manager' ? '/manage' : '/home');
export const getPendingManagerToken = () => { try { return ls()?.getItem(PENDING_KEY) || ''; } catch (e) { return ''; } };
export const setPendingManagerToken = (t) => { try { ls()?.setItem(PENDING_KEY, String(t || '')); } catch (e) { /* ignore */ } };
export const clearPendingManagerToken = () => { try { ls()?.removeItem(PENDING_KEY); } catch (e) { /* ignore */ } };
