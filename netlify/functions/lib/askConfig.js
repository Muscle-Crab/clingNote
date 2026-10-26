// Single source of truth for the "Ask Anything" assistant limits (server-enforced in ai.js).
// Free users: FREE_PER_DAY questions per UTC day. Pro: unlimited (PRO_PER_DAY = null; set a number to add an abuse cap).
const ASK_LIMITS = { FREE_PER_DAY: 10, PRO_PER_DAY: null, HISTORY_TURNS: 6, MAX_QUESTION: 2000, MAX_TURN: 1500 };
// Assistant (agent): one quota unit per user message (shared 'ask' counter); tool round trips are free but capped per day.
const AGENT_LIMITS = { MAX_STEPS_PER_TURN: 5, STEPS_PER_DAY: 400, PRO_PER_DAY: 200 };
module.exports = { ASK_LIMITS, AGENT_LIMITS };
