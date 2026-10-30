import { describe, expect, it } from 'vitest';
import type { DockInputs, Rect } from './chooseCaptionDock';
import {
  chooseCaptionDock,
  DOCK_CLEARANCE,
  growRect,
  intersectionArea,
  MIN_CARD_WIDTH,
  isPlacementClear,
  rectsIntersect,
  STRIP_HEIGHT,
  FINALE_STRIP_HEIGHT,
  FIT_MIN_HEIGHT,
  landscapeCardWidth,
  pictureCentre,
  stripHeightFor,
  wideCardWidth,
} from './chooseCaptionDock';
import { detectLayout } from '@/lib/layout';

const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

/** Builds inputs for one of the four viewports the QA check names (design spec 3.5). */
function inputsFor(width: number, height: number, overrides: Partial<DockInputs> = {}): DockInputs {
  const margin = 12;
  return {
    layout: detectLayout(width, height),
    viewport: rect(margin, margin, width - margin * 2, height - margin * 2),
    insets: { top: 44 + 12, bottom: width < 1024 ? 176 : 0 },
    keepOut: [],
    picture: null,
    actors: [],
    bigText: false,
    ...overrides,
  };
}

describe('detectLayout', () => {
  it('classifies the four QA viewports', () => {
    expect(detectLayout(360, 640)).toBe('phone-portrait');
    expect(detectLayout(390, 844)).toBe('phone-portrait');
    expect(detectLayout(844, 390)).toBe('phone-landscape');
    expect(detectLayout(800, 1000)).toBe('tablet');
    expect(detectLayout(1280, 720)).toBe('desktop');
  });
});

