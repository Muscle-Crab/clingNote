// Calls the server-side AI function. No OpenAI key in the browser.
import { auth } from '@/firebaseConfig';

export const askAi = async (task, input) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const r = await fetch('/.netlify/functions/ai', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, input }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || `AI failed (${r.status})`), { status: r.status });
  return data; // { content, creditsLeft? }
};
