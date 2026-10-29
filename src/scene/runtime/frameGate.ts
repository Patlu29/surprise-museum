/**
 * Decides, from the browser's requestAnimationFrame timestamps, which frames to render so the
 * scene runs at a cap (NFR-7). Pure and allocation-free, so it can be unit-tested.
 *
 * A frame is due once the time since the last rendered frame is within half a display refresh of
 * the wanted interval. Measuring from the last rendered frame (rather than from a fixed grid)
 * keeps the rhythm steady when the display's true refresh rate is a hair off nominal, which a
 * fixed grid turned into a 50 ms frame every few seconds at a 30 FPS cap. The refresh period is
 * learned from the ticks themselves, so a 120 Hz screen gets 60 FPS and a 60 Hz screen gets 30.
 * On a 144 Hz screen a 60 FPS cap lands at about 72 FPS (ticks are 6.9 ms apart, so the choices
 * are 13.9 or 20.8 ms), which is still half the work of an uncapped loop. A stall (a hidden tab,
 * a long task) is never caught up with a burst of frames.
 */
export type FrameGate = (timestampMs: number) => boolean;

export function createFrameGate(fps: number): FrameGate {
  const interval = 1000 / Math.max(1, fps);
  let lastRender = Number.NEGATIVE_INFINITY;
  let lastTick = 0;
  let period = 1000 / 60;
  return (t) => {
    const dt = t - lastTick;
    lastTick = t;
    // Ticks further apart than 100 ms are pauses, not the refresh rate. Adopt a faster refresh
    // at once, and relax towards a slower one gradually.
    if (dt > 0 && dt < 100) period = dt < period ? dt : period + (dt - period) * 0.02;
    if (t - lastRender < interval - period / 2) return false;
    lastRender = t;
    return true;
  };
}
