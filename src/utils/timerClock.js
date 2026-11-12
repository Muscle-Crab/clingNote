// Re-read the wall clock when the WebView was suspended. Intervals and animation frames do not
// catch up on their own after iOS freezes them, and visibilitychange does not always fire.
export const bindWallClock = (setNow) => {
  if (typeof setNow !== 'function') return () => {};
  const poke = () => { try { setNow(Date.now()); } catch (e) { /* ignore */ } };
  const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') poke(); };
  const onShow = () => poke();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
  if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', onShow);
    window.addEventListener('focus', onShow);
    window.addEventListener('cn:app-resume', onShow);
  }
  let sub = null;
  let sub2 = null;
  if (typeof window !== 'undefined') {
    import('@capacitor/app').then(({ App }) => Promise.all([
      App.addListener('resume', poke),
      App.addListener('appStateChange', (s) => { if (s && s.isActive) poke(); }),
    ])).then(([a, b]) => { sub = a; sub2 = b; poke(); }).catch(() => {});
  }
  return () => {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    if (typeof window !== 'undefined') {
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('focus', onShow);
      window.removeEventListener('cn:app-resume', onShow);
    }
    try { if (sub && sub.remove) sub.remove(); if (sub2 && sub2.remove) sub2.remove(); } catch (e) { /* ignore */ }
  };
};
