import { useEffect, useRef, useState } from 'react';
import type { LayoutKind } from '@/lib/layout';
import { screenRects } from '@/state/screenRects';
import type { DockInputs, Placement, Rect } from '@/ui/overlays/chooseCaptionDock';
import {
  chooseCaptionDock,
  isPlacementClear,
  samePlacement,
} from '@/ui/overlays/chooseCaptionDock';

/** What the HUD measures from the DOM for the placement rule. */
export interface DockGeometry {
  viewport: Rect;
  insets: { top: number; bottom: number };
  keepOut: Rect[];
}

const POLL_MS = 100;
/** A placement may overlap something for this long before it moves (design spec 3.5, stability). */
const OVERLAP_GRACE_MS = 400;
const STALE_MS = 1000;

/**
 * Runs `chooseCaptionDock` about every 100 ms while a card is showing, using the rectangles the
 * scene publishes in `screenRects`. Once placed, a card stays put unless it has overlapped
 * something for 400 ms or the layout changes, and never moves while the Visitor is scrolling or
 * has focus inside it (design spec 3.5).
 */
export function useCaptionDock(
  active: boolean,
  layout: LayoutKind,
  bigText: boolean,
  tall: boolean,
  measure: () => DockGeometry | null,
  isBusy: () => boolean,
): Placement | null {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const currentRef = useRef<Placement | null>(null);
  const overlapSince = useRef<number | null>(null);
  const measureRef = useRef(measure);
  const busyRef = useRef(isBusy);
  useEffect(() => {
    measureRef.current = measure;
    busyRef.current = isBusy;
  });

  useEffect(() => {
    // A new card, layout, text size or card kind starts from a fresh choice.
    currentRef.current = null;
    overlapSince.current = null;
    if (!active) return;
    const tick = () => {
      const geometry = measureRef.current();
      if (!geometry) return;
      const now = performance.now();
      const fresh = now - screenRects.updatedAt < STALE_MS;
      const inputs: DockInputs = {
        layout,
        viewport: geometry.viewport,
        insets: geometry.insets,
        keepOut: geometry.keepOut,
        picture: fresh ? screenRects.picture : null,
        actors: fresh
          ? [screenRects.visitor, screenRects.guide].filter((r): r is Rect => r !== null)
          : [],
        bigText,
        tall,
      };
      const current = currentRef.current;
      if (current && current.layout === layout) {
        if (busyRef.current()) return;
        if (isPlacementClear(current, inputs)) {
          overlapSince.current = null;
          return;
        }
        if (overlapSince.current === null) overlapSince.current = now;
        if (now - overlapSince.current < OVERLAP_GRACE_MS) return;
      }
      overlapSince.current = null;
      const next = chooseCaptionDock(inputs);
      if (!samePlacement(current, next)) {
        currentRef.current = next;
        setPlacement(next);
      }
    };
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [active, layout, bigText, tall]);

  return active ? placement : null;
}
