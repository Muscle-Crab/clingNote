// Native iOS voice input (SFSpeechRecognizer through @capgo/capacitor-speech-recognition, the SPM-compatible Capacitor 8 plugin).
// The web keeps using the browser SpeechRecognition API in HomeView; this module is only used inside the iOS shell. It feeds the same
// downstream logic: every finished phrase goes to onPhrase(text) -> splitSpokenTasks -> addNewTask.
import { isNativeIOS, setNativeVoiceAvailable } from '@/utils/platform';

export const MSG_DENIED = 'Microphone or Speech Recognition access is off for ClingNot. Turn both on in Settings > ClingNot, then try again.';
export const MSG_UNAVAILABLE = "Speech recognition isn't available right now (it may be offline or unsupported for your language). Tap Add Task to type instead.";
export const MSG_NOTHING = "Didn't catch anything. Tap the mic and try again.";
export const MSG_FAILED = 'Voice input failed. Close this and try again.';

let pluginPromise = null;
const loadPlugin = () => { if (!pluginPromise) pluginPromise = import('@capgo/capacitor-speech-recognition').then((m) => m.SpeechRecognition); return pluginPromise; };

// available() is the gate: the mic button only exists on iOS when the recognizer reports it can run.
let probing = null;
export const probeNativeVoice = (loader = loadPlugin, native = isNativeIOS) => {
  if (!native()) return Promise.resolve(false);
  if (!probing) {
    probing = (async () => {
      try { const sr = await loader(); const r = await sr.available(); const ok = !!(r && r.available); setNativeVoiceAvailable(ok); return ok; }
      catch (e) { setNativeVoiceAvailable(false); return false; }
    })();
  }
  return probing;
};
export const getNativeSpeech = () => loadPlugin();

// 'granted' -> ok; 'denied' -> message pointing at Settings; 'prompt' -> ask once, then re-check.
export const ensureVoicePermission = async (sr) => {
  try {
    let st = (await sr.checkPermissions())?.speechRecognition;
    if (st === 'granted') return { ok: true };
    if (st === 'denied') return { ok: false, message: MSG_DENIED };
    st = (await sr.requestPermissions())?.speechRecognition;
    return st === 'granted' ? { ok: true } : { ok: false, message: MSG_DENIED };
  } catch (e) { return { ok: false, message: MSG_FAILED }; }
};
export const mapStartError = (e) => {
  const m = String((e && (e.message || e)) || '');
  if (/permission|denied/i.test(m)) return MSG_DENIED;
  if (/unavailable|unsupported|locale/i.test(m)) return MSG_UNAVAILABLE;
  return MSG_FAILED;
};

// Hands-free session: partial results stream into onPartial (live transcript); a pause (silenceMs without a change) or the recognizer ending a
// phrase flushes the text to onPhrase and listening restarts, until stop() or too many empty rounds in a row.
export const createNativeVoice = (sr, { language = 'en-US', onPartial = () => {}, onPhrase = () => {}, onListening = () => {}, onError = () => {}, silenceMs = 1500, maxEmpty = 2, delay = 250, setT = setTimeout, clearT = clearTimeout } = {}) => {
  let active = false; let text = ''; let timer = null; let restartT = null; let softStop = false; let empty = 0; const handles = [];
  const clear = () => { if (timer) { clearT(timer); timer = null; } };
  const flush = () => { clear(); const t = text.trim(); text = ''; onPartial(''); if (t) { empty = 0; onPhrase(t); } return t; };
  const fail = (msg) => { active = false; clear(); onListening(false); onError(msg); };
  const begin = async () => {
    if (!active) return;
    try { await sr.start({ language, maxResults: 1, partialResults: true, popup: false, addPunctuation: false }); }
    catch (e) { if (active) fail(mapStartError(e)); }
  };
  const onStopped = () => {
    onListening(false);
    if (!active) return;
    const had = flush();
    if (softStop) softStop = false; else if (!had) empty++;
    if (empty > maxEmpty) { fail(MSG_NOTHING); return; }
    restartT = setT(begin, delay);
  };
  const arm = () => { clear(); timer = setT(() => { timer = null; if (!active || !text.trim()) return; softStop = true; flush(); Promise.resolve(sr.stop()).catch(() => {}); }, silenceMs); };
  return {
    isActive: () => active,
    async start() {
      if (active) return true;
      const perm = await ensureVoicePermission(sr);
      if (!perm.ok) { onError(perm.message); return false; }
      active = true; empty = 0; text = ''; softStop = false;
      try {
        await sr.removeAllListeners();
        handles.push(await sr.addListener('partialResults', (e) => { if (!active) return; text = String((e && e.matches && e.matches[0]) || ''); onPartial(text); if (text.trim()) arm(); }));
        handles.push(await sr.addListener('listeningState', (e) => { if (!e) return; if (e.status === 'started') onListening(true); else if (e.status === 'stopped') onStopped(); }));
      } catch (e) { fail(MSG_FAILED); return false; }
      await begin();
      return active;
    },
    // Close without saving the half-heard phrase (same as cancelling the browser recognizer).
    async stop() {
      active = false; text = ''; clear(); if (restartT) { clearT(restartT); restartT = null; }
      onPartial(''); onListening(false);
      try { await sr.stop(); } catch (e) { /* not running */ }
      try { await sr.removeAllListeners(); } catch (e) { /* ignore */ }
      handles.length = 0;
    },
    // Stop listening but leave the error/hint on screen (e.g. a spoken task could not be added).
    async pause() { active = false; clear(); if (restartT) { clearT(restartT); restartT = null; } try { await sr.stop(); } catch (e) { /* ignore */ } },
  };
};
