// Shared press-and-hold for the assistant face (Home robot FAB + global assistant FAB).
// Why it only worked "sometimes" on iOS: the old handlers cancelled the hold on pointerleave/pointercancel. WebKit fires
// pointercancel as soon as a resting finger drifts a few px (touch-action: manipulation still allows panning, so the
// browser takes the touch for a scroll) and pointerleave fires when the finger rolls off the 46-52px button.
// Fix: capture the pointer, tolerate small movement (MOVE_TOL px), and only cancel on a real move/cancel past it.
export const HOLD_MS = 500;
export const MOVE_TOL = 14;
export const createLongPress = ({ ms = HOLD_MS, tol = MOVE_TOL, onLong, onTap, setTimer = setTimeout, clearTimer = clearTimeout } = {}) => {
  let t = null; let x = 0; let y = 0; let active = false; let longed = false; let id = null;
  const stop = () => { if (t) clearTimer(t); t = null; active = false; };
  const down = (e) => {
    if (e && e.button > 0) return; // mouse right/middle button
    stop(); longed = false; active = true; x = e ? e.clientX || 0 : 0; y = e ? e.clientY || 0 : 0; id = e ? e.pointerId : null;
    try { if (e && e.currentTarget && e.currentTarget.setPointerCapture && id != null) e.currentTarget.setPointerCapture(id); } catch (err) { /* ignore */ }
    t = setTimer(() => { t = null; if (!active) return; longed = true; active = false; try { navigator.vibrate && navigator.vibrate(15); } catch (err) { /* ignore */ } onLong && onLong(); }, ms);
  };
  const move = (e) => { if (!active || !e) return; if (Math.abs((e.clientX || 0) - x) > tol || Math.abs((e.clientY || 0) - y) > tol) stop(); };
  const up = (e) => { const wasActive = active; stop(); if (longed) { if (e && e.cancelable) e.preventDefault(); return; } if (wasActive && onTap) onTap(); };
  const cancel = () => stop(); // a real cancel (system gesture, big scroll): drop the hold, no tap
  // click fires after up: swallow it after a long press (and after our own tap handling)
  const click = (e) => { if (e && e.cancelable) e.preventDefault(); };
  const wasLong = () => longed;
  return { down, move, up, cancel, click, wasLong, dispose: stop };
};
