// External links. In the iOS shell (WKWebView) `target=_blank` / window.open are dropped or leave the app with no way back,
// so they open in the in-app browser (@capacitor/browser, already a dependency). On the web they behave exactly as before.
import { isNative } from '@/utils/platform';

const isHttp = (u) => /^https?:\/\//i.test(String(u || ''));

export const openExternal = async (url, features) => {
  if (isNative() && isHttp(url)) {
    try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url }); return true; } catch (e) { return false; }
  }
  try { window.open(url, '_blank', features); return true; } catch (e) { return false; }
};

// Native only: one capture-phase listener so every <a target="_blank" href="https://…"> (Terms, Room posts, task file links…) opens in the in-app browser.
// Returns the handler (and installs it) so tests can drive it; returns null outside the native shell.
export const interceptBlankLinks = (doc = document, native = isNative()) => {
  if (!native || !doc) return null;
  const handler = (ev) => {
    const a = ev.target && ev.target.closest ? ev.target.closest('a[target="_blank"][href]') : null;
    if (!a || ev.defaultPrevented) return;
    const href = a.getAttribute('href');
    if (!isHttp(href)) return;
    ev.preventDefault();
    openExternal(a.href);
  };
  doc.addEventListener('click', handler, true);
  return handler;
};
