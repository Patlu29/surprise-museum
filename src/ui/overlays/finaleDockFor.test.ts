import { describe, expect, it } from 'vitest';
import { detectLayout } from '@/lib/layout';
import { FINALE_STRIP_HEIGHT } from './chooseCaptionDock';
import { finaleDockFor, finalePlacementFor } from './finaleDockFor';

const size = (width: number, height: number) => ({ width, height });

describe('finaleDockFor (design spec 13.7, FR-108)', () => {
  it('follows the per-viewport table', () => {
    const table: Array<[number, number, 'top' | 'right']> = [
      [360, 640, 'top'],
      [390, 844, 'top'],
      [320, 568, 'top'],
      [640, 360, 'right'],
      [844, 390, 'right'],
      [768, 1024, 'right'],
      [1280, 720, 'right'],
    ];
    for (const [width, height, dock] of table) {
      expect(finaleDockFor(size(width, height)), `${width} by ${height}`).toBe(dock);
    }
  });

  it('gives the boundary cases of the spec', () => {
    const cases: Array<[number, number, 'top' | 'right']> = [
      [639, 800, 'top'],
      [640, 800, 'right'],
      [500, 500, 'top'],
      [400, 500, 'top'],
      [500, 400, 'right'],
      [700, 500, 'right'],
      [700, 501, 'right'],
      [1024, 768, 'right'],
    ];
    for (const [width, height, dock] of cases) {
      expect(finaleDockFor(size(width, height)), `${width} by ${height}`).toBe(dock);
    }
  });

  it('is top only for phone-portrait, by detectLayout, over a grid of sizes', () => {
    for (let width = 280; width <= 1400; width += 20) {
      for (let height = 280; height <= 1000; height += 20) {
        const expected = detectLayout(width, height) === 'phone-portrait' ? 'top' : 'right';
        expect(finaleDockFor(size(width, height))).toBe(expected);
      }
    }
  });

  it('stays the same for a resize that keeps the layout kind', () => {
    expect(finaleDockFor(size(1280, 720))).toBe(finaleDockFor(size(1100, 900)));
    expect(finaleDockFor(size(360, 640))).toBe(finaleDockFor(size(360, 560)));
  });

  it('moves once on a phone rotation and back', () => {
    expect(finaleDockFor(size(360, 640))).toBe('top');
    expect(finaleDockFor(size(640, 360))).toBe('right');
    expect(finaleDockFor(size(360, 640))).toBe('top');
  });
});

describe('finalePlacementFor (13.7 sizes)', () => {
  const geometry = (width: number, height: number, top: number) => ({
    viewport: { x: 12, y: 12, width: width - 24, height: height - 24 },
    insets: { top, bottom: 0 },
  });

  it('is the 136 px strip across the width on a portrait phone', () => {
    const placement = finalePlacementFor('phone-portrait', geometry(360, 640, 64));
    expect(placement?.dock).toBe('top');
    expect(placement?.rect.width).toBe(336);
    expect(placement?.rect.x).toBe(12);
    expect(placement?.rect.height).toBe(FINALE_STRIP_HEIGHT);
  });

  it('is the 256 px right card on a landscape phone at 640 by 360', () => {
    const placement = finalePlacementFor('phone-landscape', geometry(640, 360, 54));
    expect(placement?.dock).toBe('right');
    expect(placement?.rect.width).toBe(256);
    expect(placement?.rect.x).toBe(372);
  });

  it('is 288 wide at x 456 on a tablet at 768 by 1024, half the height', () => {
    const placement = finalePlacementFor('tablet', geometry(768, 1024, 64));
    expect(placement?.dock).toBe('right');
    expect(placement?.rect.width).toBe(288);
    expect(placement?.rect.x).toBe(456);
    expect(placement?.rect.height).toBe((1024 - 24) * 0.5);
  });
});
