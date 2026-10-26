<template>
  <div class="ask-sheet" role="dialog" aria-modal="true" aria-label="ClingNote assistant" data-test="assistant-sheet" @keydown.esc="$emit('close')">
    <header class="ask-head">
      <button type="button" class="ask-x" aria-label="Close" @click="$emit('close')">✕</button>
      <h2 class="ask-title">🤖 Assistant <small class="asst-ai">AI · Google Gemini</small></h2>
      <button type="button" class="ask-x" data-test="assistant-speak-toggle" :aria-pressed="speak ? 'true' : 'false'" :aria-label="speak ? 'Spoken replies on' : 'Spoken replies off'" @click="setSpeak(!speak)">
        <i :class="speak ? 'fas fa-volume-up' : 'fas fa-volume-mute'"></i>
      </button>
      <button type="button" class="ask-clear" data-test="assistant-clear" :disabled="!msgs.length || busy" @click="clear">Clear</button>
    </header>
    <div ref="listEl" class="ask-list" aria-live="polite">
      <p v-if="!msgs.length" class="ask-empty">Talk to me: "Plan my day: gym at 7, deep work on the report for two hours, then groceries." I can add, edit, move, delete and finish tasks, start your day, change settings, open pages and post to Community.</p>
      <div v-for="(m, i) in msgs" :key="i" class="ask-bubble" :class="m.role === 'user' ? 'ask-bubble--me' : m.role === 'action' ? 'asst-action' : 'ask-bubble--ai'">
        <span class="ask-text">{{ m.content }}</span>
        <button v-if="m.role === 'assistant'" type="button" class="ask-speak" aria-label="Read aloud" @click="readAloud(m.content)">🔊</button>
        <button v-if="m.role === 'assistant'" type="button" class="ask-speak" aria-label="Report this reply" data-test="assistant-report" @click="report(m)">⚑</button>
      </div>
      <div v-if="pending" class="asst-confirm" role="alertdialog" aria-label="Confirm action" data-test="assistant-confirm">
        <p class="asst-confirm-text">{{ pending.summary }}</p>
        <div class="asst-confirm-row">
          <button type="button" class="ask-mic" data-test="assistant-no" @click="decide(false)">Cancel</button>
          <button type="button" class="ask-send" data-test="assistant-yes" @click="decide(true)">{{ pending.name === 'post_to_community' ? 'Post' : pending.name === 'delete_task' ? 'Delete' : 'Confirm' }}</button>
        </div>
        <p class="ask-quota">Or say "yes" / "no".</p>
      </div>
      <div v-if="busy && !pending" class="ask-bubble ask-bubble--ai ask-typing">Thinking…</div>
      <p v-if="err" class="ask-err" role="alert">{{ err }} <router-link v-if="needsPro" to="/paywall?feature=ask" @click="$emit('close')">Go Pro</router-link></p>
    </div>
    <p v-if="remaining != null" class="ask-quota" data-test="assistant-quota">{{ remaining }} assistant message{{ remaining === 1 ? '' : 's' }} left today</p>
    <form class="ask-bar" @submit.prevent="send()">
      <button type="button" class="ask-mic" :class="{ on: listening }" :aria-label="listening ? 'Stop and send' : 'Talk'" data-test="assistant-mic" :disabled="(busy && !pending) || !micOk" @click="toggleMic">🎙️</button>
      <textarea v-model="draft" class="ask-in" rows="1" maxlength="2000" :placeholder="listening ? 'Listening… tap 🎙️ to send' : 'Say or type anything…'" data-test="assistant-input" @keydown.enter.exact.prevent="send()"></textarea>
      <button type="submit" class="ask-send" data-test="assistant-send" :disabled="(busy && !pending) || !draft.trim()">Send</button>
    </form>
  </div>
</template>

<script setup>
// ClingNote conversational assistant (voice + text, multi-turn, takes actions). Server: netlify/functions/ai.js task 'agent' (Gemini function calling).
// Tools are validated in utils/assistantTools.js and run by the `executor` prop (HomeView, same paths as the UI). Delete / complete / start day /
// Community posts wait for an explicit tap or spoken "yes". Replies are spoken through the existing boss voice stack (useVoiceover.speakLive).
import { ref, nextTick, onBeforeUnmount, onMounted } from 'vue';
import { askAi } from '@/composables/useAi';
import { speakLive, stopVoice, unlockVoice } from '@/composables/useVoiceover';
import { startNativeSpeech, nativeSpeechAvailable } from '@/composables/useNativeSpeech';
import { assistantSession, saveAssistant, clearAssistant } from '@/utils/assistantSession';
import { runAgentTurn } from '@/utils/assistantLoop';
import { spokenConfirm, ttsText } from '@/utils/assistantTools';

