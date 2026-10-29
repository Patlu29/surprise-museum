import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { createFrameGate } from './runtime/frameGate';

/**
 * Drives rendering at `fps` (NFR-7). The Canvas runs with frameloop="never" and this component
 * calls `advance` from its own requestAnimationFrame loop, skipping frames in between (see
 * createFrameGate for the scheduling). The browser already stops requestAnimationFrame in a
 * hidden tab, so rendering pauses there too.
 *
 * `fps` changes with the situation: 10 behind the welcome screen (nothing is visible and the
 * main thread is busy loading), 30 on phones and Low graphics, 60 elsewhere so a 120 or 144 Hz
 * display does not render twice as much as the requirement asks for.
 */
export function FrameCap({ fps }: { fps: number }) {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    const gate = createFrameGate(fps);
    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (gate(t)) advance(t / 1000); // R3F's advance takes seconds, not milliseconds
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [advance, fps]);
  return null;
}
