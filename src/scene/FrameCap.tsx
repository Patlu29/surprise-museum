import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

/**
 * Caps rendering at `fps` on phones (NFR-7). The Canvas runs with frameloop="never" and this
 * component calls `advance` from its own requestAnimationFrame loop, skipping frames in between.
 * The browser already stops requestAnimationFrame in a hidden tab, so rendering pauses there too.
 */
export function FrameCap({ fps }: { fps: number }) {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const interval = 1000 / fps - 2;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last >= interval) {
        last = t;
        advance(t / 1000); // R3F's advance takes seconds, not milliseconds
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [advance, fps]);
  return null;
}
