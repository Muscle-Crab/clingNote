<template>
  <div v-if="open" class="rd-back" @click.self="$emit('close')" data-test="report-dialog">
    <div class="rd" role="dialog" aria-modal="true" aria-label="Report message">
      <template v-if="!done">
        <h3>Report this message?</h3>
        <p v-if="message" class="rd-quote">“{{ message.text }}”</p>
        <p class="rd-muted">Why are you reporting it?</p>
        <div class="rd-reasons">
          <button v-for="r in REASONS" :key="r.id" type="button" :class="{ on: reason === r.id }" @click="reason = r.id" :data-test="`reason-${r.id}`">{{ r.l }}</button>
        </div>
        <label v-if="canBlock" class="rd-check"><input type="checkbox" v-model="alsoBlock" data-test="report-also-block" /> Also block {{ who || 'them' }}</label>
        <p v-if="error" class="rd-err">{{ error }}</p>
        <div class="rd-row">
          <button type="button" class="rd-btn" @click="$emit('close')">Cancel</button>
          <button type="button" class="rd-btn bad" :disabled="busy" @click="submit" data-test="report-submit">{{ busy ? '…' : 'Report' }}</button>
        </div>
      </template>
      <template v-else>
        <h3>Thanks, it's reported</h3>
        <p class="rd-muted">We review reports within 24 hours.<template v-if="blocked"> {{ who || 'They' }} {{ who ? 'is' : 'are' }} blocked and can't message you or reconnect.</template></p>
        <a class="rd-link" :href="mailto" data-test="report-email">Email support (optional)</a>
        <div class="rd-row"><button type="button" class="rd-btn pri" @click="$emit('close')" data-test="report-close">Done</button></div>
      </template>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch } from 'vue';
const props = defineProps({ open: { type: Boolean, default: false }, message: { type: Object, default: null }, who: { type: String, default: '' }, canBlock: { type: Boolean, default: false }, send: { type: Function, required: true } });
defineEmits(['close']);
const SUPPORT = 'musclecrabs@gmail.com';
const REASONS = [{ id: 'harassment', l: 'Harassment or bullying' }, { id: 'inappropriate', l: 'Inappropriate' }, { id: 'spam', l: 'Spam' }, { id: 'other', l: 'Something else' }];
const reason = ref('harassment'); const alsoBlock = ref(false); const busy = ref(false); const done = ref(false); const blocked = ref(false); const error = ref(''); const reportId = ref('');
watch(() => props.open, (o) => { if (o) { reason.value = 'harassment'; alsoBlock.value = false; done.value = false; blocked.value = false; error.value = ''; } });
const submit = async () => {
  busy.value = true; error.value = '';
  try { const r = await props.send({ reason: reason.value, block: props.canBlock && alsoBlock.value }); reportId.value = (r && r.reportId) || ''; blocked.value = props.canBlock && alsoBlock.value; done.value = true; }
  catch (e) { error.value = e.message || 'Could not send the report'; } finally { busy.value = false; }
};
const mailto = computed(() => `mailto:${SUPPORT}?subject=${encodeURIComponent('CleanNote report ' + (reportId.value || ''))}&body=${encodeURIComponent(`I reported a message in CleanNote (reason: ${reason.value}).\n\nMessage: "${(props.message && props.message.text) || ''}"\n\nMore details:\n`)}`);
</script>
<style scoped>
.rd-back { position: fixed; inset: 0; z-index: 80; background: rgba(3,7,18,.72); display: flex; align-items: flex-end; justify-content: center; padding: 16px; }
.rd { width: 100%; max-width: 440px; background: #0F1A36; border: 1px solid #2A3C66; border-radius: 18px; padding: 18px; color: #F2F5FC; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-bottom: env(safe-area-inset-bottom); }
.rd h3 { margin: 0 0 8px; font-size: 18px; } .rd-muted { color: #A9B4CC; font-size: 14px; margin: 8px 0; }
.rd-quote { background: #12203F; border-radius: 12px; padding: 10px 12px; font-size: 14px; color: #D6DDEE; margin: 0 0 6px; word-break: break-word; }
.rd-reasons { display: flex; flex-wrap: wrap; gap: 8px; }
.rd-reasons button { min-height: 38px; padding: 0 12px; border-radius: 999px; border: 1px solid #2A3C66; background: transparent; color: #D6DDEE; font-size: 14px; }
.rd-reasons button.on { background: #2F6FFF; border-color: #2F6FFF; color: #fff; }
.rd-check { display: flex; gap: 8px; align-items: center; margin-top: 14px; font-size: 14px; color: #D6DDEE; }
.rd-row { display: flex; gap: 10px; margin-top: 16px; } .rd-btn { flex: 1; min-height: 44px; border-radius: 12px; border: 1px solid #2A3C66; background: #12203F; color: #F2F5FC; font-weight: 600; font-size: 15px; }
.rd-btn.bad { background: #3A1420; border-color: #7F1D1D; color: #FCA5A5; } .rd-btn.pri { background: #2F6FFF; border-color: #2F6FFF; }
.rd-link { display: inline-block; color: #7FB0FF; font-size: 14px; text-decoration: underline; margin-top: 4px; min-height: 32px; }
.rd-err { color: #F87171; font-size: 13px; }
</style>
