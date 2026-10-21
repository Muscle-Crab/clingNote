// Split one spoken utterance into separate tasks: "buy milk and then call mom next email Sam" -> 3 tasks.
// "next" followed by a time word ("next week", "next Friday") is kept as part of the task.
const TIME_WORDS = 'week|month|year|time|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|morning|evening';
const SPLIT = new RegExp(`\\s*(?:,?\\s*\\band then\\b|,?\\s*\\bthen\\b(?=\\s)|\\bnext\\b(?!\\s+(?:${TIME_WORDS})\\b)|[.;!?]+)\\s*`, 'i');
const FILLER = /^(?:um+|uh+|so|okay|ok|and|also)\b[\s,]*/i;

export const cleanSpoken = (s) => {
  let t = String(s || '').trim();
  for (let i = 0; i < 3; i++) t = t.replace(FILLER, '').trim();
  t = t.replace(/[\s,]+$/, '');
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};
export const splitSpokenTasks = (text) => String(text || '').split(SPLIT).map(cleanSpoken).filter((t) => t.length >= 2).slice(0, 10);

// Speech-recognition capability: 'full' (continuous), 'partial' (iOS Safari: single utterances, auto-restart), 'none'.
export const voiceCapability = (win, nav) => {
  if (!win || !(win.SpeechRecognition || win.webkitSpeechRecognition)) return 'none';
  const ua = String(nav?.userAgent || '');
  return /iPhone|iPad|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) ? 'partial' : 'full';
};

export const UNDO_MS = 5000;
