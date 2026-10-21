// Client side of push notifications. No OneSignal REST key here: sending goes through the
// Netlify Function /.netlify/functions/send-notification, which verifies the Firebase ID token.
import { auth } from '@/firebaseConfig';

const ENDPOINT = '/.netlify/functions/send-notification';

// Link this browser's OneSignal subscription to the Firebase uid so 'self' pushes reach only this user.
export const linkPushUser = async (uid) => {
  try { if (uid && window.OneSignal?.login) await window.OneSignal.login(uid); } catch (e) { console.warn('OneSignal login failed', e); }
};

export const sendPush = async ({ kind = 'self', title, message, sendAfter, url } = {}) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, title, message, sendAfter, url }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Push failed (${r.status})`);
  return data;
};

const to12h = (time24) => {
  const [h, m] = time24.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export const scheduleNotification = async (task, reminder) => {
  if (!task || !reminder?.date || !reminder?.time) { console.error('Invalid task or reminder data'); return; }
  const formattedTime = to12h(reminder.time);
  try {
    await sendPush({ title: 'Task Reminder', message: `${task.title} at ${formattedTime}`, sendAfter: new Date(`${reminder.date}T${reminder.time}:00`).toISOString() });
    alert(`Task "${task.title}" has been scheduled successfully for ${formattedTime}!`);
  } catch (error) {
    console.error('Error scheduling notification:', error);
    alert('Failed to schedule the reminder. Please try again.');
  }
};

// Previously sent to a hard-coded device; now only notifies the signed-in user's own devices.
export const sendNotificationToPlayer = async (userName, action) => {
  const msgs = { created: ['New Task Alert', `${userName} created a new task!`], completed: ['Task Completed', `${userName} completed a task!`] };
  const [title, message] = msgs[action] || ['Notification', 'An action was performed.'];
  try { await sendPush({ title, message }); } catch (error) { console.error('Error sending notification:', error); }
};

// Community features (Pickup / Room / Discussion) used to post to "All" from the browser with the REST key.
// Now server-side and disabled unless ONESIGNAL_ALLOW_BROADCAST=true is set in Netlify.
export const sendBroadcast = async (message, title = 'ClingNot') => {
  try { await sendPush({ kind: 'broadcast', title, message }); } catch (error) { console.warn('Broadcast not sent:', error.message); }
};
