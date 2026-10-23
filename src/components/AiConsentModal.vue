<template>
  <div v-if="aiConsentUi.open" class="aic-back" role="dialog" aria-modal="true" aria-labelledby="aic-title" data-test="ai-consent">
    <div class="aic-card">
      <template v-if="!aiConsentUi.declined">
        <h2 id="aic-title">Share your data with OpenAI?</h2>
        <p>To use CleanNote's AI features (meal photo and text analysis, meal plans, the AI coach and workout plans), the text you type, your meal photos and your workout preferences are sent to <strong>OpenAI</strong>, a third-party AI provider, to generate the result.</p>
        <p class="aic-small">Only what you submit for that request is sent, not your name or email. It is not used for advertising or tracking. See the <router-link to="/privacy-policy" @click="goPrivacy">Privacy Policy</router-link> for details. AI output can be wrong and is not medical advice.</p>
        <div class="aic-actions">
          <button type="button" class="aic-allow" data-test="ai-consent-allow" @click="acceptAiConsent">Allow</button>
          <button type="button" class="aic-deny" data-test="ai-consent-decline" @click="decline">Don't allow</button>
        </div>
      </template>
      <template v-else>
        <h2 id="aic-title">AI features are off</h2>
        <p data-test="ai-consent-declined">{{ AI_CONSENT_DECLINED_MESSAGE }}</p>
        <div class="aic-actions"><button type="button" class="aic-allow" @click="closeAiConsentNotice">OK</button></div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { aiConsentUi, acceptAiConsent, declineAiConsent, closeAiConsentNotice, AI_CONSENT_DECLINED_MESSAGE } from '@/composables/useAiConsent';
const decline = () => { declineAiConsent(); };
const goPrivacy = () => { declineAiConsent(); closeAiConsentNotice(); }; // leaves the dialog to read the policy; nothing is sent
</script>

<style scoped>
.aic-back { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; padding: 16px; }
.aic-card { background: #fff; color: #111827; max-width: 420px; width: 100%; border-radius: 16px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
.aic-card h2 { font-size: 1.15rem; font-weight: 800; margin: 0 0 8px; }
.aic-card p { font-size: .93rem; line-height: 1.4; margin: 0 0 8px; }
.aic-small { font-size: .8rem; color: #4b5563; }
.aic-small a { color: #2563eb; text-decoration: underline; }
.aic-actions { display: flex; gap: 10px; margin-top: 14px; }
.aic-actions button { flex: 1; padding: 11px 12px; border-radius: 12px; font-weight: 700; border: 1px solid #d1d5db; background: #fff; color: #111827; }
.aic-actions .aic-allow { background: #111827; color: #fff; border-color: #111827; }
</style>