const props = defineProps({ executor: { type: Object, required: true }, listenOnOpen: Boolean });
const emit = defineEmits(['close', 'state']);
const msgs = assistantSession.msgs; const remaining = assistantSession.remaining; const speak = assistantSession.speak;
const draft = ref(''); const busy = ref(false); const err = ref(''); const needsPro = ref(false); const listening = ref(false); const listEl = ref(null);
const pending = ref(null);
const native = nativeSpeechAvailable();
const WebSR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const micOk = native || !!WebSR;
const scroll = () => nextTick(() => { if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight; });
const push = (role, content) => { msgs.value = [...msgs.value, { role, content }]; scroll(); };
const setSpeak = (v) => { speak.value = v; if (!v) stopVoice(); saveAssistant(); };
const say = (t) => { if (speak.value) { unlockVoice(); stopVoice(); speakLive(ttsText(t)); } };
const decide = (yes) => { const p = pending.value; if (!p) return; pending.value = null; push('action', yes ? `✔ ${p.summary.split('\n')[0]}` : '✖ Cancelled'); p.resolve(!!yes); };
const confirm = (c) => new Promise((resolve) => { pending.value = { ...c, resolve }; emit('state', { pending: true }); scroll(); say(c.name === 'post_to_community' ? 'Here is the draft post. Post it?' : `${c.summary} Say yes or no.`); });
const LABEL = { create_tasks: '➕ Added', edit_task: '✏️ Edited', reschedule_task: '📅 Moved', delete_task: '🗑 Deleted', complete_task: '✅ Done', start_timer: '⏱ Timer started', set_boss_checkin: '👔 Boss check-in', start_day: '🔒 Day started', set_day_hours: '⏳ Hours set', set_setting: '⚙️ Setting', navigate: '🧭 Opened', post_to_community: '📣 Posted' };
const onEvent = (e) => { if (e.type === 'ran' && LABEL[e.name] && !(e.response && e.response.error)) push('action', `${LABEL[e.name]}${e.response && e.response.summary ? `: ${e.response.summary}` : ''}`); };
const call = (input) => askAi('agent', input);

const send = async (text = draft.value) => {
  const q = String(text || '').trim(); if (!q) return;
  if (pending.value) { const d = spokenConfirm(q); if (d) { draft.value = ''; decide(d === 'yes'); return; } decide(false); draft.value = q; return; } // anything else = no; text stays in the box to send next
  if (busy.value) return;
  stopMic(); stopVoice(); err.value = ''; needsPro.value = false;
  push('user', q); draft.value = ''; busy.value = true; emit('state', { busy: true });
  try {
    const r = await runAgentTurn({ text: q, contents: assistantSession.contents.value, call, executor: props.executor, confirm, onEvent });
    assistantSession.contents.value = r.contents;
    if (r.remaining !== undefined) remaining.value = r.remaining == null ? null : r.remaining;
    push('assistant', r.reply); say(r.reply);
  } catch (e) {
    if (e.status === 429) { err.value = e.message; needsPro.value = !/Daily limit reached$/.test(e.message); remaining.value = needsPro.value ? 0 : null; }
    else if (e.status === 401 || /Not signed in/.test(e.message)) err.value = 'Sign in to use the assistant.';
    else if (e.status === 'consent-declined') err.value = 'AI is off until you allow it.';
    else err.value = "Couldn't reach the assistant. Check your connection and try again.";
    msgs.value = msgs.value.filter((m, i) => !(i === msgs.value.length - 1 && m.role === 'user')); draft.value = q;
  } finally { busy.value = false; pending.value = null; saveAssistant(); emit('state', { busy: false, pending: false }); scroll(); }
};
const clear = () => { clearAssistant(); err.value = ''; stopVoice(); };
const readAloud = (t) => { unlockVoice(); stopVoice(); speakLive(ttsText(t, 6)); };
const report = (m) => { m.reported = true; push('action', '⚑ Reported. Thanks, we review flagged AI replies.'); try { const k = 'cn.assistant.reports'; const l = JSON.parse(localStorage.getItem(k) || '[]'); l.push({ at: Date.now(), text: String(m.content).slice(0, 500) }); localStorage.setItem(k, JSON.stringify(l.slice(-50))); } catch (e) { /* ignore */ } };

