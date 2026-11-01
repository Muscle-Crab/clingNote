import { readFileSync } from 'fs'; import assert from 'assert';
const f = readFileSync('src/components/home/FabButtons.vue', 'utf8'), h = readFileSync('src/views/HomeView.vue', 'utf8'), t = readFileSync('src/components/home/TaskListHeader.vue', 'utf8');
assert(f.includes('RobotAvatar') && !f.includes("'voice'"), 'FAB is the robot assistant, no mic emit');
assert(/emit\('assistant', true\)/.test(f) && /emit\('assistant', false\)/.test(f), 'tap/long-press');
assert(/<FabButtons[^>]*@assistant="openAssistant"/.test(h) && !/<FabButtons[^>]*startVoiceInput/.test(h), 'home FAB opens assistant');
assert(!t.includes('AssistantBubble') && !h.includes('data-test="open-ask"'), 'single assistant button');
assert(/ASSIST_UNDO_MS/.test(h), 'assistant adds get undo chips');
console.log('ok   assistant FAB');
