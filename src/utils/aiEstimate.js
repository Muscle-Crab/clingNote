// Instant local task-duration estimator (no network, no keys). Used at task creation so saving never waits.
// A server AI can later override it: call applyAiEstimate(task, minutes) with the server's answer (source becomes 'ai').
// Order of precedence: duration typed in the title ("20 min", "1h", "1.5 hours", "1h30") > keyword dictionary > generic fallback.

export const round5 = (m) => Math.max(5, Math.min(600, Math.round(m / 5) * 5));

// Duration hints in the title / notes.
export const parseDurationHint = (text = '') => {
  const t = String(text).toLowerCase();
  let m = t.match(/(\d+(?:[.,]\d+)?)\s*h(?:ours?|rs?)?\s*(?:and\s*)?(\d{1,2})\s*m(?:in(?:ute)?s?)?\b/); // 1h30m, 1 hr 15 min
  if (m) return Number(m[1].replace(',', '.')) * 60 + Number(m[2]);
  m = t.match(/\b(\d+)\s*h\s*(\d{2})\b/); // 1h30
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  if (m) return Number(m[1].replace(',', '.')) * 60;
  m = t.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/);
  if (m) return Number(m[1]);
  if (/\bhalf (?:an )?hour\b/.test(t)) return 30;
  if (/\b(?:an|one) hour\b/.test(t)) return 60;
  if (/\bquarter (?:of an )?hour\b/.test(t)) return 15;
  return 0;
};

