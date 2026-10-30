import { describe, expect, it } from 'vitest';
import {
  CAPTION_CAP_MS,
  NO_FRAMING_GRACE_MS,
  GUIDE_CEILING_MS,
  applyGuideSignal,
  applySignal,
  isCameraSignal,
  nextCheckInMs,
  startGate,
  tickGate,
  type CameraSignal,
} from './captionGate';

const sig = (over: Partial<CameraSignal>): CameraSignal => ({
  mode: 'framed',
  settled: true,
  photoId: 'a',
  seq: 5,
  ...over,
});

describe('captionGate', () => {
  it('waits while the camera is entering, then shows on framed', () => {
    let g = startGate('a', 4, 0);
    g = applySignal(g, sig({ mode: 'entering', settled: false, seq: 4 }));
    expect(g.framing).toBe(true);
    g = tickGate(g, NO_FRAMING_GRACE_MS + 500);
    expect(g.ready).toBe(false);
    g = applySignal(g, sig({}));
    expect(g.ready).toBe(true);
  });

  it('does not wait when a reduced-motion cut or follow arrives settled', () => {
    expect(applySignal(startGate('a', 4, 0), sig({ mode: 'cut' })).ready).toBe(true);
    expect(applySignal(startGate('a', 4, 0), sig({ mode: 'follow', seq: 4 })).ready).toBe(true);
  });

  it('shows after the grace when no framing is announced (fallback)', () => {
    const g = startGate('a', 4, 100);
    expect(tickGate(g, 100 + NO_FRAMING_GRACE_MS - 1).ready).toBe(false);
    expect(tickGate(g, 100 + NO_FRAMING_GRACE_MS).ready).toBe(true);
  });

  it('shows at the 1.5 s cap even if the camera never settles', () => {
    let g = startGate('a', 4, 0);
    g = applySignal(g, sig({ mode: 'entering', settled: false }));
    expect(tickGate(g, CAPTION_CAP_MS - 1).ready).toBe(false);
    expect(tickGate(g, CAPTION_CAP_MS).ready).toBe(true);
  });

  it('ignores events for another photo', () => {
    const g = applySignal(startGate('a', 4, 0), sig({ photoId: 'b' }));
    expect(g.ready).toBe(false);
    expect(applySignal(g, sig({ photoId: null, mode: 'follow' })).ready).toBe(false);
  });

  it('ignores a stale settled event from an earlier presentation of the same photo', () => {
    const g = startGate('a', 5, 0);
    expect(applySignal(g, sig({ seq: 5 })).ready).toBe(false);
    expect(applySignal(g, sig({ seq: 6 })).ready).toBe(true);
  });

  it('reports when to check next', () => {
    let g = startGate('a', 0, 0);
    expect(nextCheckInMs(g, 50)).toBe(NO_FRAMING_GRACE_MS - 50);
    g = applySignal(g, sig({ mode: 'entering', settled: false, seq: 0 }));
    expect(nextCheckInMs(g, 100)).toBe(CAPTION_CAP_MS - 100);
    expect(nextCheckInMs({ ...g, ready: true }, 100)).toBeNull();
  });

  it('validates event detail', () => {
    expect(isCameraSignal(sig({}))).toBe(true);
    expect(isCameraSignal({ mode: 'framed' })).toBe(false);
    expect(isCameraSignal(null)).toBe(false);
  });

  describe('Guide arrival (N-6)', () => {
    it('waits for the Guide after the camera settles, then shows on arrival', () => {
      let g = startGate('a', 4, 0);
      g = applyGuideSignal(g, { photoId: 'a', arrived: false }, 10);
      g = applySignal(g, sig({ mode: 'entering', settled: false, seq: 4 }));
      g = applySignal(g, sig({}));
      expect(g.ready).toBe(false);
      g = applyGuideSignal(g, { photoId: 'a', arrived: true }, 2500);
      expect(g.ready).toBe(true);
    });

    it('counts the cap from the later of dwell completion and Guide arrival', () => {
      let g = startGate('a', 4, 0);
      g = applyGuideSignal(g, { photoId: 'a', arrived: false }, 10);
      g = applySignal(g, sig({ mode: 'entering', settled: false, seq: 4 }));
      // Past 1.5 s from dwell completion, the Guide is still walking: no card yet.
      expect(tickGate(g, CAPTION_CAP_MS + 500).ready).toBe(false);
      g = applyGuideSignal(g, { photoId: 'a', arrived: true }, 2500);
      expect(g.ready).toBe(false); // camera still unsettled
      expect(tickGate(g, 2500 + CAPTION_CAP_MS - 1).ready).toBe(false);
      expect(tickGate(g, 2500 + CAPTION_CAP_MS).ready).toBe(true);
    });

    it('counts the cap from dwell completion when the Guide arrives earlier', () => {
      let g = startGate('a', 4, 1000);
      g = applySignal(g, sig({ mode: 'entering', settled: false, seq: 4 }));
      g = applyGuideSignal(g, { photoId: 'a', arrived: true }, 1000);
      expect(tickGate(g, 1000 + CAPTION_CAP_MS - 1).ready).toBe(false);
      expect(tickGate(g, 1000 + CAPTION_CAP_MS).ready).toBe(true);
    });

    it('releases at the ceiling if the Guide never arrives', () => {
      let g = startGate('a', 4, 0);
      g = applyGuideSignal(g, { photoId: 'a', arrived: false }, 10);
      g = applySignal(g, sig({}));
      expect(tickGate(g, GUIDE_CEILING_MS - 1).ready).toBe(false);
      expect(tickGate(g, GUIDE_CEILING_MS).ready).toBe(true);
    });

    it('ignores a Guide signal for another photo', () => {
      let g = startGate('a', 4, 0);
      g = applyGuideSignal(g, { photoId: 'b', arrived: false }, 10);
      expect(applySignal(g, sig({})).ready).toBe(true);
    });
  });
});
