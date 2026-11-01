<template>
  <div class="pw-field">
    <input :id="id" :name="name" :type="shown ? 'text' : 'password'" :value="modelValue" :required="required" :placeholder="placeholder" :autocomplete="autocomplete"
           :class="[inputClass, 'pw-input']" autocapitalize="none" autocorrect="off" spellcheck="false" data-test="password-input"
           @input="$emit('update:modelValue', $event.target.value)" />
    <button type="button" class="pw-toggle" :aria-label="shown ? 'Hide password' : 'Show password'" :aria-pressed="shown ? 'true' : 'false'" data-test="password-toggle" @click="shown = !shown">
      <svg v-if="!shown" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>
      <svg v-else viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><path d="M1 1l22 22" /></svg>
    </button>
  </div>
</template>

<script setup>
// Password input with a Show/Hide (eye) button. Drop-in for <input type="password" v-model="...">.
import { ref } from 'vue';
defineProps({
  modelValue: { type: String, default: '' }, id: { type: String, default: 'password' }, name: { type: String, default: 'password' },
  placeholder: { type: String, default: 'Password' }, autocomplete: { type: String, default: 'current-password' },
  required: { type: Boolean, default: false }, inputClass: { type: String, default: '' },
});
defineEmits(['update:modelValue']);
const shown = ref(false);
</script>

<style scoped>
.pw-field { position: relative; }
.pw-input { padding-right: 48px !important; }
.pw-toggle { position: absolute; z-index: 20; top: 50%; right: 0; transform: translateY(-50%); width: 44px; height: 44px; min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: #6b7280; cursor: pointer; border-radius: 8px; }
.pw-toggle:hover { color: #374151; }
.pw-toggle:focus-visible { outline: 2px solid #6366f1; outline-offset: -2px; }
</style>
