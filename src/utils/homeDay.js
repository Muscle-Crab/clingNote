// Today's Home day state shared with the global chrome (status pill): set by HomeView, keyed by date so it never leaks into tomorrow.
import { ref } from 'vue';
export const homeDay = ref({ dayKey: '', wrapped: false, allDone: false });
export const homeDayFor = (dayKey) => (homeDay.value.dayKey === dayKey ? homeDay.value : { dayKey, wrapped: false, allDone: false });
