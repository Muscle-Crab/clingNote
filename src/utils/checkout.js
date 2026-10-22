// Provider-agnostic checkout client. Backend: netlify/functions/create-checkout.js
export async function startCheckout({ planId, user }) {
  try {
    const token = user?.getIdToken ? await user.getIdToken() : '';
    const res = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.url) { window.location.href = data.url; return { ok: true }; }
    return { ok: false, notConfigured: data.configured === false || res.status === 501 || res.status === 404, error: data.error };
  } catch (e) { return { ok: false, notConfigured: true }; }
}
