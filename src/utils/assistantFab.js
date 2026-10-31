// Global assistant button <-> Home: ?ask=1 opens the sheet, ?ask=talk opens it listening (long-press).
export const HOLD_MS = 500; // press-and-hold length; must equal longPress.js HOLD_MS (scripts/test-long-press.mjs)
export const askQuery = (listen) => ({ ask: listen ? 'talk' : '1' });
export const parseAsk = (q = {}) => (q.ask === 'talk' ? { open: true, listen: true } : q.ask === '1' ? { open: true, listen: false } : { open: false, listen: false });
