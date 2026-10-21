// Draws the shareable streak card on a canvas (browser only). Data comes from rewards.shareCardData (no emails).
export const LOG_LABELS = {
  'missed-deadline': '⏰ Missed deadline',
  'gate-open-locked': '📱 Opened app while locked',
  'boss-failed': '👹 Boss not cleared',
  'freeze-used': '🧊 Streak freeze used',
};

export const drawShareCard = (canvas, d) => {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#111827'); g.addColorStop(1, '#7c2d12');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.textAlign = 'center'; c.fillStyle = '#fff';
  c.font = '600 44px system-ui, sans-serif'; c.fillText('ClingNot', W / 2, 120);
  c.font = '220px system-ui, sans-serif'; c.fillText('🔥', W / 2, 440);
  c.font = '900 260px system-ui, sans-serif'; c.fillText(String(d.streak), W / 2, 720);
  c.font = '700 64px system-ui, sans-serif'; c.fillText('day streak', W / 2, 810);
  c.font = '600 52px system-ui, sans-serif'; c.fillStyle = '#fcd34d';
  c.fillText(`Level ${d.level} · ${d.tier}`, W / 2, 940);
  c.fillStyle = '#d1d5db'; c.font = '500 44px system-ui, sans-serif';
  c.fillText(`Best ${d.bestStreak} days`, W / 2, 1020);
  c.fillStyle = '#fff'; c.font = '600 48px system-ui, sans-serif';
  c.fillText(d.name, W / 2, 1200);
  return canvas;
};

export const canvasToBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));
