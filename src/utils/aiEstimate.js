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

// Determiner helper: optional "the/my/a/an/our/your/his/her/their " before a noun.
const D = '(?:(?:the|my|a|an|our|your|his|her|their|some) )?';
const r = (s) => new RegExp(s.replace(/~/g, D));

// [regex, minutes] — first match wins, so more specific phrases come first.
const DICT = [
  // car (before generic wash/clean/tidy/vacuum/gas rules)
  [r('\\b(?:drive[- ]?thr(?:u|ough)|automatic|express) car ?wash|\\bcar ?wash\\b'), 15],
  [r('\\b(?:clean|detail|wash|vacuum) ~car(?:s)? interior|\\b(?:clean|detail) (?:the )?inside of ~car|\\bdetail ~car'), 45],
  [r('\\b(?:vacuum|hoover) (?:out )?~car|\\bvacuum (?:out )?(?:the )?car|\\bcar vacuum'), 30],
  [r('\\b(?:wash|hand[- ]wash|clean|wax|scrub) ~(?:car|truck|van|suv)s?\\b'), 50],
  [r('\\boil change|change ~oil|tire rotation|rotate ~tires|car (?:service|inspection|maintenance)|smog check|take ~car (?:in|to (?:the )?(?:shop|mechanic|garage|dealer))'), 90],
  [r('\\b(?:get|buy|pump) gas\\b|\\bgas (?:station|up)|\\brefuel|\\bfill (?:up )?~(?:tank|car)|\\bfill up\\b|\\bcharge ~(?:car|ev|tesla)'), 10],
  // personal hygiene (before generic wash)
  [r('\\bwash ~hair|\\bshampoo|\\bblow[- ]?dry|\\bstraighten ~hair|\\bcurl ~hair'), 20],
  [r('\\b(?:take a |have a )?shower\\b|\\btake a bath\\b|\\bbath\\b(?! (?:the|my) )'), 15],
  [r('\\bshave|\\bbrush ~teeth|\\bfloss|\\bskincare|\\bget ready\\b'), 10],
  // home / chores
  [r('\\bdeep clean|spring clean|clean ~(?:whole |entire )?(?:house|apartment|flat|home)\\b'), 120],
  [r('\\bclean (?:out )?~garage|clean out ~(?:closet|garage|attic|basement)'), 90],
  [r('\\bclean ~gutters|gutter'), 90],
  [r('\\bclean ~(?:kitchen|bathroom|fridge|oven|toilet|shower|tub)s?|scrub ~(?:bathroom|toilet|shower|tub|floors?)'), 30],
  [r('\\bclean ~windows?|wash ~windows?'), 45],
  [r('\\bclean ~(?:room|bedroom|living room|office)s?\\b'), 30],
  [r('\\bclean ~(?:desk|table|counters?)|tidy|declutter|pick up ~toys'), 20],
  [r('\\bvacuum|hoover|mop|sweep'), 20],
  [r('\\b(?:do (?:the )?)?laundry|wash ~(?:clothes|towels|sheets|bedding)|load of washing'), 60],
  [r('\\bfold ~(?:laundry|clothes)|put away ~(?:laundry|clothes)|\\biron'), 20],
  [r('\\bdishes|dishwasher|wash up\\b|wash ~(?:pots|pans|plates)'), 15],
  [r('\\b(?:take out|empty) ~(?:trash|garbage|bins?|recycling|rubbish)|trash|garbage'), 5],
  [r('\\bmake ~bed\\b'), 5],
  [r('\\bchange ~(?:sheets|bedding)'), 15],
  // yard
  [r('\\bmow|cut ~(?:grass|lawn)'), 50],
  [r('\\brake (?:~|up )?leaves|\\brake ~(?:yard|lawn)|\\bleaf blow'), 60],
  [r('\\bshovel|clear ~(?:snow|driveway)|snow blow'), 45],
  [r('\\bweed|pull weeds|trim ~(?:hedges?|bushes|trees?)|prune'), 45],
  [r('\\bplant\\b|planting|garden(?:ing)?|yard work|landscap'), 60],
  [r('\\bwater ~(?:plants|garden|flowers|lawn)'), 10],
  // pets (before generic walk/feed)
  [r('\\b(?:take|bring) ~(?:dog|cat|pet|puppy|kitten)s? to (?:the )?vet|vet (?:visit|appointment)|\\bvet\\b'), 60],
  [r('\\bgroom ~(?:dog|cat|pet|puppy)s?|\\bbathe ~(?:dog|cat|pet|puppy)s?|wash ~(?:dog|puppy)s?|\\bdog groomer'), 45],
  [r('\\bwalk ~(?:dog|puppy|dogs)|dog walk'), 30],
  [r('\\bclean ~(?:litter ?box|litter|cage|tank|aquarium|fish tank)|scoop ~litter'), 10],
  [r('\\bfeed ~(?:cat|dog|pets?|fish|puppy|kitten)s?'), 5],
  // kids
  [r('\\bhelp ~(?:kids?|son|daughter|children)(?: with)? homework|homework with ~(?:kids?|children)'), 45],
  [r('\\b(?:bath|bathe|bath ?time for) ~(?:kids?|baby|children|toddler)|kids?\\W? bath|bedtime(?: routine)?|put ~(?:kids?|baby|children) to bed'), 30],
  [r('\\b(?:pick up|drop off|collect) ~(?:kids?|children|son|daughter)|school (?:run|pick ?up|drop ?off)|daycare'), 30],
  [r('\\bpack ~(?:kids?\\W? )?(?:lunch(?:es)?|lunchbox)|school lunch'), 15],
  [r('\\bsoccer practice|practice pickup|play ?date|kids?\\W? (?:activity|practice|game)'), 90],
  // home repair (specific before generic fix)
  [r('\\bpaint ~(?:room|bedroom|wall|walls|kitchen|bathroom|fence|house)'), 240],
  [r('\\bchange ~(?:light ?bulbs?|bulbs?|batter(?:y|ies)|air filter|filter)|replace ~(?:light ?bulbs?|bulbs?|batter(?:y|ies)|smoke detector batter(?:y|ies)|air filter|filter)'), 10],
  [r('\\bunclog|plunge|leaky|leak\\b|faucet|drain\\b'), 45],
  [r('\\bhang ~(?:picture|shelf|shelves|curtains?|tv|mirror)s?'), 30],
  [r('\\bassemble|ikea|build ~(?:shelf|desk|bed|furniture|dresser)'), 90],
  [r('\\bfix|repair|install|patch'), 45],
  // food
  [r('\\bmeal prep|batch cook'), 90],
  [r('\\b(?:grill|bbq|barbecue)'), 45],
  [r('\\bbake ~(?:bread|cake|pie)'), 90],
  [r('\\bbake'), 60],
  [r('\\b(?:make|prepare|fix) ~(?:sandwich|salad|smoothie|snack|coffee|tea|toast)s?'), 10],
  [r('\\b(?:cook|make|prepare) ~(?:pasta|spaghetti|stir[- ]?fry|eggs|omelet(?:te)?|soup|tacos|rice)'), 30],
  [r('\\b(?:cook|make|prepare) ~(?:dinner|lunch|supper|meal)|\\bcook'), 45],
  [r('\\b(?:make|prepare|have|eat) ~breakfast|breakfast'), 15],
  [r('\\b(?:eat|have) ~(?:lunch|dinner)|lunch|dinner'), 30],
  [r('\\border ~(?:takeout|take-out|food|pizza|delivery)'), 10],
  // errands
  [r('\\bgrocer(?:y|ies)|supermarket|food shopping|costco|trader joe|whole foods'), 60],
  [r('\\bshopping|go to the mall'), 60],
  [r('\\bpost office|mail ~(?:package|letter|parcel)|ship ~(?:package|parcel)|return ~(?:package|parcel|order)'), 20],
  [r('\\bdry clean|pharmacy|prescription|\\bbank\\b|\\batm\\b|pick up|drop off|return ~'), 20],
  [r('\\bdmv|passport|renew ~(?:license|registration)'), 90],
  // appointments
  [r('\\bhaircut|barber|hair (?:appointment|salon)|get ~hair (?:cut|done)|salon'), 45],
  [r('\\bmanicure|pedicure|nails\\b'), 45],
  [r('\\bdentist|teeth cleaning'), 60],
  [r('\\bdoctor|physician|check-?up|physical\\b|therapy|therapist|appointment|eye exam|optometrist'), 60],
  [r('\\bcommute|drive to|drive\\b'), 30],
  // fitness / health
  [r('\\bmarathon'), 240],
  [r('\\bhike|hiking'), 120],
  [r('\\bgym|workout|work out|lift|weights|strength|crossfit|leg day'), 60],
  [r('\\b(?:go for a )?run\\b|jog|running'), 30],
  [r('\\bswim|cycling|bike ride|cycle\\b'), 45],
  [r('\\byoga|pilates'), 45],
  [r('\\bwalk\\b|steps'), 30],
  [r('\\bstretch|push-?ups|sit-?ups|plank|abs\\b'), 10],
  [r('\\bmeditat|breathing|journal'), 10],
  [r('\\bnap\\b'), 30],
  [r('\\bsleep\\b'), 480],
  [r('\\btake ~(?:meds|medication|vitamins|pills)'), 5],
  // money / bills (before generic pay)
  [r('\\btax(?:es)?|bookkeeping'), 120],
  [r('\\bbudget|finances|reconcile'), 60],
  [r('\\bpay (?:all )?~bills|\\bbills\\b'), 15],
  [r('\\bpay ~(?:\\w+ )?(?:bill|rent|invoice|credit card|mortgage|loan)|\\bpay\\b'), 5],
  [r('\\binvoice'), 30],
  // study
  [r('\\bexam|final|midterm|test prep|revise|revision'), 120],
  [r('\\bstudy|learn|course|lecture|class\\b'), 60],
  [r('\\bhomework|assignment|problem set'), 60],
  [r('\\bessay|thesis|dissertation|paper\\b'), 120],
  [r('\\bread ~(?:book|chapter)|read\\b|reading'), 30],
  [r('\\bflashcards|anki|vocab|duolingo|practice (?:spanish|french|german|language)'), 15],
  [r('\\bpractice (?:piano|guitar|violin|drums|instrument)|piano|guitar'), 30],
  // work (meetings before generic review/plan)
  [r('\\ball[- ]hands|offsite|workshop|town ?hall'), 60],
  [r('\\binterview'), 60],
  [r('\\bstand-?up|daily (?:sync|scrum)|scrum\\b'), 15],
  [r('\\b1:1|one[- ]on[- ]one|sync\\b|check-?in with'), 30],
  [r('\\b(?:team |client |planning |project )?meeting|retro\\b|sprint planning'), 45],
  [r('\\bdeep work|focus (?:block|session)'), 90],
  [r('\\b(?:write|draft|prepare|finish) ~(?:report|proposal|presentation|deck|slides|spec|plan|blog post|article)'), 90],
  [r('\\bpresentation|slides|deck\\b|proposal|report\\b'), 60],
  [r('\\bcode review|review ~(?:pr|pull request)|pull request'), 30],
  [r('\\bcode|coding|program|develop|build|implement|refactor|debug|bug|feature|deploy'), 90],
  [r('\\breview\\b'), 30],
  [r('\\bdesign|mockup|wireframe'), 60],
  [r('\\bresearch|analy[sz]e|analysis'), 60],
  [r('\\b(?:check|answer|reply to|clear) ~(?:e-?mails?|inbox|messages)|inbox zero'), 20],
  [r('\\bcall|phone|ring\\b|facetime'), 15],
  [r('\\be-?mail|text|message|reply|send|dm\\b'), 5],
  [r('\\bbook|schedule|reserve|cancel|renew|sign up|register'), 10],
  [r('\\bplan ~(?:week|day)|weekly review|plan\\b'), 20],
  [r('\\bwrite|draft|edit'), 45],
  [r('\\bupdate|fill (?:out|in)|form|paperwork|organi[sz]e|sort'), 20],
  [r('\\bbuy|order|purchase'), 10],
  [r('\\bpack ~(?:suitcase|bags?)\\b|\\bpack for|\\bpack|unpack'), 30],
  [r('\\bwatch ~(?:movie|film)'), 120],
  [r('\\bwatch|episode|youtube|podcast'), 45],
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
