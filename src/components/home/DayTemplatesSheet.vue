<template>
  <!-- Day templates: save today's tasks under a name; Apply adds them to today (tasks already on today are skipped). -->
  <Teleport to="body">
  <div class="dsp" role="dialog" aria-modal="true" aria-labelledby="dts-t" data-test="day-templates" @click.self="$emit('close')">
    <div class="dsp-card">
      <h2 id="dts-t">Day templates</h2>
      <p v-if="!templates.length" class="dsp-sub" data-test="tpl-empty">No templates yet. Save today's tasks below and apply them any morning.</p>
      <ul v-else class="dts-list">
        <li v-for="t in templates" :key="t.id" class="dts-row" :data-test="`tpl-${t.id}`">
          <div class="dts-info"><b class="dts-name">{{ t.name }}</b><span class="dts-meta">{{ t.items.length }} task{{ t.items.length === 1 ? '' : 's' }}{{ t.withTimes ? ' · with times' : '' }}</span></div>
          <button type="button" class="dsp-btn dsp-btn--primary dts-btn" :disabled="busy" data-test="tpl-apply" @click="$emit('apply', t)">Apply</button>
          <button type="button" class="dsp-btn dts-btn dts-del" :disabled="busy" :aria-label="confirmDel === t.id ? `Confirm delete ${t.name}` : `Delete ${t.name}`" data-test="tpl-delete"
                  @click="confirmDel === t.id ? ($emit('remove', t), confirmDel = '') : (confirmDel = t.id)">{{ confirmDel === t.id ? 'Sure?' : '✕' }}</button>
        </li>
      </ul>
      <div class="dts-save">
        <p class="dts-h">Save today as a template ({{ taskCount }} task{{ taskCount === 1 ? '' : 's' }})</p>
        <input v-model="name" class="dts-input" maxlength="40" placeholder="Name, e.g. Workday" aria-label="Template name" data-test="tpl-name" />
        <label class="dts-check"><input v-model="withTimes" type="checkbox" data-test="tpl-times" /> Include start times</label>
        <button type="button" class="dsp-btn" :disabled="busy || !name.trim() || !taskCount" data-test="tpl-save" @click="$emit('save', { name: name.trim(), withTimes }); name = ''">Save template</button>
      </div>
      <p v-if="error" class="dsp-err" role="alert" data-test="tpl-error">{{ error }}</p>
      <p v-if="note" class="dsp-fine" role="status" data-test="tpl-note">{{ note }}</p>
      <button type="button" class="dsp-btn dsp-skip" data-test="tpl-close" @click="$emit('close')">Close</button>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
defineProps({ templates: { type: Array, default: () => [] }, taskCount: { type: Number, default: 0 }, busy: Boolean, error: { type: String, default: '' }, note: { type: String, default: '' } });
defineEmits(['apply', 'save', 'remove', 'close']);
const name = ref(''); const withTimes = ref(false); const confirmDel = ref('');
</script>

<style scoped>
.dsp { /* teleported to <body>, outside .app-shell: carry the navy theme tokens */ --c-surface: #0C1630; --c-surface-2: #12203F; --c-border: #1A2846; --c-text: #F2F5FC; --c-text-2: #A9B4CC; --c-text-3: #7180A0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: fixed; inset: 0; z-index: 9400; padding-top: max(16px, env(safe-area-inset-top)) !important; display: grid; place-items: center; padding: 16px; background: rgba(4,8,18,.82); backdrop-filter: blur(4px); }
.dsp-card { width: min(380px, 100%); max-height: calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); overflow-y: auto; background: var(--c-surface, #16181c); border: 1px solid var(--c-border, #2a2a2e); border-radius: 18px; padding: 20px; color: var(--c-text, #e6e6e6); text-align: center; }
.dsp-card h2 { font-size: 1.15rem; margin: 0 0 12px; }
.dsp-sub { margin: 4px 0 12px; color: var(--c-text-2, #b0b0b0); } .dsp-fine { font-size: .8rem; color: var(--c-text-3, #9aa3b5); margin: 8px 0 0; }
.dsp-err { color: #e05a5a; font-size: .85rem; margin: 8px 0 0; }
.dsp-btn { min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: inherit; font-weight: 700; width: 100%; }
.dsp-btn--primary { background: #378ADD; border-color: #378ADD; color: #fff; }
.dsp-btn:disabled { opacity: .5; }
.dsp-skip { background: transparent; border: 0; text-decoration: underline; opacity: .8; margin-top: 8px; }
.dts-list { list-style: none; margin: 0 0 12px; padding: 0; text-align: left; }
.dts-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: var(--c-surface-2, #22252a); margin-bottom: 6px; }
.dts-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dts-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .dts-meta { font-size: .78rem; color: var(--c-text-3, #9aa3b5); }
.dts-btn { width: auto; min-height: 40px; padding: 0 12px; } .dts-del { background: transparent; }
.dts-save { border-top: 1px solid var(--c-border, #2a2a2e); padding-top: 12px; text-align: left; }
.dts-h { font-weight: 600; margin: 0 0 8px; }
.dts-input { width: 100%; height: 44px; font-size: 16px; border-radius: 12px; background: var(--c-surface-2, #22252a); color: inherit; border: 1px solid var(--c-border, #2a2a2e); padding: 0 12px; box-sizing: border-box; }
.dts-check { display: flex; align-items: center; gap: 8px; margin: 10px 0; font-size: .9rem; color: var(--c-text-2, #b0b0b0); }
</style>