let stopper = null; let rec = null;
const stopMic = () => { if (stopper) { const s = stopper; stopper = null; (s.finish || s)(); } if (rec) { try { rec.stop(); } catch (e) { /* ignore */ } rec = null; } listening.value = false; };
const toggleMic = async () => {
  if (listening.value) { stopMic(); if (draft.value.trim()) send(); return; } // tap again = send (push-to-talk)
  stopVoice(); // barge-in
  const base = draft.value.trim(); err.value = '';
  const put = (t) => { draft.value = `${base} ${t}`.trim(); };
  if (native) { stopper = await startNativeSpeech({ onPartial: put, onFinal: put, onError: (m) => { err.value = m; }, onState: (v) => { listening.value = v; emit('state', { listening: v }); } }); return; }
  rec = new WebSR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.continuous = true;
  let fin = '';
  rec.onresult = (e) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += `${r[0].transcript} `; else interim += r[0].transcript; } put(`${fin}${interim}`); };
  rec.onend = () => { listening.value = false; rec = null; };
  rec.onerror = (e) => { if (e.error !== 'aborted' && e.error !== 'no-speech') err.value = 'Voice input failed.'; };
  try { rec.start(); listening.value = true; } catch (e) { err.value = 'Could not start voice input.'; }
};
onMounted(() => { if (props.listenOnOpen && micOk) toggleMic(); });
onBeforeUnmount(() => { stopMic(); stopVoice(); if (pending.value) decide(false); });
scroll();
</script>

<style scoped>
.ask-sheet { position: fixed; inset: 0; z-index: 210; display: flex; flex-direction: column; background: var(--c-surface, #18181b); color: var(--c-text, #eee);
  padding: calc(env(safe-area-inset-top, 0px) + .5rem) .75rem calc(env(safe-area-inset-bottom, 0px) + .75rem); overscroll-behavior: contain; }
.ask-head { display: flex; align-items: center; gap: .25rem; padding-bottom: .5rem; border-bottom: 1px solid var(--c-border, #2a2a2e); }
.ask-title { flex: 1; margin: 0; font-size: 1.05rem; text-align: center; }
.asst-ai { display: block; font-size: .7rem; font-weight: 400; color: var(--c-text-3, #888); }
.ask-x, .ask-clear { background: none; border: none; color: var(--c-text-2, #aaa); font-size: .95rem; cursor: pointer; padding: .4rem .5rem; min-width: 44px; min-height: 44px; }
.ask-clear:disabled { opacity: .4; }
.ask-list { flex: 1; overflow-y: auto; padding: .75rem 0; display: flex; flex-direction: column; gap: .5rem; }
.ask-empty { color: var(--c-text-3, #888); text-align: center; margin-top: 2rem; padding: 0 1rem; }
.ask-bubble { max-width: 85%; padding: .55rem .75rem; border-radius: 14px; white-space: pre-wrap; line-height: 1.4; font-size: .95rem; position: relative; }
.ask-bubble--me { align-self: flex-end; background: var(--c-accent, #2f6fd6); color: #fff; }
.ask-bubble--ai { align-self: flex-start; background: var(--c-surface-2, #26262b); }
.asst-action { align-self: center; font-size: .8rem; color: var(--c-text-2, #aaa); padding: .2rem .5rem; }
.asst-confirm { align-self: stretch; border: 1px solid var(--c-accent, #2f6fd6); border-radius: 14px; padding: .75rem; background: var(--c-surface-2, #26262b); }
.asst-confirm-text { white-space: pre-wrap; margin: 0 0 .5rem; }
.asst-confirm-row { display: flex; gap: .5rem; justify-content: flex-end; }
.ask-speak { background: none; border: none; cursor: pointer; margin-left: .35rem; font-size: .9rem; vertical-align: middle; color: inherit; }
.ask-typing { opacity: .7; font-style: italic; }
.ask-err { color: #f39b9b; font-size: .9rem; text-align: center; }
.ask-quota { font-size: .8rem; color: var(--c-text-3, #888); text-align: center; margin: .25rem 0; }
.ask-bar { display: flex; gap: .4rem; align-items: flex-end; }
.ask-in { flex: 1; resize: none; min-height: 44px; max-height: 8rem; padding: .6rem .7rem; border-radius: 12px; border: 1px solid var(--c-border-strong, #3a3a40); background: var(--c-surface-2, #26262b); color: inherit; font: inherit; }
.ask-mic, .ask-send { min-width: 44px; min-height: 44px; border-radius: 12px; border: 1px solid var(--c-border-strong, #3a3a40); background: var(--c-surface-2, #26262b); color: inherit; cursor: pointer; padding: 0 .7rem; }
.ask-mic.on { background: #c0392b; color: #fff; }
.ask-send { background: var(--c-accent, #2f6fd6); color: #fff; padding: 0 .9rem; }
.ask-send:disabled, .ask-mic:disabled { opacity: .5; }
</style>
