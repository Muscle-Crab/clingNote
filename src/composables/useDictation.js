// Bare speech-to-text for an input: tap to start, words fill the field, tap again or a pause stops it.
// No AI, no parsing, no auto-create: the caller's input just receives the text and the user saves it as usual.
// iOS uses the on-device ClingVoice plugin (WKWebView has no webkitSpeechRecognition); web uses SpeechRecognition.
import { ref } from 'vue';
import { ClingVoice, nativeVoiceAvailable } from '../utils/clingVoice.js';

export function createDictation({ native = nativeVoiceAvailable(), plugin = ClingVoice,
  WebSR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null } = {}) {
  const listening = ref(false); const error = ref('');
  const supported = !!native || !!WebSR;
  let stopFn = null;
  const stop = () => { const s = stopFn; stopFn = null; listening.value = false; if (s) s(); };

  // put(text): called with base + spoken text on every partial result.
  const start = async (base, put) => {
    error.value = ''; const pre = String(base || '').trim();
    const fill = (t) => put(`${pre} ${String(t || '').trim()}`.trim());
    if (native) {
      const subs = [];
      const end = () => { subs.forEach((s) => { try { s.remove(); } catch (e) { /* ignore */ } }); plugin.stopListening().catch(() => {}); };
      stopFn = end; listening.value = true;
      try {
        const perm = await plugin.requestRecognitionPermission();
        if (stopFn !== end) return; // tapped stop / closed while the permission prompt was up
        if (!perm || !perm.granted) throw new Error('permission');
        subs.push(await plugin.addListener('partialResults', (d) => {
          if (stopFn !== end) return;
          const t = d && d.matches && d.matches[0]; if (t) fill(t);
          if (d && d.isFinal) stop(); // pause = done
        }));
        subs.push(await plugin.addListener('listeningState', (d) => { if (d && d.status === 'stopped' && stopFn === end) stop(); }));
        if (stopFn !== end) { end(); return; }
        await plugin.startListening({ language: 'en-US' });
        if (stopFn !== end) plugin.stopListening().catch(() => {}); // stopped while starting: don't leave the mic on
      } catch (e) {
        stop();
        error.value = /permission|denied|authori/i.test(String(e && e.message)) ? 'Microphone or Speech Recognition access is off. Turn it on in Settings > ClingNote.' : 'Could not start voice input.';
      }
      return;
    }
    if (!WebSR) { error.value = 'Voice input is not supported in this browser.'; return; }
    const rec = new WebSR(); rec.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    rec.interimResults = true; rec.continuous = false; // stops on its own after a pause
    rec.onresult = (e) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; fill(t); };
    rec.onend = () => { if (stopFn) { stopFn = null; listening.value = false; } };
    rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') error.value = 'Microphone access was blocked. Allow it in your browser settings.'; else if (e.error !== 'aborted' && e.error !== 'no-speech') error.value = 'Voice input failed.'; };
    stopFn = () => { try { rec.stop(); } catch (e) { /* ignore */ } };
    try { rec.start(); listening.value = true; } catch (e) { stopFn = null; error.value = 'Could not start voice input.'; }
  };
  const toggle = (base, put) => (listening.value ? stop() : start(base, put));
  return { listening, error, supported, start, stop, toggle };
}
export const useDictation = createDictation;
