import { describe, expect, it } from 'vitest';
import type { DockInputs, Rect } from './chooseCaptionDock';
import { chooseCaptionDock, clearUpgradeCandidates } from './chooseCaptionDock';
import { detectLayout } from '@/lib/layout';

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** BUG-7: the top bar is a keep-out and the dock starts 12 px below it (bar bottom 56, card top 68). */
function withTopBar(width: number, height: number, actors: Rect[] = []): DockInputs {
  return {
    layout: detectLayout(width, height),
    viewport: rect(12, 12, width - 24, height - 24),
    insets: { top: 56, bottom: width < 1024 ? 176 : 0 },
    keepOut: [rect(0, 0, width, 56)],
    picture: null,
    actors,
    bigText: false,
  };
}

describe('upgrade test against fixed keep-outs (BUG-7)', () => {
  it.each([
    [390, 844],
    [1280, 720],
  ])('a strip upgrades when every scene rect is gone at %ix%i', (w, h) => {
    const blocker = rect(0, 56, w, h - 56);
    const strip = chooseCaptionDock(withTopBar(w, h, [blocker]));
    expect(strip.size).toBe('strip');
    const better = clearUpgradeCandidates(strip, withTopBar(w, h));
    expect(better.length).toBeGreaterThan(0);
    expect(better[0]?.rank).toBeLessThan(strip.rank);
  });

  it('still applies the 16 px margin to scene rects', () => {
    const base = withTopBar(1280, 720);
    const strip = chooseCaptionDock(withTopBar(1280, 720, [rect(0, 56, 1280, 664)]));
    const first = clearUpgradeCandidates(strip, base)[0];
    expect(first).toBeDefined();
    if (!first) return;
    // A character 10 px from the best candidate: clear at 8 px, not clear at 16 px.
    const near = rect(first.rect.x + first.rect.width + 10, first.rect.y, 40, first.rect.height);
    const blocked = clearUpgradeCandidates(strip, { ...base, actors: [near] });
    expect(blocked.some((c) => c.rank === first.rank)).toBe(false);
  });
});
