// Onboarding tutorial slides. Every image is a real screenshot of the app (390x844 iPhone viewport) taken with demo data
// only ("ZZTEST" accounts), resized to 600px wide and stored as local WebP (no CDN, ~35 KB each).
// Captions only describe features that exist: snow/rain/fireplace are visual canvas animations, the four music tracks are
// generated in the browser (no real rain audio) and play only after the user taps Play.
import day from './s01_day.webp';
import tasks from './s02_tasks.webp';
import timer from './s03_timer.webp';
import boss from './s04_boss.webp';
import shutdown from './s05_shutdown.webp';
import goal from './s08_goal.webp';
import rankings from './s07_rankings.webp';
import discipline from './s06_discipline.webp';
import bgpanel from './s09_bgpanel.webp';
import fire from './s10_fire.webp';
import music from './s11_music.webp';

export const TOUR_SLIDES = [
  { id: 'day', img: day, title: '8 hours. Locked.', text: 'Your day starts at your wake time. Tasks, points and target are fixed once it starts.' },
  { id: 'tasks', img: tasks, title: 'Tasks with points', text: 'Plan up to 5 a day. Each task is worth points based on how big it is.' },
  { id: 'timer', img: timer, title: 'Focus timers', text: 'Start a timer on any task and stay on it.' },
  { id: 'boss', img: boss, title: 'The boss is watching', text: 'Orders in the morning. A verdict at your deadline.' },
  { id: 'shutdown', img: shutdown, title: 'Shutdown ritual', text: 'Close the day on purpose. Carry over what is left.' },
  { id: 'goal', img: goal, title: 'Hit the target', text: 'Reach the points goal before the clock runs out. Keep the streak alive.' },
  { id: 'rankings', img: rankings, title: 'Monthly Rankings', text: 'Earn points, climb the tiers, see where you stand.' },
  { id: 'discipline', img: discipline, title: 'Discipline mode', text: 'Set a deadline. Miss it and you lose points and your streak.' },
  { id: 'bg', img: bgpanel, title: 'Make it yours', text: 'Forest, Night sky, Ocean dusk, Sunrise, Mountains, Plain dark, or your own photo.' },
  { id: 'fire', img: fire, title: 'Fireplace, snow, rain', text: 'Calm animated scenes behind your list.' },
  { id: 'music', img: music, title: 'Music on tap', text: 'Lo-fi, ambient and fireside tracks. They play only when you press Play.' },
];