// [regex, minutes] — first match wins, so more specific phrases come first.
const DICT = [
  // home / chores
  [/\bdeep clean|spring clean|clean (?:the )?(?:whole )?(?:house|apartment|flat|home)\b/, 120],
  [/\bclean (?:the )?garage|clean out (?:the )?(?:closet|garage|attic|basement)/, 90],
  [/\bclean (?:the )?(?:kitchen|bathroom|fridge|oven)|scrub (?:the )?(?:bathroom|toilet|shower|tub)/, 30],
  [/\bclean (?:the )?(?:room|bedroom|desk|car)|tidy|declutter/, 20],
  [/\bvacuum|hoover|mop|sweep/, 20],
  [/\b(?:do (?:the )?)?laundry|wash (?:the )?clothes/, 60],
  [/\bfold (?:the )?(?:laundry|clothes)|iron/, 20],
  [/\bdishes|dishwasher|wash up/, 15],
  [/\b(?:take out|empty) (?:the )?(?:trash|garbage|bins?|recycling)|trash|garbage/, 5],
  [/\bmake (?:the )?bed/, 5],
  [/\bwater (?:the )?(?:plants|garden|flowers)/, 10],
  [/\bmow|lawn|yard work|garden(?:ing)?|weed/, 45],
  [/\bchange (?:the )?(?:sheets|bedding)/, 15],
  [/\bfeed (?:the )?(?:cat|dog|pets?|fish)/, 5],
  [/\bwalk (?:the )?dog|dog walk/, 30],
  [/\bfix|repair|assemble|install/, 45],
  // food
  [/\bmeal prep|batch cook/, 90],
  [/\b(?:cook|make|prepare) (?:dinner|lunch)|cook\b/, 45],
  [/\b(?:make|prepare|have) breakfast|breakfast/, 15],
  [/\bbake/, 60],
  [/\b(?:eat|have) (?:lunch|dinner)|lunch|dinner/, 30],
  // errands
  [/\bgrocer(?:y|ies)|supermarket|food shopping|costco/, 60],
  [/\bshopping|go to the mall/, 60],
  [/\bpost office|mail (?:a |the )?(?:package|letter)|ship (?:a |the )?package/, 20],
  [/\bbank|atm|pharmacy|pick up|drop off|return (?:a |the )?/, 20],
  [/\bcar wash|wash (?:the )?car|gas|refuel|fill up/, 20],
  [/\bdoctor|dentist|appointment|haircut|barber|vet\b/, 60],
  [/\bcommute|drive to|drive\b/, 30],
  // fitness / health
  [/\bmarathon/, 240],
  [/\bhike|hiking/, 120],
  [/\bgym|workout|work out|lift|weights|strength|crossfit|leg day/, 60],
  [/\b(?:go for a )?run\b|jog|running/, 30],
  [/\bswim|cycling|bike ride|cycle\b/, 45],
  [/\byoga|pilates/, 45],
  [/\bwalk\b|steps/, 30],
  [/\bstretch|push-?ups|sit-?ups|plank|abs\b/, 10],
  [/\bmeditat|breathing|journal/, 10],
  [/\bshower|bath\b/, 15],
  [/\bnap\b/, 30],
  [/\bsleep\b/, 480],
  [/\btake (?:my )?(?:meds|medication|vitamins|pills)/, 5],
  // study
  [/\bexam|final|midterm|test prep|revise|revision/, 120],
  [/\bstudy|learn|course|lecture|class\b/, 60],
  [/\bhomework|assignment|problem set/, 60],
  [/\bessay|thesis|dissertation|paper\b/, 120],
  [/\bread (?:a )?(?:book|chapter)|read\b|reading/, 30],
  [/\bflashcards|anki|vocab|duolingo|practice (?:spanish|french|german|language)/, 15],
  [/\bpractice (?:piano|guitar|violin|drums|instrument)|piano|guitar/, 30],
  // work
  [/\bdeep work|focus (?:block|session)/, 90],
  [/\b(?:write|draft|prepare|finish) (?:the |a )?(?:report|proposal|presentation|deck|slides|spec|plan|blog post|article)/, 90],
  [/\bpresentation|slides|deck\b|proposal|report\b/, 60],
  [/\bcode|coding|program|develop|build|implement|refactor|debug|bug|feature|deploy/, 90],
  [/\bcode review|review (?:the )?pr|pull request|review\b/, 30],
  [/\bdesign|mockup|wireframe/, 60],
  [/\bresearch|analy[sz]e|analysis/, 60],
  [/\bmeeting|standup|stand-up|sync|1:1|one on one|interview/, 30],
  [/\btax(?:es)?|budget|finances|bookkeeping|invoice/, 60],
  [/\b(?:check|answer|reply to|clear) (?:my )?(?:e-?mails?|inbox|messages)|inbox zero/, 20],
  [/\bcall|phone|ring\b|facetime/, 15],
  [/\be-?mail|text|message|reply|send|dm\b/, 5],
  [/\bpay (?:the )?(?:bill|rent|invoice)|pay\b/, 5],
  [/\bbook|schedule|reserve|cancel|renew|sign up|register/, 10],
  [/\bplan (?:the |my )?(?:week|day)|weekly review|plan\b/, 20],
  [/\bwrite|draft|edit/, 45],
  [/\bupdate|fill (?:out|in)|form|paperwork|organi[sz]e|sort/, 20],
  [/\bbuy|order|purchase/, 10],
  [/\bpack|unpack/, 30],
  [/\bwatch (?:a )?(?:movie|film)/, 120],
  [/\bwatch|episode|youtube|podcast/, 45],
];

// size modifiers
const BIG = /\b(whole|entire|all (?:the )?|full|big|thorough(?:ly)?|deep|complete|massive)\b/;
const SMALL = /\b(quick(?:ly)?|small|short|brief|tiny|little|mini|just)\b/;

export const localEstimateMinutes = (task = {}) => {
  const title = String(task.title || ''); const notes = String(task.notes || '');
  const hint = parseDurationHint(title) || parseDurationHint(notes);
  if (hint > 0) return { minutes: round5(hint), source: 'title' };
  const t = ` ${title.toLowerCase()} `;
  let base = 0;
  for (const [re, m] of DICT) if (re.test(t)) { base = m; break; }
  if (!base) { const n = (`${title} ${notes}`).trim().split(/\s+/).filter(Boolean).length; base = n >= 8 ? 45 : 25; }
  if (BIG.test(t)) base *= 1.5;
  if (SMALL.test(t)) base *= 0.6;
  if (String(task.priority).toLowerCase() === 'high' && base >= 30) base *= 1.1;
  return { minutes: round5(base), source: 'local' };
};

// Server-AI hook: a later server answer replaces the local guess (not a user's own typed override).
export const applyAiEstimate = (task, minutes) => {
  const n = Math.round(Number(minutes));
  if (!Number.isFinite(n) || n <= 0 || Number(task.estimateMin) > 0) return task;
  return { ...task, minutes: round5(n), estimateSource: 'ai' };
};
