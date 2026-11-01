<template>
  <!-- B39 Stats (Profile › More › Stats): 12-week heatmap from existing completion history + rate + active-day streaks.
       Read-only; same sheet style as Break it down / Time off. -->
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-box modal-box--sm" role="dialog" aria-modal="true" aria-labelledby="st-title" data-test="stats-sheet" @keydown.esc="$emit('close')">
      <div class="modal-header"><h2 id="st-title" class="modal-title">📊 Stats</h2></div>
      <div class="modal-body">
        <p v-if="loading" class="field-hint" role="status" data-test="stats-loading">Loading your last 12 weeks…</p>
        <p v-else-if="!data" class="field-hint" role="alert" data-test="stats-error">Couldn't load stats. Try again later.</p>
        <template v-else>
          <div class="st-grid" role="img" :aria-label="`${data.total} tasks done on ${data.active} days in the last 12 weeks`" data-test="stats-heatmap">
            <div v-for="(col, w) in data.weeks" :key="w" class="st-col">
              <span v-for="c in col" :key="c.date" class="st-cell" :class="['l' + c.level, { fut: c.future }]" :title="c.future ? '' : cellTitle(c, moodEmoji)" :data-date="c.date">
                <i v-if="showMood && c.mood" class="st-mood" :class="'m' + c.mood" />
              </span>
            </div>
          </div>
          <p class="st-legend field-hint"><span>12 weeks</span><span>Less <i class="st-cell l0" /><i class="st-cell l1" /><i class="st-cell l2" /><i class="st-cell l3" /><i class="st-cell l4" /> More</span></p>
          <p class="st-line" data-test="stats-rate"><b>{{ data.rate }}%</b> of days active <span class="st-dim">· {{ data.active }}/{{ data.days }} days · {{ data.total }} done</span></p>
          <p class="st-line" data-test="stats-streak">🔥 <b>{{ data.current }}</b> day{{ data.current === 1 ? '' : 's' }} in a row <span class="st-dim">· best {{ data.best }}</span></p>
          <label v-if="data.moodDays" class="st-line st-dim"><input v-model="showMood" type="checkbox" data-test="stats-mood" /> Show mood dots ({{ data.moodDays }} check-in{{ data.moodDays === 1 ? '' : 's' }})</label>
        </template>
      </div>
      <div class="modal-footer"><button type="button" class="btn-secondary" data-test="stats-close" @click="$emit('close')">Close</button></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { cellTitle } from '@/utils/statsView';
