// Pointer-driven list reorder with continuous motion. Pick-up: drag handle, or long-press (HOLD_MS, finger still) anywhere on a card (replaces SortableJS/vuedraggable on the task list).
// - Dragged item follows the finger 1:1 via rAF-written translate3d (no CSS transition on it while dragging).
// - Neighbours slide live with a transform transition; all geometry is measured ONCE at drag start, so the
//   drag loop never reads layout.
// - On release the item glides from the release point into its slot, then the data order is committed and the
//   transforms are cleared in the same frame (no teleport), followed by a small settle bounce.
import { onBeforeUnmount } from 'vue';
import { prefersReducedMotion, EASE_OUT, lightHaptic } from './useTaskMotion';

const SLIDE_MS = 400;
const DROP_MS = 380;
export const HOLD_MS = 400; // long-press anywhere on a card picks it up
export const HOLD_TOL = 10; // px of finger drift allowed while holding; more = the user is scrolling
// Elements that keep their own tap/press meaning (buttons, inputs, links); a hold that starts on them never drags.
export const NO_HOLD = 'button, input, textarea, select, a, label, [contenteditable], .task-expand, .no-hold';
// Pure: should a pending hold be dropped because the finger moved (= scroll)?
export const holdMoved = (x0, y0, x, y, tol = HOLD_TOL) => Math.abs(x - x0) > tol || Math.abs(y - y0) > tol;

