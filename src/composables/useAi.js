// Calls the server-side AI function. No OpenAI key in the browser.
import { auth } from '@/firebaseConfig';
import { fnUrl } from '@/config/api';
import { ensureAiConsent } from '@/composables/useAiConsent';

export const askAi = async (task, input) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  // Backstop: nothing leaves the device for OpenAI without the user's one-time consent (callers also ask early for a better flow).
  if (!(await ensureAiConsent())) throw Object.assign(new Error('AI consent declined'), { status: 'consent-declined' });
  const r = await fetch(fnUrl('ai'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, input }),
  });
  const data = await r.json().catch(() => ({}));
  // In-app navigation (a full page load would reload the whole SPA / shell and lose state).
  if (r.status === 402 && data.error === 'Pro required') { try { (await import('@/router')).default.push({ path: '/paywall', query: { feature: 'aiCoach' } }); } catch (e) { /* router unavailable */ } }
  if (!r.ok) throw Object.assign(new Error(data.error || `AI failed (${r.status})`), { status: r.status });
  return data; // { content, creditsLeft? }
};
