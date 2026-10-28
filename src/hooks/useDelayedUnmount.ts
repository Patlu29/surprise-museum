import { useEffect, useState } from 'react';

/**
 * Keeps something mounted for `delayMs` after `show` turns false, so it can fade out.
 * Pass 0 under reduced motion for an immediate unmount.
 */
export function useDelayedUnmount(
  show: boolean,
  delayMs: number,
): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(show);
  if (show && !mounted) setMounted(true);

  useEffect(() => {
    if (show || !mounted) return;
    const timer = setTimeout(() => setMounted(false), delayMs);
    return () => clearTimeout(timer);
  }, [show, mounted, delayMs]);

  return { mounted: mounted || show, leaving: !show && mounted };
}