describe('rect helpers', () => {
  it('detects overlap, touching edges and area', () => {
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(true);
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(false);
    expect(intersectionArea(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(25);
    expect(intersectionArea(rect(0, 0, 10, 10), rect(20, 20, 5, 5))).toBe(0);
  });

  it('grows a rectangle on every side', () => {
    expect(growRect(rect(10, 10, 20, 20), 8)).toEqual(rect(2, 2, 36, 36));
  });
});

describe('chooseCaptionDock: first clear candidate wins', () => {
  it('phone portrait: top, full, when nothing is in the way', () => {
    const placement = chooseCaptionDock(inputsFor(360, 640));
    expect(placement.dock).toBe('top');
    expect(placement.size).toBe('full');
    expect(placement.clear).toBe(true);
    // The card spans the usable width and sits below the top bar.
    expect(placement.rect.x).toBe(12);
    expect(placement.rect.width).toBe(336);
    expect(placement.rect.y).toBeGreaterThanOrEqual(56);
  });

  it('phone portrait: moves to a top strip when the picture is in the upper area', () => {
    const picture = rect(40, 180, 280, 140);
    const placement = chooseCaptionDock(inputsFor(360, 640, { picture }));
    expect(placement.size).toBe('strip');
    expect(placement.rect.height).toBe(STRIP_HEIGHT);
  });

  it('phone portrait: falls to the bottom strip when the top is covered by the picture', () => {
    const picture = rect(20, 56, 320, 260);
    const placement = chooseCaptionDock(inputsFor(360, 640, { picture }));
    expect(placement.dock).toBe('bottom');
    expect(placement.size).toBe('strip');
    expect(placement.clear).toBe(true);
    expect(rectsIntersect(growRect(placement.rect, DOCK_CLEARANCE), picture)).toBe(false);
  });

  it('phone landscape: right, full, then left if the right is blocked', () => {
    const open = chooseCaptionDock(inputsFor(844, 390));
    expect(open.dock).toBe('right');
    expect(open.size).toBe('full');

    const blockedRight = chooseCaptionDock(
      inputsFor(844, 390, { picture: rect(560, 100, 200, 160) }),
    );
    expect(blockedRight.dock).toBe('left');
    expect(blockedRight.size).toBe('full');
  });

  it('desktop: right, full by default; left when the Visitor is on the right; bottom strip last', () => {
    expect(chooseCaptionDock(inputsFor(1280, 720)).dock).toBe('right');

    const visitorRight = chooseCaptionDock(
      inputsFor(1280, 720, { actors: [rect(900, 300, 200, 300)] }),
    );
    expect(visitorRight.dock).toBe('left');

    const bothSides = chooseCaptionDock(
      inputsFor(1280, 720, {
        picture: rect(60, 100, 300, 250),
        actors: [rect(880, 120, 300, 300)],
      }),
    );
    expect(bothSides.dock === 'bottom-centre' || bothSides.size === 'strip').toBe(true);
  });

  it('never covers the picture, the Visitor or the Guide at the QA viewports when a clear dock exists', () => {
    const viewports: Array<[number, number]> = [
      [360, 640],
      [390, 844],
      [844, 390],
      [1280, 720],
    ];
    for (const [width, height] of viewports) {
      // A typical default view: picture left of centre, below the dock band, characters low in the frame.
      const picture = rect(width * 0.12, height * 0.3, width * 0.34, height * 0.26);
      const actors = [
        rect(width * 0.3, height * 0.55, width * 0.12, height * 0.28),
        rect(width * 0.5, height * 0.55, width * 0.12, height * 0.28),
      ];
      const placement = chooseCaptionDock(inputsFor(width, height, { picture, actors }));
      expect(placement.clear, `${width}x${height}`).toBe(true);
      for (const obstacle of [picture, ...actors]) {
        expect(rectsIntersect(placement.rect, obstacle), `${width}x${height}`).toBe(false);
      }
    }
  });
});

describe('chooseCaptionDock: HUD keep-out areas', () => {
  it('avoids a chip the card must not cover', () => {
    const chip = rect(80, 70, 200, 48);
    const placement = chooseCaptionDock(inputsFor(360, 640, { keepOut: [chip] }));
    expect(rectsIntersect(placement.rect, chip)).toBe(false);
  });

  it('keeps the top candidate below the top bar', () => {
    const bar = rect(12, 12, 336, 44);
    const placement = chooseCaptionDock(inputsFor(360, 640, { keepOut: [bar] }));
    expect(placement.dock).toBe('top');
    expect(placement.rect.y).toBeGreaterThanOrEqual(bar.y + bar.height + DOCK_CLEARANCE);
  });
});

describe('chooseCaptionDock: nothing is clear', () => {
  it('picks the strip that overlaps the picture least, and says it is not clear', () => {
    // The picture fills the whole screen, so every candidate overlaps; the strip overlapping least wins.
    const picture = rect(0, 0, 360, 400);
    const placement = chooseCaptionDock(inputsFor(360, 640, { picture }));
    expect(placement.size).toBe('strip');
    expect(placement.clear).toBe(false);
    expect(placement.dock).toBe('bottom');
  });

  it('prefers keeping the picture clear over keeping the Visitor clear', () => {
    const picture = rect(12, 56, 336, 200);
    const visitorOverBottom = rect(100, 400, 160, 200);
    const placement = chooseCaptionDock(
      inputsFor(360, 640, { picture, actors: [visitorOverBottom], keepOut: [] }),
    );
    // The bottom strip overlaps only the Visitor, the top strips overlap the picture.
    expect(placement.dock).toBe('bottom');
  });
});

describe('big text', () => {
  it('allows a taller full card', () => {
    const normal = chooseCaptionDock(inputsFor(1280, 720));
    const big = chooseCaptionDock(inputsFor(1280, 720, { bigText: true }));
    expect(big.rect.height).toBeGreaterThan(normal.rect.height);
  });
});

describe('the finale card (tall)', () => {
  it('gets a taller full card in portrait so its two buttons stay visible', () => {
    const caption = chooseCaptionDock(inputsFor(360, 640));
    const finale = chooseCaptionDock(inputsFor(360, 640, { tall: true }));
    expect(finale.size).toBe('full');
    expect(finale.rect.height).toBeGreaterThan(caption.rect.height);
  });

  it('uses a taller strip, with room for the heading and both buttons', () => {
    const picture = rect(12, 100, 336, 120);
    const placement = chooseCaptionDock(inputsFor(360, 640, { tall: true, picture }));
    expect(placement.size === 'strip' ? placement.rect.height : FINALE_STRIP_HEIGHT).toBe(
      FINALE_STRIP_HEIGHT,
    );
  });
});

describe('isPlacementClear', () => {
  it('reports when a placed card starts to overlap something', () => {
    const inputs = inputsFor(1280, 720);
    const placement = chooseCaptionDock(inputs);
    expect(isPlacementClear(placement, inputs)).toBe(true);
    expect(isPlacementClear(placement, { ...inputs, actors: [placement.rect] })).toBe(false);
  });
});

describe('landscape framed geometry (844 by 390, presentation camera)', () => {
  // Picture upper centre-left, Visitor and Guide beside it (measured from the framed pose).
  const picture = rect(180, 65, 175, 145);
  const visitor = rect(375, 120, 70, 205);
  const guide = rect(440, 70, 90, 180);
  const hudBar = rect(12, 12, 820, 44);
  const joystick = rect(12, 214, 164, 164);

  it('docks right, full, at no less than the minimum width', () => {
    const p = chooseCaptionDock(
      inputsFor(844, 390, { picture, actors: [visitor, guide], keepOut: [hudBar, joystick] }),
    );
    expect(p.dock).toBe('right');
    expect(p.size).toBe('full');
    expect(p.clear).toBe(true);
    expect(p.rect.width).toBeGreaterThanOrEqual(MIN_CARD_WIDTH);
  });

  it('never narrows below the minimum, even on a short, narrow landscape phone', () => {
    for (const [w, h] of [
      [667, 375],
      [568, 320],
      [844, 390],
    ] as const) {
      const p = chooseCaptionDock(inputsFor(w, h));
      expect(p.rect.width).toBeGreaterThanOrEqual(MIN_CARD_WIDTH);
      expect(p.expandedRect.width).toBeGreaterThanOrEqual(MIN_CARD_WIDTH);
    }
  });

  it('falls back to a strip at the minimum width when the characters block both columns', () => {
    const wide = rect(300, 70, 250, 300);
    const p = chooseCaptionDock(
      inputsFor(844, 390, { picture, actors: [wide, rect(600, 70, 200, 300)], keepOut: [hudBar] }),
    );
    expect(p.size).toBe('strip');
    expect(p.clear).toBe(false);
    expect(p.rect.width).toBeGreaterThanOrEqual(MIN_CARD_WIDTH);
    expect(p.rect.height).toBe(STRIP_HEIGHT);
  });

  it('wide and portrait docks also respect the minimum', () => {
    expect(chooseCaptionDock(inputsFor(1280, 720)).rect.width).toBeGreaterThanOrEqual(MIN_CARD_WIDTH);
    expect(chooseCaptionDock(inputsFor(360, 640)).rect.width).toBeGreaterThanOrEqual(MIN_CARD_WIDTH);
  });
});

describe('v1.4: strip, fitted card and widths (design spec 3.5)', () => {
  it('S2: strip heights follow the caption scale', () => {
    const picture = rect(12, 100, 336, 120);
    const heights = [1, 1.25, 1.5].map(
      (captionScale) =>
        chooseCaptionDock(
          inputsFor(360, 640, { picture, captionScale, bigText: captionScale > 1 }),
        ).rect.height,
    );
    expect(heights).toEqual([104, 112, 124]);
    expect(stripHeightFor(1)).toBe(STRIP_HEIGHT);
    expect(STRIP_HEIGHT).toBe(104);
    expect(MIN_CARD_WIDTH).toBe(256);
  });

  it('360x640: the top strip clears a picture that starts at y 192, fitted is too short', () => {
    const picture = rect(40, 200, 280, 140);
    const p = chooseCaptionDock(inputsFor(360, 640, { picture }));
    expect(p.dock).toBe('top');
    expect(p.size).toBe('strip');
    expect(p.clear).toBe(true);
    expect(p.rect.y + p.rect.height + 24).toBeLessThanOrEqual(picture.y);
  });

  it('S6: 390x844 places a fitted card of about 168 px, not a strip', () => {
    const picture = rect(40, 253, 310, 160);
    const p = chooseCaptionDock(inputsFor(390, 844, { picture }));
    expect(p.size).toBe('fitted');
    expect(p.dock).toBe('top');
    expect(Math.abs(p.rect.height - 168)).toBeLessThanOrEqual(16);
    expect(p.rect.height).toBeGreaterThanOrEqual(FIT_MIN_HEIGHT);
    expect(p.rect.height).toBeLessThan(224);
  });

  it('fitted is only valid at 128 px or more: 120 px of clearance gives a strip', () => {
    const picture = rect(40, 68 + 120 + DOCK_CLEARANCE, 280, 140);
    expect(chooseCaptionDock(inputsFor(360, 640, { picture })).size).toBe('strip');
    const roomier = rect(40, 68 + 136 + DOCK_CLEARANCE, 280, 140);
    expect(chooseCaptionDock(inputsFor(360, 640, { picture: roomier })).size).toBe('fitted');
  });

  it('order: full beats fitted beats strip; landscape tries the left full before right fitted', () => {
    const blockLower = rect(560, 240, 200, 120);
    const p = chooseCaptionDock(inputsFor(844, 390, { actors: [blockLower] }));
    // Left is clear of the Guide's rectangle, so left full wins over a fitted right card.
    expect(p.dock).toBe('left');
    expect(p.size).toBe('full');
    const both = chooseCaptionDock(
      inputsFor(844, 390, { actors: [blockLower, rect(20, 120, 300, 60)] }),
    );
    expect(both.dock).toBe('right');
    expect(both.size).toBe('fitted');
  });

  it('never fits the finale card', () => {
    const picture = rect(12, 56 + 200, 336, 100);
    expect(chooseCaptionDock(inputsFor(390, 844, { tall: true, picture })).size).not.toBe('fitted');
  });

  it('S7: widths', () => {
    expect(landscapeCardWidth(844)).toBe(256);
    expect(landscapeCardWidth(932)).toBeGreaterThanOrEqual(270);
    expect(landscapeCardWidth(932)).toBeLessThanOrEqual(280);
    expect(landscapeCardWidth(1200)).toBe(352);
    expect(wideCardWidth(1280)).toBeCloseTo(358.4, 1);
    expect(wideCardWidth(1024)).toBeCloseTo(288, 0);
    expect(chooseCaptionDock(inputsFor(844, 390)).rect.width).toBe(256);
    const wide = chooseCaptionDock(inputsFor(1280, 720));
    expect(wide.rect.width).toBeCloseTo(358.4, 1);
    // Card left edge: 1280 - 12 - 12 (edge) - 12 (viewport margin) ... must sit right of 68%.
    expect(wide.rect.x).toBeGreaterThanOrEqual(1280 * 0.68);
  });

  it('S5: a forced fallback strip keeps off the picture centre third when any candidate can', () => {
    // Picture fills the top and middle; the bottom strip is the only one off the centre third.
    const picture = rect(12, 56, 336, 360);
    const p = chooseCaptionDock(inputsFor(360, 640, { picture }));
    expect(p.size).toBe('strip');
    expect(p.clear).toBe(false);
    expect(rectsIntersect(p.rect, pictureCentre(picture))).toBe(false);
  });

  it('falls back to the least picture area when every strip covers the centre third', () => {
    const picture = rect(0, 0, 360, 640);
    const p = chooseCaptionDock(inputsFor(360, 640, { picture }));
    expect(p.size).toBe('strip');
    expect(p.clear).toBe(false);
  });
});
