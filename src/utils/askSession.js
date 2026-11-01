// In-session "Ask Anything" conversation (survives closing/reopening the sheet, cleared by Clear or an app restart; never persisted).
import { ref } from 'vue';
export const askSession = { msgs: ref([]), remaining: ref(null) };