import { moodEmoji } from '@/utils/checkin';
defineProps({ data: { type: Object, default: null }, loading: { type: Boolean, default: false } });
defineEmits(['close']);
const showMood = ref(false);
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
  backdrop-filter: blur(4px);
}
.modal-box {
  background: var(--c-surface, #18181b);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.modal-box--sm { max-width: 360px; }
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--c-border, #2a2a2e);
}
.modal-title { font-size: 1rem; font-weight: 600; margin: 0; }
.modal-body { padding: 1.25rem; flex: 1; }
.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--c-border, #2a2a2e);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
.field-group { margin-bottom: 1rem; }
.field-label { display: block; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2, #9a9891); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.field-select {
  width: 100%;
  background: var(--c-bg, #0f0f11);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  padding: 10px 12px;
  color: var(--c-text, #e8e6e1);
  font-family: inherit;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.field-select:focus {
  outline: none;
  border-color: var(--c-accent, #378ADD);
}
.field-select { cursor: pointer; }
.btn-primary {
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  background: var(--c-accent, #378ADD);
  color: white;
  border: none;
  border-radius: var(--r, 3px);
  padding: 9px 18px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover { background: var(--c-accent-hover, #2a6db0); }
.btn-secondary {
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  background: var(--c-surface-2, #1e1e22);
  color: var(--c-text-2, #9a9891);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  padding: 9px 18px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover { color: var(--c-text, #e8e6e1); border-color: var(--c-border-strong, #3a3a3e); }

/* ── Jira-style dialog / form / button overrides ── */
.modal-backdrop { background: rgba(13,18,22,.72); backdrop-filter: none; }
.modal-box { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r); box-shadow: var(--shadow-2); max-width: 520px; }
.modal-header { padding: var(--sp-4) var(--sp-5) var(--sp-3); border-bottom: none; }
.modal-title { font-size: var(--fs-xl); font-weight: 500; line-height: 24px; color: var(--c-text); }
.modal-close { color: var(--c-text-3); border-radius: var(--r); }
.modal-close:hover { background: var(--c-surface-2); color: var(--c-text); }
.modal-body { padding: var(--sp-2) var(--sp-5) var(--sp-4); }
.modal-footer { padding: var(--sp-3) var(--sp-5) var(--sp-4); border-top: none; gap: var(--sp-2); }
.btn-primary, .btn-secondary { font-size: var(--fs-md); font-weight: 500; border-radius: var(--r); padding: 0 12px; height: 32px; border: 1px solid transparent; transition: background .15s; }
.btn-primary { background: var(--c-accent); color: var(--c-on-accent); }
.btn-primary:hover { background: var(--c-accent-hover); }
.btn-secondary { background: var(--c-surface-2); color: var(--c-text-2); }
.btn-secondary:hover { background: var(--c-border); color: var(--c-text); }
.btn-primary:disabled, .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }
.field-input, .field-select, .field-textarea { background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r); padding: 6px 8px; font-size: var(--fs-md); }
.field-input:focus, .field-select:focus, .field-textarea:focus { border-color: var(--c-accent); box-shadow: 0 0 0 1px var(--c-accent); outline: none; }
.field-label { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3); }
@media (max-width: 600px) { .modal-backdrop { align-items: flex-end; padding: 0; } .modal-box { max-width: none; max-height: 92vh; } .modal-header, .modal-body, .modal-footer { padding-left: var(--sp-4); padding-right: var(--sp-4); } }
.field-hint { margin: 4px 0 0; font-size: var(--fs-xs, 12px); color: var(--c-text-3, #9ca3af); }
.hol-lead { font-size: 17px; margin: 0 0 .75rem; }
.field-select { font-size: 18px; min-height: 48px; }
/* Home defines these tokens on its root; Profile does not, so give the sheet the same values. */
.modal-backdrop { --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px; --fs-md: 14px; --fs-xl: 20px; }
.st-grid { display: flex; gap: 3px; justify-content: center; }
.st-col { display: flex; flex-direction: column; gap: 3px; }
.st-cell { position: relative; display: inline-block; width: 18px; height: 18px; border-radius: 3px; background: var(--c-surface-2, #26262a); }
.st-cell.l1 { background: color-mix(in srgb, var(--c-accent, #3b82f6) 30%, transparent); }
.st-cell.l2 { background: color-mix(in srgb, var(--c-accent, #3b82f6) 55%, transparent); }
.st-cell.l3 { background: color-mix(in srgb, var(--c-accent, #3b82f6) 78%, transparent); }
.st-cell.l4 { background: var(--c-accent, #3b82f6); }
.st-cell.fut { opacity: .25; }
.st-mood { position: absolute; right: 2px; bottom: 2px; width: 5px; height: 5px; border-radius: 50%; background: #fff; }
.st-mood.m1 { background: #e5484d; } .st-mood.m2 { background: #f76b15; } .st-mood.m3 { background: #ffc53d; } .st-mood.m4 { background: #8bd36b; } .st-mood.m5 { background: #30a46c; }
.st-legend { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 10px; font-size: .75rem; }
.st-legend .st-cell { width: 10px; height: 10px; margin: 0 1px; vertical-align: middle; }
.st-line { margin: 4px 0; font-size: var(--fs-md, .9rem); color: var(--c-text, #e8e6e1); }
.st-dim { color: var(--c-text-3, #8a8880); }
</style>
