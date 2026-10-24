// Pointer-driven list reorder with continuous motion (replaces SortableJS/vuedraggable on the task list).
// - Dragged item follows the finger 1:1 via rAF-written translate3d (no CSS transition on it while dragging).
// - Neighbours slide live with a transform transition; all geometry is measured ONCE at drag start, so the
//   drag loop never reads layout.
// - On release the item glides from the release point into its slot, then the data order is committed and the
//   transforms are cleared in the same frame (no teleport), followed by a small settle bounce.
import { onBeforeUnmount } from 'vue';
import { prefersReducedMotion, EASE_OUT, lightHaptic } from './useTaskMotion';

const SLIDE_MS = 400;
const DROP_MS = 380;

export function useSmoothReorder({ listRef, handle = '.drag-handle', enabled = () => true, onStart, onCommit, onEnd }) {
  let st = null; // drag state
  let raf = 0;

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

  const onMove = (e) => { if (!st) return; st.py = e.clientY; e.preventDefault(); schedule(); };

  const cleanupListeners = () => {
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

  function onUp() {
    if (!st) return;
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

  const onDown = (e) => {
    if (st || e.button > 0 || !enabled()) return;
    const h = e.target.closest && e.target.closest(handle);
    const list = listRef.value?.$el || listRef.value;
    if (!h || !list || !list.contains(h)) return;
    const items = Array.from(list.children).filter((n) => n.nodeType === 1 && n.dataset.reorderKey);
    const el = items.find((n) => n.contains(h));
    if (!el) return;
    e.preventDefault();
    const rects = items.map((n) => n.getBoundingClientRect()); // the only layout read of the whole drag
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
    const from = items.indexOf(el);
    const sc = scroller(list);
    const reduced = prefersReducedMotion();
    st = { list, items, el, rects, gap, from, to: from, keys: items.map((n) => n.dataset.reorderKey), y0: e.clientY, py: e.clientY, dy: 0, sc, scroll0: sc.scrollTop, reduced };
    list.classList.add('reorder-live');
    items.forEach((n) => { n.style.willChange = 'transform'; if (n !== el) { n.classList.add('reorder-shift'); n.style.transition = reduced ? 'none' : `transform ${SLIDE_MS}ms ${EASE_OUT}`; } });
    el.style.transition = 'none'; el.style.zIndex = '50'; el.classList.add('reorder-lift');
    try { h.setPointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    lightHaptic();
    onStart?.();
    schedule();
  };

  onBeforeUnmount(() => { cleanupListeners(); if (raf) window.cancelAnimationFrame(raf); });
  return { onPointerDown: onDown };
}
