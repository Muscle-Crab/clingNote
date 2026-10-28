// Shared motion helpers for task completion + reorder. Transform/opacity only; honours prefers-reduced-motion.
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const COMPLETE_MS = 560; // time the completion animation plays before the task leaves the list

export const lightHaptic = () => { try { Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); } catch (_) { /* web / unsupported */ } };

const COLORS = ['#7C9CFF', '#5EEAD4', '#F5C542', '#34D399', '#F472B6', '#A78BFA'];

// Small confetti burst from the centre of `el` (12 particles, fixed-position, removed when done).
export function burstFrom(el, count = 12) {
  if (!el || typeof document === 'undefined' || prefersReducedMotion()) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const layer = document.createElement('div');
  layer.className = 'cn-burst';
  layer.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:0;height:0;pointer-events:none;z-index:2000;`;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = 22 + Math.random() * 20;
    const size = 4 + Math.random() * 3;
    const round = i % 3 !== 0;
    p.style.cssText = `position:absolute;left:${-size / 2}px;top:${-size / 2}px;width:${size}px;height:${round ? size : size * 1.8}px;border-radius:${round ? '50%' : '2px'};background:${COLORS[i % COLORS.length]};will-change:transform,opacity;`;
    layer.appendChild(p);
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
    p.animate([
      { transform: 'translate(0,0) scale(.4) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * 0.8}px,${dy * 0.8}px) scale(1) rotate(${ang * 90}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px,${dy + 8}px) scale(.6) rotate(${ang * 140}deg)`, opacity: 0 },
    ], { duration: 520 + Math.random() * 140, easing: EASE_OUT, fill: 'forwards' });
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 800);
}
