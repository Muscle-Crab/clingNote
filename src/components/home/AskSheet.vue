<template>
  <div class="ask-sheet" role="dialog" aria-modal="true" aria-label="Ask Anything" data-test="ask-sheet" @keydown.esc="$emit('close')">
    <header class="ask-head">
      <button type="button" class="ask-x" aria-label="Close" @click="$emit('close')">✕</button>
      <h2 class="ask-title">✨ Ask Anything</h2>
      <button type="button" class="ask-clear" data-test="ask-clear" :disabled="!msgs.length || busy" @click="clear">Clear</button>
    </header>
    <div ref="listEl" class="ask-list">
      <p v-if="!msgs.length" class="ask-empty">Ask any question — homework, recipes, ideas, how-tos, quick facts. Type or tap 🎙️ to speak.</p>
      <div v-for="(m, i) in msgs" :key="i" class="ask-bubble" :class="m.role === 'user' ? 'ask-bubble--me' : 'ask-bubble--ai'">
        <span class="ask-text">{{ m.content }}</span>
        <button v-if="m.role === 'assistant'" type="button" class="ask-speak" :aria-label="'Read aloud'" @click="readAloud(m.content)">🔊</button>
      </div>
      <div v-if="busy" class="ask-bubble ask-bubble--ai ask-typing" aria-live="polite">Thinking…</div>
      <p v-if="err" class="ask-err" role="alert">{{ err }} <router-link v-if="needsPro" to="/paywall?feature=ask" @click="$emit('close')">Go Pro</router-link></p>
    </div>
    <p v-if="remaining != null" class="ask-quota" data-test="ask-quota">{{ remaining }} free question{{ remaining === 1 ? '' : 's' }} left today</p>
    <form class="ask-bar" @submit.prevent="send()">
      <button type="button" class="ask-mic" :class="{ on: listening }" :aria-label="listening ? 'Stop dictation' : 'Dictate'" data-test="ask-mic" :disabled="busy || !micOk" @click="toggleMic">🎙️</button>
      <textarea v-model="draft" class="ask-in" rows="1" maxlength="2000" :placeholder="listening ? 'Listening… tap 🎙️ to stop' : 'Ask anything…'" data-test="ask-input" @keydown.enter.exact.prevent="send()"></textarea>
      <button type="submit" class="ask-send" data-test="ask-send" :disabled="busy || !draft.trim()">Send</button>
    </form>
  </div>
</template>

<script setup>
// "Ask Anything": general assistant chat. Conversation lives only in this session (module state, cleared by Clear / app restart).
// Server: netlify/functions/ai.js task 'ask' (Firebase token, daily free cap / Pro unlimited in lib/askConfig.js, Gemini or OpenAI).
import { ref, nextTick, onBeforeUnmount } from 'vue';
import { askAi } from '@/composables/useAi';
import { speakLive, stopVoice, unlockVoice } from '@/composables/useVoiceover';
import { startNativeSpeech, nativeSpeechAvailable } from '@/composables/useNativeSpeech';
import { askSession } from '@/utils/askSession';
defineEmits(['close']);
const msgs = askSession.msgs; const remaining = askSession.remaining;
const draft = ref(''); const busy = ref(false); const err = ref(''); const needsPro = ref(false); const listening = ref(false); const listEl = ref(null);
const native = nativeSpeechAvailable();
const WebSR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const micOk = native || !!WebSR;
const scroll = () => nextTick(() => { if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight; });
const send = async (text = draft.value) => {
  const q = String(text || '').trim(); if (!q || busy.value) return;
  stopMic(); err.value = ''; needsPro.value = false;
  const history = msgs.value.slice(-6).map((m) => ({ role: m.role, content: m.content }));
  msgs.value = [...msgs.value, { role: 'user', content: q }]; draft.value = ''; busy.value = true; scroll();
  try {
    const d = await askAi('ask', { question: q, history });
    msgs.value = [...msgs.value, { role: 'assistant', content: String(d.content || '').trim() || "Sorry, I don't have an answer for that." }];
    remaining.value = d.remaining == null ? null : d.remaining;
  } catch (e) {
    if (e.status === 429) { err.value = e.message; needsPro.value = !/Daily limit reached$/.test(e.message); remaining.value = needsPro.value ? 0 : null; }
    else if (e.status === 401 || /Not signed in/.test(e.message)) err.value = 'Sign in to ask questions.';
    else if (e.status === 'consent-declined') err.value = 'AI is off until you allow it.';
    else err.value = "Couldn't get an answer. Check your connection and try again.";
    msgs.value = msgs.value.slice(0, -1); draft.value = q; // put the question back so it can be resent
  } finally { busy.value = false; scroll(); }
};
const clear = () => { msgs.value = []; err.value = ''; stopVoice(); };
const readAloud = (t) => { unlockVoice(); stopVoice(); speakLive(t); };
let stopper = null; let rec = null;
const stopMic = () => { if (stopper) { const s = stopper; stopper = null; (s.finish || s)(); } if (rec) { try { rec.stop(); } catch (e) { /* ignore */ } rec = null; } listening.value = false; };
const toggleMic = async () => {
  if (listening.value) { stopMic(); return; }
  const base = draft.value.trim(); err.value = '';
  const put = (t) => { draft.value = `${base} ${t}`.trim(); };
  if (native) {
    stopper = await startNativeSpeech({ onPartial: put, onFinal: put, onError: (m) => { err.value = m; }, onState: (v) => { listening.value = v; } });
    return;
  }
  rec = new WebSR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.continuous = true;
  let fin = '';
  rec.onresult = (e) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += `${r[0].transcript} `; else interim += r[0].transcript; } put(`${fin}${interim}`); };
  rec.onend = () => { listening.value = false; rec = null; };
  rec.onerror = (e) => { if (e.error !== 'aborted' && e.error !== 'no-speech') err.value = 'Voice input failed.'; };
  try { rec.start(); listening.value = true; } catch (e) { err.value = 'Could not start voice input.'; }
};
onBeforeUnmount(() => { stopMic(); stopVoice(); });
scroll();
</script>

