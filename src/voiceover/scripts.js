// All voiceover narration lives here. Edit, then run `npm run voiceover` to regenerate public/voiceover/*.mp3 (edge-tts, no API key).
// Voice: confident, friendly boss. Short punchy lines. Each SCRIPTS key = one bundled MP3.
// Dynamic lines (morning report, overdue alerts) are built in liveLines.js and spoken with speechSynthesis (best available voice).
export const VOICE = { name: 'en-US-AndrewNeural', rate: '+4%', pitch: '-2Hz' };

export const SCRIPTS = {
  // ---- Onboarding (every user; *_manager variants when arriving via a manager link / in Manager mode) ----
  ob_welcome: "Hey. Welcome to CleanNote. I'm your accountability boss. You write the to-dos. I make sure they get done. Five tasks a day keeps your streak alive. Timers keep you honest. And people you trust can watch your back. Let's set you up.",
  ob_welcome_manager: "Hey. Welcome to CleanNote. Somebody picked you as their manager. Nice. Quick setup first, then I connect you straight to them. And you get your own to-do list too. Let's go.",
  ob_age: "Quick one. How old are you? Just the number. You need to be thirteen or older to use CleanNote.",
  ob_goals: "What do you want to nail? Work. Fitness. Study. Habits. Pick everything that applies. I'll tune the pressure to match.",
  ob_schedule: "Here's your rhythm. Your eight-hour day starts at the time you picked, and once it starts, it's locked. Set when tasks are due, and when you go to bed. I'll nudge you to start, and to wrap up on time.",
  ob_strictness: "How hard should I push? Chill gets gentle reminders. Firm gets deadline warnings and a daily report. Drill sergeant? No excuses. Breaks are earned. Your call.",
  ob_notifications: "Last thing. Let me reach you. Start-of-day prompts, deadline warnings, pings from your manager. No spam. Turn them on.",
  ob_paywall: "Want the full boss? Pro unlocks everything. Or skip it for now. Either way, let's get to work.",

  // ---- Manager-mode intro walkthrough (after connecting) ----
  mi_1: "You're in Manager mode. This is your crew. Everyone you manage shows up right here, by name.",
  mi_2: "Watch the badges. Red means overdue. Blue means new messages. Tap a name to see their week.",
  mi_3: "You only see what they share. Every task is Private or Public. Public shows up here. Private stays private.",
  mi_4: "Something slipping? Hit Ping, or Remind. Want to talk? Open Messages and DM them. Throw in some encouragement. It works.",
  mi_5: "Pals are different. Swap an eight-character code, and you keep each other accountable, side by side.",
  mi_6: "Your own list never goes away. Switch to User mode anytime. Your tasks, your five-task streak, timers, the boss panel, scheduled and repeating tasks, rankings, discipline. Pro unlocks the lot. Now go manage.",
};

export const MANAGER_INTRO = [
  { id: 'mi_1', icon: '👥', title: 'Your people', text: 'Everyone you manage, by name.' },
  { id: 'mi_2', icon: '🔴', title: 'Badges', text: 'Red = overdue. Blue = new messages. Tap a name to open their week.' },
  { id: 'mi_3', icon: '🔒', title: 'Private / Public', text: 'You only see tasks they mark Public.' },
  { id: 'mi_4', icon: '👋', title: 'Pings & DMs', text: 'Ping or Remind on a task, or DM them in Messages.' },
  { id: 'mi_5', icon: '🤝', title: 'Pals', text: 'Swap an 8-character code to keep each other accountable.' },
  { id: 'mi_6', icon: '🔁', title: 'Switch modes', text: 'User mode: your tasks, 5-task streak, timers, boss panel, schedules, Rankings, Discipline, Pro.' },
];
