import { resolveReducedMotion, useSettingsStore } from '@/state/settingsStore';
import { useMediaQuery } from './useMediaQuery';

/** The effective reduced-motion value: the Visitor's setting over the operating system's request. */
export function useReducedMotion(): boolean {
  const motion = useSettingsStore((state) => state.motion);
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  return resolveReducedMotion(motion, system);
}
