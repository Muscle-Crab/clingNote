// Web push (Firebase Cloud Messaging). The VAPID *public* key is not a secret; it is safe to commit.
// Project clingnote-463b4 → Cloud Messaging → Web Push certificates (generated Oct 22, 2026).
export const VAPID_PUBLIC_KEY = 'BCIhxknHJkxoDa2LKYDKO3H1ScJ-77qs6jefqT5Yt8ldhfcINvC-ddjUmPiJaS4-btd7LHZxnDUNZePXaeeoPF4';
export const SW_URL = '/firebase-messaging-sw.js';
export const SW_SCOPE = '/firebase-cloud-messaging-push-scope'; // own scope: never shadows or replaces other service workers
export const SEND_FN = '/.netlify/functions/push-send';
