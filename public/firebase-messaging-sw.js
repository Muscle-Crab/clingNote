/* Firebase Cloud Messaging service worker (web push). Served from the site root.
 * Registered by the app with its own scope (/firebase-cloud-messaging-push-scope), so it never takes over page
 * control or caching from other workers (OneSignal / PushAlert) and does no fetch/caching of its own.
 * These Firebase web config values are public identifiers (same as in the app bundle), not secrets. */
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD0aH-KpmPalq4U-WCpt6OXeVuEkgdRo0Y',
  authDomain: 'clingnote-463b4.firebaseapp.com',
  projectId: 'clingnote-463b4',
  storageBucket: 'clingnote-463b4.appspot.com',
  messagingSenderId: '168239327702',
  appId: '1:168239327702:web:ac517dc83e800e19e91c77',
});
const messaging = firebase.messaging();

// Messages are sent data-only ({ title, body, url }) so we control display and click handling here.
messaging.onBackgroundMessage((payload) => {
  const d = (payload && payload.data) || {};
  const title = d.title || 'ClingNote';
  self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/favicon.ico',
    tag: d.tag || 'clingnot',
    data: { url: d.url || '/home' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/home';
  const path = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/home';
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.startsWith(self.location.origin) && 'focus' in c) { c.navigate && c.navigate(target); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
