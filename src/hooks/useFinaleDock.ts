import { useEffect, useRef, useState } from 'react';
import type { LayoutKind } from '@/lib/layout';
import { samePlacement, type Placement } from '@/ui/overlays/chooseCaptionDock';
import { finalePlacementFor } from '@/ui/overlays/finaleDockFor';
import type { DockGeometry } from './useCaptionDock';

/**
 * The finale card's placement (design spec 13.7). The dock comes from the layout kind alone, so it
 * is chosen when the card opens and moves only when the kind changes. The rectangle is measured
 * again on a resize and when the observed element (the top bar) changes size, which is how a
 * larger text size is noticed; none of that changes the dock. No polling.
 */
export function useFinaleDock(
  active: boolean,
  layout: LayoutKind,
  measure: () => DockGeometry | null,
  observed: () => Element | null,
): Placement | null {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const measureRef = useRef(measure);
  const observedRef = useRef(observed);
  useEffect(() => {
    measureRef.current = measure;
    observedRef.current = observed;
  });

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const geometry = measureRef.current();
      if (!geometry) return;
      const next = finalePlacementFor(layout, geometry);
      setPlacement((current) => (samePlacement(current, next) ? current : next));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('resize', schedule);
    const target = observedRef.current();
    const observer = target ? new ResizeObserver(schedule) : null;
    if (target) observer?.observe(target);
    return () => {
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [active, layout]);

  return active ? placement : null;
}
