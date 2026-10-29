// Dev-only harness (not part of the app build): mounts AssistantSheet with a no-op ZZTEST executor.
import { createApp, h, ref } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import AssistantSheet from '@/components/home/AssistantSheet.vue';
import { voSpeaking } from '@/composables/useVoiceover';
import '@/assets/ui.css';
const open = ref(true);
window.__h = { open, voSpeaking };
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] });
createApp({ render: () => (open.value ? h(AssistantSheet, { executor: { run: async () => ({}) }, onClose: () => { open.value = false; } }) : h('button', { 'data-test': 'reopen', onClick: () => { open.value = true; } }, 'open')) }).use(router).mount('#app');
