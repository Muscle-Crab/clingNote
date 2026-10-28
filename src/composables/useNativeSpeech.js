// On-device speech recognition in the iOS app (Apple Speech framework, SFSpeechRecognizer, via the local ClingVoice plugin).
// WKWebView has no webkitSpeechRecognition, so the native plugin feeds the same transcript handler the web flow uses.
// (@capacitor-community/speech-recognition was evaluated but ships no Package.swift, and this app uses SwiftPM.)
import { ClingVoice, nativeVoiceAvailable } from '@/utils/clingVoice';

export const nativeSpeechAvailable = nativeVoiceAvailable;

// Long dictation: keeps listening through pauses until the caller calls finish() (Done) or cancel().
// SFSpeechRecognizer ends a request on a final result / long silence / ~1 min; each ended segment is committed and a new
// segment is started, so the transcript is the concatenation of all segments.
// cb: { onPartial(text), onFinal(text), onError(msg), onState(listening) }. Returns { finish, cancel } (also callable: fn() = finish).
export async function startNativeSpeech(cb, { lang = 'en-US', maxMs = 10 * 60 * 1000, noSpeechMs = 15000 } = {}) {
  let committed = ''; let seg = ''; let done = false; let restarting = false; let fails = 0; const subs = [];
  const text = () => `${committed} ${seg}`.replace(/\s+/g, ' ').trim();
  const commit = () => { if (seg.trim()) { committed = `${committed} ${/[.!?]$/.test(seg.trim()) ? seg.trim() : seg.trim() + '.'}`.trim(); } seg = ''; };
  let capTimer = null; let idleTimer = null;
  const finish = async (emit = true) => {
    if (done) return; done = true; clearTimeout(capTimer); clearTimeout(idleTimer);
    try { await ClingVoice.stopListening(); } catch (e) { /* already stopped */ }
    subs.forEach((s) => { try { s.remove(); } catch (e) { /* ignore */ } });
    cb.onState && cb.onState(false);
    commit();
    if (emit) { if (committed.trim()) cb.onFinal(committed.trim()); else cb.onError("Didn't catch anything. Tap the mic and try again."); }
  };
  const restart = () => {
    if (done || restarting) return; restarting = true; commit();
    setTimeout(async () => {
      restarting = false; if (done) return;
      try { await ClingVoice.startListening({ language: lang }); fails = 0; }
      catch (e) { if (++fails >= 3) finish(true); else restart(); }
    }, 250);
  };
  try {
    const { available } = await ClingVoice.recognitionAvailable();
    if (!available) { cb.onError('Speech recognition is not available on this device.'); return Object.assign(() => {}, { finish: () => {}, cancel: () => {} }); }
    const perm = await ClingVoice.requestRecognitionPermission();
    if (!perm.granted) { cb.onError(`${perm.reason === 'microphone' ? 'Microphone' : 'Speech Recognition'} access is off. Turn it on in Settings > ClingNote, then try again.`); return Object.assign(() => {}, { finish: () => {}, cancel: () => {} }); }
    subs.push(await ClingVoice.addListener('partialResults', (d) => {
      const t = (d && d.matches && d.matches[0]) || ''; if (!t || done) return; seg = t; cb.onPartial(text());
      clearTimeout(idleTimer);
      if (d.isFinal) restart(); // segment ended (pause / ~1 min limit): keep going in a new segment
    }));
    subs.push(await ClingVoice.addListener('listeningState', (d) => { if (d && d.status === 'stopped' && !done) restart(); }));
    cb.onState && cb.onState(true);
    capTimer = setTimeout(() => finish(true), maxMs); // safety cap
    idleTimer = setTimeout(() => { if (!text()) finish(true); }, noSpeechMs); // nothing heard at all
    await ClingVoice.startListening({ language: lang });
  } catch (e) {
    done = true; clearTimeout(capTimer); clearTimeout(idleTimer); cb.onState && cb.onState(false);
    cb.onError(/denied|not authorized|permission/i.test(String(e && e.message)) ? 'Microphone or Speech Recognition access is off. Turn it on in Settings > ClingNote.' : 'Could not start voice input.');
  }
  return Object.assign(() => finish(true), { finish: () => finish(true), cancel: () => finish(false) });
}
