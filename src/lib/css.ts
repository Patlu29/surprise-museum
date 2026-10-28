/** Parses a CSS time such as "400ms" or "0.4s" into milliseconds. Returns null if it is not a time. */
export function parseCssTimeMs(value: string): number | null {
  const match = /^\s*(-?\d*\.?\d+)(ms|s)\s*$/i.exec(value);
  if (!match || !match[1] || !match[2]) return null;
  const amount = parseFloat(match[1]);
  return match[2].toLowerCase() === 's' ? amount * 1000 : amount;
}

/**
 * Reads a duration token (for example `--duration-fade-through`) in milliseconds. Because the
 * tokens fall to 0 ms under reduced motion, timers built from this need no separate motion check.
 */
export function cssDurationMs(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  return parseCssTimeMs(raw) ?? fallback;
}
