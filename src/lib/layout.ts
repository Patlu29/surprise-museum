/** Layout kinds from the design spec (3.2). Breakpoints cannot be tokens, so they live here once. */
export type LayoutKind = 'phone-portrait' | 'phone-landscape' | 'tablet' | 'desktop';

export function detectLayout(width: number, height: number): LayoutKind {
  if (width > height && height <= 500) return 'phone-landscape';
  if (width < 640) return 'phone-portrait';
  if (width < 1024) return 'tablet';
  return 'desktop';
}
