import { useEffect, useRef, useState } from 'react';
import {
  CAMERA_EVENT,
  applySignal,
  isCameraSignal,
  nextCheckInMs,
  startGate,
  tickGate,
  type CameraSignal,
  type CaptionGate,
} from '@/ui/overlays/captionGate';
import { useSessionStore } from '@/state/sessionStore';

/**
 * True when the caption card for `photoId` may show: the presentation camera has settled for this
 * photo, or the safety cap or the no-framing grace has passed (see `captionGate.ts`). Stale events
 * from an earlier presentation are ignored by photo id and sequence number. Listeners and timers
 * are removed on unmount. Pass null when no photo card is wanted.
 */
export function useCaptionGate(photoId: string | null): boolean {
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const lastSignal = useRef<CameraSignal | null>(null);
  const settledSeq = useRef(0);
  const baseline = useRef(0);

  // Always listening, so an event that lands before the card is wanted is not lost.
  useEffect(() => {
    const onSignal = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isCameraSignal(detail)) return;
      lastSignal.current = detail;
      if (detail.settled && (detail.mode === 'framed' || detail.mode === 'cut')) {
        settledSeq.current = Math.max(settledSeq.current, detail.seq);
      }
    };
    window.addEventListener(CAMERA_EVENT, onSignal);
    // When a presentation ends or changes photo, everything settled so far belongs to the past.
    let shown: string | null = null;
    const unsubscribe = useSessionStore.subscribe((state) => {
      const next = state.presentation.kind === 'photo' ? state.presentation.photoId : null;
      if (next !== shown) {
        baseline.current = settledSeq.current;
        shown = next;
      }
    });
    return () => {
      window.removeEventListener(CAMERA_EVENT, onSignal);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (photoId === null) return;
    let gate: CaptionGate = startGate(photoId, baseline.current, performance.now());
    let timer: number | null = null;
    const publish = () => {
      if (gate.ready) setReadyFor(photoId);
    };
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      const wait = nextCheckInMs(gate, performance.now());
      if (wait === null) return;
      timer = window.setTimeout(() => {
        gate = tickGate(gate, performance.now());
        publish();
        schedule();
      }, wait + 1);
    };
    const onSignal = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isCameraSignal(detail)) return;
      gate = applySignal(gate, detail);
      publish();
      schedule();
    };
    window.addEventListener(CAMERA_EVENT, onSignal);
    // An event may already have arrived in the same frame as the presentation.
    if (lastSignal.current) gate = applySignal(gate, lastSignal.current);
    publish();
    schedule();
    return () => {
      window.removeEventListener(CAMERA_EVENT, onSignal);
      if (timer !== null) window.clearTimeout(timer);
      setReadyFor((current) => (current === photoId ? null : current));
    };
  }, [photoId]);

  return photoId !== null && readyFor === photoId;
}
