// All voiceover narration lives here. Edit, then run `npm run voiceover` to regenerate public/voiceover/*.mp3
// (scripts/gen-voiceover-elevenlabs.mjs: ElevenLabs when ELEVENLABS_API_KEY is set, else the edge-tts interim voice).
// Voice: the robot coach. Natural, warm, firm. Contractions, short sentences. Each SCRIPTS key = one bundled MP3.
// Dynamic lines (reports, check-ins) are spoken live through the `tts` Netlify function (same ElevenLabs voice);
// static lines in src/voiceover/phrases.js are also pre-recorded so they still play offline. There is no device TTS.
export const VOICE = {
  provider: 'elevenlabs', voiceId: 'iP95p4xoKVk53GoZ742B', name: 'Chris', model: 'eleven_multilingual_v2',
  settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
  edge: { name: 'en-US-AndrewMultilingualNeural', rate: '+0%', pitch: '+0Hz' }, // interim fallback only
};

export const SCRIPTS = {
  // ---- Onboarding (every user; *_manager variants when arriving via a manager link / in Manager mode) ----
  ob_welcome: "Hey, welcome to ClingNote! I'm your robot coach. Let's do a quick setup first. Once you're in, your first report walks you through everything.",
  ob_welcome_manager: "Hey, welcome to ClingNote! Someone picked you as their manager. Nice. Let's do a quick setup, and then I'll connect you straight to them.",
  ob_age: "Quick one. How old are you? Just the number. You need to be thirteen or older to use ClingNote.",
  ob_goals: "So, what do you want to nail? Work, fitness, study, habits? Pick everything that fits, and I'll tune things to match.",
  ob_schedule: "Here's your rhythm. Your eight-hour day starts at the time you pick, and once it starts, it's locked in. Set when tasks are due, and when you go to bed. I'll nudge you to start, and to wrap up on time.",
  ob_strictness: "How hard should I push you? Chill means gentle reminders. Firm adds deadline warnings and a daily report. Strict means no excuses, and breaks are earned. It's your call.",
  ob_notifications: "Last thing. Let me reach you. Start-of-day prompts, deadline warnings, and pings from your manager. No spam, I promise.",
  ob_paywall: "Want everything I can do? Pro unlocks it all. Or skip it for now. Either way, let's get to work.",

  // ---- First report = the app explanation (onboarding voice). Played once, before yesterday's recap + today's plan. ----
  br_intro: "Before your report, here's how this works. You write the to-dos, and I help make sure they get done. Add tasks for each day, schedule them, or set them to repeat. Finish five a day to keep your streak alive. Start a timer to stay honest. Mark a task Private, and only you'll see it. Public tasks can be seen by your manager or your pals, and they can ping you. Want me tougher? Turn on Discipline mode. Every morning, I'll tell you how yesterday went, and what's on today. Okay, here we go.",
  br_intro_manager: "Before your report, here's how this works. In Manager mode, everyone you manage shows up by name. A red badge means someone's overdue. Tap a name to see their day, hit Ping to nudge them, or send a message. You'll only see their public tasks. And you still get your own list, streak, and timers in User mode. Every morning, I'll tell you how yesterday went, what's on today, and who on your team could use a push. Okay, here we go.",

  // ---- Manager-mode intro walkthrough (after connecting) ----
  mi_1: "You're in Manager mode. This is your crew. Everyone you manage shows up right here, by name.",
  mi_2: "Keep an eye on the badges. Red means overdue. Blue means new messages. Tap a name to see their week.",
  mi_3: "You'll only see what they share. Every task is Private or Public. Public shows up here, and private stays private.",
  mi_4: "Something slipping? Hit Ping. Want to talk? Open Messages and send them a note. A little encouragement goes a long way.",
  mi_5: "Pals are a bit different. Swap an eight-character code, and you keep each other accountable, side by side.",
  mi_6: "Your own list never goes away. Switch to User mode anytime for your tasks, streak, timers, and your robot coach. Pro unlocks the lot. Now go manage.",
};

export const MANAGER_INTRO = [
  { id: 'mi_1', icon: '👥', title: 'Your people', text: 'Everyone you manage, by name.' },
  { id: 'mi_2', icon: '🔴', title: 'Badges', text: 'Red = overdue. Blue = new messages. Tap a name to open their week.' },
  { id: 'mi_3', icon: '🔒', title: 'Private / Public', text: 'You only see tasks they mark Public.' },
  { id: 'mi_4', icon: '👋', title: 'Pings & DMs', text: 'Ping on a task, or DM them in Messages.' },
  { id: 'mi_5', icon: '🤝', title: 'Pals', text: 'Swap an 8-character code to keep each other accountable.' },
  { id: 'mi_6', icon: '🔁', title: 'Switch modes', text: 'User mode: your tasks, 5-task streak, timers, robot coach, schedules, Rankings, Discipline, Pro.' },
];
