import type { LayoutKind } from '@/lib/layout';
import { detectLayout } from '@/lib/layout';
import type { DockInputs, DockKind, Placement, Rect } from './chooseCaptionDock';
import { candidatesFor } from './chooseCaptionDock';

/**
 * The finale card's dock (FR-108, design spec 13.7): a pure function of the layout kind, which
 * comes from the viewport alone through `detectLayout`. Top on a portrait phone, right everywhere
 * else. No rectangle, camera, character, timing or card-size input, so it cannot flip while the
 * card is open unless the layout kind changes (a phone rotation does; a resize within a kind does not).
 */
export type FinaleDock = Extract<DockKind, 'top' | 'right'>;

export function finaleDockForLayout(layout: LayoutKind): FinaleDock {
  return layout === 'phone-portrait' ? 'top' : 'right';
}

export function finaleDockFor(viewport: { width: number; height: number }): FinaleDock {
  return finaleDockForLayout(detectLayout(viewport.width, viewport.height));
}

/**
 * The card's rectangle in its dock (design spec 13.7 table): the 136 px strip on a portrait phone,
 * the full right card elsewhere. It reuses the caption candidates in `tall` mode for the sizes, so
 * widths and offsets stay defined in one place.
 */
export function finalePlacementFor(
  layout: LayoutKind,
  geometry: Pick<DockInputs, 'viewport' | 'insets'>,
): Placement | null {
  const dock = finaleDockForLayout(layout);
  const size = dock === 'top' ? 'strip' : 'full';
  const inputs: DockInputs = {
    layout,
    viewport: geometry.viewport as Rect,
    insets: geometry.insets,
    keepOut: [],
    picture: null,
    actors: [],
    bigText: false,
    tall: true,
  };
  const found = candidatesFor(inputs).find(
    (candidate) => candidate.dock === dock && candidate.size === size,
  );
  return found ? { ...found, layout, clear: true } : null;
}
