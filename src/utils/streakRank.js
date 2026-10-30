// PUBG-style streak rank tiers shown inside the streak medal on the Daily progress card.
// The day streak is capped at STREAK_CAP (5), so the six tiers map one per streak value 0..5:
// Bronze is where everyone starts (0), each streak day climbs one tier, Master = the full 5/5 streak.
// Each tier has its own medal colours, emblem shape and burst colour (played when you reach it).
export const RANK_TIERS = [
  { name: 'Bronze', min: 0, fill: '#B8733A', rim: '#E7A86B', glow: 'rgba(214,132,64,.9)', burst: '#FFB27A', shape: 'shield' },
  { name: 'Silver', min: 1, fill: '#9AA6B8', rim: '#E6ECF5', glow: 'rgba(200,214,235,.9)', burst: '#F2F6FF', shape: 'shield' },
  { name: 'Gold', min: 2, fill: '#D9A21F', rim: '#FFE27A', glow: 'rgba(255,200,60,.95)', burst: '#FFE9A0', shape: 'star' },
  { name: 'Platinum', min: 3, fill: '#2FB7A8', rim: '#A8FFF1', glow: 'rgba(80,230,210,.9)', burst: '#C6FFF6', shape: 'star' },
  { name: 'Diamond', min: 4, fill: '#3E7BFF', rim: '#B9D4FF', glow: 'rgba(90,150,255,.95)', burst: '#D3E4FF', shape: 'diamond' },
  { name: 'Master', min: 5, fill: '#B23CFF', rim: '#FFC6F0', glow: 'rgba(220,90,255,.95)', burst: '#FFD1FA', shape: 'crown' },
];
export const rankIndex = (streak) => { const n = Math.max(0, Math.floor(Number(streak) || 0)); let i = 0; RANK_TIERS.forEach((t, j) => { if (n >= t.min) i = j; }); return i; };
export const rankFor = (streak) => RANK_TIERS[rankIndex(streak)];
// True when going from -> to reaches a higher tier (the medal plays that tier's burst).
export const rankUp = (from, to) => rankIndex(to) > rankIndex(from);
// Emblem paths in the 64x64 medal (centred at 32,32, drawn inside the medal ring, behind the number).
export const RANK_SHAPES = {
  shield: 'M32 12 L48 18 L46 36 Q44 46 32 52 Q20 46 18 36 L16 18 Z',
  star: 'M32 10 L37.6 24.3 L52.9 25.2 L41 35 L44.9 49.8 L32 41.5 L19.1 49.8 L23 35 L11.1 25.2 L26.4 24.3 Z',
  diamond: 'M32 10 L50 28 L32 54 L14 28 Z M14 28 L50 28',
  crown: 'M14 46 L16 20 L25 31 L32 14 L39 31 L48 20 L50 46 Z',
};