<style scoped>
.ask-sheet { position: fixed; inset: 0; z-index: 210; display: flex; flex-direction: column; background: var(--c-surface, #18181b); color: var(--c-text, #eee);
  padding: calc(env(safe-area-inset-top, 0px) + .5rem) .75rem calc(env(safe-area-inset-bottom, 0px) + .5rem); }
.ask-head { display: flex; align-items: center; gap: .5rem; padding-bottom: .5rem; border-bottom: 1px solid var(--c-border, #2a2a2e); }
.ask-title { flex: 1; margin: 0; font-size: 1.05rem; text-align: center; }
.ask-x, .ask-clear { background: none; border: none; color: var(--c-text-2, #aaa); font-size: .95rem; cursor: pointer; padding: .4rem .5rem; min-width: 44px; min-height: 44px; }
.ask-clear:disabled { opacity: .4; }
.ask-list { flex: 1; overflow-y: auto; padding: .75rem 0; display: flex; flex-direction: column; gap: .5rem; }
.ask-empty { color: var(--c-text-3, #888); text-align: center; margin-top: 2rem; padding: 0 1rem; }
.ask-bubble { max-width: 85%; padding: .55rem .75rem; border-radius: 14px; white-space: pre-wrap; line-height: 1.4; font-size: .95rem; position: relative; }
.ask-bubble--me { align-self: flex-end; background: var(--c-accent, #2f6fd6); color: #fff; }
.ask-bubble--ai { align-self: flex-start; background: var(--c-surface-2, #26262b); }
.ask-speak { background: none; border: none; cursor: pointer; margin-left: .35rem; font-size: .9rem; vertical-align: middle; }
.ask-typing { opacity: .7; font-style: italic; }
.ask-err { color: #f39b9b; font-size: .9rem; text-align: center; }
.ask-quota { font-size: .8rem; color: var(--c-text-3, #888); text-align: center; margin: .25rem 0; }
.ask-bar { display: flex; gap: .4rem; align-items: flex-end; }
.ask-in { flex: 1; resize: none; min-height: 44px; max-height: 8rem; padding: .6rem .7rem; border-radius: 12px; border: 1px solid var(--c-border-strong, #3a3a40); background: var(--c-surface-2, #26262b); color: inherit; font: inherit; }
.ask-mic, .ask-send { min-width: 44px; min-height: 44px; border-radius: 12px; border: 1px solid var(--c-border-strong, #3a3a40); background: var(--c-surface-2, #26262b); color: inherit; cursor: pointer; }
.ask-mic.on { background: #c0392b; color: #fff; }
.ask-send { background: var(--c-accent, #2f6fd6); color: #fff; padding: 0 .9rem; }
.ask-send:disabled, .ask-mic:disabled { opacity: .5; }
</style>
