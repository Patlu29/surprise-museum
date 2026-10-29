import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { useSessionStore } from '@/state/sessionStore';
import { DprGovernor } from './runtime/dprGovernor';

/**
 * Lowers the pixel-ratio cap when the device cannot hold its frame rate while the Visitor is
 * roaming (see DprGovernor). It reports the new cap to its host, which passes it to the Canvas as
 * `dpr`; R3F re-applies the `dpr` prop on every configure, so the cap has to live in the prop
 * rather than be set on the renderer behind its back.
 */
interface AdaptiveDprProps {
  targetFps: number;
  start: number;
  floor: number;
  onCap: (cap: number) => void;
}

export function AdaptiveDpr({ targetFps, start, floor, onCap }: AdaptiveDprProps) {
  const governor = useMemo(
    () => new DprGovernor({ targetFps, start, floor }),
    [targetFps, start, floor],
  );
  useEffect(() => {
    document.documentElement.dataset.renderDprCap = String(governor.cap);
    return () => {
      delete document.documentElement.dataset.renderDprCap;
    };
  }, [governor]);

  useFrame(() => {
    const s = useSessionStore.getState();
    const active = s.phase === 'roaming' && s.viewerPhotoId === null;
    const next = governor.frame(performance.now(), active);
    if (next !== null) {
      document.documentElement.dataset.renderDprCap = String(next);
      onCap(next);
    }
  });
  return null;
}