export function useSmoothReorder({ listRef, handle = '.drag-handle', enabled = () => true, onStart, onCommit, onEnd, holdMs = HOLD_MS }) {
  let st = null; // drag state
  let raf = 0;
  let hold = null; // pending long-press { timer, x0, y0, el, id }

  const scroller = (el) => { for (let n = el.parentElement; n; n = n.parentElement) { const s = window.getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return n; } return document.scrollingElement || document.documentElement; };

  const frame = () => {
    raf = 0;
    if (!st || st.dropping) return;
    // auto-scroll near viewport edges (one cheap read of scrollTop, then writes only)
    const edge = 70, vh = window.innerHeight;
    let speed = 0;
    if (st.py < edge) speed = -Math.ceil((edge - st.py) / 5); else if (st.py > vh - edge) speed = Math.ceil((st.py - (vh - edge)) / 5);
    if (speed) st.sc.scrollTop += speed;
    const scrollDelta = st.sc.scrollTop - st.scroll0;
    const dy = st.py - st.y0 + scrollDelta;
    st.dy = dy;
    st.el.style.transform = `translate3d(0,${dy}px,0) scale(1.03)`;
    // target index from cached midpoints
    const centre = st.rects[st.from].top + st.rects[st.from].height / 2 + dy;
    let to = st.from;
    for (let i = 0; i < st.rects.length; i++) {
      const mid = st.rects[i].top + st.rects[i].height / 2;
      if (i < st.from && centre < mid) { to = i; break; }
      if (i > st.from && centre > mid) to = i;
    }
    if (to !== st.to) {
      st.to = to;
      const shift = st.rects[st.from].height + st.gap;
      st.items.forEach((n, i) => {
        if (i === st.from) return;
        const off = (st.from < i && i <= to) ? -shift : (to <= i && i < st.from) ? shift : 0;
        n.style.transform = off ? `translate3d(0,${off}px,0)` : '';
      });
    }
    if (speed) raf = window.requestAnimationFrame(frame);
  };
  const schedule = () => { if (!raf) raf = window.requestAnimationFrame(frame); };

  const onMove = (e) => { if (!st) return; if (st.touchOnly && e.pointerType === 'touch') return; st.py = e.clientY; e.preventDefault(); schedule(); };

  // iOS WKWebView: pointer events alone don't stop the native scroll, which steals the gesture and fires
  // pointercancel. A non-passive touchmove preventDefault while dragging keeps the finger on the item.
  // Also follow the finger from touchmove: after a long-press WebKit may already have sent pointercancel.
  const blockTouch = (e) => { if (!st) return; if (e.cancelable) e.preventDefault(); const t = e.touches && e.touches[0]; if (t) { st.py = t.clientY; schedule(); } };
  const touchEnd = () => { if (st) onUp(); };
  const cleanupListeners = () => {
    document.removeEventListener('touchmove', blockTouch, { passive: false });
    document.removeEventListener('touchend', touchEnd); document.removeEventListener('touchcancel', touchEnd);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };

  const finish = async (s) => {
    const changed = s.to !== s.from;
    if (changed) await onCommit?.(s.keys[s.from], s.keys[s.to], s.from, s.to); // DOM reorders on nextTick inside onCommit
    // same frame as the re-render: drop every transform with transitions off, so nothing moves visually
    s.items.forEach((n) => { n.style.transition = 'none'; n.style.transform = ''; n.style.willChange = ''; n.style.zIndex = ''; n.classList.remove('reorder-lift', 'reorder-shift'); });
    void s.list.offsetHeight; // commit the reset before re-enabling transitions
    s.items.forEach((n) => { n.style.transition = ''; });
    s.list.classList.remove('reorder-live');
    if (!s.reduced) { s.el.classList.add('reorder-settle'); setTimeout(() => s.el.classList.remove('reorder-settle'), 520); }
    onEnd?.(changed);
  };

  // A click that follows a drop must not open the card (tap = details sheet).
  const swallowClick = () => { const f = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; window.addEventListener('click', f, true); setTimeout(() => window.removeEventListener('click', f, true), 450); };
  function onUp(e) {
    if (!st) return;
    if (e && e.type === 'pointercancel' && st.touchOnly) return; // long-press drag on touch: WebKit cancels the pointer; touchend ends it
    if (st.viaHold) swallowClick();
    cleanupListeners();
    if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
    frame(); // apply the latest pointer position
    const s = st; s.dropping = true; st = null;
    // final offset of the dragged item = sum of displaced neighbour heights
    let target = 0;
    if (s.to > s.from) for (let i = s.from + 1; i <= s.to; i++) target += s.rects[i].height + s.gap;
    else for (let i = s.to; i < s.from; i++) target -= s.rects[i].height + s.gap;
    if (s.reduced) { finish(s); return; }
    s.el.style.transition = `transform ${DROP_MS}ms ${EASE_OUT}, box-shadow ${DROP_MS}ms ${EASE_OUT}`;
    s.el.classList.remove('reorder-lift');
    s.el.style.transform = `translate3d(0,${target}px,0) scale(1)`;
    let done = false;
    const end = () => { if (done) return; done = true; s.el.removeEventListener('transitionend', onTe); finish(s); };
    const onTe = (ev) => { if (ev.target === s.el && ev.propertyName === 'transform') end(); };
    s.el.addEventListener('transitionend', onTe);
    setTimeout(end, DROP_MS + 80);
  }

  const itemsOf = (list) => Array.from(list.children).filter((n) => n.nodeType === 1 && n.dataset.reorderKey);
  const cancelHold = () => { if (!hold) return; clearTimeout(hold.timer); document.removeEventListener('touchmove', holdMove); window.removeEventListener('pointermove', holdMove); window.removeEventListener('pointerup', cancelHold); window.removeEventListener('pointercancel', holdCancel); document.removeEventListener('touchend', cancelHold); document.removeEventListener('scroll', cancelHold, true); hold = null; };
  // Passive: while the hold is pending the page must scroll normally; moving past HOLD_TOL drops the hold.
  function holdMove(e) { if (!hold) return; const t = e.touches ? e.touches[0] : e; if (!t) return; hold.y = t.clientY; if (holdMoved(hold.x0, hold.y0, t.clientX, t.clientY)) cancelHold(); }
  function holdCancel() { if (hold && hold.touch) return; cancelHold(); } // touch: WebKit's own long-press recogniser may cancel the pointer; touchmove/touchend decide
  const onDown = (e) => {
    if (st || hold || e.button > 0 || !enabled()) return;
    const list = listRef.value?.$el || listRef.value; if (!list) return;
    const h = e.target.closest && e.target.closest(handle);
    if (h && list.contains(h)) { begin(e, list, h, false); return; }
    // Long-press anywhere else on a card (not on its own buttons/inputs, not on section headers) = pick it up.
    if (!e.target.closest || e.target.closest(NO_HOLD)) return;
    const el = itemsOf(list).find((n) => n.contains(e.target));
    if (!el || !el.classList.contains('task-card')) return;
    const touch = e.pointerType === 'touch';
    hold = { x0: e.clientX, y0: e.clientY, y: e.clientY, el, id: e.pointerId, touch, timer: setTimeout(() => { const hd = hold; cancelHold(); if (hd && enabled() && !st) begin({ clientY: hd.y, pointerId: hd.id, preventDefault() {} }, list, hd.el, true, hd.touch); }, holdMs) };
    document.addEventListener('touchmove', holdMove, { passive: true }); window.addEventListener('pointermove', holdMove, { passive: true });
    window.addEventListener('pointerup', cancelHold); window.addEventListener('pointercancel', holdCancel); document.addEventListener('touchend', cancelHold); document.addEventListener('scroll', cancelHold, true);
  };
  function begin(e, list, h, viaHold, touchOnly = false) {
    const items = itemsOf(list);
    const el = items.find((n) => n.contains(h));
    if (!el) return;
    e.preventDefault();
    const rects = items.map((n) => n.getBoundingClientRect()); // the only layout read of the whole drag
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
    const from = items.indexOf(el);
    const sc = scroller(list);
    const reduced = prefersReducedMotion();
    st = { list, items, el, rects, gap, from, to: from, keys: items.map((n) => n.dataset.reorderKey), y0: e.clientY, py: e.clientY, dy: 0, sc, scroll0: sc.scrollTop, reduced, viaHold, touchOnly };
    list.classList.add('reorder-live');
    items.forEach((n) => { n.style.willChange = 'transform'; if (n !== el) { n.classList.add('reorder-shift'); n.style.transition = reduced ? 'none' : `transform ${SLIDE_MS}ms ${EASE_OUT}`; } });
    el.style.transition = 'none'; el.style.zIndex = '50'; el.classList.add('reorder-lift');
    try { h.setPointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
    document.addEventListener('touchmove', blockTouch, { passive: false });
    document.addEventListener('touchend', touchEnd); document.addEventListener('touchcancel', touchEnd);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    lightHaptic();
    onStart?.();
    schedule();
  }

  onBeforeUnmount(() => { cancelHold(); cleanupListeners(); if (raf) window.cancelAnimationFrame(raf); });
  return { onPointerDown: onDown };
}
