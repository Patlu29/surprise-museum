import { useSyncExternalStore } from 'react';
import type { LayoutKind } from '@/lib/layout';
import { detectLayout } from '@/lib/layout';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}

/** The current layout kind (phone portrait or landscape, tablet, desktop). */
export function useLayoutKind(): LayoutKind {
  return useSyncExternalStore(
    subscribe,
    () => detectLayout(window.innerWidth, window.innerHeight),
    () => 'desktop' as LayoutKind,
  );
}
