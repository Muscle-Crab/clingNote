// What to do when the app becomes visible again and the user had started focus music.
// iOS WebKit sets AudioContext.state to "interrupted" on background, not "suspended".
// A new AudioContext from that visibility event is not a user gesture, so iOS leaves it silent.
// "resume" keeps the same context and the musical step. "gesture" waits for the next tap.
export const foregroundPlan = ({ musicOn = false, state = 'none' } = {}) => {
  if (!musicOn) return 'idle';
  if (state === 'running') return 'rebuild';
  if (state === 'suspended' || state === 'interrupted') return 'resume';
  return 'gesture';
};
