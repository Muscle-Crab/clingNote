// Global assistant button <-> Home: ?ask=1 opens the sheet, ?ask=talk opens it listening (long-press).
export const HOLD_MS = 550;
export const askQuery = (listen) => ({ ask: listen ? 'talk' : '1' });
export const parseAsk = (q = {}) => (q.ask === 'talk' ? { open: true, listen: true } : q.ask === '1' ? { open: true, listen: false } : { open: false, listen: false });
