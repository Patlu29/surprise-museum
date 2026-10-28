import { getEffectiveReducedMotion } from '@/state/settingsStore';

let cached = false;
let checkedAt = -Infinity;

/**
 * Effective reduced-motion value (settings over the operating system), cached for 250 ms so
 * per-frame callers pay nothing. Reads the store, so a settings change applies within a quarter
 * of a second without re-rendering anything.
 */
export function isReducedMotion(): boolean {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - checkedAt > 250) {
    cached = getEffectiveReducedMotion();
    checkedAt = now;
  }
  return cached;
}
