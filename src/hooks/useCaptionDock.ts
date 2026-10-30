import { useEffect, useRef, useState } from 'react';
import type { LayoutKind } from '@/lib/layout';
import { screenRects } from '@/state/screenRects';
import { CAMERA_EVENT, isCameraSignal } from '@/ui/overlays/captionGate';
import {
  cameraSettledForUpgrade,
  initialDockState,
  requestFreeRechoice,
  stepDock,
  type DockState,
} from '@/ui/overlays/captionDockState';
import type { DockInputs, Placement, Rect } from '@/ui/overlays/chooseCaptionDock';
import { samePlacement } from '@/ui/overlays/chooseCaptionDock';

/** What the HUD measures from the DOM for the placement rule. */
export interface DockGeometry {
  viewport: Rect;
  insets: { top: number; bottom: number };
  keepOut: Rect[];
}

export interface CaptionDockOptions {
  active: boolean;
  layout: LayoutKind;
  /** Caption scale: 1, 1.25 or 1.5. */
  captionScale: number;
  tall: boolean;
  /** A new value (the photo id) starts a fresh choice and a fresh upgrade budget. */
  resetKey: string | null;
  measure: () => DockGeometry | null;
  /** True while the card is expanded, focused, scrolled or touched. */
  isBusy: () => boolean;
}

const POLL_MS = 100;
const STALE_MS = 1000;

/**
 * Runs `chooseCaptionDock` about every 100 ms while a card is showing, using the rectangles the
 * scene publishes in `screenRects`, through the stability and upgrade rules in `captionDockState`
 * (design spec 3.5). Also tracks the presentation camera's mode: upgrades wait for a settled
 * camera, and the first `framed` signal gives one free re-choice if the card appeared earlier.
 */
export function useCaptionDock(options: CaptionDockOptions): Placement | null {
  const { active, layout, captionScale, tall, resetKey } = options;
  const [placement, setPlacement] = useState<Placement | null>(null);
  const measureRef = useRef(options.measure);
  const busyRef = useRef(options.isBusy);
  useEffect(() => {
    measureRef.current = options.measure;
    busyRef.current = options.isBusy;
  });

  useEffect(() => {
    // A new card, layout, text size or card kind starts from a fresh choice.
    let state: DockState = initialDockState();
    let mode = 'follow';
    let modeSettled = true;
    let modeAt = -Infinity;
    let framedSeen = false;
    if (!active) return;

    const onSignal = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isCameraSignal(detail)) return;
      if (detail.photoId !== null && resetKey !== null && detail.photoId !== resetKey) return;
      mode = detail.mode;
      modeSettled = detail.settled;
      modeAt = performance.now();
      if (detail.mode === 'framed' && detail.settled && !framedSeen) {
        framedSeen = true;
        state = requestFreeRechoice(state);
      }
    };
    window.addEventListener(CAMERA_EVENT, onSignal);

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
        bigText: captionScale > 1,
        captionScale,
        tall,
      };
      const before = state.placement;
      state = stepDock(state, {
        inputs,
        now,
        settled: cameraSettledForUpgrade(mode, modeSettled, modeAt, now),
        busy: busyRef.current(),
      });
      if (!samePlacement(before, state.placement)) setPlacement(state.placement);
    };
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      window.removeEventListener(CAMERA_EVENT, onSignal);
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [active, layout, captionScale, tall, resetKey]);

  return active ? placement : null;
}
