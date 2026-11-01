// Interpret a spoken utterance into items for the confirm sheet.
// If the caller passes `ask` (Pro + signed in + AI consent already given), the existing server-side /ai function
// (task 'voice-intent', OpenAI key stays on the server; all calls go through useAi.askAi) is tried first with a 6 s timeout.
// Any failure (not deployed with this task, offline, bad JSON) falls back to the local parser. Output is always validated.
import { parseUtterance, normalizeItems, ymd } from '@/utils/voiceIntent';

const localNow = (d) => `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
export async function interpretSpeech(text, { ask = null, now = new Date(), timeoutMs = 12000 } = {}) {
  const local = parseUtterance(text, now);
  if (!ask) return { items: local, source: 'local' };
  try {
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ''; } })();
    const data = await Promise.race([ask('voice-intent', { text, now: localNow(now), tz }), timeout(timeoutMs)]);
    if (!data) return { items: local, source: 'local' };
    const parsed = JSON.parse(String(data.content || '{}').replace(/^```(?:json)?\s*|\s*```$/g, '')) || {};
    const items = normalizeItems(Array.isArray(parsed) ? parsed : parsed.items, now);
    return items.length ? { items, source: 'ai' } : { items: local, source: 'local' };
  } catch (e) { return { items: local, source: 'local' }; }
}
