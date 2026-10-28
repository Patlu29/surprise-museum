import { useEffect } from 'react';
import { useSettingsStore } from '@/state/settingsStore';
import { useReducedMotion } from './useReducedMotion';

/**
 * Mirrors settings onto <html> so the CSS tokens react (design spec 8.4, tokens.css):
 * `data-motion="reduce|full"` and `data-caption-size="normal|large|xlarge"`.
 * Mount once, in App.
 */
export function useApplySettings(): void {
  const reduced = useReducedMotion();
  const captionSize = useSettingsStore((state) => state.captionSize);

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduce' : 'full';
  }, [reduced]);

  useEffect(() => {
    document.documentElement.dataset.captionSize = captionSize;
  }, [captionSize]);
}
