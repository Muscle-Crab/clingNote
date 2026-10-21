export const milestoneMessages = {
  7: "One week of success! 🌟",
  15: "Halfway to a month! 🚀",
  30: "Amazing! A full month streak! 🎖️"
};

export const getMilestoneMessage = (streak) => {
  return milestoneMessages[streak] || "Keep it going!";
};

export const streakIcons = [
  '🌱', '🌞', '🌟', '🔥', '🏆', '🎯', '🚀', '🌈', '💎', '🎵',
  '🌹', '🍀', '🦋', '🌻', '🌙', '✨', '🎉', '🎈', '🎂', '🍔',
  '🍕', '🍩', '🍎', '🍉', '🥇', '🥂', '🌊', '🌌', '🪐', '🧠'
];

export const getStreakIcon = (streak) => {
  if (streak >= 30) {
    return '🎖️'; // Special icon for streaks beyond 30 days
  }
  return streakIcons[streak - 1]; // Array is 0-indexed, so subtract 1
};

export const badges = [
  { name: "Seed Starter", days: 1, icon: "🌱" },
  { name: "Sprouting Leaves", days: 3, icon: "🌿" },
  { name: "Small Tree", days: 7, icon: "🌳" },
  { name: "Mature Tree", days: 15, icon: "🌲" },
  { name: "Peak Performer", days: 30, icon: "🏔️" }
];


// Monthly ranking badges (keyed by `id`; awarded once per month as `${id}:${YYYY-MM}`).
export const monthlyBadges = [
  { id: 'monthly-1', name: 'Monthly Champion', icon: '👑' },
  { id: 'monthly-top3', name: 'Top 3 of the Month', icon: '🏅' },
  { id: 'monthly-gold', name: 'Gold+ Month', icon: '🥇' },
];
