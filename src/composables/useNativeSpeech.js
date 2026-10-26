// On-device speech recognition in the iOS app (Apple Speech framework, SFSpeechRecognizer, via the local ClingVoice plugin).
// WKWebView has no webkitSpeechRecognition, so the native plugin feeds the same transcript handler the web flow uses.
// (@capacitor-community/speech-recognition was evaluated but ships no Package.swift, and this app uses SwiftPM.)
import { ClingVoice, nativeVoiceAvailable } from '@/utils/clingVoice';

export const nativeSpeechAvailable = nativeVoiceAvailable;

// Starts one listening session. cb: { onPartial(text), onFinal(text), onError(msg), onState(listening) }. Returns stop().
export async function startNativeSpeech(cb, { silenceMs = 1800, lang = 'en-US' } = {}) {
  let last = ''; let done = false; let timer = null; const subs = [];
  const finish = async (emit = true) => {
    if (done) return; done = true; clearTimeout(timer);
    try { await ClingVoice.stopListening(); } catch (e) { /* already stopped */ }
    subs.forEach((s) => { try { s.remove(); } catch (e) { /* ignore */ } });
    cb.onState && cb.onState(false);
    if (emit) { if (last.trim()) cb.onFinal(last.trim()); else cb.onError("Didn't catch anything. Tap the mic and try again."); }
  };
  try {
    const { available } = await ClingVoice.recognitionAvailable();
    if (!available) { cb.onError('Speech recognition is not available on this device.'); return () => {}; }
    const perm = await ClingVoice.requestRecognitionPermission();
    if (!perm.granted) { cb.onError(`${perm.reason === 'microphone' ? 'Microphone' : 'Speech Recognition'} access is off. Turn it on in Settings > ClingNote, then try again.`); return () => {}; }
    subs.push(await ClingVoice.addListener('partialResults', (d) => {
      const t = (d && d.matches && d.matches[0]) || ''; if (!t) return; last = t; cb.onPartial(t);
      if (d.isFinal) { finish(true); return; }
      clearTimeout(timer); timer = setTimeout(() => finish(true), silenceMs); // stop on silence
    }));
    subs.push(await ClingVoice.addListener('listeningState', (d) => { if (d && d.status === 'stopped') finish(true); }));
    cb.onState && cb.onState(true);
    timer = setTimeout(() => finish(true), 8000); // nothing heard at all
    await ClingVoice.startListening({ language: lang });
  } catch (e) {
    done = true; clearTimeout(timer); cb.onState && cb.onState(false);
    cb.onError(/denied|not authorized|permission/i.test(String(e && e.message)) ? 'Microphone or Speech Recognition access is off. Turn it on in Settings > ClingNote.' : 'Could not start voice input.');
  }
  return () => finish(true);
}
